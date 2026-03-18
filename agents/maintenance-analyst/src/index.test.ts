import { describe, expect, it } from "vitest";

import { maintenanceAnalystAgent } from "./index.js";

describe("maintenance analyst agent", () => {
  it("emits a maintenance-report artifact from validated inputs", async () => {
    const output = await maintenanceAnalystAgent.execute({
      state: {
        version: "1.0.0",
        runId: "run-maintenance",
        workflow: "maintenance-triage",
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
          impactedPaths: ["docs"],
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
          maintenanceRequest: {
            maintenanceGoal: "Triage dependency and docs hygiene follow-up after the latest release.",
            dependencyAlertRefs: [".agentops/evidence/dependency-alerts.json"],
            docsTaskRefs: [".agentops/evidence/docs-task.md"],
            releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
            issueRefs: ["#152"],
            constraints: ["Keep maintenance triage read-only"]
          },
          maintenanceIssueRefs: ["#152"],
          maintenanceGithubRefs: [
            {
              platform: "github",
              host: "github.com",
              owner: "H9-Foundry",
              repo: "AgentForge",
              kind: "issue",
              number: 152,
              canonical: "H9-Foundry/AgentForge#152",
              url: "https://github.com/H9-Foundry/AgentForge/issues/152",
              source: "#152"
            }
          ],
          requestFile: ".agentops/requests/maintenance.yaml"
        },
        agentResults: {
          intake: {
            metadata: {
              dependencyAlertRefs: [".agentops/evidence/dependency-alerts.json"],
              docsTaskRefs: [".agentops/evidence/docs-task.md"],
              releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
              constraints: ["Keep maintenance triage read-only"]
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.lifecycleArtifacts).toHaveLength(1);
    const artifact = output.lifecycleArtifacts[0];
    expect(artifact?.artifactKind).toBe("maintenance-report");
    if (!artifact || artifact.artifactKind !== "maintenance-report") {
      throw new Error("Expected maintenance-report artifact.");
    }

    expect(artifact.payload.maintenanceScope).toContain("dependency and docs hygiene");
    expect(artifact.payload.dependencyUpdates).toContain(".agentops/evidence/dependency-alerts.json");
    expect(artifact.payload.docsUpdates).toContain(".agentops/evidence/docs-task.md");
    expect(artifact.payload.followUpIssues).toContain("#152");
  });
});
