import { describe, expect, it } from "vitest";

import { createShellAdapters } from "./index.js";

describe("shell adapter", () => {
  const policy = {
    canReadPath: () => ({ allowed: true, effect: "allow" as const, requiresApproval: false }),
    canWritePath: () => ({ allowed: false, effect: "deny" as const, requiresApproval: false }),
    redactSecrets: (value: string) => value
  };

  it("rejects unknown command templates", async () => {
    const adapter = createShellAdapters()[0];
    await expect(adapter.execute({ templateId: "rm-rf" }, { workingDirectory: process.cwd(), policy })).rejects.toThrow(
      "Unknown shell template"
    );
  });
});
