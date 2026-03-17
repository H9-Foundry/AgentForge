import { describe, expect, it } from "vitest";

import { designAnalystAgent } from "./index.js";

describe("design analyst agent", () => {
  it("emits a design record artifact from a validated request and planning brief", async () => {
    const output = await designAnalystAgent.execute({
      state: {
        version: "1.0.0",
        runId: "run-2",
        workflow: "architecture-design-review",
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
          designRequest: {
            planningBriefRef: ".agentops/runs/run-1/bundle.json",
            decisionTarget: "Choose the first design workflow implementation shape.",
            constraints: [],
            pathHints: ["packages/runtime", "packages/schemas"],
            alternatives: ["single-workflow-pass"],
            questions: []
          },
          planningBrief: {
            schemaVersion: "1.0.0",
            artifactKind: "planning-brief",
            lifecycleDomain: "plan",
            workflow: {
              name: "planning-discovery",
              displayName: "Planning And Discovery"
            },
            source: {
              sourceType: "workflow-run",
              runId: "run-1",
              inputRefs: [".agentops/requests/planning.yaml"],
              issueRefs: ["#127"]
            },
            status: "complete",
            generatedAt: new Date().toISOString(),
            repo: {
              root: "/repo",
              name: "repo",
              branch: "main"
            },
            provenance: {
              generatedBy: "agentforge-runtime",
              schemaVersion: "1.0.0",
              executionEnvironment: "local",
              repoRoot: "/repo"
            },
            redaction: {
              applied: true,
              strategyVersion: "1.0.0",
              categories: ["secrets"]
            },
            auditLink: {
              entryIds: [],
              findingIds: [],
              proposedActionIds: []
            },
            summary: "Planning brief ready.",
            payload: {
              problemStatement: "Plan the next workflow wedge.",
              objectives: ["Produce a bounded planning brief"],
              constraints: [],
              assumptions: [],
              inScope: ["packages/runtime", "packages/schemas"],
              outOfScope: [],
              recommendedNextSteps: ["Run architecture-design-review"],
              stakeholders: [],
              risks: [],
              openQuestions: [],
              candidateWorkstreams: ["packages"],
              linkedIssues: ["#127"]
            }
          }
        },
        agentResults: {
          inventory: {
            metadata: {
              impactedInterfaces: ["packages/runtime/src/index.ts"],
              schemaSurfaces: ["packages/schemas/src/index.ts"],
              policySurfaces: ["packages/policy-engine/src/index.ts"]
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.lifecycleArtifacts).toHaveLength(1);
    expect(output.lifecycleArtifacts[0]?.artifactKind).toBe("design-record");
  });
});
