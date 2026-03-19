import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { schemaFixtures } from "@h9-foundry/agentforge-schemas";

import { createBuiltinAgentRegistry } from "./builtin-agents.js";

describe("builtin implementation inventory agent", () => {
  it("collects deterministic inventory and allowlisted validation commands", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentforge-inventory-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture-root",
          scripts: {
            test: "vitest run",
            "release:publish": "changeset publish"
          }
        },
        null,
        2
      )
    );
    mkdirSync(join(root, "packages", "app", "src"), { recursive: true });
    writeFileSync(
      join(root, "packages", "app", "package.json"),
      JSON.stringify(
        {
          name: "@fixture/app",
          scripts: {
            build: "tsc -p tsconfig.json",
            test: "vitest run"
          }
        },
        null,
        2
      )
    );
    writeFileSync(join(root, "packages", "app", "src", "index.ts"), "export const value = 1;\n");
    writeFileSync(join(root, "packages", "app", "agent.manifest.json"), "{\"name\":\"fixture\"}\n");

    const agent = createBuiltinAgentRegistry().get("implementation-inventory");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
      state: {} as never,
      stateSlice: {
        repo: {
          root,
          name: "fixture-root",
          branch: "main",
          packageManager: "pnpm",
          languages: ["typescript"],
          ci: false,
          detectedFiles: []
        },
        workflowInputs: {
          implementationRequest: {
            designRecordRef: ".agentops/runs/run-2/bundle.json",
            implementationGoal: "Prepare the next bounded implementation proposal",
            targetPaths: ["packages/app", "packages/missing"],
            validationCommands: ["pnpm test"],
            constraints: [],
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
              inputRefs: [".agentops/requests/design.yaml"],
              issueRefs: ["#132"]
            },
            status: "complete",
            generatedAt: new Date().toISOString(),
            repo: {
              root,
              name: "fixture-root",
              branch: "main"
            },
            provenance: {
              generatedBy: "agentforge-runtime",
              schemaVersion: "1.0.0",
              executionEnvironment: "local",
              repoRoot: root
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
              followUpWork: [],
              interfacesImpacted: ["packages/app/src/index.ts"],
              schemaChangesNeeded: [],
              policyChangesNeeded: [],
              migrationNotes: [],
              compatibilityNotes: []
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.metadata?.resolvedAffectedPaths).toContain("packages/app");
    expect(output.metadata?.resolvedAffectedPaths).toContain("packages/app/src/index.ts");
    expect(output.metadata?.resolvedAffectedPaths).not.toContain("packages/missing");
    expect(output.metadata?.affectedPackages).toContain("packages/app");
    expect(output.metadata?.entrypoints).toContain("packages/app/src/index.ts");
    expect(output.metadata?.discoveredValidationCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "pnpm test", source: "request", classification: "approval_required" }),
        expect.objectContaining({ command: "pnpm release:publish", classification: "deny" }),
        expect.objectContaining({ command: "pnpm --filter @fixture/app test", classification: "approval_required" })
      ])
    );
  });
});

describe("builtin qa evidence normalizer", () => {
  it("normalizes bounded QA evidence and allowlisted validation commands", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentforge-qa-evidence-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture-root",
          scripts: {
            test: "vitest run",
            lint: "eslint ."
          }
        },
        null,
        2
      )
    );
    mkdirSync(join(root, ".agentops", "runs", "run-impl"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "runs", "run-impl", "bundle.json"),
      JSON.stringify(
        {
          lifecycleArtifacts: [
            {
              artifactKind: "implementation-proposal",
              payload: {
                affectedPaths: ["packages/app/src/index.ts"]
              }
            }
          ]
        },
        null,
        2
      )
    );
    writeFileSync(join(root, ".agentops", "runs", "run-impl", "summary.md"), "# summary\n");
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "evidence", "github-actions-ci.json"),
      JSON.stringify(
        {
          repository: "H9-Foundry/fixture",
          workflowName: "CI",
          workflowRunId: 12345,
          runAttempt: 1,
          event: "pull_request",
          headBranch: "main",
          headSha: "abc123",
          status: "completed",
          conclusion: "failure",
          htmlUrl: "https://github.com/H9-Foundry/fixture/actions/runs/12345",
          jobs: [
            {
              name: "test",
              status: "completed",
              conclusion: "success",
              htmlUrl: "https://github.com/H9-Foundry/fixture/actions/runs/12345/job/1"
            },
            {
              name: "lint",
              status: "completed",
              conclusion: "failure",
              htmlUrl: "https://github.com/H9-Foundry/fixture/actions/runs/12345/job/2"
            }
          ],
          checkRuns: [
            {
              name: "validate-public-packages",
              status: "completed",
              conclusion: "success",
              detailsUrl: "https://github.com/H9-Foundry/fixture/actions/runs/12345/job/3"
            }
          ]
        },
        null,
        2
      )
    );
    mkdirSync(join(root, "packages", "app"), { recursive: true });
    writeFileSync(
      join(root, "packages", "app", "package.json"),
      JSON.stringify(
        {
          name: "@fixture/app",
          scripts: {
            test: "vitest run"
          }
        },
        null,
        2
      )
    );

    const agent = createBuiltinAgentRegistry().get("qa-evidence-normalizer");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
      state: {} as never,
      stateSlice: {
        repo: {
          root,
          name: "fixture-root",
          branch: "main",
          packageManager: "pnpm",
          languages: ["typescript"],
          ci: false,
          detectedFiles: []
        },
        workflowInputs: {
          qaRequest: {
            targetRef: ".agentops/runs/run-impl/bundle.json",
            evidenceSources: [".agentops/runs/run-impl/summary.md", ".agentops/evidence/github-actions-ci.json"],
            executedChecks: ["pnpm test"],
            focusAreas: ["coverage"],
            constraints: ["Keep QA evidence collection read-only"],
            releaseContext: "candidate"
          }
        },
        agentResults: {
          intake: {
            metadata: {
              targetType: "artifact-bundle"
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.metadata?.normalizedEvidenceSources).toEqual([
      ".agentops/runs/run-impl/bundle.json",
      ".agentops/runs/run-impl/summary.md",
      ".agentops/evidence/github-actions-ci.json"
    ]);
    expect(output.metadata?.referencedArtifactKinds).toContain("implementation-proposal");
    expect(output.metadata?.allowedValidationCommands).toEqual(
      expect.arrayContaining([expect.objectContaining({ command: "pnpm test", classification: "approval_required" })])
    );
    expect(output.metadata?.unrecognizedExecutedChecks).toEqual([]);
    const githubActionsMetadata = output.metadata?.githubActions as
      | { workflowNames?: string[]; failingChecks?: string[] }
      | undefined;
    expect(githubActionsMetadata?.workflowNames).toEqual(["CI"]);
    expect(githubActionsMetadata?.failingChecks).toEqual(["CI / lint"]);
  });
});

describe("builtin incident evidence normalizer", () => {
  it("normalizes staged incident evidence, provenance, and follow-up routing", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentforge-incident-evidence-"));
    mkdirSync(join(root, ".agentops", "runs", "run-release"), { recursive: true });
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    writeFileSync(join(root, ".agentops", "evidence", "incident-summary.md"), "# incident summary\n");
    writeFileSync(join(root, ".agentops", "evidence", "alerts.json"), JSON.stringify({ alert: "elevated-500s" }, null, 2));
    writeFileSync(
      join(root, ".agentops", "runs", "run-release", "bundle.json"),
      JSON.stringify(
        {
          finishedAt: new Date().toISOString(),
          lifecycleArtifacts: [schemaFixtures.releaseArtifact]
        },
        null,
        2
      )
    );

    const agent = createBuiltinAgentRegistry().get("incident-evidence-normalizer");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
      state: {} as never,
      stateSlice: {
        repo: {
          root,
          name: "fixture-root",
          branch: "main",
          packageManager: "pnpm",
          languages: ["typescript"],
          ci: false,
          detectedFiles: []
        },
        workflowInputs: {
          incidentRequest: {
            incidentSummary: "Customers saw elevated 500s after the last release candidate.",
            severityHint: "high",
            evidenceSources: [".agentops/evidence/incident-summary.md", ".agentops/evidence/alerts.json"],
            releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
            issueRefs: ["#159"],
            constraints: ["Keep staged incident evidence read-only"]
          }
        },
        agentResults: {
          intake: {
            metadata: {
              evidenceSources: [".agentops/evidence/incident-summary.md", ".agentops/evidence/alerts.json"],
              releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
              severityHint: "high"
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.metadata).toMatchObject({
      incidentSummary: "Customers saw elevated 500s after the last release candidate.",
      severityHint: "high"
    });
    expect(output.metadata?.normalizedEvidenceSources).toEqual(
      expect.arrayContaining([
        ".agentops/evidence/incident-summary.md",
        ".agentops/evidence/alerts.json",
        ".agentops/runs/run-release/bundle.json"
      ])
    );
    expect(output.metadata?.referencedArtifactKinds).toContain("release-report");
    expect(output.metadata?.followUpWorkflowRefs).toEqual(
      expect.arrayContaining(["maintenance-triage", "release-readiness", "security-review"])
    );
    expect(output.metadata?.redactionCategories).toContain("operational-sensitive");
    expect(output.metadata?.provenanceRefs).toContain(".agentops/runs/run-release/bundle.json#release-report");
  });
});

describe("builtin security intake agent", () => {
  it("records bounded security request metadata and referenced artifact kinds", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentforge-security-intake-"));
    mkdirSync(join(root, ".agentops", "runs", "run-impl"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "runs", "run-impl", "bundle.json"),
      JSON.stringify(
        {
          lifecycleArtifacts: [
            {
              artifactKind: "implementation-proposal"
            }
          ]
        },
        null,
        2
      )
    );
    writeFileSync(join(root, ".agentops", "runs", "run-impl", "summary.md"), "# summary\n");

    const agent = createBuiltinAgentRegistry().get("security-intake");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
      state: {} as never,
      stateSlice: {
        repo: {
          root,
          name: "fixture-root",
          branch: "main",
          packageManager: "pnpm",
          languages: ["typescript"],
          ci: false,
          detectedFiles: []
        },
        workflowInputs: {
          securityRequest: {
            targetRef: ".agentops/runs/run-impl/bundle.json",
            evidenceSources: [".agentops/runs/run-impl/summary.md"],
            focusAreas: ["dependency-risk"],
            constraints: ["Keep the workflow read-only"],
            releaseContext: "candidate"
          },
          securityTargetArtifactKinds: ["implementation-proposal"],
          requestFile: ".agentops/requests/security.yaml"
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.summary).toContain(".agentops/requests/security.yaml");
    expect(output.metadata?.targetType).toBe("artifact-bundle");
    expect(output.metadata?.referencedArtifactKinds).toEqual(["implementation-proposal"]);
    expect(output.metadata?.evidenceSources).toEqual([
      ".agentops/runs/run-impl/bundle.json",
      ".agentops/runs/run-impl/summary.md"
    ]);
  });
});

describe("builtin incident intake agent", () => {
  it("records bounded incident request metadata and staged evidence references", async () => {
    const agent = createBuiltinAgentRegistry().get("incident-intake");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
      state: {} as never,
      stateSlice: {
        workflowInputs: {
          incidentRequest: {
            incidentSummary: "Customers saw elevated 500s after the latest release candidate.",
            severityHint: "high",
            evidenceSources: [".agentops/evidence/incident-summary.md", ".agentops/evidence/alerts.json"],
            releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
            issueRefs: ["#144"],
            constraints: ["Keep staged incident evidence read-only"]
          },
          requestFile: ".agentops/requests/incident.yaml"
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.summary).toContain(".agentops/requests/incident.yaml");
    expect(output.metadata?.incidentSummary).toContain("elevated 500s");
    expect(output.metadata?.releaseReportRefs).toEqual([".agentops/runs/run-release/bundle.json"]);
    expect(output.metadata?.evidenceSourceCount).toBe(3);
  });
});

describe("builtin incident analyst agent", () => {
  it("emits an incident-brief artifact from bounded incident inputs", async () => {
    const agent = createBuiltinAgentRegistry().get("incident-analyst");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
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
          incidentGithubRefs: [schemaFixtures.githubReference],
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

    const artifact = output.lifecycleArtifacts[0];
    expect(artifact?.artifactKind).toBe("incident-brief");
    if (!artifact || artifact.artifactKind !== "incident-brief") {
      throw new Error("Expected incident-brief artifact.");
    }

    expect(artifact.payload.incidentSummary).toContain("elevated 500s");
    expect(artifact.payload.followUpWorkflowRefs).toContain("security-review");
    expect((output.metadata as { synthesizedAssessment?: { likelyImpactedAreas?: string[] } } | undefined)?.synthesizedAssessment?.likelyImpactedAreas)
      .toContain("release-readiness");
  });
});

describe("builtin maintenance analyst agent", () => {
  it("normalizes maintenance evidence and routing before reasoning", async () => {
    const agent = createBuiltinAgentRegistry().get("maintenance-evidence-normalizer");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
      state: {} as never,
      stateSlice: {
        workflowInputs: {
          maintenanceRequest: {
            maintenanceGoal: "Triage dependency and docs hygiene follow-up.",
            dependencyAlertRefs: [".agentops/evidence/dependency-alerts.json"],
            docsTaskRefs: ["docs/quickstart.md"],
            releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
            issueRefs: ["#152"],
            constraints: ["Keep maintenance triage read-only"]
          }
        },
        agentResults: {
          intake: {
            metadata: {
              dependencyAlertRefs: [".agentops/evidence/dependency-alerts.json"],
              docsTaskRefs: ["docs/quickstart.md"],
              releaseReportRefs: [".agentops/runs/run-release/bundle.json"]
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect((output.metadata as { routingRecommendation?: string } | undefined)?.routingRecommendation).toBe("implementation-proposal");
    expect((output.metadata as { followUpWorkflowRefs?: string[] } | undefined)?.followUpWorkflowRefs).toEqual(
      expect.arrayContaining(["implementation-proposal", "release-readiness"])
    );
  });

  it("emits a maintenance-report artifact from bounded maintenance inputs", async () => {
    const agent = createBuiltinAgentRegistry().get("maintenance-analyst");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
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
          impactedPaths: [],
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
            maintenanceGoal: "Triage dependency and docs hygiene follow-up.",
            dependencyAlertRefs: [".agentops/evidence/dependency-alerts.json"],
            docsTaskRefs: [".agentops/evidence/docs-task.md"],
            releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
            issueRefs: ["#152"],
            constraints: ["Keep maintenance triage read-only"]
          },
          maintenanceIssueRefs: ["#152"],
          maintenanceGithubRefs: [schemaFixtures.githubReference],
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
          },
          evidence: {
            metadata: {
              maintenanceGoal: "Triage dependency and docs hygiene follow-up.",
              dependencyAlertRefs: [".agentops/evidence/dependency-alerts.json"],
              docsTaskRefs: [".agentops/evidence/docs-task.md"],
              releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
              normalizedEvidenceSources: [
                ".agentops/evidence/dependency-alerts.json",
                ".agentops/evidence/docs-task.md",
                ".agentops/runs/run-release/bundle.json"
              ],
              missingEvidenceSources: [],
              referencedArtifactKinds: ["release-report"],
              affectedPackagesOrDocs: ["packages/cli", ".agentops/evidence/docs-task.md"],
              maintenanceSignals: [
                "Observed source .agentops/evidence/dependency-alerts.json during deterministic intake."
              ],
              followUpWorkflowRefs: ["implementation-proposal", "release-readiness"],
              routingRecommendation: "implementation-proposal",
              provenanceRefs: [
                ".agentops/evidence/dependency-alerts.json",
                ".agentops/runs/run-release/bundle.json#release-report"
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
    expect(artifact?.artifactKind).toBe("maintenance-report");
    if (!artifact || artifact.artifactKind !== "maintenance-report") {
      throw new Error("Expected maintenance-report artifact.");
    }

    expect(artifact.payload.maintenanceScope).toContain("dependency and docs hygiene");
    expect(artifact.payload.evidenceSources).toContain(".agentops/runs/run-release/bundle.json");
    expect(artifact.payload.affectedPackagesOrDocs).toContain("packages/cli");
    expect(artifact.payload.routingRecommendation).toBe("implementation-proposal");
    expect(artifact.payload.followUpWorkflowRefs).toContain("release-readiness");
    expect(artifact.payload.risks.length).toBeGreaterThan(0);
    expect(artifact.payload.dependencyUpdates).toContain(".agentops/evidence/dependency-alerts.json");
    expect(artifact.payload.docsUpdates).toContain(".agentops/evidence/docs-task.md");
    expect(artifact.payload.followUpIssues).toContain("#152");
  });
});

describe("builtin security analyst agent", () => {
  it("emits a security-report artifact from bounded security inputs", async () => {
    const agent = createBuiltinAgentRegistry().get("security-analyst");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
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
          impactedPaths: [],
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

    expect(artifact.payload.findings).toHaveLength(1);
    expect(artifact.payload.releaseImpact).toContain("candidate release");
  });
});

describe("builtin security evidence normalizer", () => {
  it("normalizes bounded security evidence with provenance and affected package hints", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentforge-security-evidence-"));
    mkdirSync(join(root, ".agentops", "runs", "run-impl"), { recursive: true });
    writeFileSync(
      join(root, ".agentops", "runs", "run-impl", "bundle.json"),
      JSON.stringify(
        {
          lifecycleArtifacts: [
            {
              artifactKind: "implementation-proposal",
              payload: {
                affectedPaths: ["packages/app/src/index.ts", "packages/runtime/src/index.ts"]
              }
            }
          ]
        },
        null,
        2
      )
    );
    writeFileSync(join(root, ".agentops", "runs", "run-impl", "summary.md"), "# summary\n");

    const agent = createBuiltinAgentRegistry().get("security-evidence-normalizer");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
      state: {} as never,
      stateSlice: {
        repo: {
          root,
          name: "fixture-root",
          branch: "main",
          packageManager: "pnpm",
          languages: ["typescript"],
          ci: false,
          detectedFiles: []
        },
        workflowInputs: {
          securityRequest: {
            targetRef: ".agentops/runs/run-impl/bundle.json",
            evidenceSources: [".agentops/runs/run-impl/summary.md"],
            focusAreas: ["dependency-risk", "release-readiness"],
            constraints: ["Keep the workflow read-only"],
            releaseContext: "candidate"
          }
        },
        agentResults: {
          intake: {
            metadata: {
              targetType: "artifact-bundle"
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.metadata?.normalizedEvidenceSources).toEqual([
      ".agentops/runs/run-impl/bundle.json",
      ".agentops/runs/run-impl/summary.md"
    ]);
    expect(output.metadata?.referencedArtifactKinds).toEqual(["implementation-proposal"]);
    expect(output.metadata?.affectedPackages).toEqual(["packages/app", "packages/runtime"]);
    expect(output.metadata?.provenanceRefs).toContain(".agentops/runs/run-impl/bundle.json#implementation-proposal");
  });
});

describe("builtin release evidence normalizer", () => {
  it("normalizes bounded release evidence, workspace version targets, and approval-gated follow-on actions", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentforge-release-evidence-"));
    mkdirSync(join(root, ".agentops", "runs", "run-qa"), { recursive: true });
    mkdirSync(join(root, ".agentops", "runs", "run-security"), { recursive: true });
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    mkdirSync(join(root, "packages", "cli"), { recursive: true });
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture-root",
          devDependencies: {
            typescript: "^5.8.0"
          }
        },
        null,
        2
      )
    );
    writeFileSync(
      join(root, "packages", "cli", "package.json"),
      JSON.stringify(
        {
          name: "@h9-foundry/agentforge-cli",
          version: "0.6.0",
          dependencies: {
            "@h9-foundry/agentforge-schemas": "workspace:*"
          }
        },
        null,
        2
      )
    );
    writeFileSync(
      join(root, ".agentops", "runs", "run-qa", "bundle.json"),
      JSON.stringify(
        {
          lifecycleArtifacts: [
            {
              artifactKind: "qa-report"
            }
          ]
        },
        null,
        2
      )
    );
    writeFileSync(join(root, ".agentops", "runs", "run-qa", "summary.md"), "# qa summary\n");
    writeFileSync(
      join(root, ".agentops", "runs", "run-security", "bundle.json"),
      JSON.stringify(
        {
          lifecycleArtifacts: [
            {
              artifactKind: "security-report"
            }
          ]
        },
        null,
        2
      )
    );
    writeFileSync(join(root, ".agentops", "runs", "run-security", "summary.md"), "# security summary\n");
    writeFileSync(
      join(root, ".agentops", "evidence", "attestation-verification.json"),
      JSON.stringify(
        {
          verifier: "github-artifact-attestation",
          subject: "@h9-foundry/agentforge-cli@0.7.0",
          issuer: "https://token.actions.githubusercontent.com",
          status: "verified",
          detail: "Verified GitHub artifact attestation for the release package artifact.",
          predicateType: "https://slsa.dev/provenance/v1",
          verifiedAt: "2026-03-19T12:45:00.000Z",
          provenanceRefs: [
            ".agentops/evidence/attestation-verification.json",
            "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789"
          ]
        },
        null,
        2
      )
    );

    const agent = createBuiltinAgentRegistry().get("release-evidence-normalizer");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
      state: {} as never,
      stateSlice: {
        repo: {
          root,
          name: "fixture-root",
          branch: "main",
          packageManager: "pnpm",
          languages: ["typescript"],
          ci: false,
          detectedFiles: []
        },
        workflowInputs: {
          releaseRequest: {
            releaseScope: "Prepare the next release candidate",
            versionTargets: [{ name: "@h9-foundry/agentforge-cli", version: "0.7.0" }],
            qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
            securityReportRefs: [".agentops/runs/run-security/bundle.json"],
            evidenceSources: [
              ".agentops/runs/run-security/summary.md",
              ".agentops/evidence/attestation-verification.json"
            ],
            constraints: ["Keep the workflow read-only"]
          }
        },
        agentResults: {
          intake: {
            metadata: {
              qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
              securityReportRefs: [".agentops/runs/run-security/bundle.json"],
              evidenceSources: [
                ".agentops/runs/run-security/summary.md",
                ".agentops/evidence/attestation-verification.json"
              ]
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.metadata?.normalizedEvidenceSources).toEqual([
      ".agentops/runs/run-qa/bundle.json",
      ".agentops/runs/run-security/bundle.json",
      ".agentops/runs/run-security/summary.md",
      ".agentops/evidence/attestation-verification.json"
    ]);
    expect(output.metadata?.versionResolutions).toEqual([
      expect.objectContaining({
        name: "@h9-foundry/agentforge-cli",
        currentVersion: "0.6.0",
        targetVersion: "0.7.0",
        status: "pending-version-bump"
      })
    ]);
    expect(output.metadata?.approvalRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "publish-packages", classification: "approval_required" }),
        expect.objectContaining({ action: "promote-release", classification: "approval_required" })
      ])
    );
    expect(output.metadata?.dependencyIntegrityEvidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ integrityStatus: "verified-lockfile", lockfilePath: "pnpm-lock.yaml" })])
    );
    expect(output.metadata?.attestationVerificationEvidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ verifier: "github-artifact-attestation", status: "verified" })])
    );
    expect(output.metadata?.trustSummary).toEqual(
      expect.arrayContaining([expect.stringContaining("Verified 1 attestation or provenance evidence export.")])
    );
    expect(output.metadata?.localReadinessChecks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "attestation-verification", status: "passed" })])
    );
  });

  it("blocks release readiness when supplied attestation verification evidence fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentforge-release-attestation-fail-"));
    mkdirSync(join(root, ".agentops", "runs", "run-qa"), { recursive: true });
    mkdirSync(join(root, ".agentops", "runs", "run-security"), { recursive: true });
    mkdirSync(join(root, ".agentops", "evidence"), { recursive: true });
    mkdirSync(join(root, "packages", "cli"), { recursive: true });
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-root" }, null, 2));
    writeFileSync(
      join(root, "packages", "cli", "package.json"),
      JSON.stringify({ name: "@h9-foundry/agentforge-cli", version: "0.6.0" }, null, 2)
    );
    writeFileSync(join(root, ".agentops", "runs", "run-qa", "bundle.json"), JSON.stringify({ lifecycleArtifacts: [{ artifactKind: "qa-report" }] }, null, 2));
    writeFileSync(join(root, ".agentops", "runs", "run-security", "bundle.json"), JSON.stringify({ lifecycleArtifacts: [{ artifactKind: "security-report" }] }, null, 2));
    writeFileSync(join(root, ".agentops", "runs", "run-security", "summary.md"), "# security summary\n");
    writeFileSync(
      join(root, ".agentops", "evidence", "attestation-verification.json"),
      JSON.stringify(
        {
          verifier: "github-artifact-attestation",
          subject: "@h9-foundry/agentforge-cli@0.7.0",
          issuer: "https://token.actions.githubusercontent.com",
          status: "failed",
          detail: "The supplied attestation did not match the expected release subject.",
          provenanceRefs: [".agentops/evidence/attestation-verification.json"]
        },
        null,
        2
      )
    );

    const agent = createBuiltinAgentRegistry().get("release-evidence-normalizer");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
      state: {} as never,
      stateSlice: {
        repo: {
          root,
          name: "fixture-root",
          branch: "main",
          packageManager: "pnpm",
          languages: ["typescript"],
          ci: false,
          detectedFiles: []
        },
        workflowInputs: {
          releaseRequest: {
            releaseScope: "Prepare the next release candidate",
            versionTargets: [{ name: "@h9-foundry/agentforge-cli", version: "0.7.0" }],
            qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
            securityReportRefs: [".agentops/runs/run-security/bundle.json"],
            evidenceSources: [".agentops/evidence/attestation-verification.json"],
            constraints: ["Keep the workflow read-only"]
          }
        },
        agentResults: {
          intake: {
            metadata: {
              qaReportRefs: [".agentops/runs/run-qa/bundle.json"],
              securityReportRefs: [".agentops/runs/run-security/bundle.json"],
              evidenceSources: [".agentops/evidence/attestation-verification.json"]
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.metadata?.readinessStatus).toBe("blocked");
    expect(output.metadata?.localReadinessChecks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "attestation-verification", status: "failed" })])
    );
    expect(output.metadata?.trustSummary).toEqual(
      expect.arrayContaining([expect.stringContaining("attestation verification failure")])
    );
  });
});
