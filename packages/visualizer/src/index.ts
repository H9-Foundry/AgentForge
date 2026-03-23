import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parseArgs } from "node:util";

import {
  listAvailableArtifactKinds,
  listAvailableStatuses,
  listAvailableWorkflows,
  loadBenchmarkIndexView,
  loadRunDetailView,
  loadRunsIndexView,
  loadValueDashboardView,
  resolveBenchmarkLedgerPath,
  resolveRunsRoot,
  toRelativeDisplayPath,
  type RunFilters
} from "./data.js";
import { renderBenchmarksPage, renderRunDetailPage, renderRunsIndexPage, renderValueDashboardPage, visualizerStyles } from "./html.js";

export interface VisualizerServerOptions {
  workspaceRoot: string;
  runsRoot?: string;
  benchmarkLedgerPath?: string;
  port?: number;
  host?: string;
}

function json(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function html(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
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
    artifactKind: searchParams.get("artifactKind") ?? undefined
  };
}

export function createVisualizerServer(options: VisualizerServerOptions) {
  const workspaceRoot = options.workspaceRoot;
  const runsRoot = resolveRunsRoot(workspaceRoot, options.runsRoot);
  const benchmarkLedgerPath = resolveBenchmarkLedgerPath(workspaceRoot, options.benchmarkLedgerPath);

  return createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const pathname = url.pathname;

    if (pathname === "/styles.css") {
      text(response, 200, visualizerStyles(), "text/css; charset=utf-8");
      return;
    }

    if (pathname === "/" || pathname === "/runs") {
      const view = loadRunsIndexView(workspaceRoot, runsRoot, toFilters(url.searchParams));
      html(
        response,
        200,
        renderRunsIndexPage(view.runs, view.invalidRuns, toFilters(url.searchParams), {
          workflows: listAvailableWorkflows(view.runs),
          statuses: listAvailableStatuses(view.runs),
          artifactKinds: listAvailableArtifactKinds(view.runs)
        })
      );
      return;
    }

    if (pathname === "/benchmarks") {
      const view = loadBenchmarkIndexView(workspaceRoot, runsRoot, benchmarkLedgerPath);
      html(response, 200, renderBenchmarksPage(view));
      return;
    }

    if (pathname === "/value") {
      const view = loadValueDashboardView(workspaceRoot, runsRoot, benchmarkLedgerPath);
      html(response, 200, renderValueDashboardPage(view));
      return;
    }

    if (pathname === "/api/runs") {
      const view = loadRunsIndexView(workspaceRoot, runsRoot, toFilters(url.searchParams));
      json(response, 200, view);
      return;
    }

    if (pathname === "/api/benchmarks") {
      json(response, 200, loadBenchmarkIndexView(workspaceRoot, runsRoot, benchmarkLedgerPath));
      return;
    }

    if (pathname === "/api/value") {
      json(response, 200, loadValueDashboardView(workspaceRoot, runsRoot, benchmarkLedgerPath));
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

  return {
    serverUrl: `http://${host}:${port}`,
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
