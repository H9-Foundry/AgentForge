import { describe, expect, it } from "vitest";

import { contextCollectorAgent } from "./index.js";

describe("context collector", () => {
  it("summarizes repository context", async () => {
    const output = await contextCollectorAgent.execute({
      state: {} as never,
      stateSlice: {
        repo: { name: "agentops" },
        changes: { changedFiles: ["src/index.ts"], impactedPaths: ["src"] }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.summary).toContain("Collected context");
  });
});
