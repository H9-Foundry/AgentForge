import { describe, expect, it } from "vitest";

import { incidentAnalystAgent } from "./index.js";

describe("incident analyst agent", () => {
  it("emits an incident-brief artifact from validated inputs", async () => {
    const output = await incidentAnalystAgent.execute({
      state: {
        version: "1.0.0",
        runId: "run-incident",
        workflow: "incident-handoff",
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
          incidentRequest: {
            incidentSummary: "Customers saw elevated 500s after the latest release candidate.",
            severityHint: "high",
            evidenceSources: [".agentops/evidence/incident-summary.md", ".agentops/evidence/alerts.json"],
            releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
            issueRefs: ["#151"],
            constraints: ["Keep staged incident evidence read-only"]
          },
          incidentIssueRefs: ["#151"],
          incidentGithubRefs: [
            {
              platform: "github",
              host: "github.com",
              owner: "H9-Foundry",
              repo: "AgentForge",
              kind: "issue",
              number: 151,
              canonical: "H9-Foundry/AgentForge#151",
              url: "https://github.com/H9-Foundry/AgentForge/issues/151",
              source: "#151"
            }
          ],
          requestFile: ".agentops/requests/incident.yaml"
        },
        agentResults: {
          intake: {
            metadata: {
              evidenceSources: [".agentops/evidence/incident-summary.md", ".agentops/evidence/alerts.json"],
              releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
              severityHint: "high",
              constraints: ["Keep staged incident evidence read-only"]
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.lifecycleArtifacts).toHaveLength(1);
    const artifact = output.lifecycleArtifacts[0];
    expect(artifact?.artifactKind).toBe("incident-brief");
    if (!artifact || artifact.artifactKind !== "incident-brief") {
      throw new Error("Expected incident-brief artifact.");
    }

    expect(artifact.payload.incidentSummary).toContain("elevated 500s");
    expect(artifact.payload.followUpWorkflowRefs).toContain("security-review");
    expect(artifact.payload.followUpWorkflowRefs).toContain("maintenance-triage");
  });
});
