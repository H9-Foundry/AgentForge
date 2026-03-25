import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import process from "node:process";

import yaml from "js-yaml";

import { buildAuditBundle, createAuditEntry, renderAuditBundleMarkdown } from "@h9-foundry/agentforge-audit";
import { createWorkflowState, detectLanguages, findWorkspaceRoot } from "@h9-foundry/agentforge-context-engine";
import { createPolicyEngine, loadPolicyDocument, resolvePolicy } from "@h9-foundry/agentforge-policy-engine";
import { runWorkflow } from "@h9-foundry/agentforge-runtime";
import {
  createOutcomesExportDocument,
  readVisualizerSummary,
  renderOutcomesExportMarkdown,
  resolveBenchmarkLedgerPath as resolveVisualizerBenchmarkLedgerPath,
  resolveRunsRoot as resolveVisualizerRunsRoot,
  startVisualizerServer
} from "@h9-foundry/agentforge-visualizer";
import type {
  OutcomesExportDocument,
  VisualizerConfigAgentBindingEditorModel,
  VisualizerConfigBindingSelectionModel,
  VisualizerConfigEditor,
  VisualizerConfigEditorModel,
  VisualizerConfigFieldInput,
  VisualizerConfigFieldModel,
  VisualizerConfigOption,
  VisualizerConfigPreviewResult,
  VisualizerConfigRenderResult,
  VisualizerConfigSaveResult
} from "@h9-foundry/agentforge-visualizer";
import {
  agentforgeConfigSchema,
  auditBundleSchema,
  benchmarkArtifactSchema,
  benchmarkLedgerDocumentSchema,
  benchmarkLedgerEntrySchema,
  benchmarkLedgerTokenUsageSchema,
  controlPlaneDefaultsSchema,
  designArtifactSchema,
  designRequestSchema,
  deploymentRequestSchema,
  evalArtifactSchema,
  evalFixtureCorpusSchema,
  implementationRequestSchema,
  incidentRequestSchema,
  maintenanceRequestSchema,
  pipelineRequestSchema,
  planningArtifactSchema,
  planningRequestSchema,
  policyPresetDocumentSchema,
  promotionRequestSchema,
  qaRequestSchema,
  repoFitContractSchema,
  requestMetaSchema,
  releaseRequestSchema,
  resolvedRunConfigurationSnapshotSchema,
  schemaVersion,
  schemaFixtures,
  securityRequestSchema,
  workflowControlDefinitionSchema,
  workflowDefinitionSchema
} from "@h9-foundry/agentforge-schemas";
import type {
  AgentForgeConfig,
  AgentPluginRegistration,
  BenchmarkCategory,
  BenchmarkComparedRun,
  BenchmarkDecisionClarity,
  BenchmarkDeterministicDelta,
  BenchmarkDecisionOutcome,
  BenchmarkLedgerArm,
  BenchmarkLedgerDocument,
  BenchmarkLedgerEntry,
  BenchmarkLedgerTokenUsage,
  BenchmarkLedgerTraceReference,
  BenchmarkLedgerWorkflowStatus,
  BenchmarkReleaseDecision,
  BlockedPlugin,
  DesignArtifact,
  DesignRequest,
  DeploymentRequest,
  EvalDeterministicCheck,
  EvalFixtureCorpus,
  EvalModelDependentCheck,
  EvalSpec,
  EvalSetupRun,
  GithubReference,
  GithubWorkflowStatusMapping,
  ImplementationRequest,
  IncidentRequest,
  MaintenanceRequest,
  PipelineRequest,
  PlanningArtifact,
  PlanningRequest,
  PolicyPresetDocument,
  PromotionRequest,
  ProviderUsageAggregate,
  QaRequest,
  RepoFitContract,
  RequestMeta,
  ResolvedRunConfigurationSnapshot,
  ReleaseRequest,
  ScmReference,
  SecurityRequest,
  WorkflowControlDefinition,
  WorkflowDefinition
} from "@h9-foundry/agentforge-shared-types";
import type { RuntimeAgent, ToolAdapter } from "@h9-foundry/agentforge-sdk";

import { createBuiltinAdapters } from "./internal/builtin-adapters.js";
import { createBuiltinAgentRegistry } from "./internal/builtin-agents.js";
import { LocalPluginRegistry } from "./internal/local-plugin-registry.js";
export {
  checkReleaseReadiness,
  getReleaseGuide,
  renderReleaseGuide,
  TARGET_NPM_SCOPE,
  EXPECTED_PUBLIC_PACKAGES
} from "./internal/release-preflight.js";
export type { ReleaseCheckEntry, ReleaseCheckResult, ReleaseGuide } from "./internal/release-preflight.js";
export { verifyReleaseArtifacts } from "./internal/release-verification.js";
export type { ReleaseVerifyEntry, ReleaseVerifyResult, ReleaseVerifyTarball } from "./internal/release-verification.js";

export const startupPresetNames = ["planning-discovery"] as const;
export type StartupPresetName = (typeof startupPresetNames)[number];

const controlDirName = "control";
const policyPresetsFileName = "policy-presets.yaml";
const controlDefaultsFileName = "defaults.yaml";
const repoFitFileName = "repo-fit.yaml";

const repoFitProfileIds = ["none", "agentforge-ts-monorepo", "agentforge-ts-package", "agentforge-python-service", "agentforge-rust-crate"] as const;
type RepoFitProfileId = (typeof repoFitProfileIds)[number];
type RepoFitStarterAdoption = "none" | "partial" | "full";

interface RepoFitStarterProfileCatalogEntry {
  id: Exclude<RepoFitProfileId, "none">;
  label: string;
  architectureStyle: string;
  sourceRoots: string[];
  packageRoots: string[];
  coding: string[];
  designPatterns: string[];
  testingConventions: string[];
  releaseConventions: string[];
  securityConventions: string[];
  documentationConventions: string[];
  operationsConventions: string[];
  validationCommands: string[];
  evidenceSources: string[];
  recommendedWorkflowFamilies: OnboardingWorkflowFamily[];
}

const repoFitStarterProfiles: Record<Exclude<RepoFitProfileId, "none">, RepoFitStarterProfileCatalogEntry> = {
  "agentforge-ts-monorepo": {
    id: "agentforge-ts-monorepo",
    label: "AgentForge TypeScript Monorepo",
    architectureStyle: "typescript-monorepo",
    sourceRoots: ["packages", "apps", "services"],
    packageRoots: ["packages", "apps", "services"],
    coding: ["Prefer strict TypeScript and explicit public package boundaries.", "Keep ESM module surfaces stable and small."],
    designPatterns: ["Package-first architecture with explicit manifests, schemas, and runtime boundaries.", "Prefer deterministic workflow surfaces and typed contracts over implicit conventions."],
    testingConventions: ["Run focused package tests before broad integration suites.", "Keep default validation local and credential-free."],
    releaseConventions: ["Treat package verification and packed tarball checks as release gates."],
    securityConventions: ["Keep writes approval-gated and policy-aware across package boundaries."],
    documentationConventions: ["Version public package behavior in repo docs alongside code changes."],
    operationsConventions: ["Prefer local-first evidence and explicit promotion gates over hosted automation defaults."],
    validationCommands: ["pnpm build:packages", "pnpm test"],
    evidenceSources: [".github/workflows", "docs/release-runbook.md"],
    recommendedWorkflowFamilies: ["review/planning", "qa/security", "release/pipeline/deployment", "maintenance/incident"]
  },
  "agentforge-ts-package": {
    id: "agentforge-ts-package",
    label: "AgentForge TypeScript Package",
    architectureStyle: "typescript-package",
    sourceRoots: ["src", "tests"],
    packageRoots: [],
    coding: ["Prefer strict TypeScript and stable package entrypoints.", "Keep implementation and tests close to the shipped surface."],
    designPatterns: ["Treat src as the canonical implementation root with explicit exported interfaces.", "Use typed request and artifact contracts for workflow inputs and outputs."],
    testingConventions: ["Use package-script lint, test, and build checks before release."],
    releaseConventions: ["Publish only after packed tarball verification matches intended docs and entrypoints."],
    securityConventions: ["Keep policy defaults read-first and approval-gated for writes."],
    documentationConventions: ["Keep package README and repo docs aligned with the published CLI/package surface."],
    operationsConventions: ["Prefer simple local CI/release evidence over hosted state."],
    validationCommands: ["npm test", "npm run build"],
    evidenceSources: ["package.json", ".github/workflows"],
    recommendedWorkflowFamilies: ["review/planning", "qa/security"]
  },
  "agentforge-python-service": {
    id: "agentforge-python-service",
    label: "AgentForge Python Service",
    architectureStyle: "python-service",
    sourceRoots: ["src", "service", "app", "tests"],
    packageRoots: [],
    coding: ["Prefer explicit service boundaries and dependency declarations.", "Keep validation and operational evidence repo-local when possible."],
    designPatterns: ["Treat service entrypoints, config, and tests as first-class architecture surfaces.", "Use bounded workflow inputs tied to repo evidence rather than ad hoc prompts."],
    testingConventions: ["Keep lint, unit, and integration validation explicitly scripted."],
    releaseConventions: ["Capture deployment and rollback evidence in repo docs or CI config."],
    securityConventions: ["Prefer explicit security review inputs and bounded evidence normalization."],
    documentationConventions: ["Keep service runbooks and incident docs in repo."],
    operationsConventions: ["Model deploy and incident surfaces explicitly before adding automation."],
    validationCommands: ["pytest"],
    evidenceSources: ["pyproject.toml", "requirements.txt", "docs/deployment.md"],
    recommendedWorkflowFamilies: ["review/planning", "qa/security", "release/pipeline/deployment", "maintenance/incident"]
  },
  "agentforge-rust-crate": {
    id: "agentforge-rust-crate",
    label: "AgentForge Rust Crate",
    architectureStyle: "rust-crate",
    sourceRoots: ["src", "tests", "benches"],
    packageRoots: [],
    coding: ["Prefer explicit crate boundaries and stable public APIs.", "Keep validation deterministic and cargo-driven by default."],
    designPatterns: ["Use crate/module boundaries as the architecture contract.", "Keep implementation and testing expectations explicit in repo scripts or docs."],
    testingConventions: ["Use cargo test/build/check as the default validation surface."],
    releaseConventions: ["Treat Cargo metadata and release docs as the source of packaging truth."],
    securityConventions: ["Preserve explicit review around unsafe or sensitive runtime surfaces."],
    documentationConventions: ["Keep crate-level docs and release notes in repo."],
    operationsConventions: ["Prefer explicit artifact and deployment evidence for release workflows."],
    validationCommands: ["cargo test", "cargo build"],
    evidenceSources: ["Cargo.toml", ".github/workflows"],
    recommendedWorkflowFamilies: ["review/planning", "qa/security"]
  }
};

interface RepoFitWizardAnswers {
  architectureStyle?: string;
  sourceRoots?: string[];
  packageRoots?: string[];
  ownershipBoundaries?: string[];
  pathConventions?: string[];
  validationCommands?: string[];
  evidenceSources?: string[];
  codingConventions?: string[];
  designPatterns?: string[];
  testingConventions?: string[];
  releaseConventions?: string[];
  securityConventions?: string[];
  documentationConventions?: string[];
  operationsConventions?: string[];
  selectedProfileId?: RepoFitProfileId;
  adoption?: RepoFitStarterAdoption;
}

const workflowRequestPaths: Record<string, string> = {
  "planning-discovery": ".agentops/requests/planning.yaml",
  "architecture-design-review": ".agentops/requests/design.yaml",
  "implementation-proposal": ".agentops/requests/implementation.yaml",
  "qa-review": ".agentops/requests/qa.yaml",
  "security-review": ".agentops/requests/security.yaml",
  "pipeline-evidence-review": ".agentops/requests/pipeline.yaml",
  "release-readiness": ".agentops/requests/release.yaml",
  "deployment-gate-review": ".agentops/requests/deployment.yaml",
  "promotion-approval": ".agentops/requests/promotion.yaml",
  "incident-handoff": ".agentops/requests/incident.yaml",
  "maintenance-triage": ".agentops/requests/maintenance.yaml"
};

const workflowMissingRequestErrors: Record<string, string> = {
  "planning-discovery": "Missing planning request",
  "architecture-design-review": "Missing design request",
  "implementation-proposal": "Missing implementation request",
  "qa-review": "Missing QA request",
  "security-review": "Missing security request",
  "pipeline-evidence-review": "Missing pipeline request",
  "release-readiness": "Missing release request",
  "deployment-gate-review": "Missing deployment request",
  "promotion-approval": "Missing promotion request",
  "incident-handoff": "Missing incident request",
  "maintenance-triage": "Missing maintenance request"
};

type WorkflowFieldInput = "text" | "textarea" | "string-array" | "path-array" | "select" | "name-version-array" | "json";

interface WorkflowFieldDescriptor {
  path: string;
  label: string;
  input?: WorkflowFieldInput;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
}

const workflowFieldMetadata: Record<string, WorkflowFieldDescriptor[]> = {
  "planning-discovery": [
    { path: "problemStatement", label: "Problem Statement", input: "textarea" },
    { path: "goals", label: "Goals", input: "string-array" },
    { path: "constraints", label: "Constraints", input: "string-array" },
    { path: "issueRefs", label: "Issue References", input: "string-array" },
    { path: "pathHints", label: "Path Hints", input: "path-array" },
    { path: "assumptions", label: "Assumptions", input: "string-array" }
  ],
  "architecture-design-review": [
    { path: "planningBriefRef", label: "Planning Brief Reference", input: "text" },
    { path: "decisionTarget", label: "Decision Target", input: "textarea" },
    { path: "constraints", label: "Constraints", input: "string-array" },
    { path: "pathHints", label: "Path Hints", input: "path-array" },
    { path: "alternatives", label: "Alternatives", input: "string-array" },
    { path: "questions", label: "Open Questions", input: "string-array" }
  ],
  "implementation-proposal": [
    { path: "designRecordRef", label: "Design Record Reference", input: "text" },
    { path: "implementationGoal", label: "Implementation Goal", input: "textarea" },
    { path: "targetPaths", label: "Target Paths", input: "path-array" },
    { path: "validationCommands", label: "Validation Commands", input: "string-array" },
    { path: "constraints", label: "Constraints", input: "string-array" },
    {
      path: "approvalMode",
      label: "Approval Mode",
      input: "select",
      options: [
        { label: "Proposal Only", value: "proposal-only" },
        { label: "Apply Capable", value: "apply-capable" }
      ]
    }
  ],
  "qa-review": [
    { path: "targetRef", label: "Target Reference", input: "text" },
    { path: "evidenceSources", label: "Evidence Sources", input: "path-array" },
    { path: "executedChecks", label: "Executed Checks", input: "string-array" },
    { path: "focusAreas", label: "Focus Areas", input: "string-array" },
    { path: "constraints", label: "Constraints", input: "string-array" },
    {
      path: "releaseContext",
      label: "Release Context",
      input: "select",
      options: [
        { label: "None", value: "none" },
        { label: "Candidate", value: "candidate" },
        { label: "Blocking", value: "blocking" }
      ]
    }
  ],
  "security-review": [
    { path: "targetRef", label: "Target Reference", input: "text" },
    { path: "evidenceSources", label: "Evidence Sources", input: "path-array" },
    { path: "focusAreas", label: "Focus Areas", input: "string-array" },
    { path: "constraints", label: "Constraints", input: "string-array" },
    {
      path: "releaseContext",
      label: "Release Context",
      input: "select",
      options: [
        { label: "None", value: "none" },
        { label: "Candidate", value: "candidate" },
        { label: "Blocking", value: "blocking" }
      ]
    }
  ],
  "pipeline-evidence-review": [
    { path: "pipelineScope", label: "Pipeline Scope", input: "textarea" },
    { path: "evidenceSources", label: "Evidence Sources", input: "path-array" },
    { path: "qaReportRefs", label: "QA Report References", input: "path-array" },
    { path: "securityReportRefs", label: "Security Report References", input: "path-array" },
    { path: "releaseReportRefs", label: "Release Report References", input: "path-array" },
    { path: "issueRefs", label: "Issue References", input: "string-array" },
    { path: "focusAreas", label: "Focus Areas", input: "string-array" },
    { path: "constraints", label: "Constraints", input: "string-array" }
  ],
  "release-readiness": [
    { path: "releaseScope", label: "Release Scope", input: "textarea" },
    { path: "versionTargets", label: "Version Targets", input: "name-version-array" },
    { path: "qaReportRefs", label: "QA Report References", input: "path-array" },
    { path: "securityReportRefs", label: "Security Report References", input: "path-array" },
    { path: "evidenceSources", label: "Evidence Sources", input: "path-array" },
    { path: "constraints", label: "Constraints", input: "string-array" }
  ],
  "deployment-gate-review": [
    { path: "deploymentScope", label: "Deployment Scope", input: "textarea" },
    { path: "targetEnvironment", label: "Target Environment", input: "text" },
    { path: "evidenceSources", label: "Evidence Sources", input: "path-array" },
    { path: "qaReportRefs", label: "QA Report References", input: "path-array" },
    { path: "securityReportRefs", label: "Security Report References", input: "path-array" },
    { path: "releaseReportRefs", label: "Release Report References", input: "path-array" },
    { path: "pipelineReportRefs", label: "Pipeline Report References", input: "path-array" },
    { path: "issueRefs", label: "Issue References", input: "string-array" },
    { path: "constraints", label: "Constraints", input: "string-array" }
  ],
  "promotion-approval": [
    { path: "promotionScope", label: "Promotion Scope", input: "textarea" },
    { path: "targetEnvironment", label: "Target Environment", input: "text" },
    { path: "evidenceSources", label: "Evidence Sources", input: "path-array" },
    { path: "qaReportRefs", label: "QA Report References", input: "path-array" },
    { path: "securityReportRefs", label: "Security Report References", input: "path-array" },
    { path: "releaseReportRefs", label: "Release Report References", input: "path-array" },
    { path: "deploymentGateReportRefs", label: "Deployment Gate Report References", input: "path-array" },
    { path: "issueRefs", label: "Issue References", input: "string-array" },
    { path: "constraints", label: "Constraints", input: "string-array" }
  ],
  "incident-handoff": [
    { path: "incidentSummary", label: "Incident Summary", input: "textarea" },
    {
      path: "severityHint",
      label: "Severity Hint",
      input: "select",
      options: [
        { label: "Unknown", value: "unknown" },
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
        { label: "Critical", value: "critical" }
      ]
    },
    { path: "evidenceSources", label: "Evidence Sources", input: "path-array" },
    { path: "releaseReportRefs", label: "Release Report References", input: "path-array" },
    { path: "issueRefs", label: "Issue References", input: "string-array" },
    { path: "constraints", label: "Constraints", input: "string-array" }
  ],
  "maintenance-triage": [
    { path: "maintenanceGoal", label: "Maintenance Goal", input: "textarea" },
    { path: "dependencyAlertRefs", label: "Dependency Alerts", input: "string-array" },
    { path: "docsTaskRefs", label: "Docs Tasks", input: "string-array" },
    { path: "releaseReportRefs", label: "Release Report References", input: "path-array" },
    { path: "issueRefs", label: "Issue References", input: "string-array" },
    { path: "constraints", label: "Constraints", input: "string-array" }
  ]
};

type ConfigDocumentTarget = "request" | "workflow-control" | "policy-presets" | "defaults" | "repo-fit";
type ConfigDocumentOverrides = Record<string, string>;
type RequestEditorFieldState = Record<string, unknown>;

const executionModeOptions = ["inspect", "suggest", "apply"] as const;
const permissionOptions = ["allow", "approval_required", "deny"] as const;

function labelizeConfigValue(value: string): string {
  return value
    .split(/[-_]/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function toEditorOptions(values: readonly string[]): VisualizerConfigOption[] {
  return values.map((value) => ({ label: labelizeConfigValue(value), value }));
}

export interface ConfigValidationResult {
  root: string;
  valid: boolean;
  workflows: Array<{
    workflow: string;
    requestPath: string;
    profileCount: number;
    variantCount: number;
    policyPresetCount: number;
    bindingCount: number;
  }>;
  errors: string[];
}

const agentforgeConfigTemplate = `version: 1
project:
  name: REPO_NAME
  language: typescript
runtime:
  mode: inspect
  runs_path: .agentops/runs
providers:
  default: disabled
reporting:
  github:
    tracker_issue: 1
plugins:
  agents: []
`;

const policyTemplate = `version: 1
defaults:
  execution_mode: inspect
  model_access: false
  network: deny
  writes: approval_required
paths:
  allowed_read:
    - "**/*"
    - ".agentops/**"
  allowed_write:
    - ".agentops/runs/**"
    - "tests/**"
  blocked:
    - ".env*"
    - "**/.env*"
    - "secrets/**"
    - "**/*.pem"
    - "**/*.key"
    - "**/id_rsa*"
    - "infra/prod/**"
plugins:
  allowed_tiers:
    - core
    - verified
  allowed_sources:
    - official
    - local
  require_reviewed: true
tools:
  git.status:
    effect: allow
  git.diff-summary:
    effect: allow
  filesystem.read-file:
    effect: allow
  filesystem.list-files:
    effect: allow
  filesystem.write-file:
    effect: approval_required
  shell.run-template:
    effect: deny
  github.create-check:
    effect: deny
`;

const prReviewWorkflowTemplate = `version: 1
name: pr-review
description: Review local repository changes with the official safe-by-default review wedge.
trigger: manual
catalog:
  domain: review
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: context
    kind: deterministic
    agent: context-collector
    outputs_to: agentResults.context
  - id: security
    kind: reasoning
    agent: security-audit
    outputs_to: agentResults.security
  - id: review
    kind: reasoning
    agent: code-review
    outputs_to: agentResults.review
  - id: tests
    kind: reasoning
    agent: test-generation
    outputs_to: agentResults.tests
  - id: report
    kind: report
    outputs_to: reports.final
`;

const planningWorkflowTemplate = `version: 1
name: planning-discovery
description: Turn a bounded local planning request into one structured planning brief.
trigger: manual
catalog:
  domain: plan
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: planning-intake
    outputs_to: agentResults.intake
  - id: discovery
    kind: deterministic
    agent: context-collector
    outputs_to: agentResults.discovery
  - id: planning
    kind: reasoning
    agent: planning-analyst
    outputs_to: agentResults.planning
  - id: report
    kind: report
    outputs_to: reports.final
`;

const designWorkflowTemplate = `version: 1
name: architecture-design-review
description: Turn a validated planning brief into one structured architecture and design record.
trigger: manual
catalog:
  domain: design
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: design-intake
    outputs_to: agentResults.intake
  - id: inventory
    kind: deterministic
    agent: design-inventory
    outputs_to: agentResults.inventory
  - id: design
    kind: reasoning
    agent: design-analyst
    outputs_to: agentResults.design
  - id: report
    kind: report
    outputs_to: reports.final
`;

const implementationWorkflowTemplate = `version: 1
name: implementation-proposal
description: Validate a bounded implementation request and prepare it for later proposal stages.
trigger: manual
catalog:
  domain: build
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: implementation-intake
    outputs_to: agentResults.intake
  - id: inventory
    kind: deterministic
    agent: implementation-inventory
    outputs_to: agentResults.inventory
  - id: planning
    kind: reasoning
    agent: implementation-planner
    outputs_to: agentResults.planning
  - id: report
    kind: report
    outputs_to: reports.final
`;

const qaWorkflowTemplate = `version: 1
name: qa-review
description: Validate a bounded QA request and synthesize a read-only QA report.
trigger: manual
catalog:
  domain: test
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: qa-intake
    outputs_to: agentResults.intake
  - id: evidence
    kind: deterministic
    agent: qa-evidence-normalizer
    outputs_to: agentResults.evidence
  - id: qa
    kind: reasoning
    agent: qa-analyst
    outputs_to: agentResults.qa
  - id: report
    kind: report
    outputs_to: reports.final
`;

const securityWorkflowTemplate = `version: 1
name: security-review
description: Validate a bounded security request while preserving the default local security posture.
trigger: manual
catalog:
  domain: security
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: security-intake
    outputs_to: agentResults.intake
  - id: evidence
    kind: deterministic
    agent: security-evidence-normalizer
    outputs_to: agentResults.evidence
  - id: security
    kind: reasoning
    agent: security-analyst
    outputs_to: agentResults.security
  - id: report
    kind: report
    outputs_to: reports.final
`;

const releaseWorkflowTemplate = `version: 1
name: release-readiness
description: Validate a bounded release-readiness request while keeping trusted publish automation separate.
trigger: manual
catalog:
  domain: release
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: release-intake
    outputs_to: agentResults.intake
  - id: evidence
    kind: deterministic
    agent: release-evidence-normalizer
    outputs_to: agentResults.evidence
  - id: release
    kind: reasoning
    agent: release-analyst
    outputs_to: agentResults.release
  - id: report
    kind: report
    outputs_to: reports.final
`;

const pipelineWorkflowTemplate = `version: 1
name: pipeline-evidence-review
description: Review bounded local pipeline evidence through the shared CI model without assuming a release target.
trigger: manual
catalog:
  domain: release
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: pipeline-intake
    outputs_to: agentResults.intake
  - id: evidence
    kind: deterministic
    agent: pipeline-evidence-normalizer
    outputs_to: agentResults.evidence
  - id: pipeline
    kind: reasoning
    agent: pipeline-analyst
    outputs_to: agentResults.pipeline
  - id: report
    kind: report
    outputs_to: reports.final
`;

const deploymentGateWorkflowTemplate = `version: 1
name: deployment-gate-review
description: Review a bounded deployment candidate using shared CI evidence and referenced lifecycle artifacts.
trigger: manual
catalog:
  domain: release
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: deployment-gate-intake
    outputs_to: agentResults.intake
  - id: evidence
    kind: deterministic
    agent: deployment-gate-evidence-normalizer
    outputs_to: agentResults.evidence
  - id: deployment
    kind: reasoning
    agent: deployment-gate-analyst
    outputs_to: agentResults.deployment
  - id: report
    kind: report
    outputs_to: reports.final
`;

const promotionApprovalWorkflowTemplate = `version: 1
name: promotion-approval
description: Review promotion approval readiness using bounded CI evidence plus ready release and deployment gate artifacts.
trigger: manual
catalog:
  domain: release
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: promotion-approval-intake
    outputs_to: agentResults.intake
  - id: evidence
    kind: deterministic
    agent: promotion-approval-evidence-normalizer
    outputs_to: agentResults.evidence
  - id: promotion
    kind: reasoning
    agent: promotion-approval-analyst
    outputs_to: agentResults.promotion
  - id: report
    kind: report
    outputs_to: reports.final
`;

const incidentWorkflowTemplate = `version: 1
name: incident-handoff
description: Validate staged incident evidence while keeping the default path local, read-only, and explicit.
trigger: manual
catalog:
  domain: operate
  supportLevel: partial
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: incident-intake
    outputs_to: agentResults.intake
  - id: evidence
    kind: deterministic
    agent: incident-evidence-normalizer
    outputs_to: agentResults.evidence
  - id: incident
    kind: reasoning
    agent: incident-analyst
    outputs_to: agentResults.incident
  - id: report
    kind: report
    outputs_to: reports.final
`;

const maintenanceWorkflowTemplate = `version: 1
name: maintenance-triage
description: Validate a bounded maintenance request while keeping the default path local, read-only, and routing-oriented.
trigger: manual
catalog:
  domain: maintain
  supportLevel: partial
  maturity: mvp
  trustScope: official-core-only
nodes:
  - id: intake
    kind: deterministic
    agent: maintenance-intake
    outputs_to: agentResults.intake
  - id: evidence
    kind: deterministic
    agent: maintenance-evidence-normalizer
    outputs_to: agentResults.evidence
  - id: maintenance
    kind: reasoning
    agent: maintenance-analyst
    outputs_to: agentResults.maintenance
  - id: report
    kind: report
    outputs_to: reports.final
`;

function loadYaml(filePath: string): unknown {
  return yaml.load(readFileSync(filePath, "utf8"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

interface GitHubRepoContext {
  host: string;
  owner: string;
  repo: string;
}

interface GitLabRepoContext {
  host: string;
  namespace: string;
  repo: string;
}

type ScmRepoContext =
  | ({ platform: "github" } & GitHubRepoContext)
  | ({ platform: "gitlab" } & GitLabRepoContext)
  | { platform: "generic"; host: string; namespace: string; repo: string };

function runGit(root: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function inferScmPlatform(host: string): "github" | "gitlab" | "generic" {
  const normalizedHost = host.toLowerCase();
  if (normalizedHost.includes("github")) {
    return "github";
  }

  if (normalizedHost.includes("gitlab")) {
    return "gitlab";
  }

  return "generic";
}

function parseScmRepositoryUrl(value: string): ScmRepoContext | undefined {
  const trimmed = value.trim();
  const sshMatch = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/i);
  if (sshMatch) {
    const host = sshMatch[1].toLowerCase();
    const pathSegments = sshMatch[2].split("/").filter(Boolean);
    if (pathSegments.length < 2) {
      return undefined;
    }

    const repo = pathSegments[pathSegments.length - 1] ?? "";
    const namespace = pathSegments.slice(0, -1).join("/");
    const platform = inferScmPlatform(host);
    if (platform === "github") {
      return {
        platform,
        host,
        owner: namespace,
        repo
      };
    }

    return {
      platform,
      host,
      namespace,
      repo
    };
  }

  const httpsMatch = trimmed.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?(?:\/)?$/i);
  if (!httpsMatch) {
    return undefined;
  }

  const host = httpsMatch[1].toLowerCase();
  const pathSegments = httpsMatch[2].split("/").filter(Boolean);
  if (pathSegments.length < 2) {
    return undefined;
  }

  const repo = pathSegments[pathSegments.length - 1] ?? "";
  const namespace = pathSegments.slice(0, -1).join("/");
  const platform = inferScmPlatform(host);
  if (platform === "github") {
    return {
      platform,
      host,
      owner: namespace,
      repo
    };
  }

  return {
    platform,
    host,
    namespace,
    repo
  };
}

function parseGitHubRepositoryUrl(value: string): GitHubRepoContext | undefined {
  const parsed = parseScmRepositoryUrl(value);
  if (!parsed || parsed.platform !== "github") {
    return undefined;
  }

  return {
    host: parsed.host,
    owner: parsed.owner,
    repo: parsed.repo
  };
}

function parseGitLabRepositoryUrl(value: string): GitLabRepoContext | undefined {
  const parsed = parseScmRepositoryUrl(value);
  if (!parsed || parsed.platform !== "gitlab") {
    return undefined;
  }

  return {
    host: parsed.host,
    namespace: parsed.namespace,
    repo: parsed.repo
  };
}

function inferGitHubRepoContext(root: string): GitHubRepoContext | undefined {
  const packageJsonPath = join(root, "package.json");
  if (existsSync(packageJsonPath)) {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
    if (isRecord(parsed)) {
      const repository = parsed.repository;
      if (typeof repository === "string") {
        const context = parseGitHubRepositoryUrl(repository);
        if (context) {
          return context;
        }
      }

      if (isRecord(repository) && typeof repository.url === "string") {
        const context = parseGitHubRepositoryUrl(repository.url);
        if (context) {
          return context;
        }
      }
    }
  }

  const remoteUrl = runGit(root, ["config", "--get", "remote.origin.url"]);
  return remoteUrl ? parseGitHubRepositoryUrl(remoteUrl) : undefined;
}

function inferGitLabRepoContext(root: string): GitLabRepoContext | undefined {
  const packageJsonPath = join(root, "package.json");
  if (existsSync(packageJsonPath)) {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
    if (isRecord(parsed)) {
      const repository = parsed.repository;
      if (typeof repository === "string") {
        const context = parseGitLabRepositoryUrl(repository);
        if (context) {
          return context;
        }
      }

      if (isRecord(repository) && typeof repository.url === "string") {
        const context = parseGitLabRepositoryUrl(repository.url);
        if (context) {
          return context;
        }
      }
    }
  }

  const remoteUrl = runGit(root, ["config", "--get", "remote.origin.url"]);
  return remoteUrl ? parseGitLabRepositoryUrl(remoteUrl) : undefined;
}

function inferScmRepoContext(root: string): ScmRepoContext | undefined {
  const gitHubContext = inferGitHubRepoContext(root);
  if (gitHubContext) {
    return { platform: "github", ...gitHubContext };
  }

  const gitLabContext = inferGitLabRepoContext(root);
  if (gitLabContext) {
    return { platform: "gitlab", ...gitLabContext };
  }

  const packageJsonPath = join(root, "package.json");
  if (existsSync(packageJsonPath)) {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
    if (isRecord(parsed)) {
      const repository = parsed.repository;
      if (typeof repository === "string") {
        const context = parseScmRepositoryUrl(repository);
        if (context) {
          return context;
        }
      }

      if (isRecord(repository) && typeof repository.url === "string") {
        const context = parseScmRepositoryUrl(repository.url);
        if (context) {
          return context;
        }
      }
    }
  }

  const remoteUrl = runGit(root, ["config", "--get", "remote.origin.url"]);
  return remoteUrl ? parseScmRepositoryUrl(remoteUrl) : undefined;
}

function normalizeGitHubReference(rawValue: string, repoContext?: GitHubRepoContext): GithubReference | undefined {
  const raw = rawValue.trim();
  if (!raw) {
    return undefined;
  }

  const fromParts = (context: GitHubRepoContext, kind: "issue" | "pull_request", number: number): GithubReference => ({
    platform: "github",
    host: context.host,
    owner: context.owner,
    repo: context.repo,
    kind,
    number,
    canonical: kind === "issue"
      ? `${context.owner}/${context.repo}#${number}`
      : `${context.owner}/${context.repo}/pull/${number}`,
    url: kind === "issue"
      ? `https://${context.host}/${context.owner}/${context.repo}/issues/${number}`
      : `https://${context.host}/${context.owner}/${context.repo}/pull/${number}`,
    source: raw
  });

  const urlMatch = raw.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)(?:\/)?$/i);
  if (urlMatch) {
    return fromParts(
      { host: urlMatch[1].toLowerCase(), owner: urlMatch[2], repo: urlMatch[3] },
      urlMatch[4].toLowerCase() === "pull" ? "pull_request" : "issue",
      Number.parseInt(urlMatch[5], 10)
    );
  }

  const repoIssueMatch = raw.match(/^([^/\s]+)\/([^#\s]+)#(\d+)$/);
  if (repoIssueMatch) {
    return fromParts(
      { host: repoContext?.host ?? "github.com", owner: repoIssueMatch[1], repo: repoIssueMatch[2] },
      "issue",
      Number.parseInt(repoIssueMatch[3], 10)
    );
  }

  const repoPullMatch = raw.match(/^([^/\s]+)\/([^/\s]+)\/pull\/(\d+)$/i);
  if (repoPullMatch) {
    return fromParts(
      { host: repoContext?.host ?? "github.com", owner: repoPullMatch[1], repo: repoPullMatch[2] },
      "pull_request",
      Number.parseInt(repoPullMatch[3], 10)
    );
  }

  const shortIssueMatch = raw.match(/^#(\d+)$/);
  if (shortIssueMatch && repoContext) {
    return fromParts(repoContext, "issue", Number.parseInt(shortIssueMatch[1], 10));
  }

  const shortPullMatch = raw.match(/^(?:PR|pr)\s*#(\d+)$/);
  if (shortPullMatch && repoContext) {
    return fromParts(repoContext, "pull_request", Number.parseInt(shortPullMatch[1], 10));
  }

  return undefined;
}

function normalizeGitHubReferences(rawValues: readonly string[], repoContext?: GitHubRepoContext): GithubReference[] {
  const seen = new Set<string>();
  const normalized: GithubReference[] = [];

  for (const rawValue of rawValues) {
    const githubRef = normalizeGitHubReference(rawValue, repoContext);
    if (!githubRef || seen.has(githubRef.canonical)) {
      continue;
    }

    seen.add(githubRef.canonical);
    normalized.push(githubRef);
  }

  return normalized;
}

function normalizeGitLabReference(rawValue: string, repoContext?: GitLabRepoContext): ScmReference | undefined {
  const raw = rawValue.trim();
  if (!raw) {
    return undefined;
  }

  const fromParts = (context: GitLabRepoContext, kind: "issue" | "merge_request", number: number): ScmReference => ({
    platform: "gitlab",
    host: context.host,
    namespace: context.namespace,
    repo: context.repo,
    kind,
    identifier: `${number}`,
    number,
    canonical: kind === "issue"
      ? `${context.host}/${context.namespace}/${context.repo}#${number}`
      : `${context.host}/${context.namespace}/${context.repo}!${number}`,
    url: kind === "issue"
      ? `https://${context.host}/${context.namespace}/${context.repo}/-/issues/${number}`
      : `https://${context.host}/${context.namespace}/${context.repo}/-/merge_requests/${number}`,
    source: raw
  });

  const urlMatch = raw.match(/^https?:\/\/([^/]+)\/(.+?)\/-\/(issues|merge_requests)\/(\d+)(?:\/)?$/i);
  if (urlMatch) {
    const pathSegments = urlMatch[2].split("/").filter(Boolean);
    if (pathSegments.length < 2) {
      return undefined;
    }

    const repo = pathSegments[pathSegments.length - 1] ?? "";
    const namespace = pathSegments.slice(0, -1).join("/");
    return fromParts(
      { host: urlMatch[1].toLowerCase(), namespace, repo },
      urlMatch[3].toLowerCase() === "merge_requests" ? "merge_request" : "issue",
      Number.parseInt(urlMatch[4], 10)
    );
  }

  const shortIssueMatch = raw.match(/^#(\d+)$/);
  if (shortIssueMatch && repoContext) {
    return fromParts(repoContext, "issue", Number.parseInt(shortIssueMatch[1], 10));
  }

  const shortMergeRequestMatch = raw.match(/^!(\d+)$/);
  if (shortMergeRequestMatch && repoContext) {
    return fromParts(repoContext, "merge_request", Number.parseInt(shortMergeRequestMatch[1], 10));
  }

  return undefined;
}

function normalizeScmReference(rawValue: string, repoContext?: ScmRepoContext): ScmReference | undefined {
  const raw = rawValue.trim();
  if (!raw) {
    return undefined;
  }

  const gitHubRef = normalizeGitHubReference(
    raw,
    repoContext?.platform === "github"
      ? { host: repoContext.host, owner: repoContext.owner, repo: repoContext.repo }
      : undefined
  );
  if (gitHubRef) {
    return {
      platform: "github",
      host: gitHubRef.host,
      namespace: gitHubRef.owner,
      repo: gitHubRef.repo,
      kind: gitHubRef.kind,
      identifier: `${gitHubRef.number}`,
      number: gitHubRef.number,
      canonical: `${gitHubRef.host}/${gitHubRef.owner}/${gitHubRef.repo}${gitHubRef.kind === "issue" ? `#${gitHubRef.number}` : `/pull/${gitHubRef.number}`}`,
      url: gitHubRef.url,
      source: gitHubRef.source
    };
  }

  return normalizeGitLabReference(
    raw,
    repoContext?.platform === "gitlab"
      ? { host: repoContext.host, namespace: repoContext.namespace, repo: repoContext.repo }
      : undefined
  );
}

function normalizeScmReferences(rawValues: readonly string[], repoContext?: ScmRepoContext): ScmReference[] {
  const seen = new Set<string>();
  const normalized: ScmReference[] = [];

  for (const rawValue of rawValues) {
    const scmRef = normalizeScmReference(rawValue, repoContext);
    if (!scmRef || seen.has(scmRef.canonical)) {
      continue;
    }

    seen.add(scmRef.canonical);
    normalized.push(scmRef);
  }

  return normalized;
}

export function mapWorkflowRunStatusToGitHubStatus(
  workflow: string,
  localRunStatus: "success" | "partial" | "failed"
): GithubWorkflowStatusMapping {
  if (localRunStatus === "success") {
    return {
      workflow,
      localRunStatus,
      githubStatus: "completed",
      reason: "Successful local workflow runs map to completed GitHub handoff status."
    };
  }

  if (localRunStatus === "partial") {
    return {
      workflow,
      localRunStatus,
      githubStatus: "blocked",
      reason: "Partial local workflow runs map to blocked GitHub handoff status until follow-up work resolves them."
    };
  }

  return {
    workflow,
    localRunStatus,
    githubStatus: "failed",
    reason: "Failed local workflow runs map to failed GitHub handoff status."
  };
}

function ensureReadablePath(
  policyEngine: ReturnType<typeof createPolicyEngine>,
  pathValue: string,
  purpose: string
): void {
  const decision = policyEngine.canReadPath(pathValue);
  if (!decision.allowed) {
    throw new Error(decision.reason ?? `Read denied for ${purpose}: ${pathValue}`);
  }
}

function readYamlFile<T>(filePath: string, parser: { parse(value: unknown): T }, purpose: string): T {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${purpose}: ${filePath}`);
  }

  return parser.parse(loadYaml(filePath));
}

function validatePlanningRequestCompleteness(request: PlanningRequest): PlanningRequest {
  const supportingSignalCount =
    request.goals.length +
    request.constraints.length +
    request.issueRefs.length +
    request.pathHints.length +
    request.assumptions.length;

  if (supportingSignalCount === 0) {
    throw new Error(
      "Planning request is underspecified. Add at least one of goals, constraints, issueRefs, pathHints, or assumptions."
    );
  }

  return request;
}

function validateIncidentRequestCompleteness(request: IncidentRequest): IncidentRequest {
  const evidenceSignalCount = request.evidenceSources.length + request.releaseReportRefs.length;
  if (evidenceSignalCount === 0) {
    throw new Error(
      "Incident request is underspecified. Add at least one of evidenceSources or releaseReportRefs."
    );
  }

  return request;
}

function validateMaintenanceRequestCompleteness(request: MaintenanceRequest): MaintenanceRequest {
  const supportingSignalCount =
    request.dependencyAlertRefs.length +
    request.docsTaskRefs.length +
    request.releaseReportRefs.length +
    request.issueRefs.length;
  if (supportingSignalCount === 0) {
    throw new Error(
      "Maintenance request is underspecified. Add at least one of dependencyAlertRefs, docsTaskRefs, releaseReportRefs, or issueRefs."
    );
  }

  return request;
}

function validateWorkflowLifecyclePosture(
  workflow: WorkflowDefinition,
  policyEngine: ReturnType<typeof createPolicyEngine>
): void {
  const domain = workflow.catalog?.domain;
  if (
    domain !== "plan" &&
    domain !== "design" &&
    domain !== "build" &&
    domain !== "security" &&
    domain !== "release" &&
    domain !== "operate"
  ) {
    return;
  }

  if (policyEngine.snapshot.defaults.network !== "deny") {
    throw new Error(`${workflow.name} requires network access to remain denied in the default local posture.`);
  }

  if (policyEngine.snapshot.defaults.writes === "allow") {
    throw new Error(`${workflow.name} requires writes to remain approval-gated or denied in the default local posture.`);
  }
}

function loadPlanningBundleArtifact(root: string, planningBriefRef: string): PlanningArtifact {
  const bundlePath = join(root, planningBriefRef);
  if (!existsSync(bundlePath)) {
    throw new Error(`Referenced planning bundle not found: ${planningBriefRef}`);
  }

  const bundle = auditBundleSchema.parse(JSON.parse(readFileSync(bundlePath, "utf8")) as unknown);
  const planningArtifact = bundle.lifecycleArtifacts.find(
    (artifact): artifact is PlanningArtifact => artifact.artifactKind === "planning-brief"
  );

  if (!planningArtifact) {
    throw new Error(`Referenced bundle does not contain a planning-brief artifact: ${planningBriefRef}`);
  }

  return planningArtifactSchema.parse(planningArtifact);
}

function loadDesignBundleArtifact(root: string, designRecordRef: string): DesignArtifact {
  const bundlePath = join(root, designRecordRef);
  if (!existsSync(bundlePath)) {
    throw new Error(`Referenced design bundle not found: ${designRecordRef}`);
  }

  const bundle = auditBundleSchema.parse(JSON.parse(readFileSync(bundlePath, "utf8")) as unknown);
  const designArtifact = bundle.lifecycleArtifacts.find(
    (artifact): artifact is DesignArtifact => artifact.artifactKind === "design-record"
  );

  if (!designArtifact) {
    throw new Error(`Referenced bundle does not contain a design-record artifact: ${designRecordRef}`);
  }

  return designArtifactSchema.parse(designArtifact);
}

function ensureBundleContainsArtifactKind(root: string, bundleRef: string, artifactKind: string, purpose: string): void {
  const artifactKinds = loadLifecycleArtifactKinds(root, bundleRef);
  if (!artifactKinds.includes(artifactKind)) {
    throw new Error(`Referenced ${purpose} does not contain a ${artifactKind} artifact: ${bundleRef}`);
  }
}

function validateReleaseRequestCompleteness(request: ReleaseRequest): ReleaseRequest {
  const evidenceSignalCount = request.qaReportRefs.length + request.securityReportRefs.length + request.evidenceSources.length;
  if (evidenceSignalCount === 0) {
    throw new Error(
      "Release request is underspecified. Add at least one of qaReportRefs, securityReportRefs, or evidenceSources."
    );
  }

  return request;
}

function validatePipelineRequestCompleteness(request: PipelineRequest): PipelineRequest {
  const evidenceSignalCount =
    request.evidenceSources.length + request.qaReportRefs.length + request.securityReportRefs.length + request.releaseReportRefs.length;
  if (evidenceSignalCount === 0) {
    throw new Error(
      "Pipeline request is underspecified. Add at least one of evidenceSources, qaReportRefs, securityReportRefs, or releaseReportRefs."
    );
  }

  return request;
}

function validateDeploymentRequestCompleteness(request: DeploymentRequest): DeploymentRequest {
  const evidenceSignalCount =
    request.evidenceSources.length +
    request.qaReportRefs.length +
    request.securityReportRefs.length +
    request.releaseReportRefs.length +
    request.pipelineReportRefs.length;
  if (evidenceSignalCount === 0) {
    throw new Error(
      "Deployment request is underspecified. Add at least one of evidenceSources, qaReportRefs, securityReportRefs, releaseReportRefs, or pipelineReportRefs."
    );
  }

  return request;
}

function validatePromotionRequestCompleteness(request: PromotionRequest): PromotionRequest {
  const evidenceSignalCount =
    request.evidenceSources.length +
    request.qaReportRefs.length +
    request.securityReportRefs.length +
    request.releaseReportRefs.length +
    request.deploymentGateReportRefs.length;
  if (evidenceSignalCount === 0) {
    throw new Error(
      "Promotion request is underspecified. Add at least one of evidenceSources, qaReportRefs, securityReportRefs, releaseReportRefs, or deploymentGateReportRefs."
    );
  }

  if (request.releaseReportRefs.length === 0 || request.deploymentGateReportRefs.length === 0) {
    throw new Error(
      "Promotion request is underspecified. Add at least one releaseReportRef and one deploymentGateReportRef."
    );
  }

  return request;
}

function addSourceReferences(
  refs: { issueRefs: Set<string>; scmRefMap: Map<string, ScmReference>; githubRefMap: Map<string, GithubReference> },
  incoming: { issueRefs: string[]; scmRefs: ScmReference[]; githubRefs: GithubReference[] }
): void {
  for (const issueRef of incoming.issueRefs) {
    refs.issueRefs.add(issueRef);
  }
  for (const scmRef of incoming.scmRefs) {
    refs.scmRefMap.set(scmRef.canonical, scmRef);
  }
  for (const githubRef of incoming.githubRefs) {
    refs.githubRefMap.set(githubRef.canonical, githubRef);
  }
}

function loadLifecycleArtifactKinds(root: string, bundleRef: string): string[] {
  const bundlePath = join(root, bundleRef);
  if (!existsSync(bundlePath)) {
    throw new Error(`Referenced bundle not found: ${bundleRef}`);
  }

  const bundle = auditBundleSchema.parse(JSON.parse(readFileSync(bundlePath, "utf8")) as unknown);
  return bundle.lifecycleArtifacts.map((artifact) => artifact.artifactKind);
}

function loadLifecycleArtifactSourceReferences(
  root: string,
  bundleRef: string
): { issueRefs: string[]; scmRefs: ScmReference[]; githubRefs: GithubReference[] } {
  const bundlePath = join(root, bundleRef);
  if (!existsSync(bundlePath)) {
    throw new Error(`Referenced bundle not found: ${bundleRef}`);
  }

  const bundle = auditBundleSchema.parse(JSON.parse(readFileSync(bundlePath, "utf8")) as unknown);
  const scmRepoContext = inferScmRepoContext(root);
  const gitHubRepoContext = inferGitHubRepoContext(root);
  const issueRefs = new Set<string>();
  const scmRefs = new Map<string, ScmReference>();
  const githubRefs = new Map<string, GithubReference>();

  for (const artifact of bundle.lifecycleArtifacts) {
    for (const issueRef of artifact.source.issueRefs) {
      issueRefs.add(issueRef);
    }

    for (const scmRef of artifact.source.scmRefs ?? []) {
      scmRefs.set(scmRef.canonical, scmRef);
    }

    for (const githubRef of artifact.source.githubRefs ?? []) {
      githubRefs.set(githubRef.canonical, githubRef);
    }

    for (const scmRef of normalizeScmReferences(artifact.source.issueRefs, scmRepoContext)) {
      scmRefs.set(scmRef.canonical, scmRef);
    }

    for (const githubRef of normalizeGitHubReferences(artifact.source.issueRefs, gitHubRepoContext)) {
      githubRefs.set(githubRef.canonical, githubRef);
    }
  }

  return {
    issueRefs: [...issueRefs],
    scmRefs: [...scmRefs.values()],
    githubRefs: [...githubRefs.values()]
  };
}

function prepareWorkflowInputs(
  workflow: WorkflowDefinition,
  root: string,
  policyEngine: ReturnType<typeof createPolicyEngine>,
  resolvedRequest?: unknown
): Record<string, unknown> {
  const requestsDir = join(root, ".agentops", "requests");
  ensureDirectory(requestsDir);
  const repoFitInputs = {
    repoFitContract: loadRepoFitContract(root),
    repoFitPath: `.agentops/${repoFitFileName}`
  };

  if (workflow.name === "planning-discovery") {
    const requestPath = ".agentops/requests/planning.yaml";
    ensureReadablePath(policyEngine, requestPath, "planning request");
    const planningRequest = validatePlanningRequestCompleteness(
      resolvedRequest
        ? planningRequestSchema.parse(resolvedRequest)
        : readYamlFile(join(root, requestPath), planningRequestSchema, "planning request")
    );
    const planningScmRefs = normalizeScmReferences(planningRequest.issueRefs, inferScmRepoContext(root));
    const planningGithubRefs = normalizeGitHubReferences(planningRequest.issueRefs, inferGitHubRepoContext(root));

    return {
      planningRequest,
      planningScmRefs,
      planningGithubRefs,
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  if (workflow.name === "architecture-design-review") {
    const requestPath = ".agentops/requests/design.yaml";
    ensureReadablePath(policyEngine, requestPath, "design request");
    const designRequest = resolvedRequest
      ? designRequestSchema.parse(resolvedRequest)
      : readYamlFile(join(root, requestPath), designRequestSchema, "design request");
    ensureReadablePath(policyEngine, designRequest.planningBriefRef, "planning brief reference");
    const planningBrief = loadPlanningBundleArtifact(root, designRequest.planningBriefRef);

    return {
      designRequest: designRequest satisfies DesignRequest,
      planningBrief,
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  if (workflow.name === "implementation-proposal") {
    const requestPath = ".agentops/requests/implementation.yaml";
    ensureReadablePath(policyEngine, requestPath, "implementation request");
    const implementationRequest = resolvedRequest
      ? implementationRequestSchema.parse(resolvedRequest)
      : readYamlFile(join(root, requestPath), implementationRequestSchema, "implementation request");
    ensureReadablePath(policyEngine, implementationRequest.designRecordRef, "design record reference");
    const designRecord = loadDesignBundleArtifact(root, implementationRequest.designRecordRef);

    return {
      implementationRequest: implementationRequest satisfies ImplementationRequest,
      designRecord,
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  if (workflow.name === "qa-review") {
    const requestPath = ".agentops/requests/qa.yaml";
    ensureReadablePath(policyEngine, requestPath, "QA request");
    const qaRequest = resolvedRequest
      ? qaRequestSchema.parse(resolvedRequest)
      : readYamlFile(join(root, requestPath), qaRequestSchema, "QA request");
    ensureReadablePath(policyEngine, qaRequest.targetRef, "QA target reference");
    if (!existsSync(join(root, qaRequest.targetRef))) {
      throw new Error(`QA target reference not found: ${qaRequest.targetRef}`);
    }
    for (const evidenceSource of qaRequest.evidenceSources) {
      ensureReadablePath(policyEngine, evidenceSource, "QA evidence source");
    }

    const referencedSourceRefs = qaRequest.targetRef.endsWith("bundle.json")
      ? loadLifecycleArtifactSourceReferences(root, qaRequest.targetRef)
      : { issueRefs: [], scmRefs: [], githubRefs: [] };

    return {
      qaRequest: qaRequest satisfies QaRequest,
      qaIssueRefs: referencedSourceRefs.issueRefs,
      qaScmRefs: referencedSourceRefs.scmRefs,
      qaGithubRefs: referencedSourceRefs.githubRefs,
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  if (workflow.name === "security-review") {
    const requestPath = ".agentops/requests/security.yaml";
    ensureReadablePath(policyEngine, requestPath, "security request");
    const securityRequest = resolvedRequest
      ? securityRequestSchema.parse(resolvedRequest)
      : readYamlFile(join(root, requestPath), securityRequestSchema, "security request");
    ensureReadablePath(policyEngine, securityRequest.targetRef, "security target reference");
    if (!existsSync(join(root, securityRequest.targetRef))) {
      throw new Error(`Security target reference not found: ${securityRequest.targetRef}`);
    }
    for (const evidenceSource of securityRequest.evidenceSources) {
      ensureReadablePath(policyEngine, evidenceSource, "security evidence source");
    }

    const referencedArtifactKinds = securityRequest.targetRef.endsWith("bundle.json")
      ? loadLifecycleArtifactKinds(root, securityRequest.targetRef)
      : [];
    const allowedSecurityTargets = new Set(["design-record", "implementation-proposal", "qa-report", "release-report"]);
    if (securityRequest.targetRef.endsWith("bundle.json") && !referencedArtifactKinds.some((kind) => allowedSecurityTargets.has(kind))) {
      throw new Error(
        `Referenced security bundle does not contain a supported lifecycle artifact: ${securityRequest.targetRef}`
      );
    }

    const referencedSourceRefs = securityRequest.targetRef.endsWith("bundle.json")
      ? loadLifecycleArtifactSourceReferences(root, securityRequest.targetRef)
      : { issueRefs: [], scmRefs: [], githubRefs: [] };

    return {
      securityRequest: securityRequest satisfies SecurityRequest,
      securityTargetArtifactKinds: referencedArtifactKinds,
      securityIssueRefs: referencedSourceRefs.issueRefs,
      securityScmRefs: referencedSourceRefs.scmRefs,
      securityGithubRefs: referencedSourceRefs.githubRefs,
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  if (workflow.name === "pipeline-evidence-review") {
    const requestPath = ".agentops/requests/pipeline.yaml";
    ensureReadablePath(policyEngine, requestPath, "pipeline request");
    const pipelineRequest = validatePipelineRequestCompleteness(
      resolvedRequest
        ? pipelineRequestSchema.parse(resolvedRequest)
        : readYamlFile(join(root, requestPath), pipelineRequestSchema, "pipeline request")
    );

    const scmRepoContext = inferScmRepoContext(root);
    const gitHubRepoContext = inferGitHubRepoContext(root);
    const pipelineRefs = {
      issueRefs: new Set<string>(pipelineRequest.issueRefs),
      scmRefMap: new Map<string, ScmReference>(),
      githubRefMap: new Map<string, GithubReference>()
    };

    for (const scmRef of normalizeScmReferences(pipelineRequest.issueRefs, scmRepoContext)) {
      pipelineRefs.scmRefMap.set(scmRef.canonical, scmRef);
    }
    for (const githubRef of normalizeGitHubReferences(pipelineRequest.issueRefs, gitHubRepoContext)) {
      pipelineRefs.githubRefMap.set(githubRef.canonical, githubRef);
    }

    for (const qaReportRef of pipelineRequest.qaReportRefs) {
      ensureReadablePath(policyEngine, qaReportRef, "QA report reference");
      ensureBundleContainsArtifactKind(root, qaReportRef, "qa-report", "QA report reference");
      addSourceReferences(pipelineRefs, loadLifecycleArtifactSourceReferences(root, qaReportRef));
    }

    for (const securityReportRef of pipelineRequest.securityReportRefs) {
      ensureReadablePath(policyEngine, securityReportRef, "security report reference");
      ensureBundleContainsArtifactKind(root, securityReportRef, "security-report", "security report reference");
      addSourceReferences(pipelineRefs, loadLifecycleArtifactSourceReferences(root, securityReportRef));
    }

    for (const releaseReportRef of pipelineRequest.releaseReportRefs) {
      ensureReadablePath(policyEngine, releaseReportRef, "release report reference");
      ensureBundleContainsArtifactKind(root, releaseReportRef, "release-report", "release report reference");
      addSourceReferences(pipelineRefs, loadLifecycleArtifactSourceReferences(root, releaseReportRef));
    }

    for (const evidenceSource of pipelineRequest.evidenceSources) {
      ensureReadablePath(policyEngine, evidenceSource, "pipeline evidence source");
      if (!existsSync(join(root, evidenceSource))) {
        throw new Error(`Pipeline evidence source not found: ${evidenceSource}`);
      }
    }

    return {
      pipelineRequest: pipelineRequest satisfies PipelineRequest,
      pipelineIssueRefs: [...pipelineRefs.issueRefs],
      pipelineScmRefs: [...pipelineRefs.scmRefMap.values()],
      pipelineGithubRefs: [...pipelineRefs.githubRefMap.values()],
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  if (workflow.name === "release-readiness") {
    const requestPath = ".agentops/requests/release.yaml";
    ensureReadablePath(policyEngine, requestPath, "release request");
    const releaseRequest = validateReleaseRequestCompleteness(
      resolvedRequest
        ? releaseRequestSchema.parse(resolvedRequest)
        : readYamlFile(join(root, requestPath), releaseRequestSchema, "release request")
    );

    const releaseIssueRefs = new Set<string>();
    const releaseScmRefMap = new Map<string, ScmReference>();
    const releaseGithubRefMap = new Map<string, GithubReference>();
    for (const qaReportRef of releaseRequest.qaReportRefs) {
      ensureReadablePath(policyEngine, qaReportRef, "QA report reference");
      ensureBundleContainsArtifactKind(root, qaReportRef, "qa-report", "QA report reference");
      const refs = loadLifecycleArtifactSourceReferences(root, qaReportRef);
      for (const issueRef of refs.issueRefs) {
        releaseIssueRefs.add(issueRef);
      }
      for (const scmRef of refs.scmRefs) {
        releaseScmRefMap.set(scmRef.canonical, scmRef);
      }
      for (const githubRef of refs.githubRefs) {
        releaseGithubRefMap.set(githubRef.canonical, githubRef);
      }
    }

    for (const securityReportRef of releaseRequest.securityReportRefs) {
      ensureReadablePath(policyEngine, securityReportRef, "security report reference");
      ensureBundleContainsArtifactKind(root, securityReportRef, "security-report", "security report reference");
      const refs = loadLifecycleArtifactSourceReferences(root, securityReportRef);
      for (const issueRef of refs.issueRefs) {
        releaseIssueRefs.add(issueRef);
      }
      for (const scmRef of refs.scmRefs) {
        releaseScmRefMap.set(scmRef.canonical, scmRef);
      }
      for (const githubRef of refs.githubRefs) {
        releaseGithubRefMap.set(githubRef.canonical, githubRef);
      }
    }

    for (const evidenceSource of releaseRequest.evidenceSources) {
      ensureReadablePath(policyEngine, evidenceSource, "release evidence source");
      if (!existsSync(join(root, evidenceSource))) {
        throw new Error(`Release evidence source not found: ${evidenceSource}`);
      }
    }

    return {
      releaseRequest: releaseRequest satisfies ReleaseRequest,
      releaseIssueRefs: [...releaseIssueRefs],
      releaseScmRefs: [...releaseScmRefMap.values()],
      releaseGithubRefs: [...releaseGithubRefMap.values()],
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  if (workflow.name === "deployment-gate-review") {
    const requestPath = ".agentops/requests/deployment.yaml";
    ensureReadablePath(policyEngine, requestPath, "deployment request");
    const deploymentRequest = validateDeploymentRequestCompleteness(
      resolvedRequest
        ? deploymentRequestSchema.parse(resolvedRequest)
        : readYamlFile(join(root, requestPath), deploymentRequestSchema, "deployment request")
    );

    const scmRepoContext = inferScmRepoContext(root);
    const gitHubRepoContext = inferGitHubRepoContext(root);
    const deploymentRefs = {
      issueRefs: new Set<string>(deploymentRequest.issueRefs),
      scmRefMap: new Map<string, ScmReference>(),
      githubRefMap: new Map<string, GithubReference>()
    };

    for (const scmRef of normalizeScmReferences(deploymentRequest.issueRefs, scmRepoContext)) {
      deploymentRefs.scmRefMap.set(scmRef.canonical, scmRef);
    }
    for (const githubRef of normalizeGitHubReferences(deploymentRequest.issueRefs, gitHubRepoContext)) {
      deploymentRefs.githubRefMap.set(githubRef.canonical, githubRef);
    }

    for (const qaReportRef of deploymentRequest.qaReportRefs) {
      ensureReadablePath(policyEngine, qaReportRef, "QA report reference");
      ensureBundleContainsArtifactKind(root, qaReportRef, "qa-report", "QA report reference");
      addSourceReferences(deploymentRefs, loadLifecycleArtifactSourceReferences(root, qaReportRef));
    }

    for (const securityReportRef of deploymentRequest.securityReportRefs) {
      ensureReadablePath(policyEngine, securityReportRef, "security report reference");
      ensureBundleContainsArtifactKind(root, securityReportRef, "security-report", "security report reference");
      addSourceReferences(deploymentRefs, loadLifecycleArtifactSourceReferences(root, securityReportRef));
    }

    for (const releaseReportRef of deploymentRequest.releaseReportRefs) {
      ensureReadablePath(policyEngine, releaseReportRef, "release report reference");
      ensureBundleContainsArtifactKind(root, releaseReportRef, "release-report", "release report reference");
      addSourceReferences(deploymentRefs, loadLifecycleArtifactSourceReferences(root, releaseReportRef));
    }

    for (const pipelineReportRef of deploymentRequest.pipelineReportRefs) {
      ensureReadablePath(policyEngine, pipelineReportRef, "pipeline report reference");
      ensureBundleContainsArtifactKind(root, pipelineReportRef, "pipeline-report", "pipeline report reference");
      addSourceReferences(deploymentRefs, loadLifecycleArtifactSourceReferences(root, pipelineReportRef));
    }

    for (const evidenceSource of deploymentRequest.evidenceSources) {
      ensureReadablePath(policyEngine, evidenceSource, "deployment evidence source");
      if (!existsSync(join(root, evidenceSource))) {
        throw new Error(`Deployment evidence source not found: ${evidenceSource}`);
      }
    }

    return {
      deploymentRequest: deploymentRequest satisfies DeploymentRequest,
      deploymentIssueRefs: [...deploymentRefs.issueRefs],
      deploymentScmRefs: [...deploymentRefs.scmRefMap.values()],
      deploymentGithubRefs: [...deploymentRefs.githubRefMap.values()],
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  if (workflow.name === "promotion-approval") {
    const requestPath = ".agentops/requests/promotion.yaml";
    ensureReadablePath(policyEngine, requestPath, "promotion request");
    const promotionRequest = validatePromotionRequestCompleteness(
      resolvedRequest
        ? promotionRequestSchema.parse(resolvedRequest)
        : readYamlFile(join(root, requestPath), promotionRequestSchema, "promotion request")
    );

    const scmRepoContext = inferScmRepoContext(root);
    const gitHubRepoContext = inferGitHubRepoContext(root);
    const promotionRefs = {
      issueRefs: new Set<string>(promotionRequest.issueRefs),
      scmRefMap: new Map<string, ScmReference>(),
      githubRefMap: new Map<string, GithubReference>()
    };

    for (const scmRef of normalizeScmReferences(promotionRequest.issueRefs, scmRepoContext)) {
      promotionRefs.scmRefMap.set(scmRef.canonical, scmRef);
    }
    for (const githubRef of normalizeGitHubReferences(promotionRequest.issueRefs, gitHubRepoContext)) {
      promotionRefs.githubRefMap.set(githubRef.canonical, githubRef);
    }

    for (const qaReportRef of promotionRequest.qaReportRefs) {
      ensureReadablePath(policyEngine, qaReportRef, "QA report reference");
      ensureBundleContainsArtifactKind(root, qaReportRef, "qa-report", "QA report reference");
      addSourceReferences(promotionRefs, loadLifecycleArtifactSourceReferences(root, qaReportRef));
    }

    for (const securityReportRef of promotionRequest.securityReportRefs) {
      ensureReadablePath(policyEngine, securityReportRef, "security report reference");
      ensureBundleContainsArtifactKind(root, securityReportRef, "security-report", "security report reference");
      addSourceReferences(promotionRefs, loadLifecycleArtifactSourceReferences(root, securityReportRef));
    }

    for (const releaseReportRef of promotionRequest.releaseReportRefs) {
      ensureReadablePath(policyEngine, releaseReportRef, "release report reference");
      ensureBundleContainsArtifactKind(root, releaseReportRef, "release-report", "release report reference");
      addSourceReferences(promotionRefs, loadLifecycleArtifactSourceReferences(root, releaseReportRef));
    }

    for (const deploymentGateReportRef of promotionRequest.deploymentGateReportRefs) {
      ensureReadablePath(policyEngine, deploymentGateReportRef, "deployment gate report reference");
      ensureBundleContainsArtifactKind(root, deploymentGateReportRef, "deployment-gate-report", "deployment gate report reference");
      addSourceReferences(promotionRefs, loadLifecycleArtifactSourceReferences(root, deploymentGateReportRef));
    }

    for (const evidenceSource of promotionRequest.evidenceSources) {
      ensureReadablePath(policyEngine, evidenceSource, "promotion evidence source");
      if (!existsSync(join(root, evidenceSource))) {
        throw new Error(`Promotion evidence source not found: ${evidenceSource}`);
      }
    }

    return {
      promotionRequest: promotionRequest satisfies PromotionRequest,
      promotionIssueRefs: [...promotionRefs.issueRefs],
      promotionScmRefs: [...promotionRefs.scmRefMap.values()],
      promotionGithubRefs: [...promotionRefs.githubRefMap.values()],
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  if (workflow.name === "incident-handoff") {
    const requestPath = ".agentops/requests/incident.yaml";
    ensureReadablePath(policyEngine, requestPath, "incident request");
    const incidentRequest = validateIncidentRequestCompleteness(
      resolvedRequest
        ? incidentRequestSchema.parse(resolvedRequest)
        : readYamlFile(join(root, requestPath), incidentRequestSchema, "incident request")
    );

    const scmRepoContext = inferScmRepoContext(root);
    const gitHubRepoContext = inferGitHubRepoContext(root);
    const incidentIssueRefs = new Set<string>(incidentRequest.issueRefs);
    const incidentScmRefMap = new Map<string, ScmReference>();
    const incidentGithubRefMap = new Map<string, GithubReference>();
    for (const scmRef of normalizeScmReferences(incidentRequest.issueRefs, scmRepoContext)) {
      incidentScmRefMap.set(scmRef.canonical, scmRef);
    }
    for (const githubRef of normalizeGitHubReferences(incidentRequest.issueRefs, gitHubRepoContext)) {
      incidentGithubRefMap.set(githubRef.canonical, githubRef);
    }

    for (const releaseReportRef of incidentRequest.releaseReportRefs) {
      ensureReadablePath(policyEngine, releaseReportRef, "release report reference");
      ensureBundleContainsArtifactKind(root, releaseReportRef, "release-report", "release report reference");
      const refs = loadLifecycleArtifactSourceReferences(root, releaseReportRef);
      for (const issueRef of refs.issueRefs) {
        incidentIssueRefs.add(issueRef);
      }
      for (const scmRef of refs.scmRefs) {
        incidentScmRefMap.set(scmRef.canonical, scmRef);
      }
      for (const githubRef of refs.githubRefs) {
        incidentGithubRefMap.set(githubRef.canonical, githubRef);
      }
    }

    for (const evidenceSource of incidentRequest.evidenceSources) {
      ensureReadablePath(policyEngine, evidenceSource, "incident evidence source");
      if (!existsSync(join(root, evidenceSource))) {
        throw new Error(`Incident evidence source not found: ${evidenceSource}`);
      }
    }

    return {
      incidentRequest: incidentRequest satisfies IncidentRequest,
      incidentIssueRefs: [...incidentIssueRefs],
      incidentScmRefs: [...incidentScmRefMap.values()],
      incidentGithubRefs: [...incidentGithubRefMap.values()],
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  if (workflow.name === "maintenance-triage") {
    const requestPath = ".agentops/requests/maintenance.yaml";
    ensureReadablePath(policyEngine, requestPath, "maintenance request");
    const maintenanceRequest = validateMaintenanceRequestCompleteness(
      resolvedRequest
        ? maintenanceRequestSchema.parse(resolvedRequest)
        : readYamlFile(join(root, requestPath), maintenanceRequestSchema, "maintenance request")
    );

    const scmRepoContext = inferScmRepoContext(root);
    const gitHubRepoContext = inferGitHubRepoContext(root);
    const maintenanceIssueRefs = new Set<string>(maintenanceRequest.issueRefs);
    const maintenanceScmRefMap = new Map<string, ScmReference>();
    const maintenanceGithubRefMap = new Map<string, GithubReference>();
    for (const scmRef of normalizeScmReferences(maintenanceRequest.issueRefs, scmRepoContext)) {
      maintenanceScmRefMap.set(scmRef.canonical, scmRef);
    }
    for (const githubRef of normalizeGitHubReferences(maintenanceRequest.issueRefs, gitHubRepoContext)) {
      maintenanceGithubRefMap.set(githubRef.canonical, githubRef);
    }

    for (const releaseReportRef of maintenanceRequest.releaseReportRefs) {
      ensureReadablePath(policyEngine, releaseReportRef, "release report reference");
      ensureBundleContainsArtifactKind(root, releaseReportRef, "release-report", "release report reference");
      const refs = loadLifecycleArtifactSourceReferences(root, releaseReportRef);
      for (const issueRef of refs.issueRefs) {
        maintenanceIssueRefs.add(issueRef);
      }
      for (const scmRef of refs.scmRefs) {
        maintenanceScmRefMap.set(scmRef.canonical, scmRef);
      }
      for (const githubRef of refs.githubRefs) {
        maintenanceGithubRefMap.set(githubRef.canonical, githubRef);
      }
    }

    for (const dependencyAlertRef of maintenanceRequest.dependencyAlertRefs) {
      ensureReadablePath(policyEngine, dependencyAlertRef, "dependency alert reference");
      if (!existsSync(join(root, dependencyAlertRef))) {
        throw new Error(`Dependency alert reference not found: ${dependencyAlertRef}`);
      }
    }

    for (const docsTaskRef of maintenanceRequest.docsTaskRefs) {
      ensureReadablePath(policyEngine, docsTaskRef, "docs task reference");
      if (!existsSync(join(root, docsTaskRef))) {
        throw new Error(`Docs task reference not found: ${docsTaskRef}`);
      }
    }

    return {
      maintenanceRequest: maintenanceRequest satisfies MaintenanceRequest,
      maintenanceIssueRefs: [...maintenanceIssueRefs],
      maintenanceScmRefs: [...maintenanceScmRefMap.values()],
      maintenanceGithubRefs: [...maintenanceGithubRefMap.values()],
      requestFile: requestPath,
      ...repoFitInputs
    };
  }

  return { ...repoFitInputs };
}

function normalizeWorkflow(input: unknown): WorkflowDefinition {
  const parsed = input as Record<string, unknown>;
  return workflowDefinitionSchema.parse({
    version: parsed.version,
    name: parsed.name,
    description: parsed.description,
    trigger: parsed.trigger,
    catalog: parsed.catalog,
    nodes: Array.isArray(parsed.nodes)
      ? parsed.nodes.map((node) => {
          const record = node as Record<string, unknown>;
          return {
            id: record.id,
            kind: record.kind,
            agent: record.agent,
            outputsTo: record.outputs_to ?? record.outputsTo,
            contextSections: record.context_sections ?? record.contextSections ?? [],
            tools: record.tools ?? []
          };
        })
      : []
  });
}

function normalizeAgentForgeConfigInput(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const runtime = isRecord(value.runtime) ? value.runtime : {};
  const reporting = isRecord(value.reporting) ? value.reporting : {};
  const github = isRecord(reporting.github) ? reporting.github : {};
  const providers = isRecord(value.providers) ? value.providers : {};
  const plugins = isRecord(value.plugins) ? value.plugins : {};
  const project = isRecord(value.project) ? value.project : {};
  const visualizer = isRecord(value.visualizer) ? value.visualizer : {};

  return {
    version: value.version,
    project: {
      name: project.name ?? "repo",
      language: project.language ?? "typescript"
    },
    runtime: {
      mode: runtime.mode,
      runsPath: runtime.runs_path ?? runtime.runsPath
    },
    providers: {
      default: providers.default ?? "disabled"
    },
    reporting: {
      github: Object.keys(github).length > 0
        ? {
            trackerIssue: github.tracker_issue ?? github.trackerIssue
          }
        : undefined
    },
    visualizer: {
      experimentalConfigEditing: visualizer.experimental_config_editing ?? visualizer.experimentalConfigEditing ?? true
    },
    plugins: {
      agents: Array.isArray(plugins.agents)
        ? plugins.agents.map((entry) => {
            const record = entry as Record<string, unknown>;
            return {
              name: record.name,
              package: record.package,
              enabled: record.enabled
            };
          })
        : []
    }
  };
}

export interface WorkflowRunResult {
  runId: string;
  outputDir: string;
  markdownReport: string;
  jsonPath: string;
  markdownPath: string;
  status: string;
  findings: number;
  blockedActions: number;
  blockedPlugins: number;
  artifactCount: number;
  artifactKinds: string[];
}

export interface EvalRunResult {
  runId: string;
  specId: string;
  workflow: string;
  outputDir: string;
  jsonPath: string;
  markdownPath: string;
  status: string;
  evaluatedRunId?: string;
  evaluatedBundlePath?: string;
  setupRunCount: number;
  deterministicCheckCount: number;
  deterministicFailures: number;
  artifactKinds: string[];
}

export interface BenchmarkCompareResult {
  runId: string;
  outputDir: string;
  jsonPath: string;
  markdownPath: string;
  status: string;
  baselineRunId: string;
  comparedRunIds: string[];
  comparableRunCount: number;
  regressionCount: number;
  improvementCount: number;
  unchangedCount: number;
  nonComparableCount: number;
  artifactKinds: string[];
}

export interface LastRunExplanation {
  runId: string;
  status: string;
  findings: number;
  blockedActions: number;
  blockedPlugins: number;
  jsonPath: string;
  markdownPath: string;
  artifactCount: number;
  artifactKinds: string[];
}

export interface BenchmarkLedgerResult {
  path: string;
  document: BenchmarkLedgerDocument;
}

export interface BenchmarkLedgerPrefill {
  runId: string;
  workflow: string;
  status: string;
  artifactKinds: string[];
  startedAt?: string;
  finishedAt?: string;
  cycleTimeSeconds?: number;
  tokenUsage?: BenchmarkLedgerTokenUsage;
  entry: Partial<BenchmarkLedgerEntry>;
}

export interface BenchmarkLedgerRecordInput {
  taskId: string;
  arm: BenchmarkLedgerArm;
  source: BenchmarkLedgerDocument["entries"][number]["source"];
  taskType: string;
  benchmarkCategory?: BenchmarkCategory;
  taskLink?: string;
  runId?: string;
  workflow?: string;
  agent?: string;
  startedAt?: string;
  finishedAt?: string;
  cycleTimeSeconds?: number;
  summary?: string;
  decisionOutcome?: BenchmarkDecisionOutcome;
  agentforgeChangedDecision?: boolean;
  decisionImpactReason?: string;
  releaseDecision?: BenchmarkReleaseDecision;
  decisionClarity?: BenchmarkDecisionClarity;
  finalRecommendationSummary?: string;
  rerunCount?: number;
  blockedStateCount?: number;
  triggerRefs?: BenchmarkLedgerTraceReference[];
  confirmedRisks?: BenchmarkLedgerEntry["confirmedRisks"];
  confirmedRiskRefs?: BenchmarkLedgerEntry["confirmedRiskRefs"];
  tokenUsage?: BenchmarkLedgerTokenUsage;
  evidence?: BenchmarkLedgerEntry["evidence"];
  evidenceGapRefs?: BenchmarkLedgerTraceReference[];
  workflowStatuses?: BenchmarkLedgerWorkflowStatus[];
  friction?: Partial<BenchmarkLedgerEntry["friction"]>;
  notes?: string[];
  prefillRunRef?: string;
}

export interface BenchmarkLedgerRecordResult extends BenchmarkLedgerResult {
  created: boolean;
  prefill?: BenchmarkLedgerPrefill;
  entry: BenchmarkLedgerEntry;
}

export interface BenchmarkLedgerWizardInput {
  taskId: string;
  arm: BenchmarkLedgerArm;
  source?: BenchmarkLedgerRecordInput["source"];
  taskType?: string;
  benchmarkCategory?: BenchmarkCategory;
  prefillRunRef?: string;
  runId?: string;
  workflow?: string;
  agent?: string;
}

export interface VisualizerLaunchOptions {
  runsRoot?: string;
  benchmarkLedgerPath?: string;
  host?: string;
  port?: number;
  open?: boolean;
}

export interface VisualizerLaunchResult {
  serverUrl: string;
  runsRoot: string;
  benchmarkLedgerPath: string;
  runCount: number;
  benchmarkCount: number;
  close: () => Promise<void>;
}

export interface VisualizerExportOptions {
  runsRoot?: string;
  benchmarkLedgerPath?: string;
  outputPath?: string;
  format?: "json" | "markdown";
}

export interface VisualizerExportResult {
  format: "json" | "markdown";
  outputPath?: string;
  contents: string;
  document: OutcomesExportDocument;
}

export type ValidationCommandKind = "lint" | "typecheck" | "build" | "test" | "e2e";
export type BenchmarkMode = "live" | "eval";
export type OnboardingWorkflowFamily =
  | "review/planning"
  | "qa/security"
  | "release/pipeline/deployment"
  | "maintenance/incident";

export interface DetectedValidationCommand {
  kind: ValidationCommandKind;
  scriptName: string;
  command: string;
}

export interface OnboardingReleaseProfile {
  relevant: boolean;
  ciConfigPaths: string[];
  ciArtifactPaths: string[];
  releaseDocPaths: string[];
  deploymentDocPaths: string[];
  promotionSignals: string[];
  recommendedEvidenceSources: string[];
}

export interface OnboardingRepoFitInference {
  contractPath: string;
  contract: RepoFitContract;
  inferredFields: string[];
  confirmedFields: string[];
  unresolvedFields: string[];
  recommendedProfileId?: Exclude<RepoFitProfileId, "none">;
  selectedProfileId?: RepoFitProfileId;
}

export interface OnboardingProfile {
  root: string;
  repoName: string;
  packageManager: string;
  languages: string[];
  validationCommands: DetectedValidationCommand[];
  workflowFamilies: OnboardingWorkflowFamily[];
  recommendedStarterPresets: StartupPresetName[];
  recommendedValidationExpectations: string[];
  recommendedEvidenceExpectations: string[];
  recommendedFirstWorkflow: string;
  recommendedBenchmarkMode: BenchmarkMode;
  recommendedBenchmarkCategory: BenchmarkCategory;
  recommendedBenchmarkTaskType: string;
  recommendedBenchmarkTaskId: string;
  releaseProfile: OnboardingReleaseProfile;
  repoFit: OnboardingRepoFitInference;
}

export interface OnboardingResult {
  root: string;
  created: string[];
  preset?: { preset: StartupPresetName; workflow: string; requestPath: string; created: boolean };
  profile: OnboardingProfile;
  repoFit: OnboardingRepoFitInference;
  nextSteps: {
    firstWorkflowCommand: string;
    firstBenchmarkCommand: string;
    outcomesCommand: string;
    benchmarksCommand: string;
  };
}

export interface LocalRunCandidate {
  runId: string;
  workflow: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  bundlePath: string;
  artifactKinds: string[];
  category: "workflow" | "eval" | "benchmark";
}

function resolveBenchmarkLedgerPath(root: string): string {
  return join(root, ".agentops", "benchmark-ledger.json");
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

function readLatestCompleteRunBundle(runsRoot: string): { runDir: string; bundle: Record<string, unknown> } | undefined {
  if (!existsSync(runsRoot)) {
    return undefined;
  }

  const candidates = readdirSync(runsRoot)
    .map((entry) => {
      const bundlePath = join(runsRoot, entry, "bundle.json");
      if (!existsSync(bundlePath)) {
        return undefined;
      }

      const stats = statSync(bundlePath);
      const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as Record<string, unknown>;
      const bundleRunId = typeof bundle.runId === "string" ? bundle.runId : entry;
      const parsedCompletedAtMs =
        parseRunTimestampMs(bundle.finishedAt) ??
        parseRunTimestampMs(bundle.startedAt) ??
        parseRunTimestampMs(bundleRunId) ??
        parseRunTimestampMs(entry);
      const completedAtMs = parsedCompletedAtMs ?? stats.mtimeMs;

      return {
        runDir: entry,
        bundle,
        bundleRunId,
        completedAtMs,
        hasExplicitTimestamp: typeof parsedCompletedAtMs === "number"
      };
    })
    .filter((candidate): candidate is {
      runDir: string;
      bundle: Record<string, unknown>;
      bundleRunId: string;
      completedAtMs: number;
      hasExplicitTimestamp: boolean;
    } =>
      Boolean(candidate)
    )
    .sort((left, right) => {
      if (left.hasExplicitTimestamp !== right.hasExplicitTimestamp) {
        return left.hasExplicitTimestamp ? -1 : 1;
      }

      if (left.completedAtMs !== right.completedAtMs) {
        return right.completedAtMs - left.completedAtMs;
      }

      return right.bundleRunId.localeCompare(left.bundleRunId);
    });

  return candidates[0] ? { runDir: candidates[0].runDir, bundle: candidates[0].bundle } : undefined;
}

function readRunBundleByRef(root: string, runRef: string): { runId: string; bundlePath: string; bundle: ReturnType<typeof auditBundleSchema.parse> } {
  const config = loadAgentForgeConfig(root);
  const runsRoot = join(root, config.runtime.runsPath);
  const bundlePath =
    runRef.endsWith(".json") || runRef.includes("/")
      ? (runRef.startsWith("/") ? runRef : join(root, runRef))
      : join(runsRoot, runRef, "bundle.json");

  if (!existsSync(bundlePath)) {
    throw new Error(`Run bundle not found: ${runRef}`);
  }

  const bundle = auditBundleSchema.parse(JSON.parse(readFileSync(bundlePath, "utf8")) as unknown);
  return {
    runId: typeof bundle.runId === "string" ? bundle.runId : runRef,
    bundlePath,
    bundle
  };
}

function readBenchmarkLedgerDocument(root: string): BenchmarkLedgerResult {
  const ledgerPath = resolveBenchmarkLedgerPath(root);
  if (!existsSync(ledgerPath)) {
    return {
      path: ledgerPath,
      document: benchmarkLedgerDocumentSchema.parse({
        schemaVersion,
        entries: []
      })
    };
  }

  return {
    path: ledgerPath,
    document: benchmarkLedgerDocumentSchema.parse(JSON.parse(readFileSync(ledgerPath, "utf8")) as unknown)
  };
}

function writeBenchmarkLedgerDocument(root: string, document: BenchmarkLedgerDocument): string {
  const ledgerPath = resolveBenchmarkLedgerPath(root);
  mkdirSync(join(root, ".agentops"), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(benchmarkLedgerDocumentSchema.parse(document), null, 2), "utf8");
  return ledgerPath;
}

function buildBenchmarkLedgerPrefill(root: string, runRef: string): BenchmarkLedgerPrefill {
  const { runId, bundle } = readRunBundleByRef(root, runRef);
  const artifactKinds = bundle.lifecycleArtifacts
    .map((artifact) => artifact.artifactKind)
    .filter((artifactKind) => typeof artifactKind === "string" && artifactKind.length > 0) as string[];
  const tokenUsage = summarizeBundleTokenUsage(bundle.usage);
  const cycleTimeSeconds = deriveCycleTimeSeconds(bundle.startedAt, bundle.finishedAt);

  return {
    runId,
    workflow: bundle.workflow,
    status: bundle.status,
    artifactKinds,
    startedAt: bundle.startedAt,
    finishedAt: bundle.finishedAt,
    cycleTimeSeconds,
    tokenUsage,
    entry: {
      runId,
      workflow: bundle.workflow,
      startedAt: bundle.startedAt,
      finishedAt: bundle.finishedAt,
      cycleTimeSeconds,
      tokenUsage,
      workflowStatuses: [
        {
          workflow: bundle.workflow,
          status: bundle.status
        }
      ],
      evidence: {
        present: artifactKinds,
        missing: [],
        partial: []
      },
      triggerRefs: [
        {
          runId,
          note: `Prefilled from local run bundle ${runId}.`
        }
      ]
    }
  };
}

function summarizeBundleTokenUsage(usage?: ProviderUsageAggregate): BenchmarkLedgerTokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  const primaryModel = usage.byModel[0];
  const provider = usage.byModel.length === 1 ? primaryModel?.provider : "multiple";
  const model = usage.byModel.length === 1 ? primaryModel?.model : `${usage.byModel.length} models`;

  return benchmarkLedgerTokenUsageSchema.parse({
    provider,
    model,
    inputTokens: usage.totalInputTokens,
    outputTokens: usage.totalOutputTokens,
    totalTokens: usage.totalTokens,
    estimatedCostUsd: usage.totalEstimatedCostUsd,
    requestCount: usage.totalRequests,
    costStatus: usage.costStatus,
    pricingVersion: usage.byModel.length === 1 ? primaryModel?.pricing?.version : undefined,
    pricingEffectiveDate: usage.byModel.length === 1 ? primaryModel?.pricing?.effectiveDate : undefined
  });
}

function deriveCycleTimeSeconds(startedAt?: string, finishedAt?: string): number | undefined {
  if (!startedAt || !finishedAt) {
    return undefined;
  }

  const startedMs = Date.parse(startedAt);
  const finishedMs = Date.parse(finishedAt);
  if (Number.isNaN(startedMs) || Number.isNaN(finishedMs) || finishedMs < startedMs) {
    return undefined;
  }

  return Math.round((finishedMs - startedMs) / 1000);
}

function extractEvalArtifact(bundle: ReturnType<typeof auditBundleSchema.parse>, runRef: string): ReturnType<typeof evalArtifactSchema.parse> | never {
  const artifact = bundle.lifecycleArtifacts.find((candidate) => candidate.artifactKind === "eval-result");
  if (!artifact) {
    throw new Error(`Run ${runRef} does not contain an eval-result artifact.`);
  }

  return evalArtifactSchema.parse(artifact);
}

function loadAgentForgeConfig(root: string): AgentForgeConfig {
  const configPath = join(root, ".agentops", "agentops.yaml");
  if (!existsSync(configPath)) {
    return agentforgeConfigSchema.parse({
      version: 1,
      project: {
        name: root.split("/").at(-1) ?? "repo",
        language: "typescript"
      },
      runtime: {
        mode: "inspect",
        runsPath: ".agentops/runs"
      },
      providers: {
        default: "disabled"
      },
      reporting: {},
      visualizer: {
        experimentalConfigEditing: true
      },
      plugins: {
        agents: []
      }
    });
  }

  const parsed = loadYaml(configPath);
  return agentforgeConfigSchema.parse(normalizeAgentForgeConfigInput(parsed));
}

function ensureDirectory(pathValue: string): void {
  mkdirSync(pathValue, { recursive: true });
}

function writeYamlFile(filePath: string, value: unknown): void {
  writeFileSync(filePath, yaml.dump(value), "utf8");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(override)) {
    return [...override];
  }

  if (isRecord(base) && isRecord(override)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(override)]);
    return Object.fromEntries(
      [...keys].map((key) => [key, key in override ? deepMerge(base[key], override[key]) : base[key]])
    );
  }

  return override === undefined ? base : override;
}

function toRelativeRepoPath(root: string, absolutePath: string): string {
  return absolutePath.startsWith(`${root}/`) ? absolutePath.slice(root.length + 1) : absolutePath;
}

function workflowControlPath(root: string, workflowName: string): string {
  return join(root, ".agentops", controlDirName, `${workflowName}.yaml`);
}

function policyPresetPath(root: string): string {
  return join(root, ".agentops", controlDirName, policyPresetsFileName);
}

function controlDefaultsPath(root: string): string {
  return join(root, ".agentops", controlDirName, controlDefaultsFileName);
}

function assertSafeWorkflowSlug(workflow: string | undefined): string | undefined {
  if (workflow === undefined || workflow === "") {
    return undefined;
  }

  if (!/^[a-z0-9-]+$/i.test(workflow)) {
    throw new Error("Workflow name must be a simple slug.");
  }

  return workflow;
}

function resolveEditableConfigDocument(root: string, workflow: string | undefined, target: ConfigDocumentTarget): { path: string; relativePath: string } {
  const safeWorkflow = assertSafeWorkflowSlug(workflow);
  if (target === "repo-fit") {
    return {
      path: repoFitContractPath(root),
      relativePath: toRelativeRepoPath(root, repoFitContractPath(root))
    };
  }
  if (target === "policy-presets") {
    return {
      path: policyPresetPath(root),
      relativePath: toRelativeRepoPath(root, policyPresetPath(root))
    };
  }
  if (target === "defaults") {
    return {
      path: controlDefaultsPath(root),
      relativePath: toRelativeRepoPath(root, controlDefaultsPath(root))
    };
  }
  if (target === "workflow-control") {
    if (!safeWorkflow) {
      throw new Error("Workflow is required for workflow-control edits.");
    }
    const pathValue = workflowControlPath(root, safeWorkflow);
    return {
      path: pathValue,
      relativePath: toRelativeRepoPath(root, pathValue)
    };
  }
  if (target === "request") {
    if (!safeWorkflow) {
      throw new Error("Workflow is required for request edits.");
    }
    const requestPath = workflowRequestPaths[safeWorkflow];
    if (!requestPath) {
      throw new Error(`Workflow ${safeWorkflow} does not have a request document.`);
    }
    return {
      path: join(root, requestPath),
      relativePath: requestPath
    };
  }

  throw new Error(`Unsupported configure target: ${target}`);
}

function assertWritableConfigPath(relativePath: string): void {
  if (!/^\.agentops\/(requests|control)\/[^/]+\.yaml$/.test(relativePath) && relativePath !== `.agentops/${repoFitFileName}`) {
    throw new Error(`Config edits are only allowed for .agentops/requests/*.yaml, .agentops/control/*.yaml, and .agentops/${repoFitFileName}. Received ${relativePath}.`);
  }
}

function readConfigDocumentContents(root: string, absolutePath: string, overrides: ConfigDocumentOverrides = {}): string {
  const relativePath = toRelativeRepoPath(root, absolutePath);
  if (relativePath in overrides) {
    return overrides[relativePath] ?? "";
  }
  return readFileSync(absolutePath, "utf8");
}

function loadYamlDocument(root: string, absolutePath: string, overrides: ConfigDocumentOverrides = {}): unknown {
  return yaml.load(readConfigDocumentContents(root, absolutePath, overrides));
}

function createDefaultPolicyPresetDocument(): PolicyPresetDocument {
  return policyPresetDocumentSchema.parse({
    version: 1,
    presets: {
      default: {
        description: "Use the repository base policy as-is."
      },
      "strict-readonly": {
        description: "Narrow the default policy to explicit read-only execution with denied writes.",
        defaults: {
          executionMode: "inspect",
          modelAccess: false,
          network: "deny",
          writes: "deny"
        },
        tools: {
          "filesystem.write-file": { effect: "deny" },
          "shell.run-template": { effect: "deny" },
          "github.create-check": { effect: "deny" }
        }
      }
    }
  });
}

function createDefaultControlPlaneDefaults(workflows: readonly WorkflowDefinition[]) {
  return controlPlaneDefaultsSchema.parse({
    version: 1,
    workflows: Object.fromEntries(
      workflows.map((workflow) => [
        workflow.name,
        {
          profile: "default",
          policyPreset: "default",
          workflowVariant: "standard"
        }
      ])
    )
  });
}

function createDefaultWorkflowControl(workflow: WorkflowDefinition): WorkflowControlDefinition {
  return workflowControlDefinitionSchema.parse({
    version: 1,
    workflow: workflow.name,
    profiles: {
      default: {
        description: "Base repository-defined request profile.",
        requestPatch: {},
        allowedPolicyPresets: ["default", "strict-readonly"],
        allowedWorkflowVariants: ["standard"]
      }
    },
    fieldMetadata: (workflowFieldMetadata[workflow.name] ?? []).map((field) => ({
      path: field.path,
      label: field.label,
      input: field.input ?? "text",
      helpText: field.helpText,
      required: field.path !== "constraints" && field.path !== "issueRefs" && !field.path.endsWith("Sources") && !field.path.endsWith("Refs"),
      options: field.options ?? []
    })),
    workflowVariants: {
      standard: {
        description: "Use the shipped workflow topology and built-in node ordering.",
        nodeAgentOverrides: {},
        disabledNodes: []
      }
    },
    allowedPolicyPresets: ["default", "strict-readonly"],
    agentBindings: Object.fromEntries(
      workflow.nodes
        .filter((node) => node.agent)
        .map((node) => [
          node.id,
          {
            description: `Select which approved agent implementation executes the ${node.id} node.`,
            nodeIds: [node.id],
            allowedAgents: [node.agent],
            defaultAgent: node.agent
          }
        ])
    )
  });
}

function createDefaultRepoFitContract(root: string): RepoFitContract {
  return repoFitContractSchema.parse({
    version: 1,
    repoName: root.split("/").at(-1) ?? "repo",
    structure: {
      architectureStyle: detectArchitectureStyle(root, []),
      sourceRoots: detectRepoSourceRoots(root),
      packageRoots: detectRepoPackageRoots(root),
      ownershipBoundaries: inferRepoOwnershipBoundaries(detectRepoPackageRoots(root), detectRepoSourceRoots(root)),
      pathConventions: detectPathConventions(root)
    },
    expectations: {
      validationCommands: [],
      evidenceSources: []
    },
    conventions: {
      coding: [],
      designPatterns: []
    },
    starterProfile: {
      recommendedProfileId: recommendRepoFitProfile(root, detectLanguages(root)),
      adoption: "none",
      comparisonNotes: []
    },
    provenance: {
      inferred: [
        "structure.architectureStyle",
        "structure.sourceRoots",
        "structure.packageRoots",
        "structure.ownershipBoundaries",
        "structure.pathConventions",
        "starterProfile.recommendedProfileId"
      ],
      confirmed: [],
      unresolved: [
        "expectations.validationCommands",
        "expectations.evidenceSources",
        "conventions.coding",
        "conventions.designPatterns"
      ]
    }
  });
}

function ensureControlFiles(root: string): string[] {
  const created: string[] = [];
  const controlDir = join(root, ".agentops", controlDirName);
  const workflowsDir = join(root, ".agentops", "workflows");
  ensureDirectory(controlDir);

  const workflowFiles = readdirSync(workflowsDir)
    .filter((entry) => entry.endsWith(".yaml"))
    .map((entry) => normalizeWorkflow(loadYaml(join(workflowsDir, entry))));

  const presetsPath = policyPresetPath(root);
  if (!existsSync(presetsPath)) {
    writeYamlFile(presetsPath, createDefaultPolicyPresetDocument());
    created.push(presetsPath);
  }

  const defaultsPathValue = controlDefaultsPath(root);
  if (!existsSync(defaultsPathValue)) {
    writeYamlFile(defaultsPathValue, createDefaultControlPlaneDefaults(workflowFiles));
    created.push(defaultsPathValue);
  }

  for (const workflow of workflowFiles) {
    const pathValue = workflowControlPath(root, workflow.name);
    if (!existsSync(pathValue)) {
      writeYamlFile(pathValue, createDefaultWorkflowControl(workflow));
      created.push(pathValue);
    }
  }

  return created;
}

function loadControlPlaneDefaults(root: string, workflows: readonly WorkflowDefinition[], overrides: ConfigDocumentOverrides = {}) {
  const defaultsPathValue = controlDefaultsPath(root);
  if (!existsSync(defaultsPathValue)) {
    return createDefaultControlPlaneDefaults(workflows);
  }

  return controlPlaneDefaultsSchema.parse(loadYamlDocument(root, defaultsPathValue, overrides));
}

function loadRepoFitContract(root: string, overrides: ConfigDocumentOverrides = {}): RepoFitContract {
  const pathValue = repoFitContractPath(root);
  if (!existsSync(pathValue) && !(toRelativeRepoPath(root, pathValue) in overrides)) {
    return createDefaultRepoFitContract(root);
  }

  return repoFitContractSchema.parse(loadYamlDocument(root, pathValue, overrides));
}

function loadPolicyPresetDocument(root: string, overrides: ConfigDocumentOverrides = {}): PolicyPresetDocument {
  const presetsPath = policyPresetPath(root);
  if (!existsSync(presetsPath)) {
    return createDefaultPolicyPresetDocument();
  }

  return policyPresetDocumentSchema.parse(loadYamlDocument(root, presetsPath, overrides));
}

function loadWorkflowControlDefinition(root: string, workflow: WorkflowDefinition, overrides: ConfigDocumentOverrides = {}): WorkflowControlDefinition {
  const controlPath = workflowControlPath(root, workflow.name);
  if (!existsSync(controlPath)) {
    return createDefaultWorkflowControl(workflow);
  }

  return workflowControlDefinitionSchema.parse(loadYamlDocument(root, controlPath, overrides));
}

function findWorkflowDefinitionByName(root: string, workflowName: string): WorkflowDefinition {
  const workflow = listWorkflowDefinitions(root).find((candidate) => candidate.name === workflowName);
  if (!workflow) {
    throw new Error(`Unknown workflow '${workflowName}'.`);
  }
  return workflow;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseConfigDocumentForEditor(
  root: string,
  workflow: string | undefined,
  target: ConfigDocumentTarget
): {
  resolvedDocument: { path: string; relativePath: string };
  rawDocument: string;
  parsedDocument: unknown;
  loadError?: string;
} {
  const resolvedDocument = resolveEditableConfigDocument(root, workflow, target);
  const rawDocument = existsSync(resolvedDocument.path) ? readFileSync(resolvedDocument.path, "utf8") : "";

  if (rawDocument.trim().length === 0) {
    return {
      resolvedDocument,
      rawDocument,
      parsedDocument: {}
    };
  }

  try {
    return {
      resolvedDocument,
      rawDocument,
      parsedDocument: yaml.load(rawDocument) ?? {}
    };
  } catch (error) {
    return {
      resolvedDocument,
      rawDocument,
      parsedDocument: {},
      loadError: error instanceof Error ? error.message : "Failed to parse YAML document."
    };
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0);
}

function normalizeEditorOptionalString(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeBooleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function normalizeNameVersionArray(value: unknown): Array<{ name: string; version: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const name = typeof entry.name === "string" ? entry.name : "";
    const version = typeof entry.version === "string" ? entry.version : "";
    return [{ name, version }];
  });
}

function inferFieldInputFromValue(path: string, value: unknown): WorkflowFieldInput {
  if (Array.isArray(value)) {
    if (value.every((entry) => isRecord(entry) && "name" in entry && "version" in entry)) {
      return "name-version-array";
    }
    if (path.endsWith("Refs") || path.endsWith("Sources") || path.endsWith("Paths") || path.endsWith("Hints")) {
      return "path-array";
    }
    return "string-array";
  }

  if (path.endsWith("Summary") || path.endsWith("Scope") || path.endsWith("Statement") || path.endsWith("Goal") || path.endsWith("Target")) {
    return "textarea";
  }

  return "text";
}

function createFallbackWorkflowFieldDescriptor(path: string, value: unknown): WorkflowFieldDescriptor {
  return {
    path,
    label: labelizeConfigValue(path),
    input: inferFieldInputFromValue(path, value)
  };
}

function createEmptyRequestFields(workflowName: string): RequestEditorFieldState {
  switch (workflowName) {
    case "planning-discovery":
      return { problemStatement: "", goals: [], constraints: [], issueRefs: [], pathHints: [], assumptions: [] };
    case "architecture-design-review":
      return { planningBriefRef: "", decisionTarget: "", constraints: [], pathHints: [], alternatives: [], questions: [] };
    case "implementation-proposal":
      return { designRecordRef: "", implementationGoal: "", targetPaths: [], validationCommands: [], constraints: [], approvalMode: "" };
    case "qa-review":
      return { targetRef: "", evidenceSources: [], executedChecks: [], focusAreas: [], constraints: [], releaseContext: "none" };
    case "security-review":
      return { targetRef: "", evidenceSources: [], focusAreas: [], constraints: [], releaseContext: "none" };
    case "pipeline-evidence-review":
      return { pipelineScope: "", evidenceSources: [], qaReportRefs: [], securityReportRefs: [], releaseReportRefs: [], issueRefs: [], focusAreas: [], constraints: [] };
    case "release-readiness":
      return { releaseScope: "", versionTargets: [], qaReportRefs: [], securityReportRefs: [], evidenceSources: [], constraints: [] };
    case "deployment-gate-review":
      return { deploymentScope: "", targetEnvironment: "", evidenceSources: [], qaReportRefs: [], securityReportRefs: [], releaseReportRefs: [], pipelineReportRefs: [], issueRefs: [], constraints: [] };
    case "promotion-approval":
      return { promotionScope: "", targetEnvironment: "", evidenceSources: [], qaReportRefs: [], securityReportRefs: [], releaseReportRefs: [], deploymentGateReportRefs: [], issueRefs: [], constraints: [] };
    case "incident-handoff":
      return { incidentSummary: "", severityHint: "unknown", evidenceSources: [], releaseReportRefs: [], issueRefs: [], constraints: [] };
    case "maintenance-triage":
      return { maintenanceGoal: "", dependencyAlertRefs: [], docsTaskRefs: [], releaseReportRefs: [], issueRefs: [], constraints: [] };
    default:
      return {};
  }
}

function createFieldModel(
  descriptor: WorkflowFieldDescriptor,
  value: unknown,
  required?: boolean
): VisualizerConfigFieldModel {
  const input = descriptor.input ?? inferFieldInputFromValue(descriptor.path, value);
  let normalizedValue: unknown = value;

  if (input === "string-array" || input === "path-array") {
    normalizedValue = normalizeStringArray(value);
  } else if (input === "name-version-array") {
    normalizedValue = normalizeNameVersionArray(value);
  } else if (input === "select") {
    normalizedValue = typeof value === "string" ? value : "";
  } else if (input === "json") {
    normalizedValue = value === undefined ? "" : JSON.stringify(value, null, 2);
  } else {
    normalizedValue = typeof value === "string" ? value : "";
  }

  return {
    key: descriptor.path,
    label: descriptor.label,
    input,
    required: required ?? false,
    helpText: descriptor.helpText,
    options: descriptor.options,
    value: normalizedValue
  };
}

function buildRequestFieldDefinitions(
  workflowName: string,
  control: WorkflowControlDefinition,
  currentFields: Record<string, unknown>
): WorkflowFieldDescriptor[] {
  const baseDefinitions = (control.fieldMetadata.length > 0
    ? control.fieldMetadata.map((field) => ({
        path: field.path,
        label: field.label,
        input: (field.input === "json" ? "json" : field.input) as WorkflowFieldInput,
        helpText: field.helpText,
        options: field.options
      }))
    : workflowFieldMetadata[workflowName] ?? []
  ).map((definition) => ({ ...definition }));

  const seen = new Set(baseDefinitions.map((definition) => definition.path));
  for (const [key, value] of Object.entries(currentFields)) {
    if (key === "meta" || seen.has(key)) {
      continue;
    }
    baseDefinitions.push(createFallbackWorkflowFieldDescriptor(key, value));
    seen.add(key);
  }

  return baseDefinitions;
}

function valueToStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0);
}

function requestFieldsFromState(fields: VisualizerConfigFieldModel[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.input === "string-array" || field.input === "path-array") {
      const values = valueToStringArray(field.value);
      if (values.length > 0 || field.required) {
        result[field.key] = values;
      }
      continue;
    }

    if (field.input === "name-version-array") {
      const values = Array.isArray(field.value)
        ? field.value.flatMap((entry) => {
            if (!isRecord(entry)) {
              return [];
            }
            const name = typeof entry.name === "string" ? entry.name.trim() : "";
            const version = typeof entry.version === "string" ? entry.version.trim() : "";
            if (name.length === 0 && version.length === 0) {
              return [];
            }
            return [{ name, version }];
          })
        : [];
      if (values.length > 0 || field.required) {
        result[field.key] = values;
      }
      continue;
    }

    if (field.input === "json") {
      const raw = typeof field.value === "string" ? field.value.trim() : "";
      if (raw.length === 0) {
        if (field.required) {
          result[field.key] = {};
        }
        continue;
      }
      try {
        result[field.key] = JSON.parse(raw);
      } catch {
        result[field.key] = raw;
      }
      continue;
    }

    const value = typeof field.value === "string" ? field.value : "";
    if (value.trim().length > 0 || field.required) {
      result[field.key] = value;
    }
  }

  return result;
}

function requestFieldDefinitionsForWorkflow(workflowName: string): WorkflowFieldDescriptor[] {
  return cloneValue(workflowFieldMetadata[workflowName] ?? []);
}

function baseRequestFieldOptions(workflowName: string): Array<Omit<VisualizerConfigFieldModel, "value">> {
  const emptyFields = createEmptyRequestFields(workflowName);
  return requestFieldDefinitionsForWorkflow(workflowName).map((definition) => {
    const field = createFieldModel(definition, emptyFields[definition.path], definition.path !== "constraints" && definition.path !== "issueRefs" && !definition.path.endsWith("Sources") && !definition.path.endsWith("Refs"));
    return {
      key: field.key,
      label: field.label,
      input: field.input,
      required: field.required,
      helpText: field.helpText,
      options: field.options
    };
  });
}

function createEditorIntro(target: ConfigDocumentTarget): { title: string; intro: string; nextStep: string } {
  switch (target) {
    case "request":
      return {
        title: "Workflow Request",
        intro: "Set the request inputs and execution selectors for one workflow without hand-authoring YAML.",
        nextStep: "Preview the effective run summary, then save the canonical request YAML."
      };
    case "workflow-control":
      return {
        title: "Workflow Control",
        intro: "Manage profiles, request form metadata, workflow variants, allowed presets, and agent bindings for this workflow.",
        nextStep: "Preview validation and semantic resolution before saving the control document."
      };
    case "policy-presets":
      return {
        title: "Policy Presets",
        intro: "Edit narrowing-only policy presets that specialize the base policy without widening permissions.",
        nextStep: "Preview the effective policy posture, then save the preset document."
      };
    case "defaults":
      return {
        title: "Workflow Defaults",
        intro: "Choose the default profile, preset, and workflow variant for each workflow family.",
        nextStep: "Preview the resulting selections, then save the defaults document."
      };
    case "repo-fit":
      return {
        title: "Repo-Fit Contract",
        intro: "Capture the repository structure, conventions, evidence surfaces, and optional AgentForge starter profile without hand-authoring YAML.",
        nextStep: "Review the inferred repo-fit contract, confirm the missing sections, then save the canonical repo-fit YAML."
      };
  }
}

function buildBindingSelectionModels(
  control: WorkflowControlDefinition,
  selectedBindings: Record<string, string>
): VisualizerConfigBindingSelectionModel[] {
  return Object.entries(control.agentBindings).map(([bindingName, binding]) => ({
    key: bindingName,
    label: labelizeConfigValue(bindingName),
    description: binding.description,
    nodeIds: binding.nodeIds,
    selectedAgent: selectedBindings[bindingName] ?? binding.defaultAgent,
    options: toEditorOptions(binding.allowedAgents)
  }));
}

function buildRequestEditorModel(root: string, workflowName: string, editingEnabled: boolean): VisualizerConfigEditorModel {
  const workflow = findWorkflowDefinitionByName(root, workflowName);
  const { resolvedDocument, rawDocument, parsedDocument, loadError } = parseConfigDocumentForEditor(root, workflowName, "request");
  const control = loadWorkflowControlDefinition(root, workflow);
  const presets = loadPolicyPresetDocument(root);
  const defaults = loadControlPlaneDefaults(root, [workflow]);
  const defaultSelection = defaults.workflows[workflow.name];
  const rawRecord = isRecord(parsedDocument) ? parsedDocument : {};
  const selectedMeta = resolveRequestMetaSelection(rawRecord.meta, defaultSelection);
  const currentFields = {
    ...createEmptyRequestFields(workflow.name),
    ...Object.fromEntries(Object.entries(rawRecord).filter(([key]) => key !== "meta"))
  };
  const fieldDefinitions = buildRequestFieldDefinitions(workflow.name, control, currentFields);
  const fields = fieldDefinitions.map((definition) =>
    createFieldModel(
      definition,
      currentFields[definition.path],
      control.fieldMetadata.find((field) => field.path === definition.path)?.required
        ?? (definition.path !== "constraints" && definition.path !== "issueRefs" && !definition.path.endsWith("Sources") && !definition.path.endsWith("Refs"))
    )
  );
  const allPolicyPresets = [...new Set(["default", ...Object.keys(presets.presets)])].sort();
  const allVariants = [...new Set(["standard", ...Object.keys(control.workflowVariants)])].sort();

  return {
    workflow: workflow.name,
    target: "request",
    path: resolvedDocument.path,
    relativePath: resolvedDocument.relativePath,
    editingEnabled,
    rawDocument,
    loadError,
    ...createEditorIntro("request"),
    request: {
      selectedProfile: selectedMeta.profile,
      selectedPolicyPreset: selectedMeta.policyPreset,
      selectedWorkflowVariant: selectedMeta.workflowVariant,
      profileOptions: toEditorOptions(Object.keys(control.profiles).sort()),
      policyPresetOptions: toEditorOptions(allPolicyPresets),
      workflowVariantOptions: toEditorOptions(allVariants),
      profileRules: Object.entries(control.profiles).map(([profile, profileValue]) => ({
        profile,
        allowedPolicyPresets: [...new Set(["default", ...control.allowedPolicyPresets, ...profileValue.allowedPolicyPresets])].sort(),
        allowedWorkflowVariants: [...new Set(["standard", ...profileValue.allowedWorkflowVariants])].sort()
      })),
      fields,
      agentBindings: buildBindingSelectionModels(control, selectedMeta.agentBindings)
    }
  };
}

function buildWorkflowControlEditorModel(root: string, workflowName: string, editingEnabled: boolean): VisualizerConfigEditorModel {
  const workflow = findWorkflowDefinitionByName(root, workflowName);
  const { resolvedDocument, rawDocument, parsedDocument, loadError } = parseConfigDocumentForEditor(root, workflowName, "workflow-control");
  const parsedControl = (() => {
    try {
      return workflowControlDefinitionSchema.parse(parsedDocument);
    } catch {
      return createDefaultWorkflowControl(workflow);
    }
  })();
  const presets = loadPolicyPresetDocument(root);
  const requestFieldDefinitions = buildRequestFieldDefinitions(workflow.name, parsedControl, createEmptyRequestFields(workflow.name)).map((definition) => {
    const field = createFieldModel(definition, createEmptyRequestFields(workflow.name)[definition.path], parsedControl.fieldMetadata.find((candidate) => candidate.path === definition.path)?.required);
    return {
      key: field.key,
      label: field.label,
      input: field.input,
      required: field.required,
      helpText: field.helpText,
      options: field.options
    };
  });
  const nodeOptions = workflow.nodes.map((node) => ({ label: node.id, value: node.id }));
  const nodeAgentOptions = Object.fromEntries(
    workflow.nodes.map((node) => {
      const binding = parsedControl.agentBindings[node.id];
      const values = binding?.allowedAgents.length ? binding.allowedAgents : node.agent ? [node.agent] : [];
      return [node.id, toEditorOptions([...new Set(values)].sort())];
    })
  );

  return {
    workflow: workflow.name,
    target: "workflow-control",
    path: resolvedDocument.path,
    relativePath: resolvedDocument.relativePath,
    editingEnabled,
    rawDocument,
    loadError,
    ...createEditorIntro("workflow-control"),
    workflowControl: {
      requestFieldDefinitions,
      profiles: Object.entries(parsedControl.profiles).map(([name, profile]) => ({
        name,
        description: profile.description,
        allowedPolicyPresets: cloneValue(profile.allowedPolicyPresets),
        allowedWorkflowVariants: cloneValue(profile.allowedWorkflowVariants),
        requestFields: requestFieldDefinitions.map((definition) =>
          createFieldModel(
            {
              path: definition.key,
              label: definition.label,
              input: definition.input,
              helpText: definition.helpText,
              options: definition.options
            },
            isRecord(profile.requestPatch) ? profile.requestPatch[definition.key] : undefined,
            definition.required
          )
        )
      })),
      fieldMetadata: parsedControl.fieldMetadata.map((field) => ({
        path: field.path,
        label: field.label,
        helpText: field.helpText,
        input: (field.input === "json" ? "json" : field.input) as VisualizerConfigFieldInput,
        required: field.required,
        options: cloneValue(field.options)
      })),
      workflowVariants: Object.entries(parsedControl.workflowVariants).map(([name, variant]) => ({
        name,
        description: variant.description,
        disabledNodes: cloneValue(variant.disabledNodes),
        nodeAgentOverrides: Object.entries(variant.nodeAgentOverrides).map(([nodeId, agent]) => ({ nodeId, agent }))
      })),
      allowedPolicyPresets: cloneValue(parsedControl.allowedPolicyPresets),
      policyPresetOptions: toEditorOptions([...new Set(["default", ...Object.keys(presets.presets)])].sort()),
      agentBindings: Object.entries(parsedControl.agentBindings).map(([name, binding]) => ({
        name,
        description: binding.description,
        nodeIds: cloneValue(binding.nodeIds),
        allowedAgents: cloneValue(binding.allowedAgents),
        defaultAgent: binding.defaultAgent
      })),
      nodeOptions,
      nodeAgentOptions
    }
  };
}

function buildPolicyPresetsEditorModel(root: string, editingEnabled: boolean): VisualizerConfigEditorModel {
  const { resolvedDocument, rawDocument, parsedDocument, loadError } = parseConfigDocumentForEditor(root, undefined, "policy-presets");
  const document = (() => {
    try {
      return policyPresetDocumentSchema.parse(parsedDocument);
    } catch {
      return createDefaultPolicyPresetDocument();
    }
  })();
  const basePolicy = resolvePolicy(loadPolicyDocument(join(root, ".agentops", "policy.yaml")), process.env.CI ? "ci" : "local");

  return {
    target: "policy-presets",
    path: resolvedDocument.path,
    relativePath: resolvedDocument.relativePath,
    editingEnabled,
    rawDocument,
    loadError,
    ...createEditorIntro("policy-presets"),
    policyPresets: {
      presets: Object.entries(document.presets).map(([name, preset]) => ({
        name,
        description: preset.description,
        defaults: {
          executionMode: preset.defaults?.executionMode,
          modelAccess: preset.defaults?.modelAccess,
          network: preset.defaults?.network,
          writes: preset.defaults?.writes
        },
        blockedPaths: cloneValue(preset.paths?.blocked ?? []),
        pluginAllowedTiers: cloneValue(preset.plugins?.allowedTiers ?? []),
        pluginAllowedSources: cloneValue(preset.plugins?.allowedSources ?? []),
        requireReviewed: preset.plugins?.requireReviewed,
        tools: Object.entries(preset.tools ?? {}).map(([toolName, tool]) => ({
          toolName,
          effect: tool.effect
        }))
      })),
      availableTools: toEditorOptions(Object.keys(basePolicy.tools).sort()),
      toolEffectOptions: toEditorOptions([...permissionOptions]),
      tierOptions: toEditorOptions(basePolicy.plugins.allowedTiers),
      sourceOptions: toEditorOptions(basePolicy.plugins.allowedSources),
      executionModeOptions: toEditorOptions([...executionModeOptions]),
      permissionOptions: toEditorOptions([...permissionOptions])
    }
  };
}

function buildDefaultsEditorModel(root: string, editingEnabled: boolean): VisualizerConfigEditorModel {
  const workflows = listWorkflowDefinitions(root);
  const { resolvedDocument, rawDocument, parsedDocument, loadError } = parseConfigDocumentForEditor(root, undefined, "defaults");
  const defaultsDocument = (() => {
    try {
      return controlPlaneDefaultsSchema.parse(parsedDocument);
    } catch {
      return createDefaultControlPlaneDefaults(workflows);
    }
  })();
  const presets = loadPolicyPresetDocument(root);

  return {
    target: "defaults",
    path: resolvedDocument.path,
    relativePath: resolvedDocument.relativePath,
    editingEnabled,
    rawDocument,
    loadError,
    ...createEditorIntro("defaults"),
    defaults: {
      workflows: workflows.map((workflow) => {
        const control = loadWorkflowControlDefinition(root, workflow);
        const current = defaultsDocument.workflows[workflow.name] ?? {};
        return {
          workflow: workflow.name,
          profile: current.profile,
          policyPreset: current.policyPreset,
          workflowVariant: current.workflowVariant,
          profileOptions: toEditorOptions(Object.keys(control.profiles).sort()),
          policyPresetOptions: toEditorOptions([...new Set(["default", ...Object.keys(presets.presets)])].sort()),
          workflowVariantOptions: toEditorOptions(["standard", ...Object.keys(control.workflowVariants)].sort())
        };
      })
    }
  };
}

function buildRepoFitEditorModel(root: string, editingEnabled: boolean): VisualizerConfigEditorModel {
  const { resolvedDocument, rawDocument, parsedDocument, loadError } = parseConfigDocumentForEditor(root, undefined, "repo-fit");
  const contract = (() => {
    try {
      return repoFitContractSchema.parse(parsedDocument);
    } catch {
      return createDefaultRepoFitContract(root);
    }
  })();
  const recommendedProfileId = contract.starterProfile.recommendedProfileId ?? recommendRepoFitProfile(root, detectLanguages(root));
  const profileOptions = [
    { label: "None", value: "none" },
    ...Object.values(repoFitStarterProfiles).map((profile) => ({ label: profile.label, value: profile.id }))
  ];
  const adoptionOptions = toEditorOptions(["none", "partial", "full"]);

  return {
    target: "repo-fit",
    path: resolvedDocument.path,
    relativePath: resolvedDocument.relativePath,
    editingEnabled,
    rawDocument,
    loadError,
    ...createEditorIntro("repo-fit"),
    repoFit: {
      recommendedProfileId,
      selectedProfileId: contract.starterProfile.selectedProfileId,
      adoption: contract.starterProfile.adoption,
      profileOptions,
      adoptionOptions,
      structureFields: [
        createFieldModel({ path: "architectureStyle", label: "Architecture Style", input: "text", helpText: "How this repository is organized at a high level." }, contract.structure.architectureStyle ?? ""),
        createFieldModel({ path: "sourceRoots", label: "Source Roots", input: "path-array", helpText: "Primary implementation roots such as src, packages, apps, or services." }, contract.structure.sourceRoots),
        createFieldModel({ path: "packageRoots", label: "Package Roots", input: "path-array", helpText: "Top-level package or service boundaries when the repo is a workspace or monorepo." }, contract.structure.packageRoots),
        createFieldModel({ path: "ownershipBoundaries", label: "Ownership Boundaries", input: "string-array", helpText: "Statements that describe package, module, or team boundaries." }, contract.structure.ownershipBoundaries),
        createFieldModel({ path: "pathConventions", label: "Path Conventions", input: "string-array", helpText: "Repo-relative layout conventions such as tests/, docs/, or .github/workflows/." }, contract.structure.pathConventions)
      ],
      expectationFields: [
        createFieldModel({ path: "validationCommands", label: "Validation Commands", input: "string-array", helpText: "The canonical package-script or tool commands expected before merge or release." }, contract.expectations.validationCommands),
        createFieldModel({ path: "evidenceSources", label: "Evidence Sources", input: "string-array", helpText: "CI, docs, or artifact sources that workflows should treat as evidence surfaces." }, contract.expectations.evidenceSources),
        createFieldModel({ path: "testingConventions", label: "Testing Conventions", input: "string-array" }, contract.expectations.testingConventions),
        createFieldModel({ path: "releaseConventions", label: "Release Conventions", input: "string-array" }, contract.expectations.releaseConventions),
        createFieldModel({ path: "securityConventions", label: "Security Conventions", input: "string-array" }, contract.expectations.securityConventions),
        createFieldModel({ path: "documentationConventions", label: "Documentation Conventions", input: "string-array" }, contract.expectations.documentationConventions),
        createFieldModel({ path: "operationsConventions", label: "Operations Conventions", input: "string-array" }, contract.expectations.operationsConventions)
      ],
      conventionFields: [
        createFieldModel({ path: "coding", label: "Coding Conventions", input: "string-array", helpText: "Preferred code-style and implementation-shape guidance for the repo." }, contract.conventions.coding),
        createFieldModel({ path: "designPatterns", label: "Design Patterns", input: "string-array", helpText: "Architecture and design patterns this repo prefers or rejects." }, contract.conventions.designPatterns)
      ],
      comparisonNotes: contract.starterProfile.comparisonNotes,
      inferredFields: contract.provenance.inferred,
      confirmedFields: contract.provenance.confirmed,
      unresolvedFields: contract.provenance.unresolved
    }
  };
}

function loadVisualizerConfigEditorModel(
  root: string,
  input: { workflow?: string; target: ConfigDocumentTarget },
  editingEnabled: boolean
): VisualizerConfigEditorModel {
  switch (input.target) {
    case "request":
      if (!input.workflow) {
        throw new Error("Workflow is required for request editing.");
      }
      return buildRequestEditorModel(root, input.workflow, editingEnabled);
    case "workflow-control":
      if (!input.workflow) {
        throw new Error("Workflow is required for workflow-control editing.");
      }
      return buildWorkflowControlEditorModel(root, input.workflow, editingEnabled);
    case "policy-presets":
      return buildPolicyPresetsEditorModel(root, editingEnabled);
    case "defaults":
      return buildDefaultsEditorModel(root, editingEnabled);
    case "repo-fit":
      return buildRepoFitEditorModel(root, editingEnabled);
  }

  const unsupportedTarget: never = input.target;
  throw new Error(`Unsupported configure target: ${unsupportedTarget}`);
}

function compactYamlValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => compactYamlValue(entry))
      .filter((entry) => entry !== undefined);
    return items.length > 0 ? items : undefined;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
      .map(([key, entry]) => [key, compactYamlValue(entry)] as const)
      .filter(([, entry]) => entry !== undefined);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  if (typeof value === "string") {
    return value.trim().length > 0 ? value : undefined;
  }

  return value;
}

function renderRequestDocumentFromState(
  root: string,
  workflowName: string,
  state: unknown
): string {
  const workflow = findWorkflowDefinitionByName(root, workflowName);
  const control = loadWorkflowControlDefinition(root, workflow);
  const stateRecord = isRecord(state) ? state : {};
  const metaRecord = isRecord(stateRecord.meta) ? stateRecord.meta : {};
  const selectedBindings = isRecord(metaRecord.agentBindings) ? Object.fromEntries(
    Object.entries(metaRecord.agentBindings)
      .map(([key, value]) => [key, typeof value === "string" ? value : ""])
      .filter(([, value]) => value.length > 0)
  ) : {};
  const fields = Array.isArray(stateRecord.fields) ? stateRecord.fields : [];
  const requestFields = requestFieldsFromState(fields as VisualizerConfigFieldModel[]);
  const meta = requestMetaSchema.parse({
    profile: typeof metaRecord.profile === "string" && metaRecord.profile.length > 0 ? metaRecord.profile : "default",
    policyPreset: normalizeEditorOptionalString(metaRecord.policyPreset),
    workflowVariant: typeof metaRecord.workflowVariant === "string" && metaRecord.workflowVariant.length > 0 ? metaRecord.workflowVariant : "standard",
    agentBindings: selectedBindings
  });
  const requestDocument = {
    meta,
    ...requestFields
  };
  const compact = compactYamlValue(requestDocument);
  return yaml.dump(compact ?? requestDocument, { lineWidth: -1, noRefs: true });
}

function renderWorkflowControlDocumentFromState(
  root: string,
  workflowName: string,
  state: unknown
): string {
  const workflow = findWorkflowDefinitionByName(root, workflowName);
  const control = loadWorkflowControlDefinition(root, workflow);
  const stateRecord = isRecord(state) ? state : {};
  const profiles = Array.isArray(stateRecord.profiles) ? stateRecord.profiles : [];
  const fieldMetadata = Array.isArray(stateRecord.fieldMetadata) ? stateRecord.fieldMetadata : [];
  const workflowVariants = Array.isArray(stateRecord.workflowVariants) ? stateRecord.workflowVariants : [];
  const agentBindings = Array.isArray(stateRecord.agentBindings) ? stateRecord.agentBindings : [];
  const allowedPolicyPresets = valueToStringArray(stateRecord.allowedPolicyPresets);

  const requestFieldMap = new Map(buildRequestFieldDefinitions(workflow.name, control, createEmptyRequestFields(workflow.name)).map((field) => [field.path, field]));

  const document = workflowControlDefinitionSchema.parse({
    version: 1,
    workflow: workflow.name,
    profiles: Object.fromEntries(
      profiles.flatMap((profileValue) => {
        if (!isRecord(profileValue)) {
          return [];
        }
        const name = normalizeEditorOptionalString(profileValue.name);
        if (!name) {
          return [];
        }
        const requestFields = Array.isArray(profileValue.requestFields) ? profileValue.requestFields as VisualizerConfigFieldModel[] : [];
        return [[
          name,
          {
            description: normalizeEditorOptionalString(profileValue.description),
            allowedPolicyPresets: valueToStringArray(profileValue.allowedPolicyPresets),
            allowedWorkflowVariants: valueToStringArray(profileValue.allowedWorkflowVariants),
            requestPatch: requestFieldsFromState(requestFields.map((field) => ({
              ...field,
              label: field.label ?? requestFieldMap.get(field.key)?.label ?? labelizeConfigValue(field.key),
              input: (field.input ?? requestFieldMap.get(field.key)?.input ?? inferFieldInputFromValue(field.key, field.value)) as VisualizerConfigFieldInput,
              required: field.required ?? false
            })))
          }
        ]];
      })
    ),
    fieldMetadata: fieldMetadata.flatMap((fieldValue) => {
      if (!isRecord(fieldValue)) {
        return [];
      }
      const path = normalizeEditorOptionalString(fieldValue.path);
      const label = normalizeEditorOptionalString(fieldValue.label);
      const input = normalizeEditorOptionalString(fieldValue.input) as WorkflowFieldInput | undefined;
      if (!path || !label || !input) {
        return [];
      }
      return [{
        path,
        label,
        helpText: normalizeEditorOptionalString(fieldValue.helpText),
        input,
        required: Boolean(fieldValue.required),
        options: Array.isArray(fieldValue.options)
          ? fieldValue.options.flatMap((option) => {
              if (!isRecord(option)) {
                return [];
              }
              const optionValue = normalizeEditorOptionalString(option.value);
              const optionLabel = normalizeEditorOptionalString(option.label);
              return optionValue && optionLabel ? [{ value: optionValue, label: optionLabel }] : [];
            })
          : []
      }];
    }),
    workflowVariants: Object.fromEntries(
      workflowVariants.flatMap((variantValue) => {
        if (!isRecord(variantValue)) {
          return [];
        }
        const name = normalizeEditorOptionalString(variantValue.name);
        if (!name) {
          return [];
        }
        const overrides = Array.isArray(variantValue.nodeAgentOverrides) ? variantValue.nodeAgentOverrides : [];
        return [[
          name,
          {
            description: normalizeEditorOptionalString(variantValue.description),
            disabledNodes: valueToStringArray(variantValue.disabledNodes),
            nodeAgentOverrides: Object.fromEntries(
              overrides.flatMap((override) => {
                if (!isRecord(override)) {
                  return [];
                }
                const nodeId = normalizeEditorOptionalString(override.nodeId);
                const agent = normalizeEditorOptionalString(override.agent);
                return nodeId && agent ? [[nodeId, agent]] : [];
              })
            )
          }
        ]];
      })
    ),
    allowedPolicyPresets,
    agentBindings: Object.fromEntries(
      agentBindings.flatMap((bindingValue) => {
        if (!isRecord(bindingValue)) {
          return [];
        }
        const name = normalizeEditorOptionalString(bindingValue.name);
        if (!name) {
          return [];
        }
        return [[
          name,
          {
            description: normalizeEditorOptionalString(bindingValue.description),
            nodeIds: valueToStringArray(bindingValue.nodeIds),
            allowedAgents: valueToStringArray(bindingValue.allowedAgents),
            defaultAgent: normalizeEditorOptionalString(bindingValue.defaultAgent)
          }
        ]];
      })
    )
  });

  return yaml.dump(compactYamlValue(document) ?? document, { lineWidth: -1, noRefs: true });
}

function renderPolicyPresetDocumentFromState(state: unknown): string {
  const stateRecord = isRecord(state) ? state : {};
  const presets = Array.isArray(stateRecord.presets) ? stateRecord.presets : [];
  const document = policyPresetDocumentSchema.parse({
    version: 1,
    presets: Object.fromEntries(
      presets.flatMap((presetValue) => {
        if (!isRecord(presetValue)) {
          return [];
        }
        const name = normalizeEditorOptionalString(presetValue.name);
        if (!name) {
          return [];
        }
        const defaults = isRecord(presetValue.defaults) ? presetValue.defaults : {};
        return [[
          name,
          {
            description: normalizeEditorOptionalString(presetValue.description),
            defaults: {
              executionMode: normalizeEditorOptionalString(defaults.executionMode) as typeof executionModeOptions[number] | undefined,
              modelAccess: normalizeBooleanValue(defaults.modelAccess),
              network: normalizeEditorOptionalString(defaults.network) as typeof permissionOptions[number] | undefined,
              writes: normalizeEditorOptionalString(defaults.writes) as typeof permissionOptions[number] | undefined
            },
            paths: {
              blocked: valueToStringArray(presetValue.blockedPaths)
            },
            plugins: {
              allowedTiers: valueToStringArray(presetValue.pluginAllowedTiers),
              allowedSources: valueToStringArray(presetValue.pluginAllowedSources),
              requireReviewed: normalizeBooleanValue(presetValue.requireReviewed)
            },
            tools: Object.fromEntries(
              (Array.isArray(presetValue.tools) ? presetValue.tools : []).flatMap((toolValue) => {
                if (!isRecord(toolValue)) {
                  return [];
                }
                const toolName = normalizeEditorOptionalString(toolValue.toolName);
                const effect = normalizeEditorOptionalString(toolValue.effect);
                return toolName && effect ? [[toolName, { effect }]] : [];
              })
            )
          }
        ]];
      })
    )
  });

  return yaml.dump(compactYamlValue(document) ?? document, { lineWidth: -1, noRefs: true });
}

function renderDefaultsDocumentFromState(state: unknown): string {
  const stateRecord = isRecord(state) ? state : {};
  const workflows = Array.isArray(stateRecord.workflows) ? stateRecord.workflows : [];
  const document = controlPlaneDefaultsSchema.parse({
    version: 1,
    workflows: Object.fromEntries(
      workflows.flatMap((workflowValue) => {
        if (!isRecord(workflowValue)) {
          return [];
        }
        const workflow = normalizeEditorOptionalString(workflowValue.workflow);
        if (!workflow) {
          return [];
        }
        return [[
          workflow,
          {
            profile: normalizeEditorOptionalString(workflowValue.profile),
            policyPreset: normalizeEditorOptionalString(workflowValue.policyPreset),
            workflowVariant: normalizeEditorOptionalString(workflowValue.workflowVariant)
          }
        ]];
      })
    )
  });

  return yaml.dump(compactYamlValue(document) ?? document, { lineWidth: -1, noRefs: true });
}

function renderRepoFitDocumentFromState(root: string, state: unknown): string {
  const existing = loadRepoFitContract(root);
  const stateRecord = isRecord(state) ? state : {};
  const starterProfile = isRecord(stateRecord.starterProfile) ? stateRecord.starterProfile : {};
  const selectedProfileId = normalizeEditorOptionalString(starterProfile.selectedProfileId) as RepoFitProfileId | undefined;
  const adoption = (normalizeEditorOptionalString(starterProfile.adoption) as RepoFitStarterAdoption | undefined) ?? "none";
  const recommendedProfileId = (normalizeEditorOptionalString(starterProfile.recommendedProfileId) as RepoFitProfileId | undefined)
    ?? recommendRepoFitProfile(root, detectLanguages(root));

  const asFields = (value: unknown): VisualizerConfigFieldModel[] => Array.isArray(value) ? value as VisualizerConfigFieldModel[] : [];
  const structureFields = requestFieldsFromState(asFields(stateRecord.structureFields));
  const expectationFields = requestFieldsFromState(asFields(stateRecord.expectationFields));
  const conventionFields = requestFieldsFromState(asFields(stateRecord.conventionFields));

  const document = repoFitContractSchema.parse({
    version: 1,
    repoName: existing.repoName,
    structure: {
      architectureStyle: normalizeEditorOptionalString(structureFields.architectureStyle),
      sourceRoots: normalizeStringArray(structureFields.sourceRoots),
      packageRoots: normalizeStringArray(structureFields.packageRoots),
      ownershipBoundaries: normalizeStringArray(structureFields.ownershipBoundaries),
      pathConventions: normalizeStringArray(structureFields.pathConventions)
    },
    expectations: {
      validationCommands: normalizeStringArray(expectationFields.validationCommands),
      evidenceSources: normalizeStringArray(expectationFields.evidenceSources),
      testingConventions: normalizeStringArray(expectationFields.testingConventions),
      releaseConventions: normalizeStringArray(expectationFields.releaseConventions),
      securityConventions: normalizeStringArray(expectationFields.securityConventions),
      documentationConventions: normalizeStringArray(expectationFields.documentationConventions),
      operationsConventions: normalizeStringArray(expectationFields.operationsConventions)
    },
    conventions: {
      coding: normalizeStringArray(conventionFields.coding),
      designPatterns: normalizeStringArray(conventionFields.designPatterns)
    },
    starterProfile: {
      recommendedProfileId,
      selectedProfileId: selectedProfileId && selectedProfileId !== "none" ? selectedProfileId : undefined,
      adoption,
      comparisonNotes: []
    },
    provenance: {
      inferred: [],
      confirmed: [],
      unresolved: []
    }
  });

  const allFieldPaths = [
    "structure.architectureStyle",
    "structure.sourceRoots",
    "structure.packageRoots",
    "structure.ownershipBoundaries",
    "structure.pathConventions",
    "expectations.validationCommands",
    "expectations.evidenceSources",
    "expectations.testingConventions",
    "expectations.releaseConventions",
    "expectations.securityConventions",
    "expectations.documentationConventions",
    "expectations.operationsConventions",
    "conventions.coding",
    "conventions.designPatterns",
    "starterProfile.selectedProfileId",
    "starterProfile.adoption"
  ];

  const confirmed = allFieldPaths.filter((pathValue) => {
    switch (pathValue) {
      case "structure.architectureStyle":
        return Boolean(document.structure.architectureStyle);
      case "structure.sourceRoots":
        return document.structure.sourceRoots.length > 0;
      case "structure.packageRoots":
        return document.structure.packageRoots.length > 0;
      case "structure.ownershipBoundaries":
        return document.structure.ownershipBoundaries.length > 0;
      case "structure.pathConventions":
        return document.structure.pathConventions.length > 0;
      case "expectations.validationCommands":
        return document.expectations.validationCommands.length > 0;
      case "expectations.evidenceSources":
        return document.expectations.evidenceSources.length > 0;
      case "expectations.testingConventions":
        return document.expectations.testingConventions.length > 0;
      case "expectations.releaseConventions":
        return document.expectations.releaseConventions.length > 0;
      case "expectations.securityConventions":
        return document.expectations.securityConventions.length > 0;
      case "expectations.documentationConventions":
        return document.expectations.documentationConventions.length > 0;
      case "expectations.operationsConventions":
        return document.expectations.operationsConventions.length > 0;
      case "conventions.coding":
        return document.conventions.coding.length > 0;
      case "conventions.designPatterns":
        return document.conventions.designPatterns.length > 0;
      case "starterProfile.selectedProfileId":
        return Boolean(document.starterProfile.selectedProfileId);
      case "starterProfile.adoption":
        return document.starterProfile.adoption !== "none";
      default:
        return false;
    }
  });

  const finalized = repoFitContractSchema.parse({
    ...document,
    starterProfile: {
      ...document.starterProfile,
      comparisonNotes: compareRepoFitWithStarterProfile(document, normalizeRepoFitProfileId(document.starterProfile.selectedProfileId))
    },
    provenance: {
      inferred: existing.provenance.inferred.filter((entry) => !confirmed.includes(entry)),
      confirmed,
      unresolved: allFieldPaths.filter((entry) => !confirmed.includes(entry) && !existing.provenance.inferred.includes(entry))
    }
  });

  return yaml.dump(compactYamlValue(finalized) ?? finalized, { lineWidth: -1, noRefs: true });
}

function renderVisualizerConfigDocument(
  root: string,
  input: { workflow?: string; target: ConfigDocumentTarget; state: unknown }
): VisualizerConfigRenderResult {
  const resolvedDocument = resolveEditableConfigDocument(root, input.workflow, input.target);
  assertWritableConfigPath(resolvedDocument.relativePath);

  const draft = (() => {
    switch (input.target) {
      case "request":
        if (!input.workflow) {
          throw new Error("Workflow is required for request editing.");
        }
        return renderRequestDocumentFromState(root, input.workflow, input.state);
      case "workflow-control":
        if (!input.workflow) {
          throw new Error("Workflow is required for workflow-control editing.");
        }
        return renderWorkflowControlDocumentFromState(root, input.workflow, input.state);
      case "policy-presets":
        return renderPolicyPresetDocumentFromState(input.state);
      case "defaults":
        return renderDefaultsDocumentFromState(input.state);
      case "repo-fit":
        return renderRepoFitDocumentFromState(root, input.state);
    }

    const unsupportedTarget: never = input.target;
    throw new Error(`Unsupported configure target: ${unsupportedTarget}`);
  })();

  return {
    path: resolvedDocument.relativePath,
    draft
  };
}

function resolveRequestMetaSelection(
  rawMeta: unknown,
  defaultsForWorkflow: { profile?: string; policyPreset?: string; workflowVariant?: string } | undefined
): RequestMeta {
  const metaRecord = isRecord(rawMeta) ? rawMeta : {};
  return requestMetaSchema.parse({
    profile: metaRecord.profile ?? defaultsForWorkflow?.profile ?? "default",
    policyPreset: metaRecord.policyPreset ?? defaultsForWorkflow?.policyPreset,
    workflowVariant: metaRecord.workflowVariant ?? defaultsForWorkflow?.workflowVariant ?? "standard",
    agentBindings: metaRecord.agentBindings ?? {}
  });
}

function requestDefinitionForWorkflow(workflowName: string): {
  requestPath?: string;
  missingRequestError?: string;
  parse: (value: unknown) => unknown;
} {
  switch (workflowName) {
    case "planning-discovery":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => validatePlanningRequestCompleteness(planningRequestSchema.parse(value))
      };
    case "architecture-design-review":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => designRequestSchema.parse(value)
      };
    case "implementation-proposal":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => implementationRequestSchema.parse(value)
      };
    case "qa-review":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => qaRequestSchema.parse(value)
      };
    case "security-review":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => securityRequestSchema.parse(value)
      };
    case "pipeline-evidence-review":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => validatePipelineRequestCompleteness(pipelineRequestSchema.parse(value))
      };
    case "release-readiness":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => validateReleaseRequestCompleteness(releaseRequestSchema.parse(value))
      };
    case "deployment-gate-review":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => validateDeploymentRequestCompleteness(deploymentRequestSchema.parse(value))
      };
    case "promotion-approval":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => validatePromotionRequestCompleteness(promotionRequestSchema.parse(value))
      };
    case "incident-handoff":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => validateIncidentRequestCompleteness(incidentRequestSchema.parse(value))
      };
    case "maintenance-triage":
      return {
        requestPath: workflowRequestPaths[workflowName],
        missingRequestError: workflowMissingRequestErrors[workflowName],
        parse: (value) => validateMaintenanceRequestCompleteness(maintenanceRequestSchema.parse(value))
      };
    default:
      return {
        parse: (value) => value
      };
  }
}

function permissionEffectRank(effect: "allow" | "approval_required" | "deny"): number {
  if (effect === "allow") return 0;
  if (effect === "approval_required") return 1;
  return 2;
}

function executionModeRank(mode: "inspect" | "suggest" | "apply"): number {
  if (mode === "inspect") return 0;
  if (mode === "suggest") return 1;
  return 2;
}

function validatePolicyPresetNarrowing(basePolicy: ReturnType<typeof resolvePolicy>, presetName: string, preset: PolicyPresetDocument["presets"][string]): string[] {
  const errors: string[] = [];

  if (preset.defaults?.executionMode && executionModeRank(preset.defaults.executionMode) > executionModeRank(basePolicy.defaults.executionMode)) {
    errors.push(`Policy preset ${presetName} widens execution mode from ${basePolicy.defaults.executionMode} to ${preset.defaults.executionMode}.`);
  }
  if (preset.defaults?.modelAccess === true && basePolicy.defaults.modelAccess === false) {
    errors.push(`Policy preset ${presetName} enables model access even though the base policy disables it.`);
  }
  if (preset.defaults?.network && permissionEffectRank(preset.defaults.network) < permissionEffectRank(basePolicy.defaults.network)) {
    errors.push(`Policy preset ${presetName} widens network access from ${basePolicy.defaults.network} to ${preset.defaults.network}.`);
  }
  if (preset.defaults?.writes && permissionEffectRank(preset.defaults.writes) < permissionEffectRank(basePolicy.defaults.writes)) {
    errors.push(`Policy preset ${presetName} widens write access from ${basePolicy.defaults.writes} to ${preset.defaults.writes}.`);
  }
  if (preset.paths?.allowedRead) {
    errors.push(`Policy preset ${presetName} may not override allowed read paths in v1.`);
  }
  if (preset.paths?.allowedWrite) {
    errors.push(`Policy preset ${presetName} may not override allowed write paths in v1.`);
  }
  if (preset.plugins?.allowedTiers && preset.plugins.allowedTiers.some((tier) => !basePolicy.plugins.allowedTiers.includes(tier))) {
    errors.push(`Policy preset ${presetName} widens allowed plugin tiers.`);
  }
  if (preset.plugins?.allowedSources && preset.plugins.allowedSources.some((source) => !basePolicy.plugins.allowedSources.includes(source))) {
    errors.push(`Policy preset ${presetName} widens allowed plugin sources.`);
  }
  if (preset.plugins?.requireReviewed === false && basePolicy.plugins.requireReviewed) {
    errors.push(`Policy preset ${presetName} disables reviewed-plugin enforcement from the base policy.`);
  }

  for (const [toolName, toolConfig] of Object.entries(preset.tools ?? {})) {
    const baseTool = basePolicy.tools[toolName];
    if (!baseTool) {
      errors.push(`Policy preset ${presetName} references unknown tool policy ${toolName}.`);
      continue;
    }
    if (permissionEffectRank(toolConfig.effect) < permissionEffectRank(baseTool.effect)) {
      errors.push(`Policy preset ${presetName} widens tool access for ${toolName}.`);
    }
  }

  return errors;
}

function applyPolicyPreset(basePolicy: ReturnType<typeof resolvePolicy>, presetName: string | undefined, document: PolicyPresetDocument): ReturnType<typeof resolvePolicy> {
  if (!presetName || presetName === "default") {
    return basePolicy;
  }

  const preset = document.presets[presetName];
  if (!preset) {
    throw new Error(`Unknown policy preset: ${presetName}`);
  }

  const validationErrors = validatePolicyPresetNarrowing(basePolicy, presetName, preset);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(" "));
  }

  return {
    ...basePolicy,
    defaults: {
      executionMode: preset.defaults?.executionMode ?? basePolicy.defaults.executionMode,
      modelAccess: preset.defaults?.modelAccess ?? basePolicy.defaults.modelAccess,
      network: preset.defaults?.network ?? basePolicy.defaults.network,
      writes: preset.defaults?.writes ?? basePolicy.defaults.writes
    },
    paths: {
      allowedRead: basePolicy.paths.allowedRead,
      allowedWrite: basePolicy.paths.allowedWrite,
      blocked: [...new Set([...basePolicy.paths.blocked, ...(preset.paths?.blocked ?? [])])]
    },
    plugins: {
      allowedTiers: preset.plugins?.allowedTiers ?? basePolicy.plugins.allowedTiers,
      allowedSources: preset.plugins?.allowedSources ?? basePolicy.plugins.allowedSources,
      requireReviewed: preset.plugins?.requireReviewed ?? basePolicy.plugins.requireReviewed
    },
    tools: {
      ...basePolicy.tools,
      ...(preset.tools ?? {})
    }
  };
}

function validateWorkflowControlDefinition(
  workflow: WorkflowDefinition,
  control: WorkflowControlDefinition,
  presets: PolicyPresetDocument,
  defaultsForWorkflow: { profile?: string; policyPreset?: string; workflowVariant?: string } | undefined
): string[] {
  const errors: string[] = [];
  const knownNodeIds = new Set(workflow.nodes.map((node) => node.id));
  const knownFieldPaths = new Set((workflowFieldMetadata[workflow.name] ?? []).map((field) => field.path));

  for (const field of control.fieldMetadata) {
    if (!knownFieldPaths.has(field.path)) {
      errors.push(`Workflow ${workflow.name} field metadata references unknown request field '${field.path}'.`);
    }
  }

  for (const [profileName, profile] of Object.entries(control.profiles)) {
    for (const presetName of profile.allowedPolicyPresets) {
      if (!(presetName in presets.presets)) {
        errors.push(`Workflow ${workflow.name} profile '${profileName}' references unknown policy preset '${presetName}'.`);
      }
    }
    for (const variantName of profile.allowedWorkflowVariants) {
      if (!(variantName in control.workflowVariants)) {
        errors.push(`Workflow ${workflow.name} profile '${profileName}' references unknown workflow variant '${variantName}'.`);
      }
    }
  }

  for (const presetName of control.allowedPolicyPresets) {
    if (!(presetName in presets.presets)) {
      errors.push(`Workflow ${workflow.name} references unknown allowed policy preset '${presetName}'.`);
    }
  }

  for (const [variantName, variant] of Object.entries(control.workflowVariants)) {
    for (const nodeId of variant.disabledNodes) {
      if (!knownNodeIds.has(nodeId)) {
        errors.push(`Workflow ${workflow.name} variant '${variantName}' disables unknown node '${nodeId}'.`);
      }
    }
    for (const nodeId of Object.keys(variant.nodeAgentOverrides)) {
      if (!knownNodeIds.has(nodeId)) {
        errors.push(`Workflow ${workflow.name} variant '${variantName}' overrides unknown node '${nodeId}'.`);
      }
    }
  }

  for (const [bindingName, binding] of Object.entries(control.agentBindings)) {
    if (binding.defaultAgent && !binding.allowedAgents.includes(binding.defaultAgent)) {
      errors.push(`Workflow ${workflow.name} binding '${bindingName}' has default agent '${binding.defaultAgent}' outside its allowed agents.`);
    }
    for (const nodeId of binding.nodeIds) {
      if (!knownNodeIds.has(nodeId)) {
        errors.push(`Workflow ${workflow.name} binding '${bindingName}' references unknown node '${nodeId}'.`);
      }
    }
  }

  if (defaultsForWorkflow?.profile && !(defaultsForWorkflow.profile in control.profiles)) {
    errors.push(`Workflow ${workflow.name} defaults reference unknown profile '${defaultsForWorkflow.profile}'.`);
  }
  if (defaultsForWorkflow?.workflowVariant && !(defaultsForWorkflow.workflowVariant in control.workflowVariants)) {
    errors.push(`Workflow ${workflow.name} defaults reference unknown workflow variant '${defaultsForWorkflow.workflowVariant}'.`);
  }
  if (defaultsForWorkflow?.policyPreset && !(defaultsForWorkflow.policyPreset in presets.presets)) {
    errors.push(`Workflow ${workflow.name} defaults reference unknown policy preset '${defaultsForWorkflow.policyPreset}'.`);
  }

  return errors;
}

function fingerprintConfigFiles(root: string, relativePaths: readonly string[], overrides: ConfigDocumentOverrides = {}): ResolvedRunConfigurationSnapshot["fingerprints"] {
  return relativePaths.flatMap((relativePath) => {
    const absolutePath = join(root, relativePath);
    if (!(relativePath in overrides) && !existsSync(absolutePath)) {
      return [];
    }

    return [
      {
        path: relativePath,
        sha256: sha256(readConfigDocumentContents(root, absolutePath, overrides))
      }
    ];
  });
}

function resolveWorkflowControls(
  root: string,
  workflow: WorkflowDefinition,
  basePolicy: ReturnType<typeof resolvePolicy>,
  options?: { allowMissingRequest?: boolean; overrides?: ConfigDocumentOverrides }
): {
  workflow: WorkflowDefinition;
  policy: ReturnType<typeof resolvePolicy>;
  request: unknown;
  requestPath?: string;
  configuration: ResolvedRunConfigurationSnapshot;
} {
  const overrides = options?.overrides ?? {};
  const repoFit = loadRepoFitContract(root, overrides);
  const control = loadWorkflowControlDefinition(root, workflow, overrides);
  const presets = loadPolicyPresetDocument(root, overrides);
  const defaults = loadControlPlaneDefaults(root, [workflow], overrides);
  const requestDefinition = requestDefinitionForWorkflow(workflow.name);
  const requestPath = requestDefinition.requestPath;
  const defaultSelection = defaults.workflows[workflow.name];
  const controlErrors = validateWorkflowControlDefinition(workflow, control, presets, defaultSelection);
  if (controlErrors.length > 0) {
    throw new Error(controlErrors.join(" "));
  }

  let parsedRequest: unknown = {};
  let metaPresent = false;
  if (requestPath) {
    const absoluteRequestPath = join(root, requestPath);
    if (!(requestPath in overrides) && !existsSync(absoluteRequestPath)) {
      if (!options?.allowMissingRequest) {
        throw new Error(requestDefinition.missingRequestError ?? `Missing request for workflow ${workflow.name}`);
      }
    } else {
      const rawRequest = loadYamlDocument(root, absoluteRequestPath, overrides);
      metaPresent = isRecord(rawRequest) && "meta" in rawRequest;
      const requestedMeta = isRecord(rawRequest) ? rawRequest.meta : undefined;
      const selectedMeta = resolveRequestMetaSelection(requestedMeta, defaultSelection);
      const profile = control.profiles[selectedMeta.profile];
      if (!profile) {
        throw new Error(`Unknown request profile '${selectedMeta.profile}' for workflow ${workflow.name}.`);
      }

      const mergedRequest = deepMerge(profile.requestPatch, rawRequest);
      const mergedRecord = isRecord(mergedRequest) ? mergedRequest : {};
      mergedRecord.meta = selectedMeta;
      parsedRequest = requestDefinition.parse(mergedRecord);
    }
  }

  const requestRecord = isRecord(parsedRequest) ? parsedRequest : {};
  const selectedMeta = resolveRequestMetaSelection(requestRecord.meta, defaultSelection);
  const selectedProfile = control.profiles[selectedMeta.profile];
  if (!selectedProfile) {
    throw new Error(`Unknown request profile '${selectedMeta.profile}' for workflow ${workflow.name}.`);
  }

  const allowedPresets = new Set([...control.allowedPolicyPresets, ...selectedProfile.allowedPolicyPresets]);
  if (selectedMeta.policyPreset && allowedPresets.size > 0 && !allowedPresets.has(selectedMeta.policyPreset)) {
    throw new Error(`Policy preset '${selectedMeta.policyPreset}' is not allowed for workflow ${workflow.name}.`);
  }
  const allowedVariants = new Set(["standard", ...selectedProfile.allowedWorkflowVariants]);
  if (allowedVariants.size > 0 && !allowedVariants.has(selectedMeta.workflowVariant)) {
    throw new Error(`Workflow variant '${selectedMeta.workflowVariant}' is not allowed for workflow ${workflow.name}.`);
  }
  for (const bindingName of Object.keys(selectedMeta.agentBindings)) {
    if (!(bindingName in control.agentBindings)) {
      throw new Error(`Unknown agent binding '${bindingName}' for workflow ${workflow.name}.`);
    }
  }

  const variant = selectedMeta.workflowVariant === "standard"
    ? control.workflowVariants.standard ?? { nodeAgentOverrides: {}, disabledNodes: [] }
    : control.workflowVariants[selectedMeta.workflowVariant];
  if (!variant) {
    throw new Error(`Unknown workflow variant '${selectedMeta.workflowVariant}' for workflow ${workflow.name}.`);
  }

  const variantWorkflow = workflowDefinitionSchema.parse({
    ...workflow,
    nodes: workflow.nodes
      .filter((node) => !variant.disabledNodes.includes(node.id))
      .map((node) => ({
        ...node,
        agent: variant.nodeAgentOverrides[node.id] ?? node.agent
      }))
  });

  const boundWorkflow = workflowDefinitionSchema.parse({
    ...variantWorkflow,
    nodes: variantWorkflow.nodes.map((node) => {
      const binding = control.agentBindings[node.id];
      const selectedAgent = binding && selectedMeta.agentBindings[node.id];
      if (!binding || !selectedAgent) {
        return node;
      }
      if (!binding.allowedAgents.includes(selectedAgent)) {
        throw new Error(`Agent '${selectedAgent}' is not allowed for binding '${node.id}' in workflow ${workflow.name}.`);
      }
      return {
        ...node,
        agent: selectedAgent
      };
    })
  });

  const resolvedPolicy = applyPolicyPreset(basePolicy, selectedMeta.policyPreset, presets);
  const sourceRefs = [
    toRelativeRepoPath(root, repoFitContractPath(root)),
    toRelativeRepoPath(root, join(root, ".agentops", "policy.yaml")),
    toRelativeRepoPath(root, join(root, ".agentops", "workflows", `${workflow.name}.yaml`)),
    toRelativeRepoPath(root, policyPresetPath(root)),
    toRelativeRepoPath(root, controlDefaultsPath(root)),
    toRelativeRepoPath(root, workflowControlPath(root, workflow.name)),
    ...(requestPath ? [requestPath] : [])
  ];

  return {
    workflow: boundWorkflow,
    policy: resolvedPolicy,
    request: parsedRequest,
    requestPath,
    configuration: resolvedRunConfigurationSnapshotSchema.parse({
      selectedControls: selectedMeta,
      sourceRefs,
      fingerprints: fingerprintConfigFiles(root, sourceRefs, overrides),
      effective: {
        workflow: boundWorkflow.name,
        policyFingerprint: sha256(JSON.stringify(resolvedPolicy)),
        nodeAgents: Object.fromEntries(
          boundWorkflow.nodes
            .filter((node) => node.agent)
            .map((node) => [node.id, node.agent])
        ),
        disabledNodes: variant.disabledNodes,
        toolEffects: Object.fromEntries(
          Object.entries(resolvedPolicy.tools).map(([toolName, toolConfig]) => [toolName, toolConfig.effect])
        )
      },
      request: {
        path: requestPath ?? ".agentops/requests/<none>",
        metaPresent
      },
      repoFit: {
        path: toRelativeRepoPath(root, repoFitContractPath(root)),
        recommendedProfileId: repoFit.starterProfile.recommendedProfileId,
        selectedProfileId: repoFit.starterProfile.selectedProfileId,
        adoption: repoFit.starterProfile.adoption,
        inferredFields: repoFit.provenance.inferred,
        confirmedFields: repoFit.provenance.confirmed,
        unresolvedFields: repoFit.provenance.unresolved,
        sourceRoots: repoFit.structure.sourceRoots,
        packageRoots: repoFit.structure.packageRoots
      },
      execution: {
        executedNodes: []
      }
    })
  };
}

function loadEvalFixtureCorpus(): EvalFixtureCorpus {
  return evalFixtureCorpusSchema.parse(schemaFixtures.evalFixtureCorpus);
}

function getEvalSpec(specId: string): EvalSpec {
  const corpus = loadEvalFixtureCorpus();
  const spec = corpus.specs.find((candidate) => candidate.id === specId);
  if (!spec) {
    throw new Error(`Unknown eval spec: ${specId}`);
  }

  return spec;
}

function toBundleRef(run: WorkflowRunResult): string {
  return `.agentops/runs/${run.runId}/bundle.json`;
}

function toSummaryRef(run: WorkflowRunResult): string {
  return `.agentops/runs/${run.runId}/summary.md`;
}

function toSetupRun(workflow: string, run: WorkflowRunResult): EvalSetupRun {
  return {
    workflow,
    runId: run.runId,
    bundlePath: toBundleRef(run)
  };
}

function createBlankEvalWorkspace(root: string, evalRunId: string, specId: string): string {
  const workspaceRoot = join(root, ".agentops", "evals", specId, evalRunId, "workspace");
  ensureDirectory(workspaceRoot);
  const evidenceRoot = join(workspaceRoot, ".agentops", "evidence");
  ensureDirectory(evidenceRoot);
  execFileSync("git", ["init"], { cwd: workspaceRoot, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "eval@example.com"], { cwd: workspaceRoot, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "AgentForge Eval"], { cwd: workspaceRoot, stdio: "ignore" });
  writeFileSync(
    join(workspaceRoot, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        repository: {
          type: "git",
          url: "https://github.com/H9-Foundry/fixture.git"
        },
        scripts: {
          test: "echo test",
          lint: "echo lint",
          typecheck: "echo typecheck",
          build: "echo build"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(join(workspaceRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
  writeFileSync(join(workspaceRoot, "src.ts"), "export const value = 1;\n", "utf8");
  writeFileSync(
    join(evidenceRoot, "dependency-alerts.json"),
    JSON.stringify(
      {
        alerts: [
          {
            package: "example-dependency",
            severity: "moderate",
            summary: "Upgrade pending review for deterministic eval coverage."
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(
    join(evidenceRoot, "docs-task.md"),
    "# Docs follow-up\n\n- Align workflow documentation after maintenance triage.\n",
    "utf8"
  );
  execFileSync("git", ["add", "."], { cwd: workspaceRoot, stdio: "ignore" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "init"], { cwd: workspaceRoot, stdio: "ignore" });
  writeFileSync(join(workspaceRoot, "src.ts"), "export const value = 2;\n", "utf8");
  initProject(workspaceRoot);
  return workspaceRoot;
}

function evalRedactionCategories(): string[] {
  return ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key"];
}

function createEvalBundle(
  root: string,
  spec: EvalSpec,
  evaluatedRun: WorkflowRunResult | undefined,
  workspacePath: string,
  setupRuns: readonly EvalSetupRun[],
  deterministicChecks: readonly EvalDeterministicCheck[],
  modelDependentChecks: readonly EvalModelDependentCheck[]
): { bundle: ReturnType<typeof auditBundleSchema.parse>; jsonPath: string; markdownPath: string; outputDir: string } {
  const config = loadAgentForgeConfig(root);
  const policy = resolvePolicy(loadPolicyDocument(join(root, ".agentops", "policy.yaml")), process.env.CI ? "ci" : "local");
  const state = createWorkflowState({
    cwd: root,
    workflow: `eval:${spec.id}`,
    mode: "inspect",
    policy
  });
  const runsRoot = join(root, config.runtime.runsPath);
  const outputDir = join(runsRoot, state.runId);
  ensureDirectory(outputDir);
  const jsonPath = join(outputDir, "bundle.json");
  const markdownPath = join(outputDir, "summary.md");
  const failureCount = deterministicChecks.filter((check) => check.status === "failed").length;
  const passed = failureCount === 0;
  const startedAt = new Date().toISOString();
  const evalArtifact = evalArtifactSchema.parse({
    schemaVersion: state.version,
    artifactKind: "eval-result",
    lifecycleDomain: "evaluate",
    workflow: {
      name: state.workflow,
      displayName: "Eval Runner"
    },
    source: {
      sourceType: "workflow-run",
      runId: state.runId,
      inputRefs: [
        ...(evaluatedRun?.jsonPath ? [evaluatedRun.jsonPath] : []),
        ...setupRuns.map((setup) => setup.bundlePath)
      ],
      issueRefs: ["#165"],
      githubRefs: []
    },
    status: passed ? "complete" : "draft",
    generatedAt: startedAt,
    repo: {
      root: state.repo.root,
      name: state.repo.name,
      branch: state.repo.branch
    },
    provenance: {
      generatedBy: "agentforge-runtime",
      schemaVersion: state.version,
      executionEnvironment: state.context.ciExecution ? "ci" : "local",
      repoRoot: state.repo.root
    },
    redaction: {
      applied: true,
      strategyVersion: "1.0.0",
      categories: evalRedactionCategories()
    },
    auditLink: {
      bundlePath: jsonPath,
      entryIds: [`${state.runId}-eval-runner`],
      findingIds: [],
      proposedActionIds: []
    },
    summary: passed
      ? `Eval result for ${spec.id} passed ${deterministicChecks.length} deterministic check(s).`
      : `Eval result for ${spec.id} failed ${failureCount} deterministic check(s).`,
    payload: {
      specId: spec.id,
      specName: spec.name,
      workflow: spec.workflow,
      repoFixture: spec.repoFixture,
      workspacePath,
      evaluatedRunId: evaluatedRun?.runId,
      evaluatedBundlePath: evaluatedRun ? toBundleRef(evaluatedRun) : undefined,
      setupRuns,
      deterministicChecks,
      modelDependentChecks,
      passed,
      failureCount,
      warningCount: 0
    }
  });

  state.lifecycleArtifacts = [evalArtifact];
  state.auditTrail = [
    createAuditEntry({
      id: `${state.runId}-eval-runner`,
      nodeId: "eval-runner",
      nodeName: "eval-runner",
      kind: "deterministic",
      startedAt,
      completedAt: new Date().toISOString(),
      status: passed ? "success" : "failed",
      summary: evalArtifact.summary,
      toolsRequested: [],
      toolsExecuted: [],
      blockedActions: [],
      validationPassed: passed
    }),
    createAuditEntry({
      id: `${state.runId}-report`,
      nodeId: "report",
      nodeName: "final-report",
      kind: "report",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "success",
      summary: "Generated eval result artifacts.",
      toolsRequested: [],
      toolsExecuted: [],
      blockedActions: [],
      validationPassed: true
    })
  ];

  const bundle = buildAuditBundle(state, {
    startedAt,
    finishedAt: new Date().toISOString(),
    status: passed ? "success" : "partial",
    jsonPath,
    markdownPath,
    provenance: {
      generatedBy: "agentforge-runtime",
      schemaVersion: state.version,
      executionEnvironment: state.context.ciExecution ? "ci" : "local",
      repoRoot: state.repo.root
    },
    redaction: {
      applied: true,
      strategyVersion: "1.0.0",
      categories: evalRedactionCategories()
    },
    components: []
  });
  writeFileSync(jsonPath, JSON.stringify(bundle, null, 2), "utf8");
  writeFileSync(markdownPath, renderAuditBundleMarkdown(bundle), "utf8");
  return { bundle, jsonPath, markdownPath, outputDir };
}

function compareDeterministicChecks(
  baselineChecks: readonly EvalDeterministicCheck[],
  candidateChecks: readonly EvalDeterministicCheck[]
): {
  regressions: BenchmarkDeterministicDelta[];
  improvements: BenchmarkDeterministicDelta[];
  unchangedCount: number;
  nonComparableFindings: string[];
} {
  const regressions: BenchmarkDeterministicDelta[] = [];
  const improvements: BenchmarkDeterministicDelta[] = [];
  const nonComparableFindings: string[] = [];
  let unchangedCount = 0;

  const baselineByName = new Map(baselineChecks.map((check) => [check.name, check]));
  const candidateByName = new Map(candidateChecks.map((check) => [check.name, check]));
  const checkNames = [...new Set([...baselineByName.keys(), ...candidateByName.keys()])].sort();

  for (const name of checkNames) {
    const baselineCheck = baselineByName.get(name);
    const candidateCheck = candidateByName.get(name);

    if (!baselineCheck || !candidateCheck) {
      nonComparableFindings.push(`Deterministic check \`${name}\` is missing from one of the eval results.`);
      continue;
    }

    if (baselineCheck.status === candidateCheck.status) {
      unchangedCount += 1;
      continue;
    }

    if (baselineCheck.status === "not_applicable" || candidateCheck.status === "not_applicable") {
      nonComparableFindings.push(
        `Deterministic check \`${name}\` changed between comparable and not_applicable states (${baselineCheck.status} -> ${candidateCheck.status}).`
      );
      continue;
    }

    if (baselineCheck.status === "passed" && candidateCheck.status === "failed") {
      regressions.push({
        name,
        classification: "regression",
        baselineStatus: baselineCheck.status,
        candidateStatus: candidateCheck.status,
        details: candidateCheck.details ?? baselineCheck.details
      });
      continue;
    }

    if (baselineCheck.status === "failed" && candidateCheck.status === "passed") {
      improvements.push({
        name,
        classification: "improvement",
        baselineStatus: baselineCheck.status,
        candidateStatus: candidateCheck.status,
        details: candidateCheck.details ?? baselineCheck.details
      });
      continue;
    }

    nonComparableFindings.push(
      `Deterministic check \`${name}\` changed in an unsupported way (${baselineCheck.status} -> ${candidateCheck.status}).`
    );
  }

  return { regressions, improvements, unchangedCount, nonComparableFindings };
}

function compareEvalArtifacts(
  baselineRunId: string,
  baselineBundlePath: string,
  baselineArtifact: ReturnType<typeof evalArtifactSchema.parse>,
  candidateRunId: string,
  candidateBundlePath: string,
  candidateArtifact: ReturnType<typeof evalArtifactSchema.parse>
): BenchmarkComparedRun {
  if (baselineArtifact.payload.specId !== candidateArtifact.payload.specId) {
    return {
      runId: candidateRunId,
      bundlePath: candidateBundlePath,
      specId: candidateArtifact.payload.specId,
      workflow: candidateArtifact.payload.workflow,
      comparable: false,
      passed: candidateArtifact.payload.passed,
      failureCount: candidateArtifact.payload.failureCount,
      deterministicCheckCount: candidateArtifact.payload.deterministicChecks.length,
      regressions: [],
      improvements: [],
      unchangedCount: 0,
      nonComparableFindings: [
        `Spec mismatch: baseline ${baselineArtifact.payload.specId} vs candidate ${candidateArtifact.payload.specId}.`
      ]
    };
  }

  if (baselineArtifact.payload.workflow !== candidateArtifact.payload.workflow) {
    return {
      runId: candidateRunId,
      bundlePath: candidateBundlePath,
      specId: candidateArtifact.payload.specId,
      workflow: candidateArtifact.payload.workflow,
      comparable: false,
      passed: candidateArtifact.payload.passed,
      failureCount: candidateArtifact.payload.failureCount,
      deterministicCheckCount: candidateArtifact.payload.deterministicChecks.length,
      regressions: [],
      improvements: [],
      unchangedCount: 0,
      nonComparableFindings: [
        `Workflow mismatch: baseline ${baselineArtifact.payload.workflow} vs candidate ${candidateArtifact.payload.workflow}.`
      ]
    };
  }

  const comparison = compareDeterministicChecks(
    baselineArtifact.payload.deterministicChecks,
    candidateArtifact.payload.deterministicChecks
  );

  return {
    runId: candidateRunId,
    bundlePath: candidateBundlePath,
    specId: candidateArtifact.payload.specId,
    workflow: candidateArtifact.payload.workflow,
    comparable: comparison.nonComparableFindings.length === 0,
    passed: candidateArtifact.payload.passed,
    failureCount: candidateArtifact.payload.failureCount,
    deterministicCheckCount: candidateArtifact.payload.deterministicChecks.length,
    regressions: comparison.regressions,
    improvements: comparison.improvements,
    unchangedCount: comparison.unchangedCount,
    nonComparableFindings: comparison.nonComparableFindings
  };
}

function createBenchmarkBundle(
  root: string,
  baselineRunId: string,
  baselineBundlePath: string,
  baselineArtifact: ReturnType<typeof evalArtifactSchema.parse>,
  comparedRuns: readonly BenchmarkComparedRun[]
): { bundle: ReturnType<typeof auditBundleSchema.parse>; jsonPath: string; markdownPath: string; outputDir: string } {
  const config = loadAgentForgeConfig(root);
  const policy = resolvePolicy(loadPolicyDocument(join(root, ".agentops", "policy.yaml")), process.env.CI ? "ci" : "local");
  const state = createWorkflowState({
    cwd: root,
    workflow: "eval:compare",
    mode: "inspect",
    policy
  });
  const runsRoot = join(root, config.runtime.runsPath);
  const outputDir = join(runsRoot, state.runId);
  ensureDirectory(outputDir);
  const jsonPath = join(outputDir, "bundle.json");
  const markdownPath = join(outputDir, "summary.md");
  const regressionCount = comparedRuns.reduce((total, candidate) => total + candidate.regressions.length, 0);
  const improvementCount = comparedRuns.reduce((total, candidate) => total + candidate.improvements.length, 0);
  const unchangedCount = comparedRuns.reduce((total, candidate) => total + candidate.unchangedCount, 0);
  const nonComparableCount = comparedRuns.reduce((total, candidate) => total + candidate.nonComparableFindings.length, 0);
  const summaryConclusion =
    regressionCount > 0
      ? `Detected ${regressionCount} deterministic regression(s) across compared eval results.`
      : improvementCount > 0
        ? `Detected ${improvementCount} deterministic improvement(s) with no regressions.`
        : nonComparableCount > 0
          ? `Compared eval results contain ${nonComparableCount} non-comparable difference(s) and no deterministic regressions.`
          : "No deterministic regressions detected across compared eval results.";
  const benchmarkArtifact = benchmarkArtifactSchema.parse({
    schemaVersion: state.version,
    artifactKind: "benchmark-summary",
    lifecycleDomain: "evaluate",
    workflow: {
      name: state.workflow,
      displayName: "Eval Benchmark Compare"
    },
    source: {
      sourceType: "workflow-run",
      runId: state.runId,
      inputRefs: [baselineBundlePath, ...comparedRuns.map((candidate) => candidate.bundlePath)],
      issueRefs: ["#166"],
      githubRefs: []
    },
    status: "complete",
    generatedAt: new Date().toISOString(),
    repo: {
      root: state.repo.root,
      name: state.repo.name,
      branch: state.repo.branch
    },
    provenance: {
      generatedBy: "agentforge-runtime",
      schemaVersion: state.version,
      executionEnvironment: state.context.ciExecution ? "ci" : "local",
      repoRoot: state.repo.root
    },
    redaction: {
      applied: true,
      strategyVersion: "1.0.0",
      categories: evalRedactionCategories()
    },
    auditLink: {
      bundlePath: jsonPath,
      entryIds: [`${state.runId}-benchmark-compare`],
      findingIds: [],
      proposedActionIds: []
    },
    summary: summaryConclusion,
    payload: {
      baselineRunId,
      baselineBundlePath,
      baselineSpecId: baselineArtifact.payload.specId,
      baselineWorkflow: baselineArtifact.payload.workflow,
      comparedRuns,
      regressionCount,
      improvementCount,
      unchangedCount,
      nonComparableCount,
      summaryConclusion
    }
  });

  state.lifecycleArtifacts = [benchmarkArtifact];
  state.auditTrail = [
    createAuditEntry({
      id: `${state.runId}-benchmark-compare`,
      nodeId: "benchmark-compare",
      nodeName: "benchmark-compare",
      kind: "deterministic",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: regressionCount > 0 ? "failed" : "success",
      summary: benchmarkArtifact.summary,
      toolsRequested: [],
      toolsExecuted: [],
      blockedActions: [],
      validationPassed: regressionCount === 0
    })
  ];

  const bundle = buildAuditBundle(state, {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    status: regressionCount > 0 || nonComparableCount > 0 ? "partial" : "success",
    jsonPath,
    markdownPath,
    provenance: {
      generatedBy: "agentforge-runtime",
      schemaVersion: state.version,
      executionEnvironment: state.context.ciExecution ? "ci" : "local",
      repoRoot: state.repo.root
    },
    redaction: {
      applied: true,
      strategyVersion: "1.0.0",
      categories: evalRedactionCategories()
    },
    components: []
  });
  writeFileSync(jsonPath, JSON.stringify(bundle, null, 2), "utf8");
  writeFileSync(markdownPath, renderAuditBundleMarkdown(bundle), "utf8");
  return { bundle, jsonPath, markdownPath, outputDir };
}

function ensureInitFiles(root: string): string[] {
  const created: string[] = [];
  const configDir = join(root, ".agentops");
  const workflowsDir = join(configDir, "workflows");
  const requestsDir = join(configDir, "requests");
  ensureDirectory(workflowsDir);
  ensureDirectory(requestsDir);

  const files = [
    {
      path: join(configDir, "agentops.yaml"),
      contents: agentforgeConfigTemplate.replace("REPO_NAME", root.split("/").at(-1) ?? "repo")
    },
    {
      path: repoFitContractPath(root),
      contents: yaml.dump(createDefaultRepoFitContract(root), { lineWidth: -1, noRefs: true })
    },
    {
      path: join(configDir, "policy.yaml"),
      contents: policyTemplate
    },
    {
      path: join(workflowsDir, "pr-review.yaml"),
      contents: prReviewWorkflowTemplate
    },
    {
      path: join(workflowsDir, "planning-discovery.yaml"),
      contents: planningWorkflowTemplate
    },
    {
      path: join(workflowsDir, "architecture-design-review.yaml"),
      contents: designWorkflowTemplate
    },
    {
      path: join(workflowsDir, "implementation-proposal.yaml"),
      contents: implementationWorkflowTemplate
    },
    {
      path: join(workflowsDir, "qa-review.yaml"),
      contents: qaWorkflowTemplate
    },
    {
      path: join(workflowsDir, "security-review.yaml"),
      contents: securityWorkflowTemplate
    },
    {
      path: join(workflowsDir, "release-readiness.yaml"),
      contents: releaseWorkflowTemplate
    },
    {
      path: join(workflowsDir, "pipeline-evidence-review.yaml"),
      contents: pipelineWorkflowTemplate
    },
    {
      path: join(workflowsDir, "deployment-gate-review.yaml"),
      contents: deploymentGateWorkflowTemplate
    },
    {
      path: join(workflowsDir, "promotion-approval.yaml"),
      contents: promotionApprovalWorkflowTemplate
    },
    {
      path: join(workflowsDir, "incident-handoff.yaml"),
      contents: incidentWorkflowTemplate
    },
    {
      path: join(workflowsDir, "maintenance-triage.yaml"),
      contents: maintenanceWorkflowTemplate
    }
  ];

  for (const file of files) {
    if (!existsSync(file.path)) {
      writeFileSync(file.path, file.contents, "utf8");
      created.push(file.path);
    }
  }

  created.push(...ensureControlFiles(root));

  return created;
}

function buildBuiltinAgentRegistry(): Map<string, RuntimeAgent> {
  return createBuiltinAgentRegistry();
}

function buildAdapterRegistry(): Map<string, ToolAdapter> {
  return new Map(createBuiltinAdapters().map((adapter) => [adapter.manifest.name, adapter]));
}

function createBlockedPlugin(
  registration: AgentPluginRegistration,
  reason: string,
  trust?: BlockedPlugin["trust"]
): BlockedPlugin {
  return {
    name: registration.name,
    package: registration.package,
    reason,
    ...(trust ? { trust } : {})
  };
}

async function buildAgentRegistry(
  root: string,
  config: AgentForgeConfig,
  workflowName: string,
  policy: ReturnType<typeof resolvePolicy>,
  policyEngine = createPolicyEngine(policy, root)
) {
  const agents = buildBuiltinAgentRegistry();
  const registryClient = new LocalPluginRegistry(root);
  const blockedPlugins: BlockedPlugin[] = [];

  for (const registration of config.plugins.agents) {
    if (!registration.enabled) {
      continue;
    }

    if (agents.has(registration.name)) {
      blockedPlugins.push(createBlockedPlugin(registration, `Plugin name collides with an existing agent: ${registration.name}`));
      continue;
    }

    try {
      const pluginAgent = await registryClient.loadLocalAgentPlugin(registration.package);

      if (pluginAgent.manifest.name !== registration.name) {
        blockedPlugins.push(
          createBlockedPlugin(
            registration,
            `Registered plugin name ${registration.name} does not match exported manifest name ${pluginAgent.manifest.name}`,
            pluginAgent.manifest.trust
          )
        );
        continue;
      }

      const trustDecision = policyEngine.evaluatePluginTrust(pluginAgent.manifest.name, pluginAgent.manifest.trust);
      if (!trustDecision.allowed) {
        blockedPlugins.push(createBlockedPlugin(registration, trustDecision.reason ?? "Plugin denied by trust policy.", pluginAgent.manifest.trust));
        continue;
      }

      agents.set(pluginAgent.manifest.name, pluginAgent);
    } catch (error) {
      blockedPlugins.push(
        createBlockedPlugin(
          registration,
          error instanceof Error ? error.message : `Failed to load plugin for workflow ${workflowName}`,
          undefined
        )
      );
    }
  }

  return { agents, blockedPlugins, policy, policyEngine };
}

function validateWorkflowAgents(workflow: WorkflowDefinition, agents: Map<string, RuntimeAgent>, blockedPlugins: BlockedPlugin[]): void {
  const blockedByName = new Map(blockedPlugins.map((plugin) => [plugin.name, plugin]));

  for (const node of workflow.nodes) {
    if (!node.agent) {
      continue;
    }

    if (agents.has(node.agent)) {
      continue;
    }

    const blocked = blockedByName.get(node.agent);
    if (blocked) {
      throw new Error(`Workflow agent ${node.agent} is blocked: ${blocked.reason}`);
    }

    throw new Error(`Workflow agent is not registered: ${node.agent}`);
  }
}

function createPlanningDiscoveryPresetRequest(root: string): PlanningRequest {
  const repoName = root.split("/").at(-1) ?? "this repository";
  const pathHints = ["README.md", "package.json", "src", "docs"].filter((pathHint) => existsSync(join(root, pathHint)));

  return planningRequestSchema.parse({
    problemStatement: `Plan the next safe local-first improvement for ${repoName}.`,
    goals: ["Produce one planning brief artifact", "Identify a bounded next step before opening a pull request"],
    constraints: ["Keep the default path local-first and read-only", "Prefer a small, reviewable next change"],
    pathHints,
    assumptions: ["This preset is a starter request that can be edited after initialization if the repository needs different focus."]
  });
}

function applyStartupPreset(
  root: string,
  preset: StartupPresetName
): { preset: StartupPresetName; workflow: string; requestPath: string; created: boolean } {
  const requestsRoot = join(root, ".agentops", "requests");
  ensureDirectory(requestsRoot);

  switch (preset) {
    case "planning-discovery": {
      const requestPath = join(requestsRoot, "planning.yaml");
      const created = !existsSync(requestPath);
      if (created) {
        writeYamlFile(requestPath, createPlanningDiscoveryPresetRequest(root));
      }

      return {
        preset,
        workflow: "planning-discovery",
        requestPath,
        created
      };
    }
  }
}

export function initProject(
  cwd = process.cwd(),
  options?: { preset?: StartupPresetName }
): {
  root: string;
  created: string[];
  preset?: { preset: StartupPresetName; workflow: string; requestPath: string; created: boolean };
} {
  const resolvedRoot = findWorkspaceRoot(cwd);
  const displayRoot = existsSync(join(cwd, ".git")) && realpathSync(cwd) === realpathSync(resolvedRoot)
    ? cwd
    : resolvedRoot;
  const created = ensureInitFiles(resolvedRoot).map((pathValue) =>
    pathValue.startsWith(resolvedRoot) ? `${displayRoot}${pathValue.slice(resolvedRoot.length)}` : pathValue
  );
  const preset = options?.preset ? applyStartupPreset(resolvedRoot, options.preset) : undefined;
  return {
    root: displayRoot,
    created,
    ...(preset
      ? {
          preset: {
            ...preset,
            requestPath: preset.requestPath.startsWith(resolvedRoot)
              ? `${displayRoot}${preset.requestPath.slice(resolvedRoot.length)}`
              : preset.requestPath
          }
        }
      : {})
  };
}

export function scanProject(cwd = process.cwd()): {
  root: string;
  packageManager: string;
  languages: string[];
  changedFiles: string[];
  recommendations: string[];
  risks: string[];
} {
  const root = findWorkspaceRoot(cwd);
  ensureInitFiles(root);
  const policyPath = join(root, ".agentops", "policy.yaml");
  const policy = resolvePolicy(loadPolicyDocument(policyPath), process.env.CI ? "ci" : "local");
  const state = createWorkflowState({
    cwd: root,
    workflow: "pr-review",
    mode: "inspect",
    policy
  });

  const risks = state.changes.changedFiles.filter((filePath) =>
    /(^\.env|(^|\/)\.env|^secrets\/|^infra\/prod\/|\.pem$|\.key$|(^|\/)id_rsa)/.test(filePath)
  );

  return {
    root,
    packageManager: state.repo.packageManager,
    languages: state.repo.languages,
    changedFiles: state.changes.changedFiles,
    recommendations: ["context-collector", "security-audit", "code-review", "test-generation"],
    risks
  };
}

function listWorkflowDefinitions(root: string): WorkflowDefinition[] {
  const workflowsRoot = join(root, ".agentops", "workflows");
  return readdirSync(workflowsRoot)
    .filter((entry) => entry.endsWith(".yaml"))
    .map((entry) => normalizeWorkflow(loadYaml(join(workflowsRoot, entry))));
}

async function validateControlPlaneAtRoot(root: string, overrides: ConfigDocumentOverrides = {}): Promise<ConfigValidationResult> {
  const config = loadAgentForgeConfig(root);
  const basePolicy = resolvePolicy(loadPolicyDocument(join(root, ".agentops", "policy.yaml")), process.env.CI ? "ci" : "local");
  const errors: string[] = [];
  const workflows = listWorkflowDefinitions(root);

  try {
    loadRepoFitContract(root, overrides);
  } catch (error) {
    errors.push(`repo-fit: ${error instanceof Error ? error.message : String(error)}`);
  }

  const results: ConfigValidationResult["workflows"] = [];

  for (const workflow of workflows) {
    try {
      const resolved = resolveWorkflowControls(root, workflow, basePolicy, { allowMissingRequest: true, overrides });
      const policyEngine = createPolicyEngine(resolved.policy, root);
      const { agents, blockedPlugins } = await buildAgentRegistry(root, config, workflow.name, resolved.policy, policyEngine);
      validateWorkflowLifecyclePosture(resolved.workflow, policyEngine);
      validateWorkflowAgents(resolved.workflow, agents, blockedPlugins);
      const control = loadWorkflowControlDefinition(root, workflow, overrides);
      const presets = loadPolicyPresetDocument(root, overrides);
      results.push({
        workflow: workflow.name,
        requestPath: resolved.requestPath ?? "<none>",
        profileCount: Object.keys(control.profiles).length,
        variantCount: Object.keys(control.workflowVariants).length,
        policyPresetCount: Object.keys(presets.presets).length,
        bindingCount: Object.keys(control.agentBindings).length
      });
    } catch (error) {
      errors.push(`${workflow.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    root,
    valid: errors.length === 0,
    workflows: results,
    errors
  };
}

export async function validateControlPlane(
  cwd = process.cwd(),
  options?: { overrides?: ConfigDocumentOverrides }
): Promise<ConfigValidationResult> {
  const root = findWorkspaceRoot(cwd);
  ensureInitFiles(root);
  return validateControlPlaneAtRoot(root, options?.overrides ?? {});
}

function createPreviewDiff(current: string, draft: string): string {
  const currentLines = current.split("\n");
  const draftLines = draft.split("\n");
  const max = Math.max(currentLines.length, draftLines.length);
  const lines: string[] = [];

  for (let index = 0; index < max; index += 1) {
    const left = currentLines[index];
    const right = draftLines[index];
    if (left === right) {
      continue;
    }
    if (left !== undefined) {
      lines.push(`- ${left}`);
    }
    if (right !== undefined) {
      lines.push(`+ ${right}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "No textual diff.";
}

function summarizeResolvedConfiguration(
  resolved: ReturnType<typeof resolveWorkflowControls>
): NonNullable<VisualizerConfigPreviewResult["semantic"]> {
  return {
    workflow: resolved.workflow.name,
    selectedProfile: resolved.configuration.selectedControls.profile,
    selectedPolicyPreset: resolved.configuration.selectedControls.policyPreset,
    selectedWorkflowVariant: resolved.configuration.selectedControls.workflowVariant,
    selectedAgentBindings: resolved.configuration.selectedControls.agentBindings,
    nodeAgents: resolved.configuration.effective.nodeAgents,
    disabledNodes: resolved.configuration.effective.disabledNodes,
    policySummary: {
      executionMode: resolved.policy.defaults.executionMode,
      modelAccess: resolved.policy.defaults.modelAccess,
      network: resolved.policy.defaults.network,
      writes: resolved.policy.defaults.writes,
      deniedTools: Object.entries(resolved.policy.tools)
        .filter(([, tool]) => tool.effect === "deny")
        .map(([toolName]) => toolName)
        .sort(),
      approvalTools: Object.entries(resolved.policy.tools)
        .filter(([, tool]) => tool.effect === "approval_required")
        .map(([toolName]) => toolName)
        .sort()
    }
  };
}

async function previewVisualizerConfigDocument(
  root: string,
  input: { workflow?: string; target: string; draft: string }
): Promise<VisualizerConfigPreviewResult> {
  const target = input.target as ConfigDocumentTarget;
  const resolvedDocument = resolveEditableConfigDocument(root, input.workflow, target);
  assertWritableConfigPath(resolvedDocument.relativePath);
  const currentContents = existsSync(resolvedDocument.path) ? readFileSync(resolvedDocument.path, "utf8") : "";
  const overrides: ConfigDocumentOverrides = {
    [resolvedDocument.relativePath]: input.draft
  };
  const validation = await validateControlPlaneAtRoot(root, overrides);
  const previewHash = sha256(`${resolvedDocument.relativePath}\n${currentContents}\n---\n${input.draft}`);
  let semantic: VisualizerConfigPreviewResult["semantic"] | undefined;

  if (input.workflow && validation.valid) {
    const baseWorkflow = listWorkflowDefinitions(root).find((candidate) => candidate.name === input.workflow);
    if (!baseWorkflow) {
      throw new Error(`Unknown workflow '${input.workflow}'.`);
    }
    const basePolicy = resolvePolicy(loadPolicyDocument(join(root, ".agentops", "policy.yaml")), process.env.CI ? "ci" : "local");
    semantic = summarizeResolvedConfiguration(
      resolveWorkflowControls(root, baseWorkflow, basePolicy, {
        allowMissingRequest: true,
        overrides
      })
    );
  }

  return {
    path: resolvedDocument.relativePath,
    previewHash,
    diff: createPreviewDiff(currentContents, input.draft),
    summary: `Preview generated for ${resolvedDocument.relativePath}. ${validation.valid ? "Validation passed." : "Validation failed."}`,
    semantic,
    validation: {
      valid: validation.valid,
      errors: validation.errors
    }
  };
}

async function saveVisualizerConfigDocument(
  root: string,
  input: { workflow?: string; target: string; draft: string; previewHash: string; approval: string }
): Promise<VisualizerConfigSaveResult> {
  if (input.approval !== "approve-write") {
    throw new Error("Saving config requires approval token 'approve-write'.");
  }

  const target = input.target as ConfigDocumentTarget;
  const resolvedDocument = resolveEditableConfigDocument(root, input.workflow, target);
  assertWritableConfigPath(resolvedDocument.relativePath);
  const preview = await previewVisualizerConfigDocument(root, {
    workflow: input.workflow,
    target,
    draft: input.draft
  });
  if (preview.previewHash !== input.previewHash) {
    throw new Error("Preview hash mismatch. Generate a fresh preview before saving.");
  }
  if (preview.validation && !preview.validation.valid) {
    throw new Error(preview.validation.errors.join(" "));
  }

  writeFileSync(resolvedDocument.path, input.draft, "utf8");
  return {
    path: resolvedDocument.relativePath,
    validation: preview.validation
  };
}

function createVisualizerConfigEditor(root: string): VisualizerConfigEditor {
  const config = loadAgentForgeConfig(root);
  const editingEnabled = config.visualizer.experimentalConfigEditing;

  return {
    editingEnabled,
    loadEditorModel: ({ workflow, target }) => loadVisualizerConfigEditorModel(root, { workflow, target }, editingEnabled),
    renderDocument: ({ workflow, target, state }) => renderVisualizerConfigDocument(root, { workflow, target, state }),
    previewDocument: editingEnabled
      ? async (input) => await previewVisualizerConfigDocument(root, input)
      : undefined,
    saveDocument: editingEnabled
      ? async (input) => await saveVisualizerConfigDocument(root, input)
      : undefined
  };
}

function loadPackageScripts(root: string): Record<string, string> {
  const packageJsonPath = join(root, "package.json");
  if (!existsSync(packageJsonPath)) {
    return {};
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { scripts?: Record<string, string> };
  return packageJson.scripts ?? {};
}

function formatPackageScriptCommand(packageManager: string, scriptName: string): string {
  switch (packageManager) {
    case "pnpm":
      return `pnpm ${scriptName}`;
    case "yarn":
      return `yarn ${scriptName}`;
    case "bun":
      return `bun run ${scriptName}`;
    case "npm":
      return scriptName === "test" ? "npm test" : `npm run ${scriptName}`;
    default:
      return `npm run ${scriptName}`;
  }
}

function detectValidationCommands(root: string, packageManager: string): DetectedValidationCommand[] {
  const scripts = loadPackageScripts(root);
  const candidates: Array<{ kind: ValidationCommandKind; names: string[] }> = [
    { kind: "lint", names: ["lint"] },
    { kind: "typecheck", names: ["typecheck", "check-types"] },
    { kind: "build", names: ["build"] },
    { kind: "test", names: ["test"] },
    { kind: "e2e", names: ["test:e2e", "e2e", "journeys:check"] }
  ];

  return candidates
    .map((candidate) => {
      const matchedScript = candidate.names.find((name) => typeof scripts[name] === "string");
      if (!matchedScript) {
        return undefined;
      }

      return {
        kind: candidate.kind,
        scriptName: matchedScript,
        command: formatPackageScriptCommand(packageManager, matchedScript)
      };
    })
    .filter((command): command is DetectedValidationCommand => Boolean(command));
}

function detectExistingPaths(root: string, candidates: string[]): string[] {
  return candidates.filter((relativePath) => existsSync(join(root, relativePath)));
}

function detectReleaseProfile(root: string, validationCommands: DetectedValidationCommand[]): OnboardingReleaseProfile {
  const ciConfigPaths = detectExistingPaths(root, [
    ".github/workflows",
    ".gitlab-ci.yml",
    ".circleci/config.yml",
    "azure-pipelines.yml"
  ]);
  const ciArtifactPaths = detectExistingPaths(root, [
    "coverage",
    "playwright-report",
    "test-results",
    "reports",
    "artifacts"
  ]);
  const releaseDocPaths = detectExistingPaths(root, [
    "RELEASE.md",
    "docs/release.md",
    "docs/release-runbook.md",
    "docs/release-process.md"
  ]);
  const deploymentDocPaths = detectExistingPaths(root, [
    "DEPLOYMENT.md",
    "docs/deploy.md",
    "docs/deployment.md",
    "docs/deployment-runbook.md",
    "docs/promotion.md"
  ]);
  const promotionSignals = detectExistingPaths(root, [
    "docs/promotion.md",
    "docs/change-management.md",
    "docs/rollback.md"
  ]);
  const recommendedEvidenceSources = [
    ...validationCommands.map((command) => command.command),
    ...ciArtifactPaths,
    ...releaseDocPaths,
    ...deploymentDocPaths
  ];

  return {
    relevant:
      ciConfigPaths.length > 0 ||
      releaseDocPaths.length > 0 ||
      deploymentDocPaths.length > 0 ||
      validationCommands.some((command) => command.kind === "build"),
    ciConfigPaths,
    ciArtifactPaths,
    releaseDocPaths,
    deploymentDocPaths,
    promotionSignals,
    recommendedEvidenceSources
  };
}

function inferWorkflowFamilies(
  root: string,
  validationCommands: DetectedValidationCommand[],
  releaseProfile: OnboardingReleaseProfile
): OnboardingWorkflowFamily[] {
  const families: OnboardingWorkflowFamily[] = ["review/planning"];
  const docsOrOpsSignals = detectExistingPaths(root, ["docs", ".github", ".gitlab-ci.yml", ".circleci"]);

  if (validationCommands.length > 0) {
    families.push("qa/security");
  }

  if (releaseProfile.relevant) {
    families.push("release/pipeline/deployment");
  }

  if (docsOrOpsSignals.length > 0 || releaseProfile.relevant) {
    families.push("maintenance/incident");
  }

  return families;
}

function inferFirstWorkflow(
  workflowFamilies: OnboardingWorkflowFamily[],
  releaseProfile: OnboardingReleaseProfile
): string {
  if (workflowFamilies.includes("release/pipeline/deployment") && releaseProfile.relevant) {
    return "release-readiness";
  }

  if (workflowFamilies.includes("review/planning")) {
    return "planning-discovery";
  }

  return "pr-review";
}

function inferRecommendedPreset(workflow: string): StartupPresetName[] {
  return workflow === "planning-discovery" ? ["planning-discovery"] : [];
}

function repoFitContractPath(root: string): string {
  return join(root, ".agentops", repoFitFileName);
}

function listTopLevelDirectories(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((entry) => !entry.startsWith(".git"))
    .sort();
}

function detectRepoSourceRoots(root: string): string[] {
  const candidates = ["packages", "apps", "services", "libs", "src", "tests", "test", "docs", "infra", "scripts"];
  return candidates.filter((candidate) => existsSync(join(root, candidate)));
}

function detectRepoPackageRoots(root: string): string[] {
  const candidates = ["packages", "apps", "services", "libs"];
  return candidates.filter((candidate) => existsSync(join(root, candidate)));
}

function detectArchitectureStyle(root: string, languages: readonly string[]): string {
  if (existsSync(join(root, "pnpm-workspace.yaml")) || detectRepoPackageRoots(root).length > 0) {
    return "monorepo";
  }
  if (languages.includes("python")) {
    return "service-repo";
  }
  if (languages.includes("rust")) {
    return "crate";
  }
  if (languages.includes("typescript") || languages.includes("javascript")) {
    return existsSync(join(root, "src")) ? "package-repo" : "application-repo";
  }
  return "unspecified";
}

function detectPathConventions(root: string): string[] {
  const conventions: string[] = [];
  if (existsSync(join(root, "src"))) {
    conventions.push("Primary implementation sources live under src/.");
  }
  if (existsSync(join(root, "packages"))) {
    conventions.push("Workspace packages live under packages/.");
  }
  if (existsSync(join(root, "apps"))) {
    conventions.push("Application entrypoints live under apps/.");
  }
  if (existsSync(join(root, "tests")) || existsSync(join(root, "test"))) {
    conventions.push("Repository-level tests live under tests/ or test/.");
  }
  if (existsSync(join(root, "docs"))) {
    conventions.push("Documentation and runbooks live under docs/.");
  }
  if (existsSync(join(root, ".github", "workflows"))) {
    conventions.push("CI and release automation is tracked in .github/workflows/.");
  }
  return conventions;
}

function inferRepoOwnershipBoundaries(packageRoots: readonly string[], sourceRoots: readonly string[]): string[] {
  return [
    ...packageRoots.map((rootName) => `${rootName}/ acts as a top-level package or service boundary.`),
    ...sourceRoots.filter((rootName) => rootName === "src" || rootName === "tests" || rootName === "docs").map((rootName) =>
      `${rootName}/ is a canonical repository surface and should remain intentionally structured.`
    )
  ];
}

function recommendRepoFitProfile(root: string, languages: readonly string[]): Exclude<RepoFitProfileId, "none"> | undefined {
  if (existsSync(join(root, "pnpm-workspace.yaml")) || existsSync(join(root, "packages"))) {
    return "agentforge-ts-monorepo";
  }
  if (languages.includes("python")) {
    return "agentforge-python-service";
  }
  if (languages.includes("rust")) {
    return "agentforge-rust-crate";
  }
  if (languages.includes("typescript") || languages.includes("javascript")) {
    return "agentforge-ts-package";
  }
  return undefined;
}

function defaultProfileSelection(profileId?: RepoFitProfileId, adoption: RepoFitStarterAdoption = "none"): RepoFitContract["starterProfile"] {
  if (!profileId || profileId === "none") {
    return {
      adoption: "none",
      comparisonNotes: []
    };
  }

  return {
    recommendedProfileId: profileId,
    selectedProfileId: profileId,
    adoption,
    comparisonNotes: []
  };
}

function compareRepoFitWithStarterProfile(
  contract: RepoFitContract,
  starterProfileId: RepoFitProfileId | undefined
): string[] {
  if (!starterProfileId || starterProfileId === "none") {
    return [];
  }

  const starter = repoFitStarterProfiles[starterProfileId];
  const notes: string[] = [];
  if (!starter) {
    return notes;
  }

  const missingSourceRoots = starter.sourceRoots.filter((rootName) => !contract.structure.sourceRoots.includes(rootName));
  if (missingSourceRoots.length > 0) {
    notes.push(`Starter profile ${starter.label} expects source roots such as ${missingSourceRoots.join(", ")}.`);
  }

  const missingValidation = starter.validationCommands.filter((command) => !contract.expectations.validationCommands.includes(command));
  if (missingValidation.length > 0) {
    notes.push(`Starter profile ${starter.label} typically validates with ${missingValidation.join(", ")}.`);
  }

  const missingPatterns = starter.designPatterns.filter((pattern) => !contract.conventions.designPatterns.includes(pattern));
  if (missingPatterns.length > 0) {
    notes.push(`Starter profile ${starter.label} suggests patterns such as ${missingPatterns.slice(0, 2).join("; ")}.`);
  }

  return notes;
}

function normalizeRepoFitProfileId(value: string | undefined): RepoFitProfileId | undefined {
  if (!value) {
    return undefined;
  }
  return repoFitProfileIds.includes(value as RepoFitProfileId) ? (value as RepoFitProfileId) : undefined;
}

function createRepoFitContract(
  profile: Omit<OnboardingProfile, "repoFit">,
  answers: RepoFitWizardAnswers = {}
): OnboardingRepoFitInference {
  const sourceRoots = answers.sourceRoots ?? detectRepoSourceRoots(profile.root);
  const packageRoots = answers.packageRoots ?? detectRepoPackageRoots(profile.root);
  const recommendedProfileId = recommendRepoFitProfile(profile.root, profile.languages);
  const selectedProfileId = answers.selectedProfileId ?? recommendedProfileId;
  const starterProfile = selectedProfileId && selectedProfileId !== "none"
    ? repoFitStarterProfiles[selectedProfileId]
    : (recommendedProfileId ? repoFitStarterProfiles[recommendedProfileId] : undefined);

  const inferredContract = repoFitContractSchema.parse({
    version: 1,
    repoName: profile.repoName,
    structure: {
      architectureStyle: answers.architectureStyle ?? detectArchitectureStyle(profile.root, profile.languages),
      sourceRoots,
      packageRoots,
      ownershipBoundaries: answers.ownershipBoundaries ?? inferRepoOwnershipBoundaries(packageRoots, sourceRoots),
      pathConventions: answers.pathConventions ?? detectPathConventions(profile.root)
    },
    expectations: {
      validationCommands: answers.validationCommands ?? profile.recommendedValidationExpectations,
      evidenceSources: answers.evidenceSources ?? profile.recommendedEvidenceExpectations,
      testingConventions: answers.testingConventions ?? (starterProfile?.testingConventions ?? []),
      releaseConventions: answers.releaseConventions ?? (starterProfile?.releaseConventions ?? []),
      securityConventions: answers.securityConventions ?? (starterProfile?.securityConventions ?? []),
      documentationConventions: answers.documentationConventions ?? (starterProfile?.documentationConventions ?? []),
      operationsConventions: answers.operationsConventions ?? (starterProfile?.operationsConventions ?? [])
    },
    conventions: {
      coding: answers.codingConventions ?? (starterProfile?.coding ?? []),
      designPatterns: answers.designPatterns ?? (starterProfile?.designPatterns ?? [])
    },
    starterProfile: defaultProfileSelection(
      selectedProfileId ?? recommendedProfileId,
      answers.adoption ?? (selectedProfileId && selectedProfileId !== "none" ? "partial" : "none")
    ),
    provenance: {
      inferred: [],
      confirmed: [],
      unresolved: []
    }
  });

  const inferredFields: string[] = [];
  const confirmedFields: string[] = [];
  const unresolvedFields: string[] = [];

  const classifyField = (pathValue: string, answerProvided: boolean, present: boolean) => {
    if (answerProvided) {
      confirmedFields.push(pathValue);
      return;
    }
    if (present) {
      inferredFields.push(pathValue);
      return;
    }
    unresolvedFields.push(pathValue);
  };

  classifyField("structure.architectureStyle", Boolean(answers.architectureStyle), Boolean(inferredContract.structure.architectureStyle));
  classifyField("structure.sourceRoots", Boolean(answers.sourceRoots), inferredContract.structure.sourceRoots.length > 0);
  classifyField("structure.packageRoots", Boolean(answers.packageRoots), inferredContract.structure.packageRoots.length > 0);
  classifyField("structure.ownershipBoundaries", Boolean(answers.ownershipBoundaries), inferredContract.structure.ownershipBoundaries.length > 0);
  classifyField("structure.pathConventions", Boolean(answers.pathConventions), inferredContract.structure.pathConventions.length > 0);
  classifyField("expectations.validationCommands", Boolean(answers.validationCommands), inferredContract.expectations.validationCommands.length > 0);
  classifyField("expectations.evidenceSources", Boolean(answers.evidenceSources), inferredContract.expectations.evidenceSources.length > 0);
  classifyField("expectations.testingConventions", Boolean(answers.testingConventions), inferredContract.expectations.testingConventions.length > 0);
  classifyField("expectations.releaseConventions", Boolean(answers.releaseConventions), inferredContract.expectations.releaseConventions.length > 0);
  classifyField("expectations.securityConventions", Boolean(answers.securityConventions), inferredContract.expectations.securityConventions.length > 0);
  classifyField("expectations.documentationConventions", Boolean(answers.documentationConventions), inferredContract.expectations.documentationConventions.length > 0);
  classifyField("expectations.operationsConventions", Boolean(answers.operationsConventions), inferredContract.expectations.operationsConventions.length > 0);
  classifyField("conventions.coding", Boolean(answers.codingConventions), inferredContract.conventions.coding.length > 0);
  classifyField("conventions.designPatterns", Boolean(answers.designPatterns), inferredContract.conventions.designPatterns.length > 0);
  classifyField("starterProfile.selectedProfileId", Boolean(answers.selectedProfileId), Boolean(inferredContract.starterProfile.selectedProfileId));
  classifyField("starterProfile.adoption", Boolean(answers.adoption), inferredContract.starterProfile.adoption !== "none");

  const finalizedContract = repoFitContractSchema.parse({
    ...inferredContract,
    starterProfile: {
      ...inferredContract.starterProfile,
      recommendedProfileId,
      comparisonNotes: compareRepoFitWithStarterProfile(inferredContract, normalizeRepoFitProfileId(inferredContract.starterProfile.selectedProfileId))
    },
    provenance: {
      inferred: inferredFields,
      confirmed: confirmedFields,
      unresolved: unresolvedFields
    }
  });

  return {
    contractPath: `.agentops/${repoFitFileName}`,
    contract: finalizedContract,
    inferredFields,
    confirmedFields,
    unresolvedFields,
    recommendedProfileId,
    selectedProfileId: normalizeRepoFitProfileId(finalizedContract.starterProfile.selectedProfileId)
  };
}

function buildRepoFitProfile(root: string): OnboardingProfile {
  const scan = scanProject(root);
  const repoName = root.split("/").at(-1) ?? "repo";
  const validationCommands = detectValidationCommands(root, scan.packageManager);
  const releaseProfile = detectReleaseProfile(root, validationCommands);
  const workflowFamilies = inferWorkflowFamilies(root, validationCommands, releaseProfile);
  const recommendedFirstWorkflow = inferFirstWorkflow(workflowFamilies, releaseProfile);
  const recommendedStarterPresets = inferRecommendedPreset(recommendedFirstWorkflow);
  const recommendedBenchmarkCategory = releaseProfile.relevant ? "release" : "general";
  const recommendedBenchmarkTaskType = releaseProfile.relevant ? "release/deployment" : "feature/refactor";
  const baseProfile: Omit<OnboardingProfile, "repoFit"> = {
    root,
    repoName,
    packageManager: scan.packageManager,
    languages: scan.languages,
    validationCommands,
    workflowFamilies,
    recommendedStarterPresets,
    recommendedValidationExpectations: validationCommands.map((command) => command.command),
    recommendedEvidenceExpectations: releaseProfile.recommendedEvidenceSources,
    recommendedFirstWorkflow,
    recommendedBenchmarkMode: "live",
    recommendedBenchmarkCategory,
    recommendedBenchmarkTaskType,
    recommendedBenchmarkTaskId: `${repoName}-pilot-1`,
    releaseProfile
  };

  return {
    ...baseProfile,
    repoFit: createRepoFitContract(baseProfile)
  };
}

export function analyzeOnboardingProfile(cwd = process.cwd()): OnboardingProfile {
  const root = findWorkspaceRoot(cwd);
  ensureInitFiles(root);
  return buildRepoFitProfile(root);
}

export function onboardProject(
  cwd = process.cwd(),
  options?: { applyRecommendedPreset?: boolean; repoFitAnswers?: RepoFitWizardAnswers }
): OnboardingResult {
  const root = findWorkspaceRoot(cwd);
  const initialProfile = buildRepoFitProfile(root);
  const repoFit = createRepoFitContract({
    root: initialProfile.root,
    repoName: initialProfile.repoName,
    packageManager: initialProfile.packageManager,
    languages: initialProfile.languages,
    validationCommands: initialProfile.validationCommands,
    workflowFamilies: initialProfile.workflowFamilies,
    recommendedStarterPresets: initialProfile.recommendedStarterPresets,
    recommendedValidationExpectations: initialProfile.recommendedValidationExpectations,
    recommendedEvidenceExpectations: initialProfile.recommendedEvidenceExpectations,
    recommendedFirstWorkflow: initialProfile.recommendedFirstWorkflow,
    recommendedBenchmarkMode: initialProfile.recommendedBenchmarkMode,
    recommendedBenchmarkCategory: initialProfile.recommendedBenchmarkCategory,
    recommendedBenchmarkTaskType: initialProfile.recommendedBenchmarkTaskType,
    recommendedBenchmarkTaskId: initialProfile.recommendedBenchmarkTaskId,
    releaseProfile: initialProfile.releaseProfile
  }, options?.repoFitAnswers);
  const profile: OnboardingProfile = {
    ...initialProfile,
    repoFit
  };
  const presetToApply = options?.applyRecommendedPreset === false ? undefined : profile.recommendedStarterPresets[0];
  const initResult = initProject(root, presetToApply ? { preset: presetToApply } : undefined);
  writeYamlFile(repoFitContractPath(root), repoFit.contract);

  return {
    root: initResult.root,
    created: initResult.created,
    preset: initResult.preset,
    profile,
    repoFit,
    nextSteps: {
      firstWorkflowCommand: `agentforge run ${profile.recommendedFirstWorkflow} --json`,
      firstBenchmarkCommand: `agentforge benchmark --mode ${profile.recommendedBenchmarkMode}`,
      outcomesCommand: "agentforge visualizer --open",
      benchmarksCommand: "agentforge visualizer --open"
    }
  };
}

export async function runLocalWorkflow(workflowName: string, cwd = process.cwd()): Promise<WorkflowRunResult> {
  const root = findWorkspaceRoot(cwd);
  ensureInitFiles(root);
  const config = loadAgentForgeConfig(root);
  const basePolicy = resolvePolicy(loadPolicyDocument(join(root, ".agentops", "policy.yaml")), process.env.CI ? "ci" : "local");
  const baseWorkflow = normalizeWorkflow(loadYaml(join(root, ".agentops", "workflows", `${workflowName}.yaml`)));
  const resolved = resolveWorkflowControls(root, baseWorkflow, basePolicy);
  const policyEngine = createPolicyEngine(resolved.policy, root);
  const workflow = resolved.workflow;
  const { agents, blockedPlugins, policy } = await buildAgentRegistry(root, config, workflowName, resolved.policy, policyEngine);
  validateWorkflowLifecyclePosture(workflow, policyEngine);
  validateWorkflowAgents(workflow, agents, blockedPlugins);
  const workflowInputs = prepareWorkflowInputs(workflow, root, policyEngine, resolved.request);

  const state = createWorkflowState({
    cwd: root,
    workflow: workflow.name,
    mode: policy.defaults.executionMode,
    policy,
    trigger: workflow.trigger
  });
  state.blockedPlugins = blockedPlugins;
  state.workflowInputs = workflowInputs;
  state.configuration = resolved.configuration;

  const runsRoot = join(root, config.runtime.runsPath);
  const outputDir = join(runsRoot, state.runId);
  ensureDirectory(outputDir);
  const artifactJsonPath = join(outputDir, "bundle.json");
  const artifactMarkdownPath = join(outputDir, "summary.md");

  const { bundle } = await runWorkflow({
    workflow,
    initialState: state,
    agents,
    adapters: buildAdapterRegistry(),
    policyEngine,
    artifactJsonPath,
    artifactMarkdownPath
  });

  const markdownReport = renderAuditBundleMarkdown(bundle);
  writeFileSync(artifactJsonPath, JSON.stringify(bundle, null, 2), "utf8");
  writeFileSync(artifactMarkdownPath, markdownReport, "utf8");
  const blockedActions = bundle.entries.reduce((total, entry) => total + entry.blockedActions.length, 0);

  return {
    runId: bundle.runId,
    outputDir,
    markdownReport,
    jsonPath: artifactJsonPath,
    markdownPath: artifactMarkdownPath,
    status: bundle.status,
    findings: bundle.findings.length,
    blockedActions,
    blockedPlugins: bundle.blockedPlugins.length,
    artifactCount: bundle.lifecycleArtifacts.length,
    artifactKinds: bundle.lifecycleArtifacts.map((artifact) => artifact.artifactKind)
  };
}

function checkResult(status: "passed" | "failed" | "not_applicable", name: string, expected: string, actual?: string, details?: string): EvalDeterministicCheck {
  return {
    name,
    status,
    expected,
    actual,
    ...(details ? { details } : {})
  };
}

function compareEvalSpec(
  spec: EvalSpec,
  bundle: ReturnType<typeof auditBundleSchema.parse> | undefined,
  executionError?: string
): { deterministicChecks: EvalDeterministicCheck[]; modelDependentChecks: EvalModelDependentCheck[] } {
  const checks: EvalDeterministicCheck[] = [];

  if (!bundle) {
    checks.push(
      checkResult(
        "failed",
        "workflow-execution",
        "successful workflow execution",
        executionError ?? "unknown failure",
        "The eval runner could not produce an evaluated workflow bundle."
      )
    );
    return {
      deterministicChecks: checks,
      modelDependentChecks: [
        {
          name: "rubric-scoring",
          status: "not_executed",
          details: "Provider-dependent scoring is out of scope for the first local eval runner slice."
        }
      ]
    };
  }

  checks.push(
    checkResult(
      bundle.status === spec.expectedStatus ? "passed" : "failed",
      "run-status",
      spec.expectedStatus,
      bundle.status,
      "The evaluated workflow status should match the deterministic eval spec."
    )
  );

  checks.push(
    checkResult(
      bundle.redaction.applied === spec.redactionExpectations.applied ? "passed" : "failed",
      "redaction-applied",
      String(spec.redactionExpectations.applied),
      String(bundle.redaction.applied)
    )
  );

  for (const category of spec.redactionExpectations.expectedCategories) {
    checks.push(
      checkResult(
        bundle.redaction.categories.includes(category) ? "passed" : "failed",
        `redaction-category:${category}`,
        category,
        bundle.redaction.categories.join(", ")
      )
    );
  }

  checks.push(
    checkResult(
      bundle.policy.defaults.executionMode === spec.policyExpectations.executionMode ? "passed" : "failed",
      "policy-execution-mode",
      spec.policyExpectations.executionMode,
      bundle.policy.defaults.executionMode
    )
  );

  if (spec.policyExpectations.readOnly) {
    checks.push(
      checkResult(
        bundle.policy.defaults.writes !== "allow" ? "passed" : "failed",
        "policy-read-only",
        "writes not equal allow",
        bundle.policy.defaults.writes
      )
    );
  }

  for (const sideEffectClass of spec.policyExpectations.sideEffectClasses) {
    checks.push(
      checkResult(
        "not_applicable",
        `side-effect-class:${sideEffectClass}`,
        sideEffectClass,
        undefined,
        "The first eval runner records policy posture and workflow outputs but does not inspect adapter-level side-effect execution traces."
      )
    );
  }

  for (const expectedArtifact of spec.artifactExpectations) {
    const actualArtifact = bundle.lifecycleArtifacts.find((artifact) => artifact.artifactKind === expectedArtifact.artifactKind);
    checks.push(
      checkResult(
        actualArtifact ? "passed" : "failed",
        `artifact-kind:${expectedArtifact.artifactKind}`,
        expectedArtifact.artifactKind,
        actualArtifact?.artifactKind
      )
    );

    if (!actualArtifact || typeof actualArtifact.payload !== "object" || actualArtifact.payload === null) {
      continue;
    }

    const payload = actualArtifact.payload as Record<string, unknown>;
    for (const field of expectedArtifact.requiredPayloadFields) {
      checks.push(
        checkResult(
          field in payload ? "passed" : "failed",
          `payload-field:${expectedArtifact.artifactKind}:${field}`,
          field,
          Object.keys(payload).join(", ")
        )
      );
    }

    for (const term of expectedArtifact.requiredSummaryTerms) {
      const summary = actualArtifact.summary.toLowerCase();
      checks.push(
        checkResult(
          summary.includes(term.toLowerCase()) ? "passed" : "failed",
          `summary-term:${expectedArtifact.artifactKind}:${term}`,
          term,
          actualArtifact.summary
        )
      );
    }
  }

  if (spec.artifactExpectations.length === 0) {
    checks.push(
      checkResult(
        bundle.lifecycleArtifacts.length === 0 ? "passed" : "failed",
        "artifact-count",
        "0",
        String(bundle.lifecycleArtifacts.length)
      )
    );
  }

  return {
    deterministicChecks: checks,
    modelDependentChecks: [
      {
        name: "rubric-scoring",
        status: "not_executed",
        details: "Provider-dependent scoring is out of scope for the first local eval runner slice."
      }
    ]
  };
}

async function executeEvalWorkflow(spec: EvalSpec, workspaceRoot: string): Promise<{ evaluatedRun: WorkflowRunResult; setupRuns: EvalSetupRun[] }> {
  const setupRuns: EvalSetupRun[] = [];
  const requestsRoot = join(workspaceRoot, ".agentops", "requests");
  ensureDirectory(requestsRoot);

  const runPlanning = async (): Promise<WorkflowRunResult> => {
    writeYamlFile(join(requestsRoot, "planning.yaml"), schemaFixtures.planningRequest);
    return runLocalWorkflow("planning-discovery", workspaceRoot);
  };

  const runDesign = async (): Promise<WorkflowRunResult> => {
    const planningRun = await runPlanning();
    setupRuns.push(toSetupRun("planning-discovery", planningRun));
    writeYamlFile(join(requestsRoot, "design.yaml"), {
      ...schemaFixtures.designRequest,
      planningBriefRef: toBundleRef(planningRun)
    });
    return runLocalWorkflow("architecture-design-review", workspaceRoot);
  };

  const runImplementation = async (): Promise<WorkflowRunResult> => {
    const designRun = await runDesign();
    setupRuns.push(toSetupRun("architecture-design-review", designRun));
    writeYamlFile(join(requestsRoot, "implementation.yaml"), {
      ...schemaFixtures.implementationRequest,
      designRecordRef: toBundleRef(designRun)
    });
    return runLocalWorkflow("implementation-proposal", workspaceRoot);
  };

  const runQa = async (): Promise<WorkflowRunResult> => {
    const implementationRun = await runImplementation();
    setupRuns.push(toSetupRun("implementation-proposal", implementationRun));
    writeYamlFile(join(requestsRoot, "qa.yaml"), {
      ...schemaFixtures.qaRequest,
      targetRef: toBundleRef(implementationRun),
      evidenceSources: [toSummaryRef(implementationRun)]
    });
    return runLocalWorkflow("qa-review", workspaceRoot);
  };

  const runSecurity = async (): Promise<WorkflowRunResult> => {
    const qaRun = await runQa();
    setupRuns.push(toSetupRun("qa-review", qaRun));
    writeYamlFile(join(requestsRoot, "security.yaml"), {
      ...schemaFixtures.securityRequest,
      targetRef: toBundleRef(qaRun),
      evidenceSources: [toSummaryRef(qaRun)]
    });
    return runLocalWorkflow("security-review", workspaceRoot);
  };

  const runRelease = async (): Promise<WorkflowRunResult> => {
    const securityRun = await runSecurity();
    setupRuns.push(toSetupRun("security-review", securityRun));
    const qaRun = setupRuns.find((run) => run.workflow === "qa-review");
    if (!qaRun) {
      throw new Error("QA setup run was not recorded before release eval execution.");
    }
    writeYamlFile(join(requestsRoot, "release.yaml"), {
      ...schemaFixtures.releaseRequest,
      qaReportRefs: [qaRun.bundlePath],
      securityReportRefs: [toBundleRef(securityRun)],
      evidenceSources: [toSummaryRef(securityRun)]
    });
    return runLocalWorkflow("release-readiness", workspaceRoot);
  };

  switch (spec.workflow) {
    case "pr-review":
      return { evaluatedRun: await runLocalWorkflow("pr-review", workspaceRoot), setupRuns };
    case "planning-discovery":
      writeYamlFile(join(requestsRoot, "planning.yaml"), spec.request);
      return { evaluatedRun: await runLocalWorkflow("planning-discovery", workspaceRoot), setupRuns };
    case "architecture-design-review": {
      const planningRun = await runPlanning();
      setupRuns.push(toSetupRun("planning-discovery", planningRun));
      writeYamlFile(join(requestsRoot, "design.yaml"), {
        ...spec.request,
        planningBriefRef: toBundleRef(planningRun)
      });
      return { evaluatedRun: await runLocalWorkflow("architecture-design-review", workspaceRoot), setupRuns };
    }
    case "implementation-proposal": {
      const designRun = await runDesign();
      setupRuns.push(toSetupRun("architecture-design-review", designRun));
      writeYamlFile(join(requestsRoot, "implementation.yaml"), {
        ...spec.request,
        designRecordRef: toBundleRef(designRun)
      });
      return { evaluatedRun: await runLocalWorkflow("implementation-proposal", workspaceRoot), setupRuns };
    }
    case "qa-review": {
      const implementationRun = await runImplementation();
      setupRuns.push(toSetupRun("implementation-proposal", implementationRun));
      writeYamlFile(join(requestsRoot, "qa.yaml"), {
        ...spec.request,
        targetRef: toBundleRef(implementationRun),
        evidenceSources: [toSummaryRef(implementationRun)]
      });
      return { evaluatedRun: await runLocalWorkflow("qa-review", workspaceRoot), setupRuns };
    }
    case "security-review": {
      const qaRun = await runQa();
      setupRuns.push(toSetupRun("qa-review", qaRun));
      writeYamlFile(join(requestsRoot, "security.yaml"), {
        ...spec.request,
        targetRef: toBundleRef(qaRun),
        evidenceSources: [toSummaryRef(qaRun)]
      });
      return { evaluatedRun: await runLocalWorkflow("security-review", workspaceRoot), setupRuns };
    }
    case "maintenance-triage": {
      const releaseRun = await runRelease();
      setupRuns.push(toSetupRun("release-readiness", releaseRun));
      writeYamlFile(join(requestsRoot, "maintenance.yaml"), {
        ...spec.request,
        releaseReportRefs: [toBundleRef(releaseRun)]
      });
      return { evaluatedRun: await runLocalWorkflow("maintenance-triage", workspaceRoot), setupRuns };
    }
  }
}

export async function runLocalEval(specId: string, cwd = process.cwd()): Promise<EvalRunResult> {
  const root = findWorkspaceRoot(cwd);
  ensureInitFiles(root);
  const spec = getEvalSpec(specId);
  const controlPolicy = resolvePolicy(loadPolicyDocument(join(root, ".agentops", "policy.yaml")), process.env.CI ? "ci" : "local");
  const controlState = createWorkflowState({
    cwd: root,
    workflow: `eval:${spec.id}`,
    mode: controlPolicy.defaults.executionMode,
    policy: controlPolicy
  });

  const workspaceRoot = spec.repoFixture === "agentforge-monorepo" ? root : createBlankEvalWorkspace(root, controlState.runId, spec.id);
  let evaluatedRun: WorkflowRunResult | undefined;
  let setupRuns: EvalSetupRun[] = [];
  let executionError: string | undefined;

  try {
    const result = await executeEvalWorkflow(spec, workspaceRoot);
    evaluatedRun = result.evaluatedRun;
    setupRuns = result.setupRuns;
  } catch (error) {
    executionError = error instanceof Error ? error.message : String(error);
  }

  const evaluatedBundle =
    evaluatedRun && existsSync(evaluatedRun.jsonPath)
      ? auditBundleSchema.parse(JSON.parse(readFileSync(evaluatedRun.jsonPath, "utf8")) as unknown)
      : undefined;
  const { deterministicChecks, modelDependentChecks } = compareEvalSpec(spec, evaluatedBundle, executionError);
  const { bundle, jsonPath, markdownPath, outputDir } = createEvalBundle(
    root,
    spec,
    evaluatedRun,
    workspaceRoot,
    setupRuns,
    deterministicChecks,
    modelDependentChecks
  );

  return {
    runId: bundle.runId,
    specId: spec.id,
    workflow: spec.workflow,
    outputDir,
    jsonPath,
    markdownPath,
    status: bundle.status,
    evaluatedRunId: evaluatedRun?.runId,
    evaluatedBundlePath: evaluatedRun ? toBundleRef(evaluatedRun) : undefined,
    setupRunCount: setupRuns.length,
    deterministicCheckCount: deterministicChecks.length,
    deterministicFailures: deterministicChecks.filter((check) => check.status === "failed").length,
    artifactKinds: bundle.lifecycleArtifacts.map((artifact) => artifact.artifactKind)
  };
}

export function compareLocalEvalRuns(baselineRunRef: string, candidateRunRefs: string[], cwd = process.cwd()): BenchmarkCompareResult {
  if (candidateRunRefs.length === 0) {
    throw new Error("Provide at least one candidate eval run to compare against the baseline.");
  }

  const root = findWorkspaceRoot(cwd);
  ensureInitFiles(root);

  const baseline = readRunBundleByRef(root, baselineRunRef);
  const baselineArtifact = extractEvalArtifact(baseline.bundle, baselineRunRef);
  const comparedRuns = candidateRunRefs.map((candidateRunRef) => {
    const candidate = readRunBundleByRef(root, candidateRunRef);
    const candidateArtifact = extractEvalArtifact(candidate.bundle, candidateRunRef);
    return compareEvalArtifacts(
      baseline.runId,
      baseline.bundlePath,
      baselineArtifact,
      candidate.runId,
      candidate.bundlePath,
      candidateArtifact
    );
  });
  const { bundle, jsonPath, markdownPath, outputDir } = createBenchmarkBundle(
    root,
    baseline.runId,
    baseline.bundlePath,
    baselineArtifact,
    comparedRuns
  );

  return {
    runId: bundle.runId,
    outputDir,
    jsonPath,
    markdownPath,
    status: bundle.status,
    baselineRunId: baseline.runId,
    comparedRunIds: comparedRuns.map((candidate) => candidate.runId),
    comparableRunCount: comparedRuns.filter((candidate) => candidate.comparable).length,
    regressionCount: comparedRuns.reduce((total, candidate) => total + candidate.regressions.length, 0),
    improvementCount: comparedRuns.reduce((total, candidate) => total + candidate.improvements.length, 0),
    unchangedCount: comparedRuns.reduce((total, candidate) => total + candidate.unchangedCount, 0),
    nonComparableCount: comparedRuns.reduce((total, candidate) => total + candidate.nonComparableFindings.length, 0),
    artifactKinds: bundle.lifecycleArtifacts.map((artifact) => artifact.artifactKind)
  };
}

export function discoverLocalRunCandidates(
  cwd = process.cwd(),
  options?: { category?: LocalRunCandidate["category"]; limit?: number }
): LocalRunCandidate[] {
  const root = findWorkspaceRoot(cwd);
  const config = loadAgentForgeConfig(root);
  const runsRoot = join(root, config.runtime.runsPath);
  if (!existsSync(runsRoot)) {
    return [];
  }

  const candidates: Array<LocalRunCandidate & { sortKey: number }> = [];
  for (const entry of readdirSync(runsRoot)) {
    const bundlePath = join(runsRoot, entry, "bundle.json");
    if (!existsSync(bundlePath)) {
      continue;
    }

    const bundle = auditBundleSchema.parse(JSON.parse(readFileSync(bundlePath, "utf8")) as unknown);
    const artifactKinds = bundle.lifecycleArtifacts
      .map((artifact) => artifact.artifactKind)
      .filter((artifactKind) => typeof artifactKind === "string" && artifactKind.length > 0) as string[];
    const category: LocalRunCandidate["category"] = artifactKinds.includes("benchmark-summary")
      ? "benchmark"
      : artifactKinds.includes("eval-result")
        ? "eval"
        : "workflow";

    candidates.push({
      runId: bundle.runId,
      workflow: bundle.workflow,
      status: bundle.status,
      startedAt: bundle.startedAt,
      finishedAt: bundle.finishedAt,
      bundlePath,
      artifactKinds,
      category,
      sortKey:
        parseRunTimestampMs(bundle.finishedAt) ??
        parseRunTimestampMs(bundle.startedAt) ??
        parseRunTimestampMs(bundle.runId) ??
        0
    });
  }

  const filteredCandidates = candidates
    .filter((candidate) => !options?.category || candidate.category === options.category)
    .sort((left, right) => {
      if (left.sortKey !== right.sortKey) {
        return right.sortKey - left.sortKey;
      }

      return right.runId.localeCompare(left.runId);
    });

  return filteredCandidates.slice(0, options?.limit ?? 10).map((candidate) => ({
    runId: candidate.runId,
    workflow: candidate.workflow,
    status: candidate.status,
    startedAt: candidate.startedAt,
    finishedAt: candidate.finishedAt,
    bundlePath: candidate.bundlePath,
    artifactKinds: candidate.artifactKinds,
    category: candidate.category
  }));
}

export function explainLastRun(cwd = process.cwd()): LastRunExplanation {
  const root = findWorkspaceRoot(cwd);
  const config = loadAgentForgeConfig(root);
  const runsRoot = join(root, config.runtime.runsPath);
  const latest = readLatestCompleteRunBundle(runsRoot);

  if (!latest) {
    throw new Error("No complete recorded runs found.");
  }

  const bundle = latest.bundle;
  const findings = asArray(bundle.findings);
  const blockedPlugins = asArray(bundle.blockedPlugins);
  const lifecycleArtifacts = asArray(bundle.lifecycleArtifacts);
  const runEntries = asArray(bundle.entries);

  return {
    runId: typeof bundle.runId === "string" ? bundle.runId : latest.runDir,
    status: typeof bundle.status === "string" ? bundle.status : "unknown",
    findings: findings.length,
    blockedActions: runEntries.reduce<number>((total, entry) => {
      if (!isRecord(entry)) {
        return total;
      }

      return total + asArray(entry.blockedActions).length;
    }, 0),
    blockedPlugins: blockedPlugins.length,
    jsonPath: join(runsRoot, latest.runDir, "bundle.json"),
    markdownPath: join(runsRoot, latest.runDir, "summary.md"),
    artifactCount: lifecycleArtifacts.length,
    artifactKinds: lifecycleArtifacts
      .map((artifact) => (isRecord(artifact) && typeof artifact.artifactKind === "string" ? artifact.artifactKind : undefined))
      .filter((artifactKind): artifactKind is string => Boolean(artifactKind))
  };
}

export function readBenchmarkLedger(cwd = process.cwd()): BenchmarkLedgerResult {
  const root = findWorkspaceRoot(cwd);
  return readBenchmarkLedgerDocument(root);
}

export function recordBenchmarkLedgerEntry(input: BenchmarkLedgerRecordInput, cwd = process.cwd()): BenchmarkLedgerRecordResult {
  const root = findWorkspaceRoot(cwd);
  const existing = readBenchmarkLedgerDocument(root);
  const prefill = input.prefillRunRef ? buildBenchmarkLedgerPrefill(root, input.prefillRunRef) : undefined;

  const mergedEntry = benchmarkLedgerEntrySchema.parse({
    taskId: input.taskId,
    taskLink: input.taskLink,
    benchmarkCategory: input.benchmarkCategory,
    source: input.source,
    taskType: input.taskType,
    arm: input.arm,
    runId: input.runId ?? prefill?.entry.runId,
    workflow: input.workflow ?? prefill?.entry.workflow,
    agent: input.agent,
    startedAt: input.startedAt ?? prefill?.entry.startedAt,
    finishedAt: input.finishedAt ?? prefill?.entry.finishedAt,
    cycleTimeSeconds:
      input.cycleTimeSeconds ??
      prefill?.entry.cycleTimeSeconds ??
      deriveCycleTimeSeconds(input.startedAt ?? prefill?.entry.startedAt, input.finishedAt ?? prefill?.entry.finishedAt),
    summary: input.summary,
    decisionOutcome: input.decisionOutcome,
    decisionImpactReason: input.decisionImpactReason,
    agentforgeChangedDecision: input.agentforgeChangedDecision,
    releaseDecision: input.releaseDecision,
    decisionClarity: input.decisionClarity,
    finalRecommendationSummary: input.finalRecommendationSummary,
    rerunCount: input.rerunCount,
    blockedStateCount: input.blockedStateCount,
    triggerRefs: input.triggerRefs ?? prefill?.entry.triggerRefs ?? [],
    confirmedRisks: input.confirmedRisks ?? {
      high: 0,
      medium: 0,
      low: 0,
      noisy: 0,
      unresolved: 0
    },
    confirmedRiskRefs: input.confirmedRiskRefs ?? [],
    tokenUsage: input.tokenUsage ?? prefill?.entry.tokenUsage,
    evidence: input.evidence ?? prefill?.entry.evidence ?? { present: [], missing: [], partial: [] },
    evidenceGapRefs: input.evidenceGapRefs ?? [],
    workflowStatuses: input.workflowStatuses ?? prefill?.entry.workflowStatuses ?? [],
    friction: {
      override: input.friction?.override ?? false,
      overrideReason: input.friction?.overrideReason,
      falsePositivePatterns: input.friction?.falsePositivePatterns ?? [],
      falsePositiveRefs: input.friction?.falsePositiveRefs ?? [],
      manualSteps: input.friction?.manualSteps ?? [],
      requestFriction: input.friction?.requestFriction ?? []
    },
    notes: input.notes ?? []
  });

  const existingIndex = existing.document.entries.findIndex((entry) => entry.taskId === mergedEntry.taskId && entry.arm === mergedEntry.arm);
  const created = existingIndex === -1;
  const nextEntries = created
    ? [...existing.document.entries, mergedEntry]
    : existing.document.entries.map((entry, index) => (index === existingIndex ? mergedEntry : entry));
  const nextDocument = benchmarkLedgerDocumentSchema.parse({
    schemaVersion: existing.document.schemaVersion,
    entries: nextEntries
  });
  const path = writeBenchmarkLedgerDocument(root, nextDocument);

  return {
    path,
    document: nextDocument,
    created,
    prefill,
    entry: mergedEntry
  };
}

function normalizeOptionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBooleanString(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Boolean values must be 'true' or 'false', received: ${value}`);
}

function parseNonNegativeIntegerString(value: string | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer, received: ${value}`);
  }

  return parsed;
}

function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

async function promptWithDefault(question: string, defaultValue?: string): Promise<string> {
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const answer = await rl.question(prompt);
    return answer.trim().length > 0 ? answer.trim() : (defaultValue ?? "");
  } finally {
    rl.close();
  }
}

export async function runBenchmarkLedgerWizard(input: BenchmarkLedgerWizardInput, cwd = process.cwd()): Promise<BenchmarkLedgerRecordResult> {
  const root = findWorkspaceRoot(cwd);
  const existing = readBenchmarkLedgerDocument(root);
  const existingEntry = existing.document.entries.find((entry) => entry.taskId === input.taskId && entry.arm === input.arm);
  const prefill = input.prefillRunRef ? buildBenchmarkLedgerPrefill(root, input.prefillRunRef) : undefined;

  const source = (await promptWithDefault("Benchmark source (replay/live)", input.source ?? existingEntry?.source ?? "live")) as "replay" | "live";
  const taskType = await promptWithDefault("Task type", input.taskType ?? existingEntry?.taskType ?? "feature/refactor");
  const benchmarkCategory = normalizeOptionalString(
    await promptWithDefault("Benchmark category (general/release, blank keeps current)", input.benchmarkCategory ?? existingEntry?.benchmarkCategory ?? "general")
  ) as BenchmarkCategory | undefined;
  const summary = normalizeOptionalString(await promptWithDefault("Short summary", existingEntry?.summary));
  const decisionOutcome = normalizeOptionalString(
    await promptWithDefault(
      "Decision outcome (scope_reduction/added_validation/blocked_approval/remediation_before_merge/added_confidence/no_meaningful_change)",
      existingEntry?.decisionOutcome
    )
  ) as BenchmarkDecisionOutcome | undefined;
  const changedDecisionAnswer = await promptWithDefault(
    "Did AgentForge change the decision? (true/false)",
    existingEntry?.agentforgeChangedDecision === undefined ? "false" : String(existingEntry.agentforgeChangedDecision)
  );
  const decisionImpactReason = normalizeOptionalString(await promptWithDefault("Decision impact reason", existingEntry?.decisionImpactReason));
  const releaseDecision = benchmarkCategory === "release"
    ? normalizeOptionalString(
        await promptWithDefault("Release decision (go/no-go/conditional/unclear)", existingEntry?.releaseDecision)
      ) as BenchmarkReleaseDecision | undefined
    : existingEntry?.releaseDecision;
  const decisionClarity = benchmarkCategory === "release"
    ? normalizeOptionalString(
        await promptWithDefault("Decision clarity (clear/mixed/ambiguous)", existingEntry?.decisionClarity)
      ) as BenchmarkDecisionClarity | undefined
    : existingEntry?.decisionClarity;
  const finalRecommendationSummary = benchmarkCategory === "release"
    ? normalizeOptionalString(await promptWithDefault("Final recommendation summary", existingEntry?.finalRecommendationSummary))
    : existingEntry?.finalRecommendationSummary;
  const mediumRisks = parseNonNegativeIntegerString(
    await promptWithDefault("Confirmed medium risks", String(existingEntry?.confirmedRisks.medium ?? 0)),
    "confirmed-medium-risks"
  ) ?? 0;
  const highRisks = parseNonNegativeIntegerString(
    await promptWithDefault("Confirmed high risks", String(existingEntry?.confirmedRisks.high ?? 0)),
    "confirmed-high-risks"
  ) ?? 0;
  const lowRisks = parseNonNegativeIntegerString(
    await promptWithDefault("Confirmed low risks", String(existingEntry?.confirmedRisks.low ?? 0)),
    "confirmed-low-risks"
  ) ?? 0;
  const noisyRisks = parseNonNegativeIntegerString(
    await promptWithDefault("Noisy findings", String(existingEntry?.confirmedRisks.noisy ?? 0)),
    "noisy-findings"
  ) ?? 0;
  const unresolvedRisks = parseNonNegativeIntegerString(
    await promptWithDefault("Unresolved risks", String(existingEntry?.confirmedRisks.unresolved ?? 0)),
    "unresolved-risks"
  ) ?? 0;
  const overrideAnswer = await promptWithDefault(
    "Override a blocked/partial result? (true/false)",
    existingEntry?.friction.override === undefined ? "false" : String(existingEntry.friction.override)
  );
  const overrideReason = parseBooleanString(overrideAnswer)
    ? normalizeOptionalString(await promptWithDefault("Override reason", existingEntry?.friction.overrideReason))
    : undefined;
  const manualSteps = parseCsvList(await promptWithDefault("Manual steps (comma-separated)", existingEntry?.friction?.manualSteps?.join(", ")));
  const requestFriction = parseCsvList(await promptWithDefault("Request friction (comma-separated)", existingEntry?.friction?.requestFriction?.join(", ")));
  const falsePositivePatterns = parseCsvList(
    await promptWithDefault("False-positive patterns (comma-separated)", existingEntry?.friction?.falsePositivePatterns?.join(", "))
  );
  const notes = parseCsvList(await promptWithDefault("Notes (comma-separated)", existingEntry?.notes?.join(", ")));

  return recordBenchmarkLedgerEntry(
    {
      taskId: input.taskId,
      arm: input.arm,
      source,
      taskType,
      benchmarkCategory,
      prefillRunRef: input.prefillRunRef,
      runId: input.runId ?? existingEntry?.runId ?? prefill?.runId,
      workflow: input.workflow ?? existingEntry?.workflow ?? prefill?.workflow,
      agent: input.agent ?? existingEntry?.agent,
      summary,
      decisionOutcome,
      agentforgeChangedDecision: parseBooleanString(changedDecisionAnswer),
      decisionImpactReason,
      releaseDecision,
      decisionClarity,
      finalRecommendationSummary,
      confirmedRisks: {
        high: highRisks,
        medium: mediumRisks,
        low: lowRisks,
        noisy: noisyRisks,
        unresolved: unresolvedRisks
      },
      friction: {
        override: parseBooleanString(overrideAnswer),
        overrideReason,
        manualSteps,
        requestFriction,
        falsePositivePatterns
      },
      notes
    },
    cwd
  );
}

function openUrlInBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

export async function launchVisualizer(options: VisualizerLaunchOptions = {}, cwd = process.cwd()): Promise<VisualizerLaunchResult> {
  const workspaceRoot = findWorkspaceRoot(cwd);
  const runsRoot = resolveVisualizerRunsRoot(workspaceRoot, options.runsRoot);
  const benchmarkLedgerPath = resolveVisualizerBenchmarkLedgerPath(workspaceRoot, options.benchmarkLedgerPath);
  const summary = readVisualizerSummary(workspaceRoot, options.runsRoot);
  const configEditor = createVisualizerConfigEditor(workspaceRoot);
  const server = await startVisualizerServer({
    workspaceRoot,
    runsRoot: options.runsRoot,
    benchmarkLedgerPath: options.benchmarkLedgerPath,
    host: options.host,
    port: options.port,
    configEditor
  });

  if (options.open) {
    openUrlInBrowser(`${server.serverUrl}/outcomes`);
  }

  return {
    serverUrl: server.serverUrl,
    runsRoot,
    benchmarkLedgerPath,
    runCount: summary.runCount,
    benchmarkCount: summary.benchmarkCount,
    close: server.close
  };
}

export function exportVisualizerOutcomes(options: VisualizerExportOptions = {}, cwd = process.cwd()): VisualizerExportResult {
  const workspaceRoot = findWorkspaceRoot(cwd);
  const runsRoot = resolveVisualizerRunsRoot(workspaceRoot, options.runsRoot);
  const benchmarkLedgerPath = resolveVisualizerBenchmarkLedgerPath(workspaceRoot, options.benchmarkLedgerPath);
  const document = createOutcomesExportDocument(workspaceRoot, runsRoot, benchmarkLedgerPath);
  const format = options.format ?? "json";
  const contents =
    format === "markdown"
      ? renderOutcomesExportMarkdown(document)
      : JSON.stringify(document, null, 2);

  if (options.outputPath) {
    writeFileSync(options.outputPath, contents, "utf8");
  }

  return {
    format,
    outputPath: options.outputPath,
    contents,
    document
  };
}

export function getGitHubReportingConfig(cwd = process.cwd()): { trackerIssue?: number } {
  const root = findWorkspaceRoot(cwd);
  const config = loadAgentForgeConfig(root);
  return {
    trackerIssue: config.reporting.github?.trackerIssue
  };
}
