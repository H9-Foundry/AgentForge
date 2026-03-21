import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { renderGitHubHandoffSummary } from "@h9-foundry/agentforge-audit";
import { schemaFixtures } from "@h9-foundry/agentforge-schemas";
import type { ReleaseArtifact } from "@h9-foundry/agentforge-shared-types";

import { compareLocalEvalRuns, explainLastRun, initProject, mapWorkflowRunStatusToGitHubStatus, runLocalEval, runLocalWorkflow, scanProject } from "./index.js";

function createGitFixture(prefix: string, repositoryUrl = "https://github.com/H9-Foundry/fixture.git"): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  execFileSync("git", ["init"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "AgentForge Test"], { cwd: root });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        repository: {
          type: "git",
          url: repositoryUrl
        },
        scripts: {
          test: "echo test",
          lint: "echo lint",
          typecheck: "echo typecheck"
        }
      },
      null,
      2
    )
  );
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(join(root, "src.ts"), "export const value = 1;\n");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "init"], { cwd: root });
  writeFileSync(join(root, "src.ts"), "export const value = 2;\n");
  return root;
}

function createGitLabFixture(prefix: string): string {
  return createGitFixture(prefix, "https://gitlab.com/h9-foundry/platform/fixture.git");
}

function createGenericHostFixture(prefix: string): string {
  return createGitFixture(prefix, "https://example.com/acme/fixture.git");
}

function createGitFixtureWithoutLockfile(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  execFileSync("git", ["init"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "AgentForge Test"], { cwd: root });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        repository: {
          type: "git",
          url: "https://github.com/H9-Foundry/fixture.git"
        },
        scripts: {
          test: "echo test",
          lint: "echo lint",
          typecheck: "echo typecheck"
        }
      },
      null,
      2
    )
  );
  writeFileSync(join(root, "src.ts"), "export const value = 1;\n");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "init"], { cwd: root });
  writeFileSync(join(root, "src.ts"), "export const value = 2;\n");
  return root;
}

function createFixtureRepo(): string {
  return createGitFixture("agentops-cli-");
}

function initializeWorkspace(root: string, options?: { trackerIssue?: number }): void {
  void options;
  initProject(root);
}

function ensureRequestsDir(root: string): void {
  mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
}

function writeYamlFile(filePath: string, value: unknown): void {
  writeFileSync(filePath, yaml.dump(value));
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function cloneFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function writeBundleFixture(
  root: string,
  runId: string,
  lifecycleArtifacts: unknown[],
  options?: { status?: "success" | "partial" | "failed" }
): string {
  const runRoot = join(root, ".agentops", "runs", runId);
  mkdirSync(runRoot, { recursive: true });
  const bundlePath = join(runRoot, "bundle.json");
  writeFileSync(
    bundlePath,
    JSON.stringify(
      {
        version: "1.0.0",
        runId,
        workflow: "eval:fixture",
        startedAt: "2026-03-19T10:00:00.000Z",
        finishedAt: "2026-03-19T10:00:01.000Z",
        status: options?.status ?? "success",
        policy: {
          version: 1,
          environment: "local",
          resolvedAt: "2026-03-19T10:00:00.000Z",
          defaults: schemaFixtures.policyDocument.defaults,
          paths: schemaFixtures.policyDocument.paths,
          plugins: schemaFixtures.policyDocument.plugins,
          tools: schemaFixtures.policyDocument.tools
        },
        entries: [],
        findings: [],
        proposedActions: [],
        blockedPlugins: [],
        lifecycleArtifacts,
        artifactPaths: {
          json: `.agentops/runs/${runId}/bundle.json`,
          markdown: `.agentops/runs/${runId}/summary.md`
        },
        provenance: {
          generatedBy: "agentforge-runtime",
          schemaVersion: "1.0.0",
          executionEnvironment: "local",
          repoRoot: root
        },
        redaction: {
          applied: true,
          strategyVersion: "1.0.0",
          categories: ["github-token", "api-key"]
        },
        components: []
      },
      null,
      2
    )
  );
  writeFileSync(join(runRoot, "summary.md"), `# ${runId}\n`);
  return bundlePath;
}

let builtCli = false;

function ensureBuiltCli(): void {
  if (builtCli) {
    return;
  }

  execFileSync("pnpm", ["build:packages"], {
    cwd: process.cwd(),
    stdio: "ignore"
  });
  builtCli = true;
}

function writeLocalPlugin(root: string, options: { manifestName: string; packageName: string; trust?: Record<string, unknown> }) {
  const pluginRoot = join(root, "agents", options.manifestName);
  mkdirSync(join(pluginRoot, "dist"), { recursive: true });
  writeFileSync(
    join(pluginRoot, "package.json"),
    JSON.stringify(
      {
        name: options.packageName,
        version: "0.1.0",
        type: "module",
        main: "./dist/index.js"
      },
      null,
      2
    )
  );
  writeFileSync(
    join(pluginRoot, "dist", "index.js"),
    [
      `const manifest = ${JSON.stringify({
        version: 1,
        name: options.manifestName,
        displayName: "Local Plugin",
        category: "test",
        runtime: { minVersion: "0.1.0", kind: "reasoning" },
        permissions: { model: false, network: false, tools: [], readPaths: ["**/*"], writePaths: [] },
        inputs: ["repo"],
        outputs: ["summary"],
        contextPolicy: { sections: ["repo"], minimalContext: true },
        trust: options.trust ?? { tier: "verified", source: "local", reviewed: true }
      })};`,
      "const agent = {",
      "  manifest,",
      "  outputSchema: { parse(value) { return value; } },",
      "  async execute() {",
      "    return {",
      `      summary: ${JSON.stringify(`Plugin ${options.manifestName} executed.`)},`,
      "      findings: [],",
      "      proposedActions: [],",
      "      requestedTools: [],",
      "      blockedActionFlags: [],",
      "      metadata: { plugin: manifest.name }",
      "    };",
      "  }",
      "};",
      "export default agent;",
      "export { agent };"
    ].join("\n")
  );
}

describe("cli smoke flows", () => {
  it("initializes, scans, runs, and explains a local workflow", async () => {
    const root = createGitFixture("agentops-cli-");

    const init = initProject(root);
    expect(init.created.length).toBeGreaterThan(0);

    const scan = scanProject(root);
    expect(scan.recommendations).toContain("code-review");

    const run = await runLocalWorkflow("pr-review", root);
    expect(run.runId.length).toBeGreaterThan(0);
    expect(run.jsonPath.endsWith("bundle.json")).toBe(true);
    expect(run.markdownPath.endsWith("summary.md")).toBe(true);
    expect(run.artifactCount).toBe(0);

    const explanation = explainLastRun(root);
    expect(explanation.runId).toBe(run.runId);
    expect(explanation.jsonPath).toBe(run.jsonPath);
    expect(explanation.artifactKinds).toEqual([]);
  });

  it("scaffolds a planning-discovery starter preset without overwriting an existing request", () => {
    const root = createGitFixture("agentops-cli-preset-");

    const firstInit = initProject(root, { preset: "planning-discovery" });
    expect(firstInit.preset?.preset).toBe("planning-discovery");
    expect(firstInit.preset?.workflow).toBe("planning-discovery");
    expect(firstInit.preset?.created).toBe(true);

    const requestPath = join(root, ".agentops", "requests", "planning.yaml");
    const firstRequest = yaml.load(readFileSync(requestPath, "utf8")) as Record<string, unknown>;
    expect(firstRequest.problemStatement).toMatch(/^Plan the next safe local-first improvement for agentops-cli-preset-/);
    expect(firstRequest.constraints).toContain("Keep the default path local-first and read-only");
    expect(firstRequest.pathHints).toContain("package.json");

    writeFileSync(requestPath, yaml.dump({ problemStatement: "Keep my custom request" }));
    const secondInit = initProject(root, { preset: "planning-discovery" });
    expect(secondInit.preset?.created).toBe(false);

    const secondRequest = yaml.load(readFileSync(requestPath, "utf8")) as Record<string, unknown>;
    expect(secondRequest.problemStatement).toBe("Keep my custom request");
  });

  it("loads an allowed local plugin and executes it through a workflow", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-cli-plugin-"));
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "AgentForge Test"], { cwd: root });
    writeFileSync(join(root, "package.json"), '{"name":"fixture"}');
    writeFileSync(join(root, "src.ts"), "export const value = 1;\n");
    initProject(root);
    writeLocalPlugin(root, {
      manifestName: "local-review",
      packageName: "@fixture/local-review"
    });
    writeFileSync(
      join(root, ".agentops", "agentops.yaml"),
      [
        "version: 1",
        "project:",
        "  name: fixture",
        "  language: typescript",
        "runtime:",
        "  mode: inspect",
        "  runs_path: .agentops/runs",
        "providers:",
        "  default: disabled",
        "plugins:",
        "  agents:",
        "    - name: local-review",
        "      package: '@fixture/local-review'",
        "      enabled: true"
      ].join("\n")
    );
    writeFileSync(
      join(root, ".agentops", "workflows", "plugin-review.yaml"),
      [
        "version: 1",
        "name: plugin-review",
        "trigger: manual",
        "nodes:",
        "  - id: local",
        "    kind: reasoning",
        "    agent: local-review",
        "    outputs_to: agentResults.local",
        "  - id: report",
        "    kind: report",
        "    outputs_to: reports.final"
      ].join("\n")
    );

    const run = await runLocalWorkflow("plugin-review", root);
    expect(run.blockedPlugins).toBe(0);

    const bundle = JSON.parse(readFileSync(run.jsonPath, "utf8")) as {
      blockedPlugins: unknown[];
      entries: { nodeId: string }[];
    };
    expect(bundle.blockedPlugins).toHaveLength(0);
    expect(bundle.entries.some((entry) => entry.nodeId === "local")).toBe(true);
  });

  it("records blocked local plugins when trust policy rejects them", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-cli-blocked-plugin-"));
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "AgentForge Test"], { cwd: root });
    writeFileSync(join(root, "package.json"), '{"name":"fixture"}');
    writeFileSync(join(root, "src.ts"), "export const value = 1;\n");
    initProject(root);
    writeLocalPlugin(root, {
      manifestName: "blocked-local-review",
      packageName: "@fixture/blocked-local-review",
      trust: {
        tier: "verified",
        source: "local",
        reviewed: false
      }
    });
    writeFileSync(
      join(root, ".agentops", "agentops.yaml"),
      [
        "version: 1",
        "project:",
        "  name: fixture",
        "  language: typescript",
        "runtime:",
        "  mode: inspect",
        "  runs_path: .agentops/runs",
        "providers:",
        "  default: disabled",
        "plugins:",
        "  agents:",
        "    - name: blocked-local-review",
        "      package: '@fixture/blocked-local-review'",
        "      enabled: true"
      ].join("\n")
    );

    const run = await runLocalWorkflow("pr-review", root);
    expect(run.blockedPlugins).toBe(1);

    const explanation = explainLastRun(root);
    expect(explanation.blockedPlugins).toBe(1);

    const bundle = JSON.parse(readFileSync(run.jsonPath, "utf8")) as {
      blockedPlugins: { reason: string }[];
    };
    expect(bundle.blockedPlugins[0]?.reason).toContain("Plugin review required");
  });

  it("explains historical bundles with missing optional arrays", () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-cli-explain-"));
    writeFileSync(join(root, "package.json"), '{"name":"fixture"}');
    initProject(root);

    const runRoot = join(root, ".agentops", "runs", "2026-03-17-example");
    mkdirSync(runRoot, { recursive: true });
    writeFileSync(
      join(runRoot, "bundle.json"),
      JSON.stringify(
        {
          runId: "2026-03-17-example",
          status: "completed"
        },
        null,
        2
      )
    );

    const explanation = explainLastRun(root);
    expect(explanation.runId).toBe("2026-03-17-example");
    expect(explanation.status).toBe("completed");
    expect(explanation.findings).toBe(0);
    expect(explanation.blockedActions).toBe(0);
    expect(explanation.blockedPlugins).toBe(0);
  });

  it("skips incomplete latest run directories when explaining the last run", () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-cli-explain-incomplete-"));
    writeFileSync(join(root, "package.json"), '{"name":"fixture"}');
    initProject(root);

    const completeRunRoot = join(root, ".agentops", "runs", "2026-03-17-complete");
    mkdirSync(completeRunRoot, { recursive: true });
    writeFileSync(
      join(completeRunRoot, "bundle.json"),
      JSON.stringify(
        {
          runId: "2026-03-17-complete",
          status: "success",
          findings: [],
          blockedPlugins: [],
          lifecycleArtifacts: [],
          entries: []
        },
        null,
        2
      )
    );

    const incompleteRunRoot = join(root, ".agentops", "runs", "2026-03-18-incomplete");
    mkdirSync(incompleteRunRoot, { recursive: true });

    const explanation = explainLastRun(root);
    expect(explanation.runId).toBe("2026-03-17-complete");
    expect(explanation.status).toBe("success");
    expect(explanation.jsonPath).toBe(join(completeRunRoot, "bundle.json"));
  });

  it("prefers the newest completed bundle over lexicographically later manual run directories", () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-cli-explain-order-"));
    writeFileSync(join(root, "package.json"), '{"name":"fixture"}');
    initProject(root);

    const olderManualRunRoot = join(root, ".agentops", "runs", "run-review");
    mkdirSync(olderManualRunRoot, { recursive: true });
    writeFileSync(
      join(olderManualRunRoot, "bundle.json"),
      JSON.stringify(
        {
          runId: "run-review",
          status: "success",
          findings: [],
          blockedPlugins: [],
          lifecycleArtifacts: [],
          entries: []
        },
        null,
        2
      )
    );

    const newerTimestampRunRoot = join(root, ".agentops", "runs", "2026-03-18-000001");
    mkdirSync(newerTimestampRunRoot, { recursive: true });
    writeFileSync(
      join(newerTimestampRunRoot, "bundle.json"),
      JSON.stringify(
        {
          runId: "2026-03-18-000001",
          status: "success",
          findings: [],
          blockedPlugins: [],
          lifecycleArtifacts: [],
          entries: []
        },
        null,
        2
      )
    );

    const explanation = explainLastRun(root);
    expect(explanation.runId).toBe("2026-03-18-000001");
    expect(explanation.jsonPath).toBe(join(newerTimestampRunRoot, "bundle.json"));
  });

  it("selects the newest completed run after back-to-back workflow executions", async () => {
    const root = createGitFixture("agentops-cli-explain-back-to-back-");
    initProject(root);

    const firstRun = await runLocalWorkflow("pr-review", root);
    const secondRun = await runLocalWorkflow("pr-review", root);

    const explanation = explainLastRun(root);
    expect(explanation.runId).toBe(secondRun.runId);
    expect(explanation.runId).not.toBe(firstRun.runId);
    expect(explanation.jsonPath).toBe(secondRun.jsonPath);
  });

  it("prefers bundle completion timestamps over misleading bundle mtimes", () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-cli-explain-finished-at-"));
    writeFileSync(join(root, "package.json"), '{"name":"fixture"}');
    initProject(root);

    const olderRunRoot = join(root, ".agentops", "runs", "1773850000000-old");
    mkdirSync(olderRunRoot, { recursive: true });
    writeFileSync(
      join(olderRunRoot, "bundle.json"),
      JSON.stringify(
        {
          runId: "1773850000000-old",
          startedAt: "2026-03-18T17:00:00.000Z",
          finishedAt: "2026-03-18T17:00:01.000Z",
          status: "success",
          findings: [],
          blockedPlugins: [],
          lifecycleArtifacts: [],
          entries: []
        },
        null,
        2
      )
    );

    const newerRunRoot = join(root, ".agentops", "runs", "1773850001000-new");
    mkdirSync(newerRunRoot, { recursive: true });
    const newerBundlePath = join(newerRunRoot, "bundle.json");
    writeFileSync(
      newerBundlePath,
      JSON.stringify(
        {
          runId: "1773850001000-new",
          startedAt: "2026-03-18T17:00:02.000Z",
          finishedAt: "2026-03-18T17:00:03.000Z",
          status: "success",
          findings: [],
          blockedPlugins: [],
          lifecycleArtifacts: [],
          entries: []
        },
        null,
        2
      )
    );

    const staleTime = new Date("2026-03-18T16:59:00.000Z");
    utimesSync(newerBundlePath, staleTime, staleTime);

    const explanation = explainLastRun(root);
    expect(explanation.runId).toBe("1773850001000-new");
    expect(explanation.jsonPath).toBe(newerBundlePath);
  });

  it("maps bounded local workflow outcomes to GitHub handoff statuses", () => {
    expect(mapWorkflowRunStatusToGitHubStatus("planning-discovery", "success")).toEqual({
      workflow: "planning-discovery",
      localRunStatus: "success",
      githubStatus: "completed",
      reason: "Successful local workflow runs map to completed GitHub handoff status."
    });
    expect(mapWorkflowRunStatusToGitHubStatus("qa-review", "partial").githubStatus).toBe("blocked");
    expect(mapWorkflowRunStatusToGitHubStatus("security-review", "failed").githubStatus).toBe("failed");
  });

  it("prints first-run guidance for the current wedge in plain-text mode", () => {
    const root = createGitFixture("agentops-cli-guidance-");
    ensureBuiltCli();

    const cliEntry = join(process.cwd(), "packages", "cli", "dist", "bin.js");
    const run = spawnSync("node", [cliEntry, "run", "pr-review"], {
      cwd: root,
      encoding: "utf8"
    });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Audit bundle:");
    expect(run.stdout).toContain("Summary:");
    expect(run.stdout).toContain("agentforge explain last-run");
  }, 90_000);

  it("prints a four-step quick path for the planning preset in plain-text mode", () => {
    const root = createGitFixture("agentops-cli-quick-path-");
    ensureBuiltCli();

    const cliEntry = join(process.cwd(), "packages", "cli", "dist", "bin.js");
    const run = spawnSync("node", [cliEntry, "init", "--preset", "planning-discovery"], {
      cwd: root,
      encoding: "utf8"
    });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Created starter request:");
    expect(run.stdout).toContain("inspect or edit");
    expect(run.stdout).toContain("Then run: `agentforge run planning-discovery --json`");
    expect(run.stdout).toContain(".agentops/runs/<run-id>/bundle.json");
    expect(run.stdout).toContain("agentforge explain last-run --json");
  }, 90_000);

  it("fails planning-discovery before reasoning when the request is missing", async () => {
    const root = createGitFixture("agentops-cli-planning-missing-");
    initProject(root);

    await expect(runLocalWorkflow("planning-discovery", root)).rejects.toThrow("Missing planning request");
  });

  it("runs planning-discovery and emits a planning brief artifact", async () => {
    const root = createGitFixture("agentops-cli-planning-");
    initProject(root);
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Plan the first workflow wedge",
        "goals:",
        "  - Produce a planning brief",
        "constraints:",
        "  - Keep the workflow local-first",
        "issueRefs:",
        "  - '#127'",
        "pathHints:",
        "  - packages/cli",
        "  - packages/runtime"
      ].join("\n")
    );

    const run = await runLocalWorkflow("planning-discovery", root);
    expect(run.status).toBe("success");
    expect(run.artifactKinds).toContain("planning-brief");

    const bundle = JSON.parse(readFileSync(run.jsonPath, "utf8")) as {
      workflow: string;
      lifecycleArtifacts: { artifactKind: string }[];
    };
    expect(bundle.workflow).toBe("planning-discovery");
    expect(bundle.lifecycleArtifacts.some((artifact) => artifact.artifactKind === "planning-brief")).toBe(true);

    const explanation = explainLastRun(root);
    expect(explanation.artifactKinds).toContain("planning-brief");
  });

  it("requires a valid planning brief reference for architecture-design-review", async () => {
    const root = createGitFixture("agentops-cli-design-invalid-");
    initProject(root);
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "design.yaml"),
      [
        "planningBriefRef: .agentops/runs/missing/bundle.json",
        "decisionTarget: Choose the first design workflow shape"
      ].join("\n")
    );

    await expect(runLocalWorkflow("architecture-design-review", root)).rejects.toThrow("Referenced planning bundle not found");
  });

  it("runs architecture-design-review and emits a design record artifact", async () => {
    const root = createGitFixture("agentops-cli-design-");
    initProject(root);
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Plan the first workflow wedge",
        "goals:",
        "  - Produce a planning brief",
        "constraints:",
        "  - Keep the workflow local-first",
        "issueRefs:",
        "  - '#127'",
        "pathHints:",
        "  - packages/runtime",
        "  - packages/schemas"
      ].join("\n")
    );
    const planningRun = await runLocalWorkflow("planning-discovery", root);
    writeFileSync(
      join(root, ".agentops", "requests", "design.yaml"),
      [
        `planningBriefRef: .agentops/runs/${planningRun.runId}/bundle.json`,
        "decisionTarget: Choose the first design workflow implementation shape",
        "pathHints:",
        "  - packages/runtime",
        "  - packages/schemas",
        "alternatives:",
        "  - single-workflow-pass"
      ].join("\n")
    );

    const designRun = await runLocalWorkflow("architecture-design-review", root);
    expect(designRun.status).toBe("success");
    expect(designRun.artifactKinds).toContain("design-record");

    const bundle = JSON.parse(readFileSync(designRun.jsonPath, "utf8")) as {
      workflow: string;
      lifecycleArtifacts: { artifactKind: string }[];
    };
    expect(bundle.workflow).toBe("architecture-design-review");
    expect(bundle.lifecycleArtifacts.some((artifact) => artifact.artifactKind === "design-record")).toBe(true);
  });

  it("fails implementation-proposal before reasoning when the request is missing", async () => {
    const root = createGitFixture("agentops-cli-implementation-missing-");
    initProject(root);

    await expect(runLocalWorkflow("implementation-proposal", root)).rejects.toThrow("Missing implementation request");
  });

  it("requires a valid design bundle reference for implementation-proposal", async () => {
    const root = createGitFixture("agentops-cli-implementation-invalid-ref-");
    initProject(root);
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        "designRecordRef: .agentops/runs/missing/bundle.json",
        "implementationGoal: Prepare the next bounded implementation proposal",
        "approvalMode: proposal-only"
      ].join("\n")
    );

    await expect(runLocalWorkflow("implementation-proposal", root)).rejects.toThrow("Referenced design bundle not found");
  });

  it("requires a design-record artifact for implementation-proposal", async () => {
    const root = createGitFixture("agentops-cli-implementation-invalid-artifact-");
    initProject(root);
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Plan the first workflow wedge",
        "goals:",
        "  - Produce a planning brief",
        "constraints:",
        "  - Keep the workflow local-first",
        "issueRefs:",
        "  - '#127'",
        "pathHints:",
        "  - packages/runtime"
      ].join("\n")
    );
    const planningRun = await runLocalWorkflow("planning-discovery", root);
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        `designRecordRef: .agentops/runs/${planningRun.runId}/bundle.json`,
        "implementationGoal: Prepare the next bounded implementation proposal",
        "approvalMode: proposal-only"
      ].join("\n")
    );

    await expect(runLocalWorkflow("implementation-proposal", root)).rejects.toThrow(
      "Referenced bundle does not contain a design-record artifact"
    );
  });

  it("requires approvalMode for implementation-proposal requests", async () => {
    const root = createGitFixture("agentops-cli-implementation-missing-approval-");
    initProject(root);
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        "designRecordRef: .agentops/runs/run-456/bundle.json",
        "implementationGoal: Prepare the next bounded implementation proposal"
      ].join("\n")
    );

    await expect(runLocalWorkflow("implementation-proposal", root)).rejects.toThrow();
  });

  it("rejects non-allowlisted validation commands for implementation-proposal before reasoning", async () => {
    const root = createGitFixture("agentops-cli-implementation-invalid-command-");
    initProject(root);
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Plan the first workflow wedge",
        "goals:",
        "  - Produce a planning brief",
        "constraints:",
        "  - Keep the workflow local-first",
        "issueRefs:",
        "  - '#127'",
        "pathHints:",
        "  - packages/runtime",
        "  - packages/schemas"
      ].join("\n")
    );
    const planningRun = await runLocalWorkflow("planning-discovery", root);
    writeFileSync(
      join(root, ".agentops", "requests", "design.yaml"),
      [
        `planningBriefRef: .agentops/runs/${planningRun.runId}/bundle.json`,
        "decisionTarget: Choose the first design workflow implementation shape",
        "pathHints:",
        "  - packages/runtime",
        "  - packages/schemas",
        "alternatives:",
        "  - single-workflow-pass"
      ].join("\n")
    );
    const designRun = await runLocalWorkflow("architecture-design-review", root);
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        `designRecordRef: .agentops/runs/${designRun.runId}/bundle.json`,
        "implementationGoal: Prepare the next bounded implementation proposal",
        "approvalMode: proposal-only",
        "validationCommands:",
        "  - rm -rf ."
      ].join("\n")
    );

    await expect(runLocalWorkflow("implementation-proposal", root)).rejects.toThrow(
      "Implementation request contains non-allowlisted validation command: rm -rf ."
    );
  });

  it("runs implementation-proposal after a valid design-record handoff", async () => {
    const root = createGitFixture("agentops-cli-implementation-");
    initProject(root);
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Plan the first workflow wedge",
        "goals:",
        "  - Produce a planning brief",
        "constraints:",
        "  - Keep the workflow local-first",
        "issueRefs:",
        "  - '#127'",
        "pathHints:",
        "  - packages/runtime",
        "  - packages/schemas"
      ].join("\n")
    );
    const planningRun = await runLocalWorkflow("planning-discovery", root);
    writeFileSync(
      join(root, ".agentops", "requests", "design.yaml"),
      [
        `planningBriefRef: .agentops/runs/${planningRun.runId}/bundle.json`,
        "decisionTarget: Choose the first design workflow implementation shape",
        "pathHints:",
        "  - packages/runtime",
        "  - packages/schemas",
        "alternatives:",
        "  - single-workflow-pass"
      ].join("\n")
    );
    const designRun = await runLocalWorkflow("architecture-design-review", root);
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        `designRecordRef: .agentops/runs/${designRun.runId}/bundle.json`,
        "implementationGoal: Prepare the next bounded implementation proposal",
        "approvalMode: proposal-only",
        "targetPaths:",
        "  - packages/cli",
        "  - packages/runtime",
        "validationCommands:",
        "  - pnpm test",
        "constraints:",
        "  - Keep the default path read-only"
      ].join("\n")
    );

    const implementationRun = await runLocalWorkflow("implementation-proposal", root);
    expect(implementationRun.status).toBe("success");
    expect(implementationRun.artifactKinds).toContain("implementation-proposal");

    const bundle = JSON.parse(readFileSync(implementationRun.jsonPath, "utf8")) as {
      workflow: string;
      lifecycleArtifacts: {
        artifactKind: string;
        payload: {
          affectedPaths: string[];
          validationPlan: string[];
        };
      }[];
    };
    expect(bundle.workflow).toBe("implementation-proposal");
    expect(bundle.lifecycleArtifacts.some((artifact) => artifact.artifactKind === "implementation-proposal")).toBe(true);
    const implementationArtifact = bundle.lifecycleArtifacts.find((artifact) => artifact.artifactKind === "implementation-proposal");
    expect(implementationArtifact?.payload.affectedPaths).toEqual(
      expect.arrayContaining([".agentops/agentops.yaml", ".agentops/policy.yaml"])
    );
    expect(implementationArtifact?.payload.validationPlan).toEqual(
      expect.arrayContaining(["Command `pnpm test` is available but approval-required before execution."])
    );

    const explanation = explainLastRun(root);
    expect(explanation.artifactKinds).toContain("implementation-proposal");
  });

  it("allows bounded implementation validation commands in a generic repo when the package manager is unknown", async () => {
    const root = createGitFixtureWithoutLockfile("agentops-cli-implementation-generic-");
    initProject(root);
    expect(scanProject(root).packageManager).toBe("unknown");
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Plan the first workflow wedge",
        "goals:",
        "  - Produce a planning brief",
        "constraints:",
        "  - Keep the workflow local-first"
      ].join("\n")
    );
    const planningRun = await runLocalWorkflow("planning-discovery", root);
    writeFileSync(
      join(root, ".agentops", "requests", "design.yaml"),
      [
        `planningBriefRef: .agentops/runs/${planningRun.runId}/bundle.json`,
        "decisionTarget: Choose the first design workflow implementation shape",
        "pathHints:",
        "  - package.json",
        "  - .agentops/policy.yaml",
        "alternatives:",
        "  - single-workflow-pass"
      ].join("\n")
    );
    const designRun = await runLocalWorkflow("architecture-design-review", root);
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        `designRecordRef: .agentops/runs/${designRun.runId}/bundle.json`,
        "implementationGoal: Prepare the next bounded implementation proposal",
        "approvalMode: proposal-only",
        "validationCommands:",
        "  - pnpm test"
      ].join("\n")
    );

    const implementationRun = await runLocalWorkflow("implementation-proposal", root);
    expect(implementationRun.status).toBe("success");
    expect(implementationRun.artifactKinds).toContain("implementation-proposal");
  });

  it("runs qa-review after a valid implementation-proposal handoff", async () => {
    const root = createGitFixture("agentops-qa-");

    initProject(root);

    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Plan a bounded QA workflow handoff",
        "goals:",
        "  - Produce a planning brief for the QA workflow",
        "constraints:",
        "  - Keep the workflow local-first",
        "  - Keep the workflow read-only by default"
      ].join("\n")
    );
    const planningRun = await runLocalWorkflow("planning-discovery", root);
    writeFileSync(
      join(root, ".agentops", "requests", "design.yaml"),
      [
        `planningBriefRef: .agentops/runs/${planningRun.runId}/bundle.json`,
        "decisionTarget: Choose the first QA workflow implementation shape",
        "pathHints:",
        "  - .agentops/agentops.yaml",
        "  - .agentops/policy.yaml",
        "alternatives:",
        "  - single-pass-qa"
      ].join("\n")
    );
    const designRun = await runLocalWorkflow("architecture-design-review", root);
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        `designRecordRef: .agentops/runs/${designRun.runId}/bundle.json`,
        "implementationGoal: Prepare the next bounded implementation proposal",
        "approvalMode: proposal-only",
        "targetPaths:",
        "  - .agentops/agentops.yaml",
        "  - .agentops/policy.yaml",
        "validationCommands:",
        "  - pnpm test",
        "constraints:",
        "  - Keep the default path read-only"
      ].join("\n")
    );
    const implementationRun = await runLocalWorkflow("implementation-proposal", root);

    writeFileSync(
      join(root, ".agentops", "requests", "qa.yaml"),
      [
        `targetRef: .agentops/runs/${implementationRun.runId}/bundle.json`,
        "evidenceSources:",
        "  - .agentops/runs/" + implementationRun.runId + "/summary.md",
        "executedChecks:",
        "  - pnpm test",
        "focusAreas:",
        "  - coverage",
        "constraints:",
        "  - Keep QA evidence collection read-only",
        "releaseContext: candidate"
      ].join("\n")
    );

    const qaRun = await runLocalWorkflow("qa-review", root);
    expect(qaRun.status).toBe("success");

    const bundle = JSON.parse(readFileSync(qaRun.jsonPath, "utf8")) as {
      workflow: string;
      lifecycleArtifacts: Array<{ artifactKind: string; payload?: Record<string, unknown> }>;
    };
    expect(bundle.workflow).toBe("qa-review");
    expect(bundle.lifecycleArtifacts).toHaveLength(1);
    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("qa-report");
    expect(bundle.lifecycleArtifacts[0]?.payload?.targetRef).toBe(`.agentops/runs/${implementationRun.runId}/bundle.json`);

    const explanation = explainLastRun(root);
    expect(explanation.artifactKinds).toContain("qa-report");
  });

  it("ingests local GitHub Actions evidence exports during qa-review", async () => {
    const root = createGitFixture("agentops-qa-actions-");

    initProject(root);

    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Validate QA linkage to exported GitHub Actions evidence",
        "goals:",
        "  - Produce one planning brief for the QA workflow",
        "constraints:",
        "  - Keep the workflow local-first",
        "  - Keep the workflow read-only by default"
      ].join("\n")
    );
    const planningRun = await runLocalWorkflow("planning-discovery", root);
    writeFileSync(
      join(root, ".agentops", "requests", "design.yaml"),
      [
        `planningBriefRef: .agentops/runs/${planningRun.runId}/bundle.json`,
        "decisionTarget: Add bounded GitHub Actions evidence linkage",
        "pathHints:",
        "  - packages/cli",
        "  - packages/schemas"
      ].join("\n")
    );
    const designRun = await runLocalWorkflow("architecture-design-review", root);
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        `designRecordRef: .agentops/runs/${designRun.runId}/bundle.json`,
        "implementationGoal: Prepare deterministic GitHub Actions evidence ingestion",
        "approvalMode: proposal-only",
        "targetPaths:",
        "  - packages/cli",
        "validationCommands:",
        "  - pnpm test",
        "constraints:",
        "  - Keep the default path read-only"
      ].join("\n")
    );
    const implementationRun = await runLocalWorkflow("implementation-proposal", root);
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "evidence", "github-actions-ci.json"),
      JSON.stringify(
        {
          repository: "H9-Foundry/fixture",
          workflowName: "CI",
          workflowRunId: 12345,
          runAttempt: 1,
          event: "pull_request",
          headBranch: "main",
          headSha: "abc123",
          status: "completed",
          conclusion: "failure",
          htmlUrl: "https://github.com/H9-Foundry/fixture/actions/runs/12345",
          jobs: [
            {
              name: "test",
              status: "completed",
              conclusion: "success",
              htmlUrl: "https://github.com/H9-Foundry/fixture/actions/runs/12345/job/1"
            },
            {
              name: "lint",
              status: "completed",
              conclusion: "failure",
              htmlUrl: "https://github.com/H9-Foundry/fixture/actions/runs/12345/job/2"
            }
          ],
          checkRuns: []
        },
        null,
        2
      )
    );

    writeFileSync(
      join(root, ".agentops", "requests", "qa.yaml"),
      [
        `targetRef: .agentops/runs/${implementationRun.runId}/bundle.json`,
        "evidenceSources:",
        "  - .agentops/runs/" + implementationRun.runId + "/summary.md",
        "  - .agentops/evidence/github-actions-ci.json",
        "executedChecks:",
        "  - pnpm test",
        "focusAreas:",
        "  - release-readiness",
        "releaseContext: candidate"
      ].join("\n")
    );

    const qaRun = await runLocalWorkflow("qa-review", root);
    const bundle = readJson<{
      lifecycleArtifacts: Array<{
        artifactKind: string;
        payload?: { coverageGaps?: string[]; releaseImpact?: string };
      }>;
    }>(qaRun.jsonPath);

    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("qa-report");
    expect(bundle.lifecycleArtifacts[0]?.payload?.coverageGaps).toContain(
      "GitHub Actions evidence still reports a failing check that needs manual review: CI / lint"
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.releaseImpact).toContain(
      "GitHub Actions evidence still shows failing checks: CI / lint."
    );
  });

  it("ingests bounded local GitLab CI evidence exports during qa-review", async () => {
    const root = createGitLabFixture("agentops-qa-gitlab-ci-");

    initProject(root);
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "evidence", "gitlab-ci.json"),
      JSON.stringify(
        {
          host: "gitlab.com",
          projectPath: "h9-foundry/platform/fixture",
          pipelineId: 98765,
          pipelineName: "GitLab CI",
          runAttempt: 1,
          event: "merge_request_event",
          branch: "main",
          commitSha: "abc123",
          status: "failed",
          webUrl: "https://gitlab.com/h9-foundry/platform/fixture/-/pipelines/98765",
          jobs: [
            {
              name: "test",
              status: "success",
              webUrl: "https://gitlab.com/h9-foundry/platform/fixture/-/jobs/1"
            },
            {
              name: "lint",
              status: "failed",
              webUrl: "https://gitlab.com/h9-foundry/platform/fixture/-/jobs/2"
            }
          ]
        },
        null,
        2
      )
    );

    writeFileSync(
      join(root, ".agentops", "requests", "qa.yaml"),
      [
        "targetRef: package.json",
        "evidenceSources:",
        "  - .agentops/evidence/gitlab-ci.json",
        "executedChecks:",
        "  - pnpm test",
        "focusAreas:",
        "  - release-readiness",
        "releaseContext: candidate"
      ].join("\n")
    );

    const qaRun = await runLocalWorkflow("qa-review", root);
    const bundle = readJson<{
      lifecycleArtifacts: Array<{
        artifactKind: string;
        payload?: { coverageGaps?: string[]; recommendedNextChecks?: string[]; releaseImpact?: string };
      }>;
    }>(qaRun.jsonPath);

    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("qa-report");
    expect(bundle.lifecycleArtifacts[0]?.payload?.coverageGaps).toContain(
      "Imported CI evidence still reports a failing check that needs manual review: GitLab CI / lint"
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.recommendedNextChecks).toContain(
      "Review the imported CI evidence for pipeline `GitLab CI` before promotion."
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.releaseImpact).toContain(
      "Imported CI evidence still shows failing checks: GitLab CI / lint."
    );
  });

  it("ingests bounded Buildkite CI evidence exports during qa-review", async () => {
    const root = createFixtureRepo();

    initProject(root);
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "evidence", "buildkite-ci.json"),
      JSON.stringify(
        {
          providerName: "Buildkite",
          host: "buildkite.local",
          repository: "H9-Foundry/fixture",
          pipelineName: "Buildkite CI",
          pipelineRunId: "bk-123",
          runAttempt: 1,
          event: "pull_request",
          branch: "main",
          commitSha: "abc123",
          status: "completed",
          conclusion: "failure",
          htmlUrl: "https://buildkite.example.com/builds/123",
          jobs: [
            {
              name: "test",
              status: "completed",
              conclusion: "success",
              htmlUrl: "https://buildkite.example.com/builds/123/jobs/1"
            },
            {
              name: "lint",
              status: "completed",
              conclusion: "failure",
              htmlUrl: "https://buildkite.example.com/builds/123/jobs/2"
            }
          ],
          artifacts: [
            {
              name: "junit-report",
              type: "junit-xml",
              path: "artifacts/junit.xml"
            }
          ]
        },
        null,
        2
      )
    );

    writeFileSync(
      join(root, ".agentops", "requests", "qa.yaml"),
      [
        "targetRef: package.json",
        "evidenceSources:",
        "  - .agentops/evidence/buildkite-ci.json",
        "executedChecks:",
        "  - pnpm test",
        "focusAreas:",
        "  - release-readiness",
        "releaseContext: candidate"
      ].join("\n")
    );

    const qaRun = await runLocalWorkflow("qa-review", root);
    const bundle = readJson<{
      lifecycleArtifacts: Array<{
        artifactKind: string;
        payload?: { coverageGaps?: string[]; recommendedNextChecks?: string[]; releaseImpact?: string };
      }>;
    }>(qaRun.jsonPath);

    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("qa-report");
    expect(bundle.lifecycleArtifacts[0]?.payload?.coverageGaps).toContain(
      "Imported CI evidence still reports a failing check that needs manual review: Buildkite CI / lint"
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.recommendedNextChecks).toContain(
      "Review the imported CI evidence for pipeline `Buildkite CI` before promotion."
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.releaseImpact).toContain(
      "Imported CI evidence still shows failing checks: Buildkite CI / lint."
    );
  });

  it("ingests bounded Jenkins CI evidence exports during qa-review", async () => {
    const root = createFixtureRepo();

    initProject(root);
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "evidence", "jenkins-ci.json"),
      JSON.stringify(
        {
          providerName: "Jenkins",
          host: "jenkins.local",
          repository: "H9-Foundry/fixture",
          pipelineName: "Jenkins CI",
          pipelineRunId: "jenkins-42",
          runAttempt: 1,
          event: "push",
          branch: "main",
          commitSha: "abc123",
          status: "completed",
          conclusion: "failure",
          htmlUrl: "https://jenkins.example.com/job/agentforge/42",
          jobs: [
            {
              name: "test",
              status: "completed",
              conclusion: "success",
              htmlUrl: "https://jenkins.example.com/job/agentforge/42/test"
            },
            {
              name: "lint",
              status: "completed",
              conclusion: "failure",
              htmlUrl: "https://jenkins.example.com/job/agentforge/42/lint"
            }
          ],
          artifacts: [
            {
              name: "coverage-report",
              type: "html-report",
              path: "artifacts/coverage/index.html"
            }
          ]
        },
        null,
        2
      )
    );

    writeFileSync(
      join(root, ".agentops", "requests", "qa.yaml"),
      [
        "targetRef: package.json",
        "evidenceSources:",
        "  - .agentops/evidence/jenkins-ci.json",
        "executedChecks:",
        "  - pnpm test",
        "focusAreas:",
        "  - release-readiness",
        "releaseContext: candidate"
      ].join("\n")
    );

    const qaRun = await runLocalWorkflow("qa-review", root);
    const bundle = readJson<{
      lifecycleArtifacts: Array<{
        artifactKind: string;
        payload?: {
          coverageGaps?: string[];
          recommendedNextChecks?: string[];
          releaseImpact?: string;
          ciEvidenceSummary?: Array<{ provider: string; platform: string }>;
        };
      }>;
    }>(qaRun.jsonPath);

    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("qa-report");
    expect(bundle.lifecycleArtifacts[0]?.payload?.coverageGaps).toContain(
      "Imported CI evidence still reports a failing check that needs manual review: Jenkins CI / lint"
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.recommendedNextChecks).toContain(
      "Review the imported CI evidence for pipeline `Jenkins CI` before promotion."
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.releaseImpact).toContain(
      "Imported CI evidence still shows failing checks: Jenkins CI / lint."
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.ciEvidenceSummary).toEqual(
      expect.arrayContaining([expect.objectContaining({ provider: "Jenkins", platform: "jenkins-ci" })])
    );
  });

  it("allows bounded QA executed checks in a generic repo when the package manager is unknown", async () => {
    const root = createGitFixtureWithoutLockfile("agentops-qa-generic-");
    initProject(root);
    expect(scanProject(root).packageManager).toBe("unknown");

    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Plan a bounded QA workflow handoff",
        "goals:",
        "  - Produce a planning brief for the QA workflow",
        "constraints:",
        "  - Keep the workflow local-first",
        "  - Keep the workflow read-only by default"
      ].join("\n")
    );
    const planningRun = await runLocalWorkflow("planning-discovery", root);
    writeFileSync(
      join(root, ".agentops", "requests", "design.yaml"),
      [
        `planningBriefRef: .agentops/runs/${planningRun.runId}/bundle.json`,
        "decisionTarget: Choose the first QA workflow implementation shape",
        "pathHints:",
        "  - package.json",
        "  - .agentops/policy.yaml",
        "alternatives:",
        "  - single-pass-qa"
      ].join("\n")
    );
    const designRun = await runLocalWorkflow("architecture-design-review", root);
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        `designRecordRef: .agentops/runs/${designRun.runId}/bundle.json`,
        "implementationGoal: Prepare the next bounded implementation proposal",
        "approvalMode: proposal-only",
        "validationCommands:",
        "  - pnpm test"
      ].join("\n")
    );
    const implementationRun = await runLocalWorkflow("implementation-proposal", root);

    writeFileSync(
      join(root, ".agentops", "requests", "qa.yaml"),
      [
        `targetRef: .agentops/runs/${implementationRun.runId}/bundle.json`,
        "evidenceSources:",
        `  - .agentops/runs/${implementationRun.runId}/summary.md`,
        "executedChecks:",
        "  - pnpm test",
        "focusAreas:",
        "  - coverage",
        "releaseContext: candidate"
      ].join("\n")
    );

    const qaRun = await runLocalWorkflow("qa-review", root);
    expect(qaRun.status).toBe("success");
    expect(qaRun.artifactKinds).toContain("qa-report");
  });

  it("rejects underspecified qa-review requests before reasoning", async () => {
    const root = createGitFixture("agentops-qa-invalid-");

    initProject(root);
    writeFileSync(
      join(root, ".agentops", "requests", "qa.yaml"),
      [
        "evidenceSources:",
        "  - .agentops/policy.yaml",
        "executedChecks:",
        "  - pnpm test"
      ].join("\n")
    );

    await expect(runLocalWorkflow("qa-review", root)).rejects.toThrow(/targetRef/i);
  });

  it("rejects qa-review when the referenced QA target does not exist", async () => {
    const root = createGitFixture("agentops-qa-missing-target-");

    initProject(root);
    writeFileSync(
      join(root, ".agentops", "requests", "qa.yaml"),
      [
        "targetRef: .agentops/runs/missing/bundle.json",
        "evidenceSources:",
        "  - .agentops/runs/missing/summary.md",
        "executedChecks:",
        "  - pnpm test",
        "focusAreas:",
        "  - coverage"
      ].join("\n")
    );

    await expect(runLocalWorkflow("qa-review", root)).rejects.toThrow(/QA target reference not found/i);
  });

  it("fails security-review before reasoning when the request is missing", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root, { trackerIssue: 141 });

    await expect(runLocalWorkflow("security-review", root)).rejects.toThrow("Missing security request");
  });

  it("rejects security-review when the referenced security target does not exist", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root, { trackerIssue: 141 });
    ensureRequestsDir(root);
    writeYamlFile(join(root, ".agentops", "requests", "security.yaml"), {
      targetRef: ".agentops/runs/does-not-exist/bundle.json",
      evidenceSources: [],
      focusAreas: ["dependency-risk"],
      constraints: ["Keep the workflow read-only"],
      releaseContext: "candidate"
    });

    await expect(runLocalWorkflow("security-review", root)).rejects.toThrow(/security target reference not found/i);
  });

  it("rejects security-review when the referenced bundle lacks a supported lifecycle artifact", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root, { trackerIssue: 141 });
    ensureRequestsDir(root);
    const bundleDir = join(root, ".agentops", "runs", "run-review");
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(
      join(bundleDir, "bundle.json"),
      JSON.stringify(
        {
          version: "1.0.0",
          runId: "run-review",
          workflow: "pr-review",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "success",
          policy: {
            version: 1,
            environment: "local",
            resolvedAt: new Date().toISOString(),
            defaults: schemaFixtures.policyDocument.defaults,
            paths: schemaFixtures.policyDocument.paths,
            plugins: schemaFixtures.policyDocument.plugins,
            tools: schemaFixtures.policyDocument.tools
          },
          entries: [],
          findings: [],
          proposedActions: [],
          blockedPlugins: [],
          lifecycleArtifacts: [schemaFixtures.reviewArtifact],
          artifactPaths: {
            json: ".agentops/runs/run-review/bundle.json",
            markdown: ".agentops/runs/run-review/summary.md"
          },
          provenance: {
            generatedBy: "agentforge-runtime",
            schemaVersion: "1.0.0",
            executionEnvironment: "local",
            repoRoot: root
          },
          redaction: {
            applied: true,
            strategyVersion: "1.0.0",
            categories: ["github-token"]
          },
          components: []
        },
        null,
        2
      )
    );
    writeFileSync(join(bundleDir, "summary.md"), "# summary\n");
    writeYamlFile(join(root, ".agentops", "requests", "security.yaml"), {
      targetRef: ".agentops/runs/run-review/bundle.json",
      evidenceSources: [],
      focusAreas: ["dependency-risk"],
      constraints: ["Keep the workflow read-only"],
      releaseContext: "candidate"
    });

    await expect(runLocalWorkflow("security-review", root)).rejects.toThrow(/does not contain a supported lifecycle artifact/i);
  });

  it("runs security-review after a valid implementation-proposal handoff", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root, { trackerIssue: 141 });
    ensureRequestsDir(root);
    const implementationBundleDir = join(root, ".agentops", "runs", "run-impl");
    mkdirSync(implementationBundleDir, { recursive: true });
    writeFileSync(
      join(implementationBundleDir, "bundle.json"),
      JSON.stringify(
        {
          version: "1.0.0",
          runId: "run-impl",
          workflow: "implementation-proposal",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "success",
          policy: {
            version: 1,
            environment: "local",
            resolvedAt: new Date().toISOString(),
            defaults: schemaFixtures.policyDocument.defaults,
            paths: schemaFixtures.policyDocument.paths,
            plugins: schemaFixtures.policyDocument.plugins,
            tools: schemaFixtures.policyDocument.tools
          },
          entries: [],
          findings: [],
          proposedActions: [],
          blockedPlugins: [],
          lifecycleArtifacts: [schemaFixtures.implementationArtifact],
          artifactPaths: {
            json: ".agentops/runs/run-impl/bundle.json",
            markdown: ".agentops/runs/run-impl/summary.md"
          },
          provenance: {
            generatedBy: "agentforge-runtime",
            schemaVersion: "1.0.0",
            executionEnvironment: "local",
            repoRoot: root
          },
          redaction: {
            applied: true,
            strategyVersion: "1.0.0",
            categories: ["github-token"]
          },
          components: []
        },
        null,
        2
      )
    );
    writeFileSync(join(implementationBundleDir, "summary.md"), "# implementation summary\n");
    writeYamlFile(join(root, ".agentops", "requests", "security.yaml"), {
      targetRef: ".agentops/runs/run-impl/bundle.json",
      evidenceSources: [".agentops/runs/run-impl/summary.md"],
      focusAreas: ["dependency-risk"],
      constraints: ["Keep the workflow read-only"],
      releaseContext: "candidate"
    });

    const securityRun = await runLocalWorkflow("security-review", root);

    expect(securityRun.status).toBe("success");
    expect(securityRun.findings).toBe(0);
    expect(securityRun.artifactKinds).toContain("security-report");

    const bundle = readJson<{
      workflow: string;
      lifecycleArtifacts: Array<{
        artifactKind: string;
        payload?: {
          dependencyIntegritySignals?: string[];
          followUpWork?: string[];
        };
      }>;
    }>(securityRun.jsonPath);
    expect(bundle.workflow).toBe("security-review");
    expect(bundle.lifecycleArtifacts.some((artifact) => artifact.artifactKind === "security-report")).toBe(true);
    expect(bundle.lifecycleArtifacts[0]?.payload?.dependencyIntegritySignals).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Dependency inventory covers"),
        expect.stringContaining("pnpm-lock.yaml")
      ])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.followUpWork).toEqual(
      expect.arrayContaining([expect.stringContaining("Dependency inventory covers")])
    );
  });

  it("fails release-readiness before reasoning when the request is missing", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);

    await expect(runLocalWorkflow("release-readiness", root)).rejects.toThrow("Missing release request");
  });

  it("rejects underspecified release-readiness requests before reasoning", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    writeYamlFile(join(root, ".agentops", "requests", "release.yaml"), {
      releaseScope: "Prepare the next release candidate",
      versionTargets: [{ name: "@h9-foundry/agentforge-cli", version: "0.7.0" }]
    });

    await expect(runLocalWorkflow("release-readiness", root)).rejects.toThrow(
      /Release request is underspecified/i
    );
  });

  it("rejects release-readiness when the referenced QA bundle lacks a qa-report artifact", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    const bundleDir = join(root, ".agentops", "runs", "run-review");
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(
      join(bundleDir, "bundle.json"),
      JSON.stringify(
        {
          version: "1.0.0",
          runId: "run-review",
          workflow: "pr-review",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "success",
          policy: {
            version: 1,
            environment: "local",
            resolvedAt: new Date().toISOString(),
            defaults: schemaFixtures.policyDocument.defaults,
            paths: schemaFixtures.policyDocument.paths,
            plugins: schemaFixtures.policyDocument.plugins,
            tools: schemaFixtures.policyDocument.tools
          },
          entries: [],
          findings: [],
          proposedActions: [],
          blockedPlugins: [],
          lifecycleArtifacts: [schemaFixtures.reviewArtifact],
          artifactPaths: {
            json: ".agentops/runs/run-review/bundle.json",
            markdown: ".agentops/runs/run-review/summary.md"
          },
          provenance: {
            generatedBy: "agentforge-runtime",
            schemaVersion: "1.0.0",
            executionEnvironment: "local",
            repoRoot: root
          },
          redaction: {
            applied: true,
            strategyVersion: "1.0.0",
            categories: ["github-token"]
          },
          components: []
        },
        null,
        2
      )
    );
    writeFileSync(join(bundleDir, "summary.md"), "# review summary\n");
    writeYamlFile(join(root, ".agentops", "requests", "release.yaml"), {
      releaseScope: "Prepare the next release candidate",
      versionTargets: [{ name: "@h9-foundry/agentforge-cli", version: "0.7.0" }],
      qaReportRefs: [".agentops/runs/run-review/bundle.json"]
    });

    await expect(runLocalWorkflow("release-readiness", root)).rejects.toThrow(
      /does not contain a qa-report artifact/i
    );
  });

  it("runs release-readiness after valid qa-report and security-report handoff bundles", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    mkdirSync(join(root, "packages", "cli"), { recursive: true });
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    writeFileSync(
      join(root, "packages", "cli", "package.json"),
      JSON.stringify(
        {
          name: "@h9-foundry/agentforge-cli",
          version: "0.6.0",
          type: "module"
        },
        null,
        2
      )
    );

    const qaBundleDir = join(root, ".agentops", "runs", "run-qa");
    mkdirSync(qaBundleDir, { recursive: true });
    writeFileSync(
      join(qaBundleDir, "bundle.json"),
      JSON.stringify(
        {
          version: "1.0.0",
          runId: "run-qa",
          workflow: "qa-review",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "success",
          policy: {
            version: 1,
            environment: "local",
            resolvedAt: new Date().toISOString(),
            defaults: schemaFixtures.policyDocument.defaults,
            paths: schemaFixtures.policyDocument.paths,
            plugins: schemaFixtures.policyDocument.plugins,
            tools: schemaFixtures.policyDocument.tools
          },
          entries: [],
          findings: [],
          proposedActions: [],
          blockedPlugins: [],
          lifecycleArtifacts: [schemaFixtures.qaArtifact],
          artifactPaths: {
            json: ".agentops/runs/run-qa/bundle.json",
            markdown: ".agentops/runs/run-qa/summary.md"
          },
          provenance: {
            generatedBy: "agentforge-runtime",
            schemaVersion: "1.0.0",
            executionEnvironment: "local",
            repoRoot: root
          },
          redaction: {
            applied: true,
            strategyVersion: "1.0.0",
            categories: ["github-token"]
          },
          components: []
        },
        null,
        2
      )
    );
    writeFileSync(join(qaBundleDir, "summary.md"), "# qa summary\n");

    const securityBundleDir = join(root, ".agentops", "runs", "run-security");
    mkdirSync(securityBundleDir, { recursive: true });
    writeFileSync(
      join(securityBundleDir, "bundle.json"),
      JSON.stringify(
        {
          version: "1.0.0",
          runId: "run-security",
          workflow: "security-review",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "success",
          policy: {
            version: 1,
            environment: "local",
            resolvedAt: new Date().toISOString(),
            defaults: schemaFixtures.policyDocument.defaults,
            paths: schemaFixtures.policyDocument.paths,
            plugins: schemaFixtures.policyDocument.plugins,
            tools: schemaFixtures.policyDocument.tools
          },
          entries: [],
          findings: [],
          proposedActions: [],
          blockedPlugins: [],
          lifecycleArtifacts: [schemaFixtures.securityArtifact],
          artifactPaths: {
            json: ".agentops/runs/run-security/bundle.json",
            markdown: ".agentops/runs/run-security/summary.md"
          },
          provenance: {
            generatedBy: "agentforge-runtime",
            schemaVersion: "1.0.0",
            executionEnvironment: "local",
            repoRoot: root
          },
          redaction: {
            applied: true,
            strategyVersion: "1.0.0",
            categories: ["github-token"]
          },
          components: []
        },
        null,
        2
      )
    );
    writeFileSync(join(securityBundleDir, "summary.md"), "# security summary\n");
    writeFileSync(
      join(root, ".agentops", "evidence", "attestation-verification.json"),
      JSON.stringify(
        {
          verifier: "github-artifact-attestation",
          subject: "@h9-foundry/agentforge-cli@0.7.0",
          issuer: "https://token.actions.githubusercontent.com",
          status: "verified",
          detail: "Verified GitHub artifact attestation for the release package artifact.",
          predicateType: "https://slsa.dev/provenance/v1",
          verifiedAt: "2026-03-19T12:45:00.000Z",
          provenanceRefs: [
            ".agentops/evidence/attestation-verification.json",
            "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789"
          ]
        },
        null,
        2
      )
    );

    writeYamlFile(join(root, ".agentops", "requests", "release.yaml"), {
      releaseScope: "Prepare the 0.7.0 candidate for maintainer review",
      versionTargets: [{ name: "@h9-foundry/agentforge-cli", version: "0.7.0" }],
      qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
      securityReportRefs: [".agentops/runs/run-security/bundle.json"],
      evidenceSources: [
        ".agentops/runs/run-security/summary.md",
        ".agentops/evidence/attestation-verification.json"
      ],
      constraints: ["Keep release readiness read-only by default"]
    });

    const releaseRun = await runLocalWorkflow("release-readiness", root);

    expect(releaseRun.status).toBe("success");
    expect(releaseRun.artifactKinds).toContain("release-report");

    const bundle = readJson<{
      workflow: string;
      lifecycleArtifacts: Array<{
        artifactKind: string;
        payload?: {
          releaseScope?: string;
          readinessStatus?: string;
          versionResolutions?: Array<{ name: string; status: string }>;
          approvalRecommendations?: Array<{ action: string; classification: string }>;
          verificationChecks?: Array<{ name: string; status: string }>;
          dependencyIntegritySignals?: string[];
          trustSummary?: string[];
          trustStatus?: string;
        };
      }>;
    }>(releaseRun.jsonPath);
    expect(bundle.workflow).toBe("release-readiness");
    expect(bundle.lifecycleArtifacts).toHaveLength(1);
    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("release-report");
    expect(bundle.lifecycleArtifacts[0]?.payload?.releaseScope).toBe("Prepare the 0.7.0 candidate for maintainer review");
    expect(bundle.lifecycleArtifacts[0]?.payload?.readinessStatus).toBe("ready");
    expect(bundle.lifecycleArtifacts[0]?.payload?.versionResolutions).toEqual([
      expect.objectContaining({ name: "@h9-foundry/agentforge-cli", status: "pending-version-bump" })
    ]);
    expect(bundle.lifecycleArtifacts[0]?.payload?.approvalRecommendations).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: "publish-packages", classification: "approval_required" })])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.verificationChecks?.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "qa-report-refs",
        "security-report-refs",
        "local-release-evidence",
        "dependency-integrity",
        "workspace-version-targets"
      ])
    );
    expect(
      bundle.lifecycleArtifacts[0]?.payload?.verificationChecks?.find((check) => check.name === "dependency-integrity")
    ).toEqual(expect.objectContaining({ status: "passed" }));
    expect(bundle.lifecycleArtifacts[0]?.payload?.dependencyIntegritySignals).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Dependency inventory covers"),
        expect.stringContaining("pnpm-lock.yaml")
      ])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.trustSummary).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Verified 1 attestation or provenance evidence export."),
        expect.stringContaining("Trusted publishing remains reviewed separately")
      ])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.trustStatus).toBe(
      "attestation-verified-trusted-publishing-reviewed-separately"
    );
  });

  it("consumes host-agnostic imported CI evidence during release-readiness", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    mkdirSync(join(root, "packages", "cli"), { recursive: true });
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    writeFileSync(
      join(root, "packages", "cli", "package.json"),
      JSON.stringify(
        {
          name: "@h9-foundry/agentforge-cli",
          version: "0.6.0",
          type: "module"
        },
        null,
        2
      )
    );
    writeFileSync(
      join(root, ".agentops", "evidence", "buildkite-ci.json"),
      JSON.stringify(
        {
          providerName: "Buildkite",
          host: "buildkite.com",
          repository: "H9-Foundry/fixture",
          pipelineName: "release",
          pipelineRunId: "bk-42",
          runAttempt: 1,
          event: "push",
          branch: "main",
          commitSha: "abc123",
          status: "completed",
          conclusion: "success",
          htmlUrl: "https://buildkite.example.com/organizations/h9-foundry/pipelines/release/builds/42",
          jobs: [
            {
              name: "publish-check",
              status: "completed",
              conclusion: "success",
              htmlUrl: "https://buildkite.example.com/organizations/h9-foundry/pipelines/release/builds/42#job-publish-check"
            }
          ],
          artifacts: [
            {
              name: "build-log",
              type: "text-log",
              path: "artifacts/build.log"
            }
          ]
        },
        null,
        2
      )
    );
    writeFileSync(
      join(root, ".agentops", "evidence", "jenkins-ci.json"),
      JSON.stringify(
        {
          providerName: "Jenkins",
          host: "jenkins.local",
          repository: "H9-Foundry/fixture",
          pipelineName: "Jenkins CI",
          pipelineRunId: "jenkins-42",
          runAttempt: 1,
          event: "push",
          branch: "main",
          commitSha: "abc123",
          status: "completed",
          conclusion: "success",
          htmlUrl: "https://jenkins.example.com/job/agentforge/42",
          jobs: [
            {
              name: "test",
              status: "completed",
              conclusion: "success",
              htmlUrl: "https://jenkins.example.com/job/agentforge/42/test"
            }
          ],
          artifacts: [
            {
              name: "coverage-report",
              type: "html-report",
              path: "artifacts/coverage/index.html"
            }
          ]
        },
        null,
        2
      )
    );
    writeFileSync(
      join(root, ".agentops", "evidence", "generic-ci.json"),
      JSON.stringify(
        {
          providerName: "CircleCI",
          host: "circleci.local",
          repository: "H9-Foundry/fixture",
          pipelineName: "CircleCI",
          pipelineRunId: "circleci-42",
          runAttempt: 1,
          event: "push",
          branch: "main",
          commitSha: "abc123",
          status: "completed",
          conclusion: "success",
          htmlUrl: "https://circleci.example.com/pipelines/github/H9-Foundry/fixture/42",
          jobs: [
            {
              name: "test",
              status: "completed",
              conclusion: "success",
              htmlUrl: "https://circleci.example.com/pipelines/github/H9-Foundry/fixture/42/workflows/test"
            }
          ],
          artifacts: [
            {
              name: "coverage-report",
              type: "html-report",
              path: "artifacts/coverage/index.html"
            }
          ]
        },
        null,
        2
      )
    );

    const qaBundleDir = join(root, ".agentops", "runs", "run-qa");
    mkdirSync(qaBundleDir, { recursive: true });
    writeFileSync(join(qaBundleDir, "bundle.json"), JSON.stringify({
      version: "1.0.0",
      runId: "run-qa",
      workflow: "qa-review",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: "success",
      policy: {
        version: 1,
        environment: "local",
        resolvedAt: new Date().toISOString(),
        defaults: schemaFixtures.policyDocument.defaults,
        paths: schemaFixtures.policyDocument.paths,
        plugins: schemaFixtures.policyDocument.plugins,
        tools: schemaFixtures.policyDocument.tools
      },
      entries: [],
      findings: [],
      proposedActions: [],
      blockedPlugins: [],
      lifecycleArtifacts: [schemaFixtures.qaArtifact],
      artifactPaths: { json: ".agentops/runs/run-qa/bundle.json", markdown: ".agentops/runs/run-qa/summary.md" },
      provenance: { generatedBy: "agentforge-runtime", schemaVersion: "1.0.0", executionEnvironment: "local", repoRoot: root },
      redaction: { applied: true, strategyVersion: "1.0.0", categories: ["github-token"] },
      components: []
    }, null, 2));
    writeFileSync(join(qaBundleDir, "summary.md"), "# qa summary\n");

    const securityBundleDir = join(root, ".agentops", "runs", "run-security");
    mkdirSync(securityBundleDir, { recursive: true });
    writeFileSync(join(securityBundleDir, "bundle.json"), JSON.stringify({
      version: "1.0.0",
      runId: "run-security",
      workflow: "security-review",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: "success",
      policy: {
        version: 1,
        environment: "local",
        resolvedAt: new Date().toISOString(),
        defaults: schemaFixtures.policyDocument.defaults,
        paths: schemaFixtures.policyDocument.paths,
        plugins: schemaFixtures.policyDocument.plugins,
        tools: schemaFixtures.policyDocument.tools
      },
      entries: [],
      findings: [],
      proposedActions: [],
      blockedPlugins: [],
      lifecycleArtifacts: [schemaFixtures.securityArtifact],
      artifactPaths: { json: ".agentops/runs/run-security/bundle.json", markdown: ".agentops/runs/run-security/summary.md" },
      provenance: { generatedBy: "agentforge-runtime", schemaVersion: "1.0.0", executionEnvironment: "local", repoRoot: root },
      redaction: { applied: true, strategyVersion: "1.0.0", categories: ["github-token"] },
      components: []
    }, null, 2));
    writeFileSync(join(securityBundleDir, "summary.md"), "# security summary\n");

    writeYamlFile(join(root, ".agentops", "requests", "release.yaml"), {
      releaseScope: "Prepare the 0.7.0 candidate for maintainer review",
      versionTargets: [{ name: "@h9-foundry/agentforge-cli", version: "0.7.0" }],
      qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
      securityReportRefs: [".agentops/runs/run-security/bundle.json"],
      evidenceSources: [
        ".agentops/evidence/buildkite-ci.json",
        ".agentops/evidence/jenkins-ci.json",
        ".agentops/evidence/generic-ci.json"
      ],
      constraints: ["Keep release readiness read-only by default"]
    });

    const releaseRun = await runLocalWorkflow("release-readiness", root);
    const bundle = readJson<{
      lifecycleArtifacts: Array<{
        artifactKind: string;
        payload?: {
          verificationChecks?: Array<{ name: string; status: string }>;
          ciEvidenceSummary?: Array<{ provider: string; platform: string; statusSummary: string }>;
          publishingPlan?: string[];
          externalDependencies?: string[];
        };
      }>;
    }>(releaseRun.jsonPath);

    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("release-report");
    expect(bundle.lifecycleArtifacts[0]?.payload?.verificationChecks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "imported-ci-evidence", status: "passed" })])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.ciEvidenceSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "Buildkite",
          platform: "buildkite",
          statusSummary: expect.stringContaining("completed from local-export evidence with success")
        }),
        expect.objectContaining({
          provider: "Jenkins",
          platform: "jenkins-ci",
          statusSummary: expect.stringContaining("completed from local-export evidence with success")
        }),
        expect.objectContaining({
          provider: "CircleCI",
          platform: "generic-ci",
          statusSummary: expect.stringContaining("completed from local-export evidence with success")
        })
      ])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.publishingPlan).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Buildkite (buildkite) pipeline `release` run `bk-42`"),
        expect.stringContaining("Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42`"),
        expect.stringContaining("CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42`")
      ])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.externalDependencies).toEqual(
      expect.arrayContaining([
        "Buildkite (buildkite) pipeline `release` run `bk-42` remains available for reviewer inspection.",
        "Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42` remains available for reviewer inspection.",
        "CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42` remains available for reviewer inspection."
      ])
    );

    const handoff = renderGitHubHandoffSummary(bundle.lifecycleArtifacts[0] as unknown as ReleaseArtifact);
    expect(handoff.sections.some((section) => section.heading === "CI Evidence")).toBe(true);
    expect(handoff.body).toContain(
      "Buildkite (buildkite) pipeline `release` run `bk-42` completed from local-export evidence with success."
    );
    expect(handoff.body).toContain(
      "Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42` completed from local-export evidence with success."
    );
    expect(handoff.body).toContain(
      "CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42` completed from local-export evidence with success."
    );
  });

  it("fails pipeline-evidence-review before reasoning when the request is missing", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);

    await expect(runLocalWorkflow("pipeline-evidence-review", root)).rejects.toThrow("Missing pipeline request");
  });

  it("rejects underspecified pipeline-evidence-review requests before reasoning", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    writeYamlFile(join(root, ".agentops", "requests", "pipeline.yaml"), {
      pipelineScope: "Review the bounded CI evidence for the current candidate pipeline set."
    });

    await expect(runLocalWorkflow("pipeline-evidence-review", root)).rejects.toThrow(
      /Pipeline request is underspecified/i
    );
  });

  it("runs pipeline-evidence-review with shared CI evidence across the current provider baseline", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });

    writeBundleFixture(root, "run-qa", [cloneFixture(schemaFixtures.qaArtifact)]);
    writeBundleFixture(root, "run-security", [cloneFixture(schemaFixtures.securityArtifact)]);
    writeBundleFixture(root, "run-release", [cloneFixture(schemaFixtures.releaseArtifact)]);

    writeFileSync(
      join(root, ".agentops", "evidence", "github-actions-ci.json"),
      JSON.stringify(schemaFixtures.githubActionsEvidence, null, 2)
    );
    writeFileSync(
      join(root, ".agentops", "evidence", "gitlab-ci.json"),
      JSON.stringify(schemaFixtures.gitlabCiEvidenceExport, null, 2)
    );
    writeFileSync(
      join(root, ".agentops", "evidence", "buildkite-ci.json"),
      JSON.stringify(schemaFixtures.buildkiteCiEvidenceExport, null, 2)
    );
    writeFileSync(
      join(root, ".agentops", "evidence", "jenkins-ci.json"),
      JSON.stringify(schemaFixtures.jenkinsCiEvidenceExport, null, 2)
    );
    writeFileSync(
      join(root, ".agentops", "evidence", "generic-ci.json"),
      JSON.stringify(schemaFixtures.genericCiEvidenceExport, null, 2)
    );

    writeYamlFile(join(root, ".agentops", "requests", "pipeline.yaml"), {
      pipelineScope: "Review the bounded CI evidence for the current candidate pipeline set.",
      issueRefs: ["#245"],
      focusAreas: ["pipeline-risk", "deployment-readiness"],
      constraints: ["Keep the workflow read-only"],
      qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
      securityReportRefs: [".agentops/runs/run-security/bundle.json"],
      releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
      evidenceSources: [
        ".agentops/evidence/github-actions-ci.json",
        ".agentops/evidence/gitlab-ci.json",
        ".agentops/evidence/buildkite-ci.json",
        ".agentops/evidence/jenkins-ci.json",
        ".agentops/evidence/generic-ci.json"
      ]
    });

    const pipelineRun = await runLocalWorkflow("pipeline-evidence-review", root);
    const bundle = readJson<{
      workflow: string;
      lifecycleArtifacts: Array<{
        artifactKind: string;
        payload?: {
          reviewStatus?: string;
          blockers?: string[];
          referencedArtifactKinds?: string[];
          ciEvidenceSummary?: Array<{ provider: string; platform: string }>;
        };
      }>;
    }>(pipelineRun.jsonPath);

    expect(pipelineRun.status).toBe("success");
    expect(pipelineRun.artifactKinds).toContain("pipeline-report");
    expect(bundle.workflow).toBe("pipeline-evidence-review");
    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("pipeline-report");
    expect(bundle.lifecycleArtifacts[0]?.payload?.reviewStatus).toBe("blocked");
    expect(bundle.lifecycleArtifacts[0]?.payload?.blockers).toEqual(
      expect.arrayContaining([expect.stringContaining("Imported CI evidence still reports failing checks:")])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.referencedArtifactKinds).toEqual(
      expect.arrayContaining(["qa-report", "security-report", "release-report"])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.ciEvidenceSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "GitHub Actions", platform: "github-actions" }),
        expect.objectContaining({ provider: "GitLab CI", platform: "gitlab-ci" }),
        expect.objectContaining({ provider: "Buildkite", platform: "buildkite" }),
        expect.objectContaining({ provider: "Jenkins", platform: "jenkins-ci" }),
        expect.objectContaining({ provider: "CircleCI", platform: "generic-ci" })
      ])
    );
  });

  it("fails deployment-gate-review before reasoning when the request is missing", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);

    await expect(runLocalWorkflow("deployment-gate-review", root)).rejects.toThrow("Missing deployment request");
  });

  it("rejects underspecified deployment-gate-review requests before reasoning", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    writeYamlFile(join(root, ".agentops", "requests", "deployment.yaml"), {
      deploymentScope: "Review the staging deployment gate for the current candidate.",
      targetEnvironment: "staging"
    });

    await expect(runLocalWorkflow("deployment-gate-review", root)).rejects.toThrow(
      /Deployment request is underspecified/i
    );
  });

  it("rejects deployment-gate-review when the referenced pipeline bundle lacks a pipeline-report artifact", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });

    writeBundleFixture(root, "run-qa", [cloneFixture(schemaFixtures.qaArtifact)]);
    writeBundleFixture(root, "run-security", [cloneFixture(schemaFixtures.securityArtifact)]);
    writeBundleFixture(root, "run-release", [cloneFixture(schemaFixtures.releaseArtifact)]);
    writeBundleFixture(root, "run-review", [cloneFixture(schemaFixtures.reviewArtifact)]);

    writeFileSync(
      join(root, ".agentops", "evidence", "jenkins-ci.json"),
      JSON.stringify(schemaFixtures.jenkinsCiEvidenceExport, null, 2)
    );

    writeYamlFile(join(root, ".agentops", "requests", "deployment.yaml"), {
      deploymentScope: "Review the staging deployment gate for the current candidate.",
      targetEnvironment: "staging",
      qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
      securityReportRefs: [".agentops/runs/run-security/bundle.json"],
      releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
      pipelineReportRefs: [".agentops/runs/run-review/bundle.json"],
      evidenceSources: [".agentops/evidence/jenkins-ci.json"]
    });

    await expect(runLocalWorkflow("deployment-gate-review", root)).rejects.toThrow(
      /does not contain a pipeline-report artifact/i
    );
  });

  it("runs deployment-gate-review with shared CI evidence and mixed artifact references", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    const readyPipelineArtifact = {
      ...cloneFixture(schemaFixtures.pipelineArtifact),
      payload: {
        ...cloneFixture(schemaFixtures.pipelineArtifact).payload,
        reviewStatus: "ready" as const
      }
    };

    writeBundleFixture(root, "run-qa", [cloneFixture(schemaFixtures.qaArtifact)]);
    writeBundleFixture(root, "run-security", [cloneFixture(schemaFixtures.securityArtifact)]);
    writeBundleFixture(root, "run-release", [cloneFixture(schemaFixtures.releaseArtifact)]);
    writeBundleFixture(root, "run-pipeline", [readyPipelineArtifact]);

    writeFileSync(
      join(root, ".agentops", "evidence", "jenkins-ci.json"),
      JSON.stringify(schemaFixtures.jenkinsCiEvidenceExport, null, 2)
    );
    writeFileSync(
      join(root, ".agentops", "evidence", "generic-ci.json"),
      JSON.stringify(schemaFixtures.genericCiEvidenceExport, null, 2)
    );

    writeYamlFile(join(root, ".agentops", "requests", "deployment.yaml"), {
      deploymentScope: "Review the staging deployment gate for the current candidate.",
      targetEnvironment: "staging",
      issueRefs: ["#245"],
      constraints: ["Keep the workflow read-only"],
      qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
      securityReportRefs: [".agentops/runs/run-security/bundle.json"],
      releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
      pipelineReportRefs: [".agentops/runs/run-pipeline/bundle.json"],
      evidenceSources: [
        ".agentops/evidence/jenkins-ci.json",
        ".agentops/evidence/generic-ci.json"
      ]
    });

    const deploymentRun = await runLocalWorkflow("deployment-gate-review", root);
    const bundle = readJson<{
      workflow: string;
      lifecycleArtifacts: Array<{
        artifactKind: string;
        payload?: {
          gateStatus?: string;
          blockers?: string[];
          referencedArtifactKinds?: string[];
          ciEvidenceSummary?: Array<{ provider: string; platform: string }>;
          requiredFollowUpChecks?: string[];
        };
      }>;
    }>(deploymentRun.jsonPath);

    expect(deploymentRun.status).toBe("success");
    expect(deploymentRun.artifactKinds).toContain("deployment-gate-report");
    expect(bundle.workflow).toBe("deployment-gate-review");
    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("deployment-gate-report");
    expect(bundle.lifecycleArtifacts[0]?.payload?.gateStatus).toBe("ready_for_approval");
    expect(bundle.lifecycleArtifacts[0]?.payload?.blockers).toEqual([]);
    expect(bundle.lifecycleArtifacts[0]?.payload?.referencedArtifactKinds).toEqual(
      expect.arrayContaining(["qa-report", "security-report", "release-report", "pipeline-report"])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.ciEvidenceSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "Jenkins", platform: "jenkins-ci" }),
        expect.objectContaining({ provider: "CircleCI", platform: "generic-ci" })
      ])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.requiredFollowUpChecks).toEqual(
      expect.arrayContaining([expect.stringContaining("Obtain explicit maintainer approval before any deploy, publish, or promotion action.")])
    );
  });

  it("fails incident-handoff before reasoning when the request is missing", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);

    await expect(runLocalWorkflow("incident-handoff", root)).rejects.toThrow("Missing incident request");
  });

  it("rejects underspecified incident-handoff requests before reasoning", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    writeYamlFile(join(root, ".agentops", "requests", "incident.yaml"), {
      incidentSummary: "Customers saw elevated 500s after the latest release candidate."
    });

    await expect(runLocalWorkflow("incident-handoff", root)).rejects.toThrow(
      /Incident request is underspecified/i
    );
  });

  it("rejects incident-handoff when the referenced release bundle lacks a release-report artifact", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    const bundleDir = join(root, ".agentops", "runs", "run-review");
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(
      join(bundleDir, "bundle.json"),
      JSON.stringify(
        {
          version: "1.0.0",
          runId: "run-review",
          workflow: "pr-review",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "success",
          policy: {
            version: 1,
            environment: "local",
            resolvedAt: new Date().toISOString(),
            defaults: schemaFixtures.policyDocument.defaults,
            paths: schemaFixtures.policyDocument.paths,
            plugins: schemaFixtures.policyDocument.plugins,
            tools: schemaFixtures.policyDocument.tools
          },
          entries: [],
          findings: [],
          proposedActions: [],
          blockedPlugins: [],
          lifecycleArtifacts: [schemaFixtures.reviewArtifact],
          artifactPaths: {
            json: ".agentops/runs/run-review/bundle.json",
            markdown: ".agentops/runs/run-review/summary.md"
          },
          provenance: {
            generatedBy: "agentforge-runtime",
            schemaVersion: "1.0.0",
            executionEnvironment: "local",
            repoRoot: root
          },
          redaction: {
            applied: true,
            strategyVersion: "1.0.0",
            categories: ["github-token"]
          },
          components: []
        },
        null,
        2
      )
    );
    writeFileSync(join(bundleDir, "summary.md"), "# review summary\n");
    writeYamlFile(join(root, ".agentops", "requests", "incident.yaml"), {
      incidentSummary: "Customers saw elevated 500s after the latest release candidate.",
      releaseReportRefs: [".agentops/runs/run-review/bundle.json"]
    });

    await expect(runLocalWorkflow("incident-handoff", root)).rejects.toThrow(
      /does not contain a release-report artifact/i
    );
  });

  it("runs incident-handoff after valid staged incident evidence and release-report references", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);

    const releaseBundleDir = join(root, ".agentops", "runs", "run-release");
    mkdirSync(releaseBundleDir, { recursive: true });
    writeFileSync(
      join(releaseBundleDir, "bundle.json"),
      JSON.stringify(
        {
          version: "1.0.0",
          runId: "run-release",
          workflow: "release-readiness",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "success",
          policy: {
            version: 1,
            environment: "local",
            resolvedAt: new Date().toISOString(),
            defaults: schemaFixtures.policyDocument.defaults,
            paths: schemaFixtures.policyDocument.paths,
            plugins: schemaFixtures.policyDocument.plugins,
            tools: schemaFixtures.policyDocument.tools
          },
          entries: [],
          findings: [],
          proposedActions: [],
          blockedPlugins: [],
          lifecycleArtifacts: [schemaFixtures.releaseArtifact],
          artifactPaths: {
            json: ".agentops/runs/run-release/bundle.json",
            markdown: ".agentops/runs/run-release/summary.md"
          },
          provenance: {
            generatedBy: "agentforge-runtime",
            schemaVersion: "1.0.0",
            executionEnvironment: "local",
            repoRoot: root
          },
          redaction: {
            applied: true,
            strategyVersion: "1.0.0",
            categories: ["github-token"]
          },
          components: []
        },
        null,
        2
      )
    );
    writeFileSync(join(releaseBundleDir, "summary.md"), "# release summary\n");
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    writeFileSync(join(root, ".agentops", "evidence", "incident-summary.md"), "# incident summary\n");
    writeFileSync(join(root, ".agentops", "evidence", "alerts.json"), JSON.stringify({ alert: "elevated-500s" }, null, 2));
    writeYamlFile(join(root, ".agentops", "requests", "incident.yaml"), {
      incidentSummary: "Customers saw elevated 500s after the latest release candidate.",
      severityHint: "high",
      evidenceSources: [".agentops/evidence/incident-summary.md", ".agentops/evidence/alerts.json"],
      releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
      issueRefs: ["#144"],
      constraints: ["Keep staged incident evidence read-only"]
    });

    const incidentRun = await runLocalWorkflow("incident-handoff", root);

    expect(incidentRun.status).toBe("success");
    expect(incidentRun.findings).toBe(0);
    expect(incidentRun.artifactKinds).toContain("incident-brief");

    const bundle = readJson<{
      workflow: string;
      lifecycleArtifacts: Array<{
        artifactKind: string;
        redaction?: {
          categories?: string[];
        };
        payload?: {
          incidentSummary?: string;
          timelineSummary?: string[];
          followUpWorkflowRefs?: string[];
          likelyImpactedAreas?: string[];
        };
      }>;
    }>(incidentRun.jsonPath);
    expect(bundle.workflow).toBe("incident-handoff");
    expect(bundle.lifecycleArtifacts).toHaveLength(1);
    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("incident-brief");
    expect(bundle.lifecycleArtifacts[0]?.payload?.incidentSummary).toContain("elevated 500s");
    expect(bundle.lifecycleArtifacts[0]?.payload?.timelineSummary?.[1]).toContain("Normalized staged incident evidence");
    expect(bundle.lifecycleArtifacts[0]?.payload?.followUpWorkflowRefs).toEqual(
      expect.arrayContaining(["maintenance-triage", "security-review", "release-readiness"])
    );
    expect(bundle.lifecycleArtifacts[0]?.payload?.likelyImpactedAreas).toContain("release-readiness");
    expect(bundle.lifecycleArtifacts[0]?.redaction?.categories).toContain("operational-sensitive");
  });

  it("fails maintenance-triage before reasoning when the request is missing", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);

    await expect(runLocalWorkflow("maintenance-triage", root)).rejects.toThrow("Missing maintenance request");
  });

  it("rejects underspecified maintenance-triage requests before reasoning", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);
    writeYamlFile(join(root, ".agentops", "requests", "maintenance.yaml"), {
      maintenanceGoal: "Triage routine maintenance work."
    });

    await expect(runLocalWorkflow("maintenance-triage", root)).rejects.toThrow(/Maintenance request is underspecified/i);
  });

  it("runs maintenance-triage after valid maintenance request references", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);
    ensureRequestsDir(root);

    const releaseBundleDir = join(root, ".agentops", "runs", "run-release");
    mkdirSync(releaseBundleDir, { recursive: true });
    writeFileSync(
      join(releaseBundleDir, "bundle.json"),
      JSON.stringify(
        {
          version: "1.0.0",
          runId: "run-release",
          workflow: "release-readiness",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "success",
          policy: {
            version: 1,
            environment: "local",
            resolvedAt: new Date().toISOString(),
            defaults: schemaFixtures.policyDocument.defaults,
            paths: schemaFixtures.policyDocument.paths,
            plugins: schemaFixtures.policyDocument.plugins,
            tools: schemaFixtures.policyDocument.tools
          },
          entries: [],
          findings: [],
          proposedActions: [],
          blockedPlugins: [],
          lifecycleArtifacts: [schemaFixtures.releaseArtifact],
          artifactPaths: {
            json: ".agentops/runs/run-release/bundle.json",
            markdown: ".agentops/runs/run-release/summary.md"
          },
          provenance: {
            generatedBy: "agentforge-runtime",
            schemaVersion: "1.0.0",
            executionEnvironment: "local",
            repoRoot: root
          },
          redaction: {
            applied: true,
            strategyVersion: "1.0.0",
            categories: ["github-token"]
          },
          components: []
        },
        null,
        2
      )
    );
    writeFileSync(join(releaseBundleDir, "summary.md"), "# release summary\n");
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    writeFileSync(join(root, ".agentops", "evidence", "dependency-alerts.json"), JSON.stringify({ alerts: ["vitest upgrade"] }, null, 2));
    writeFileSync(join(root, ".agentops", "evidence", "docs-task.md"), "# docs task\n");
    writeYamlFile(join(root, ".agentops", "requests", "maintenance.yaml"), {
      maintenanceGoal: "Triage dependency and docs hygiene follow-up after the latest release.",
      dependencyAlertRefs: [".agentops/evidence/dependency-alerts.json"],
      docsTaskRefs: [".agentops/evidence/docs-task.md"],
      releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
      issueRefs: ["#145"],
      constraints: ["Keep maintenance triage read-only"]
    });

    const maintenanceRun = await runLocalWorkflow("maintenance-triage", root);

    expect(maintenanceRun.status).toBe("success");
    expect(maintenanceRun.artifactCount).toBe(1);

    const bundle = readJson<{
      workflow: string;
      entries: Array<{ nodeId: string }>;
      lifecycleArtifacts: Array<{
        artifactKind?: string;
        payload?: {
          maintenanceScope?: string;
          evidenceSources?: string[];
          routingRecommendation?: string;
          followUpWorkflowRefs?: string[];
          followUpIssues?: string[];
          dependencyUpdates?: string[];
          docsUpdates?: string[];
        };
      }>;
    }>(maintenanceRun.jsonPath);
    expect(bundle.workflow).toBe("maintenance-triage");
    expect(bundle.entries.some((entry) => entry.nodeId === "intake")).toBe(true);
    expect(bundle.entries.some((entry) => entry.nodeId === "evidence")).toBe(true);
    expect(bundle.entries.some((entry) => entry.nodeId === "maintenance")).toBe(true);
    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("maintenance-report");
    expect(bundle.lifecycleArtifacts[0]?.payload?.maintenanceScope).toContain("dependency and docs hygiene");
    expect(bundle.lifecycleArtifacts[0]?.payload?.evidenceSources).toContain(".agentops/runs/run-release/bundle.json");
    expect(bundle.lifecycleArtifacts[0]?.payload?.routingRecommendation).toBe("implementation-proposal");
    expect(bundle.lifecycleArtifacts[0]?.payload?.followUpWorkflowRefs).toContain("release-readiness");
    expect(bundle.lifecycleArtifacts[0]?.payload?.followUpIssues).toContain("#145");
    expect(bundle.lifecycleArtifacts[0]?.payload?.dependencyUpdates).toContain(".agentops/evidence/dependency-alerts.json");
    expect(bundle.lifecycleArtifacts[0]?.payload?.docsUpdates).toContain(".agentops/evidence/docs-task.md");
  });

  it("runs a local eval spec for planning-discovery and emits an eval-result artifact", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);

    const evalRun = await runLocalEval("planning-discovery-local-brief", root);

    expect(evalRun.status).toBe("success");
    expect(evalRun.specId).toBe("planning-discovery-local-brief");
    expect(evalRun.workflow).toBe("planning-discovery");
    expect(evalRun.artifactKinds).toContain("eval-result");
    expect(evalRun.deterministicFailures).toBe(0);

    const bundle = readJson<{
      workflow: string;
      lifecycleArtifacts: Array<{
        artifactKind?: string;
        payload?: {
          specId?: string;
          workflow?: string;
          passed?: boolean;
          deterministicChecks?: Array<{ status?: string }>;
        };
      }>;
    }>(evalRun.jsonPath);
    expect(bundle.workflow).toBe("eval:planning-discovery-local-brief");
    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("eval-result");
    expect(bundle.lifecycleArtifacts[0]?.payload?.specId).toBe("planning-discovery-local-brief");
    expect(bundle.lifecycleArtifacts[0]?.payload?.workflow).toBe("planning-discovery");
    expect(bundle.lifecycleArtifacts[0]?.payload?.passed).toBe(true);
    expect(bundle.lifecycleArtifacts[0]?.payload?.deterministicChecks?.every((check) => check.status !== "failed")).toBe(true);
  });

  it("runs a chained local eval spec for maintenance-triage with prerequisite setup runs", async () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);

    const evalRun = await runLocalEval("maintenance-triage-local-report", root);

    expect(evalRun.status).toBe("success");
    expect(evalRun.workflow).toBe("maintenance-triage");
    expect(evalRun.setupRunCount).toBeGreaterThan(0);
    expect(evalRun.evaluatedRunId).toBeDefined();

    const bundle = readJson<{
      lifecycleArtifacts: Array<{
        artifactKind?: string;
        payload?: {
          setupRuns?: Array<{ workflow?: string }>;
          evaluatedRunId?: string;
        };
      }>;
    }>(evalRun.jsonPath);
    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("eval-result");
    expect(bundle.lifecycleArtifacts[0]?.payload?.evaluatedRunId).toBe(evalRun.evaluatedRunId);
    expect(bundle.lifecycleArtifacts[0]?.payload?.setupRuns?.some((run) => run.workflow === "release-readiness")).toBe(true);
  }, 30_000);

  it("compares eval results and emits a benchmark summary with deterministic regressions", () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);

    writeBundleFixture(root, "run-baseline", [
      {
        ...schemaFixtures.evalArtifact,
        source: { ...schemaFixtures.evalArtifact.source, runId: "run-baseline" },
        auditLink: { ...schemaFixtures.evalArtifact.auditLink, bundlePath: ".agentops/runs/run-baseline/bundle.json" },
        payload: {
          ...schemaFixtures.evalArtifact.payload,
          deterministicChecks: [
            {
              name: "run-status",
              status: "passed",
              expected: "success",
              actual: "success"
            }
          ],
          passed: true,
          failureCount: 0
        }
      }
    ]);

    writeBundleFixture(
      root,
      "run-candidate",
      [
        {
          ...schemaFixtures.evalArtifact,
          source: { ...schemaFixtures.evalArtifact.source, runId: "run-candidate" },
          auditLink: { ...schemaFixtures.evalArtifact.auditLink, bundlePath: ".agentops/runs/run-candidate/bundle.json" },
          payload: {
            ...schemaFixtures.evalArtifact.payload,
            deterministicChecks: [
              {
                name: "run-status",
                status: "failed",
                expected: "success",
                actual: "partial"
              }
            ],
            passed: false,
            failureCount: 1
          }
        }
      ],
      { status: "partial" }
    );

    const result = compareLocalEvalRuns("run-baseline", ["run-candidate"], root);

    expect(result.status).toBe("partial");
    expect(result.regressionCount).toBe(1);
    expect(result.improvementCount).toBe(0);
    expect(result.artifactKinds).toContain("benchmark-summary");

    const bundle = readJson<{
      lifecycleArtifacts: Array<{ artifactKind?: string; payload?: { regressionCount?: number } }>;
    }>(result.jsonPath);
    expect(bundle.lifecycleArtifacts[0]?.artifactKind).toBe("benchmark-summary");
    expect(bundle.lifecycleArtifacts[0]?.payload?.regressionCount).toBe(1);
  });

  it("marks eval comparisons as non-comparable when spec ids differ", () => {
    const root = createFixtureRepo();
    initializeWorkspace(root);

    writeBundleFixture(root, "run-planning", [
      {
        ...schemaFixtures.evalArtifact,
        source: { ...schemaFixtures.evalArtifact.source, runId: "run-planning" },
        auditLink: { ...schemaFixtures.evalArtifact.auditLink, bundlePath: ".agentops/runs/run-planning/bundle.json" }
      }
    ]);

    writeBundleFixture(root, "run-qa", [
      {
        ...schemaFixtures.evalArtifact,
        source: { ...schemaFixtures.evalArtifact.source, runId: "run-qa" },
        auditLink: { ...schemaFixtures.evalArtifact.auditLink, bundlePath: ".agentops/runs/run-qa/bundle.json" },
        payload: {
          ...schemaFixtures.evalArtifact.payload,
          specId: "qa-review-local-report",
          specName: "QA review emits qa report",
          workflow: "qa-review"
        }
      }
    ]);

    const result = compareLocalEvalRuns("run-planning", ["run-qa"], root);

    expect(result.status).toBe("partial");
    expect(result.comparableRunCount).toBe(0);
    expect(result.nonComparableCount).toBe(1);

    const bundle = readJson<{
      lifecycleArtifacts: Array<{
        payload?: { comparedRuns?: Array<{ comparable?: boolean; nonComparableFindings?: string[] }> };
      }>;
    }>(result.jsonPath);
    expect(bundle.lifecycleArtifacts[0]?.payload?.comparedRuns?.[0]?.comparable).toBe(false);
    expect(bundle.lifecycleArtifacts[0]?.payload?.comparedRuns?.[0]?.nonComparableFindings?.[0]).toContain("Spec mismatch");
  });

  it("propagates normalized GitHub references through downstream lifecycle artifacts", async () => {
    const root = createGitFixture("agentops-github-refs-");
    initProject(root);
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Plan the GitHub normalization slice",
        "goals:",
        "  - Produce one planning brief",
        "issueRefs:",
        "  - '#142'",
        "pathHints:",
        "  - packages/cli",
        "  - packages/schemas"
      ].join("\n")
    );
    const planningRun = await runLocalWorkflow("planning-discovery", root);
    writeFileSync(
      join(root, ".agentops", "requests", "design.yaml"),
      [
        `planningBriefRef: .agentops/runs/${planningRun.runId}/bundle.json`,
        "decisionTarget: Design GitHub reference normalization",
        "pathHints:",
        "  - packages/cli"
      ].join("\n")
    );
    const designRun = await runLocalWorkflow("architecture-design-review", root);
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        `designRecordRef: .agentops/runs/${designRun.runId}/bundle.json`,
        "implementationGoal: Implement GitHub reference normalization",
        "approvalMode: proposal-only",
        "targetPaths:",
        "  - packages/cli",
        "constraints:",
        "  - Keep the default path read-only"
      ].join("\n")
    );
    const implementationRun = await runLocalWorkflow("implementation-proposal", root);
    writeFileSync(
      join(root, ".agentops", "requests", "qa.yaml"),
      [
        `targetRef: .agentops/runs/${implementationRun.runId}/bundle.json`,
        "evidenceSources:",
        `  - .agentops/runs/${implementationRun.runId}/summary.md`,
        "focusAreas:",
        "  - regression-risk"
      ].join("\n")
    );
    const qaRun = await runLocalWorkflow("qa-review", root);
    writeFileSync(
      join(root, ".agentops", "requests", "security.yaml"),
      [
        `targetRef: .agentops/runs/${qaRun.runId}/bundle.json`,
        "evidenceSources:",
        `  - .agentops/runs/${qaRun.runId}/summary.md`,
        "focusAreas:",
        "  - dependency-risk",
        "releaseContext: candidate"
      ].join("\n")
    );
    const securityRun = await runLocalWorkflow("security-review", root);

    const planningBundle = readJson<{ lifecycleArtifacts: Array<{ source: { githubRefs?: Array<{ canonical: string }> } }> }>(planningRun.jsonPath);
    const designBundle = readJson<{ lifecycleArtifacts: Array<{ source: { githubRefs?: Array<{ canonical: string }> } }> }>(designRun.jsonPath);
    const implementationBundle = readJson<{ lifecycleArtifacts: Array<{ source: { githubRefs?: Array<{ canonical: string }> } }> }>(implementationRun.jsonPath);
    const qaBundle = readJson<{ lifecycleArtifacts: Array<{ source: { githubRefs?: Array<{ canonical: string }> } }> }>(qaRun.jsonPath);
    const securityBundle = readJson<{ lifecycleArtifacts: Array<{ source: { githubRefs?: Array<{ canonical: string }> } }> }>(securityRun.jsonPath);

    for (const bundle of [planningBundle, designBundle, implementationBundle, qaBundle, securityBundle]) {
      expect(bundle.lifecycleArtifacts[0]?.source.githubRefs?.map((entry) => entry.canonical)).toContain("H9-Foundry/fixture#142");
    }
  });

  it("propagates normalized GitLab SCM references through downstream lifecycle artifacts without creating GitHub refs", async () => {
    const root = createGitLabFixture("agentops-gitlab-refs-");
    initProject(root);
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Plan the GitLab normalization slice",
        "goals:",
        "  - Produce one planning brief",
        "issueRefs:",
        "  - '#123'",
        "  - '!45'",
        "  - 'https://gitlab.com/h9-foundry/platform/fixture/-/issues/77'",
        "  - 'https://gitlab.com/h9-foundry/platform/fixture/-/merge_requests/88'",
        "pathHints:",
        "  - packages/cli",
        "  - packages/schemas"
      ].join("\n")
    );
    const planningRun = await runLocalWorkflow("planning-discovery", root);
    writeFileSync(
      join(root, ".agentops", "requests", "design.yaml"),
      [
        `planningBriefRef: .agentops/runs/${planningRun.runId}/bundle.json`,
        "decisionTarget: Design GitLab reference normalization",
        "pathHints:",
        "  - packages/cli"
      ].join("\n")
    );
    const designRun = await runLocalWorkflow("architecture-design-review", root);
    writeFileSync(
      join(root, ".agentops", "requests", "implementation.yaml"),
      [
        `designRecordRef: .agentops/runs/${designRun.runId}/bundle.json`,
        "implementationGoal: Implement GitLab reference normalization",
        "approvalMode: proposal-only",
        "targetPaths:",
        "  - packages/cli",
        "constraints:",
        "  - Keep the default path read-only"
      ].join("\n")
    );
    const implementationRun = await runLocalWorkflow("implementation-proposal", root);
    writeFileSync(
      join(root, ".agentops", "requests", "qa.yaml"),
      [
        `targetRef: .agentops/runs/${implementationRun.runId}/bundle.json`,
        "evidenceSources:",
        `  - .agentops/runs/${implementationRun.runId}/summary.md`,
        "focusAreas:",
        "  - regression-risk"
      ].join("\n")
    );
    const qaRun = await runLocalWorkflow("qa-review", root);
    writeFileSync(
      join(root, ".agentops", "requests", "security.yaml"),
      [
        `targetRef: .agentops/runs/${qaRun.runId}/bundle.json`,
        "evidenceSources:",
        `  - .agentops/runs/${qaRun.runId}/summary.md`,
        "focusAreas:",
        "  - dependency-risk",
        "releaseContext: candidate"
      ].join("\n")
    );
    const securityRun = await runLocalWorkflow("security-review", root);

    const expectedCanonicals = [
      "gitlab.com/h9-foundry/platform/fixture#123",
      "gitlab.com/h9-foundry/platform/fixture!45",
      "gitlab.com/h9-foundry/platform/fixture#77",
      "gitlab.com/h9-foundry/platform/fixture!88"
    ];
    const bundles = [
      readJson<{ lifecycleArtifacts: Array<{ source: { scmRefs?: Array<{ canonical: string }>; githubRefs?: Array<{ canonical: string }> } }> }>(planningRun.jsonPath),
      readJson<{ lifecycleArtifacts: Array<{ source: { scmRefs?: Array<{ canonical: string }>; githubRefs?: Array<{ canonical: string }> } }> }>(designRun.jsonPath),
      readJson<{ lifecycleArtifacts: Array<{ source: { scmRefs?: Array<{ canonical: string }>; githubRefs?: Array<{ canonical: string }> } }> }>(implementationRun.jsonPath),
      readJson<{ lifecycleArtifacts: Array<{ source: { scmRefs?: Array<{ canonical: string }>; githubRefs?: Array<{ canonical: string }> } }> }>(qaRun.jsonPath),
      readJson<{ lifecycleArtifacts: Array<{ source: { scmRefs?: Array<{ canonical: string }>; githubRefs?: Array<{ canonical: string }> } }> }>(securityRun.jsonPath)
    ];

    for (const bundle of bundles) {
      expect(bundle.lifecycleArtifacts[0]?.source.scmRefs?.map((entry) => entry.canonical)).toEqual(
        expect.arrayContaining(expectedCanonicals)
      );
      expect(bundle.lifecycleArtifacts[0]?.source.githubRefs ?? []).toEqual([]);
    }
  });

  it("does not infer GitLab merge request shorthand outside a GitLab repo context", async () => {
    const root = createGenericHostFixture("agentops-generic-refs-");
    initProject(root);
    writeFileSync(
      join(root, ".agentops", "requests", "planning.yaml"),
      [
        "problemStatement: Confirm host-specific shorthand remains bounded",
        "goals:",
        "  - Produce one planning brief",
        "issueRefs:",
        "  - '!45'",
        "pathHints:",
        "  - packages/cli"
      ].join("\n")
    );

    const planningRun = await runLocalWorkflow("planning-discovery", root);
    const planningBundle = readJson<{
      lifecycleArtifacts: Array<{ source: { scmRefs?: Array<{ canonical: string }>; githubRefs?: Array<{ canonical: string }> } }>;
    }>(planningRun.jsonPath);

    expect(planningBundle.lifecycleArtifacts[0]?.source.scmRefs ?? []).toEqual([]);
    expect(planningBundle.lifecycleArtifacts[0]?.source.githubRefs ?? []).toEqual([]);
  });
});
