import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createFilesystemAdapters } from "./index.js";

describe("filesystem adapters", () => {
  const policy = {
    canReadPath: (path: string) => ({
      allowed: !path.startsWith("../"),
      effect: (path.startsWith("../") ? "deny" : "allow") as "deny" | "allow",
      requiresApproval: false,
      reason: path.startsWith("../") ? "blocked" : undefined
    }),
    canWritePath: () => ({ allowed: true, effect: "allow" as const, requiresApproval: false }),
    redactSecrets: (value: string) => value
  };

  it("reads files", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-fs-"));
    writeFileSync(join(root, "fixture.txt"), "hello");
    const adapter = createFilesystemAdapters().find((candidate) => candidate.manifest.name === "filesystem.read-file");
    const result = await adapter?.execute({ path: "fixture.txt" }, { workingDirectory: root, policy });
    expect((result as { contents: string }).contents).toBe("hello");
  });

  it("blocks repository escape paths", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-fs-"));
    const adapter = createFilesystemAdapters().find((candidate) => candidate.manifest.name === "filesystem.read-file");

    await expect(adapter?.execute({ path: "../secret.txt" }, { workingDirectory: root, policy })).rejects.toThrow(/blocked|repository root/i);
  });
});
