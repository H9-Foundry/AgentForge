import { describe, expect, it } from "vitest";

import { releaseAnalystAgent } from "./index.js";

describe("release analyst agent", () => {
  it("emits a release-report artifact from validated inputs", async () => {
    const output = await releaseAnalystAgent.execute({
      state: {
        version: "1.0.0",
        runId: "run-release",
        workflow: "release-readiness",
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
          releaseRequest: {
            releaseScope: "Prepare the next release candidate",
            versionTargets: [{ name: "@h9-foundry/agentforge-cli", version: "0.7.0" }],
            qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
            securityReportRefs: [".agentops/runs/run-security/bundle.json"],
            evidenceSources: [".agentops/runs/run-security/summary.md"],
            constraints: ["Keep the workflow read-only"]
          },
          releaseIssueRefs: ["#150"],
          releaseGithubRefs: [],
          requestFile: ".agentops/requests/release.yaml"
        },
        agentResults: {
          intake: {
            metadata: {
              qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
              securityReportRefs: [".agentops/runs/run-security/bundle.json"],
              evidenceSources: [".agentops/runs/run-security/summary.md"],
              constraints: ["Keep the workflow read-only"]
            }
          },
          evidence: {
            metadata: {
              qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
              securityReportRefs: [".agentops/runs/run-security/bundle.json"],
              normalizedEvidenceSources: [
                ".agentops/runs/run-qa/bundle.json",
                ".agentops/runs/run-security/bundle.json",
                ".agentops/runs/run-security/summary.md"
              ],
              missingEvidenceSources: [],
              versionResolutions: [
                {
                  name: "@h9-foundry/agentforge-cli",
                  targetVersion: "0.7.0",
                  currentVersion: "0.6.0",
                  status: "pending-version-bump"
                }
              ],
              localReadinessChecks: [
                { name: "qa-report-refs", status: "passed", detail: "Using 1 validated QA report reference(s)." },
                { name: "security-report-refs", status: "passed", detail: "Using 1 validated security report reference(s)." },
                { name: "workspace-version-targets", status: "passed", detail: "Resolved 1 workspace version target(s)." }
              ],
              readinessStatus: "ready",
              approvalRecommendations: [
                {
                  action: "publish-packages",
                  classification: "approval_required",
                  reason: "Package publication remains outside the default read-only workflow path and needs explicit release approval."
                }
              ],
              provenanceRefs: [
                ".agentops/runs/run-qa/bundle.json",
                ".agentops/runs/run-security/bundle.json",
                "packages/cli/package.json"
              ]
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.lifecycleArtifacts).toHaveLength(1);
    const artifact = output.lifecycleArtifacts[0];
    expect(artifact?.artifactKind).toBe("release-report");
    if (!artifact || artifact.artifactKind !== "release-report") {
      throw new Error("Expected release-report artifact.");
    }

    expect(artifact.payload.releaseScope).toBe("Prepare the next release candidate");
    expect(artifact.payload.readinessStatus).toBe("ready");
    expect(artifact.payload.verificationChecks).toHaveLength(3);
    expect(artifact.payload.versionResolutions).toEqual([
      expect.objectContaining({ name: "@h9-foundry/agentforge-cli", status: "pending-version-bump" })
    ]);
    expect(artifact.payload.approvalRecommendations).toEqual([
      expect.objectContaining({ action: "publish-packages", classification: "approval_required" })
    ]);
    expect(artifact.payload.publishingPlan[0]).toContain("workspace version target");
    expect(artifact.payload.publishingPlan[1]).toContain("QA and security evidence");
  });
});
