import { describe, expect, it } from "vitest";

import { codeReviewAgent } from "./index.js";

describe("code review agent", () => {
  it("raises a finding for core package changes without tests", async () => {
    const output = await codeReviewAgent.execute({
      state: {} as never,
      stateSlice: {
        changes: {
          changedFiles: ["packages/runtime/src/index.ts"],
          fileDetails: [{ path: "packages/runtime/src/index.ts", insertions: 30, deletions: 0, status: "M" }]
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.findings).toHaveLength(1);
  });
});
