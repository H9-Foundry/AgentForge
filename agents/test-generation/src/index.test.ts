import { describe, expect, it } from "vitest";

import { testGenerationAgent } from "./index.js";

describe("test generation agent", () => {
  it("suggests tests for changed source files", async () => {
    const output = await testGenerationAgent.execute({
      state: {} as never,
      stateSlice: {
        changes: {
          changedFiles: ["packages/runtime/src/index.ts"]
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.proposedActions).toHaveLength(1);
  });
});
