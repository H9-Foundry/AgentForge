import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { createWorkflowState, detectPackageManager } from "./index.js";

const snapshot = {
  version: 1,
  environment: "local" as const,
  resolvedAt: new Date().toISOString(),
  defaults: {
    executionMode: "inspect" as const,
    modelAccess: false,
    network: "deny" as const,
    writes: "approval_required" as const
  },
  paths: {
    allowedRead: ["**/*"],
    allowedWrite: [".agentops/runs/**"],
    blocked: [".env*"]
  },
  tools: {}
};

describe("context engine", () => {
  it("detects pnpm from lockfiles", () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-context-"));
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'");
    expect(detectPackageManager(root)).toBe("pnpm");
  });

  it("creates workflow state from a git repo", () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-state-"));
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "AgentOps Test"], { cwd: root });
    writeFileSync(join(root, "package.json"), '{"name":"fixture"}');
    writeFileSync(join(root, "src.ts"), "export const value = 1;\n");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "init"], { cwd: root });
    writeFileSync(join(root, "src.ts"), "export const value = 2;\n");

    const state = createWorkflowState({
      cwd: root,
      workflow: "pr-review",
      mode: "inspect",
      policy: snapshot
    });

    expect(state.repo.name.length).toBeGreaterThan(0);
    expect(state.changes.changedFiles).toContain("src.ts");
    expect(state.policy.environment).toBe("local");
  });
});
