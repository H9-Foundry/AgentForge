import { describe, expect, it } from "vitest";

import { securityAnalystAgent } from "./index.js";

describe("security analyst agent", () => {
  it("emits a security-report artifact from validated inputs", async () => {
    const output = await securityAnalystAgent.execute({
      state: {
        version: "1.0.0",
        runId: "run-security",
        workflow: "security-review",
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
          securityRequest: {
            targetRef: ".agentops/runs/run-impl/bundle.json",
            evidenceSources: [".agentops/runs/run-impl/summary.md"],
            focusAreas: ["dependency-risk"],
            constraints: ["Keep the workflow read-only"],
            releaseContext: "candidate"
          },
          requestFile: ".agentops/requests/security.yaml"
        },
        agentResults: {
          intake: {
            metadata: {
              targetRef: ".agentops/runs/run-impl/bundle.json",
              evidenceSources: [".agentops/runs/run-impl/bundle.json", ".agentops/runs/run-impl/summary.md"],
              focusAreas: ["dependency-risk"],
              constraints: ["Keep the workflow read-only"],
              referencedArtifactKinds: ["implementation-proposal"]
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.lifecycleArtifacts).toHaveLength(1);
    const artifact = output.lifecycleArtifacts[0];
    expect(artifact?.artifactKind).toBe("security-report");
    expect(artifact && artifact.artifactKind === "security-report").toBe(true);
    if (!artifact || artifact.artifactKind !== "security-report") {
      throw new Error("Expected security-report artifact.");
    }

    expect(artifact.payload.targetRef).toBe(".agentops/runs/run-impl/bundle.json");
    expect(artifact.payload.evidenceSources).toContain(".agentops/runs/run-impl/summary.md");
    expect(artifact.payload.severitySummary).toContain("highest severity: medium");
  });
});
