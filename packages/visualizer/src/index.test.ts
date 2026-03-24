import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
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
  loadRunDetailView,
  loadRunsIndexView
} from "./data.js";
import { renderBenchmarksPage, renderOutcomesDashboardPage, renderRunDetailPage, renderRunsIndexPage } from "./html.js";
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
        artifactPaths: {
          json: `.agentops/runs/${runId}/bundle.json`,
          markdown: `.agentops/runs/${runId}/summary.md`
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
      workflow: "planning-discovery"
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

  it("loads benchmark ledger overlays and derives outcomes dashboard summaries", () => {
    const root = createWorkspace();
    writeBundleFixture(root, "run-promotion", [cloneFixture(schemaFixtures.promotionApprovalArtifact)], {
      workflow: "promotion-approval"
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
          estimatedCostUsd: null
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
          estimatedCostUsd: 0.3
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
    expect(outcomes.releaseBenchmark.arms.find((arm) => arm.arm === "control")?.totalTokens).toBe(0);
    expect(outcomes.summaries.releaseBenchmark).toHaveLength(4);
    expect(outcomes.friction.overrideCount).toBe(1);
    expect(outcomes.workflowChains.some((stage) => stage.stage === "promotion")).toBe(true);
    expect(outcomes.details.friction[0]?.source).toBe("ledger");
    expect(outcomes.details.releaseBenchmark[0]?.source).toContain("ledger");
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
    expect(benchmarkHtml).toContain("Detected 1 deterministic regression");
    expect(outcomesHtml).toContain("Decision Outcomes");
    expect(outcomesHtml).toContain("Release Benchmark");
    expect(outcomesHtml).toContain("Evidence Hygiene");
    expect(outcomesHtml).toContain("Workflow Chain Coverage");
    expect(outcomesHtml).toContain("/runs?decisionImpact=");
  });

  it("serves outcomes as the canonical route and keeps value as an alias", async () => {
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
      const outcomesResponse = await fetch(`${serverUrl}/outcomes`);
      const outcomesHtml = await outcomesResponse.text();

      const valueResponse = await fetch(`${serverUrl}/value`, { redirect: "manual" });
      const apiOutcomes = await fetch(`${serverUrl}/api/outcomes`);
      const apiValue = await fetch(`${serverUrl}/api/value`);

      expect(outcomesResponse.status).toBe(200);
      expect(outcomesHtml).toContain("Outcomes");
      expect(valueResponse.status).toBe(302);
      expect(valueResponse.headers.get("location")).toBe("/outcomes");
      expect(await apiOutcomes.text()).toBe(await apiValue.text());
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
