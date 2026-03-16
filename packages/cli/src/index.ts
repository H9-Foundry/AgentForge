import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import yaml from "js-yaml";

import { codeReviewAgent } from "@agentops/agent-code-review";
import { contextCollectorAgent } from "@agentops/agent-context-collector";
import { securityAuditAgent } from "@agentops/agent-security-audit";
import { testGenerationAgent } from "@agentops/agent-test-generation";
import { createFilesystemAdapters } from "@agentops/adapters-filesystem";
import { createGitAdapters } from "@agentops/adapters-git";
import { createGitHubAdapters } from "@agentops/adapters-github";
import { createShellAdapters } from "@agentops/adapters-shell";
import { renderAuditBundleMarkdown } from "@agentops/audit";
import { createWorkflowState, findWorkspaceRoot } from "@agentops/context-engine";
import { loadPolicyDocument, resolvePolicy, createPolicyEngine } from "@agentops/policy-engine";
import { runWorkflow } from "@agentops/runtime";
import { workflowDefinitionSchema } from "@agentops/schemas";
import type { WorkflowDefinition } from "@agentops/shared-types";

const agentopsConfigTemplate = `version: 1
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

const workflowTemplate = `version: 1
name: pr-review
trigger: manual
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

function loadYaml(filePath: string): unknown {
  return yaml.load(readFileSync(filePath, "utf8"));
}

function normalizeWorkflow(input: unknown): WorkflowDefinition {
  const parsed = input as Record<string, unknown>;
  return workflowDefinitionSchema.parse({
    version: parsed.version,
    name: parsed.name,
    description: parsed.description,
    trigger: parsed.trigger,
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

interface AgentOpsConfig {
  runtime: { runs_path?: string };
  reporting?: {
    github?: {
      tracker_issue?: number;
    };
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
}

export interface LastRunExplanation {
  runId: string;
  status: string;
  findings: number;
  blockedActions: number;
  jsonPath: string;
  markdownPath: string;
}

function loadAgentOpsConfig(root: string): AgentOpsConfig {
  const configPath = join(root, ".agentops", "agentops.yaml");
  if (!existsSync(configPath)) {
    return { runtime: { runs_path: ".agentops/runs" } };
  }

  const parsed = (loadYaml(configPath) as AgentOpsConfig) ?? {};
  return {
    runtime: {
      runs_path: parsed.runtime?.runs_path ?? ".agentops/runs"
    },
    reporting: parsed.reporting
  };
}

function ensureDirectory(pathValue: string): void {
  mkdirSync(pathValue, { recursive: true });
}

function ensureInitFiles(root: string): string[] {
  const created: string[] = [];
  const configDir = join(root, ".agentops");
  const workflowsDir = join(configDir, "workflows");
  ensureDirectory(workflowsDir);

  const files = [
    {
      path: join(configDir, "agentops.yaml"),
      contents: agentopsConfigTemplate.replace("REPO_NAME", root.split("/").at(-1) ?? "repo")
    },
    {
      path: join(configDir, "policy.yaml"),
      contents: policyTemplate
    },
    {
      path: join(workflowsDir, "pr-review.yaml"),
      contents: workflowTemplate
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

function buildAgentRegistry() {
  return new Map([
    ["context-collector", contextCollectorAgent],
    ["code-review", codeReviewAgent],
    ["security-audit", securityAuditAgent],
    ["test-generation", testGenerationAgent]
  ]);
}

function buildAdapterRegistry() {
  return new Map(
    [...createFilesystemAdapters(), ...createGitAdapters(), ...createShellAdapters(), ...createGitHubAdapters()].map((adapter) => [
      adapter.manifest.name,
      adapter
    ])
  );
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
  const config = loadAgentOpsConfig(root);
  const policy = resolvePolicy(loadPolicyDocument(join(root, ".agentops", "policy.yaml")), process.env.CI ? "ci" : "local");
  const workflow = normalizeWorkflow(loadYaml(join(root, ".agentops", "workflows", `${workflowName}.yaml`)));
  const state = createWorkflowState({
    cwd: root,
    workflow: workflow.name,
    mode: policy.defaults.executionMode,
    policy,
    trigger: workflow.trigger
  });
  const runsRoot = join(root, config.runtime.runs_path ?? ".agentops/runs");
  const outputDir = join(runsRoot, state.runId);
  ensureDirectory(outputDir);
  const artifactJsonPath = join(outputDir, "bundle.json");
  const artifactMarkdownPath = join(outputDir, "summary.md");

  const { bundle } = await runWorkflow({
    workflow,
    initialState: state,
    agents: buildAgentRegistry(),
    adapters: buildAdapterRegistry(),
    policyEngine: createPolicyEngine(policy, root),
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
    blockedActions
  };
}

export function explainLastRun(cwd = process.cwd()): LastRunExplanation {
  const root = findWorkspaceRoot(cwd);
  const config = loadAgentOpsConfig(root);
  const runsRoot = join(root, config.runtime.runs_path ?? ".agentops/runs");
  const entries = existsSync(runsRoot) ? readdirSync(runsRoot).sort() : [];
  const latest = entries.at(-1);

  if (!latest) {
    throw new Error("No recorded runs found.");
  }

  const bundle = JSON.parse(readFileSync(join(runsRoot, latest, "bundle.json"), "utf8")) as {
    runId: string;
    status: string;
    findings: unknown[];
    entries: { blockedActions: unknown[] }[];
  };

  return {
    runId: bundle.runId,
    status: bundle.status,
    findings: bundle.findings.length,
    blockedActions: bundle.entries.reduce((total, entry) => total + entry.blockedActions.length, 0),
    jsonPath: join(runsRoot, latest, "bundle.json"),
    markdownPath: join(runsRoot, latest, "summary.md")
  };
}

export function getGitHubReportingConfig(cwd = process.cwd()): { trackerIssue?: number } {
  const root = findWorkspaceRoot(cwd);
  const config = loadAgentOpsConfig(root);
  return {
    trackerIssue: config.reporting?.github?.tracker_issue
  };
}
