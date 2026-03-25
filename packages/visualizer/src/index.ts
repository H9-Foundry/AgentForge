import { readFileSync, readdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { parseArgs } from "node:util";

import {
  createOutcomesExportDocument,
  listAvailableArtifactKinds,
  listAvailableStatuses,
  listAvailableWorkflows,
  loadBenchmarkIndexView,
  loadOutcomesDashboardView,
  loadRunComparisonView,
  loadRunDetailView,
  loadRunsIndexView,
  parseOutcomesFilters,
  resolveBenchmarkLedgerPath,
  resolveRunsRoot,
  toRelativeDisplayPath,
  type RunFilters
} from "./data.js";
import {
  renderBenchmarksPage,
  renderConfigurePage,
  renderOutcomesDashboardPage,
  renderOutcomesExportMarkdown,
  renderRunComparePage,
  renderRunDetailPage,
  renderRunsIndexPage,
  visualizerStyles
} from "./html.js";

export interface VisualizerServerOptions {
  workspaceRoot: string;
  runsRoot?: string;
  benchmarkLedgerPath?: string;
  port?: number;
  host?: string;
  configEditor?: VisualizerConfigEditor;
}

export interface VisualizerConfigDocument {
  path: string;
  relativePath: string;
  contents: string;
}

export interface VisualizerConfigPreviewSemantic {
  workflow?: string;
  selectedProfile?: string;
  selectedPolicyPreset?: string;
  selectedWorkflowVariant?: string;
  selectedAgentBindings: Record<string, string>;
  nodeAgents: Record<string, string>;
  disabledNodes: string[];
  policySummary: {
    executionMode: string;
    modelAccess: boolean;
    network: string;
    writes: string;
    deniedTools: string[];
    approvalTools: string[];
  };
}

export interface VisualizerConfigValidationSummary {
  valid: boolean;
  errors: string[];
}

export interface VisualizerConfigPreviewResult {
  path: string;
  previewHash: string;
  diff: string;
  summary: string;
  semantic?: VisualizerConfigPreviewSemantic;
  validation?: VisualizerConfigValidationSummary;
}

export interface VisualizerConfigSaveResult {
  path: string;
  validation?: VisualizerConfigValidationSummary;
}

export type VisualizerConfigTarget = "request" | "workflow-control" | "policy-presets" | "defaults" | "repo-fit";
export type VisualizerConfigFieldInput = "text" | "textarea" | "string-array" | "path-array" | "select" | "name-version-array" | "json";

export interface VisualizerConfigOption {
  label: string;
  value: string;
}

export interface VisualizerConfigFieldModel {
  key: string;
  label: string;
  input: VisualizerConfigFieldInput;
  required: boolean;
  helpText?: string;
  options?: VisualizerConfigOption[];
  value: unknown;
}

export interface VisualizerConfigBindingSelectionModel {
  key: string;
  label: string;
  description?: string;
  nodeIds: string[];
  selectedAgent?: string;
  options: VisualizerConfigOption[];
}

export interface VisualizerConfigProfileEditorModel {
  name: string;
  description?: string;
  allowedPolicyPresets: string[];
  allowedWorkflowVariants: string[];
  requestFields: VisualizerConfigFieldModel[];
}

export interface VisualizerConfigWorkflowVariantEditorModel {
  name: string;
  description?: string;
  disabledNodes: string[];
  nodeAgentOverrides: Array<{ nodeId: string; agent: string }>;
}

export interface VisualizerConfigAgentBindingEditorModel {
  name: string;
  description?: string;
  nodeIds: string[];
  allowedAgents: string[];
  defaultAgent?: string;
}

export interface VisualizerConfigPolicyPresetEditorModel {
  name: string;
  description?: string;
  defaults: {
    executionMode?: string;
    modelAccess?: boolean;
    network?: string;
    writes?: string;
  };
  blockedPaths: string[];
  pluginAllowedTiers: string[];
  pluginAllowedSources: string[];
  requireReviewed?: boolean;
  tools: Array<{ toolName: string; effect: string }>;
}

export interface VisualizerConfigWorkflowDefaultEditorModel {
  workflow: string;
  profile?: string;
  policyPreset?: string;
  workflowVariant?: string;
  profileOptions: VisualizerConfigOption[];
  policyPresetOptions: VisualizerConfigOption[];
  workflowVariantOptions: VisualizerConfigOption[];
}

export interface VisualizerConfigRepoFitEditorModel {
  recommendedProfileId?: string;
  selectedProfileId?: string;
  adoption: string;
  profileOptions: VisualizerConfigOption[];
  adoptionOptions: VisualizerConfigOption[];
  structureFields: VisualizerConfigFieldModel[];
  expectationFields: VisualizerConfigFieldModel[];
  conventionFields: VisualizerConfigFieldModel[];
  comparisonNotes: string[];
  inferredFields: string[];
  confirmedFields: string[];
  unresolvedFields: string[];
}

export interface VisualizerConfigEditorModel {
  workflow?: string;
  target: VisualizerConfigTarget;
  path: string;
  relativePath: string;
  editingEnabled: boolean;
  rawDocument: string;
  loadError?: string;
  title: string;
  intro: string;
  nextStep: string;
  request?: {
    selectedProfile: string;
    selectedPolicyPreset?: string;
    selectedWorkflowVariant: string;
    profileOptions: VisualizerConfigOption[];
    policyPresetOptions: VisualizerConfigOption[];
    workflowVariantOptions: VisualizerConfigOption[];
    profileRules: Array<{
      profile: string;
      allowedPolicyPresets: string[];
      allowedWorkflowVariants: string[];
    }>;
    fields: VisualizerConfigFieldModel[];
    agentBindings: VisualizerConfigBindingSelectionModel[];
  };
  workflowControl?: {
    requestFieldDefinitions: Array<Omit<VisualizerConfigFieldModel, "value">>;
    profiles: VisualizerConfigProfileEditorModel[];
    fieldMetadata: Array<{
      path: string;
      label: string;
      helpText?: string;
      input: VisualizerConfigFieldInput;
      required: boolean;
      options: VisualizerConfigOption[];
    }>;
    workflowVariants: VisualizerConfigWorkflowVariantEditorModel[];
    allowedPolicyPresets: string[];
    policyPresetOptions: VisualizerConfigOption[];
    agentBindings: VisualizerConfigAgentBindingEditorModel[];
    nodeOptions: VisualizerConfigOption[];
    nodeAgentOptions: Record<string, VisualizerConfigOption[]>;
  };
  policyPresets?: {
    presets: VisualizerConfigPolicyPresetEditorModel[];
    availableTools: VisualizerConfigOption[];
    toolEffectOptions: VisualizerConfigOption[];
    tierOptions: VisualizerConfigOption[];
    sourceOptions: VisualizerConfigOption[];
    executionModeOptions: VisualizerConfigOption[];
    permissionOptions: VisualizerConfigOption[];
  };
  defaults?: {
    workflows: VisualizerConfigWorkflowDefaultEditorModel[];
  };
  repoFit?: VisualizerConfigRepoFitEditorModel;
}

export interface VisualizerConfigRenderResult {
  path: string;
  draft: string;
}

export interface VisualizerConfigEditor {
  editingEnabled: boolean;
  loadEditorModel?: (input: { workflow?: string; target: VisualizerConfigTarget }) => Promise<VisualizerConfigEditorModel> | VisualizerConfigEditorModel;
  renderDocument?: (input: { workflow?: string; target: VisualizerConfigTarget; state: unknown }) => Promise<VisualizerConfigRenderResult> | VisualizerConfigRenderResult;
  previewDocument?: (input: { workflow?: string; target: string; draft: string }) => Promise<VisualizerConfigPreviewResult> | VisualizerConfigPreviewResult;
  saveDocument?: (input: {
    workflow?: string;
    target: string;
    draft: string;
    previewHash: string;
    approval: string;
  }) => Promise<VisualizerConfigSaveResult> | VisualizerConfigSaveResult;
}

function json(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function html(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(302, { location });
  response.end();
}

function text(response: ServerResponse, statusCode: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  response.writeHead(statusCode, { "content-type": contentType });
  response.end(body);
}

function notFound(response: ServerResponse): void {
  html(
    response,
    404,
    `<!doctype html><html><body><h1>Not found</h1><p>The requested visualizer resource does not exist.</p></body></html>`
  );
}

function toFilters(searchParams: URLSearchParams): RunFilters {
  return {
    search: searchParams.get("search") ?? undefined,
    workflow: searchParams.get("workflow") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    artifactKind: searchParams.get("artifactKind") ?? undefined,
    decisionImpact: (searchParams.get("decisionImpact") as RunFilters["decisionImpact"] | null) ?? undefined,
    riskKind: searchParams.get("riskKind") ?? undefined,
    evidenceCategory: searchParams.get("evidenceCategory") ?? undefined,
    evidenceStatus: (searchParams.get("evidenceStatus") as RunFilters["evidenceStatus"] | null) ?? undefined,
    hasOverride: (searchParams.get("hasOverride") as RunFilters["hasOverride"] | null) ?? undefined,
    workflowStage: searchParams.get("workflowStage") ?? undefined
  };
}

function workflowRequestPath(workflow: string): string | undefined {
  const mapping: Record<string, string> = {
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
  return mapping[workflow];
}

function listRepoWorkflows(workspaceRoot: string): string[] {
  const workflowsRoot = join(workspaceRoot, ".agentops", "workflows");
  return readdirSync(workflowsRoot)
    .filter((entry) => entry.endsWith(".yaml"))
    .map((entry) => entry.replace(/\.yaml$/, ""))
    .sort();
}

function assertSafeWorkflowName(workflow: string | undefined): string | undefined {
  if (workflow === undefined || workflow === "") {
    return undefined;
  }

  if (!/^[a-z0-9-]+$/i.test(workflow)) {
    throw new Error("Workflow name must be a simple slug.");
  }

  return workflow;
}

function resolveConfigPath(workspaceRoot: string, workflow: string | undefined, target: string): { path: string; relativePath: string } {
  const safeWorkflow = assertSafeWorkflowName(workflow);
  if (target === "repo-fit") {
    return {
      path: join(workspaceRoot, ".agentops", "repo-fit.yaml"),
      relativePath: ".agentops/repo-fit.yaml"
    };
  }
  if (target === "policy-presets") {
    return {
      path: join(workspaceRoot, ".agentops", "control", "policy-presets.yaml"),
      relativePath: ".agentops/control/policy-presets.yaml"
    };
  }
  if (target === "defaults") {
    return {
      path: join(workspaceRoot, ".agentops", "control", "defaults.yaml"),
      relativePath: ".agentops/control/defaults.yaml"
    };
  }
  if (target === "workflow-control") {
    if (!safeWorkflow) {
      throw new Error("Workflow is required for workflow-control edits.");
    }
    return {
      path: join(workspaceRoot, ".agentops", "control", `${safeWorkflow}.yaml`),
      relativePath: `.agentops/control/${safeWorkflow}.yaml`
    };
  }
  if (target === "request") {
    const requestPath = safeWorkflow ? workflowRequestPath(safeWorkflow) : undefined;
    if (!requestPath) {
      throw new Error("Workflow is required for request edits.");
    }
    return {
      path: join(workspaceRoot, requestPath),
      relativePath: requestPath
    };
  }

  throw new Error(`Unsupported configure target: ${target}`);
}

function readConfigDocument(workspaceRoot: string, workflow: string | undefined, target: string): { path: string; relativePath: string; contents: string } {
  const resolved = resolveConfigPath(workspaceRoot, workflow, target);
  return {
    ...resolved,
    contents: readFileSync(resolved.path, "utf8")
  };
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw.length > 0 ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

export function createVisualizerServer(options: VisualizerServerOptions) {
  const workspaceRoot = options.workspaceRoot;
  const runsRoot = resolveRunsRoot(workspaceRoot, options.runsRoot);
  const benchmarkLedgerPath = resolveBenchmarkLedgerPath(workspaceRoot, options.benchmarkLedgerPath);
  const configEditor = options.configEditor;

  return createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const pathname = url.pathname;

    if (pathname === "/styles.css") {
      text(response, 200, visualizerStyles(), "text/css; charset=utf-8");
      return;
    }

    if (pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (pathname === "/") {
      redirect(response, "/outcomes");
      return;
    }

    if (pathname === "/runs") {
      const view = loadRunsIndexView(workspaceRoot, runsRoot, toFilters(url.searchParams), benchmarkLedgerPath);
      html(
        response,
        200,
        renderRunsIndexPage(view.runs, view.invalidRuns, toFilters(url.searchParams), {
          workflows: listAvailableWorkflows(view.runs),
          statuses: listAvailableStatuses(view.runs),
          artifactKinds: listAvailableArtifactKinds(view.runs),
          decisionImpacts: [...new Set(view.runs.flatMap((run) => (run.decisionImpactKind ? [run.decisionImpactKind] : [])))].sort(),
          riskKinds: [...new Set(view.runs.flatMap((run) => run.riskKinds))].sort(),
          evidenceCategories: [...new Set(view.runs.flatMap((run) => run.evidenceStatuses.map((status) => status.category)))].sort(),
          workflowStages: [...new Set(view.runs.flatMap((run) => (run.workflowStage ? [run.workflowStage] : [])))].sort()
        })
      );
      return;
    }

    if (pathname === "/benchmarks") {
      const view = loadBenchmarkIndexView(workspaceRoot, runsRoot, benchmarkLedgerPath);
      html(response, 200, renderBenchmarksPage(view));
      return;
    }

    if (pathname === "/configure") {
      const workflow = url.searchParams.get("workflow") ?? undefined;
      const target = url.searchParams.get("target") ?? "request";
      html(
        response,
        200,
        renderConfigurePage({
          workflow,
          target,
          availableWorkflows: listRepoWorkflows(workspaceRoot),
          editingEnabled: configEditor?.editingEnabled ?? false
        })
      );
      return;
    }

    if (pathname === "/runs/compare") {
      const left = url.searchParams.get("left") ?? undefined;
      const right = url.searchParams.get("right") ?? undefined;
      const comparison = left && right ? loadRunComparisonView(workspaceRoot, left, right, runsRoot, benchmarkLedgerPath) : undefined;
      html(response, 200, renderRunComparePage(comparison, left, right));
      return;
    }

    if (pathname === "/value") {
      const suffix = url.search ? `${url.search}` : "";
      const hashless = `/outcomes${suffix}`;
      redirect(response, hashless);
      return;
    }

    if (pathname === "/outcomes") {
      const view = loadOutcomesDashboardView(workspaceRoot, runsRoot, benchmarkLedgerPath, parseOutcomesFilters(url.searchParams));
      html(response, 200, renderOutcomesDashboardPage(view));
      return;
    }

    if (pathname === "/api/runs") {
      const view = loadRunsIndexView(workspaceRoot, runsRoot, toFilters(url.searchParams), benchmarkLedgerPath);
      json(response, 200, view);
      return;
    }

    if (pathname === "/api/benchmarks") {
      json(response, 200, loadBenchmarkIndexView(workspaceRoot, runsRoot, benchmarkLedgerPath));
      return;
    }

    if (pathname === "/api/value" || pathname === "/api/outcomes") {
      json(response, 200, loadOutcomesDashboardView(workspaceRoot, runsRoot, benchmarkLedgerPath, parseOutcomesFilters(url.searchParams)));
      return;
    }

    if (pathname === "/api/runs/compare") {
      const left = url.searchParams.get("left");
      const right = url.searchParams.get("right");
      if (!left || !right) {
        json(response, 400, { error: "Provide left and right run ids." });
        return;
      }
      const comparison = loadRunComparisonView(workspaceRoot, left, right, runsRoot, benchmarkLedgerPath);
      if (!comparison) {
        json(response, 404, { error: "Run comparison could not be built." });
        return;
      }
      json(response, 200, comparison);
      return;
    }

    if (pathname === "/api/config/current") {
      try {
        const workflow = url.searchParams.get("workflow") ?? undefined;
        const target = url.searchParams.get("target") ?? "request";
        json(response, 200, readConfigDocument(workspaceRoot, workflow, target));
      } catch (error) {
        json(response, 400, { error: error instanceof Error ? error.message : "Failed to load config document." });
      }
      return;
    }

    if (pathname === "/api/config/editor") {
      const loadEditorModel = configEditor?.loadEditorModel;
      if (!loadEditorModel) {
        json(response, 501, { error: "Config editor model is unavailable." });
        return;
      }
      const workflow = url.searchParams.get("workflow") ?? undefined;
      const target = (url.searchParams.get("target") ?? "request") as VisualizerConfigTarget;
      void Promise.resolve(loadEditorModel({ workflow, target }))
        .then((model) => {
          json(response, 200, model);
        })
        .catch((error) => {
          json(response, 400, { error: error instanceof Error ? error.message : "Failed to load config editor model." });
        });
      return;
    }

    if (request.method === "POST" && pathname === "/api/config/render") {
      const renderDocument = configEditor?.renderDocument;
      if (!renderDocument) {
        json(response, 501, { error: "Config document rendering is unavailable." });
        return;
      }
      void readJsonBody(request)
        .then(async (body) => {
          const payload = body as { workflow?: string; target?: VisualizerConfigTarget; state?: unknown };
          if (!payload.target) {
            json(response, 400, { error: "Render requires target and state." });
            return;
          }
          json(response, 200, await renderDocument({
            workflow: payload.workflow,
            target: payload.target,
            state: payload.state
          }));
        })
        .catch((error) => {
          json(response, 400, { error: error instanceof Error ? error.message : "Failed to render config document." });
        });
      return;
    }

    if (request.method === "POST" && pathname === "/api/config/preview") {
      if (!configEditor?.editingEnabled || !configEditor.previewDocument) {
        json(response, 403, { error: "Config editing is disabled for this repository." });
        return;
      }
      const previewDocument = configEditor.previewDocument;
      void readJsonBody(request)
        .then(async (body) => {
          const payload = body as { workflow?: string; target?: string; draft?: string };
          if (!payload.target || typeof payload.draft !== "string") {
            json(response, 400, { error: "Preview requires target and draft." });
            return;
          }
          json(response, 200, await previewDocument({
            workflow: payload.workflow,
            target: payload.target,
            draft: payload.draft
          }));
        })
        .catch((error) => {
          json(response, 400, { error: error instanceof Error ? error.message : "Failed to preview config document." });
        });
      return;
    }

    if (request.method === "POST" && pathname === "/api/config/save") {
      if (!configEditor?.editingEnabled || !configEditor.saveDocument) {
        json(response, 403, { error: "Config editing is disabled for this repository." });
        return;
      }
      const saveDocument = configEditor.saveDocument;
      void readJsonBody(request)
        .then(async (body) => {
          const payload = body as {
            workflow?: string;
            target?: string;
            draft?: string;
            previewHash?: string;
            approval?: string;
          };
          if (!payload.target || typeof payload.draft !== "string" || typeof payload.previewHash !== "string" || typeof payload.approval !== "string") {
            json(response, 400, { error: "Save requires target, draft, previewHash, and approval." });
            return;
          }
          json(response, 200, await saveDocument({
            workflow: payload.workflow,
            target: payload.target,
            draft: payload.draft,
            previewHash: payload.previewHash,
            approval: payload.approval
          }));
        })
        .catch((error) => {
          json(response, 400, { error: error instanceof Error ? error.message : "Failed to save config document." });
        });
      return;
    }

    if (pathname === "/api/outcomes/export.json") {
      json(response, 200, createOutcomesExportDocument(workspaceRoot, runsRoot, benchmarkLedgerPath, parseOutcomesFilters(url.searchParams)));
      return;
    }

    if (pathname === "/outcomes/export.md") {
      text(
        response,
        200,
        renderOutcomesExportMarkdown(createOutcomesExportDocument(workspaceRoot, runsRoot, benchmarkLedgerPath, parseOutcomesFilters(url.searchParams))),
        "text/markdown; charset=utf-8"
      );
      return;
    }

    const runDetailMatch = pathname.match(/^\/runs\/([^/]+)$/);
    if (runDetailMatch) {
      const run = loadRunDetailView(workspaceRoot, decodeURIComponent(runDetailMatch[1] ?? ""), runsRoot, benchmarkLedgerPath);
      if (!run) {
        notFound(response);
        return;
      }
      html(response, 200, renderRunDetailPage(run));
      return;
    }

    const runApiMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (runApiMatch) {
      const run = loadRunDetailView(workspaceRoot, decodeURIComponent(runApiMatch[1] ?? ""), runsRoot, benchmarkLedgerPath);
      if (!run) {
        json(response, 404, { error: "Run not found." });
        return;
      }
      json(response, 200, run);
      return;
    }

    const rawBundleMatch = pathname.match(/^\/api\/runs\/([^/]+)\/bundle\.json$/);
    if (rawBundleMatch) {
      const run = loadRunDetailView(workspaceRoot, decodeURIComponent(rawBundleMatch[1] ?? ""), runsRoot, benchmarkLedgerPath);
      if (!run) {
        json(response, 404, { error: "Run not found." });
        return;
      }
      text(response, 200, run.rawBundleJson, "application/json; charset=utf-8");
      return;
    }

    const rawSummaryMatch = pathname.match(/^\/api\/runs\/([^/]+)\/summary\.md$/);
    if (rawSummaryMatch) {
      const run = loadRunDetailView(workspaceRoot, decodeURIComponent(rawSummaryMatch[1] ?? ""), runsRoot, benchmarkLedgerPath);
      if (!run) {
        json(response, 404, { error: "Run not found." });
        return;
      }
      text(response, 200, run.summaryMarkdown, "text/markdown; charset=utf-8");
      return;
    }

    notFound(response);
  });
}

export async function startVisualizerServer(options: VisualizerServerOptions): Promise<{
  serverUrl: string;
  runsRoot: string;
  close: () => Promise<void>;
}> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4313;
  const runsRoot = resolveRunsRoot(options.workspaceRoot, options.runsRoot);
  const server = createVisualizerServer({ ...options, host, port, runsRoot });

  await new Promise<void>((resolvePromise) => {
    server.listen(port, host, () => resolvePromise());
  });

  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;

  return {
    serverUrl: `http://${host}:${boundPort}`,
    runsRoot,
    close: async () =>
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolvePromise();
        });
      })
  };
}

export function readVisualizerSummary(workspaceRoot: string, runsRoot?: string): { runsRoot: string; runCount: number; benchmarkCount: number } {
  const resolvedRunsRoot = resolveRunsRoot(workspaceRoot, runsRoot);
  const runsView = loadRunsIndexView(workspaceRoot, resolvedRunsRoot);
  const benchmarksView = loadBenchmarkIndexView(workspaceRoot, resolvedRunsRoot);

  return {
    runsRoot: toRelativeDisplayPath(workspaceRoot, resolvedRunsRoot),
    runCount: runsView.runs.length,
    benchmarkCount: benchmarksView.benchmarks.length
  };
}

export function parseVisualizerServerArgs(argv: readonly string[]): { host?: string; port?: number; runsRoot?: string; benchmarkLedgerPath?: string } {
  const normalizedArgs = argv[0] === "--" ? argv.slice(1) : argv;
  const parsed = parseArgs({
    args: normalizedArgs,
    options: {
      host: { type: "string" },
      port: { type: "string" },
      "runs-root": { type: "string" },
      "benchmark-ledger": { type: "string" }
    },
    allowPositionals: false
  });

  return {
    host: parsed.values.host,
    port: parsed.values.port ? Number.parseInt(parsed.values.port, 10) : undefined,
    runsRoot: parsed.values["runs-root"],
    benchmarkLedgerPath: parsed.values["benchmark-ledger"]
  };
}

export {
  createOutcomesExportDocument,
  listAvailableArtifactKinds,
  listAvailableStatuses,
  listAvailableWorkflows,
  loadBenchmarkIndexView,
  loadOutcomesDashboardView,
  loadRunDetailView,
  loadRunsIndexView,
  parseOutcomesFilters,
  resolveBenchmarkLedgerPath,
  resolveRunsRoot,
  toRelativeDisplayPath
} from "./data.js";
export type { OutcomesExportDocument, RunFilters } from "./data.js";
export { renderOutcomesExportMarkdown } from "./html.js";
