import { describe, expect, it } from "vitest";

import { planningAnalystAgent } from "./index.js";

describe("planning analyst agent", () => {
  it("emits a planning brief artifact from a validated request", async () => {
    const output = await planningAnalystAgent.execute({
      state: {
        version: "1.0.0",
        runId: "run-1",
        workflow: "planning-discovery",
        mode: "inspect",
        repo: {
          root: "/repo",
          name: "repo",
          branch: "main",
          packageManager: "pnpm",
          languages: ["typescript"],
          ci: false,
          detectedFiles: []
        },
        changes: {
          changedFiles: [],
          stagedFiles: [],
          untrackedFiles: [],
          impactedPaths: ["packages", "docs"],
          diffStats: { filesChanged: 0, insertions: 0, deletions: 0 },
          fileDetails: []
        },
        context: {
          localExecution: true,
          ciExecution: false,
          trigger: "manual",
          timestamp: new Date().toISOString()
        },
        policy: {} as never,
        approvals: [],
        findings: [],
        proposedActions: [],
        lifecycleArtifacts: [],
        blockedPlugins: [],
        workflowInputs: {},
        agentResults: {},
        auditTrail: []
      },
      stateSlice: {
        workflowInputs: {
          planningRequest: {
            problemStatement: "Plan the next workflow wedge.",
            goals: ["Produce a bounded planning brief"],
            constraints: ["Keep the workflow local-first"],
            issueRefs: ["#127"],
            pathHints: ["packages/cli", "docs/PLANNING_DISCOVERY_WORKFLOW.md"],
            assumptions: []
          },
          requestFile: ".agentops/requests/planning.yaml"
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.lifecycleArtifacts).toHaveLength(1);
    expect(output.lifecycleArtifacts[0]?.artifactKind).toBe("planning-brief");
  });
});
