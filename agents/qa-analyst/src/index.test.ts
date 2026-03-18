import { describe, expect, it } from "vitest";

import { qaAnalystAgent } from "./index.js";

describe("qa analyst agent", () => {
  it("emits a qa-report artifact from validated inputs", async () => {
    const output = await qaAnalystAgent.execute({
      state: {
        version: "1.0.0",
        runId: "run-qa",
        workflow: "qa-review",
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
          impactedPaths: ["packages"],
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
          qaRequest: {
            targetRef: ".agentops/runs/run-impl/bundle.json",
            evidenceSources: [".agentops/runs/run-impl/summary.md"],
            executedChecks: ["pnpm test"],
            focusAreas: ["coverage"],
            constraints: ["Keep QA evidence collection read-only"],
            releaseContext: "candidate"
          },
          requestFile: ".agentops/requests/qa.yaml"
        },
        agentResults: {
          intake: {
            metadata: {
              targetRef: ".agentops/runs/run-impl/bundle.json",
              evidenceSources: [".agentops/runs/run-impl/bundle.json", ".agentops/runs/run-impl/summary.md"],
              executedChecks: ["pnpm test"],
              focusAreas: ["coverage"],
              constraints: ["Keep QA evidence collection read-only"],
              targetType: "artifact-bundle"
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.lifecycleArtifacts).toHaveLength(1);
    const artifact = output.lifecycleArtifacts[0];
    expect(artifact?.artifactKind).toBe("qa-report");
    expect(artifact && artifact.artifactKind === "qa-report").toBe(true);
    if (!artifact || artifact.artifactKind !== "qa-report") {
      throw new Error("Expected qa-report artifact.");
    }

    expect(artifact.payload.targetRef).toBe(".agentops/runs/run-impl/bundle.json");
    expect(artifact.payload.executedChecks).toContain("pnpm test");
    expect(artifact.payload.coverageGaps).toContain(
      "Coverage evidence still needs deterministic normalization before it can be promoted to an official QA signal."
    );
  });
});
