import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import yaml from "js-yaml";

import { renderAuditBundleMarkdown } from "@h9-foundry/agentforge-audit";
import { createWorkflowState, findWorkspaceRoot } from "@h9-foundry/agentforge-context-engine";
import { createPolicyEngine, loadPolicyDocument, resolvePolicy } from "@h9-foundry/agentforge-policy-engine";
import { runWorkflow } from "@h9-foundry/agentforge-runtime";
import {
  agentforgeConfigSchema,
  auditBundleSchema,
  designArtifactSchema,
  designRequestSchema,
  implementationRequestSchema,
  planningArtifactSchema,
  planningRequestSchema,
  qaRequestSchema,
  workflowDefinitionSchema
} from "@h9-foundry/agentforge-schemas";
import type {
  AgentForgeConfig,
  AgentPluginRegistration,
  BlockedPlugin,
  DesignArtifact,
  DesignRequest,
  ImplementationRequest,
  PlanningArtifact,
  PlanningRequest,
  QaRequest,
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
description: Validate a bounded QA request and prepare it for later QA analysis stages.
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

function validateWorkflowLifecyclePosture(
  workflow: WorkflowDefinition,
  policyEngine: ReturnType<typeof createPolicyEngine>
): void {
  const domain = workflow.catalog?.domain;
  if (domain !== "plan" && domain !== "design" && domain !== "build") {
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

    return {
      planningRequest,
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
    for (const evidenceSource of qaRequest.evidenceSources) {
      ensureReadablePath(policyEngine, evidenceSource, "QA evidence source");
    }

    return {
      qaRequest: qaRequest satisfies QaRequest,
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

export function explainLastRun(cwd = process.cwd()): LastRunExplanation {
  const root = findWorkspaceRoot(cwd);
  const config = loadAgentForgeConfig(root);
  const runsRoot = join(root, config.runtime.runsPath);
  const entries = existsSync(runsRoot) ? readdirSync(runsRoot).sort() : [];
  const latest = [...entries].reverse().find((entry) => existsSync(join(runsRoot, entry, "bundle.json")));

  if (!latest) {
    throw new Error("No complete recorded runs found.");
  }

  const bundle = JSON.parse(readFileSync(join(runsRoot, latest, "bundle.json"), "utf8")) as Record<string, unknown>;
  const findings = asArray(bundle.findings);
  const blockedPlugins = asArray(bundle.blockedPlugins);
  const lifecycleArtifacts = asArray(bundle.lifecycleArtifacts);
  const runEntries = asArray(bundle.entries);

  return {
    runId: typeof bundle.runId === "string" ? bundle.runId : latest,
    status: typeof bundle.status === "string" ? bundle.status : "unknown",
    findings: findings.length,
    blockedActions: runEntries.reduce<number>((total, entry) => {
      if (!isRecord(entry)) {
        return total;
      }

      return total + asArray(entry.blockedActions).length;
    }, 0),
    blockedPlugins: blockedPlugins.length,
    jsonPath: join(runsRoot, latest, "bundle.json"),
    markdownPath: join(runsRoot, latest, "summary.md"),
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
