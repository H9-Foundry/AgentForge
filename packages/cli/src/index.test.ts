import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { explainLastRun, initProject, runLocalWorkflow, scanProject } from "./index.js";

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
    const root = mkdtempSync(join(tmpdir(), "agentops-cli-"));
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "AgentForge Test"], { cwd: root });
    writeFileSync(join(root, "package.json"), '{"name":"fixture"}');
    writeFileSync(join(root, "src.ts"), "export const value = 1;\n");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "init"], { cwd: root });
    writeFileSync(join(root, "src.ts"), "export const value = 2;\n");

    const init = initProject(root);
    expect(init.created.length).toBeGreaterThan(0);

    const scan = scanProject(root);
    expect(scan.recommendations).toContain("code-review");

    const run = await runLocalWorkflow("pr-review", root);
    expect(run.runId.length).toBeGreaterThan(0);
    expect(run.jsonPath.endsWith("bundle.json")).toBe(true);
    expect(run.markdownPath.endsWith("summary.md")).toBe(true);

    const explanation = explainLastRun(root);
    expect(explanation.runId).toBe(run.runId);
    expect(explanation.jsonPath).toBe(run.jsonPath);
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
});
