import { describe, expect, it } from "vitest";

import { implementationPlannerAgent } from "./index.js";

describe("implementation planner agent", () => {
  it("emits an implementation proposal artifact from validated inputs", async () => {
    const output = await implementationPlannerAgent.execute({
      state: {
        version: "1.0.0",
        runId: "run-3",
        workflow: "implementation-proposal",
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
          implementationRequest: {
            designRecordRef: ".agentops/runs/run-2/bundle.json",
            implementationGoal: "Prepare the next bounded implementation proposal",
            targetPaths: ["packages/cli", "packages/runtime"],
            validationCommands: ["pnpm test"],
            constraints: ["Keep the default path read-only"],
            approvalMode: "proposal-only"
          },
          designRecord: {
            schemaVersion: "1.0.0",
            artifactKind: "design-record",
            lifecycleDomain: "design",
            workflow: {
              name: "architecture-design-review",
              displayName: "Architecture And Design Review"
            },
            source: {
              sourceType: "workflow-run",
              runId: "run-2",
              inputRefs: [".agentops/requests/design.yaml", ".agentops/runs/run-1/bundle.json"],
              issueRefs: ["#132"]
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
            summary: "Design record ready.",
            payload: {
              decisionSummary: "Choose the implementation workflow shape.",
              context: "Planning brief summary: Planning brief ready.",
              optionsConsidered: [{ option: "single-workflow-pass", summary: "Keep the workflow narrow." }],
              chosenApproach: "single-workflow-pass",
              tradeOffs: [],
              risks: [],
              followUpWork: ["Turn the design record into a bounded implementation proposal."],
              interfacesImpacted: ["packages/cli/src/index.ts"],
              schemaChangesNeeded: ["packages/schemas/src/index.ts"],
              policyChangesNeeded: [],
              migrationNotes: [],
              compatibilityNotes: []
            }
          },
          requestFile: ".agentops/requests/implementation.yaml"
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.lifecycleArtifacts).toHaveLength(1);
    expect(output.lifecycleArtifacts[0]?.artifactKind).toBe("implementation-proposal");
  });
});
