import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { auditBundleSchema, benchmarkArtifactSchema, lifecycleArtifactSchema } from "@h9-foundry/agentforge-schemas";
import type {
  AuditBundle,
  AuditEntry,
  BenchmarkArtifact,
  BlockedPlugin,
  Finding,
  LifecycleArtifact
} from "@h9-foundry/agentforge-shared-types";

type RunStatus = AuditBundle["status"];

interface LooseArtifact {
  artifactKind?: string;
  lifecycleDomain?: string;
  workflow?: {
    name: string;
    displayName?: string;
  };
  status?: string;
  summary?: string;
  source?: {
    inputRefs?: string[];
    issueRefs?: string[];
  };
  provenance?: Record<string, unknown>;
  auditLink?: Record<string, unknown>;
  payload?: unknown;
}

interface LooseAuditBundle {
  runId: string;
  workflow: string;
  startedAt: string;
  finishedAt: string;
  status: RunStatus;
  lifecycleArtifacts: LooseArtifact[];
}

export interface RunListItemView {
  runId: string;
  workflow: string;
  startedAt: string;
  finishedAt: string;
  status: AuditBundle["status"];
  findings: number;
  blockedActions: number;
  blockedPlugins: number;
  artifactKinds: string[];
  bundlePath: string;
  summaryPath: string;
  hasBenchmarkSummary: boolean;
  invalidArtifactCount: number;
}

export interface InvalidRunView {
  runId: string;
  bundlePath: string;
  error: string;
}

export interface ArtifactSectionView {
  heading: string;
  lines: string[];
}

export interface ArtifactPanelView {
  id: string;
  artifactKind: string;
  lifecycleDomain: string;
  workflow: string;
  workflowDisplayName?: string;
  status: string;
  summary: string;
  sourceRefs: string[];
  issueRefs: string[];
  provenanceEntries: string[];
  auditEntries: string[];
  sections: ArtifactSectionView[];
  rawPayload: string;
  isKnownArtifact: boolean;
  parseError?: string;
}

export interface RunDetailView extends RunListItemView {
  entries: AuditEntry[];
  findingsList: Finding[];
  blockedPluginsList: BlockedPlugin[];
  artifacts: ArtifactPanelView[];
  summaryMarkdown: string;
  rawBundleJson: string;
  decisionImpact: DecisionImpactView;
  riskSummary: RiskSummaryView;
  evidenceCompleteness: EvidenceCompletenessView[];
  workflowChain: WorkflowChainView;
}

export interface BenchmarkComparedRunView {
  runId: string;
  bundlePath: string;
  specId?: string;
  workflow?: string;
  comparable: boolean;
  passed?: boolean;
  failureCount?: number;
  deterministicCheckCount: number;
  regressionCount: number;
  improvementCount: number;
  unchangedCount: number;
  nonComparableCount: number;
  hasLocalRunLink: boolean;
}

export interface BenchmarkSummaryView {
  runId: string;
  workflow: string;
  status: AuditBundle["status"];
  baselineRunId: string;
  baselineWorkflow?: string;
  baselineSpecId?: string;
  comparableRunCount: number;
  regressionCount: number;
  improvementCount: number;
  unchangedCount: number;
  nonComparableCount: number;
  summaryConclusion: string;
  comparedRuns: BenchmarkComparedRunView[];
  hasBaselineRunLink: boolean;
}

export interface RunsIndexView {
  runs: RunListItemView[];
  invalidRuns: InvalidRunView[];
}

export interface BenchmarkIndexView {
  benchmarks: BenchmarkSummaryView[];
  invalidRuns: InvalidRunView[];
}

export type DecisionOutcomeKind =
  | "scope_reduction"
  | "added_validation"
  | "blocked_approval"
  | "remediation_before_merge"
  | "added_confidence"
  | "no_meaningful_change";

export interface BenchmarkLedgerEntry {
  taskId: string;
  taskLink?: string;
  source: "replay" | "live";
  taskType: string;
  arm: "control" | "agentforge";
  runId?: string;
  workflow?: string;
  agent?: string;
  startedAt?: string;
  finishedAt?: string;
  decisionOutcome?: DecisionOutcomeKind;
  agentforgeChangedDecision?: boolean;
  confirmedRisks: {
    high: number;
    medium: number;
    low: number;
    noisy: number;
    unresolved: number;
  };
  evidence: {
    present: string[];
    missing: string[];
    partial: string[];
  };
  friction: {
    override: boolean;
    overrideReason?: string;
    falsePositivePatterns: string[];
    manualSteps: string[];
    requestFriction: string[];
  };
  notes: string[];
}

export interface BenchmarkLedgerView {
  path: string;
  entries: BenchmarkLedgerEntry[];
  errors: string[];
}

export interface DecisionImpactView {
  kind: DecisionOutcomeKind;
  changedDecision: boolean;
  source: "ledger" | "inferred";
  summary: string;
}

export interface RiskSummaryView {
  high: number;
  medium: number;
  low: number;
  noisy: number;
  unresolved: number;
  blockedApprovalPrevented: boolean;
  blockerCount: number;
  summary: string[];
}

export interface EvidenceCategoryView {
  key: string;
  label: string;
  status: "present" | "missing" | "partial";
  detail: string;
}

export interface EvidenceCompletenessView {
  workflow: string;
  categories: EvidenceCategoryView[];
}

export interface WorkflowChainStageView {
  stage: string;
  label: string;
  status: "present" | "missing" | "current";
  detail: string;
}

export interface WorkflowChainView {
  currentStage: string;
  stages: WorkflowChainStageView[];
}

export interface DecisionImpactSummaryView {
  changedDecisionCount: number;
  scopeReductionCount: number;
  addedValidationCount: number;
  blockedApprovalCount: number;
  remediationCount: number;
  addedConfidenceCount: number;
  noMeaningfulChangeCount: number;
  comparableBenchmarkPairs: number;
}

export interface RiskDashboardView {
  confirmedHighCount: number;
  confirmedMediumCount: number;
  noisyFindingCount: number;
  blockedApprovalPreventedCount: number;
  unresolvedRiskCount: number;
}

export interface WorkflowEvidenceSummaryRowView {
  workflow: string;
  runs: number;
  missingCount: number;
  partialCount: number;
  frequentMissing: string[];
}

export interface FrictionWorkflowView {
  workflow: string;
  overrideCount: number;
  falsePositiveCount: number;
  manualStepCount: number;
  requestFrictionCount: number;
}

export interface FrictionDashboardView {
  ledgerAvailable: boolean;
  overrideCount: number;
  falsePositiveCount: number;
  manualStepCount: number;
  requestFrictionCount: number;
  repeatedOverrideReasons: string[];
  noisyPatterns: string[];
  workflowHotspots: FrictionWorkflowView[];
}

export interface WorkflowChainSummaryView {
  stage: string;
  label: string;
  runCount: number;
  blockedCount: number;
  missingUpstreamEvidenceCount: number;
}

export interface ValueDashboardView {
  ledger: BenchmarkLedgerView;
  decisionImpact: DecisionImpactSummaryView;
  risk: RiskDashboardView;
  evidence: WorkflowEvidenceSummaryRowView[];
  friction: FrictionDashboardView;
  workflowChains: WorkflowChainSummaryView[];
  runCount: number;
}

export interface RunFilters {
  workflow?: string;
  status?: string;
  artifactKind?: string;
  search?: string;
}

interface LoadedRun {
  runId: string;
  runDir: string;
  bundlePath: string;
  summaryPath: string;
  rawBundle: LooseAuditBundle;
  bundle: AuditBundle | undefined;
  rawBundleJson: string;
  summaryMarkdown: string;
  artifactViews: ArtifactPanelView[];
  invalidArtifactCount: number;
}

function parseRunTimestampMs(value: unknown): number | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const compactDateTimeMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (compactDateTimeMatch) {
    const [, year, month, day, hour, minute, second] = compactDateTimeMatch;
    const isoCandidate = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    const parsedCompactDateTime = Date.parse(isoCandidate);
    if (!Number.isNaN(parsedCompactDateTime)) {
      return parsedCompactDateTime;
    }
  }

  const parsedDate = Date.parse(value);
  if (!Number.isNaN(parsedDate)) {
    return parsedDate;
  }

  const timestampPrefix = Number.parseInt(value.split("-")[0] ?? "", 10);
  return Number.isNaN(timestampPrefix) ? undefined : timestampPrefix;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}

function readLooseArtifact(value: unknown): LooseArtifact {
  if (!isRecord(value)) {
    return {};
  }

  const workflow = isRecord(value.workflow)
    ? {
        name: readString(value.workflow.name, "unknown"),
        displayName: typeof value.workflow.displayName === "string" ? value.workflow.displayName : undefined
      }
    : undefined;

  const source = isRecord(value.source)
    ? {
        inputRefs: readStringArray(value.source.inputRefs),
        issueRefs: readStringArray(value.source.issueRefs)
      }
    : undefined;

  return {
    artifactKind: typeof value.artifactKind === "string" ? value.artifactKind : undefined,
    lifecycleDomain: typeof value.lifecycleDomain === "string" ? value.lifecycleDomain : undefined,
    workflow,
    status: typeof value.status === "string" ? value.status : undefined,
    summary: typeof value.summary === "string" ? value.summary : undefined,
    source,
    provenance: isRecord(value.provenance) ? value.provenance : undefined,
    auditLink: isRecord(value.auditLink) ? value.auditLink : undefined,
    payload: value.payload
  };
}

function readLooseAuditBundle(value: unknown, runDir: string): LooseAuditBundle | InvalidRunView {
  if (!isRecord(value)) {
    return {
      runId: runDir,
      bundlePath: "",
      error: "Bundle root is not an object."
    };
  }

  const status = value.status;
  if (status !== "success" && status !== "partial" && status !== "failed") {
    return {
      runId: runDir,
      bundlePath: "",
      error: "Bundle status is missing or invalid."
    };
  }

  return {
    runId: readString(value.runId, runDir),
    workflow: readString(value.workflow, "unknown"),
    startedAt: readString(value.startedAt, runDir),
    finishedAt: readString(value.finishedAt, readString(value.startedAt, runDir)),
    status,
    lifecycleArtifacts: Array.isArray(value.lifecycleArtifacts) ? value.lifecycleArtifacts.map(readLooseArtifact) : []
  };
}

function stringifyUnknown(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatSourceRefs(artifact: { source?: { inputRefs?: string[] } }): string[] {
  return artifact.source?.inputRefs ?? [];
}

function formatIssueRefs(artifact: { source?: { issueRefs?: string[] } }): string[] {
  return artifact.source?.issueRefs ?? [];
}

function formatProvenanceEntries(artifact: { provenance?: Record<string, unknown> }): string[] {
  if (!artifact.provenance) {
    return [];
  }

  return Object.entries(artifact.provenance).map(([key, value]) => `${key}: ${typeof value === "string" ? value : stringifyUnknown(value)}`);
}

function formatAuditEntries(artifact: { auditLink?: Record<string, unknown> }): string[] {
  if (!artifact.auditLink) {
    return [];
  }

  return Object.entries(artifact.auditLink).map(([key, value]) => `${key}: ${typeof value === "string" ? value : stringifyUnknown(value)}`);
}

function formatVerificationChecks(
  checks: Array<{ name: string; status: string; detail?: string }>
): string[] {
  return checks.map((check) => `${check.name}: ${check.status}${check.detail ? ` (${check.detail})` : ""}`);
}

function formatCiEvidenceSummary(
  entries: Array<{ statusSummary: string; failingChecks: string[] }>
): string[] {
  return entries.flatMap((entry) =>
    entry.failingChecks.length > 0 ? [entry.statusSummary, `Failing checks: ${entry.failingChecks.join(", ")}`] : [entry.statusSummary]
  );
}

function toArtifactSections(artifact: LifecycleArtifact): ArtifactSectionView[] {
  switch (artifact.artifactKind) {
    case "planning-brief":
      return [
        { heading: "Objectives", lines: artifact.payload.objectives },
        { heading: "Recommended Next Steps", lines: artifact.payload.recommendedNextSteps },
        { heading: "Risks", lines: artifact.payload.risks ?? [] },
        { heading: "Open Questions", lines: artifact.payload.openQuestions ?? [] }
      ].filter((section) => section.lines.length > 0);
    case "qa-report":
      return [
        {
          heading: "Findings",
          lines: artifact.payload.findings.map((finding) => `[${finding.severity}] ${finding.title}: ${finding.summary}`)
        },
        { heading: "Coverage Gaps", lines: artifact.payload.coverageGaps },
        { heading: "Recommended Next Checks", lines: artifact.payload.recommendedNextChecks },
        { heading: "CI Evidence", lines: formatCiEvidenceSummary(artifact.payload.ciEvidenceSummary) },
        { heading: "Release Impact", lines: [artifact.payload.releaseImpact] }
      ].filter((section) => section.lines.length > 0);
    case "release-report":
      return [
        { heading: "Readiness Status", lines: [artifact.payload.readinessStatus] },
        { heading: "Verification Checks", lines: formatVerificationChecks(artifact.payload.verificationChecks) },
        { heading: "CI Evidence", lines: formatCiEvidenceSummary(artifact.payload.ciEvidenceSummary) },
        { heading: "Publishing Plan", lines: artifact.payload.publishingPlan },
        { heading: "Rollback Notes", lines: artifact.payload.rollbackNotes },
        { heading: "Trust Summary", lines: artifact.payload.trustSummary }
      ].filter((section) => section.lines.length > 0);
    case "pipeline-report":
      return [
        { heading: "Review Status", lines: [artifact.payload.reviewStatus] },
        { heading: "Verification Checks", lines: formatVerificationChecks(artifact.payload.verificationChecks) },
        { heading: "CI Evidence", lines: formatCiEvidenceSummary(artifact.payload.ciEvidenceSummary) },
        { heading: "Blockers", lines: artifact.payload.blockers },
        { heading: "Risk Summary", lines: artifact.payload.riskSummary },
        { heading: "Recommended Next Steps", lines: artifact.payload.recommendedNextSteps }
      ].filter((section) => section.lines.length > 0);
    case "deployment-gate-report":
      return [
        { heading: "Gate Status", lines: [artifact.payload.gateStatus] },
        { heading: "Verification Checks", lines: formatVerificationChecks(artifact.payload.verificationChecks) },
        { heading: "CI Evidence", lines: formatCiEvidenceSummary(artifact.payload.ciEvidenceSummary) },
        { heading: "Blockers", lines: artifact.payload.blockers },
        { heading: "Required Follow-Up Checks", lines: artifact.payload.requiredFollowUpChecks }
      ].filter((section) => section.lines.length > 0);
    case "promotion-approval-report":
      return [
        { heading: "Approval Status", lines: [artifact.payload.approvalStatus] },
        { heading: "Verification Checks", lines: formatVerificationChecks(artifact.payload.verificationChecks) },
        { heading: "CI Evidence", lines: formatCiEvidenceSummary(artifact.payload.ciEvidenceSummary) },
        { heading: "Required Approvals", lines: artifact.payload.requiredApprovals },
        { heading: "Recommended Next Steps", lines: artifact.payload.recommendedNextSteps }
      ].filter((section) => section.lines.length > 0);
    case "benchmark-summary":
      return [
        { heading: "Summary Conclusion", lines: [artifact.payload.summaryConclusion] },
        {
          heading: "Compared Runs",
          lines: artifact.payload.comparedRuns.map((run) =>
            `${run.runId}: regressions=${run.regressions.length}, improvements=${run.improvements.length}, unchanged=${run.unchangedCount}, non-comparable=${run.nonComparableFindings.length}`
          )
        }
      ].filter((section) => section.lines.length > 0);
    default:
      return [];
  }
}

function toKnownArtifactPanel(artifact: LifecycleArtifact): ArtifactPanelView {
  return {
    id: `${artifact.artifactKind}:${artifact.generatedAt}`,
    artifactKind: artifact.artifactKind,
    lifecycleDomain: artifact.lifecycleDomain,
    workflow: artifact.workflow.name,
    workflowDisplayName: artifact.workflow.displayName,
    status: artifact.status,
    summary: artifact.summary,
    sourceRefs: formatSourceRefs(artifact),
    issueRefs: formatIssueRefs(artifact),
    provenanceEntries: formatProvenanceEntries(artifact),
    auditEntries: formatAuditEntries(artifact),
    sections: toArtifactSections(artifact),
    rawPayload: stringifyUnknown(artifact.payload),
    isKnownArtifact: true
  };
}

function toUnknownArtifactPanel(rawArtifact: LooseArtifact, error: string): ArtifactPanelView {
  return {
    id: `${rawArtifact.artifactKind ?? "unknown"}:${rawArtifact.summary ?? "artifact"}`,
    artifactKind: rawArtifact.artifactKind ?? "unknown",
    lifecycleDomain: rawArtifact.lifecycleDomain ?? "unknown",
    workflow: rawArtifact.workflow?.name ?? "unknown",
    workflowDisplayName: rawArtifact.workflow?.displayName,
    status: rawArtifact.status ?? "unknown",
    summary: rawArtifact.summary ?? "Artifact could not be parsed with the current shared schema set.",
    sourceRefs: formatSourceRefs(rawArtifact),
    issueRefs: formatIssueRefs(rawArtifact),
    provenanceEntries: formatProvenanceEntries(rawArtifact),
    auditEntries: formatAuditEntries(rawArtifact),
    sections: [],
    rawPayload: stringifyUnknown(rawArtifact.payload ?? rawArtifact),
    isKnownArtifact: false,
    parseError: error
  };
}

function countBlockedActions(entries: readonly AuditEntry[]): number {
  return entries.reduce((total, entry) => total + entry.blockedActions.length, 0);
}

function loadRun(root: string, runsRoot: string, runDir: string): LoadedRun | InvalidRunView {
  const bundlePath = join(runsRoot, runDir, "bundle.json");
  const summaryPath = join(runsRoot, runDir, "summary.md");
  const rawBundleJson = readFileSync(bundlePath, "utf8");
  let rawBundleCandidate: unknown;
  try {
    rawBundleCandidate = JSON.parse(rawBundleJson) as unknown;
  } catch (error) {
    return {
      runId: runDir,
      bundlePath,
      error: error instanceof Error ? error.message : "Failed to parse bundle JSON."
    };
  }
  const looseBundle = readLooseAuditBundle(rawBundleCandidate, runDir);
  if ("error" in looseBundle) {
    return {
      runId: looseBundle.runId,
      bundlePath,
      error: looseBundle.error
    };
  }

  const rawBundle = looseBundle;
  const parsedBundle = auditBundleSchema.safeParse(rawBundleCandidate);
  const bundle = parsedBundle.success ? parsedBundle.data : undefined;
  const rawArtifacts =
    isRecord(rawBundleCandidate) && Array.isArray(rawBundleCandidate.lifecycleArtifacts) ? rawBundleCandidate.lifecycleArtifacts : [];
  const artifactViews = rawArtifacts.map((artifact: unknown, index: number) => {
    const parsedArtifact = lifecycleArtifactSchema.safeParse(artifact);
    return parsedArtifact.success
      ? toKnownArtifactPanel(parsedArtifact.data)
      : toUnknownArtifactPanel(
          rawBundle.lifecycleArtifacts[index] ?? readLooseArtifact(artifact),
          parsedArtifact.error.issues.map((issue) => issue.message).join("; ") || "Unknown artifact shape."
        );
  });

  return {
    runId: rawBundle.runId,
    runDir,
    bundlePath,
    summaryPath,
    rawBundle,
    bundle,
    rawBundleJson,
    summaryMarkdown: readFileSync(summaryPath, "utf8"),
    artifactViews,
    invalidArtifactCount: artifactViews.filter((artifact) => !artifact.isKnownArtifact).length
  };
}

function sortRunsNewestFirst(left: LoadedRun, right: LoadedRun): number {
  const leftCompletedAt =
    parseRunTimestampMs(left.rawBundle.finishedAt) ??
    parseRunTimestampMs(left.rawBundle.startedAt) ??
    parseRunTimestampMs(left.runId) ??
    statSync(left.bundlePath).mtimeMs;
  const rightCompletedAt =
    parseRunTimestampMs(right.rawBundle.finishedAt) ??
    parseRunTimestampMs(right.rawBundle.startedAt) ??
    parseRunTimestampMs(right.runId) ??
    statSync(right.bundlePath).mtimeMs;

  if (leftCompletedAt !== rightCompletedAt) {
    return rightCompletedAt - leftCompletedAt;
  }

  return right.runId.localeCompare(left.runId);
}

function toRunListItemView(run: LoadedRun): RunListItemView {
  const entries = run.bundle?.entries ?? [];
  const findings = run.bundle?.findings ?? [];
  const blockedPlugins = run.bundle?.blockedPlugins ?? [];
  const artifactKinds = run.artifactViews.map((artifact) => artifact.artifactKind);

  return {
    runId: run.runId,
    workflow: run.rawBundle.workflow,
    startedAt: run.rawBundle.startedAt,
    finishedAt: run.rawBundle.finishedAt,
    status: run.rawBundle.status,
    findings: findings.length,
    blockedActions: countBlockedActions(entries),
    blockedPlugins: blockedPlugins.length,
    artifactKinds,
    bundlePath: run.bundlePath,
    summaryPath: run.summaryPath,
    hasBenchmarkSummary: artifactKinds.includes("benchmark-summary"),
    invalidArtifactCount: run.invalidArtifactCount
  };
}

function matchesFilters(run: RunListItemView, filters: RunFilters): boolean {
  if (filters.workflow && run.workflow !== filters.workflow) {
    return false;
  }
  if (filters.status && run.status !== filters.status) {
    return false;
  }
  if (filters.artifactKind && !run.artifactKinds.includes(filters.artifactKind)) {
    return false;
  }
  if (filters.search && !run.runId.toLowerCase().includes(filters.search.toLowerCase())) {
    return false;
  }
  return true;
}

export function resolveRunsRoot(workspaceRoot: string, configuredRunsRoot?: string): string {
  return resolve(workspaceRoot, configuredRunsRoot ?? ".agentops/runs");
}

export function loadRunsIndexView(workspaceRoot: string, runsRoot = resolveRunsRoot(workspaceRoot), filters: RunFilters = {}): RunsIndexView {
  try {
    statSync(runsRoot);
  } catch {
    return { runs: [], invalidRuns: [] };
  }

  const entries = readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((entry) => {
      try {
        statSync(join(runsRoot, entry, "bundle.json"));
        return true;
      } catch {
        return false;
      }
    });

  const loaded = entries.map((entry) => loadRun(workspaceRoot, runsRoot, entry));
  const invalidRuns = loaded.filter((entry): entry is InvalidRunView => "error" in entry);
  const runs = loaded
    .filter((entry): entry is LoadedRun => !("error" in entry))
    .sort(sortRunsNewestFirst)
    .map(toRunListItemView)
    .filter((run) => matchesFilters(run, filters));

  return { runs, invalidRuns };
}

export function resolveBenchmarkLedgerPath(workspaceRoot: string, configuredBenchmarkLedgerPath?: string): string {
  return resolve(workspaceRoot, configuredBenchmarkLedgerPath ?? ".agentops/benchmark-ledger.json");
}

export function loadRunDetailView(
  workspaceRoot: string,
  runId: string,
  runsRoot = resolveRunsRoot(workspaceRoot),
  benchmarkLedgerPath?: string
): RunDetailView | undefined {
  try {
    statSync(runsRoot);
  } catch {
    return undefined;
  }

  const run = loadRun(workspaceRoot, runsRoot, runId);
  if ("error" in run) {
    return undefined;
  }

  const base = toRunListItemView(run);
  const ledger = loadBenchmarkLedgerView(workspaceRoot, benchmarkLedgerPath);
  const decisionImpact = inferDecisionImpact(base, run.bundle?.findings ?? [], run.artifactViews, ledger.entries);
  const riskSummary = buildRiskSummary(base, run.bundle?.findings ?? [], run.artifactViews, ledger.entries);
  const evidenceCompleteness = buildEvidenceCompleteness(base.workflow, run.artifactViews);
  const workflowChain = buildWorkflowChain(base.workflow, run.artifactViews);

  return {
    ...base,
    entries: run.bundle?.entries ?? [],
    findingsList: run.bundle?.findings ?? [],
    blockedPluginsList: run.bundle?.blockedPlugins ?? [],
    artifacts: run.artifactViews,
    summaryMarkdown: run.summaryMarkdown,
    rawBundleJson: run.rawBundleJson,
    decisionImpact,
    riskSummary,
    evidenceCompleteness,
    workflowChain
  };
}

export function loadBenchmarkIndexView(
  workspaceRoot: string,
  runsRoot = resolveRunsRoot(workspaceRoot),
  benchmarkLedgerPath?: string
): BenchmarkIndexView {
  const runsView = loadRunsIndexView(workspaceRoot, runsRoot);
  const allRuns = runsView.runs;
  const localRunIds = new Set(allRuns.map((run) => run.runId));
  const benchmarks = runsView.runs.flatMap((run) => {
    const detail = loadRunDetailView(workspaceRoot, run.runId, runsRoot, benchmarkLedgerPath);
    if (!detail) {
      return [];
    }

    return detail.artifacts.flatMap((artifact) => {
      if (artifact.artifactKind !== "benchmark-summary") {
        return [];
      }

      const rawBundle = JSON.parse(detail.rawBundleJson) as { lifecycleArtifacts?: unknown[] };
      const parsed = benchmarkArtifactSchema.safeParse(
        rawBundle.lifecycleArtifacts?.find((candidate: unknown) => isRecord(candidate) && candidate.artifactKind === "benchmark-summary")
      );
      if (!parsed.success) {
        return [];
      }

      const benchmark = parsed.data;
      return [toBenchmarkSummaryView(detail, benchmark, localRunIds)];
    });
  });

  return {
    benchmarks,
    invalidRuns: runsView.invalidRuns
  };
}

const STAGE_ORDER = [
  "planning",
  "design",
  "implementation",
  "qa",
  "security",
  "review",
  "release",
  "pipeline",
  "deployment",
  "promotion"
] as const;

const STAGE_LABELS: Record<(typeof STAGE_ORDER)[number], string> = {
  planning: "Planning",
  design: "Design",
  implementation: "Implementation",
  qa: "QA",
  security: "Security",
  review: "PR Review",
  release: "Release",
  pipeline: "Pipeline",
  deployment: "Deployment Gate",
  promotion: "Promotion Approval"
};

const ARTIFACT_STAGE_MAP: Record<string, (typeof STAGE_ORDER)[number]> = {
  "planning-brief": "planning",
  "design-record": "design",
  "implementation-proposal": "implementation",
  "qa-report": "qa",
  "security-report": "security",
  "review-report": "review",
  "release-report": "release",
  "pipeline-report": "pipeline",
  "deployment-gate-report": "deployment",
  "promotion-approval-report": "promotion"
};

const WORKFLOW_STAGE_MAP: Record<string, (typeof STAGE_ORDER)[number]> = {
  "planning-discovery": "planning",
  "architecture-design-review": "design",
  "implementation-proposal": "implementation",
  "qa-review": "qa",
  "security-review": "security",
  "pr-review": "review",
  "release-readiness": "release",
  "pipeline-evidence-review": "pipeline",
  "deployment-gate-review": "deployment",
  "promotion-approval": "promotion"
};

function safeParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toDecisionOutcomeKind(value: unknown): DecisionOutcomeKind | undefined {
  return value === "scope_reduction" ||
    value === "added_validation" ||
    value === "blocked_approval" ||
    value === "remediation_before_merge" ||
    value === "added_confidence" ||
    value === "no_meaningful_change"
    ? value
    : undefined;
}

function readBenchmarkLedgerEntry(value: unknown): BenchmarkLedgerEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    taskId: readString(value.taskId, "unknown-task"),
    taskLink: typeof value.taskLink === "string" ? value.taskLink : undefined,
    source: value.source === "live" ? "live" : "replay",
    taskType: readString(value.taskType, "unspecified"),
    arm: value.arm === "control" ? "control" : "agentforge",
    runId: typeof value.runId === "string" ? value.runId : undefined,
    workflow: typeof value.workflow === "string" ? value.workflow : undefined,
    agent: typeof value.agent === "string" ? value.agent : undefined,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : undefined,
    finishedAt: typeof value.finishedAt === "string" ? value.finishedAt : undefined,
    decisionOutcome: toDecisionOutcomeKind(value.decisionOutcome),
    agentforgeChangedDecision: typeof value.agentforgeChangedDecision === "boolean" ? value.agentforgeChangedDecision : undefined,
    confirmedRisks: isRecord(value.confirmedRisks)
      ? {
          high: typeof value.confirmedRisks.high === "number" ? value.confirmedRisks.high : 0,
          medium: typeof value.confirmedRisks.medium === "number" ? value.confirmedRisks.medium : 0,
          low: typeof value.confirmedRisks.low === "number" ? value.confirmedRisks.low : 0,
          noisy: typeof value.confirmedRisks.noisy === "number" ? value.confirmedRisks.noisy : 0,
          unresolved: typeof value.confirmedRisks.unresolved === "number" ? value.confirmedRisks.unresolved : 0
        }
      : { high: 0, medium: 0, low: 0, noisy: 0, unresolved: 0 },
    evidence: isRecord(value.evidence)
      ? {
          present: readStringArray(value.evidence.present),
          missing: readStringArray(value.evidence.missing),
          partial: readStringArray(value.evidence.partial)
        }
      : { present: [], missing: [], partial: [] },
    friction: isRecord(value.friction)
      ? {
          override: readBoolean(value.friction.override),
          overrideReason: typeof value.friction.overrideReason === "string" ? value.friction.overrideReason : undefined,
          falsePositivePatterns: readStringArray(value.friction.falsePositivePatterns),
          manualSteps: readStringArray(value.friction.manualSteps),
          requestFriction: readStringArray(value.friction.requestFriction)
        }
      : { override: false, falsePositivePatterns: [], manualSteps: [], requestFriction: [] },
    notes: readStringArray(value.notes)
  };
}

export function loadBenchmarkLedgerView(
  workspaceRoot: string,
  configuredBenchmarkLedgerPath?: string
): BenchmarkLedgerView {
  const ledgerPath = resolveBenchmarkLedgerPath(workspaceRoot, configuredBenchmarkLedgerPath);

  try {
    statSync(ledgerPath);
  } catch {
    return {
      path: toRelativeDisplayPath(workspaceRoot, ledgerPath),
      entries: [],
      errors: []
    };
  }

  try {
    const raw = safeParseJson(readFileSync(ledgerPath, "utf8"));
    if (!isRecord(raw)) {
      return {
        path: toRelativeDisplayPath(workspaceRoot, ledgerPath),
        entries: [],
        errors: ["Benchmark ledger root is not an object."]
      };
    }

    const entries = Array.isArray(raw.entries) ? raw.entries.map(readBenchmarkLedgerEntry).filter((entry): entry is BenchmarkLedgerEntry => !!entry) : [];
    return {
      path: toRelativeDisplayPath(workspaceRoot, ledgerPath),
      entries,
      errors: []
    };
  } catch (error) {
    return {
      path: toRelativeDisplayPath(workspaceRoot, ledgerPath),
      entries: [],
      errors: [error instanceof Error ? error.message : "Failed to parse benchmark ledger."]
    };
  }
}

function findLedgerEntry(
  run: RunListItemView,
  ledgerEntries: readonly BenchmarkLedgerEntry[]
): BenchmarkLedgerEntry | undefined {
  return ledgerEntries.find((entry) => entry.arm === "agentforge" && (entry.runId === run.runId || entry.workflow === run.workflow));
}

function parseArtifactPayload(artifact: ArtifactPanelView): Record<string, unknown> | undefined {
  const parsed = safeParseJson(artifact.rawPayload);
  return isRecord(parsed) ? parsed : undefined;
}

function deriveStatusFromChecks(checks: unknown): "present" | "missing" | "partial" {
  if (!Array.isArray(checks) || checks.length === 0) {
    return "missing";
  }

  const hasNonPassing = checks.some((check) => isRecord(check) && typeof check.status === "string" && check.status !== "passed");
  return hasNonPassing ? "partial" : "present";
}

function deriveCiEvidenceStatus(ciEvidenceSummary: unknown): "present" | "missing" | "partial" {
  if (!Array.isArray(ciEvidenceSummary) || ciEvidenceSummary.length === 0) {
    return "missing";
  }

  const hasFailures = ciEvidenceSummary.some(
    (entry) => isRecord(entry) && Array.isArray(entry.failingChecks) && entry.failingChecks.length > 0
  );
  return hasFailures ? "partial" : "present";
}

function buildEvidenceCompleteness(workflow: string, artifacts: readonly ArtifactPanelView[]): EvidenceCompletenessView[] {
  return artifacts.flatMap((artifact) => {
    const payload = parseArtifactPayload(artifact);
    if (!payload) {
      return [];
    }

    const referencedKinds = readStringArray(payload.referencedArtifactKinds);
    const categories: EvidenceCategoryView[] = [];
    const addCategory = (key: string, label: string, status: "present" | "missing" | "partial", detail: string) => {
      categories.push({ key, label, status, detail });
    };

    switch (artifact.artifactKind) {
      case "qa-report":
        addCategory(
          "evidence-sources",
          "Evidence Sources",
          readStringArray(payload.evidenceSources).length > 0 ? "present" : "missing",
          readStringArray(payload.evidenceSources).length > 0 ? "Referenced QA evidence is present." : "No QA evidence sources were recorded."
        );
        addCategory(
          "executed-checks",
          "Executed Checks",
          readStringArray(payload.executedChecks).length > 0 ? "present" : "missing",
          readStringArray(payload.executedChecks).length > 0 ? "Validation commands were captured." : "No validation commands were captured."
        );
        addCategory(
          "ci-evidence",
          "CI Evidence",
          deriveCiEvidenceStatus(payload.ciEvidenceSummary),
          deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "missing"
            ? "No CI evidence summary was recorded."
            : deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "partial"
              ? "CI evidence exists but includes failing checks."
              : "CI evidence summary is present and green."
        );
        break;
      case "release-report":
        addCategory("version-targets", "Version Targets", Array.isArray(payload.versionTargets) && payload.versionTargets.length > 0 ? "present" : "missing", Array.isArray(payload.versionTargets) && payload.versionTargets.length > 0 ? "Version targets are recorded." : "No version targets were recorded.");
        addCategory("verification-checks", "Verification Checks", deriveStatusFromChecks(payload.verificationChecks), deriveStatusFromChecks(payload.verificationChecks) === "missing" ? "No verification checks were recorded." : deriveStatusFromChecks(payload.verificationChecks) === "partial" ? "Verification checks include non-passing results." : "Verification checks are present and passed.");
        addCategory("ci-evidence", "CI Evidence", deriveCiEvidenceStatus(payload.ciEvidenceSummary), deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "missing" ? "No CI evidence summary was recorded." : deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "partial" ? "CI evidence includes failing checks." : "CI evidence summary is present and green.");
        addCategory("provenance", "Provenance Refs", readStringArray(payload.provenanceRefs).length > 0 ? "present" : "missing", readStringArray(payload.provenanceRefs).length > 0 ? "Release provenance refs were captured." : "No provenance refs were captured.");
        break;
      case "pipeline-report":
        addCategory("ci-evidence", "CI Evidence", deriveCiEvidenceStatus(payload.ciEvidenceSummary), deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "missing" ? "No CI evidence summary was recorded." : deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "partial" ? "CI evidence includes failing checks." : "CI evidence summary is present and green.");
        addCategory("qa-report", "QA Report", referencedKinds.includes("qa-report") ? "present" : "missing", referencedKinds.includes("qa-report") ? "A QA report reference is present." : "No QA report reference was recorded.");
        addCategory("security-report", "Security Report", referencedKinds.includes("security-report") ? "present" : "missing", referencedKinds.includes("security-report") ? "A security report reference is present." : "No security report reference was recorded.");
        addCategory("release-report", "Release Report", referencedKinds.includes("release-report") ? "present" : "missing", referencedKinds.includes("release-report") ? "A release report reference is present." : "No release report reference was recorded.");
        addCategory("verification-checks", "Verification Checks", deriveStatusFromChecks(payload.verificationChecks), deriveStatusFromChecks(payload.verificationChecks) === "missing" ? "No verification checks were recorded." : deriveStatusFromChecks(payload.verificationChecks) === "partial" ? "Verification checks include non-passing results." : "Verification checks are present and passed.");
        break;
      case "deployment-gate-report":
        addCategory("ci-evidence", "CI Evidence", deriveCiEvidenceStatus(payload.ciEvidenceSummary), deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "missing" ? "No CI evidence summary was recorded." : deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "partial" ? "CI evidence includes failing checks." : "CI evidence summary is present and green.");
        addCategory("qa-report", "QA Report", referencedKinds.includes("qa-report") ? "present" : "missing", referencedKinds.includes("qa-report") ? "A QA report reference is present." : "No QA report reference was recorded.");
        addCategory("security-report", "Security Report", referencedKinds.includes("security-report") ? "present" : "missing", referencedKinds.includes("security-report") ? "A security report reference is present." : "No security report reference was recorded.");
        addCategory("release-report", "Release Report", referencedKinds.includes("release-report") ? "present" : "missing", referencedKinds.includes("release-report") ? "A release report reference is present." : "No release report reference was recorded.");
        addCategory("pipeline-report", "Pipeline Report", referencedKinds.includes("pipeline-report") ? "present" : "missing", referencedKinds.includes("pipeline-report") ? "A pipeline report reference is present." : "No pipeline report reference was recorded.");
        break;
      case "promotion-approval-report":
        addCategory("ci-evidence", "CI Evidence", deriveCiEvidenceStatus(payload.ciEvidenceSummary), deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "missing" ? "No CI evidence summary was recorded." : deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "partial" ? "CI evidence includes failing checks." : "CI evidence summary is present and green.");
        addCategory("qa-report", "QA Report", referencedKinds.includes("qa-report") ? "present" : "missing", referencedKinds.includes("qa-report") ? "A QA report reference is present." : "No QA report reference was recorded.");
        addCategory("security-report", "Security Report", referencedKinds.includes("security-report") ? "present" : "missing", referencedKinds.includes("security-report") ? "A security report reference is present." : "No security report reference was recorded.");
        addCategory("release-report", "Release Report", referencedKinds.includes("release-report") ? "present" : "missing", referencedKinds.includes("release-report") ? "A release report reference is present." : "No release report reference was recorded.");
        addCategory("deployment-gate-report", "Deployment Gate", referencedKinds.includes("deployment-gate-report") ? "present" : "missing", referencedKinds.includes("deployment-gate-report") ? "A deployment gate report reference is present." : "No deployment gate report reference was recorded.");
        addCategory("required-approvals", "Required Approvals", readStringArray(payload.requiredApprovals).length > 0 ? "present" : "missing", readStringArray(payload.requiredApprovals).length > 0 ? "Required approvals were captured." : "No required approvals were captured.");
        break;
      default:
        break;
    }

    return categories.length > 0 ? [{ workflow, categories }] : [];
  });
}

function buildWorkflowChain(workflow: string, artifacts: readonly ArtifactPanelView[]): WorkflowChainView {
  const primaryArtifact = artifacts.find((artifact) => ARTIFACT_STAGE_MAP[artifact.artifactKind]);
  const currentStage = primaryArtifact ? ARTIFACT_STAGE_MAP[primaryArtifact.artifactKind] : WORKFLOW_STAGE_MAP[workflow] ?? "review";
  const payload = primaryArtifact ? parseArtifactPayload(primaryArtifact) : undefined;
  const referencedKinds = payload ? new Set(readStringArray(payload.referencedArtifactKinds)) : new Set<string>();

  return {
    currentStage,
    stages: STAGE_ORDER.map((stage) => {
      const artifactKind = Object.entries(ARTIFACT_STAGE_MAP).find(([, mappedStage]) => mappedStage === stage)?.[0];
      const status: WorkflowChainStageView["status"] =
        stage === currentStage
          ? "current"
          : artifactKind && referencedKinds.has(artifactKind)
            ? "present"
            : STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(currentStage)
              ? "missing"
              : "missing";

      const detail =
        status === "current"
          ? `Current run is operating at the ${STAGE_LABELS[stage]} stage.`
          : status === "present"
            ? `A ${artifactKind} reference is present for this stage.`
            : STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(currentStage)
              ? `No upstream ${STAGE_LABELS[stage]} evidence is referenced from this run.`
              : `This downstream stage has not run yet from the current evidence chain.`;

      return {
        stage,
        label: STAGE_LABELS[stage],
        status,
        detail
      };
    })
  };
}

function buildRiskSummary(
  run: RunListItemView,
  findings: readonly Finding[],
  artifacts: readonly ArtifactPanelView[],
  ledgerEntries: readonly BenchmarkLedgerEntry[]
): RiskSummaryView {
  const ledgerEntry = findLedgerEntry(run, ledgerEntries);
  const high = ledgerEntry?.confirmedRisks.high ?? findings.filter((finding) => finding.severity === "high").length;
  const medium = ledgerEntry?.confirmedRisks.medium ?? findings.filter((finding) => finding.severity === "medium").length;
  const low = ledgerEntry?.confirmedRisks.low ?? findings.filter((finding) => finding.severity === "low").length;
  const noisy = ledgerEntry?.confirmedRisks.noisy ?? 0;
  const blockerCount = artifacts.reduce((total, artifact) => {
    const payload = parseArtifactPayload(artifact);
    return total + readStringArray(payload?.blockers).length;
  }, 0);
  const blockedApprovalPrevented = artifacts.some((artifact) => {
    const payload = parseArtifactPayload(artifact);
    const statusCandidates = [
      artifact.status,
      typeof payload?.readinessStatus === "string" ? payload.readinessStatus : undefined,
      typeof payload?.reviewStatus === "string" ? payload.reviewStatus : undefined,
      typeof payload?.gateStatus === "string" ? payload.gateStatus : undefined,
      typeof payload?.approvalStatus === "string" ? payload.approvalStatus : undefined
    ];
    return statusCandidates.includes("blocked");
  });
  const unresolved = ledgerEntry?.confirmedRisks.unresolved ?? high + medium + blockerCount;

  const summary: string[] = [];
  if (high + medium > 0) {
    summary.push(`${high + medium} medium/high risk item(s) were surfaced for this run.`);
  }
  if (blockedApprovalPrevented) {
    summary.push("This run prevented a blocked approval or release decision from appearing ready.");
  }
  if (noisy > 0) {
    summary.push(`${noisy} finding(s) were later judged as noise in the benchmark ledger.`);
  }
  if (summary.length === 0) {
    summary.push("No significant risk signals were recorded for this run.");
  }

  return {
    high,
    medium,
    low,
    noisy,
    unresolved,
    blockedApprovalPrevented,
    blockerCount,
    summary
  };
}

function inferDecisionImpact(
  run: RunListItemView,
  findings: readonly Finding[],
  artifacts: readonly ArtifactPanelView[],
  ledgerEntries: readonly BenchmarkLedgerEntry[]
): DecisionImpactView {
  const ledgerEntry = findLedgerEntry(run, ledgerEntries);
  if (ledgerEntry?.decisionOutcome) {
    return {
      kind: ledgerEntry.decisionOutcome,
      changedDecision: ledgerEntry.agentforgeChangedDecision ?? !["added_confidence", "no_meaningful_change"].includes(ledgerEntry.decisionOutcome),
      source: "ledger",
      summary: `Benchmark ledger marked this run as ${ledgerEntry.decisionOutcome.replaceAll("_", " ")}.`
    };
  }

  const evidence = buildEvidenceCompleteness(run.workflow, artifacts);
  const blockerArtifact = artifacts.find((artifact) => {
    const payload = parseArtifactPayload(artifact);
    return artifact.status === "blocked" || payload?.gateStatus === "blocked" || payload?.approvalStatus === "blocked" || payload?.reviewStatus === "blocked" || payload?.readinessStatus === "blocked";
  });
  if (blockerArtifact) {
    return {
      kind: "blocked_approval",
      changedDecision: true,
      source: "inferred",
      summary: `The run emitted a blocked ${blockerArtifact.artifactKind}, which would halt approval or release flow.`
    };
  }

  if (artifacts.some((artifact) => readStringArray(parseArtifactPayload(artifact)?.blockers).length > 0) || findings.length > 0 || run.status !== "success") {
    return {
      kind: "remediation_before_merge",
      changedDecision: true,
      source: "inferred",
      summary: "The run surfaced blockers or findings that imply remediation before merge or promotion."
    };
  }

  if (evidence.some((artifact) => artifact.categories.some((category) => category.status !== "present"))) {
    return {
      kind: "added_validation",
      changedDecision: true,
      source: "inferred",
      summary: "The run highlighted missing or partial evidence that should change the validation plan."
    };
  }

  if (run.workflow === "planning-discovery") {
    return {
      kind: "added_confidence",
      changedDecision: false,
      source: "inferred",
      summary: "The planning run improved scope clarity but did not clearly force a different implementation path."
    };
  }

  return {
    kind: "no_meaningful_change",
    changedDecision: false,
    source: "inferred",
    summary: "The run completed cleanly without a clear decision delta beyond baseline inspection."
  };
}

function countOutcome(runs: readonly RunDetailView[], kind: DecisionOutcomeKind): number {
  return runs.filter((run) => run.decisionImpact.kind === kind).length;
}

function aggregateFrequentMissing(categories: readonly EvidenceCompletenessView[]): string[] {
  const counts = new Map<string, number>();
  for (const artifact of categories) {
    for (const category of artifact.categories) {
      if (category.status === "missing") {
        counts.set(category.label, (counts.get(category.label) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([label, count]) => `${label} (${count})`);
}

function aggregateWorkflowChainSummary(runs: readonly RunDetailView[]): WorkflowChainSummaryView[] {
  return STAGE_ORDER.map((stage) => {
    const stageRuns = runs.filter((run) => run.workflowChain.currentStage === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      runCount: stageRuns.length,
      blockedCount: stageRuns.filter((run) => run.decisionImpact.kind === "blocked_approval").length,
      missingUpstreamEvidenceCount: stageRuns.filter((run) =>
        run.workflowChain.stages.some(
          (candidate) => candidate.status === "missing" && STAGE_ORDER.indexOf(candidate.stage as (typeof STAGE_ORDER)[number]) < STAGE_ORDER.indexOf(stage)
        )
      ).length
    };
  }).filter((stage) => stage.runCount > 0);
}

function aggregateFriction(
  runs: readonly RunDetailView[],
  ledger: BenchmarkLedgerView
): FrictionDashboardView {
  const agentforgeEntries = ledger.entries.filter((entry) => entry.arm === "agentforge");
  const workflowCounts = new Map<string, FrictionWorkflowView>();
  const repeatedOverrideReasons = new Map<string, number>();
  const noisyPatterns = new Map<string, number>();

  for (const entry of agentforgeEntries) {
    const workflow = entry.workflow ?? "unknown";
    const current = workflowCounts.get(workflow) ?? {
      workflow,
      overrideCount: 0,
      falsePositiveCount: 0,
      manualStepCount: 0,
      requestFrictionCount: 0
    };
    current.overrideCount += entry.friction.override ? 1 : 0;
    current.falsePositiveCount += entry.friction.falsePositivePatterns.length;
    current.manualStepCount += entry.friction.manualSteps.length;
    current.requestFrictionCount += entry.friction.requestFriction.length;
    workflowCounts.set(workflow, current);

    if (entry.friction.overrideReason) {
      repeatedOverrideReasons.set(
        entry.friction.overrideReason,
        (repeatedOverrideReasons.get(entry.friction.overrideReason) ?? 0) + 1
      );
    }
    for (const pattern of entry.friction.falsePositivePatterns) {
      noisyPatterns.set(pattern, (noisyPatterns.get(pattern) ?? 0) + 1);
    }
  }

  return {
    ledgerAvailable: ledger.entries.length > 0 || ledger.errors.length > 0,
    overrideCount: agentforgeEntries.filter((entry) => entry.friction.override).length,
    falsePositiveCount: agentforgeEntries.reduce((total, entry) => total + entry.friction.falsePositivePatterns.length, 0),
    manualStepCount: agentforgeEntries.reduce((total, entry) => total + entry.friction.manualSteps.length, 0),
    requestFrictionCount: agentforgeEntries.reduce((total, entry) => total + entry.friction.requestFriction.length, 0),
    repeatedOverrideReasons: [...repeatedOverrideReasons.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([reason, count]) => `${reason} (${count})`),
    noisyPatterns: [...noisyPatterns.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([pattern, count]) => `${pattern} (${count})`),
    workflowHotspots: [...workflowCounts.values()].sort(
      (left, right) =>
        right.overrideCount +
          right.falsePositiveCount +
          right.manualStepCount +
          right.requestFrictionCount -
        (left.overrideCount + left.falsePositiveCount + left.manualStepCount + left.requestFrictionCount)
    ),
  };
}

export function loadValueDashboardView(
  workspaceRoot: string,
  runsRoot = resolveRunsRoot(workspaceRoot),
  benchmarkLedgerPath?: string
): ValueDashboardView {
  const runsIndex = loadRunsIndexView(workspaceRoot, runsRoot);
  const ledger = loadBenchmarkLedgerView(workspaceRoot, benchmarkLedgerPath);
  const runs = runsIndex.runs
    .map((run) => loadRunDetailView(workspaceRoot, run.runId, runsRoot, benchmarkLedgerPath))
    .filter((run): run is RunDetailView => !!run);

  const comparableTaskIds = new Set(
    ledger.entries
      .filter((entry) => entry.arm === "agentforge")
      .map((entry) => entry.taskId)
      .filter((taskId) => ledger.entries.some((entry) => entry.arm === "control" && entry.taskId === taskId))
  );

  const evidence = Object.values(
    runs.reduce<Record<string, EvidenceCompletenessView[]>>((accumulator, run) => {
      accumulator[run.workflow] ??= [];
      accumulator[run.workflow].push(...run.evidenceCompleteness);
      return accumulator;
    }, {})
  ).flatMap((entries) => {
    if (entries.length === 0) {
      return [];
    }
    const workflow = entries[0]?.workflow ?? "unknown";
    return [
      {
        workflow,
        runs: runs.filter((run) => run.workflow === workflow).length,
        missingCount: entries.reduce((total, artifact) => total + artifact.categories.filter((category) => category.status === "missing").length, 0),
        partialCount: entries.reduce((total, artifact) => total + artifact.categories.filter((category) => category.status === "partial").length, 0),
        frequentMissing: aggregateFrequentMissing(entries)
      }
    ];
  }).sort((left, right) => right.missingCount - left.missingCount || right.partialCount - left.partialCount || left.workflow.localeCompare(right.workflow));

  return {
    ledger,
    decisionImpact: {
      changedDecisionCount: runs.filter((run) => run.decisionImpact.changedDecision).length,
      scopeReductionCount: countOutcome(runs, "scope_reduction"),
      addedValidationCount: countOutcome(runs, "added_validation"),
      blockedApprovalCount: countOutcome(runs, "blocked_approval"),
      remediationCount: countOutcome(runs, "remediation_before_merge"),
      addedConfidenceCount: countOutcome(runs, "added_confidence"),
      noMeaningfulChangeCount: countOutcome(runs, "no_meaningful_change"),
      comparableBenchmarkPairs: comparableTaskIds.size
    },
    risk: {
      confirmedHighCount: ledger.entries.reduce((total, entry) => total + entry.confirmedRisks.high, 0),
      confirmedMediumCount: ledger.entries.reduce((total, entry) => total + entry.confirmedRisks.medium, 0),
      noisyFindingCount: ledger.entries.reduce((total, entry) => total + entry.confirmedRisks.noisy, 0),
      blockedApprovalPreventedCount: runs.filter((run) => run.riskSummary.blockedApprovalPrevented).length,
      unresolvedRiskCount: runs.reduce((total, run) => total + run.riskSummary.unresolved, 0)
    },
    evidence,
    friction: aggregateFriction(runs, ledger),
    workflowChains: aggregateWorkflowChainSummary(runs),
    runCount: runs.length
  };
}

function toBenchmarkSummaryView(
  run: RunDetailView,
  artifact: BenchmarkArtifact,
  localRunIds: Set<string>
): BenchmarkSummaryView {
  return {
    runId: run.runId,
    workflow: run.workflow,
    status: run.status,
    baselineRunId: artifact.payload.baselineRunId,
    baselineWorkflow: artifact.payload.baselineWorkflow,
    baselineSpecId: artifact.payload.baselineSpecId,
    comparableRunCount: artifact.payload.comparedRuns.filter((candidate) => candidate.comparable).length,
    regressionCount: artifact.payload.regressionCount,
    improvementCount: artifact.payload.improvementCount,
    unchangedCount: artifact.payload.unchangedCount,
    nonComparableCount: artifact.payload.nonComparableCount,
    summaryConclusion: artifact.payload.summaryConclusion,
    comparedRuns: artifact.payload.comparedRuns.map((candidate) => ({
      runId: candidate.runId,
      bundlePath: candidate.bundlePath,
      specId: candidate.specId,
      workflow: candidate.workflow,
      comparable: candidate.comparable,
      passed: candidate.passed,
      failureCount: candidate.failureCount,
      deterministicCheckCount: candidate.deterministicCheckCount,
      regressionCount: candidate.regressions.length,
      improvementCount: candidate.improvements.length,
      unchangedCount: candidate.unchangedCount,
      nonComparableCount: candidate.nonComparableFindings.length,
      hasLocalRunLink: localRunIds.has(candidate.runId)
    })),
    hasBaselineRunLink: localRunIds.has(artifact.payload.baselineRunId)
  };
}

export function listAvailableWorkflows(runs: readonly RunListItemView[]): string[] {
  return [...new Set(runs.map((run) => run.workflow))].sort();
}

export function listAvailableStatuses(runs: readonly RunListItemView[]): string[] {
  return [...new Set(runs.map((run) => run.status))].sort();
}

export function listAvailableArtifactKinds(runs: readonly RunListItemView[]): string[] {
  return [...new Set(runs.flatMap((run) => run.artifactKinds))].sort();
}

export function toRelativeDisplayPath(workspaceRoot: string, absolutePath: string): string {
  const normalizedWorkspaceRoot = resolve(workspaceRoot);
  const normalizedPath = resolve(absolutePath);
  return normalizedPath.startsWith(normalizedWorkspaceRoot) ? normalizedPath.slice(normalizedWorkspaceRoot.length + 1) : basename(absolutePath);
}
