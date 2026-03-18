import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { schemaFixtures } from "@h9-foundry/agentforge-schemas";

import { explainLastRun, initProject, runLocalWorkflow, scanProject } from "./index.js";

function createGitFixture(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  execFileSync("git", ["init"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "AgentForge Test"], { cwd: root });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
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

  it("prints first-run guidance for the current wedge in plain-text mode", () => {
    const root = createGitFixture("agentops-cli-guidance-");
    ensureBuiltCli();

    const cliEntry = join(process.cwd(), "packages", "cli", "src", "bin.ts");
    const run = spawnSync("pnpm", ["exec", "tsx", cliEntry, "run", "pr-review"], {
      cwd: root,
      encoding: "utf8"
    });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Audit bundle:");
    expect(run.stdout).toContain("Summary:");
    expect(run.stdout).toContain("agentforge explain last-run");
  }, 30_000);

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
    expect(securityRun.artifactKinds).toEqual([]);

    const bundle = readJson<{ workflow: string }>(securityRun.jsonPath);
    expect(bundle.workflow).toBe("security-review");
  });
});
