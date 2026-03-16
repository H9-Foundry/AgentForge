import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { explainLastRun, initProject, runLocalWorkflow, scanProject } from "./index.js";

describe("cli smoke flows", () => {
  it("initializes, scans, runs, and explains a local workflow", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-cli-"));
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "AgentOps Test"], { cwd: root });
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
});
