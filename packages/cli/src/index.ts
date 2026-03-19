import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import yaml from "js-yaml";

import { buildAuditBundle, createAuditEntry, renderAuditBundleMarkdown } from "@h9-foundry/agentforge-audit";
import { createWorkflowState, findWorkspaceRoot } from "@h9-foundry/agentforge-context-engine";
import { createPolicyEngine, loadPolicyDocument, resolvePolicy } from "@h9-foundry/agentforge-policy-engine";
import { runWorkflow } from "@h9-foundry/agentforge-runtime";
import {
  agentforgeConfigSchema,
  auditBundleSchema,
  designArtifactSchema,
  designRequestSchema,
  evalArtifactSchema,
  evalFixtureCorpusSchema,
  implementationRequestSchema,
  incidentRequestSchema,
  maintenanceRequestSchema,
  planningArtifactSchema,
  planningRequestSchema,
  qaRequestSchema,
  releaseRequestSchema,
  schemaFixtures,
  securityRequestSchema,
  workflowDefinitionSchema
} from "@h9-foundry/agentforge-schemas";
import type {
  AgentForgeConfig,
  AgentPluginRegistration,
  BlockedPlugin,
  DesignArtifact,
  DesignRequest,
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
  PlanningArtifact,
  PlanningRequest,
  QaRequest,
  ReleaseRequest,
  SecurityRequest,
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
  supportLevel: partial
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

function runGit(root: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function parseGitHubRepositoryUrl(value: string): GitHubRepoContext | undefined {
  const trimmed = value.trim();
  const sshMatch = trimmed.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return {
      host: sshMatch[1].toLowerCase(),
      owner: sshMatch[2],
      repo: sshMatch[3]
    };
  }

  const httpsMatch = trimmed.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/)?$/i);
  if (!httpsMatch) {
    return undefined;
  }

  return {
    host: httpsMatch[1].toLowerCase(),
    owner: httpsMatch[2],
    repo: httpsMatch[3]
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
): { issueRefs: string[]; githubRefs: GithubReference[] } {
  const bundlePath = join(root, bundleRef);
  if (!existsSync(bundlePath)) {
    throw new Error(`Referenced bundle not found: ${bundleRef}`);
  }

  const bundle = auditBundleSchema.parse(JSON.parse(readFileSync(bundlePath, "utf8")) as unknown);
  const repoContext = inferGitHubRepoContext(root);
  const issueRefs = new Set<string>();
  const githubRefs = new Map<string, GithubReference>();

  for (const artifact of bundle.lifecycleArtifacts) {
    for (const issueRef of artifact.source.issueRefs) {
      issueRefs.add(issueRef);
    }

    for (const githubRef of artifact.source.githubRefs ?? []) {
      githubRefs.set(githubRef.canonical, githubRef);
    }

    for (const githubRef of normalizeGitHubReferences(artifact.source.issueRefs, repoContext)) {
      githubRefs.set(githubRef.canonical, githubRef);
    }
  }

  return {
    issueRefs: [...issueRefs],
    githubRefs: [...githubRefs.values()]
  };
}

function prepareWorkflowInputs(
  workflow: WorkflowDefinition,
  root: string,
  policyEngine: ReturnType<typeof createPolicyEngine>
): Record<string, unknown> {
  const requestsDir = join(root, ".agentops", "requests");
  ensureDirectory(requestsDir);

  if (workflow.name === "planning-discovery") {
    const requestPath = ".agentops/requests/planning.yaml";
    ensureReadablePath(policyEngine, requestPath, "planning request");
    const planningRequest = validatePlanningRequestCompleteness(
      readYamlFile(join(root, requestPath), planningRequestSchema, "planning request")
    );
    const planningGithubRefs = normalizeGitHubReferences(planningRequest.issueRefs, inferGitHubRepoContext(root));

    return {
      planningRequest,
      planningGithubRefs,
      requestFile: requestPath
    };
  }

  if (workflow.name === "architecture-design-review") {
    const requestPath = ".agentops/requests/design.yaml";
    ensureReadablePath(policyEngine, requestPath, "design request");
    const designRequest = readYamlFile(join(root, requestPath), designRequestSchema, "design request");
    ensureReadablePath(policyEngine, designRequest.planningBriefRef, "planning brief reference");
    const planningBrief = loadPlanningBundleArtifact(root, designRequest.planningBriefRef);

    return {
      designRequest: designRequest satisfies DesignRequest,
      planningBrief,
      requestFile: requestPath
    };
  }

  if (workflow.name === "implementation-proposal") {
    const requestPath = ".agentops/requests/implementation.yaml";
    ensureReadablePath(policyEngine, requestPath, "implementation request");
    const implementationRequest = readYamlFile(join(root, requestPath), implementationRequestSchema, "implementation request");
    ensureReadablePath(policyEngine, implementationRequest.designRecordRef, "design record reference");
    const designRecord = loadDesignBundleArtifact(root, implementationRequest.designRecordRef);

    return {
      implementationRequest: implementationRequest satisfies ImplementationRequest,
      designRecord,
      requestFile: requestPath
    };
  }

  if (workflow.name === "qa-review") {
    const requestPath = ".agentops/requests/qa.yaml";
    ensureReadablePath(policyEngine, requestPath, "QA request");
    const qaRequest = readYamlFile(join(root, requestPath), qaRequestSchema, "QA request");
    ensureReadablePath(policyEngine, qaRequest.targetRef, "QA target reference");
    if (!existsSync(join(root, qaRequest.targetRef))) {
      throw new Error(`QA target reference not found: ${qaRequest.targetRef}`);
    }
    for (const evidenceSource of qaRequest.evidenceSources) {
      ensureReadablePath(policyEngine, evidenceSource, "QA evidence source");
    }

    const referencedSourceRefs = qaRequest.targetRef.endsWith("bundle.json")
      ? loadLifecycleArtifactSourceReferences(root, qaRequest.targetRef)
      : { issueRefs: [], githubRefs: [] };

    return {
      qaRequest: qaRequest satisfies QaRequest,
      qaIssueRefs: referencedSourceRefs.issueRefs,
      qaGithubRefs: referencedSourceRefs.githubRefs,
      requestFile: requestPath
    };
  }

  if (workflow.name === "security-review") {
    const requestPath = ".agentops/requests/security.yaml";
    ensureReadablePath(policyEngine, requestPath, "security request");
    const securityRequest = readYamlFile(join(root, requestPath), securityRequestSchema, "security request");
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
      : { issueRefs: [], githubRefs: [] };

    return {
      securityRequest: securityRequest satisfies SecurityRequest,
      securityTargetArtifactKinds: referencedArtifactKinds,
      securityIssueRefs: referencedSourceRefs.issueRefs,
      securityGithubRefs: referencedSourceRefs.githubRefs,
      requestFile: requestPath
    };
  }

  if (workflow.name === "release-readiness") {
    const requestPath = ".agentops/requests/release.yaml";
    ensureReadablePath(policyEngine, requestPath, "release request");
    const releaseRequest = validateReleaseRequestCompleteness(
      readYamlFile(join(root, requestPath), releaseRequestSchema, "release request")
    );

    const releaseIssueRefs = new Set<string>();
    const releaseGithubRefMap = new Map<string, GithubReference>();
    for (const qaReportRef of releaseRequest.qaReportRefs) {
      ensureReadablePath(policyEngine, qaReportRef, "QA report reference");
      ensureBundleContainsArtifactKind(root, qaReportRef, "qa-report", "QA report reference");
      const refs = loadLifecycleArtifactSourceReferences(root, qaReportRef);
      for (const issueRef of refs.issueRefs) {
        releaseIssueRefs.add(issueRef);
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
      releaseGithubRefs: [...releaseGithubRefMap.values()],
      requestFile: requestPath
    };
  }

  if (workflow.name === "incident-handoff") {
    const requestPath = ".agentops/requests/incident.yaml";
    ensureReadablePath(policyEngine, requestPath, "incident request");
    const incidentRequest = validateIncidentRequestCompleteness(
      readYamlFile(join(root, requestPath), incidentRequestSchema, "incident request")
    );

    const repoContext = inferGitHubRepoContext(root);
    const incidentIssueRefs = new Set<string>(incidentRequest.issueRefs);
    const incidentGithubRefMap = new Map<string, GithubReference>();
    for (const githubRef of normalizeGitHubReferences(incidentRequest.issueRefs, repoContext)) {
      incidentGithubRefMap.set(githubRef.canonical, githubRef);
    }

    for (const releaseReportRef of incidentRequest.releaseReportRefs) {
      ensureReadablePath(policyEngine, releaseReportRef, "release report reference");
      ensureBundleContainsArtifactKind(root, releaseReportRef, "release-report", "release report reference");
      const refs = loadLifecycleArtifactSourceReferences(root, releaseReportRef);
      for (const issueRef of refs.issueRefs) {
        incidentIssueRefs.add(issueRef);
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
      incidentGithubRefs: [...incidentGithubRefMap.values()],
      requestFile: requestPath
    };
  }

  if (workflow.name === "maintenance-triage") {
    const requestPath = ".agentops/requests/maintenance.yaml";
    ensureReadablePath(policyEngine, requestPath, "maintenance request");
    const maintenanceRequest = validateMaintenanceRequestCompleteness(
      readYamlFile(join(root, requestPath), maintenanceRequestSchema, "maintenance request")
    );

    const repoContext = inferGitHubRepoContext(root);
    const maintenanceIssueRefs = new Set<string>(maintenanceRequest.issueRefs);
    const maintenanceGithubRefMap = new Map<string, GithubReference>();
    for (const githubRef of normalizeGitHubReferences(maintenanceRequest.issueRefs, repoContext)) {
      maintenanceGithubRefMap.set(githubRef.canonical, githubRef);
    }

    for (const releaseReportRef of maintenanceRequest.releaseReportRefs) {
      ensureReadablePath(policyEngine, releaseReportRef, "release report reference");
      ensureBundleContainsArtifactKind(root, releaseReportRef, "release-report", "release report reference");
      const refs = loadLifecycleArtifactSourceReferences(root, releaseReportRef);
      for (const issueRef of refs.issueRefs) {
        maintenanceIssueRefs.add(issueRef);
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
      maintenanceGithubRefs: [...maintenanceGithubRefMap.values()],
      requestFile: requestPath
    };
  }

  return {};
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

function readLatestCompleteRunBundle(runsRoot: string): { runDir: string; bundle: Record<string, unknown> } | undefined {
  if (!existsSync(runsRoot)) {
    return undefined;
  }

  const parseRunTimestampMs = (value: unknown): number | undefined => {
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
  };

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

async function buildAgentRegistry(root: string, config: AgentForgeConfig, workflowName: string) {
  const agents = buildBuiltinAgentRegistry();
  const registryClient = new LocalPluginRegistry(root);
  const policy = resolvePolicy(loadPolicyDocument(join(root, ".agentops", "policy.yaml")), process.env.CI ? "ci" : "local");
  const policyEngine = createPolicyEngine(policy, root);
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

export function initProject(cwd = process.cwd()): { root: string; created: string[] } {
  const root = findWorkspaceRoot(cwd);
  const created = ensureInitFiles(root);
  return { root, created };
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

export async function runLocalWorkflow(workflowName: string, cwd = process.cwd()): Promise<WorkflowRunResult> {
  const root = findWorkspaceRoot(cwd);
  ensureInitFiles(root);
  const config = loadAgentForgeConfig(root);
  const workflow = normalizeWorkflow(loadYaml(join(root, ".agentops", "workflows", `${workflowName}.yaml`)));
  const { agents, blockedPlugins, policy, policyEngine } = await buildAgentRegistry(root, config, workflowName);
  validateWorkflowLifecyclePosture(workflow, policyEngine);
  validateWorkflowAgents(workflow, agents, blockedPlugins);
  const workflowInputs = prepareWorkflowInputs(workflow, root, policyEngine);

  const state = createWorkflowState({
    cwd: root,
    workflow: workflow.name,
    mode: policy.defaults.executionMode,
    policy,
    trigger: workflow.trigger
  });
  state.blockedPlugins = blockedPlugins;
  state.workflowInputs = workflowInputs;

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

export function getGitHubReportingConfig(cwd = process.cwd()): { trackerIssue?: number } {
  const root = findWorkspaceRoot(cwd);
  const config = loadAgentForgeConfig(root);
  return {
    trackerIssue: config.reporting.github?.trackerIssue
  };
}
