import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { auditBundleSchema, benchmarkArtifactSchema, benchmarkLedgerDocumentSchema, lifecycleArtifactSchema } from "@h9-foundry/agentforge-schemas";
import type {
  AuditBundle,
  AuditEntry,
  BenchmarkArtifact,
  BenchmarkLedgerDocument,
  BenchmarkLedgerEntry,
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
  decisionImpactKind?: DecisionOutcomeKind;
  riskKinds: string[];
  evidenceStatuses: Array<{ category: string; status: "present" | "missing" | "partial" }>;
  workflowStage?: string;
  hasOverride: boolean;
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

export interface TraceReferenceView {
  runId?: string;
  artifactKind?: string;
  section?: string;
  findingId?: string;
  note: string;
}

export interface DerivedReasonView {
  source: "ledger" | "inferred" | "run-findings" | "artifact-blockers";
  rule: string;
  fields: string[];
  summary: string;
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
  reason: DerivedReasonView;
  traceRefs: TraceReferenceView[];
  benchmarkTaskId?: string;
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
  reason: DerivedReasonView;
  traceRefs: TraceReferenceView[];
}

export interface EvidenceCategoryView {
  key: string;
  label: string;
  status: "present" | "missing" | "partial";
  detail: string;
  reason: DerivedReasonView;
  traceRefs: TraceReferenceView[];
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
  reason: DerivedReasonView;
  required: boolean;
  traceRefs: TraceReferenceView[];
}

export interface WorkflowChainView {
  currentStage: string;
  stages: WorkflowChainStageView[];
  chainKey?: string;
}

export interface OutcomeSummaryView {
  label: string;
  value: number;
  detail: string;
  href: string;
}

export interface OutcomeDetailRowView {
  id: string;
  workflow: string;
  runId: string;
  status: string;
  title: string;
  summary: string;
  source: string;
  detailHref: string;
  runsHref: string;
  traceRefs: TraceReferenceView[];
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

export interface OutcomesDashboardView {
  ledger: BenchmarkLedgerView;
  decisionImpact: DecisionImpactSummaryView;
  risk: RiskDashboardView;
  evidence: WorkflowEvidenceSummaryRowView[];
  friction: FrictionDashboardView;
  workflowChains: WorkflowChainSummaryView[];
  runCount: number;
  filteredPanel?: string;
  filters: OutcomesFilters;
  summaries: {
    decision: OutcomeSummaryView[];
    risk: OutcomeSummaryView[];
    evidence: OutcomeSummaryView[];
    friction: OutcomeSummaryView[];
    workflowChain: OutcomeSummaryView[];
  };
  details: {
    decision: OutcomeDetailRowView[];
    risk: OutcomeDetailRowView[];
    evidence: OutcomeDetailRowView[];
    friction: OutcomeDetailRowView[];
    workflowChain: OutcomeDetailRowView[];
  };
}

export type ValueDashboardView = OutcomesDashboardView;

export interface RunFilters {
  workflow?: string;
  status?: string;
  artifactKind?: string;
  search?: string;
  decisionImpact?: DecisionOutcomeKind;
  riskKind?: string;
  evidenceCategory?: string;
  evidenceStatus?: "present" | "missing" | "partial";
  hasOverride?: "true" | "false";
  workflowStage?: string;
}

export interface OutcomesFilters {
  panel?: "decision-impact" | "risk" | "evidence" | "friction" | "flow";
  decision?: "changed" | DecisionOutcomeKind;
  risk?: string;
  workflow?: string;
  evidenceCategory?: string;
  evidenceStatus?: "present" | "missing" | "partial";
  stage?: string;
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

function readRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => isRecord(entry)) : [];
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

function toRunListItemView(run: LoadedRun, ledgerEntries: readonly BenchmarkLedgerEntry[] = []): RunListItemView {
  const entries = run.bundle?.entries ?? [];
  const findings = run.bundle?.findings ?? [];
  const blockedPlugins = run.bundle?.blockedPlugins ?? [];
  const artifactKinds = run.artifactViews.map((artifact) => artifact.artifactKind);
  const base: RunListItemView = {
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
    invalidArtifactCount: run.invalidArtifactCount,
    riskKinds: [],
    evidenceStatuses: [],
    hasOverride: false
  };
  const decisionImpact = inferDecisionImpact(base, findings, run.artifactViews, ledgerEntries);
  const evidenceCompleteness = buildEvidenceCompleteness(base.workflow, run.artifactViews);
  const workflowChain = buildWorkflowChain(base.workflow, run.artifactViews);
  const ledgerEntry = findLedgerEntry(base, ledgerEntries);
  const riskKinds = deriveRiskKinds(findings, run.artifactViews, ledgerEntry);

  return {
    ...base,
    decisionImpactKind: decisionImpact.kind,
    riskKinds,
    evidenceStatuses: evidenceCompleteness.flatMap((artifact) =>
      artifact.categories.map((category) => ({ category: category.key, status: category.status }))
    ),
    workflowStage: workflowChain.currentStage,
    hasOverride: ledgerEntry?.friction.override ?? false
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
  if (filters.decisionImpact && run.decisionImpactKind !== filters.decisionImpact) {
    return false;
  }
  if (filters.riskKind && !run.riskKinds.includes(filters.riskKind)) {
    return false;
  }
  if (
    filters.evidenceCategory &&
    !run.evidenceStatuses.some(
      (entry) =>
        entry.category === filters.evidenceCategory &&
        (!filters.evidenceStatus || entry.status === filters.evidenceStatus)
    )
  ) {
    return false;
  }
  if (filters.evidenceStatus && !filters.evidenceCategory && !run.evidenceStatuses.some((entry) => entry.status === filters.evidenceStatus)) {
    return false;
  }
  if (filters.hasOverride && String(run.hasOverride) !== filters.hasOverride) {
    return false;
  }
  if (filters.workflowStage && run.workflowStage !== filters.workflowStage) {
    return false;
  }
  return true;
}

export function resolveRunsRoot(workspaceRoot: string, configuredRunsRoot?: string): string {
  return resolve(workspaceRoot, configuredRunsRoot ?? ".agentops/runs");
}

export function loadRunsIndexView(
  workspaceRoot: string,
  runsRoot = resolveRunsRoot(workspaceRoot),
  filters: RunFilters = {},
  benchmarkLedgerPath?: string
): RunsIndexView {
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
  const ledgerEntries = loadBenchmarkLedgerView(workspaceRoot, benchmarkLedgerPath).entries;
  const runs = loaded
    .filter((entry): entry is LoadedRun => !("error" in entry))
    .sort(sortRunsNewestFirst)
    .map((run) => toRunListItemView(run, ledgerEntries))
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
    const parsed = benchmarkLedgerDocumentSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        path: toRelativeDisplayPath(workspaceRoot, ledgerPath),
        entries: [],
        errors: parsed.error.issues.map((issue) => issue.message)
      };
    }

    const entries = (parsed.data as BenchmarkLedgerDocument).entries;
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

function toQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  const serialized = searchParams.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

function toRunDetailHref(runId: string, anchor?: string): string {
  return `/runs/${encodeURIComponent(runId)}${anchor ? `#${anchor}` : ""}`;
}

function toRunsFilterHref(filters: RunFilters): string {
  return `/runs${toQueryString({
    workflow: filters.workflow,
    status: filters.status,
    artifactKind: filters.artifactKind,
    search: filters.search,
    decisionImpact: filters.decisionImpact,
    riskKind: filters.riskKind,
    evidenceCategory: filters.evidenceCategory,
    evidenceStatus: filters.evidenceStatus,
    hasOverride: filters.hasOverride,
    workflowStage: filters.workflowStage
  })}`;
}

function toOutcomesFilterHref(filters: OutcomesFilters, anchor?: string): string {
  return `/outcomes${toQueryString({
    panel: filters.panel,
    decision: filters.decision,
    risk: filters.risk,
    workflow: filters.workflow,
    evidenceCategory: filters.evidenceCategory,
    evidenceStatus: filters.evidenceStatus,
    stage: filters.stage
  })}${anchor ? `#${anchor}` : ""}`;
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

function deriveRiskKinds(
  findings: readonly Finding[],
  artifacts: readonly ArtifactPanelView[],
  ledgerEntry?: BenchmarkLedgerEntry
): string[] {
  const kinds = new Set<string>();
  for (const finding of findings) {
    kinds.add(`finding:${finding.severity}`);
  }
  if ((ledgerEntry?.confirmedRisks.high ?? 0) > 0) {
    kinds.add("confirmed-high");
  }
  if ((ledgerEntry?.confirmedRisks.medium ?? 0) > 0) {
    kinds.add("confirmed-medium");
  }
  if ((ledgerEntry?.confirmedRisks.noisy ?? 0) > 0) {
    kinds.add("noisy");
  }
  if ((ledgerEntry?.confirmedRisks.unresolved ?? 0) > 0) {
    kinds.add("unresolved");
  }
  if (artifacts.some((artifact) => readStringArray(parseArtifactPayload(artifact)?.blockers).length > 0)) {
    kinds.add("artifact-blocker");
  }
  if (artifacts.some((artifact) => {
    const payload = parseArtifactPayload(artifact);
    return payload?.gateStatus === "blocked" || payload?.approvalStatus === "blocked" || payload?.readinessStatus === "blocked" || payload?.reviewStatus === "blocked";
  })) {
    kinds.add("blocked-approval");
  }
  return [...kinds].sort();
}

function buildEvidenceCompleteness(workflow: string, artifacts: readonly ArtifactPanelView[]): EvidenceCompletenessView[] {
  return artifacts.flatMap((artifact) => {
    const payload = parseArtifactPayload(artifact);
    if (!payload) {
      return [];
    }

    const referencedKinds = readStringArray(payload.referencedArtifactKinds);
    const categories: EvidenceCategoryView[] = [];
    const traceRefs: TraceReferenceView[] = [
      {
        artifactKind: artifact.artifactKind,
        section: "raw-payload",
        note: `Derived from ${artifact.artifactKind} payload.`
      }
    ];
    const addCategory = (
      key: string,
      label: string,
      status: "present" | "missing" | "partial",
      detail: string,
      fields: string[]
    ) => {
      categories.push({
        key,
        label,
        status,
        detail,
        traceRefs,
        reason: {
          source: "inferred",
          rule: `${label} classification`,
          fields,
          summary: detail
        }
      });
    };

    switch (artifact.artifactKind) {
      case "qa-report":
        addCategory(
          "evidence-sources",
          "Evidence Sources",
          readStringArray(payload.evidenceSources).length > 0 ? "present" : "missing",
          readStringArray(payload.evidenceSources).length > 0 ? "Referenced QA evidence is present." : "No QA evidence sources were recorded.",
          ["payload.evidenceSources"]
        );
        addCategory(
          "executed-checks",
          "Executed Checks",
          readStringArray(payload.executedChecks).length > 0 ? "present" : "missing",
          readStringArray(payload.executedChecks).length > 0 ? "Validation commands were captured." : "No validation commands were captured.",
          ["payload.executedChecks"]
        );
        addCategory(
          "ci-evidence",
          "CI Evidence",
          deriveCiEvidenceStatus(payload.ciEvidenceSummary),
          deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "missing"
            ? "No CI evidence summary was recorded."
            : deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "partial"
              ? "CI evidence exists but includes failing checks."
              : "CI evidence summary is present and green.",
          ["payload.ciEvidenceSummary", "payload.ciEvidenceSummary[].failingChecks"]
        );
        break;
      case "release-report":
        addCategory("version-targets", "Version Targets", Array.isArray(payload.versionTargets) && payload.versionTargets.length > 0 ? "present" : "missing", Array.isArray(payload.versionTargets) && payload.versionTargets.length > 0 ? "Version targets are recorded." : "No version targets were recorded.", ["payload.versionTargets"]);
        addCategory("verification-checks", "Verification Checks", deriveStatusFromChecks(payload.verificationChecks), deriveStatusFromChecks(payload.verificationChecks) === "missing" ? "No verification checks were recorded." : deriveStatusFromChecks(payload.verificationChecks) === "partial" ? "Verification checks include non-passing results." : "Verification checks are present and passed.", ["payload.verificationChecks", "payload.verificationChecks[].status"]);
        addCategory("ci-evidence", "CI Evidence", deriveCiEvidenceStatus(payload.ciEvidenceSummary), deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "missing" ? "No CI evidence summary was recorded." : deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "partial" ? "CI evidence includes failing checks." : "CI evidence summary is present and green.", ["payload.ciEvidenceSummary", "payload.ciEvidenceSummary[].failingChecks"]);
        addCategory("provenance", "Provenance Refs", readStringArray(payload.provenanceRefs).length > 0 ? "present" : "missing", readStringArray(payload.provenanceRefs).length > 0 ? "Release provenance refs were captured." : "No provenance refs were captured.", ["payload.provenanceRefs"]);
        break;
      case "pipeline-report":
        addCategory("ci-evidence", "CI Evidence", deriveCiEvidenceStatus(payload.ciEvidenceSummary), deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "missing" ? "No CI evidence summary was recorded." : deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "partial" ? "CI evidence includes failing checks." : "CI evidence summary is present and green.", ["payload.ciEvidenceSummary", "payload.ciEvidenceSummary[].failingChecks"]);
        addCategory("qa-report", "QA Report", referencedKinds.includes("qa-report") ? "present" : "missing", referencedKinds.includes("qa-report") ? "A QA report reference is present." : "No QA report reference was recorded.", ["payload.referencedArtifactKinds"]);
        addCategory("security-report", "Security Report", referencedKinds.includes("security-report") ? "present" : "missing", referencedKinds.includes("security-report") ? "A security report reference is present." : "No security report reference was recorded.", ["payload.referencedArtifactKinds"]);
        addCategory("release-report", "Release Report", referencedKinds.includes("release-report") ? "present" : "missing", referencedKinds.includes("release-report") ? "A release report reference is present." : "No release report reference was recorded.", ["payload.referencedArtifactKinds"]);
        addCategory("verification-checks", "Verification Checks", deriveStatusFromChecks(payload.verificationChecks), deriveStatusFromChecks(payload.verificationChecks) === "missing" ? "No verification checks were recorded." : deriveStatusFromChecks(payload.verificationChecks) === "partial" ? "Verification checks include non-passing results." : "Verification checks are present and passed.", ["payload.verificationChecks", "payload.verificationChecks[].status"]);
        break;
      case "deployment-gate-report":
        addCategory("ci-evidence", "CI Evidence", deriveCiEvidenceStatus(payload.ciEvidenceSummary), deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "missing" ? "No CI evidence summary was recorded." : deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "partial" ? "CI evidence includes failing checks." : "CI evidence summary is present and green.", ["payload.ciEvidenceSummary", "payload.ciEvidenceSummary[].failingChecks"]);
        addCategory("qa-report", "QA Report", referencedKinds.includes("qa-report") ? "present" : "missing", referencedKinds.includes("qa-report") ? "A QA report reference is present." : "No QA report reference was recorded.", ["payload.referencedArtifactKinds"]);
        addCategory("security-report", "Security Report", referencedKinds.includes("security-report") ? "present" : "missing", referencedKinds.includes("security-report") ? "A security report reference is present." : "No security report reference was recorded.", ["payload.referencedArtifactKinds"]);
        addCategory("release-report", "Release Report", referencedKinds.includes("release-report") ? "present" : "missing", referencedKinds.includes("release-report") ? "A release report reference is present." : "No release report reference was recorded.", ["payload.referencedArtifactKinds"]);
        addCategory("pipeline-report", "Pipeline Report", referencedKinds.includes("pipeline-report") ? "present" : "missing", referencedKinds.includes("pipeline-report") ? "A pipeline report reference is present." : "No pipeline report reference was recorded.", ["payload.referencedArtifactKinds"]);
        break;
      case "promotion-approval-report":
        addCategory("ci-evidence", "CI Evidence", deriveCiEvidenceStatus(payload.ciEvidenceSummary), deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "missing" ? "No CI evidence summary was recorded." : deriveCiEvidenceStatus(payload.ciEvidenceSummary) === "partial" ? "CI evidence includes failing checks." : "CI evidence summary is present and green.", ["payload.ciEvidenceSummary", "payload.ciEvidenceSummary[].failingChecks"]);
        addCategory("qa-report", "QA Report", referencedKinds.includes("qa-report") ? "present" : "missing", referencedKinds.includes("qa-report") ? "A QA report reference is present." : "No QA report reference was recorded.", ["payload.referencedArtifactKinds"]);
        addCategory("security-report", "Security Report", referencedKinds.includes("security-report") ? "present" : "missing", referencedKinds.includes("security-report") ? "A security report reference is present." : "No security report reference was recorded.", ["payload.referencedArtifactKinds"]);
        addCategory("release-report", "Release Report", referencedKinds.includes("release-report") ? "present" : "missing", referencedKinds.includes("release-report") ? "A release report reference is present." : "No release report reference was recorded.", ["payload.referencedArtifactKinds"]);
        addCategory("deployment-gate-report", "Deployment Gate", referencedKinds.includes("deployment-gate-report") ? "present" : "missing", referencedKinds.includes("deployment-gate-report") ? "A deployment gate report reference is present." : "No deployment gate report reference was recorded.", ["payload.referencedArtifactKinds"]);
        addCategory("required-approvals", "Required Approvals", readStringArray(payload.requiredApprovals).length > 0 ? "present" : "missing", readStringArray(payload.requiredApprovals).length > 0 ? "Required approvals were captured." : "No required approvals were captured.", ["payload.requiredApprovals"]);
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
  const currentStageIndex = STAGE_ORDER.indexOf(currentStage as (typeof STAGE_ORDER)[number]);

  return {
    currentStage,
    stages: STAGE_ORDER.map((stage) => {
      const artifactKind = Object.entries(ARTIFACT_STAGE_MAP).find(([, mappedStage]) => mappedStage === stage)?.[0];
      const stageIndex = STAGE_ORDER.indexOf(stage);
      const status: WorkflowChainStageView["status"] = stage === currentStage ? "current" : artifactKind && referencedKinds.has(artifactKind) ? "present" : "missing";
      const required = stageIndex < currentStageIndex;
      const detail =
        status === "current"
          ? `Current run is operating at the ${STAGE_LABELS[stage]} stage.`
          : status === "present"
            ? `A ${artifactKind} reference is present for this stage.`
            : required
              ? `No upstream ${STAGE_LABELS[stage]} evidence is referenced from this run.`
              : `This downstream stage has not run yet from the current evidence chain.`;
      const traceRefs: TraceReferenceView[] = artifactKind && referencedKinds.has(artifactKind)
        ? [{ artifactKind, section: "referenced-artifact-kinds", note: `${artifactKind} is referenced by the current workflow artifact.` }]
        : primaryArtifact
          ? [{ artifactKind: primaryArtifact.artifactKind, section: "referenced-artifact-kinds", note: detail }]
          : [{ note: detail }];

      return {
        stage,
        label: STAGE_LABELS[stage],
        status,
        detail,
        required,
        traceRefs,
        reason: {
          source: "inferred",
          rule: status === "current" ? "current-stage" : status === "present" ? "referenced-upstream-stage" : required ? "missing-upstream-evidence" : "downstream-stage-not-run",
          fields: artifactKind ? ["payload.referencedArtifactKinds", "artifact.artifactKind"] : ["workflow"],
          summary: detail
        }
      };
    })
  };
}

function extractRunIdFromRef(ref: string): string | undefined {
  const match = ref.match(/\.agentops\/runs\/([^/]+)\/bundle\.json$/);
  return match?.[1];
}

function extractRunIdFromText(text: string): string | undefined {
  const match = text.match(/\.agentops\/runs\/([^/]+)\/bundle\.json/);
  return match?.[1];
}

function extractReferencedRunIds(artifacts: readonly ArtifactPanelView[]): string[] {
  return [...new Set(artifacts.flatMap((artifact) => artifact.sourceRefs.map(extractRunIdFromRef).filter((value): value is string => Boolean(value))))];
}

function isReleaseChainStage(stage: string): boolean {
  return stage === "release" || stage === "pipeline" || stage === "deployment" || stage === "promotion";
}

function resolveReleaseChainRootRunId(
  run: RunDetailView,
  runsById: ReadonlyMap<string, RunDetailView>,
  visited = new Set<string>()
): string {
  if (!isReleaseChainStage(run.workflowChain.currentStage)) {
    return run.runId;
  }

  if (run.workflowChain.currentStage === "release" || visited.has(run.runId)) {
    return run.runId;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(run.runId);
  const referencedRuns = extractReferencedRunIds(run.artifacts)
    .map((runId) => runsById.get(runId))
    .filter((candidate): candidate is RunDetailView => Boolean(candidate));

  const releaseAncestor = referencedRuns.find((candidate) => candidate.workflowChain.currentStage === "release");
  if (releaseAncestor) {
    return releaseAncestor.runId;
  }

  const releaseChainAncestor = referencedRuns.find((candidate) => isReleaseChainStage(candidate.workflowChain.currentStage));
  if (releaseChainAncestor) {
    return resolveReleaseChainRootRunId(releaseChainAncestor, runsById, nextVisited);
  }

  return run.runId;
}

function describeBlockedApproval(
  run: RunListItemView,
  artifact: ArtifactPanelView
): {
  summary: string;
  traceRefs: TraceReferenceView[];
} {
  const payload = parseArtifactPayload(artifact);
  const blockerMessages = [
    ...readStringArray(payload?.blockers),
    ...readRecordArray(payload?.verificationChecks)
      .filter((check) => readString(check.status, "") === "failed")
      .map((check) => readString(check.detail, ""))
      .filter((detail) => detail.length > 0)
  ];
  const blockerRunId = blockerMessages.map(extractRunIdFromText).find((value): value is string => Boolean(value));

  if (artifact.artifactKind === "pipeline-report") {
    const failingEvidence = blockerMessages.find((message) => message.includes("Imported CI evidence still reports failing checks"));
    if (failingEvidence) {
      return {
        summary: "Derived as blocked approval because the pipeline stage still has failing imported CI evidence in the current release chain.",
        traceRefs: [
          {
            runId: run.runId,
            artifactKind: artifact.artifactKind,
            section: "blockers",
            note: failingEvidence
          }
        ]
      };
    }
  }

  if (artifact.artifactKind === "deployment-gate-report") {
    const blockedPipelineMessage = blockerMessages.find((message) => message.includes("Pipeline report"));
    if (blockedPipelineMessage) {
      return {
        summary: "Derived as blocked approval because this deployment gate still depends on a blocked pipeline report in the same release chain.",
        traceRefs: [
          {
            runId: blockerRunId,
            artifactKind: "pipeline-report",
            section: "decision-impact",
            note: blockedPipelineMessage
          }
        ]
      };
    }
  }

  if (artifact.artifactKind === "promotion-approval-report") {
    const blockedDeploymentMessage = blockerMessages.find((message) => message.includes("Deployment gate report"));
    if (blockedDeploymentMessage) {
      return {
        summary: "Derived as blocked approval because promotion still depends on a blocked deployment gate report in the same release chain.",
        traceRefs: [
          {
            runId: blockerRunId,
            artifactKind: "deployment-gate-report",
            section: "decision-impact",
            note: blockedDeploymentMessage
          }
        ]
      };
    }
  }

  return {
    summary: `Derived as blocked approval because ${artifact.artifactKind} reported a blocked state.`,
    traceRefs: [
      {
        runId: blockerRunId ?? run.runId,
        artifactKind: artifact.artifactKind,
        section: "decision-impact",
        note: blockerMessages[0] ?? `Blocked status derived from ${artifact.artifactKind}.`
      }
    ]
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

  const traceRefs: TraceReferenceView[] = [];
  for (const finding of findings) {
    traceRefs.push({
      runId: run.runId,
      findingId: finding.id,
      section: "risk-summary",
      note: `[${finding.severity}] ${finding.title}`
    });
  }
  for (const artifact of artifacts) {
    const payload = parseArtifactPayload(artifact);
    for (const blocker of readStringArray(payload?.blockers)) {
      traceRefs.push({
        runId: run.runId,
        artifactKind: artifact.artifactKind,
        section: "blockers",
        note: blocker
      });
    }
  }

  return {
    high,
    medium,
    low,
    noisy,
    unresolved,
    blockedApprovalPrevented,
    blockerCount,
    summary,
    traceRefs,
    reason: {
      source: findLedgerEntry(run, ledgerEntries) ? "ledger" : traceRefs.length > 0 ? "artifact-blockers" : "run-findings",
      rule: findLedgerEntry(run, ledgerEntries) ? "benchmark-ledger-risk-overlay" : blockerCount > 0 ? "artifact-blockers-and-findings" : "findings-only",
      fields: findLedgerEntry(run, ledgerEntries)
        ? ["benchmark-ledger.confirmedRisks", "benchmark-ledger.confirmedRiskRefs"]
        : blockerCount > 0
          ? ["bundle.findings", "artifact.payload.blockers"]
          : ["bundle.findings"],
      summary: summary[0] ?? "No significant risk signals were recorded for this run."
    }
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
      summary: `Benchmark ledger marked this run as ${ledgerEntry.decisionOutcome.replaceAll("_", " ")}.`,
      benchmarkTaskId: ledgerEntry.taskId,
      traceRefs: ledgerEntry.triggerRefs,
      reason: {
        source: "ledger",
        rule: "benchmark-ledger-decision-outcome",
        fields: ["benchmark-ledger.decisionOutcome", "benchmark-ledger.agentforgeChangedDecision", "benchmark-ledger.triggerRefs"],
        summary: ledgerEntry.decisionImpactReason ?? ledgerEntry.summary ?? `Adjudicated benchmark result: ${ledgerEntry.decisionOutcome.replaceAll("_", " ")}.`
      }
    };
  }

  const evidence = buildEvidenceCompleteness(run.workflow, artifacts);
  const blockerArtifact = artifacts.find((artifact) => {
    const payload = parseArtifactPayload(artifact);
    return artifact.status === "blocked" || payload?.gateStatus === "blocked" || payload?.approvalStatus === "blocked" || payload?.reviewStatus === "blocked" || payload?.readinessStatus === "blocked";
  });
  if (blockerArtifact) {
    const blockedApproval = describeBlockedApproval(run, blockerArtifact);
    return {
      kind: "blocked_approval",
      changedDecision: true,
      source: "inferred",
      summary: `The run emitted a blocked ${blockerArtifact.artifactKind}, which would halt approval or release flow.`,
      traceRefs: blockedApproval.traceRefs,
      reason: {
        source: "inferred",
        rule: "blocked-artifact-status",
        fields: ["artifact.status", "payload.readinessStatus", "payload.reviewStatus", "payload.gateStatus", "payload.approvalStatus"],
        summary: blockedApproval.summary
      }
    };
  }

  if (artifacts.some((artifact) => readStringArray(parseArtifactPayload(artifact)?.blockers).length > 0) || findings.length > 0 || run.status !== "success") {
    return {
      kind: "remediation_before_merge",
      changedDecision: true,
      source: "inferred",
      summary: "The run surfaced blockers or findings that imply remediation before merge or promotion.",
      traceRefs: [
        ...findings.map((finding) => ({
          runId: run.runId,
          findingId: finding.id,
          section: "findings",
          note: `[${finding.severity}] ${finding.title}`
        })),
        ...artifacts.flatMap((artifact) =>
          readStringArray(parseArtifactPayload(artifact)?.blockers).map((blocker) => ({
            runId: run.runId,
            artifactKind: artifact.artifactKind,
            section: "blockers",
            note: blocker
          }))
        )
      ],
      reason: {
        source: "inferred",
        rule: "findings-or-blockers-present",
        fields: ["bundle.findings", "artifact.payload.blockers", "bundle.status"],
        summary: "Derived as remediation before merge because findings, blockers, or non-success bundle status were present."
      }
    };
  }

  if (evidence.some((artifact) => artifact.categories.some((category) => category.status !== "present"))) {
    const firstGap = evidence.flatMap((artifact) => artifact.categories).find((category) => category.status !== "present");
    return {
      kind: "added_validation",
      changedDecision: true,
      source: "inferred",
      summary: "The run highlighted missing or partial evidence that should change the validation plan.",
      traceRefs: firstGap?.traceRefs ?? [{ runId: run.runId, section: "evidence-completeness", note: "Missing or partial evidence was detected." }],
      reason: {
        source: "inferred",
        rule: "evidence-completeness-gap",
        fields: firstGap?.reason.fields ?? ["artifact.payload"],
        summary:
          firstGap
            ? `Derived as added validation because ${firstGap.label} is ${firstGap.status}: ${firstGap.detail}`
            : "Derived as added validation because at least one evidence category was not fully present."
      }
    };
  }

  if (run.workflow === "planning-discovery") {
    return {
      kind: "added_confidence",
      changedDecision: false,
      source: "inferred",
      summary: "The planning run improved scope clarity but did not clearly force a different implementation path.",
      traceRefs: [{ runId: run.runId, section: "decision-impact", note: "Planning runs improve confidence unless stronger blockers or evidence gaps exist." }],
      reason: {
        source: "inferred",
        rule: "planning-confidence-default",
        fields: ["workflow"],
        summary: "Derived as added confidence because the workflow is planning-discovery and no stronger outcome rule matched."
      }
    };
  }

  return {
    kind: "no_meaningful_change",
    changedDecision: false,
    source: "inferred",
    summary: "The run completed cleanly without a clear decision delta beyond baseline inspection.",
    traceRefs: [{ runId: run.runId, section: "decision-impact", note: "No blockers, findings, or evidence gaps changed the inferred outcome." }],
    reason: {
      source: "inferred",
      rule: "clean-run-default",
      fields: ["bundle.findings", "artifact.payload.blockers", "evidence-completeness"],
      summary: "Derived as no meaningful change because the run completed cleanly and no decision-changing signals were found."
    }
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

function buildLeadershipRuns(runs: readonly RunDetailView[]): RunDetailView[] {
  const runsById = new Map(runs.map((run) => [run.runId, run]));
  const grouped = new Map<string, RunDetailView>();

  for (const run of runs) {
    if (!isReleaseChainStage(run.workflowChain.currentStage)) {
      grouped.set(`run:${run.runId}`, run);
      continue;
    }

    const rootRunId = resolveReleaseChainRootRunId(run, runsById);
    const key = `release-chain:${rootRunId}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        ...run,
        workflowChain: {
          ...run.workflowChain,
          chainKey: key
        }
      });
      continue;
    }

    const currentStageIndex = STAGE_ORDER.indexOf(current.workflowChain.currentStage as (typeof STAGE_ORDER)[number]);
    const nextStageIndex = STAGE_ORDER.indexOf(run.workflowChain.currentStage as (typeof STAGE_ORDER)[number]);
    if (nextStageIndex >= currentStageIndex) {
      grouped.set(key, {
        ...run,
        workflowChain: {
          ...run.workflowChain,
          chainKey: key
        }
      });
    }
  }

  return [...grouped.values()].sort((left, right) => {
    const leftCompletedAt = parseRunTimestampMs(left.finishedAt) ?? parseRunTimestampMs(left.startedAt) ?? parseRunTimestampMs(left.runId) ?? 0;
    const rightCompletedAt = parseRunTimestampMs(right.finishedAt) ?? parseRunTimestampMs(right.startedAt) ?? parseRunTimestampMs(right.runId) ?? 0;

    if (leftCompletedAt === rightCompletedAt) {
      return right.runId.localeCompare(left.runId);
    }

    return rightCompletedAt - leftCompletedAt;
  });
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

function matchesOutcomeFilters(
  row: OutcomeDetailRowView,
  filters: OutcomesFilters
): boolean {
  if (filters.workflow && row.workflow !== filters.workflow) {
    return false;
  }
  if (filters.panel === "decision-impact") {
    if (filters.decision === "changed" && !row.id.includes("changed")) {
      return false;
    }
    if (filters.decision && filters.decision !== "changed" && !row.id.includes(filters.decision)) {
      return false;
    }
  }
  if (filters.panel === "risk" && filters.risk && !row.id.includes(filters.risk)) {
    return false;
  }
  if (filters.panel === "evidence") {
    if (filters.evidenceCategory && !row.id.includes(filters.evidenceCategory)) {
      return false;
    }
    if (filters.evidenceStatus && !row.id.includes(filters.evidenceStatus)) {
      return false;
    }
  }
  if (filters.panel === "flow" && filters.stage && !row.id.includes(filters.stage)) {
    return false;
  }
  return true;
}

function createOutcomeDetailRows(runs: readonly RunDetailView[], ledger: BenchmarkLedgerView, filters: OutcomesFilters): OutcomesDashboardView["details"] {
  const decision = runs
    .map((run) => ({
      id: `decision:${run.decisionImpact.kind}:${run.decisionImpact.changedDecision ? "changed" : "unchanged"}:${run.runId}`,
      workflow: run.workflow,
      runId: run.runId,
      status: run.status,
      title: run.decisionImpact.kind.replaceAll("_", " "),
      summary: run.decisionImpact.reason.summary,
      source: run.decisionImpact.source,
      detailHref: toRunDetailHref(run.runId, "decision-impact"),
      runsHref: toRunsFilterHref({ decisionImpact: run.decisionImpact.kind }),
      traceRefs: run.decisionImpact.traceRefs
    }))
    .filter((row) => matchesOutcomeFilters(row, filters));

  const risk = runs
    .flatMap((run) =>
      run.riskSummary.traceRefs.length > 0
        ? run.riskSummary.traceRefs.map((traceRef, index) => ({
            id: `risk:${run.riskKinds[0] ?? "unresolved"}:${run.runId}:${index}`,
            workflow: run.workflow,
            runId: run.runId,
            status: run.status,
            title: traceRef.note,
            summary: run.riskSummary.reason.summary,
            source: run.riskSummary.reason.source,
            detailHref: toRunDetailHref(run.runId, "risk-summary"),
            runsHref: toRunsFilterHref({ riskKind: run.riskKinds[0] ?? "unresolved" }),
            traceRefs: [traceRef]
          }))
        : [{
            id: `risk:none:${run.runId}`,
            workflow: run.workflow,
            runId: run.runId,
            status: run.status,
            title: "No significant risk signals",
            summary: run.riskSummary.reason.summary,
            source: run.riskSummary.reason.source,
            detailHref: toRunDetailHref(run.runId, "risk-summary"),
            runsHref: toRunsFilterHref({ riskKind: "unresolved" }),
            traceRefs: run.riskSummary.traceRefs
          }]
    )
    .filter((row) => matchesOutcomeFilters(row, filters));

  const evidence = runs
    .flatMap((run) =>
      run.evidenceCompleteness.flatMap((artifact) =>
        artifact.categories.map((category) => ({
          id: `evidence:${category.key}:${category.status}:${run.runId}`,
          workflow: run.workflow,
          runId: run.runId,
          status: run.status,
          title: `${category.label} (${category.status})`,
          summary: category.reason.summary,
          source: category.reason.source,
          detailHref: toRunDetailHref(run.runId, "evidence-completeness"),
          runsHref: toRunsFilterHref({ evidenceCategory: category.key, evidenceStatus: category.status }),
          traceRefs: category.traceRefs
        }))
      )
    )
    .filter((row) => matchesOutcomeFilters(row, filters));

  const friction = ledger.entries
    .filter((entry) => entry.arm === "agentforge")
    .map((entry) => ({
      id: `friction:${entry.workflow ?? "unknown"}:${entry.friction.override ? "override" : "no-override"}:${entry.taskId}`,
      workflow: entry.workflow ?? "unknown",
      runId: entry.runId ?? "n/a",
      status: entry.workflowStatuses[0]?.status ?? "unknown",
      title: entry.summary ?? entry.friction.overrideReason ?? "Benchmark friction entry",
      summary:
        entry.friction.overrideReason ??
        entry.decisionImpactReason ??
        entry.notes[0] ??
        "Ledger-backed friction/adjudication entry.",
      source: "ledger",
      detailHref: entry.runId ? toRunDetailHref(entry.runId, "decision-impact") : "/outcomes#friction",
      runsHref: toRunsFilterHref({
        workflow: entry.workflow,
        hasOverride: entry.friction.override ? "true" : undefined
      }),
      traceRefs: [
        ...entry.friction.falsePositiveRefs,
        ...entry.triggerRefs,
        ...entry.evidenceGapRefs
      ]
    }))
    .filter((row) => matchesOutcomeFilters(row, filters));

  const workflowChain = runs
    .flatMap((run) =>
      run.workflowChain.stages
        .filter((stage) => stage.status !== "present")
        .map((stage) => ({
          id: `flow:${stage.stage}:${stage.status}:${run.runId}`,
          workflow: run.workflow,
          runId: run.runId,
          status: run.status,
          title: `${stage.label} (${stage.status})`,
          summary: stage.reason.summary,
          source: stage.reason.source,
          detailHref: toRunDetailHref(run.runId, "workflow-chain"),
          runsHref: toRunsFilterHref({ workflowStage: stage.stage }),
          traceRefs: stage.traceRefs
        }))
    )
    .filter((row) => matchesOutcomeFilters(row, filters));

  return { decision, risk, evidence, friction, workflowChain };
}

export function parseOutcomesFilters(searchParams: URLSearchParams): OutcomesFilters {
  const panel = searchParams.get("panel");
  return {
    panel:
      panel === "decision-impact" || panel === "risk" || panel === "evidence" || panel === "friction" || panel === "flow"
        ? panel
        : undefined,
    decision: (searchParams.get("decision") as OutcomesFilters["decision"] | null) ?? undefined,
    risk: searchParams.get("risk") ?? undefined,
    workflow: searchParams.get("workflow") ?? undefined,
    evidenceCategory: searchParams.get("evidenceCategory") ?? undefined,
    evidenceStatus: (searchParams.get("evidenceStatus") as OutcomesFilters["evidenceStatus"] | null) ?? undefined,
    stage: searchParams.get("stage") ?? undefined
  };
}

export function loadOutcomesDashboardView(
  workspaceRoot: string,
  runsRoot = resolveRunsRoot(workspaceRoot),
  benchmarkLedgerPath?: string,
  filters: OutcomesFilters = {}
): OutcomesDashboardView {
  const runsIndex = loadRunsIndexView(workspaceRoot, runsRoot, {}, benchmarkLedgerPath);
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

  const friction = aggregateFriction(runs, ledger);
  const workflowChains = aggregateWorkflowChainSummary(runs);
  const leadershipRuns = buildLeadershipRuns(runs);
  const topEvidenceGap = evidence[0]?.frequentMissing[0];
  const topFrictionWorkflow = friction.workflowHotspots[0];
  const topWorkflowChain = [...workflowChains].sort((left, right) => right.missingUpstreamEvidenceCount - left.missingUpstreamEvidenceCount)[0];
  const details = createOutcomeDetailRows(runs, ledger, filters);

  return {
    ledger,
    decisionImpact: {
      changedDecisionCount: leadershipRuns.filter((run) => run.decisionImpact.changedDecision).length,
      scopeReductionCount: countOutcome(leadershipRuns, "scope_reduction"),
      addedValidationCount: countOutcome(leadershipRuns, "added_validation"),
      blockedApprovalCount: countOutcome(leadershipRuns, "blocked_approval"),
      remediationCount: countOutcome(leadershipRuns, "remediation_before_merge"),
      addedConfidenceCount: countOutcome(leadershipRuns, "added_confidence"),
      noMeaningfulChangeCount: countOutcome(leadershipRuns, "no_meaningful_change"),
      comparableBenchmarkPairs: comparableTaskIds.size
    },
    risk: {
      confirmedHighCount: ledger.entries.reduce((total, entry) => total + entry.confirmedRisks.high, 0),
      confirmedMediumCount: ledger.entries.reduce((total, entry) => total + entry.confirmedRisks.medium, 0),
      noisyFindingCount: ledger.entries.reduce((total, entry) => total + entry.confirmedRisks.noisy, 0),
      blockedApprovalPreventedCount: leadershipRuns.filter((run) => run.riskSummary.blockedApprovalPrevented).length,
      unresolvedRiskCount: leadershipRuns.reduce((total, run) => total + run.riskSummary.unresolved, 0)
    },
    evidence,
    friction,
    workflowChains,
    runCount: runs.length,
    filteredPanel: filters.panel,
    filters,
    summaries: {
      decision: [
        {
          label: "Changed decisions",
          value: leadershipRuns.filter((run) => run.decisionImpact.changedDecision).length,
          detail: `${leadershipRuns.length} leadership-scoped run or chain outcome(s) in view`,
          href: toOutcomesFilterHref({ panel: "decision-impact", decision: "changed" }, "decision-impact")
        },
        {
          label: "Blocked approval chains",
          value: countOutcome(leadershipRuns, "blocked_approval"),
          detail: "Release chains are counted once at their most downstream blocked gate",
          href: toOutcomesFilterHref({ panel: "decision-impact", decision: "blocked_approval" }, "decision-impact")
        },
        {
          label: "Added validation",
          value: countOutcome(leadershipRuns, "added_validation"),
          detail: "Runs where evidence gaps changed the next step",
          href: toOutcomesFilterHref({ panel: "decision-impact", decision: "added_validation" }, "decision-impact")
        }
      ],
      risk: [
        {
          label: "Blocked approval chains prevented",
          value: leadershipRuns.filter((run) => run.riskSummary.blockedApprovalPrevented).length,
          detail: "Release chains are counted once at their most downstream blocked gate",
          href: toOutcomesFilterHref({ panel: "risk", risk: "blocked-approval" }, "risk")
        },
        {
          label: "Confirmed medium/high",
          value: ledger.entries.reduce((total, entry) => total + entry.confirmedRisks.high + entry.confirmedRisks.medium, 0),
          detail: "Ledger-backed adjudicated risks",
          href: toOutcomesFilterHref({ panel: "risk", risk: "confirmed-medium" }, "risk")
        },
        {
          label: "Unresolved risks",
          value: leadershipRuns.reduce((total, run) => total + run.riskSummary.unresolved, 0),
          detail: "Outstanding risk and blocker signals across runs",
          href: toOutcomesFilterHref({ panel: "risk", risk: "unresolved" }, "risk")
        }
      ],
      evidence: [
        {
          label: "Largest evidence gap",
          value: evidence[0]?.missingCount ?? 0,
          detail: topEvidenceGap ?? "No recurring gaps found",
          href: toOutcomesFilterHref(
            {
              panel: "evidence",
              evidenceCategory: topEvidenceGap?.startsWith("CI Evidence") ? "ci-evidence" : undefined,
              evidenceStatus: "missing"
            },
            "evidence"
          )
        }
      ],
      friction: [
        {
          label: "Highest friction workflow",
          value:
            (topFrictionWorkflow?.overrideCount ?? 0) +
            (topFrictionWorkflow?.falsePositiveCount ?? 0) +
            (topFrictionWorkflow?.manualStepCount ?? 0) +
            (topFrictionWorkflow?.requestFrictionCount ?? 0),
          detail: topFrictionWorkflow?.workflow ?? "No ledger-backed friction data",
          href: toOutcomesFilterHref({ panel: "friction", workflow: topFrictionWorkflow?.workflow }, "friction")
        }
      ],
      workflowChain: [
        {
          label: "Release chain breaks",
          value: topWorkflowChain?.missingUpstreamEvidenceCount ?? 0,
          detail: topWorkflowChain ? `${topWorkflowChain.label} has the most missing upstream evidence` : "No chain breakpoints detected",
          href: toOutcomesFilterHref({ panel: "flow", stage: topWorkflowChain?.stage }, "workflow-chain")
        }
      ]
    },
    details
  };
}

export function loadValueDashboardView(
  workspaceRoot: string,
  runsRoot = resolveRunsRoot(workspaceRoot),
  benchmarkLedgerPath?: string,
  filters: OutcomesFilters = {}
): OutcomesDashboardView {
  return loadOutcomesDashboardView(workspaceRoot, runsRoot, benchmarkLedgerPath, filters);
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
