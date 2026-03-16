import { describe, expect, it } from "vitest";

import { securityAuditAgent } from "./index.js";

describe("security audit agent", () => {
  it("flags blocked paths", async () => {
    const output = await securityAuditAgent.execute({
      state: {} as never,
      stateSlice: {
        changes: {
          changedFiles: [".env", "src/index.ts"]
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.findings).toHaveLength(1);
    expect(output.blockedActionFlags[0]).toContain(".env");
  });
});
