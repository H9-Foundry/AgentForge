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
  loadRunDetailView,
  loadRunsIndexView,
  loadValueDashboardView
} from "./data.js";
import { renderBenchmarksPage, renderRunDetailPage, renderRunsIndexPage, renderValueDashboardPage } from "./html.js";

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

  it("loads benchmark ledger overlays and derives value dashboard summaries", () => {
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
        source: "live",
        taskType: "release/deployment",
        arm: "control",
        workflow: "release-readiness",
        confirmedRisks: { high: 0, medium: 0, low: 0, noisy: 0, unresolved: 0 },
        evidence: { present: ["release-report"], missing: [], partial: [] },
        friction: { override: false, falsePositivePatterns: [], manualSteps: [], requestFriction: [] },
        notes: []
      },
      {
        taskId: "task-1",
        source: "live",
        taskType: "release/deployment",
        arm: "agentforge",
        runId: "run-promotion",
        workflow: "promotion-approval",
        decisionOutcome: "blocked_approval",
        agentforgeChangedDecision: true,
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
    const value = loadValueDashboardView(root);

    expect(ledger.entries).toHaveLength(2);
    expect(detail?.decisionImpact.kind).toBe("blocked_approval");
    expect(detail?.decisionImpact.source).toBe("ledger");
    expect(detail?.evidenceCompleteness[0]?.categories.some((category) => category.key === "deployment-gate-report")).toBe(true);
    expect(value.decisionImpact.changedDecisionCount).toBeGreaterThan(0);
    expect(value.risk.confirmedHighCount).toBe(1);
    expect(value.friction.overrideCount).toBe(1);
    expect(value.workflowChains.some((stage) => stage.stage === "promotion")).toBe(true);
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
  it("renders runs, run detail, and benchmarks pages", () => {
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
    const value = loadValueDashboardView(root);

    const runsHtml = renderRunsIndexPage(runsView.runs, runsView.invalidRuns, {}, {
      workflows: listAvailableWorkflows(runsView.runs),
      statuses: listAvailableStatuses(runsView.runs),
      artifactKinds: listAvailableArtifactKinds(runsView.runs)
    });
    const detailHtml = renderRunDetailPage(runDetail!);
    const benchmarkHtml = renderBenchmarksPage(benchmarks);
    const valueHtml = renderValueDashboardPage(value);

    expect(runsHtml).toContain("AgentForge Visualizer");
    expect(runsHtml).toContain("run-qa");
    expect(runsHtml).toContain("Value");
    expect(detailHtml).toContain("Lifecycle Artifacts");
    expect(detailHtml).toContain("qa-report");
    expect(detailHtml).toContain("bundle.json");
    expect(detailHtml).toContain("Decision Impact");
    expect(detailHtml).toContain("Workflow Chain");
    expect(benchmarkHtml).toContain("Benchmark Dashboard");
    expect(benchmarkHtml).toContain("Detected 1 deterministic regression");
    expect(valueHtml).toContain("Decision Impact");
    expect(valueHtml).toContain("Evidence Completeness");
    expect(valueHtml).toContain("Workflow Chain Coverage");
  });
});
