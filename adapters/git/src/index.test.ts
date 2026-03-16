import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { createGitAdapters } from "./index.js";

describe("git adapters", () => {
  const policy = {
    canReadPath: () => ({ allowed: true, effect: "allow" as const, requiresApproval: false }),
    canWritePath: () => ({ allowed: false, effect: "deny" as const, requiresApproval: false }),
    redactSecrets: (value: string) => value
  };

  it("returns git status output", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-git-"));
    execFileSync("git", ["init"], { cwd: root });
    writeFileSync(join(root, "file.txt"), "hello");
    const adapter = createGitAdapters().find((candidate) => candidate.manifest.name === "git.status");
    const result = await adapter?.execute({}, { workingDirectory: root, policy });
    expect((result as { lines: string[] }).lines.length).toBeGreaterThan(0);
  });
});
