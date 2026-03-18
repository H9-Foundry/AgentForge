import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
