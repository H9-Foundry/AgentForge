import type { AuditEntry, BlockedPlugin, Finding } from "@h9-foundry/agentforge-shared-types";

import type {
  ArtifactPanelView,
  BenchmarkIndexView,
  BenchmarkSummaryView,
  EvidenceCategoryView,
  InvalidRunView,
  RiskSummaryView,
  RunDetailView,
  RunFilters,
  RunListItemView,
  ValueDashboardView,
  WorkflowChainStageView
} from "./data.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(title: string, active: "runs" | "benchmarks" | "value", body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="topbar">
      <div>
        <h1>AgentForge Visualizer</h1>
        <p class="muted">Source-build-only local run inspector for AgentForge dogfooding and benchmark review.</p>
      </div>
      <nav class="nav">
        <a href="/" class="${active === "runs" ? "active" : ""}">Runs</a>
        <a href="/value" class="${active === "value" ? "active" : ""}">Value</a>
        <a href="/benchmarks" class="${active === "benchmarks" ? "active" : ""}">Benchmarks</a>
      </nav>
    </header>
    <main class="page">${body}</main>
  </body>
</html>`;
}

function statusBadge(status: string): string {
  return `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}

function metricCard(label: string, value: string | number): string {
  return `<div class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(String(value))}</div></div>`;
}

function stackedMetricCard(label: string, value: string | number, detail: string): string {
  return `<div class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(String(value))}</div><div class="metric-detail">${escapeHtml(detail)}</div></div>`;
}

function listSection(title: string, items: string[]): string {
  if (items.length === 0) {
    return "";
  }

  return `<section class="panel"><h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`;
}

function renderInvalidRuns(invalidRuns: readonly InvalidRunView[]): string {
  if (invalidRuns.length === 0) {
    return "";
  }

  return `<section class="panel panel-warning">
    <h2>Invalid Run Bundles</h2>
    <ul>
      ${invalidRuns
        .map(
          (run) =>
            `<li><strong>${escapeHtml(run.runId)}</strong> <code>${escapeHtml(run.bundlePath)}</code><br/>${escapeHtml(run.error)}</li>`
        )
        .join("")}
    </ul>
  </section>`;
}

export function renderRunsIndexPage(
  runs: readonly RunListItemView[],
  invalidRuns: readonly InvalidRunView[],
  filters: RunFilters,
  options: {
    workflows: readonly string[];
    statuses: readonly string[];
    artifactKinds: readonly string[];
  }
): string {
  const rows =
    runs.length === 0
      ? `<tr><td colspan="8" class="muted">No runs match the current filters.</td></tr>`
      : runs
          .map(
            (run) => `<tr>
      <td><a href="/runs/${encodeURIComponent(run.runId)}">${escapeHtml(run.runId)}</a></td>
      <td>${escapeHtml(run.workflow)}</td>
      <td>${statusBadge(run.status)}</td>
      <td>${escapeHtml(run.finishedAt)}</td>
      <td>${escapeHtml(String(run.findings))}</td>
      <td>${escapeHtml(String(run.blockedActions))}</td>
      <td>${escapeHtml(String(run.blockedPlugins))}</td>
      <td>${run.artifactKinds.map((kind) => `<span class="chip">${escapeHtml(kind)}</span>`).join("")}</td>
    </tr>`
          )
          .join("");

  const renderOptions = (values: readonly string[], selectedValue?: string) =>
    [`<option value="">all</option>`, ...values.map((value) => `<option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(value)}</option>`)].join("");

  const body = `
    <section class="panel">
      <h2>Runs</h2>
      <p class="muted">Newest-first index of local AgentForge runs under <code>.agentops/runs</code>.</p>
      <form class="filters" method="get" action="/">
        <label>Search run id <input type="search" name="search" value="${escapeHtml(filters.search ?? "")}" /></label>
        <label>Workflow <select name="workflow">${renderOptions(options.workflows, filters.workflow)}</select></label>
        <label>Status <select name="status">${renderOptions(options.statuses, filters.status)}</select></label>
        <label>Artifact <select name="artifactKind">${renderOptions(options.artifactKinds, filters.artifactKind)}</select></label>
        <button type="submit">Apply</button>
      </form>
      <table class="data-table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Workflow</th>
            <th>Status</th>
            <th>Finished</th>
            <th>Findings</th>
            <th>Blocked actions</th>
            <th>Blocked plugins</th>
            <th>Artifacts</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
    ${renderInvalidRuns(invalidRuns)}
  `;

  return layout("AgentForge Visualizer - Runs", "runs", body);
}

function renderAuditEntries(entries: readonly AuditEntry[]): string {
  if (entries.length === 0) {
    return `<p class="muted">No audit entries recorded for this run.</p>`;
  }

  return `<div class="stack">${entries
    .map(
      (entry) => `<article class="panel">
        <div class="row between">
          <h3>${escapeHtml(entry.nodeName)}</h3>
          ${statusBadge(entry.status)}
        </div>
        <p class="muted">${escapeHtml(entry.kind)} node</p>
        <p>${escapeHtml(entry.summary)}</p>
        ${entry.blockedActions.length > 0 ? `<div><strong>Blocked actions:</strong> ${entry.blockedActions.map(escapeHtml).join(", ")}</div>` : ""}
      </article>`
    )
    .join("")}</div>`;
}

function renderFindings(findings: readonly Finding[]): string {
  if (findings.length === 0) {
    return `<p class="muted">No findings recorded.</p>`;
  }

  return `<ul>${findings
    .map((finding) => `<li><strong>[${escapeHtml(finding.severity)}]</strong> ${escapeHtml(finding.title)}: ${escapeHtml(finding.summary)}</li>`)
    .join("")}</ul>`;
}

function renderBlockedPlugins(blockedPlugins: readonly BlockedPlugin[]): string {
  if (blockedPlugins.length === 0) {
    return `<p class="muted">No blocked plugins recorded.</p>`;
  }

  return `<ul>${blockedPlugins
    .map((plugin) => `<li><strong>${escapeHtml(plugin.name)}</strong>: ${escapeHtml(plugin.reason)}</li>`)
    .join("")}</ul>`;
}

function renderArtifactSections(artifact: ArtifactPanelView): string {
  const sections = artifact.sections
    .map((section) => `<section class="artifact-section"><h4>${escapeHtml(section.heading)}</h4><ul>${section.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul></section>`)
    .join("");

  return sections || `<p class="muted">No structured section renderer for this artifact kind.</p>`;
}

function renderArtifactPanel(artifact: ArtifactPanelView): string {
  return `<article class="panel">
    <div class="row between">
      <h3>${escapeHtml(artifact.artifactKind)}</h3>
      ${statusBadge(artifact.status)}
    </div>
    <p>${escapeHtml(artifact.summary)}</p>
    <dl class="meta-grid">
      <div><dt>Workflow</dt><dd>${escapeHtml(artifact.workflowDisplayName ?? artifact.workflow)}</dd></div>
      <div><dt>Lifecycle</dt><dd>${escapeHtml(artifact.lifecycleDomain)}</dd></div>
      <div><dt>Known schema</dt><dd>${artifact.isKnownArtifact ? "yes" : "no"}</dd></div>
    </dl>
    ${artifact.parseError ? `<p class="warning">Artifact parsed with fallback mode: ${escapeHtml(artifact.parseError)}</p>` : ""}
    ${renderArtifactSections(artifact)}
    ${listSection("Source Refs", artifact.sourceRefs)}
    ${listSection("Issue Refs", artifact.issueRefs)}
    ${listSection("Provenance", artifact.provenanceEntries)}
    ${listSection("Audit Link", artifact.auditEntries)}
    <details>
      <summary>Raw payload</summary>
      <pre>${escapeHtml(artifact.rawPayload)}</pre>
    </details>
  </article>`;
}

function renderEvidenceCategory(category: EvidenceCategoryView): string {
  return `<li><strong>${escapeHtml(category.label)}</strong> ${statusBadge(category.status)}<br/><span class="muted">${escapeHtml(category.detail)}</span></li>`;
}

function renderRiskSummary(risk: RiskSummaryView): string {
  return `
    <div class="metrics">
      ${metricCard("High", risk.high)}
      ${metricCard("Medium", risk.medium)}
      ${metricCard("Low", risk.low)}
      ${metricCard("Noisy", risk.noisy)}
      ${metricCard("Unresolved", risk.unresolved)}
    </div>
    <ul>${risk.summary.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
  `;
}

function renderWorkflowChainStages(stages: readonly WorkflowChainStageView[]): string {
  return `<ol class="workflow-chain">${stages
    .map(
      (stage) => `<li class="workflow-chain-stage workflow-chain-stage-${escapeHtml(stage.status)}">
        <div class="row between">
          <strong>${escapeHtml(stage.label)}</strong>
          ${statusBadge(stage.status)}
        </div>
        <div class="muted">${escapeHtml(stage.detail)}</div>
      </li>`
    )
    .join("")}</ol>`;
}

export function renderRunDetailPage(run: RunDetailView): string {
  const body = `
    <section class="panel">
      <div class="row between">
        <div>
          <h2>${escapeHtml(run.runId)}</h2>
          <p class="muted">${escapeHtml(run.workflow)}</p>
        </div>
        ${statusBadge(run.status)}
      </div>
      <div class="metrics">
        ${metricCard("Findings", run.findings)}
        ${metricCard("Blocked actions", run.blockedActions)}
        ${metricCard("Blocked plugins", run.blockedPlugins)}
        ${metricCard("Artifacts", run.artifactKinds.length)}
      </div>
      <dl class="meta-grid">
        <div><dt>Started</dt><dd>${escapeHtml(run.startedAt)}</dd></div>
        <div><dt>Finished</dt><dd>${escapeHtml(run.finishedAt)}</dd></div>
        <div><dt>Bundle</dt><dd><a href="/api/runs/${encodeURIComponent(run.runId)}/bundle.json">bundle.json</a></dd></div>
        <div><dt>Summary</dt><dd><a href="/api/runs/${encodeURIComponent(run.runId)}/summary.md">summary.md</a></dd></div>
      </dl>
      <details>
        <summary>summary.md</summary>
        <pre>${escapeHtml(run.summaryMarkdown)}</pre>
      </details>
      <details>
        <summary>bundle.json</summary>
        <pre>${escapeHtml(run.rawBundleJson)}</pre>
      </details>
    </section>
    <section class="grid">
      <section class="panel"><h2>Findings</h2>${renderFindings(run.findingsList)}</section>
      <section class="panel"><h2>Blocked Plugins</h2>${renderBlockedPlugins(run.blockedPluginsList)}</section>
    </section>
    <section class="grid">
      <section class="panel">
        <h2>Decision Impact</h2>
        <p>${escapeHtml(run.decisionImpact.summary)}</p>
        <div class="metrics">
          ${metricCard("Outcome", run.decisionImpact.kind.replaceAll("_", " "))}
          ${metricCard("Changed decision", run.decisionImpact.changedDecision ? "yes" : "no")}
          ${metricCard("Source", run.decisionImpact.source)}
        </div>
      </section>
      <section class="panel">
        <h2>Risk Summary</h2>
        ${renderRiskSummary(run.riskSummary)}
      </section>
    </section>
    <section class="grid">
      <section class="panel">
        <h2>Evidence Completeness</h2>
        ${
          run.evidenceCompleteness.length === 0
            ? `<p class="muted">No structured evidence completeness model is defined for this workflow family yet.</p>`
            : run.evidenceCompleteness
                .map(
                  (artifact) => `<article class="artifact-section">
                    <h3>${escapeHtml(artifact.workflow)}</h3>
                    <ul>${artifact.categories.map(renderEvidenceCategory).join("")}</ul>
                  </article>`
                )
                .join("")
        }
      </section>
      <section class="panel">
        <h2>Workflow Chain</h2>
        <p class="muted">Read-only SDLC chain inferred from the current artifact and its referenced upstream evidence.</p>
        ${renderWorkflowChainStages(run.workflowChain.stages)}
      </section>
    </section>
    <section class="panel"><h2>Audit Entries</h2>${renderAuditEntries(run.entries)}</section>
    <section class="stack">
      <h2>Lifecycle Artifacts</h2>
      ${run.artifacts.map(renderArtifactPanel).join("")}
    </section>
  `;

  return layout(`AgentForge Visualizer - ${run.runId}`, "runs", body);
}

function renderBenchmarkCard(benchmark: BenchmarkSummaryView): string {
  return `<article class="panel">
    <div class="row between">
      <h3><a href="/runs/${encodeURIComponent(benchmark.runId)}">${escapeHtml(benchmark.runId)}</a></h3>
      ${statusBadge(benchmark.status)}
    </div>
    <p>${escapeHtml(benchmark.summaryConclusion)}</p>
    <div class="metrics">
      ${metricCard("Comparable", benchmark.comparableRunCount)}
      ${metricCard("Regressions", benchmark.regressionCount)}
      ${metricCard("Improvements", benchmark.improvementCount)}
      ${metricCard("Unchanged", benchmark.unchangedCount)}
      ${metricCard("Non-comparable", benchmark.nonComparableCount)}
    </div>
    <dl class="meta-grid">
      <div><dt>Baseline run</dt><dd>${benchmark.hasBaselineRunLink ? `<a href="/runs/${encodeURIComponent(benchmark.baselineRunId)}">${escapeHtml(benchmark.baselineRunId)}</a>` : escapeHtml(benchmark.baselineRunId)}</dd></div>
      <div><dt>Baseline workflow</dt><dd>${escapeHtml(benchmark.baselineWorkflow ?? "unknown")}</dd></div>
      <div><dt>Baseline spec</dt><dd>${escapeHtml(benchmark.baselineSpecId ?? "unknown")}</dd></div>
    </dl>
    <section class="artifact-section">
      <h4>Compared runs</h4>
      <ul>
        ${benchmark.comparedRuns
          .map(
            (run) =>
              `<li>${run.hasLocalRunLink ? `<a href="/runs/${encodeURIComponent(run.runId)}">${escapeHtml(run.runId)}</a>` : escapeHtml(run.runId)}: regressions=${run.regressionCount}, improvements=${run.improvementCount}, unchanged=${run.unchangedCount}, non-comparable=${run.nonComparableCount}</li>`
          )
          .join("")}
      </ul>
    </section>
  </article>`;
}

export function renderBenchmarksPage(view: BenchmarkIndexView): string {
  const body = `
    <section class="panel">
      <h2>Benchmark Dashboard</h2>
      <p class="muted">Read-only view over local <code>benchmark-summary</code> artifacts emitted by <code>agentforge eval compare</code>.</p>
      ${
        view.benchmarks.length === 0
          ? `<p class="muted">No benchmark-summary runs found in the current runs root.</p>`
          : `<div class="stack">${view.benchmarks.map(renderBenchmarkCard).join("")}</div>`
      }
    </section>
    ${renderInvalidRuns(view.invalidRuns)}
  `;

  return layout("AgentForge Visualizer - Benchmarks", "benchmarks", body);
}

export function renderValueDashboardPage(view: ValueDashboardView): string {
  const body = `
    <section class="panel">
      <h2>Decision Impact</h2>
      <p class="muted">This view answers whether AgentForge changed decisions, caught risk, or exposed process gaps across the local run corpus.</p>
      <div class="metrics">
        ${stackedMetricCard("Changed decisions", view.decisionImpact.changedDecisionCount, `${view.runCount} run(s) in view`)}
        ${metricCard("Scope reduction", view.decisionImpact.scopeReductionCount)}
        ${metricCard("Added validation", view.decisionImpact.addedValidationCount)}
        ${metricCard("Blocked approval", view.decisionImpact.blockedApprovalCount)}
        ${metricCard("Remediation", view.decisionImpact.remediationCount)}
        ${metricCard("Added confidence", view.decisionImpact.addedConfidenceCount)}
        ${metricCard("No meaningful change", view.decisionImpact.noMeaningfulChangeCount)}
        ${stackedMetricCard("Comparable pairs", view.decisionImpact.comparableBenchmarkPairs, "Control + AgentForge ledger pairs")}
      </div>
    </section>
    <section class="grid">
      <section class="panel">
        <h2>Risk Caught</h2>
        <div class="metrics">
          ${metricCard("Confirmed high", view.risk.confirmedHighCount)}
          ${metricCard("Confirmed medium", view.risk.confirmedMediumCount)}
          ${metricCard("Noisy findings", view.risk.noisyFindingCount)}
          ${metricCard("Blocked approvals prevented", view.risk.blockedApprovalPreventedCount)}
          ${metricCard("Unresolved risks", view.risk.unresolvedRiskCount)}
        </div>
        <p class="muted">Confirmed high/medium/noisy counts come from the optional local benchmark ledger when present. Blocked approvals and unresolved risks are derived from local run artifacts.</p>
      </section>
      <section class="panel">
        <h2>Friction And Overrides</h2>
        ${
          !view.friction.ledgerAvailable
            ? `<p class="muted">No local benchmark ledger overlays detected. Add <code>.agentops/benchmark-ledger.json</code> to surface override reasons, false positives, and request friction directly in the dashboard.</p>`
            : `
              <div class="metrics">
                ${metricCard("Overrides", view.friction.overrideCount)}
                ${metricCard("False positives", view.friction.falsePositiveCount)}
                ${metricCard("Manual steps", view.friction.manualStepCount)}
                ${metricCard("Request friction", view.friction.requestFrictionCount)}
              </div>
              ${view.friction.repeatedOverrideReasons.length > 0 ? `<h3>Repeated Override Reasons</h3><ul>${view.friction.repeatedOverrideReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>` : `<p class="muted">No override reasons recorded.</p>`}
              ${view.friction.noisyPatterns.length > 0 ? `<h3>Noisy Patterns</h3><ul>${view.friction.noisyPatterns.map((pattern) => `<li>${escapeHtml(pattern)}</li>`).join("")}</ul>` : `<p class="muted">No repeated false-positive patterns recorded.</p>`}
            `
        }
      </section>
    </section>
    <section class="panel">
      <h2>Evidence Completeness</h2>
      ${
        view.evidence.length === 0
          ? `<p class="muted">No evidence completeness data is available for the current run corpus yet.</p>`
          : `<table class="data-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Runs</th>
                  <th>Missing</th>
                  <th>Partial</th>
                  <th>Most Frequent Gaps</th>
                </tr>
              </thead>
              <tbody>
                ${view.evidence
                  .map(
                    (row) => `<tr>
                      <td>${escapeHtml(row.workflow)}</td>
                      <td>${escapeHtml(String(row.runs))}</td>
                      <td>${escapeHtml(String(row.missingCount))}</td>
                      <td>${escapeHtml(String(row.partialCount))}</td>
                      <td>${row.frequentMissing.length > 0 ? row.frequentMissing.map((gap) => `<span class="chip">${escapeHtml(gap)}</span>`).join("") : `<span class="muted">none</span>`}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>`
      }
    </section>
    <section class="panel">
      <h2>Workflow Chain Coverage</h2>
      <p class="muted">Stages below are inferred from local artifact kinds and upstream references. Use this to see where release chains break or skip earlier evidence.</p>
      ${
        view.workflowChains.length === 0
          ? `<p class="muted">No chain-aware workflow runs were found.</p>`
          : `<table class="data-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Runs</th>
                  <th>Blocked</th>
                  <th>Missing Upstream Evidence</th>
                </tr>
              </thead>
              <tbody>
                ${view.workflowChains
                  .map(
                    (row) => `<tr>
                      <td>${escapeHtml(row.label)}</td>
                      <td>${escapeHtml(String(row.runCount))}</td>
                      <td>${escapeHtml(String(row.blockedCount))}</td>
                      <td>${escapeHtml(String(row.missingUpstreamEvidenceCount))}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>`
      }
    </section>
    <section class="panel">
      <h2>Benchmark Ledger Overlay</h2>
      <p class="muted">Ledger path: <code>${escapeHtml(view.ledger.path)}</code></p>
      ${
        view.ledger.errors.length > 0
          ? `<ul>${view.ledger.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`
          : view.ledger.entries.length === 0
            ? `<p class="muted">No benchmark ledger entries were loaded. The dashboard is using run-derived signals only.</p>`
            : `<p>Loaded ${escapeHtml(String(view.ledger.entries.length))} benchmark ledger entry/entries for adjudication overlays.</p>`
      }
    </section>
  `;

  return layout("AgentForge Visualizer - Value", "value", body);
}

export function visualizerStyles(): string {
  return `
:root {
  color-scheme: light;
  --bg: #f5f7f7;
  --panel: #ffffff;
  --border: #d4dcdc;
  --text: #17312f;
  --muted: #5b706d;
  --accent: #0f766e;
  --accent-soft: #d8f3ef;
  --warning: #a85a00;
  --danger: #9f1239;
  --success: #166534;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: linear-gradient(180deg, #eef6f5 0%, var(--bg) 240px);
  color: var(--text);
}
.topbar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
}
.topbar h1 { margin: 0 0 0.35rem 0; font-size: 1.6rem; }
.page { padding: 1.5rem 2rem 3rem; max-width: 1400px; margin: 0 auto; }
.nav { display: flex; gap: 0.75rem; align-items: center; }
.nav a {
  text-decoration: none;
  color: var(--muted);
  padding: 0.55rem 0.85rem;
  border-radius: 999px;
  border: 1px solid transparent;
}
.nav a.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: #b6e6de;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1rem 1.1rem;
  box-shadow: 0 8px 24px rgba(24, 63, 59, 0.06);
}
.panel-warning { border-color: #f1c27d; background: #fff8ef; }
.stack { display: grid; gap: 1rem; }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); margin: 1rem 0; }
.row { display: flex; gap: 1rem; align-items: center; }
.between { justify-content: space-between; }
.muted { color: var(--muted); }
.warning { color: var(--warning); }
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.9rem;
  margin: 1rem 0;
}
.filters label { display: grid; gap: 0.4rem; font-size: 0.95rem; }
input, select, button {
  font: inherit;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #fff;
}
button {
  cursor: pointer;
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  align-self: end;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
}
.data-table th, .data-table td {
  text-align: left;
  padding: 0.75rem;
  border-top: 1px solid var(--border);
  vertical-align: top;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin: 1rem 0;
}
.metric {
  background: #f8fbfb;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.8rem;
}
.metric-label { color: var(--muted); font-size: 0.85rem; }
.metric-value { font-size: 1.2rem; font-weight: 700; margin-top: 0.2rem; }
.metric-detail { color: var(--muted); font-size: 0.82rem; margin-top: 0.3rem; }
.badge {
  display: inline-flex;
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid transparent;
}
.badge-success { background: #e8f8ee; color: var(--success); border-color: #b7e5c6; }
.badge-partial { background: #fff5db; color: #8a5b00; border-color: #efd48b; }
.badge-failed { background: #ffe6eb; color: var(--danger); border-color: #f5b3c2; }
.badge-complete, .badge-ready, .badge-completed, .badge-approval_recommended, .badge-ready_for_approval { background: #e8f8ee; color: var(--success); border-color: #b7e5c6; }
.badge-draft, .badge-in_progress, .badge-needs_follow_up, .badge-conditionally_ready { background: #fff5db; color: #8a5b00; border-color: #efd48b; }
.badge-blocked { background: #ffe6eb; color: var(--danger); border-color: #f5b3c2; }
.badge-present, .badge-current { background: #e8f8ee; color: var(--success); border-color: #b7e5c6; }
.badge-missing { background: #ffe6eb; color: var(--danger); border-color: #f5b3c2; }
.chip {
  display: inline-flex;
  margin: 0.1rem 0.35rem 0.1rem 0;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: #edf7f6;
  color: #0e5c56;
  border: 1px solid #cbeae5;
  font-size: 0.82rem;
}
.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}
.meta-grid dt { color: var(--muted); font-size: 0.85rem; }
.meta-grid dd { margin: 0.2rem 0 0; }
.artifact-section { margin-top: 1rem; }
.workflow-chain {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}
.workflow-chain-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.85rem;
  background: #f8fbfb;
}
.workflow-chain-stage-current { background: #edf7f6; border-color: #cbeae5; }
.workflow-chain-stage-present { background: #f8fbfb; }
.workflow-chain-stage-missing { background: #fff6f3; border-color: #f2d0c4; }
pre {
  margin: 0.8rem 0 0;
  padding: 1rem;
  border-radius: 12px;
  background: #10211f;
  color: #e8f5f3;
  overflow-x: auto;
  font-size: 0.86rem;
}
code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
a { color: var(--accent); }
`;
}
