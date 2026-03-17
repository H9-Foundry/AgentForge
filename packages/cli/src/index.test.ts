import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { explainLastRun, initProject, runLocalWorkflow, scanProject } from "./index.js";

function createGitFixture(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  execFileSync("git", ["init"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "AgentForge Test"], { cwd: root });
  writeFileSync(join(root, "package.json"), '{"name":"fixture"}');
  writeFileSync(join(root, "src.ts"), "export const value = 1;\n");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "init"], { cwd: root });
  writeFileSync(join(root, "src.ts"), "export const value = 2;\n");
  return root;
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
      lifecycleArtifacts: { artifactKind: string }[];
    };
    expect(bundle.workflow).toBe("implementation-proposal");
    expect(bundle.lifecycleArtifacts.some((artifact) => artifact.artifactKind === "implementation-proposal")).toBe(true);

    const explanation = explainLastRun(root);
    expect(explanation.artifactKinds).toContain("implementation-proposal");
  });
});
