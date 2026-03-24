import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import process from "node:process";

import yaml from "js-yaml";

import { buildAuditBundle, createAuditEntry, renderAuditBundleMarkdown } from "@h9-foundry/agentforge-audit";
import { createWorkflowState, findWorkspaceRoot } from "@h9-foundry/agentforge-context-engine";
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
import type { OutcomesExportDocument } from "@h9-foundry/agentforge-visualizer";
import {
  agentforgeConfigSchema,
  auditBundleSchema,
  benchmarkArtifactSchema,
  benchmarkLedgerDocumentSchema,
  benchmarkLedgerEntrySchema,
  benchmarkLedgerTokenUsageSchema,
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
  promotionRequestSchema,
  qaRequestSchema,
  releaseRequestSchema,
  schemaVersion,
  schemaFixtures,
  securityRequestSchema,
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
  PromotionRequest,
  ProviderUsageAggregate,
  QaRequest,
  ReleaseRequest,
  ScmReference,
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

export const startupPresetNames = ["planning-discovery"] as const;
export type StartupPresetName = (typeof startupPresetNames)[number];

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
    const planningScmRefs = normalizeScmReferences(planningRequest.issueRefs, inferScmRepoContext(root));
    const planningGithubRefs = normalizeGitHubReferences(planningRequest.issueRefs, inferGitHubRepoContext(root));

    return {
      planningRequest,
      planningScmRefs,
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
      : { issueRefs: [], scmRefs: [], githubRefs: [] };

    return {
      qaRequest: qaRequest satisfies QaRequest,
      qaIssueRefs: referencedSourceRefs.issueRefs,
      qaScmRefs: referencedSourceRefs.scmRefs,
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
      : { issueRefs: [], scmRefs: [], githubRefs: [] };

    return {
      securityRequest: securityRequest satisfies SecurityRequest,
      securityTargetArtifactKinds: referencedArtifactKinds,
      securityIssueRefs: referencedSourceRefs.issueRefs,
      securityScmRefs: referencedSourceRefs.scmRefs,
      securityGithubRefs: referencedSourceRefs.githubRefs,
      requestFile: requestPath
    };
  }

  if (workflow.name === "pipeline-evidence-review") {
    const requestPath = ".agentops/requests/pipeline.yaml";
    ensureReadablePath(policyEngine, requestPath, "pipeline request");
    const pipelineRequest = validatePipelineRequestCompleteness(
      readYamlFile(join(root, requestPath), pipelineRequestSchema, "pipeline request")
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
      requestFile: requestPath
    };
  }

  if (workflow.name === "deployment-gate-review") {
    const requestPath = ".agentops/requests/deployment.yaml";
    ensureReadablePath(policyEngine, requestPath, "deployment request");
    const deploymentRequest = validateDeploymentRequestCompleteness(
      readYamlFile(join(root, requestPath), deploymentRequestSchema, "deployment request")
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
      requestFile: requestPath
    };
  }

  if (workflow.name === "promotion-approval") {
    const requestPath = ".agentops/requests/promotion.yaml";
    ensureReadablePath(policyEngine, requestPath, "promotion request");
    const promotionRequest = validatePromotionRequestCompleteness(
      readYamlFile(join(root, requestPath), promotionRequestSchema, "promotion request")
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
      requestFile: requestPath
    };
  }

  if (workflow.name === "incident-handoff") {
    const requestPath = ".agentops/requests/incident.yaml";
    ensureReadablePath(policyEngine, requestPath, "incident request");
    const incidentRequest = validateIncidentRequestCompleteness(
      readYamlFile(join(root, requestPath), incidentRequestSchema, "incident request")
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
      requestFile: requestPath
    };
  }

  if (workflow.name === "maintenance-triage") {
    const requestPath = ".agentops/requests/maintenance.yaml";
    ensureReadablePath(policyEngine, requestPath, "maintenance request");
    const maintenanceRequest = validateMaintenanceRequestCompleteness(
      readYamlFile(join(root, requestPath), maintenanceRequestSchema, "maintenance request")
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
}

export interface OnboardingResult {
  root: string;
  created: string[];
  preset?: { preset: StartupPresetName; workflow: string; requestPath: string; created: boolean };
  profile: OnboardingProfile;
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
  const root = findWorkspaceRoot(cwd);
  const created = ensureInitFiles(root);
  const preset = options?.preset ? applyStartupPreset(root, options.preset) : undefined;
  return {
    root,
    created,
    ...(preset ? { preset } : {})
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

  return {
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
}

export function analyzeOnboardingProfile(cwd = process.cwd()): OnboardingProfile {
  const root = findWorkspaceRoot(cwd);
  ensureInitFiles(root);
  return buildRepoFitProfile(root);
}

export function onboardProject(
  cwd = process.cwd(),
  options?: { applyRecommendedPreset?: boolean }
): OnboardingResult {
  const root = findWorkspaceRoot(cwd);
  const profile = buildRepoFitProfile(root);
  const presetToApply = options?.applyRecommendedPreset === false ? undefined : profile.recommendedStarterPresets[0];
  const initResult = initProject(root, presetToApply ? { preset: presetToApply } : undefined);

  return {
    root: initResult.root,
    created: initResult.created,
    preset: initResult.preset,
    profile,
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
  const server = await startVisualizerServer({
    workspaceRoot,
    runsRoot: options.runsRoot,
    benchmarkLedgerPath: options.benchmarkLedgerPath,
    host: options.host,
    port: options.port
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
