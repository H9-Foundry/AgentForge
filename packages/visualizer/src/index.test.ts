import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { schemaFixtures } from "@h9-foundry/agentforge-schemas";
import { describe, expect, it } from "vitest";

import {
  listAvailableArtifactKinds,
  listAvailableStatuses,
  listAvailableWorkflows,
  loadBenchmarkIndexView,
  loadBenchmarkLedgerView,
  loadOutcomesDashboardView,
  loadRunComparisonView,
  loadRunDetailView,
  loadRunsIndexView
} from "./data.js";
import { renderBenchmarksPage, renderConfigurePage, renderOutcomesDashboardPage, renderRunComparePage, renderRunDetailPage, renderRunsIndexPage } from "./html.js";
import { createVisualizerServer } from "./index.js";

function cloneFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "agentforge-visualizer-"));
  mkdirSync(join(root, ".agentops", "runs"), { recursive: true });
  return root;
}

function writeBundleFixture(
  root: string,
  runId: string,
  lifecycleArtifacts: unknown[],
  options?: {
    workflow?: string;
    status?: "success" | "partial" | "failed";
    entries?: Array<{ id: string; nodeId: string; nodeName: string; kind: "deterministic" | "reasoning" | "report"; status: "success" | "partial" | "failed"; summary: string; blockedActions?: string[] }>;
    findings?: unknown[];
    blockedPlugins?: unknown[];
    usage?: Record<string, unknown>;
    configuration?: Record<string, unknown>;
  }
): void {
  const runRoot = join(root, ".agentops", "runs", runId);
  mkdirSync(runRoot, { recursive: true });
  writeFileSync(
    join(runRoot, "bundle.json"),
    JSON.stringify(
      {
        version: "1.0.0",
        runId,
        workflow: options?.workflow ?? "planning-discovery",
        startedAt: "2026-03-23T08:00:00.000Z",
        finishedAt: "2026-03-23T08:00:10.000Z",
        status: options?.status ?? "success",
        policy: {
          version: 1,
          environment: "local",
          resolvedAt: "2026-03-23T08:00:00.000Z",
          defaults: schemaFixtures.policyDocument.defaults,
          paths: schemaFixtures.policyDocument.paths,
          plugins: schemaFixtures.policyDocument.plugins,
          tools: schemaFixtures.policyDocument.tools
        },
        entries:
          options?.entries?.map((entry) => ({
            startedAt: "2026-03-23T08:00:00.000Z",
            completedAt: "2026-03-23T08:00:01.000Z",
            toolsRequested: [],
            toolsExecuted: [],
            blockedActions: [],
            validationPassed: true,
            ...entry
          })) ?? [],
        findings: options?.findings ?? [],
        proposedActions: [],
        blockedPlugins: options?.blockedPlugins ?? [],
        lifecycleArtifacts,
        configuration: options?.configuration,
        artifactPaths: {
          json: `.agentops/runs/${runId}/bundle.json`,
          markdown: `.agentops/runs/${runId}/summary.md`
        },
        usage: options?.usage,
        provenance: {
          generatedBy: "agentforge-runtime",
          schemaVersion: "1.0.0",
          executionEnvironment: "local",
          repoRoot: root
        },
        redaction: {
          applied: true,
          strategyVersion: "1.0.0",
          categories: ["github-token"]
        },
        components: []
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(join(runRoot, "summary.md"), `# ${runId}\n`, "utf8");
}

function writeBenchmarkLedgerFixture(
  root: string,
  entries: unknown[]
): void {
  writeFileSync(
    join(root, ".agentops", "benchmark-ledger.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        entries
      },
      null,
      2
    ),
    "utf8"
  );
}

describe("visualizer data loading", () => {
  it("loads valid bundles, filters runs, and skips malformed bundles", () => {
    const root = createWorkspace();
    writeBundleFixture(root, "run-planning", [cloneFixture(schemaFixtures.planningArtifact)], {
      workflow: "planning-discovery",
      configuration: {
        selectedControls: {
          profile: "default",
          policyPreset: "strict-readonly",
          workflowVariant: "standard",
          agentBindings: {
            planning: "planning-analyst"
          }
        },
        sourceRefs: [".agentops/requests/planning.yaml"],
        fingerprints: [{ path: ".agentops/requests/planning.yaml", sha256: "abc123" }],
        effective: {
          workflow: "planning-discovery",
          policyFingerprint: "policy123",
          nodeAgents: {
            intake: "planning-intake",
            discovery: "context-collector",
            planning: "planning-analyst"
          },
          disabledNodes: [],
          toolEffects: {
            "filesystem.read-file": "allow"
          }
        },
        request: {
          path: ".agentops/requests/planning.yaml",
          metaPresent: true
        },
        execution: {
          executedNodes: [
            { nodeId: "intake", kind: "deterministic", agent: "planning-intake" },
            { nodeId: "discovery", kind: "deterministic", agent: "context-collector" },
            { nodeId: "planning", kind: "reasoning", agent: "planning-analyst" }
          ]
        }
      }
    });
    writeBundleFixture(root, "run-release", [cloneFixture(schemaFixtures.releaseArtifact)], {
      workflow: "release-readiness",
      status: "partial"
    });
    const invalidRunRoot = join(root, ".agentops", "runs", "run-invalid");
    mkdirSync(invalidRunRoot, { recursive: true });
    writeFileSync(join(invalidRunRoot, "bundle.json"), "{not-json", "utf8");
    writeFileSync(join(invalidRunRoot, "summary.md"), "# invalid\n", "utf8");

    const view = loadRunsIndexView(root, undefined, { workflow: "release-readiness" });

    expect(view.runs).toHaveLength(1);
    expect(view.runs[0]?.runId).toBe("run-release");
    expect(view.invalidRuns).toHaveLength(1);
    expect(view.invalidRuns[0]?.runId).toBe("run-invalid");
    expect(listAvailableWorkflows(loadRunsIndexView(root).runs)).toEqual(["planning-discovery", "release-readiness"]);
    expect(listAvailableStatuses(loadRunsIndexView(root).runs)).toEqual(["partial", "success"]);
    expect(listAvailableArtifactKinds(loadRunsIndexView(root).runs)).toEqual(["planning-brief", "release-report"]);
  });

  it("surfaces resolved configuration snapshots and compare views", () => {
    const root = createWorkspace();
    writeBundleFixture(root, "run-left", [cloneFixture(schemaFixtures.planningArtifact)], {
      workflow: "planning-discovery",
      configuration: {
        selectedControls: {
          profile: "default",
          policyPreset: "default",
          workflowVariant: "standard",
          agentBindings: {}
        },
        sourceRefs: [".agentops/requests/planning.yaml"],
        fingerprints: [{ path: ".agentops/requests/planning.yaml", sha256: "aaa" }],
        effective: {
          workflow: "planning-discovery",
          policyFingerprint: "policy-left",
          nodeAgents: { planning: "planning-analyst" },
          disabledNodes: [],
          toolEffects: {}
        },
        request: { path: ".agentops/requests/planning.yaml", metaPresent: false },
        execution: { executedNodes: [{ nodeId: "planning", kind: "reasoning", agent: "planning-analyst" }] }
      }
    });
    writeBundleFixture(root, "run-right", [cloneFixture(schemaFixtures.planningArtifact)], {
      workflow: "planning-discovery",
      entries: [{ id: "run-right-planning", nodeId: "planning", nodeName: "planning-analyst", kind: "reasoning", status: "success", summary: "done", blockedActions: ["blocked"] }],
      configuration: {
        selectedControls: {
          profile: "default",
          policyPreset: "strict-readonly",
          workflowVariant: "standard",
          agentBindings: {
            planning: "planning-analyst"
          }
        },
        sourceRefs: [".agentops/requests/planning.yaml"],
        fingerprints: [{ path: ".agentops/requests/planning.yaml", sha256: "bbb" }],
        effective: {
          workflow: "planning-discovery",
          policyFingerprint: "policy-right",
          nodeAgents: { planning: "planning-analyst" },
          disabledNodes: [],
          toolEffects: {}
        },
        request: { path: ".agentops/requests/planning.yaml", metaPresent: true },
        execution: { executedNodes: [{ nodeId: "planning", kind: "reasoning", agent: "planning-analyst" }] }
      }
    });

    const detail = loadRunDetailView(root, "run-right");
    const comparison = loadRunComparisonView(root, "run-left", "run-right");
    const outcomes = loadOutcomesDashboardView(root);

    expect(detail?.configuration?.policyPreset).toBe("strict-readonly");
    expect(detail?.configuration?.executedNodes[0]?.nodeId).toBe("planning");
    expect(comparison?.controlChanges.some((change) => change.field === "policyPreset")).toBe(true);
    expect(outcomes.configurationHotspots.some((hotspot) => hotspot.dimension === "policyPreset" && hotspot.value === "strict-readonly")).toBe(true);
    expect(renderRunComparePage(comparison, "run-left", "run-right")).toContain("Input And Control Changes");
    expect(renderOutcomesDashboardPage(outcomes)).toContain("Configuration Hotspots");
    expect(renderRunDetailPage(detail!)).toContain("Resolved Configuration");
  });

  it("renders known artifact details and benchmark summaries", () => {
    const root = createWorkspace();
    writeBundleFixture(root, "run-benchmark", [cloneFixture(schemaFixtures.benchmarkArtifact)], {
      workflow: "eval:compare"
    });
    writeBundleFixture(root, "run-100", [cloneFixture(schemaFixtures.evalArtifact)], {
      workflow: "eval:run"
    });
    writeBundleFixture(root, "run-101", [cloneFixture(schemaFixtures.evalArtifact)], {
      workflow: "eval:run",
      status: "failed"
    });

    const runDetail = loadRunDetailView(root, "run-benchmark");
    const benchmarks = loadBenchmarkIndexView(root);

    expect(runDetail).toBeDefined();
    expect(runDetail?.artifacts[0]?.artifactKind).toBe("benchmark-summary");
    expect(runDetail?.artifacts[0]?.sections.some((section) => section.heading === "Compared Runs")).toBe(true);
    expect(benchmarks.benchmarks).toHaveLength(1);
    expect(benchmarks.benchmarks[0]?.baselineRunId).toBe("run-100");
    expect(benchmarks.benchmarks[0]?.comparedRuns[0]?.hasLocalRunLink).toBe(true);
  });

  it("renders measured usage and estimated cost on the run detail page", () => {
    const root = createWorkspace();
    writeBundleFixture(root, "run-release", [cloneFixture(schemaFixtures.releaseArtifact)], {
      workflow: "release-readiness",
      usage: {
        totalInputTokens: 1200,
        totalOutputTokens: 400,
        totalTokens: 1600,
        totalRequests: 2,
        totalEstimatedCostUsd: 0.009,
        costStatus: "estimated",
        byModel: [
          {
            provider: "openai",
            model: "gpt-5.4",
            inputTokens: 1200,
            outputTokens: 400,
            totalTokens: 1600,
            requestCount: 2,
            estimatedCostUsd: 0.009,
            costStatus: "estimated",
            pricing: {
              source: "local_registry",
              version: "openai-api-pricing-2026-03-24",
              effectiveDate: "2026-03-24",
              currency: "USD",
              inputCostPerMillionTokensUsd: 2.5,
              outputCostPerMillionTokensUsd: 15
            }
          }
        ],
        byNode: [
          {
            nodeId: "release",
            nodeName: "release-analyst",
            kind: "reasoning",
            totalInputTokens: 1200,
            totalOutputTokens: 400,
            totalTokens: 1600,
            totalRequests: 2,
            totalEstimatedCostUsd: 0.009,
            costStatus: "estimated",
            byModel: [
              {
                provider: "openai",
                model: "gpt-5.4",
                inputTokens: 1200,
                outputTokens: 400,
                totalTokens: 1600,
                requestCount: 2,
                estimatedCostUsd: 0.009,
                costStatus: "estimated",
                pricing: {
                  source: "local_registry",
                  version: "openai-api-pricing-2026-03-24",
                  effectiveDate: "2026-03-24",
                  currency: "USD",
                  inputCostPerMillionTokensUsd: 2.5,
                  outputCostPerMillionTokensUsd: 15
                }
              }
            ]
          }
        ]
      }
    });

    const runDetail = loadRunDetailView(root, "run-release");
    const html = renderRunDetailPage(runDetail!);

    expect(runDetail?.usage?.totalTokens).toBe(1600);
    expect(html).toContain("Usage Summary");
    expect(html).toContain("Measured total tokens");
    expect(html).toContain("openai/gpt-5.4");
    expect(html).toContain("estimated from the local pricing table");
  });

  it("loads benchmark ledger overlays and derives outcomes dashboard summaries", () => {
    const root = createWorkspace();
    writeBundleFixture(root, "run-promotion", [cloneFixture(schemaFixtures.promotionApprovalArtifact)], {
      workflow: "promotion-approval",
      usage: {
        totalInputTokens: 1500,
        totalOutputTokens: 500,
        totalTokens: 2000,
        totalRequests: 4,
        totalEstimatedCostUsd: 0.3,
        costStatus: "estimated",
        byModel: [
          {
            provider: "openai",
            model: "gpt-5.4",
            inputTokens: 1500,
            outputTokens: 500,
            totalTokens: 2000,
            requestCount: 4,
            estimatedCostUsd: 0.3,
            costStatus: "estimated",
            pricing: {
              source: "local_registry",
              version: "openai-api-pricing-2026-03-24",
              effectiveDate: "2026-03-24",
              currency: "USD",
              inputCostPerMillionTokensUsd: 2.5,
              outputCostPerMillionTokensUsd: 15
            }
          }
        ],
        byNode: [
          {
            nodeId: "promotion",
            nodeName: "promotion-approval",
            kind: "reasoning",
            totalInputTokens: 1500,
            totalOutputTokens: 500,
            totalTokens: 2000,
            totalRequests: 4,
            totalEstimatedCostUsd: 0.3,
            costStatus: "estimated",
            byModel: [
              {
                provider: "openai",
                model: "gpt-5.4",
                inputTokens: 1500,
                outputTokens: 500,
                totalTokens: 2000,
                requestCount: 4,
                estimatedCostUsd: 0.3,
                costStatus: "estimated",
                pricing: {
                  source: "local_registry",
                  version: "openai-api-pricing-2026-03-24",
                  effectiveDate: "2026-03-24",
                  currency: "USD",
                  inputCostPerMillionTokensUsd: 2.5,
                  outputCostPerMillionTokensUsd: 15
                }
              }
            ]
          }
        ]
      }
    });
    writeBundleFixture(root, "run-release", [cloneFixture(schemaFixtures.releaseArtifact)], {
      workflow: "release-readiness"
    });
    writeBenchmarkLedgerFixture(root, [
      {
        taskId: "task-1",
        benchmarkCategory: "release",
        source: "live",
        taskType: "release/deployment",
        arm: "control",
        workflow: "release-readiness",
        startedAt: "2026-03-23T07:55:00.000Z",
        finishedAt: "2026-03-23T08:00:00.000Z",
        cycleTimeSeconds: 300,
        releaseDecision: "go",
        decisionClarity: "mixed",
        finalRecommendationSummary: "Proceed with the release candidate under the default review path.",
        tokenUsage: {
          provider: "openai",
          model: "gpt-5.4",
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          requestCount: 0,
          estimatedCostUsd: null,
          costStatus: "unavailable"
        },
        confirmedRisks: { high: 0, medium: 0, low: 0, noisy: 0, unresolved: 0 },
        evidence: { present: ["release-report"], missing: [], partial: [] },
        friction: { override: false, falsePositivePatterns: [], manualSteps: [], requestFriction: [] },
        notes: []
      },
      {
        taskId: "task-1",
        benchmarkCategory: "release",
        source: "live",
        taskType: "release/deployment",
        arm: "agentforge",
        runId: "run-promotion",
        workflow: "promotion-approval",
        decisionOutcome: "blocked_approval",
        agentforgeChangedDecision: true,
        startedAt: "2026-03-23T08:00:00.000Z",
        finishedAt: "2026-03-23T08:04:00.000Z",
        cycleTimeSeconds: 240,
        releaseDecision: "no-go",
        decisionClarity: "clear",
        finalRecommendationSummary: "Do not promote until the downstream deployment gate is unblocked.",
        rerunCount: 1,
        blockedStateCount: 2,
        tokenUsage: {
          provider: "openai",
          model: "gpt-5.4",
          inputTokens: 1500,
          outputTokens: 500,
          totalTokens: 2000,
          requestCount: 4,
          estimatedCostUsd: 0.3,
          costStatus: "estimated",
          pricingVersion: "openai-api-pricing-2026-03-24",
          pricingEffectiveDate: "2026-03-24"
        },
        confirmedRisks: { high: 1, medium: 1, low: 0, noisy: 1, unresolved: 2 },
        evidence: { present: ["release-report"], missing: ["deployment-gate-report"], partial: ["ci-evidence"] },
        friction: {
          override: true,
          overrideReason: "Proceed for operator review only.",
          falsePositivePatterns: ["manual approval requirement repeated"],
          manualSteps: ["write planning request"],
          requestFriction: ["tiny ops task still required request authoring"]
        },
        notes: ["Promotion gate forced a decision change."]
      }
    ]);

    const ledger = loadBenchmarkLedgerView(root);
    const detail = loadRunDetailView(root, "run-promotion");
    const outcomes = loadOutcomesDashboardView(root);

    expect(ledger.entries).toHaveLength(2);
    expect(detail?.decisionImpact.kind).toBe("blocked_approval");
    expect(detail?.decisionImpact.source).toBe("ledger");
    expect(detail?.decisionImpact.reason.source).toBe("ledger");
    expect(detail?.evidenceCompleteness[0]?.categories.some((category) => category.key === "deployment-gate-report")).toBe(true);
    expect(outcomes.decisionImpact.changedDecisionCount).toBeGreaterThan(0);
    expect(outcomes.risk.confirmedHighCount).toBe(1);
    expect(outcomes.releaseBenchmark.available).toBe(true);
    expect(outcomes.releaseBenchmark.comparablePairs).toBe(1);
    expect(outcomes.releaseBenchmark.arms.find((arm) => arm.arm === "agentforge")?.totalTokens).toBe(2000);
    expect(outcomes.releaseBenchmark.arms.find((arm) => arm.arm === "agentforge")?.measuredTokenEntryCount).toBe(1);
    expect(outcomes.releaseBenchmark.arms.find((arm) => arm.arm === "control")?.totalTokens).toBe(0);
    expect(outcomes.summaries.releaseBenchmark).toHaveLength(4);
    expect(outcomes.friction.overrideCount).toBe(1);
    expect(outcomes.workflowChains.some((stage) => stage.stage === "promotion")).toBe(true);
    expect(outcomes.details.friction[0]?.source).toBe("ledger");
    expect(outcomes.details.releaseBenchmark[0]?.source).toContain("ledger");
    expect(detail?.usage?.totalTokens).toBe(2000);
  });

  it("dedupes blocked approval leadership metrics across one release chain and preserves practitioner rows", () => {
    const root = createWorkspace();
    const releaseArtifact = cloneFixture(schemaFixtures.releaseArtifact);
    const pipelineArtifact: any = cloneFixture(schemaFixtures.pipelineArtifact);
    const deploymentArtifact: any = cloneFixture(schemaFixtures.deploymentGateArtifact);
    const promotionArtifact: any = cloneFixture(schemaFixtures.promotionApprovalArtifact);

    pipelineArtifact.payload.reviewStatus = "blocked";
    pipelineArtifact.payload.blockers = ["Imported CI evidence still reports failing checks: CI / lint."];
    pipelineArtifact.source.inputRefs = [".agentops/runs/run-release/bundle.json"];
    deploymentArtifact.payload.gateStatus = "blocked";
    deploymentArtifact.payload.blockers = [
      "Pipeline report /private/tmp/agentforge-benchmark2/.agentops/runs/run-pipeline/bundle.json is blocked and cannot satisfy a deployment gate yet."
    ];
    deploymentArtifact.source.inputRefs = [
      ".agentops/runs/run-release/bundle.json",
      ".agentops/runs/run-pipeline/bundle.json"
    ];
    promotionArtifact.payload.approvalStatus = "blocked";
    promotionArtifact.payload.blockers = [
      "Deployment gate report /private/tmp/agentforge-benchmark2/.agentops/runs/run-deployment/bundle.json is blocked and cannot satisfy promotion approval yet."
    ];
    promotionArtifact.source.inputRefs = [
      ".agentops/runs/run-release/bundle.json",
      ".agentops/runs/run-deployment/bundle.json"
    ];

    writeBundleFixture(root, "run-release", [releaseArtifact], {
      workflow: "release-readiness"
    });
    writeBundleFixture(root, "run-pipeline", [pipelineArtifact], {
      workflow: "pipeline-evidence-review"
    });
    writeBundleFixture(root, "run-deployment", [deploymentArtifact], {
      workflow: "deployment-gate-review"
    });
    writeBundleFixture(root, "run-promotion", [promotionArtifact], {
      workflow: "promotion-approval"
    });

    const outcomes = loadOutcomesDashboardView(root);

    expect(outcomes.decisionImpact.blockedApprovalCount).toBe(1);
    expect(outcomes.risk.blockedApprovalPreventedCount).toBe(1);
    expect(outcomes.details.decision.filter((row) => row.title === "blocked approval")).toHaveLength(3);
  });

  it("explains deployment and promotion blocking in terms of the upstream release chain stage", () => {
    const root = createWorkspace();
    const releaseArtifact = cloneFixture(schemaFixtures.releaseArtifact);
    const pipelineArtifact: any = cloneFixture(schemaFixtures.pipelineArtifact);
    const deploymentArtifact: any = cloneFixture(schemaFixtures.deploymentGateArtifact);
    const promotionArtifact: any = cloneFixture(schemaFixtures.promotionApprovalArtifact);

    pipelineArtifact.payload.reviewStatus = "blocked";
    pipelineArtifact.payload.blockers = ["Imported CI evidence still reports failing checks: CI / lint."];
    pipelineArtifact.source.inputRefs = [".agentops/runs/run-release/bundle.json"];
    deploymentArtifact.payload.gateStatus = "blocked";
    deploymentArtifact.payload.blockers = [
      "Pipeline report /private/tmp/agentforge-benchmark2/.agentops/runs/run-pipeline/bundle.json is blocked and cannot satisfy a deployment gate yet."
    ];
    deploymentArtifact.source.inputRefs = [
      ".agentops/runs/run-release/bundle.json",
      ".agentops/runs/run-pipeline/bundle.json"
    ];
    promotionArtifact.payload.approvalStatus = "blocked";
    promotionArtifact.payload.blockers = [
      "Deployment gate report /private/tmp/agentforge-benchmark2/.agentops/runs/run-deployment/bundle.json is blocked and cannot satisfy promotion approval yet."
    ];
    promotionArtifact.source.inputRefs = [
      ".agentops/runs/run-release/bundle.json",
      ".agentops/runs/run-deployment/bundle.json"
    ];

    writeBundleFixture(root, "run-release", [releaseArtifact], {
      workflow: "release-readiness"
    });
    writeBundleFixture(root, "run-pipeline", [pipelineArtifact], {
      workflow: "pipeline-evidence-review"
    });
    writeBundleFixture(root, "run-deployment", [deploymentArtifact], {
      workflow: "deployment-gate-review"
    });
    writeBundleFixture(root, "run-promotion", [promotionArtifact], {
      workflow: "promotion-approval"
    });

    const deployment = loadRunDetailView(root, "run-deployment");
    const promotion = loadRunDetailView(root, "run-promotion");

    expect(deployment?.decisionImpact.reason.summary).toContain("depends on a blocked pipeline report in the same release chain");
    expect(deployment?.decisionImpact.traceRefs.some((trace) => trace.runId === "run-pipeline")).toBe(true);
    expect(promotion?.decisionImpact.reason.summary).toContain("depends on a blocked deployment gate report in the same release chain");
    expect(promotion?.decisionImpact.traceRefs.some((trace) => trace.runId === "run-deployment")).toBe(true);
  });

  it("falls back to a generic artifact panel for unknown artifact kinds", () => {
    const root = createWorkspace();
    writeBundleFixture(root, "run-unknown", [
      {
        schemaVersion: "1.0.0",
        artifactKind: "custom-artifact",
        lifecycleDomain: "custom",
        workflow: {
          name: "custom-workflow",
          displayName: "Custom Workflow"
        },
        status: "complete",
        generatedAt: "2026-03-23T08:00:10.000Z",
        repo: {
          root,
          name: "AgentForge",
          branch: "main"
        },
        provenance: {
          generatedBy: "custom-runtime"
        },
        redaction: {
          applied: true,
          strategyVersion: "1.0.0",
          categories: []
        },
        auditLink: {
          bundlePath: ".agentops/runs/run-unknown/bundle.json",
          entryIds: []
        },
        source: {
          sourceType: "workflow-run",
          runId: "run-unknown",
          inputRefs: [],
          issueRefs: []
        },
        summary: "Custom artifact for forward-compatibility testing.",
        payload: {
          note: "unknown"
        }
      }
    ]);

    const runDetail = loadRunDetailView(root, "run-unknown");

    expect(runDetail).toBeDefined();
    expect(runDetail?.invalidArtifactCount).toBe(1);
    expect(runDetail?.artifacts[0]?.isKnownArtifact).toBe(false);
    expect(runDetail?.artifacts[0]?.rawPayload).toContain("\"note\": \"unknown\"");
  });
});

describe("visualizer html rendering", () => {
  it("renders runs, run detail, benchmarks, and outcomes pages", () => {
    const root = createWorkspace();
    writeBundleFixture(root, "run-qa", [cloneFixture(schemaFixtures.qaArtifact)], {
      workflow: "qa-review",
      entries: [
        {
          id: "entry-1",
          nodeId: "qa",
          nodeName: "qa-analyst",
          kind: "reasoning",
          status: "success",
          summary: "QA review completed."
        }
      ]
    });
    writeBundleFixture(root, "run-benchmark", [cloneFixture(schemaFixtures.benchmarkArtifact)], {
      workflow: "eval:compare"
    });

    const runsView = loadRunsIndexView(root);
    const runDetail = loadRunDetailView(root, "run-qa");
    const benchmarks = loadBenchmarkIndexView(root);
    const outcomes = loadOutcomesDashboardView(root);

    const runsHtml = renderRunsIndexPage(runsView.runs, runsView.invalidRuns, {}, {
      workflows: listAvailableWorkflows(runsView.runs),
      statuses: listAvailableStatuses(runsView.runs),
      artifactKinds: listAvailableArtifactKinds(runsView.runs),
      decisionImpacts: [...new Set(runsView.runs.flatMap((run) => (run.decisionImpactKind ? [run.decisionImpactKind] : [])))].sort(),
      riskKinds: [...new Set(runsView.runs.flatMap((run) => run.riskKinds))].sort(),
      evidenceCategories: [...new Set(runsView.runs.flatMap((run) => run.evidenceStatuses.map((status) => status.category)))].sort(),
      workflowStages: [...new Set(runsView.runs.flatMap((run) => (run.workflowStage ? [run.workflowStage] : [])))].sort()
    });
    const detailHtml = renderRunDetailPage(runDetail!);
    const benchmarkHtml = renderBenchmarksPage(benchmarks);
    const outcomesHtml = renderOutcomesDashboardPage(outcomes);

    expect(runsHtml).toContain("AgentForge Visualizer");
    expect(runsHtml).toContain("run-qa");
    expect(runsHtml).toContain("Outcomes");
    expect(runsHtml).toContain("Practitioner drill-down");
    expect(runsHtml).toContain("action=\"/runs\"");
    expect(runsHtml).toContain("decisionImpact");
    expect(detailHtml).toContain("Lifecycle Artifacts");
    expect(detailHtml).toContain("qa-report");
    expect(detailHtml).toContain("bundle.json");
    expect(detailHtml).toContain("Decision Impact");
    expect(detailHtml).toContain("Workflow Chain");
    expect(detailHtml).toContain("Back to Outcomes");
    expect(detailHtml).toContain("Why this outcome?");
    expect(detailHtml).toContain("id=\"decision-impact\"");
    expect(detailHtml).toContain("id=\"workflow-chain\"");
    expect(benchmarkHtml).toContain("Benchmark Dashboard");
    expect(benchmarkHtml).toContain("Deterministic eval evidence only");
    expect(benchmarkHtml).toContain("Detected 1 deterministic regression");
    expect(outcomesHtml).toContain("Decision Outcomes");
    expect(outcomesHtml).toContain("Start here after your first run");
    expect(outcomesHtml).toContain("Release Benchmark");
    expect(outcomesHtml).toContain("Evidence Hygiene");
    expect(outcomesHtml).toContain("Workflow Chain Coverage");
    expect(outcomesHtml).toContain("/runs?decisionImpact=");
    expect(outcomesHtml).toContain("/api/outcomes/export.json");
    expect(outcomesHtml).toContain("metric-provenance");
  });

  it("serves outcomes as the canonical route, redirects root, and keeps value as an alias", async () => {
    const root = createWorkspace();
    writeBundleFixture(root, "run-release", [cloneFixture(schemaFixtures.releaseArtifact)], {
      workflow: "release-readiness"
    });

    const server = createVisualizerServer({ workspaceRoot: root });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const serverUrl = `http://127.0.0.1:${port}`;
    try {
      const rootResponse = await fetch(`${serverUrl}/`, { redirect: "manual" });
      const outcomesResponse = await fetch(`${serverUrl}/outcomes`);
      const outcomesHtml = await outcomesResponse.text();

      const valueResponse = await fetch(`${serverUrl}/value`, { redirect: "manual" });
      const apiOutcomes = await fetch(`${serverUrl}/api/outcomes`);
      const apiValue = await fetch(`${serverUrl}/api/value`);
      const exportJson = await fetch(`${serverUrl}/api/outcomes/export.json`);
      const exportMarkdown = await fetch(`${serverUrl}/outcomes/export.md`);

      expect(rootResponse.status).toBe(302);
      expect(rootResponse.headers.get("location")).toBe("/outcomes");
      expect(outcomesResponse.status).toBe(200);
      expect(outcomesHtml).toContain("Outcomes");
      expect(valueResponse.status).toBe(302);
      expect(valueResponse.headers.get("location")).toBe("/outcomes");
      expect(await apiOutcomes.text()).toBe(await apiValue.text());
      expect(exportJson.status).toBe(200);
      expect(await exportJson.text()).toContain("\"schemaVersion\"");
      expect(exportMarkdown.status).toBe(200);
      expect(await exportMarkdown.text()).toContain("# AgentForge Outcomes Export");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  it("keeps configure read-only when no editor hooks are wired and only saves through injected editor hooks", async () => {
    const root = createWorkspace();
    mkdirSync(join(root, ".agentops", "workflows"), { recursive: true });
    mkdirSync(join(root, ".agentops", "requests"), { recursive: true });
    mkdirSync(join(root, ".agentops", "control"), { recursive: true });
    writeFileSync(join(root, ".agentops", "workflows", "planning-discovery.yaml"), "version: 1\nname: planning-discovery\ntrigger: manual\nnodes: []\n");
    writeFileSync(join(root, ".agentops", "requests", "planning.yaml"), "problemStatement: Test request\n");
    writeFileSync(join(root, ".agentops", "control", "planning-discovery.yaml"), "version: 1\nworkflow: planning-discovery\nprofiles:\n  default:\n    requestPatch: {}\n");
    writeFileSync(join(root, ".agentops", "control", "policy-presets.yaml"), "version: 1\npresets:\n  default:\n    description: Base\n");
    writeFileSync(join(root, ".agentops", "control", "defaults.yaml"), "version: 1\nworkflows:\n  planning-discovery:\n    profile: default\n");
    writeBundleFixture(root, "run-left", [cloneFixture(schemaFixtures.planningArtifact)], { workflow: "planning-discovery" });
    writeBundleFixture(root, "run-right", [cloneFixture(schemaFixtures.planningArtifact)], { workflow: "planning-discovery" });

    const disabledServer = createVisualizerServer({ workspaceRoot: root });
    await new Promise<void>((resolve) => {
      disabledServer.listen(0, "127.0.0.1", () => resolve());
    });
    const disabledAddress = disabledServer.address();
    const disabledPort = typeof disabledAddress === "object" && disabledAddress ? disabledAddress.port : 0;
    const disabledServerUrl = `http://127.0.0.1:${disabledPort}`;

    try {
      const configurePage = await fetch(`${disabledServerUrl}/configure?workflow=planning-discovery&target=request`);
      const editorModel = await fetch(`${disabledServerUrl}/api/config/editor?workflow=planning-discovery&target=request`);
      const preview = await fetch(`${disabledServerUrl}/api/config/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflow: "planning-discovery",
          target: "request",
          draft: "problemStatement: Updated request\n"
        })
      });
      const save = await fetch(`${disabledServerUrl}/api/config/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflow: "planning-discovery",
          target: "request",
          draft: "problemStatement: Updated request\n",
          previewHash: "ignored",
          approval: "approve-write"
        })
      });

      expect(configurePage.status).toBe(200);
      expect(await configurePage.text()).toContain("Structured Editor");
      expect(editorModel.status).toBe(501);
      expect(await fetch(`${disabledServerUrl}/runs`).then((response) => response.text())).toContain("Practitioner drill-down");
      expect(preview.status).toBe(403);
      expect(save.status).toBe(403);
    } finally {
      await new Promise<void>((resolve, reject) => {
        disabledServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    const server = createVisualizerServer({
      workspaceRoot: root,
      configEditor: {
        editingEnabled: true,
        loadEditorModel: ({ workflow, target }) => ({
          workflow,
          target: target as "request",
          path: join(root, ".agentops", "requests", "planning.yaml"),
          relativePath: ".agentops/requests/planning.yaml",
          editingEnabled: true,
          rawDocument: "problemStatement: Test request\n",
          title: "Workflow Request",
          intro: "Set request fields and execution selectors without hand-authoring YAML.",
          nextStep: "Preview the effective run summary before saving the canonical YAML.",
          request: {
            selectedProfile: "default",
            selectedPolicyPreset: "",
            selectedWorkflowVariant: "standard",
            profileOptions: [{ label: "Default", value: "default" }],
            policyPresetOptions: [{ label: "Strict Readonly", value: "strict-readonly" }],
            workflowVariantOptions: [{ label: "Standard", value: "standard" }],
            profileRules: [{ profile: "default", allowedPolicyPresets: ["strict-readonly"], allowedWorkflowVariants: ["standard"] }],
            fields: [
              {
                key: "problemStatement",
                label: "Problem Statement",
                input: "textarea",
                required: true,
                value: "Test request"
              },
              {
                key: "goals",
                label: "Goals",
                input: "string-array",
                required: true,
                value: ["Produce a plan"]
              }
            ],
            agentBindings: [
              {
                key: "planning",
                label: "Planning",
                nodeIds: ["planning"],
                selectedAgent: "planning-analyst",
                options: [{ label: "Planning Analyst", value: "planning-analyst" }]
              }
            ]
          }
        }),
        renderDocument: ({ workflow, target, state }) => {
          const requestState = state as {
            meta?: { profile?: string; policyPreset?: string; workflowVariant?: string; agentBindings?: Record<string, string> };
            fields?: Array<{ key: string; value: unknown }>;
          };
          const problemStatement = requestState.fields?.find((field) => field.key === "problemStatement")?.value;
          return {
            path: `.agentops/requests/${workflow === "planning-discovery" && target === "request" ? "planning" : "unknown"}.yaml`,
            draft: [
              "meta:",
              `  profile: ${requestState.meta?.profile ?? "default"}`,
              `  policyPreset: ${requestState.meta?.policyPreset ?? "strict-readonly"}`,
              `  workflowVariant: ${requestState.meta?.workflowVariant ?? "standard"}`,
              "problemStatement: " + String(problemStatement ?? "Test request")
            ].join("\n")
          };
        },
        previewDocument: ({ workflow, target, draft }) => ({
          path: `.agentops/requests/${workflow === "planning-discovery" && target === "request" ? "planning" : "unknown"}.yaml`,
          previewHash: "preview-hash",
          diff: `+ ${draft.trim()}`,
          summary: "Preview ready.",
          semantic: {
            workflow,
            selectedProfile: "default",
            selectedPolicyPreset: "default",
            selectedWorkflowVariant: "standard",
            selectedAgentBindings: {},
            nodeAgents: { planning: "planning-analyst" },
            disabledNodes: [],
            policySummary: {
              executionMode: "inspect",
              modelAccess: false,
              network: "deny",
              writes: "deny",
              deniedTools: ["filesystem.write-file"],
              approvalTools: []
            }
          },
          validation: {
            valid: true,
            errors: []
          }
        }),
        saveDocument: ({ draft }) => {
          writeFileSync(join(root, ".agentops", "requests", "planning.yaml"), draft, "utf8");
          return {
            path: ".agentops/requests/planning.yaml",
            validation: {
              valid: true,
              errors: []
            }
          };
        }
      }
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const serverUrl = `http://127.0.0.1:${port}`;

    try {
      const configurePage = await fetch(`${serverUrl}/configure?workflow=planning-discovery&target=request`);
      const comparePage = await fetch(`${serverUrl}/runs/compare?left=run-left&right=run-right`);
      const current = await fetch(`${serverUrl}/api/config/current?workflow=planning-discovery&target=request`);
      const editorModel = await fetch(`${serverUrl}/api/config/editor?workflow=planning-discovery&target=request`);
      const render = await fetch(`${serverUrl}/api/config/render`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflow: "planning-discovery",
          target: "request",
          state: {
            meta: {
              profile: "default",
              policyPreset: "strict-readonly",
              workflowVariant: "standard",
              agentBindings: {
                planning: "planning-analyst"
              }
            },
            fields: [
              {
                key: "problemStatement",
                label: "Problem Statement",
                input: "textarea",
                required: true,
                value: "Updated request"
              },
              {
                key: "goals",
                label: "Goals",
                input: "string-array",
                required: true,
                value: ["Produce a plan"]
              }
            ]
          }
        })
      });
      const preview = await fetch(`${serverUrl}/api/config/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflow: "planning-discovery",
          target: "request",
          draft: (await render.clone().json() as { draft: string }).draft
        })
      });
      const previewJson = await preview.json() as { previewHash: string; diff: string };
      const save = await fetch(`${serverUrl}/api/config/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflow: "planning-discovery",
          target: "request",
          draft: (await render.json() as { draft: string }).draft,
          previewHash: previewJson.previewHash,
          approval: "approve-write"
        })
      });

      expect(configurePage.status).toBe(200);
      const configureHtml = await configurePage.text();
      expect(configureHtml).toContain("agentforge config validate");
      expect(configureHtml).toContain("Structured Editor");
      expect(configureHtml).toContain("View YAML (Advanced)");
      expect(comparePage.status).toBe(200);
      expect(await comparePage.text()).toContain("Secondary analysis step");
      expect(current.status).toBe(200);
      expect(await current.text()).toContain("Test request");
      expect(editorModel.status).toBe(200);
      expect(await editorModel.text()).toContain("\"target\": \"request\"");
      expect(render.status).toBe(200);
      expect(previewJson.diff).toContain("Updated request");
      expect(save.status).toBe(200);
      expect(readFileSync(join(root, ".agentops", "requests", "planning.yaml"), "utf8")).toContain("Updated request");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
