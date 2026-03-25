import type { AuditEntry, BlockedPlugin, Finding, ProviderUsageAggregate } from "@h9-foundry/agentforge-shared-types";

import type {
  ArtifactPanelView,
  BenchmarkIndexView,
  BenchmarkSummaryView,
  ConfigurationHotspotView,
  EvidenceCategoryView,
  InvalidRunView,
  OutcomeDetailRowView,
  OutcomesExportDocument,
  OutcomeSummaryView,
  OutcomesDashboardView,
  RiskSummaryView,
  RunComparisonView,
  RunDetailView,
  RunFilters,
  RunListItemView,
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

function layout(title: string, active: "runs" | "benchmarks" | "outcomes" | "configure" | "compare", body: string): string {
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
        <p class="muted">Published-CLI local outcomes and run inspector for evaluating one repository at a time.</p>
      </div>
      <nav class="nav">
        <a href="/outcomes" class="${active === "outcomes" ? "active" : ""}">Outcomes</a>
        <a href="/runs" class="${active === "runs" ? "active" : ""}">Runs</a>
        <a href="/runs/compare" class="${active === "compare" ? "active" : ""}">Compare</a>
        <a href="/benchmarks" class="${active === "benchmarks" ? "active" : ""}">Benchmarks</a>
        <a href="/configure" class="${active === "configure" ? "active" : ""}">Configure</a>
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

function formatDurationSeconds(value: number | undefined): string {
  if (value === undefined) {
    return "n/a";
  }

  return `${value}s`;
}

function formatCurrencyUsd(value: number | undefined): string {
  if (value === undefined) {
    return "n/a";
  }

  return `$${value.toFixed(2)}`;
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
    decisionImpacts: readonly string[];
    riskKinds: readonly string[];
    evidenceCategories: readonly string[];
    workflowStages: readonly string[];
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
      <p class="muted">Practitioner drill-down over local runs in <code>.agentops/runs</code>. Start with <a href="/outcomes">Outcomes</a> when you want the evaluator summary first, then use this page to inspect specific runs.</p>
      <p class="backlinks"><a href="/outcomes">Back to evaluator summary</a> · <a href="/runs/compare">Compare two runs</a></p>
      <form class="filters" method="get" action="/runs">
        <label>Search run id <input type="search" name="search" value="${escapeHtml(filters.search ?? "")}" /></label>
        <label>Workflow <select name="workflow">${renderOptions(options.workflows, filters.workflow)}</select></label>
        <label>Status <select name="status">${renderOptions(options.statuses, filters.status)}</select></label>
        <label>Artifact <select name="artifactKind">${renderOptions(options.artifactKinds, filters.artifactKind)}</select></label>
        <label>Decision <select name="decisionImpact">${renderOptions(options.decisionImpacts, filters.decisionImpact)}</select></label>
        <label>Risk <select name="riskKind">${renderOptions(options.riskKinds, filters.riskKind)}</select></label>
        <label>Evidence category <select name="evidenceCategory">${renderOptions(options.evidenceCategories, filters.evidenceCategory)}</select></label>
        <label>Evidence status <select name="evidenceStatus">${renderOptions(["present", "missing", "partial"], filters.evidenceStatus)}</select></label>
        <label>Override <select name="hasOverride">${renderOptions(["true", "false"], filters.hasOverride)}</select></label>
        <label>Workflow stage <select name="workflowStage">${renderOptions(options.workflowStages, filters.workflowStage)}</select></label>
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
        ${
          entry.usage
            ? `<div><strong>Measured usage:</strong> ${escapeHtml(
                `${entry.usage.totalTokens} tokens across ${entry.usage.totalRequests} request(s); ${typeof entry.usage.totalEstimatedCostUsd === "number" ? `$${entry.usage.totalEstimatedCostUsd.toFixed(6)} estimated` : "cost unavailable"}`
              )}</div>`
            : ""
        }
      </article>`
    )
    .join("")}</div>`;
}

function renderUsageSummary(usage?: ProviderUsageAggregate): string {
  if (!usage) {
    return `<p class="muted">No provider-backed token usage was recorded for this run.</p>`;
  }

  return `
    <div class="metrics">
      ${metricCard("Measured input tokens", usage.totalInputTokens)}
      ${metricCard("Measured output tokens", usage.totalOutputTokens)}
      ${metricCard("Measured total tokens", usage.totalTokens)}
      ${metricCard("Requests", usage.totalRequests)}
    </div>
    <p class="muted">
      Tokens are measured from provider responses. Cost is ${
        typeof usage.totalEstimatedCostUsd === "number"
          ? escapeHtml(`estimated from the local pricing table (${usage.byModel[0]?.pricing?.version ?? "version unknown"})`)
          : "unavailable because no local pricing entry matched this run"
      }.
    </p>
    ${
      usage.byNode.length > 0
        ? `<div class="stack">
            ${usage.byNode
              .map(
                (node) => `<section class="panel panel-subtle">
                  <div class="row between">
                    <strong>${escapeHtml(node.nodeName)}</strong>
                    ${statusBadge(node.costStatus)}
                  </div>
                  <p class="muted">${escapeHtml(node.kind)} node · ${escapeHtml(node.totalTokens.toString())} tokens across ${escapeHtml(node.totalRequests.toString())} request(s)</p>
                  ${
                    node.byModel.length > 0
                      ? `<ul>${node.byModel
                          .map(
                            (entry) => `<li>${escapeHtml(`${entry.provider}/${entry.model}: ${entry.totalTokens} tokens, ${entry.requestCount} request(s), ${typeof entry.estimatedCostUsd === "number" ? `$${entry.estimatedCostUsd.toFixed(6)} estimated` : "cost unavailable"}`)}</li>`
                          )
                          .join("")}</ul>`
                      : `<p class="muted">No per-model breakdown recorded.</p>`
                  }
                </section>`
              )
              .join("")}
          </div>`
        : ""
    }
  `;
}

function renderFindings(findings: readonly Finding[]): string {
  if (findings.length === 0) {
    return `<p class="muted">No findings recorded.</p>`;
  }

  return `<ul>${findings
    .map((finding) => `<li><strong>[${escapeHtml(finding.severity)}]</strong> ${escapeHtml(finding.title)}: ${escapeHtml(finding.summary)}${finding.tags.length > 0 ? `<div class="chips">${finding.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}</li>`)
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

function buildConfigureHref(target: "request" | "workflow-control" | "policy-presets" | "defaults" | "repo-fit", workflow?: string): string {
  const params = new URLSearchParams();
  params.set("target", target);
  if (workflow) {
    params.set("workflow", workflow);
  }
  return `/configure?${params.toString()}`;
}

function renderConfigurationLinks(workflow: string): string {
  return [
    `<a href="${escapeHtml(buildConfigureHref("request", workflow))}">Request</a>`,
    `<a href="${escapeHtml(buildConfigureHref("workflow-control", workflow))}">Workflow control</a>`,
    `<a href="${escapeHtml(buildConfigureHref("policy-presets"))}">Policy presets</a>`,
    `<a href="${escapeHtml(buildConfigureHref("defaults"))}">Defaults</a>`,
    `<a href="${escapeHtml(buildConfigureHref("repo-fit"))}">Repo fit</a>`
  ].join(" · ");
}

function renderRunConfiguration(run: RunDetailView): string {
  if (!run.configuration) {
    return `<p class="muted">No resolved configuration snapshot was recorded for this run.</p>`;
  }

  return `
    <div class="metrics">
      ${metricCard("Profile", run.configuration.profile)}
      ${metricCard("Policy preset", run.configuration.policyPreset ?? "default")}
      ${metricCard("Workflow variant", run.configuration.workflowVariant)}
      ${metricCard("Agent bindings", run.configuration.agentBindings.length)}
      ${metricCard("Repo-fit profile", run.configuration.repoFitSelectedProfile ?? run.configuration.repoFitRecommendedProfile ?? "none")}
    </div>
    <dl class="meta-grid">
      <div><dt>Policy fingerprint</dt><dd><code>${escapeHtml(run.configuration.policyFingerprint)}</code></dd></div>
      <div><dt>Repo-fit</dt><dd>${run.configuration.repoFitPath ? `<a href="${escapeHtml(buildConfigureHref("repo-fit"))}">${escapeHtml(run.configuration.repoFitPath)}</a>${run.configuration.repoFitAdoption ? ` (${escapeHtml(run.configuration.repoFitAdoption)})` : ""}` : "not recorded"}</dd></div>
      <div><dt>Source refs</dt><dd>${run.configuration.sourceRefs.map((ref) => `<span class="chip">${escapeHtml(ref)}</span>`).join("")}</dd></div>
      <div><dt>Open In Configure</dt><dd>${renderConfigurationLinks(run.workflow)}</dd></div>
    </dl>
    <section class="artifact-section">
      <h3>Node Agents</h3>
      ${
        run.configuration.nodeAgents.length === 0
          ? `<p class="muted">No node-agent mapping recorded.</p>`
          : `<ul>${run.configuration.nodeAgents.map((entry) => `<li><strong>${escapeHtml(entry.nodeId)}</strong>: ${escapeHtml(entry.agent)}</li>`).join("")}</ul>`
      }
    </section>
    <section class="artifact-section">
      <h3>Executed Nodes</h3>
      ${
        run.configuration.executedNodes.length === 0
          ? `<p class="muted">No executed-node trace recorded.</p>`
          : `<ul>${run.configuration.executedNodes.map((entry) => `<li><strong>${escapeHtml(entry.nodeId)}</strong>: ${escapeHtml(entry.kind)}${entry.agent ? ` via ${escapeHtml(entry.agent)}` : ""}</li>`).join("")}</ul>`
      }
    </section>
  `;
}

function renderArtifactSections(artifact: ArtifactPanelView): string {
  const sections = artifact.sections
    .map((section) => `<section class="artifact-section"><h4>${escapeHtml(section.heading)}</h4><ul>${section.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul></section>`)
    .join("");

  return sections || `<p class="muted">No structured section renderer for this artifact kind.</p>`;
}

function renderArtifactRelatedLinks(artifact: ArtifactPanelView): string {
  const links: string[] = [];

  if (artifact.artifactKind === "benchmark-summary") {
    links.push(`<a href="/benchmarks">Benchmark dashboard</a>`);
  }
  if (["release-report", "pipeline-report", "deployment-gate-report", "promotion-approval-report"].includes(artifact.artifactKind)) {
    links.push(`<a href="#workflow-chain">Workflow chain</a>`);
    links.push(`<a href="#risk-summary">Risk summary</a>`);
  }
  if (["planning-brief", "qa-report", "release-report", "pipeline-report", "deployment-gate-report", "promotion-approval-report"].includes(artifact.artifactKind)) {
    links.push(`<a href="#decision-impact">Decision impact</a>`);
    links.push(`<a href="#evidence-completeness">Evidence completeness</a>`);
  }

  if (links.length === 0) {
    return "";
  }

  return `<p class="backlinks">Related sections: ${links.join(" · ")}</p>`;
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
    ${renderArtifactRelatedLinks(artifact)}
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

function renderTraceRefs(traceRefs: readonly { note: string; runId?: string; artifactKind?: string; section?: string; findingId?: string }[]): string {
  if (traceRefs.length === 0) {
    return `<p class="muted">No trace references recorded.</p>`;
  }

  return `<ul>${traceRefs
    .map((traceRef) => {
      const location = [traceRef.runId, traceRef.artifactKind, traceRef.section, traceRef.findingId].filter(Boolean).join(" / ");
      const runHref = traceRef.runId ? `/runs/${encodeURIComponent(traceRef.runId)}${traceRef.section ? `#${encodeURIComponent(traceRef.section)}` : ""}` : undefined;
      const locationHtml = location
        ? runHref
          ? `<br/><a class="muted" href="${escapeHtml(runHref)}">${escapeHtml(location)}</a>`
          : `<br/><span class="muted">${escapeHtml(location)}</span>`
        : "";
      return `<li>${escapeHtml(traceRef.note)}${locationHtml}</li>`;
    })
    .join("")}</ul>`;
}

function renderOutcomeSummaryCards(cards: readonly OutcomeSummaryView[]): string {
  return `<div class="metrics">${cards
    .map(
      (card) => `<a class="metric metric-link" href="${escapeHtml(card.href)}">
        <div class="metric-label">${escapeHtml(card.label)}</div>
        ${card.provenance ? `<div class="metric-provenance">${escapeHtml(card.provenance)}</div>` : ""}
        <div class="metric-value">${escapeHtml(String(card.value))}</div>
        <div class="metric-detail">${escapeHtml(card.detail)}</div>
      </a>`
    )
    .join("")}</div>`;
}

function renderConfigurationHotspots(hotspots: readonly ConfigurationHotspotView[]): string {
  if (hotspots.length === 0) {
    return `<p class="muted">No runs with resolved configuration snapshots are available yet. This usually means the current corpus is older than the control-plane release or no recent runs used resolved configuration metadata.</p>`;
  }

  return `<table class="data-table">
    <thead>
      <tr>
        <th>Dimension</th>
        <th>Value</th>
        <th>Runs</th>
        <th>Changed decisions</th>
        <th>Blocked actions</th>
        <th>Workflows</th>
      </tr>
    </thead>
    <tbody>
      ${hotspots
        .slice(0, 12)
        .map(
          (hotspot) => `<tr>
            <td>${escapeHtml(hotspot.dimension)}</td>
            <td><code>${escapeHtml(hotspot.value)}</code></td>
            <td>${escapeHtml(String(hotspot.runs))}</td>
            <td>${escapeHtml(String(hotspot.changedDecisions))}</td>
            <td>${escapeHtml(String(hotspot.blockedActions))}</td>
            <td>${hotspot.workflows.map((workflow) => `<span class="chip">${escapeHtml(workflow)}</span>`).join("")}</td>
          </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

function renderReleaseArmMarkdownLines(view: OutcomesExportDocument["releaseBenchmark"]["arms"][number]): string[] {
  return [
    `- ${view.arm}: entries=${view.entryCount}, median_cycle_seconds=${view.medianCycleTimeSeconds ?? "n/a"}, clear_decisions=${view.clearDecisionCount}, blocked_releases=${view.blockedReleaseCount}, confirmed_risks=${view.confirmedRiskCount}, measured_tokens=${view.totalTokens}, estimated_cost_usd=${typeof view.totalEstimatedCostUsd === "number" ? view.totalEstimatedCostUsd.toFixed(6) : "unavailable"}`
  ];
}

export function renderOutcomesExportMarkdown(document: OutcomesExportDocument): string {
  return [
    "# AgentForge Outcomes Export",
    "",
    `- Generated: ${document.generatedAt}`,
    `- Runs root: ${document.runsRoot}`,
    `- Ledger available: ${document.ledgerAvailable ? "yes" : "no"}`,
    `- Runs in scope: ${document.runCount}`,
    "",
    "## Decision Impact",
    "",
    `- Changed decisions: ${document.decisionImpact.changedDecisionCount}`,
    `- Scope reduction: ${document.decisionImpact.scopeReductionCount}`,
    `- Added validation: ${document.decisionImpact.addedValidationCount}`,
    `- Blocked approval chains: ${document.decisionImpact.blockedApprovalCount}`,
    "",
    "## Risk",
    "",
    `- Confirmed high: ${document.risk.confirmedHighCount}`,
    `- Confirmed medium: ${document.risk.confirmedMediumCount}`,
    `- Noisy findings: ${document.risk.noisyFindingCount}`,
    `- Blocked approval chains prevented: ${document.risk.blockedApprovalPreventedCount}`,
    `- Unresolved risks: ${document.risk.unresolvedRiskCount}`,
    "",
    "## Release Benchmark",
    "",
    ...document.releaseBenchmark.arms.flatMap(renderReleaseArmMarkdownLines),
    "",
    "## Evidence",
    "",
    ...(document.evidence.length > 0
      ? document.evidence.map(
          (row) => `- ${row.workflow}: runs=${row.runs}, missing=${row.missingCount}, partial=${row.partialCount}, frequent_gaps=${row.frequentMissing.join(", ") || "none"}`
        )
      : ["- No evidence summary rows available."]),
    "",
    "## Friction",
    "",
    `- Overrides: ${document.friction.overrideCount}`,
    `- False positives: ${document.friction.falsePositiveCount}`,
    `- Manual steps: ${document.friction.manualStepCount}`,
    `- Request friction: ${document.friction.requestFrictionCount}`,
    "",
    "## Workflow Chains",
    "",
    ...(document.workflowChains.length > 0
      ? document.workflowChains.map(
          (stage) => `- ${stage.label}: runs=${stage.runCount}, blocked=${stage.blockedCount}, missing_upstream_evidence=${stage.missingUpstreamEvidenceCount}`
        )
      : ["- No workflow chain summary rows available."]),
    ""
  ].join("\n");
}

function renderOutcomeDetailTable(rows: readonly OutcomeDetailRowView[], emptyMessage: string): string {
  if (rows.length === 0) {
    return `<p class="muted">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<table class="data-table">
    <thead>
      <tr>
        <th>Title</th>
        <th>Workflow</th>
        <th>Run</th>
        <th>Source</th>
        <th>Why</th>
        <th>Links</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `<tr>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(row.workflow)}</td>
            <td>${escapeHtml(row.runId)}</td>
            <td>${escapeHtml(row.source)}</td>
            <td>
              <div>${escapeHtml(row.summary)}</div>
              <div class="trace-list">${renderTraceRefs(row.traceRefs)}</div>
            </td>
            <td>
              <a href="${escapeHtml(row.detailHref)}">Run detail</a><br/>
              <a href="${escapeHtml(row.runsHref)}">Filtered runs</a>
            </td>
          </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

function renderReleaseBenchmarkArmTable(view: OutcomesDashboardView): string {
  if (!view.releaseBenchmark.available) {
    return `<p class="muted">No release-category benchmark ledger entries were loaded. Add release benchmark adjudication entries to compare speed, quality, and token spend with and without AgentForge.</p>`;
  }

  return `<table class="data-table">
    <thead>
      <tr>
        <th>Arm</th>
        <th>Entries</th>
        <th>Median cycle</th>
        <th>Clear decisions</th>
        <th>Blocked releases</th>
        <th>Confirmed risks</th>
        <th>Measured tokens</th>
        <th>Estimated cost</th>
        <th>Cost / risk</th>
        <th>Cost / blocked release</th>
      </tr>
    </thead>
    <tbody>
      ${view.releaseBenchmark.arms
        .map(
          (arm) => `<tr>
            <td>${escapeHtml(arm.arm)}</td>
            <td>${escapeHtml(String(arm.entryCount))}</td>
            <td>${escapeHtml(formatDurationSeconds(arm.medianCycleTimeSeconds))}</td>
            <td>${escapeHtml(String(arm.clearDecisionCount))}</td>
            <td>${escapeHtml(String(arm.blockedReleaseCount))}</td>
            <td>${escapeHtml(String(arm.confirmedRiskCount))}</td>
            <td>${escapeHtml(`${arm.totalTokens} (${arm.measuredTokenEntryCount}/${arm.entryCount} entries)` )}</td>
            <td>${escapeHtml(formatCurrencyUsd(arm.totalEstimatedCostUsd))}</td>
            <td>${escapeHtml(formatCurrencyUsd(arm.costPerConfirmedRiskCaught))}</td>
            <td>${escapeHtml(formatCurrencyUsd(arm.costPerBlockedPrematureRelease))}</td>
          </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

function renderDerivedReason(reason: { source: string; rule: string; fields: readonly string[]; summary: string }): string {
  return `<dl class="meta-grid">
    <div><dt>Source</dt><dd>${escapeHtml(reason.source)}</dd></div>
    <div><dt>Rule</dt><dd>${escapeHtml(reason.rule)}</dd></div>
    <div><dt>Fields</dt><dd>${reason.fields.length > 0 ? reason.fields.map((field) => `<span class="chip">${escapeHtml(field)}</span>`).join("") : `<span class="muted">none</span>`}</dd></div>
    <div><dt>Summary</dt><dd>${escapeHtml(reason.summary)}</dd></div>
  </dl>`;
}

export function renderRunDetailPage(run: RunDetailView): string {
  const backToRunsHref = [
    run.decisionImpact.kind ? `decisionImpact=${encodeURIComponent(run.decisionImpact.kind)}` : "",
    run.workflowChain.currentStage ? `workflowStage=${encodeURIComponent(run.workflowChain.currentStage)}` : ""
  ]
    .filter((value) => value.length > 0)
    .join("&");

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
      <p class="backlinks"><a href="/outcomes">Back to Outcomes</a> · <a href="/runs${backToRunsHref ? `?${backToRunsHref}` : ""}">Back to filtered runs</a> · ${renderConfigurationLinks(run.workflow)}</p>
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
    <section class="panel" id="configuration">
      <h2>Resolved Configuration</h2>
      <p class="muted">This run snapshot records which control-plane selections and effective node mappings produced the final outcome.</p>
      ${renderRunConfiguration(run)}
    </section>
    <section class="panel" id="usage-summary">
      <h2>Usage Summary</h2>
      ${renderUsageSummary(run.usage)}
    </section>
    <section class="grid">
      <section class="panel" id="decision-impact">
        <h2>Decision Impact</h2>
        <p>${escapeHtml(run.decisionImpact.summary)}</p>
        <div class="metrics">
          ${metricCard("Outcome", run.decisionImpact.kind.replaceAll("_", " "))}
          ${metricCard("Changed decision", run.decisionImpact.changedDecision ? "yes" : "no")}
          ${metricCard("Source", run.decisionImpact.source)}
        </div>
        <section class="artifact-section">
          <h3>Why this outcome?</h3>
          ${renderDerivedReason(run.decisionImpact.reason)}
          ${renderTraceRefs(run.decisionImpact.traceRefs)}
        </section>
      </section>
      <section class="panel" id="risk-summary">
        <h2>Risk Summary</h2>
        ${renderRiskSummary(run.riskSummary)}
        <section class="artifact-section">
          <h3>Why this risk summary?</h3>
          ${renderDerivedReason(run.riskSummary.reason)}
          ${renderTraceRefs(run.riskSummary.traceRefs)}
        </section>
      </section>
    </section>
    <section class="grid">
      <section class="panel" id="evidence-completeness">
        <h2>Evidence Completeness</h2>
        ${
          run.evidenceCompleteness.length === 0
            ? `<p class="muted">No structured evidence completeness model is defined for this workflow family yet.</p>`
            : run.evidenceCompleteness
                .map(
                  (artifact) => `<article class="artifact-section">
                    <h3>${escapeHtml(artifact.workflow)}</h3>
                    <ul>${artifact.categories.map(renderEvidenceCategory).join("")}</ul>
                    <h4>How evidence status was derived</h4>
                    <div class="stack">
                      ${artifact.categories
                        .map(
                          (category) => `<section class="panel panel-subtle">
                            <div class="row between">
                              <strong>${escapeHtml(category.label)}</strong>
                              ${statusBadge(category.status)}
                            </div>
                            ${renderDerivedReason(category.reason)}
                            ${renderTraceRefs(category.traceRefs)}
                          </section>`
                        )
                        .join("")}
                    </div>
                  </article>`
                )
                .join("")
        }
      </section>
      <section class="panel" id="workflow-chain">
        <h2>Workflow Chain</h2>
        <p class="muted">Read-only SDLC chain inferred from the current artifact and its referenced upstream evidence.</p>
        ${renderWorkflowChainStages(run.workflowChain.stages)}
        <section class="artifact-section">
          <h3>Chain dependencies</h3>
          <div class="stack">
            ${run.workflowChain.stages
              .map(
                (stage) => `<section class="panel panel-subtle">
                  <div class="row between">
                    <strong>${escapeHtml(stage.label)}</strong>
                    ${statusBadge(stage.status)}
                  </div>
                  <p>${escapeHtml(stage.detail)}</p>
                  <p class="muted">${escapeHtml(stage.required ? "Required for current flow" : "Not required for current flow")}</p>
                  ${renderDerivedReason(stage.reason)}
                  ${renderTraceRefs(stage.traceRefs)}
                </section>`
              )
              .join("")}
          </div>
        </section>
      </section>
    </section>
    <section class="panel"><h2>Audit Entries</h2>${renderAuditEntries(run.entries)}</section>
    <section class="stack">
      <h2>Lifecycle Artifacts</h2>
      ${run.artifacts.map((artifact) => `<div id="${escapeHtml(artifact.id)}">${renderArtifactPanel(artifact)}</div>`).join("")}
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
      <p class="muted">Deterministic eval evidence only. Use this page after you already understand the live workflow story in <a href="/outcomes">Outcomes</a>.</p>
      <p class="backlinks"><a href="/outcomes">Back to evaluator summary</a> · <a href="/runs">Inspect local runs</a></p>
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

export function renderOutcomesDashboardPage(view: OutcomesDashboardView): string {
  const body = `
    <section class="panel">
      <h2>Outcomes</h2>
      <p class="muted">Start here after your first run. This page answers whether AgentForge changed the plan, reduced risk, or added enough evidence to justify the workflow.</p>
      <p class="muted">Use <a href="/runs">Runs</a> for forensic drill-down, <a href="/runs/compare">Compare</a> after you have two candidate runs, <a href="/benchmarks">Benchmarks</a> for deterministic eval evidence, and <a href="/configure">Configure</a> when you need supported config authoring over canonical repo YAML.</p>
      <p class="backlinks"><a href="/api/outcomes/export.json">Export JSON</a> · <a href="/outcomes/export.md">Export Markdown</a> · <a href="/api/outcomes">Raw outcomes JSON</a></p>
      <div class="metrics">
        ${stackedMetricCard("Runs in scope", view.runCount, view.filteredPanel ? `Filtered to ${view.filteredPanel}` : "Full local run corpus")}
        ${stackedMetricCard("Comparable pairs", view.decisionImpact.comparableBenchmarkPairs, "Control + AgentForge ledger pairs")}
      </div>
    </section>
    <section class="panel" id="decision-impact">
      <h2>Decision Outcomes</h2>
      <p class="muted">Did AgentForge change the plan, add validation, or simply confirm the current path? Release-domain chains are counted once at their most downstream blocked or decisive stage in the summary cards below.</p>
      ${renderOutcomeSummaryCards(view.summaries.decision)}
      <div class="metrics">
        ${metricCard("Scope reduction", view.decisionImpact.scopeReductionCount)}
        ${metricCard("Added validation", view.decisionImpact.addedValidationCount)}
        ${metricCard("Blocked approval chains", view.decisionImpact.blockedApprovalCount)}
        ${metricCard("Remediation", view.decisionImpact.remediationCount)}
        ${metricCard("Added confidence", view.decisionImpact.addedConfidenceCount)}
        ${metricCard("No meaningful change", view.decisionImpact.noMeaningfulChangeCount)}
      </div>
      ${renderOutcomeDetailTable(view.details.decision, "No decision outcome rows match the current filters.")}
    </section>
    <section class="panel" id="risk">
      <h2>Risk And Gates</h2>
      <p class="muted">Confirmed medium/high values come from the optional local ledger. Release-chain gate blocks are deduped to one most-downstream representative in the summary cards, while practitioner rows still show each stage run.</p>
      ${renderOutcomeSummaryCards(view.summaries.risk)}
      <div class="metrics">
        ${metricCard("Confirmed high", view.risk.confirmedHighCount)}
        ${metricCard("Confirmed medium", view.risk.confirmedMediumCount)}
        ${metricCard("Noisy findings", view.risk.noisyFindingCount)}
        ${metricCard("Blocked approval chains prevented", view.risk.blockedApprovalPreventedCount)}
        ${metricCard("Unresolved risks", view.risk.unresolvedRiskCount)}
      </div>
      ${renderOutcomeDetailTable(view.details.risk, "No risk rows match the current filters.")}
    </section>
    <section class="panel" id="release-benchmark">
      <h2>Release Benchmark</h2>
      <p class="muted">Release benchmarking stays same-agent and same-model across both arms. This section compares release review speed, decision quality, and LLM/API spend without counting external approval wait time or actual deploy side effects.</p>
      <p class="muted">Token totals are measured from local run bundles. Cost is estimated from the local pricing table only when a matching provider/model entry exists.</p>
      ${renderOutcomeSummaryCards(view.summaries.releaseBenchmark)}
      <div class="metrics">
        ${metricCard("Release entries", view.releaseBenchmark.totalEntries)}
        ${metricCard("Comparable pairs", view.releaseBenchmark.comparablePairs)}
        ${metricCard("AgentForge blocked releases", view.releaseBenchmark.arms.find((arm) => arm.arm === "agentforge")?.blockedReleaseCount ?? 0)}
        ${metricCard("Control blocked releases", view.releaseBenchmark.arms.find((arm) => arm.arm === "control")?.blockedReleaseCount ?? 0)}
      </div>
      ${renderReleaseBenchmarkArmTable(view)}
      ${renderOutcomeDetailTable(view.details.releaseBenchmark, "No release benchmark rows match the current filters.")}
    </section>
    <section class="panel" id="evidence">
      <h2>Evidence Hygiene</h2>
      <p class="muted">This shows where evidence is strong, partial, or missing and which gaps recur across workflows.</p>
      ${renderOutcomeSummaryCards(view.summaries.evidence)}
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
      ${renderOutcomeDetailTable(view.details.evidence, "No evidence rows match the current filters.")}
    </section>
    <section class="panel" id="friction">
      <h2>Friction Hotspots</h2>
      ${renderOutcomeSummaryCards(view.summaries.friction)}
      ${
        !view.friction.ledgerAvailable
          ? `<p class="muted">No local benchmark ledger overlays detected. Add <code>.agentops/benchmark-ledger.json</code> to surface override reasons, false positives, and request friction directly in the outcomes page.</p>`
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
      ${renderOutcomeDetailTable(view.details.friction, "No friction rows match the current filters.")}
    </section>
    <section class="panel" id="workflow-chain">
      <h2>Workflow Chain Coverage</h2>
      <p class="muted">Stages below distinguish current state, missing required upstream evidence, and flow segments that are simply not required yet.</p>
      ${renderOutcomeSummaryCards(view.summaries.workflowChain)}
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
      ${renderOutcomeDetailTable(view.details.workflowChain, "No workflow-chain rows match the current filters.")}
    </section>
    <section class="panel" id="configuration-hotspots">
      <h2>Configuration Hotspots</h2>
      <p class="muted">These group runs by profile, policy preset, workflow variant, and explicit agent binding so you can see which control-plane choices correlate with changed decisions or blocked actions.</p>
      ${renderConfigurationHotspots(view.configurationHotspots)}
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

  return layout("AgentForge Visualizer - Outcomes", "outcomes", body);
}

export function renderValueDashboardPage(view: OutcomesDashboardView): string {
  return renderOutcomesDashboardPage(view);
}

export function renderRunComparePage(view: RunComparisonView | undefined, leftRunId?: string, rightRunId?: string): string {
  const body = !view
    ? `
      <section class="panel">
        <h2>Compare Runs</h2>
        <p class="muted">Secondary analysis step for operators. Use this after <a href="/outcomes">Outcomes</a> or <a href="/runs">Runs</a> has already identified the two runs worth comparing.</p>
        <p class="backlinks"><a href="/outcomes">Back to evaluator summary</a> · <a href="/runs">Browse runs</a></p>
        <form class="filters" method="get" action="/runs/compare">
          <label>Left run id <input type="text" name="left" value="${escapeHtml(leftRunId ?? "")}" /></label>
          <label>Right run id <input type="text" name="right" value="${escapeHtml(rightRunId ?? "")}" /></label>
          <button type="submit">Compare</button>
        </form>
      </section>
    `
    : `
      <section class="panel">
        <h2>Compare Runs</h2>
        <p class="muted">Secondary analysis step for operators. Control selections are shown before outcome deltas so configuration changes stay explainable.</p>
        <p class="backlinks"><a href="/outcomes">Back to evaluator summary</a> · <a href="/runs">Browse runs</a></p>
        <form class="filters" method="get" action="/runs/compare">
          <label>Left run id <input type="text" name="left" value="${escapeHtml(view.leftRunId)}" /></label>
          <label>Right run id <input type="text" name="right" value="${escapeHtml(view.rightRunId)}" /></label>
          <button type="submit">Compare</button>
        </form>
        <div class="metrics">
          ${metricCard("Findings delta", view.outcomeChanges.findingsDelta)}
          ${metricCard("Blocked actions delta", view.outcomeChanges.blockedActionsDelta)}
          ${metricCard("Control changes", view.controlChanges.length)}
          ${metricCard("Node changes", view.executionChanges.nodeChanges.length)}
        </div>
      </section>
      <section class="grid">
        <section class="panel">
          <h3>Input And Control Changes</h3>
          ${
            view.controlChanges.length === 0
              ? `<p class="muted">No control selections changed.</p>`
              : `<ul>${view.controlChanges.map((change) => `<li><strong>${escapeHtml(change.field)}</strong>: <code>${escapeHtml(JSON.stringify(change.left) ?? "null")}</code> -> <code>${escapeHtml(JSON.stringify(change.right) ?? "null")}</code></li>`).join("")}</ul>`
          }
        </section>
        <section class="panel">
          <h3>Execution Changes</h3>
          ${
            view.executionChanges.nodeChanges.length === 0
              ? `<p class="muted">No node-agent mapping changes recorded.</p>`
              : `<ul>${view.executionChanges.nodeChanges.map((change) => `<li><strong>${escapeHtml(change.nodeId)}</strong>: ${escapeHtml(change.leftAgent ?? "none")} -> ${escapeHtml(change.rightAgent ?? "none")}</li>`).join("")}</ul>`
          }
        </section>
      </section>
      <section class="grid">
        <section class="panel">
          <h3>Left Run</h3>
          ${view.left ? `<p><a href="/runs/${encodeURIComponent(view.left.runId)}">${escapeHtml(view.left.runId)}</a> · ${escapeHtml(view.left.workflow)}</p><p class="muted">${renderConfigurationLinks(view.left.workflow)}</p>` : `<p class="muted">Unavailable.</p>`}
        </section>
        <section class="panel">
          <h3>Right Run</h3>
          ${view.right ? `<p><a href="/runs/${encodeURIComponent(view.right.runId)}">${escapeHtml(view.right.runId)}</a> · ${escapeHtml(view.right.workflow)}</p><p class="muted">${renderConfigurationLinks(view.right.workflow)}</p>` : `<p class="muted">Unavailable.</p>`}
        </section>
      </section>
    `;

  return layout("AgentForge Visualizer - Compare", "compare", body);
}

export function renderConfigurePage(options: {
  workflow?: string;
  target?: string;
  availableWorkflows: readonly string[];
  editingEnabled: boolean;
}): string {
  const target = options.target ?? "request";
  const bootstrap = JSON.stringify({
    workflow: options.workflow ?? "",
    target,
    editingEnabled: options.editingEnabled
  }).replaceAll("<", "\\u003c");
  const workflowOptions = options.availableWorkflows
    .map((workflow) => `<option value="${escapeHtml(workflow)}"${workflow === options.workflow ? " selected" : ""}>${escapeHtml(workflow)}</option>`)
    .join("");
  const targetOptions = ["request", "workflow-control", "policy-presets", "defaults", "repo-fit"]
    .map((targetOption) => `<option value="${escapeHtml(targetOption)}"${targetOption === target ? " selected" : ""}>${escapeHtml(targetOption)}</option>`)
    .join("");
  const body = `
    <section class="panel">
      <h2>Configure</h2>
      <p class="muted">Configuration management is YAML-first. Repo documents stay canonical and <code>agentforge config validate</code> remains the safety path; this browser editor is a supported structured authoring layer over those same files.</p>
      <form class="filters" method="get" action="/configure">
        <label>Workflow
          <select name="workflow" id="configure-workflow">
            <option value="">select</option>
            ${workflowOptions}
          </select>
        </label>
        <label>Target
          <select name="target" id="configure-target">
            ${targetOptions}
          </select>
        </label>
        <button type="submit">Load</button>
      </form>
      <p class="muted">Default path: use the structured editor to understand what each control does, preview the effective resolution, and save only after validation. Advanced YAML remains available for power users and debugging.</p>
    </section>
    <section class="panel">
      <div class="configure-summary-grid">
        ${metricCard("Workflow", options.workflow ?? "select a workflow")}
        ${metricCard("Target", target)}
        ${stackedMetricCard("Editing", options.editingEnabled ? "enabled" : "disabled", options.editingEnabled ? "Preview and save still require validation and approval." : "This repository has explicitly disabled browser config editing. Use visualizer.experimental_config_editing: false only as a temporary compatibility override.")}
        ${stackedMetricCard("Canonical path", ".agentops/*.yaml", "Structured edits render back to canonical YAML before preview or save.")}
      </div>
      <div id="configure-intro" class="panel panel-subtle">
        <strong>Structured editor</strong>
        <p class="muted">Loading the target-aware form surface for this document.</p>
      </div>
    </section>
    <section class="panel stack">
      <div class="row between">
        <div>
          <h3>Structured Editor</h3>
          <p class="muted">Forms and selectors are the default authoring path. Use <strong>View YAML</strong> only when you need to inspect or override the rendered canonical document directly.</p>
        </div>
        <span class="badge ${options.editingEnabled ? "badge-complete" : "badge-missing"}">${options.editingEnabled ? "Supported editing enabled" : "Editing disabled"}</span>
      </div>
      <div id="configure-status" class="panel panel-subtle">
        <strong>Loading</strong>
        <p class="muted">Fetching the CLI-owned editor model for this target.</p>
      </div>
      <div id="configure-structured-editor" class="stack"></div>
    </section>
    <section class="panel stack">
      <div class="row between">
        <div>
          <h3>Preview And Save</h3>
          <p class="muted">${options.editingEnabled ? "Semantic preview appears before the raw diff. Save remains approval-gated and only writes the allowlisted YAML files." : "Preview and save are disabled for this repository. Use direct YAML edits plus agentforge config validate if you need to change control documents today."}</p>
        </div>
        <div class="row">
          ${options.editingEnabled ? `<button type="button" id="configure-preview-button">Preview Changes</button>
          <button type="button" id="configure-save-button">Approve And Save</button>` : ""}
        </div>
      </div>
      <div id="configure-semantic" class="stack">
        <div class="panel panel-subtle">
          <strong>No preview yet</strong>
          <p class="muted">Preview the current structured selections to see the effective run summary, validation result, and policy posture before saving.</p>
        </div>
      </div>
      <pre id="configure-preview-summary">No preview generated yet.</pre>
      <pre id="configure-preview-diff">No preview generated yet.</pre>
      <details class="configure-advanced" id="configure-advanced-panel">
        <summary>View YAML (Advanced)</summary>
        <p class="muted">This is the canonical document that the structured editor renders. Use it for trust, debugging, or deliberate power-user overrides. Manual YAML editing does not bypass validation, preview hashing, or approval-gated save rules.</p>
        <textarea id="configure-raw-yaml" rows="24"${options.editingEnabled ? "" : " readonly"}></textarea>
      </details>
    </section>
    <script>
      (function () {
        const bootstrap = ${bootstrap};
        const intro = document.getElementById("configure-intro");
        const statusBox = document.getElementById("configure-status");
        const editorRoot = document.getElementById("configure-structured-editor");
        const semanticRoot = document.getElementById("configure-semantic");
        const previewSummary = document.getElementById("configure-preview-summary");
        const previewDiff = document.getElementById("configure-preview-diff");
        const rawYaml = document.getElementById("configure-raw-yaml");
        const previewButton = document.getElementById("configure-preview-button");
        const saveButton = document.getElementById("configure-save-button");
        const advancedPanel = document.getElementById("configure-advanced-panel");

        let model = undefined;
        let state = undefined;
        let rawDirty = false;
        let lastRenderedDraft = "";
        let lastPreviewHash = "";
        let activePresetIndex = 0;

        function escapeHtml(value) {
          return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
        }

        function clone(value) {
          return JSON.parse(JSON.stringify(value));
        }

        function postJson(url, body) {
          return fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body)
          }).then(async function (response) {
            const json = await response.json();
            if (!response.ok) {
              throw new Error(json.error || "Request failed");
            }
            return json;
          });
        }

        function getJson(url) {
          return fetch(url).then(async function (response) {
            const json = await response.json();
            if (!response.ok) {
              throw new Error(json.error || "Request failed");
            }
            return json;
          });
        }

        function targetRequiresWorkflow(target) {
          return target === "request" || target === "workflow-control";
        }

        function toLines(values) {
          return Array.isArray(values) ? values.join("\\n") : "";
        }

        function fromLines(value) {
          return String(value || "")
            .split(/\\r?\\n/)
            .map(function (entry) { return entry.trim(); })
            .filter(function (entry) { return entry.length > 0; });
        }

        function optionMarkup(options, selectedValue, includeBlank, blankLabel) {
          const values = [];
          if (includeBlank) {
            values.push('<option value="">' + escapeHtml(blankLabel || "select") + '</option>');
          }
          (options || []).forEach(function (option) {
            const selected = option.value === selectedValue ? " selected" : "";
            values.push('<option value="' + escapeHtml(option.value) + '"' + selected + ">" + escapeHtml(option.label) + "</option>");
          });
          return values.join("");
        }

        function checkboxGroupMarkup(options, selectedValues, dataAttrs) {
          const selected = new Set(selectedValues || []);
          if (!options || options.length === 0) {
            return '<p class="muted">No bounded options are available for this section.</p>';
          }
          return '<div class="configure-checkbox-list">' + options.map(function (option) {
            const checked = selected.has(option.value) ? " checked" : "";
            return '<label class="configure-checkbox"><input type="checkbox" value="' + escapeHtml(option.value) + '"' + dataAttrs + checked + " /> <span>" + escapeHtml(option.label) + "</span></label>";
          }).join("") + "</div>";
        }

        function codeHint(text) {
          return text ? '<div class="configure-help">' + escapeHtml(text) + "</div>" : "";
        }

        function renderField(field, sectionKey, indexes) {
          const baseAttrs = ' data-section="' + sectionKey + '" data-field-index="' + indexes.fieldIndex + '"';
          const help = codeHint(field.helpText);

          if (field.input === "textarea") {
            return '<label class="configure-field"><span>' + escapeHtml(field.label) + (field.required ? ' <strong>*</strong>' : "") + '</span><textarea rows="5"' + baseAttrs + ' data-input="text">' + escapeHtml(field.value || "") + '</textarea>' + help + "</label>";
          }

          if (field.input === "select") {
            return '<label class="configure-field"><span>' + escapeHtml(field.label) + (field.required ? ' <strong>*</strong>' : "") + '</span><select' + baseAttrs + ' data-input="select">' + optionMarkup(field.options || [], field.value || "", !field.required, field.required ? undefined : "none") + '</select>' + help + "</label>";
          }

          if (field.input === "string-array" || field.input === "path-array") {
            return '<label class="configure-field"><span>' + escapeHtml(field.label) + (field.required ? ' <strong>*</strong>' : "") + '</span><textarea rows="4"' + baseAttrs + ' data-input="lines">' + escapeHtml(toLines(field.value)) + '</textarea><small class="muted">One value per line.' + (field.input === "path-array" ? " Use repo-relative paths or refs when possible." : "") + '</small>' + help + "</label>";
          }

          if (field.input === "name-version-array") {
            const rows = Array.isArray(field.value) && field.value.length > 0 ? field.value : [{ name: "", version: "" }];
            return '<div class="configure-field"><div class="row between"><span>' + escapeHtml(field.label) + (field.required ? ' <strong>*</strong>' : "") + '</span><button type="button" class="secondary" data-action="add-name-version-row" data-field-index="' + indexes.fieldIndex + '">Add target</button></div><div class="stack">' + rows.map(function (row, rowIndex) {
              return '<div class="configure-pair-row"><input type="text" placeholder="package or artifact name" value="' + escapeHtml(row.name || "") + '" data-section="' + sectionKey + '" data-field-index="' + indexes.fieldIndex + '" data-row-index="' + rowIndex + '" data-pair-key="name" /><input type="text" placeholder="version or tag" value="' + escapeHtml(row.version || "") + '" data-section="' + sectionKey + '" data-field-index="' + indexes.fieldIndex + '" data-row-index="' + rowIndex + '" data-pair-key="version" /><button type="button" class="secondary" data-action="remove-name-version-row" data-field-index="' + indexes.fieldIndex + '" data-row-index="' + rowIndex + '">Remove</button></div>';
            }).join("") + "</div>" + help + "</div>";
          }

          if (field.input === "json") {
            return '<label class="configure-field"><span>' + escapeHtml(field.label) + '</span><textarea rows="6"' + baseAttrs + ' data-input="json">' + escapeHtml(field.value || "") + '</textarea><small class="muted">Structured JSON for advanced field patches or options.</small>' + help + "</label>";
          }

          return '<label class="configure-field"><span>' + escapeHtml(field.label) + (field.required ? ' <strong>*</strong>' : "") + '</span><input type="text"' + baseAttrs + ' data-input="text" value="' + escapeHtml(field.value || "") + '" />' + help + "</label>";
        }

        function setIntro() {
          if (!model) {
            return;
          }
          intro.innerHTML = '<strong>' + escapeHtml(model.title) + '</strong><p class="muted">' + escapeHtml(model.intro) + '</p><p class="muted">Next step: ' + escapeHtml(model.nextStep) + '</p><p class="muted">Canonical document: <code>' + escapeHtml(model.relativePath) + '</code></p>';
        }

        function setStatus(title, detail, warning) {
          statusBox.innerHTML = '<strong>' + escapeHtml(title) + '</strong><p class="' + (warning ? "warning" : "muted") + '">' + escapeHtml(detail) + "</p>";
        }

        function currentRequestRenderState() {
          const bindingSelections = {};
          (state.agentBindings || []).forEach(function (binding) {
            if (binding.selectedAgent) {
              bindingSelections[binding.key] = binding.selectedAgent;
            }
          });
          return {
            meta: {
              profile: state.meta.profile,
              policyPreset: state.meta.policyPreset || undefined,
              workflowVariant: state.meta.workflowVariant,
              agentBindings: bindingSelections
            },
            fields: state.fields
          };
        }

        function currentStateForRender() {
          if (!state) {
            return {};
          }
          if (model.target === "request") {
            return currentRequestRenderState();
          }
          if (model.target === "policy-presets") {
            return { presets: state.presets };
          }
          if (model.target === "defaults") {
            return { workflows: state.workflows };
          }
          if (model.target === "repo-fit") {
            return {
              starterProfile: state.starterProfile,
              structureFields: state.structureFields,
              expectationFields: state.expectationFields,
              conventionFields: state.conventionFields
            };
          }
          return state;
        }

        function buildSemanticSummary(result) {
          const sections = [];
          if (result.semantic) {
            const semantic = result.semantic;
            sections.push('<div class="panel panel-subtle"><h4>Effective run summary</h4><div class="configure-summary-grid">'
              + '<div class="metric"><div class="metric-label">Workflow</div><div class="metric-value">' + escapeHtml(semantic.workflow || model.workflow || "n/a") + '</div></div>'
              + '<div class="metric"><div class="metric-label">Profile</div><div class="metric-value">' + escapeHtml(semantic.selectedProfile || "default") + '</div></div>'
              + '<div class="metric"><div class="metric-label">Policy preset</div><div class="metric-value">' + escapeHtml(semantic.selectedPolicyPreset || "default") + '</div></div>'
              + '<div class="metric"><div class="metric-label">Variant</div><div class="metric-value">' + escapeHtml(semantic.selectedWorkflowVariant || "standard") + '</div></div>'
              + '</div><div class="meta-grid">'
              + '<div><dt>Disabled nodes</dt><dd>' + escapeHtml((semantic.disabledNodes || []).join(", ") || "none") + '</dd></div>'
              + '<div><dt>Node agents</dt><dd>' + escapeHtml(Object.entries(semantic.nodeAgents || {}).map(function (entry) { return entry[0] + "=" + entry[1]; }).join(", ") || "none") + '</dd></div>'
              + '<div><dt>Policy posture</dt><dd>' + escapeHtml("execution=" + semantic.policySummary.executionMode + ", modelAccess=" + semantic.policySummary.modelAccess + ", network=" + semantic.policySummary.network + ", writes=" + semantic.policySummary.writes) + '</dd></div>'
              + '<div><dt>Denied tools</dt><dd>' + escapeHtml((semantic.policySummary.deniedTools || []).join(", ") || "none") + '</dd></div>'
              + '<div><dt>Approval tools</dt><dd>' + escapeHtml((semantic.policySummary.approvalTools || []).join(", ") || "none") + '</dd></div>'
              + '</div></div>');
          }

          if (result.validation) {
            sections.push('<div class="panel ' + (result.validation.valid ? "panel-subtle" : "panel-warning") + '"><h4>Validation</h4><p class="' + (result.validation.valid ? "muted" : "warning") + '">' + escapeHtml(result.validation.valid ? "Passed" : "Failed") + '</p>' + ((result.validation.errors || []).length ? '<ul>' + result.validation.errors.map(function (error) { return '<li>' + escapeHtml(error) + '</li>'; }).join("") + '</ul>' : '<p class="muted">No validation errors.</p>') + '</div>');
          }

          semanticRoot.innerHTML = sections.join("") || '<div class="panel panel-subtle"><strong>No semantic data</strong><p class="muted">Preview this target to inspect the effective resolution.</p></div>';
        }

        async function renderDraftFromStructuredState() {
          const result = await postJson("/api/config/render", {
            workflow: bootstrap.workflow || undefined,
            target: bootstrap.target,
            state: currentStateForRender()
          });
          lastRenderedDraft = result.draft;
          if (!rawDirty) {
            rawYaml.value = result.draft;
          }
          return result.draft;
        }

        function bindingOptionsForNodes(nodeIds) {
          const values = new Map();
          (nodeIds || []).forEach(function (nodeId) {
            ((model.workflowControl && model.workflowControl.nodeAgentOptions && model.workflowControl.nodeAgentOptions[nodeId]) || []).forEach(function (option) {
              values.set(option.value, option);
            });
          });
          return Array.from(values.values()).sort(function (left, right) {
            return left.label.localeCompare(right.label);
          });
        }

        function buildInitialState(editorModel) {
          if (editorModel.target === "request") {
            return {
              meta: {
                profile: editorModel.request.selectedProfile,
                policyPreset: editorModel.request.selectedPolicyPreset || "",
                workflowVariant: editorModel.request.selectedWorkflowVariant,
                agentBindings: {}
              },
              fields: clone(editorModel.request.fields),
              agentBindings: clone(editorModel.request.agentBindings)
            };
          }

          if (editorModel.target === "workflow-control") {
            return {
              profiles: clone(editorModel.workflowControl.profiles),
              fieldMetadata: clone(editorModel.workflowControl.fieldMetadata),
              workflowVariants: clone(editorModel.workflowControl.workflowVariants),
              allowedPolicyPresets: clone(editorModel.workflowControl.allowedPolicyPresets),
              agentBindings: clone(editorModel.workflowControl.agentBindings)
            };
          }

          if (editorModel.target === "policy-presets") {
            return {
              presets: clone(editorModel.policyPresets.presets)
            };
          }

          if (editorModel.target === "repo-fit") {
            return {
              starterProfile: {
                recommendedProfileId: editorModel.repoFit.recommendedProfileId || "",
                selectedProfileId: editorModel.repoFit.selectedProfileId || "none",
                adoption: editorModel.repoFit.adoption || "none"
              },
              structureFields: clone(editorModel.repoFit.structureFields),
              expectationFields: clone(editorModel.repoFit.expectationFields),
              conventionFields: clone(editorModel.repoFit.conventionFields),
              comparisonNotes: clone(editorModel.repoFit.comparisonNotes || []),
              inferredFields: clone(editorModel.repoFit.inferredFields || []),
              confirmedFields: clone(editorModel.repoFit.confirmedFields || []),
              unresolvedFields: clone(editorModel.repoFit.unresolvedFields || [])
            };
          }

          return {
            workflows: clone(editorModel.defaults.workflows)
          };
        }

        function renderValidationNotice(messages) {
          if (!messages || messages.length === 0) {
            return "";
          }
          return '<div class="panel panel-warning"><strong>Check before preview</strong><ul>' + messages.map(function (message) {
            return '<li>' + escapeHtml(message) + '</li>';
          }).join("") + "</ul></div>";
        }

        function requestLocalWarnings() {
          return (state.fields || []).flatMap(function (field) {
            if (!field.required) {
              return [];
            }
            if (field.input === "string-array" || field.input === "path-array") {
              return Array.isArray(field.value) && field.value.length > 0 ? [] : [field.label + " is required."];
            }
            if (field.input === "name-version-array") {
              return Array.isArray(field.value) && field.value.some(function (entry) { return (entry.name || "").trim().length > 0 || (entry.version || "").trim().length > 0; }) ? [] : [field.label + " needs at least one entry."];
            }
            return String(field.value || "").trim().length > 0 ? [] : [field.label + " is required."];
          });
        }

        function workflowControlLocalWarnings() {
          const profileNames = new Set();
          const variantNames = new Set();
          const bindingNames = new Set();
          const messages = {
            profiles: [],
            fieldMetadata: [],
            variants: [],
            bindings: []
          };

          (state.profiles || []).forEach(function (profile, index) {
            const name = String(profile.name || "").trim();
            if (!name) {
              messages.profiles.push("Profile " + (index + 1) + " is missing a name.");
            } else if (profileNames.has(name)) {
              messages.profiles.push("Profile " + name + " is duplicated.");
            } else {
              profileNames.add(name);
            }
          });

          (state.fieldMetadata || []).forEach(function (field, index) {
            if (!String(field.path || "").trim()) {
              messages.fieldMetadata.push("Field metadata row " + (index + 1) + " is missing a path.");
            }
            if (!String(field.label || "").trim()) {
              messages.fieldMetadata.push("Field metadata row " + (index + 1) + " is missing a label.");
            }
          });

          (state.workflowVariants || []).forEach(function (variant, index) {
            const name = String(variant.name || "").trim();
            if (!name) {
              messages.variants.push("Variant " + (index + 1) + " is missing a name.");
            } else if (variantNames.has(name)) {
              messages.variants.push("Variant " + name + " is duplicated.");
            } else {
              variantNames.add(name);
            }
          });

          (state.agentBindings || []).forEach(function (binding, index) {
            const name = String(binding.name || "").trim();
            if (!name) {
              messages.bindings.push("Binding " + (index + 1) + " is missing a name.");
            } else if (bindingNames.has(name)) {
              messages.bindings.push("Binding " + name + " is duplicated.");
            } else {
              bindingNames.add(name);
            }
            if (!Array.isArray(binding.nodeIds) || binding.nodeIds.length === 0) {
              messages.bindings.push((name || ("Binding " + (index + 1))) + " must target at least one node.");
            }
            if (!Array.isArray(binding.allowedAgents) || binding.allowedAgents.length === 0) {
              messages.bindings.push((name || ("Binding " + (index + 1))) + " must allow at least one agent.");
            }
          });

          return messages;
        }

        function policyPresetLocalWarnings(activePreset) {
          const warnings = [];
          const name = String(activePreset.name || "").trim();
          if (!name) {
            warnings.push("The active preset needs a name.");
          }
          (activePreset.tools || []).forEach(function (tool, index) {
            if (!String(tool.toolName || "").trim() || !String(tool.effect || "").trim()) {
              warnings.push("Tool override " + (index + 1) + " needs both a tool and an effect.");
            }
          });
          return warnings;
        }

        function defaultsLocalWarnings() {
          return (state.workflows || []).flatMap(function (workflow) {
            const warnings = [];
            if (!String(workflow.profile || "").trim()) {
              warnings.push(workflow.workflow + " has no default profile.");
            }
            if (!String(workflow.workflowVariant || "").trim()) {
              warnings.push(workflow.workflow + " has no default workflow variant.");
            }
            return warnings;
          });
        }

        function repoFitLocalWarnings() {
          const warnings = [];
          const selectedProfileId = String(state.starterProfile && state.starterProfile.selectedProfileId || "").trim();
          const adoption = String(state.starterProfile && state.starterProfile.adoption || "none").trim();
          const sourceRootsField = (state.structureFields || []).find(function (field) { return field.key === "sourceRoots"; });
          const validationCommandsField = (state.expectationFields || []).find(function (field) { return field.key === "validationCommands"; });

          if (!selectedProfileId || selectedProfileId === "none") {
            warnings.push("No AgentForge starter profile is selected. That is valid, but the contract will not record any opinionated overlay.");
          }
          if ((selectedProfileId === "none" || !selectedProfileId) && adoption !== "none") {
            warnings.push("Starter profile adoption should stay 'none' until a profile is selected.");
          }
          if (!Array.isArray(sourceRootsField && sourceRootsField.value) || (sourceRootsField && sourceRootsField.value || []).length === 0) {
            warnings.push("Source roots are still empty. Add the main implementation roots so workflows can reason about repo boundaries.");
          }
          if (!Array.isArray(validationCommandsField && validationCommandsField.value) || (validationCommandsField && validationCommandsField.value || []).length === 0) {
            warnings.push("Validation commands are empty. This leaves implementation and review workflows without declared evidence expectations.");
          }

          return warnings;
        }

        function renderRequestEditor() {
          const request = model.request;
          const profileRule = (request.profileRules || []).find(function (rule) { return rule.profile === state.meta.profile; });
          const warnings = requestLocalWarnings();
          const agentBindings = (state.agentBindings || []).map(function (binding, bindingIndex) {
            return '<article class="panel panel-subtle"><div class="row between"><strong>' + escapeHtml(binding.label) + '</strong><span class="chip">' + escapeHtml((binding.nodeIds || []).join(", ")) + '</span></div>'
              + (binding.description ? '<p class="muted">' + escapeHtml(binding.description) + '</p>' : "")
              + '<label class="configure-field"><span>Assigned agent</span><select data-request-binding-index="' + bindingIndex + '">' + optionMarkup(binding.options || [], binding.selectedAgent || "", true, "inherit default") + '</select></label></article>';
          }).join("");

          return '<section class="configure-section">' + renderValidationNotice(warnings) + '<h4>Execution selectors</h4><p class="muted">Choose the profile, preset, workflow variant, and agent bindings that shape this run. These selectors become the request meta block in canonical YAML.</p><div class="grid">'
            + '<label class="configure-field"><span>Profile</span><select id="request-profile">' + optionMarkup(request.profileOptions, state.meta.profile, false) + '</select></label>'
            + '<label class="configure-field"><span>Policy preset</span><select id="request-policy-preset">' + optionMarkup(request.policyPresetOptions, state.meta.policyPreset, true, "inherit default") + '</select></label>'
            + '<label class="configure-field"><span>Workflow variant</span><select id="request-workflow-variant">' + optionMarkup(request.workflowVariantOptions, state.meta.workflowVariant, false) + '</select></label>'
            + '</div>'
            + '<div class="panel panel-subtle"><strong>Profile guardrails</strong><p class="muted">Allowed policy presets: ' + escapeHtml((profileRule && profileRule.allowedPolicyPresets || []).join(", ") || "default") + '</p><p class="muted">Allowed workflow variants: ' + escapeHtml((profileRule && profileRule.allowedWorkflowVariants || []).join(", ") || "standard") + '</p></div>'
            + (agentBindings ? '<div class="stack"><h4>Agent bindings</h4>' + agentBindings + '</div>' : "")
            + '<div class="stack"><h4>Request content</h4>' + state.fields.map(function (field, fieldIndex) {
              return renderField(field, "request", { fieldIndex: fieldIndex });
            }).join("") + '</div></section>';
        }

        function renderWorkflowControlEditor() {
          const control = model.workflowControl;
          const warnings = workflowControlLocalWarnings();
          const profilesMarkup = (state.profiles || []).map(function (profile, profileIndex) {
            return '<article class="panel panel-subtle"><div class="row between"><h4>Profile ' + escapeHtml(profile.name || ("profile-" + (profileIndex + 1))) + '</h4><button type="button" class="secondary" data-action="remove-profile" data-profile-index="' + profileIndex + '">Remove</button></div>'
              + '<div class="grid">'
              + '<label class="configure-field"><span>Name</span><input type="text" data-profile-index="' + profileIndex + '" data-profile-field="name" value="' + escapeHtml(profile.name || "") + '" /></label>'
              + '<label class="configure-field"><span>Description</span><input type="text" data-profile-index="' + profileIndex + '" data-profile-field="description" value="' + escapeHtml(profile.description || "") + '" /></label>'
              + '</div>'
              + '<div><span class="configure-label">Allowed policy presets</span>' + checkboxGroupMarkup(control.policyPresetOptions || [], profile.allowedPolicyPresets || [], ' data-profile-index="' + profileIndex + '" data-profile-multi="allowedPolicyPresets"') + '</div>'
              + '<div><span class="configure-label">Allowed workflow variants</span>' + checkboxGroupMarkup(control.workflowVariants.map(function (variant) { return { label: variant.name, value: variant.name }; }), profile.allowedWorkflowVariants || [], ' data-profile-index="' + profileIndex + '" data-profile-multi="allowedWorkflowVariants"') + '</div>'
              + '<div class="stack"><strong>Request patch fields</strong>' + (profile.requestFields || []).map(function (field, fieldIndex) {
                return renderField(field, "profile-request-field", { fieldIndex: fieldIndex }) .replaceAll('data-section="profile-request-field"', 'data-section="profile-request-field" data-profile-index="' + profileIndex + '"');
              }).join("") + '</div></article>';
          }).join("");

          const fieldMetadataMarkup = (state.fieldMetadata || []).map(function (field, fieldIndex) {
            return '<article class="panel panel-subtle"><div class="row between"><strong>' + escapeHtml(field.path || ("field-" + (fieldIndex + 1))) + '</strong><button type="button" class="secondary" data-action="remove-field-metadata" data-field-index="' + fieldIndex + '">Remove</button></div>'
              + '<div class="grid">'
              + '<label class="configure-field"><span>Path</span><input type="text" data-field-metadata-index="' + fieldIndex + '" data-field-metadata-key="path" value="' + escapeHtml(field.path || "") + '" /></label>'
              + '<label class="configure-field"><span>Label</span><input type="text" data-field-metadata-index="' + fieldIndex + '" data-field-metadata-key="label" value="' + escapeHtml(field.label || "") + '" /></label>'
              + '<label class="configure-field"><span>Input type</span><select data-field-metadata-index="' + fieldIndex + '" data-field-metadata-key="input">' + optionMarkup([{ label: "text", value: "text" }, { label: "textarea", value: "textarea" }, { label: "string-array", value: "string-array" }, { label: "path-array", value: "path-array" }, { label: "select", value: "select" }, { label: "name-version-array", value: "name-version-array" }, { label: "json", value: "json" }], field.input || "text", false) + '</select></label>'
              + '<label class="configure-field"><span>Required</span><select data-field-metadata-index="' + fieldIndex + '" data-field-metadata-key="required"><option value="true"' + (field.required ? " selected" : "") + '>true</option><option value="false"' + (!field.required ? " selected" : "") + '>false</option></select></label>'
              + '</div>'
              + '<label class="configure-field"><span>Help text</span><input type="text" data-field-metadata-index="' + fieldIndex + '" data-field-metadata-key="helpText" value="' + escapeHtml(field.helpText || "") + '" /></label>'
              + '<label class="configure-field"><span>Options</span><textarea rows="3" data-field-metadata-index="' + fieldIndex + '" data-field-metadata-key="options">' + escapeHtml((field.options || []).map(function (option) { return option.value + "|" + option.label; }).join("\\n")) + '</textarea><small class="muted">One option per line as value|Label.</small></label></article>';
          }).join("");

          const variantsMarkup = (state.workflowVariants || []).map(function (variant, variantIndex) {
            return '<article class="panel panel-subtle"><div class="row between"><h4>Variant ' + escapeHtml(variant.name || ("variant-" + (variantIndex + 1))) + '</h4><button type="button" class="secondary" data-action="remove-variant" data-variant-index="' + variantIndex + '">Remove</button></div>'
              + '<div class="grid">'
              + '<label class="configure-field"><span>Name</span><input type="text" data-variant-index="' + variantIndex + '" data-variant-key="name" value="' + escapeHtml(variant.name || "") + '" /></label>'
              + '<label class="configure-field"><span>Description</span><input type="text" data-variant-index="' + variantIndex + '" data-variant-key="description" value="' + escapeHtml(variant.description || "") + '" /></label>'
              + '</div>'
              + '<div><span class="configure-label">Disabled nodes</span>' + checkboxGroupMarkup(control.nodeOptions || [], variant.disabledNodes || [], ' data-variant-index="' + variantIndex + '" data-variant-multi="disabledNodes"') + '</div>'
              + '<div class="stack"><div class="row between"><strong>Node agent overrides</strong><button type="button" class="secondary" data-action="add-override" data-variant-index="' + variantIndex + '">Add override</button></div>'
              + ((variant.nodeAgentOverrides || []).length === 0 ? '<p class="muted">No overrides yet.</p>' : (variant.nodeAgentOverrides || []).map(function (override, overrideIndex) {
                const nodeOptions = optionMarkup(control.nodeOptions || [], override.nodeId || "", true, "select node");
                const agentOptions = optionMarkup(((control.nodeAgentOptions || {})[override.nodeId] || []), override.agent || "", true, "select agent");
                return '<div class="configure-pair-row"><select data-variant-index="' + variantIndex + '" data-override-index="' + overrideIndex + '" data-override-key="nodeId">' + nodeOptions + '</select><select data-variant-index="' + variantIndex + '" data-override-index="' + overrideIndex + '" data-override-key="agent">' + agentOptions + '</select><button type="button" class="secondary" data-action="remove-override" data-variant-index="' + variantIndex + '" data-override-index="' + overrideIndex + '">Remove</button></div>';
              }).join("")) + '</div></article>';
          }).join("");

          const agentBindingsMarkup = (state.agentBindings || []).map(function (binding, bindingIndex) {
            const options = bindingOptionsForNodes(binding.nodeIds || []);
            return '<article class="panel panel-subtle"><div class="row between"><h4>Binding ' + escapeHtml(binding.name || ("binding-" + (bindingIndex + 1))) + '</h4><button type="button" class="secondary" data-action="remove-agent-binding" data-binding-index="' + bindingIndex + '">Remove</button></div>'
              + '<div class="grid">'
              + '<label class="configure-field"><span>Name</span><input type="text" data-binding-index="' + bindingIndex + '" data-binding-key="name" value="' + escapeHtml(binding.name || "") + '" /></label>'
              + '<label class="configure-field"><span>Default agent</span><select data-binding-index="' + bindingIndex + '" data-binding-key="defaultAgent">' + optionMarkup(options, binding.defaultAgent || "", true, "inherit none") + '</select></label>'
              + '</div>'
              + '<label class="configure-field"><span>Description</span><input type="text" data-binding-index="' + bindingIndex + '" data-binding-key="description" value="' + escapeHtml(binding.description || "") + '" /></label>'
              + '<div><span class="configure-label">Node ids</span>' + checkboxGroupMarkup(control.nodeOptions || [], binding.nodeIds || [], ' data-binding-index="' + bindingIndex + '" data-binding-multi="nodeIds"') + '</div>'
              + '<div><span class="configure-label">Allowed agents</span>' + checkboxGroupMarkup(options, binding.allowedAgents || [], ' data-binding-index="' + bindingIndex + '" data-binding-multi="allowedAgents"') + '</div></article>';
          }).join("");

          return '<section class="configure-section">'
            + '<details class="configure-section-card" open><summary>Profiles</summary><div class="stack">' + renderValidationNotice(warnings.profiles) + '<div class="row between"><div><h4>Profiles</h4><p class="muted">Profiles define bounded request patches and selector guardrails.</p></div><button type="button" class="secondary" data-action="add-profile">Add profile</button></div>' + profilesMarkup + '</div></details>'
            + '<details class="configure-section-card"><summary>Request Fields</summary><div class="stack">' + renderValidationNotice(warnings.fieldMetadata) + '<div class="row between"><div><h4>Request field metadata</h4><p class="muted">These definitions drive the request form shown for this workflow.</p></div><button type="button" class="secondary" data-action="add-field-metadata">Add field</button></div>' + fieldMetadataMarkup + '<div><h4>Allowed policy presets</h4>' + checkboxGroupMarkup(control.policyPresetOptions || [], state.allowedPolicyPresets || [], ' data-root-multi="allowedPolicyPresets"') + '</div></div></details>'
            + '<details class="configure-section-card"><summary>Variants</summary><div class="stack">' + renderValidationNotice(warnings.variants) + '<div class="row between"><div><h4>Workflow variants</h4><p class="muted">Variants can disable nodes and override node-agent assignments.</p></div><button type="button" class="secondary" data-action="add-variant">Add variant</button></div>' + variantsMarkup + '</div></details>'
            + '<details class="configure-section-card"><summary>Bindings</summary><div class="stack">' + renderValidationNotice(warnings.bindings) + '<div class="row between"><div><h4>Agent bindings</h4><p class="muted">Bindings constrain which approved agents can execute a node or node group.</p></div><button type="button" class="secondary" data-action="add-agent-binding">Add binding</button></div>' + agentBindingsMarkup + '</div></details>'
            + '</section>';
        }

        function renderPolicyPresetEditor() {
          const policy = model.policyPresets;
          const presets = state.presets || [];
          const activePreset = presets[activePresetIndex] || presets[0] || {
            name: "",
            description: "",
            defaults: {},
            blockedPaths: [],
            pluginAllowedTiers: [],
            pluginAllowedSources: [],
            requireReviewed: undefined,
            tools: []
          };
          return '<section class="configure-section">' + renderValidationNotice(policyPresetLocalWarnings(activePreset)) + '<div class="row between"><div><h4>Policy presets</h4><p class="muted">Presets may narrow the base policy only. Use these to define bounded execution postures for requests and profiles.</p></div><div class="row"><button type="button" class="secondary" data-action="add-policy-preset">Add preset</button>' + (presets.length > 0 ? '<button type="button" class="secondary" data-action="remove-policy-preset">Remove preset</button>' : '') + '</div></div>'
            + '<label class="configure-field"><span>Active preset</span><select id="policy-preset-selector">' + optionMarkup(presets.map(function (preset, index) { return { label: preset.name || ("preset-" + (index + 1)), value: String(index) }; }), String(activePresetIndex), false) + '</select></label>'
            + '<div class="grid">'
            + '<label class="configure-field"><span>Name</span><input type="text" id="policy-preset-name" value="' + escapeHtml(activePreset.name || "") + '" /></label>'
            + '<label class="configure-field"><span>Description</span><input type="text" id="policy-preset-description" value="' + escapeHtml(activePreset.description || "") + '" /></label>'
            + '<label class="configure-field"><span>Execution mode</span><select id="policy-default-executionMode">' + optionMarkup(policy.executionModeOptions || [], activePreset.defaults && activePreset.defaults.executionMode || "", true, "inherit base") + '</select></label>'
            + '<label class="configure-field"><span>Model access</span><select id="policy-default-modelAccess"><option value=""' + ((activePreset.defaults && activePreset.defaults.modelAccess) === undefined ? " selected" : "") + '>inherit base</option><option value="true"' + ((activePreset.defaults && activePreset.defaults.modelAccess) === true ? " selected" : "") + '>true</option><option value="false"' + ((activePreset.defaults && activePreset.defaults.modelAccess) === false ? " selected" : "") + '>false</option></select></label>'
            + '<label class="configure-field"><span>Network</span><select id="policy-default-network">' + optionMarkup(policy.permissionOptions || [], activePreset.defaults && activePreset.defaults.network || "", true, "inherit base") + '</select></label>'
            + '<label class="configure-field"><span>Writes</span><select id="policy-default-writes">' + optionMarkup(policy.permissionOptions || [], activePreset.defaults && activePreset.defaults.writes || "", true, "inherit base") + '</select></label>'
            + '</div>'
            + '<label class="configure-field"><span>Blocked paths</span><textarea rows="4" id="policy-blocked-paths">' + escapeHtml(toLines(activePreset.blockedPaths)) + '</textarea><small class="muted">One blocked repo path or glob per line.</small></label>'
            + '<div><span class="configure-label">Allowed plugin tiers</span>' + checkboxGroupMarkup(policy.tierOptions || [], activePreset.pluginAllowedTiers || [], ' data-policy-multi="pluginAllowedTiers"') + '</div>'
            + '<div><span class="configure-label">Allowed plugin sources</span>' + checkboxGroupMarkup(policy.sourceOptions || [], activePreset.pluginAllowedSources || [], ' data-policy-multi="pluginAllowedSources"') + '</div>'
            + '<label class="configure-field"><span>Require reviewed plugins</span><select id="policy-require-reviewed"><option value=""' + (activePreset.requireReviewed === undefined ? " selected" : "") + '>inherit base</option><option value="true"' + (activePreset.requireReviewed === true ? " selected" : "") + '>true</option><option value="false"' + (activePreset.requireReviewed === false ? " selected" : "") + '>false</option></select></label>'
            + '<div class="stack"><div class="row between"><strong>Tool effects</strong><button type="button" class="secondary" data-action="add-policy-tool">Add tool override</button></div>'
            + ((activePreset.tools || []).length === 0 ? '<p class="muted">No tool-specific narrowing rules yet.</p>' : activePreset.tools.map(function (tool, toolIndex) {
              return '<div class="configure-pair-row"><select data-policy-tool-index="' + toolIndex + '" data-policy-tool-key="toolName">' + optionMarkup(policy.availableTools || [], tool.toolName || "", true, "select tool") + '</select><select data-policy-tool-index="' + toolIndex + '" data-policy-tool-key="effect">' + optionMarkup(policy.toolEffectOptions || [], tool.effect || "", true, "select effect") + '</select><button type="button" class="secondary" data-action="remove-policy-tool" data-policy-tool-index="' + toolIndex + '">Remove</button></div>';
            }).join("")) + '</div></section>';
        }

        function renderDefaultsEditor() {
          return '<section class="configure-section">' + renderValidationNotice(defaultsLocalWarnings()) + '<h4>Workflow defaults</h4><p class="muted">Defaults define which profile, preset, and variant are used when a request omits the meta selectors.</p><table class="data-table"><thead><tr><th>Workflow</th><th>Profile</th><th>Policy preset</th><th>Workflow variant</th></tr></thead><tbody>'
            + (state.workflows || []).map(function (workflow, workflowIndex) {
              return '<tr><td><strong>' + escapeHtml(workflow.workflow) + '</strong></td><td><select data-default-index="' + workflowIndex + '" data-default-key="profile">' + optionMarkup(workflow.profileOptions || [], workflow.profile || "", true, "inherit workflow default") + '</select></td><td><select data-default-index="' + workflowIndex + '" data-default-key="policyPreset">' + optionMarkup(workflow.policyPresetOptions || [], workflow.policyPreset || "", true, "inherit default") + '</select></td><td><select data-default-index="' + workflowIndex + '" data-default-key="workflowVariant">' + optionMarkup(workflow.workflowVariantOptions || [], workflow.workflowVariant || "", true, "inherit standard") + '</select></td></tr>';
            }).join("") + '</tbody></table></section>';
        }

        function renderRepoFitEditor() {
          const repoFit = model.repoFit;
          const warnings = repoFitLocalWarnings();
          const renderRepoFields = function (fields, sectionKey) {
            return (fields || []).map(function (field, fieldIndex) {
              return renderField(field, sectionKey, { fieldIndex: fieldIndex });
            }).join("");
          };

          return '<section class="configure-section">'
            + renderValidationNotice(warnings)
            + '<details class="configure-section-card" open><summary>Starter profile</summary><div class="stack">'
            + '<p class="muted">Keep repo conventions first. Use the starter profile only to record whether this repository wants extra AgentForge opinionated guidance layered on top of its own declared structure.</p>'
            + '<div class="grid">'
            + '<label class="configure-field"><span>Recommended profile</span><input type="text" value="' + escapeHtml(repoFit.recommendedProfileId || "none") + '" readonly /></label>'
            + '<label class="configure-field"><span>Selected profile</span><select id="repo-fit-selected-profile">' + optionMarkup(repoFit.profileOptions || [], state.starterProfile.selectedProfileId || "none", false) + '</select></label>'
            + '<label class="configure-field"><span>Adoption</span><select id="repo-fit-adoption">' + optionMarkup(repoFit.adoptionOptions || [], state.starterProfile.adoption || "none", false) + '</select></label>'
            + '</div>'
            + '<div class="panel panel-subtle"><strong>Comparison notes</strong>'
            + ((state.comparisonNotes || []).length > 0 ? '<ul>' + state.comparisonNotes.map(function (note) { return '<li>' + escapeHtml(note) + '</li>'; }).join("") + '</ul>' : '<p class="muted">No opinionated differences are currently recorded.</p>')
            + '</div>'
            + '<div class="meta-grid">'
            + '<div><dt>Inferred fields</dt><dd>' + ((state.inferredFields || []).length > 0 ? state.inferredFields.map(function (field) { return '<span class="chip">' + escapeHtml(field) + '</span>'; }).join("") : "none") + '</dd></div>'
            + '<div><dt>Confirmed fields</dt><dd>' + ((state.confirmedFields || []).length > 0 ? state.confirmedFields.map(function (field) { return '<span class="chip">' + escapeHtml(field) + '</span>'; }).join("") : "none") + '</dd></div>'
            + '<div><dt>Unresolved fields</dt><dd>' + ((state.unresolvedFields || []).length > 0 ? state.unresolvedFields.map(function (field) { return '<span class="chip">' + escapeHtml(field) + '</span>'; }).join("") : "none") + '</dd></div>'
            + '</div></div></details>'
            + '<details class="configure-section-card" open><summary>Structure and boundaries</summary><div class="stack">'
            + '<p class="muted">Describe where code lives, how modules are divided, and which path boundaries matter when workflows reason about this repo.</p>'
            + renderRepoFields(state.structureFields, "repo-fit-structure")
            + '</div></details>'
            + '<details class="configure-section-card"><summary>Validation and evidence</summary><div class="stack">'
            + '<p class="muted">Capture the commands, evidence surfaces, and release or QA expectations that should ground reviews and implementation recommendations.</p>'
            + renderRepoFields(state.expectationFields, "repo-fit-expectations")
            + '</div></details>'
            + '<details class="configure-section-card"><summary>Coding and design conventions</summary><div class="stack">'
            + '<p class="muted">Record the coding style and design patterns the repo prefers so AgentForge can surface mismatches as advisory findings instead of generic suggestions.</p>'
            + renderRepoFields(state.conventionFields, "repo-fit-conventions")
            + '</div></details>'
            + '</section>';
        }

        function renderEditor() {
          if (!model) {
            editorRoot.innerHTML = "";
            return;
          }

          if (model.loadError) {
            editorRoot.innerHTML = '<div class="panel panel-warning"><strong>Document parse warning</strong><p>' + escapeHtml(model.loadError) + '</p><p class="muted">The structured editor is showing the safest recoverable state. Review the raw YAML in Advanced mode before saving.</p></div>';
          } else {
            editorRoot.innerHTML = "";
          }

          let markup = "";
          if (model.target === "request") {
            markup = renderRequestEditor();
          } else if (model.target === "workflow-control") {
            markup = renderWorkflowControlEditor();
          } else if (model.target === "policy-presets") {
            markup = renderPolicyPresetEditor();
          } else if (model.target === "defaults") {
            markup = renderDefaultsEditor();
          } else if (model.target === "repo-fit") {
            markup = renderRepoFitEditor();
          }

          editorRoot.innerHTML += markup;
          bindInputs();
        }

        function toggleArrayValue(array, value, checked) {
          const current = Array.isArray(array) ? array.slice() : [];
          const next = current.filter(function (entry) { return entry !== value; });
          if (checked) {
            next.push(value);
          }
          return Array.from(new Set(next));
        }

        function bindInputs() {
          const requestProfile = document.getElementById("request-profile");
          const requestPolicyPreset = document.getElementById("request-policy-preset");
          const requestWorkflowVariant = document.getElementById("request-workflow-variant");
          const policyPresetSelector = document.getElementById("policy-preset-selector");

          requestProfile && requestProfile.addEventListener("change", function (event) {
            state.meta.profile = event.target.value;
            renderEditor();
          });
          requestPolicyPreset && requestPolicyPreset.addEventListener("change", function (event) {
            state.meta.policyPreset = event.target.value;
          });
          requestWorkflowVariant && requestWorkflowVariant.addEventListener("change", function (event) {
            state.meta.workflowVariant = event.target.value;
          });
          policyPresetSelector && policyPresetSelector.addEventListener("change", function (event) {
            activePresetIndex = Number(event.target.value || "0");
            renderEditor();
          });

          editorRoot.querySelectorAll("[data-request-binding-index]").forEach(function (node) {
            node.addEventListener("change", function (event) {
              const index = Number(event.target.dataset.requestBindingIndex);
              state.agentBindings[index].selectedAgent = event.target.value || undefined;
            });
          });

          editorRoot.querySelectorAll("[data-section='request'], [data-section='profile-request-field']").forEach(function (node) {
            node.addEventListener("input", function (event) {
              const fieldIndex = Number(event.target.dataset.fieldIndex);
              const inputType = event.target.dataset.input;
              const profileIndex = event.target.dataset.profileIndex ? Number(event.target.dataset.profileIndex) : undefined;
              const fieldCollection = profileIndex === undefined ? state.fields : state.profiles[profileIndex].requestFields;
              if (inputType === "lines") {
                fieldCollection[fieldIndex].value = fromLines(event.target.value);
              } else if (inputType === "json") {
                fieldCollection[fieldIndex].value = event.target.value;
              } else {
                fieldCollection[fieldIndex].value = event.target.value;
              }
            });
          });

          editorRoot.querySelectorAll("[data-pair-key]").forEach(function (node) {
            node.addEventListener("input", function (event) {
              const fieldIndex = Number(event.target.dataset.fieldIndex);
              const rowIndex = Number(event.target.dataset.rowIndex);
              const key = event.target.dataset.pairKey;
              const collection = state.fields[fieldIndex].value;
              collection[rowIndex][key] = event.target.value;
            });
          });

          editorRoot.querySelectorAll("[data-profile-field]").forEach(function (node) {
            node.addEventListener("input", function (event) {
              const profileIndex = Number(event.target.dataset.profileIndex);
              state.profiles[profileIndex][event.target.dataset.profileField] = event.target.value;
            });
          });

          editorRoot.querySelectorAll("[data-profile-multi]").forEach(function (node) {
            node.addEventListener("change", function (event) {
              const profileIndex = Number(event.target.dataset.profileIndex);
              const key = event.target.dataset.profileMulti;
              state.profiles[profileIndex][key] = toggleArrayValue(state.profiles[profileIndex][key], event.target.value, event.target.checked);
            });
          });

          editorRoot.querySelectorAll("[data-field-metadata-key]").forEach(function (node) {
            node.addEventListener("input", function (event) {
              const index = Number(event.target.dataset.fieldMetadataIndex);
              const key = event.target.dataset.fieldMetadataKey;
              if (key === "required") {
                state.fieldMetadata[index][key] = event.target.value === "true";
              } else if (key === "options") {
                state.fieldMetadata[index][key] = fromLines(event.target.value).map(function (line) {
                  const pieces = line.split("|");
                  const value = (pieces[0] || "").trim();
                  const label = (pieces[1] || pieces[0] || "").trim();
                  return { value: value, label: label };
                }).filter(function (option) { return option.value.length > 0; });
              } else {
                state.fieldMetadata[index][key] = event.target.value;
              }
            });
          });

          editorRoot.querySelectorAll("[data-root-multi]").forEach(function (node) {
            node.addEventListener("change", function (event) {
              const key = event.target.dataset.rootMulti;
              state[key] = toggleArrayValue(state[key], event.target.value, event.target.checked);
            });
          });

          editorRoot.querySelectorAll("[data-variant-key]").forEach(function (node) {
            node.addEventListener("input", function (event) {
              const variantIndex = Number(event.target.dataset.variantIndex);
              state.workflowVariants[variantIndex][event.target.dataset.variantKey] = event.target.value;
            });
          });

          editorRoot.querySelectorAll("[data-variant-multi]").forEach(function (node) {
            node.addEventListener("change", function (event) {
              const variantIndex = Number(event.target.dataset.variantIndex);
              const key = event.target.dataset.variantMulti;
              state.workflowVariants[variantIndex][key] = toggleArrayValue(state.workflowVariants[variantIndex][key], event.target.value, event.target.checked);
            });
          });

          editorRoot.querySelectorAll("[data-override-key]").forEach(function (node) {
            node.addEventListener("change", function (event) {
              const variantIndex = Number(event.target.dataset.variantIndex);
              const overrideIndex = Number(event.target.dataset.overrideIndex);
              const key = event.target.dataset.overrideKey;
              state.workflowVariants[variantIndex].nodeAgentOverrides[overrideIndex][key] = event.target.value;
              if (key === "nodeId") {
                state.workflowVariants[variantIndex].nodeAgentOverrides[overrideIndex].agent = "";
                renderEditor();
              }
            });
          });

          editorRoot.querySelectorAll("[data-binding-key]").forEach(function (node) {
            node.addEventListener(node.tagName === "SELECT" ? "change" : "input", function (event) {
              const bindingIndex = Number(event.target.dataset.bindingIndex);
              state.agentBindings[bindingIndex][event.target.dataset.bindingKey] = event.target.value || undefined;
            });
          });

          editorRoot.querySelectorAll("[data-binding-multi]").forEach(function (node) {
            node.addEventListener("change", function (event) {
              const bindingIndex = Number(event.target.dataset.bindingIndex);
              const key = event.target.dataset.bindingMulti;
              state.agentBindings[bindingIndex][key] = toggleArrayValue(state.agentBindings[bindingIndex][key], event.target.value, event.target.checked);
            });
          });

          const activePreset = state.presets && state.presets[activePresetIndex];
          document.getElementById("policy-preset-name")?.addEventListener("input", function (event) {
            activePreset.name = event.target.value;
          });
          document.getElementById("policy-preset-description")?.addEventListener("input", function (event) {
            activePreset.description = event.target.value;
          });
          ["executionMode", "network", "writes"].forEach(function (key) {
            const node = document.getElementById("policy-default-" + key);
            node && node.addEventListener("change", function (event) {
              activePreset.defaults[key] = event.target.value || undefined;
            });
          });
          document.getElementById("policy-default-modelAccess")?.addEventListener("change", function (event) {
            activePreset.defaults.modelAccess = event.target.value === "" ? undefined : event.target.value === "true";
          });
          document.getElementById("policy-blocked-paths")?.addEventListener("input", function (event) {
            activePreset.blockedPaths = fromLines(event.target.value);
          });
          document.getElementById("policy-require-reviewed")?.addEventListener("change", function (event) {
            activePreset.requireReviewed = event.target.value === "" ? undefined : event.target.value === "true";
          });
          document.getElementById("repo-fit-selected-profile")?.addEventListener("change", function (event) {
            state.starterProfile.selectedProfileId = event.target.value || "none";
            renderEditor();
          });
          document.getElementById("repo-fit-adoption")?.addEventListener("change", function (event) {
            state.starterProfile.adoption = event.target.value || "none";
          });
          editorRoot.querySelectorAll("[data-policy-multi]").forEach(function (node) {
            node.addEventListener("change", function (event) {
              const key = event.target.dataset.policyMulti;
              activePreset[key] = toggleArrayValue(activePreset[key], event.target.value, event.target.checked);
            });
          });
          editorRoot.querySelectorAll("[data-section='repo-fit-structure'], [data-section='repo-fit-expectations'], [data-section='repo-fit-conventions']").forEach(function (node) {
            node.addEventListener("input", function (event) {
              const fieldIndex = Number(event.target.dataset.fieldIndex);
              const inputType = event.target.dataset.input;
              const section = event.target.dataset.section;
              const fieldCollection = section === "repo-fit-structure"
                ? state.structureFields
                : section === "repo-fit-expectations"
                  ? state.expectationFields
                  : state.conventionFields;
              if (inputType === "lines") {
                fieldCollection[fieldIndex].value = fromLines(event.target.value);
              } else {
                fieldCollection[fieldIndex].value = event.target.value;
              }
            });
          });
          editorRoot.querySelectorAll("[data-policy-tool-key]").forEach(function (node) {
            node.addEventListener("change", function (event) {
              const toolIndex = Number(event.target.dataset.policyToolIndex);
              activePreset.tools[toolIndex][event.target.dataset.policyToolKey] = event.target.value;
            });
          });

          editorRoot.querySelectorAll("[data-default-key]").forEach(function (node) {
            node.addEventListener("change", function (event) {
              const index = Number(event.target.dataset.defaultIndex);
              state.workflows[index][event.target.dataset.defaultKey] = event.target.value || undefined;
            });
          });

          editorRoot.querySelectorAll("[data-action]").forEach(function (node) {
            node.addEventListener("click", function (event) {
              const action = event.target.dataset.action;
              if (action === "add-name-version-row") {
                state.fields[Number(event.target.dataset.fieldIndex)].value.push({ name: "", version: "" });
              } else if (action === "remove-name-version-row") {
                state.fields[Number(event.target.dataset.fieldIndex)].value.splice(Number(event.target.dataset.rowIndex), 1);
              } else if (action === "add-profile") {
                state.profiles.push({ name: "", description: "", allowedPolicyPresets: [], allowedWorkflowVariants: [], requestFields: clone(model.workflowControl.requestFieldDefinitions).map(function (field) { return Object.assign({}, field, { value: field.input === "string-array" || field.input === "path-array" ? [] : field.input === "name-version-array" ? [] : "" }); }) });
              } else if (action === "remove-profile") {
                state.profiles.splice(Number(event.target.dataset.profileIndex), 1);
              } else if (action === "add-field-metadata") {
                state.fieldMetadata.push({ path: "", label: "", helpText: "", input: "text", required: false, options: [] });
              } else if (action === "remove-field-metadata") {
                state.fieldMetadata.splice(Number(event.target.dataset.fieldIndex), 1);
              } else if (action === "add-variant") {
                state.workflowVariants.push({ name: "", description: "", disabledNodes: [], nodeAgentOverrides: [] });
              } else if (action === "remove-variant") {
                state.workflowVariants.splice(Number(event.target.dataset.variantIndex), 1);
              } else if (action === "add-override") {
                state.workflowVariants[Number(event.target.dataset.variantIndex)].nodeAgentOverrides.push({ nodeId: "", agent: "" });
              } else if (action === "remove-override") {
                state.workflowVariants[Number(event.target.dataset.variantIndex)].nodeAgentOverrides.splice(Number(event.target.dataset.overrideIndex), 1);
              } else if (action === "add-agent-binding") {
                state.agentBindings.push({ name: "", description: "", nodeIds: [], allowedAgents: [], defaultAgent: "" });
              } else if (action === "remove-agent-binding") {
                state.agentBindings.splice(Number(event.target.dataset.bindingIndex), 1);
              } else if (action === "add-policy-preset") {
                state.presets.push({ name: "", description: "", defaults: {}, blockedPaths: [], pluginAllowedTiers: [], pluginAllowedSources: [], requireReviewed: undefined, tools: [] });
                activePresetIndex = state.presets.length - 1;
              } else if (action === "remove-policy-preset") {
                state.presets.splice(activePresetIndex, 1);
                activePresetIndex = Math.max(0, activePresetIndex - 1);
              } else if (action === "add-policy-tool") {
                state.presets[activePresetIndex].tools.push({ toolName: "", effect: "" });
              } else if (action === "remove-policy-tool") {
                state.presets[activePresetIndex].tools.splice(Number(event.target.dataset.policyToolIndex), 1);
              }
              rawDirty = false;
              renderEditor();
            });
          });
        }

        async function loadModel() {
          if (targetRequiresWorkflow(bootstrap.target) && !bootstrap.workflow) {
            setStatus("Workflow required", "Select a workflow before editing request or workflow-control targets.", true);
            editorRoot.innerHTML = '<div class="panel panel-subtle"><p class="muted">Choose a workflow above, then reload this page to see the structured editor for that document.</p></div>';
            rawYaml.value = "";
            return;
          }

          setStatus("Loading editor model", "Fetching the CLI-owned editor model for this target.");
          try {
            const query = new URLSearchParams({
              target: bootstrap.target,
              workflow: bootstrap.workflow || ""
            });
            model = await getJson("/api/config/editor?" + query.toString());
            state = buildInitialState(model);
            activePresetIndex = 0;
            rawDirty = false;
            lastRenderedDraft = model.rawDocument || "";
            lastPreviewHash = "";
            rawYaml.value = model.rawDocument || "";
            setIntro();
            setStatus(model.editingEnabled ? "Structured editing ready" : "Structured editing disabled", model.editingEnabled ? "Preview the effective resolution before saving. YAML stays canonical." : "This repository has explicitly disabled browser config editing. The structured form is still available for inspection and learning.");
            renderEditor();
          } catch (error) {
            setStatus("Failed to load editor", String(error), true);
            editorRoot.innerHTML = '<div class="panel panel-warning"><p>' + escapeHtml(String(error)) + '</p></div>';
          }
        }

        async function draftForPreviewOrSave() {
          if (rawDirty) {
            lastRenderedDraft = rawYaml.value;
            return rawYaml.value;
          }
          return renderDraftFromStructuredState();
        }

        previewButton && previewButton.addEventListener("click", async function () {
          try {
            const draft = await draftForPreviewOrSave();
            const result = await postJson("/api/config/preview", {
              workflow: bootstrap.workflow || undefined,
              target: bootstrap.target,
              draft: draft
            });
            lastPreviewHash = result.previewHash;
            buildSemanticSummary(result);
            previewSummary.textContent = [result.summary, result.validation ? ("Validation: " + (result.validation.valid ? "passed" : "failed")) : ""].filter(Boolean).join("\\n");
            previewDiff.textContent = result.diff || "No textual diff.";
            if (!rawDirty) {
              rawYaml.value = draft;
            }
          } catch (error) {
            previewSummary.textContent = String(error);
            previewDiff.textContent = String(error);
            semanticRoot.innerHTML = '<div class="panel panel-warning"><strong>Preview failed</strong><p>' + escapeHtml(String(error)) + '</p></div>';
          }
        });

        saveButton && saveButton.addEventListener("click", async function () {
          try {
            if (!lastPreviewHash) {
              previewSummary.textContent = "Save blocked until preview completes successfully.";
              previewDiff.textContent = "Run Preview Changes first so the guarded save path has a matching preview hash.";
              return;
            }
            const draft = await draftForPreviewOrSave();
            const result = await postJson("/api/config/save", {
              workflow: bootstrap.workflow || undefined,
              target: bootstrap.target,
              draft: draft,
              previewHash: lastPreviewHash,
              approval: "approve-write"
            });
            rawDirty = false;
            previewSummary.textContent = result.validation && result.validation.valid === false ? "Save rejected by validation." : "Saved " + result.path;
            previewDiff.textContent = result.validation && result.validation.errors && result.validation.errors.length > 0 ? result.validation.errors.join("\\n") : "Saved " + result.path;
            if (!rawDirty) {
              rawYaml.value = draft;
            }
            await loadModel();
          } catch (error) {
            previewSummary.textContent = String(error);
            previewDiff.textContent = String(error);
          }
        });

        rawYaml.addEventListener("input", function () {
          rawDirty = true;
          lastPreviewHash = "";
        });

        advancedPanel.addEventListener("toggle", async function () {
          if (advancedPanel.open && !rawDirty && !rawYaml.value.trim().length) {
            try {
              rawYaml.value = await renderDraftFromStructuredState();
            } catch (error) {
              previewSummary.textContent = String(error);
            }
          }
        });

        loadModel();
      })();
    </script>
  `;

  return layout("AgentForge Visualizer - Configure", "configure", body);
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
textarea {
  width: 100%;
  font: 0.92rem/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: #fff;
  min-height: 20rem;
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
.metric-link {
  color: inherit;
  text-decoration: none;
}
.metric-link:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.1);
}
.metric-label { color: var(--muted); font-size: 0.85rem; }
.metric-value { font-size: 1.2rem; font-weight: 700; margin-top: 0.2rem; }
.metric-detail { color: var(--muted); font-size: 0.82rem; margin-top: 0.3rem; }
.metric-provenance { display: inline-block; margin-top: 0.25rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #35505b; background: #e8f1f4; border: 1px solid #c7dbe2; border-radius: 999px; padding: 0.12rem 0.45rem; }
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
.panel-subtle { background: #f8fbfb; }
.trace-list ul { margin: 0.5rem 0 0 1rem; }
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
.backlinks { margin-top: 1rem; }
.configure-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}
.configure-section {
  display: grid;
  gap: 1rem;
}
.configure-field {
  display: grid;
  gap: 0.4rem;
}
.configure-label {
  display: block;
  font-size: 0.95rem;
  margin-bottom: 0.45rem;
}
.configure-help {
  color: var(--muted);
  font-size: 0.84rem;
}
.configure-checkbox-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}
.configure-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #f8fbfb;
}
.configure-checkbox input {
  margin: 0;
}
.configure-pair-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
}
.configure-advanced summary {
  cursor: pointer;
  font-weight: 600;
}
.configure-section-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.75rem 0.9rem;
  background: #fbfdfd;
}
.configure-section-card summary {
  cursor: pointer;
  font-weight: 700;
}
button.secondary {
  background: #fff;
  color: var(--accent);
  border-color: var(--border);
}
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
@media (max-width: 820px) {
  .topbar,
  .row,
  .between {
    flex-direction: column;
    align-items: stretch;
  }

  .configure-pair-row {
    grid-template-columns: 1fr;
  }
}
`;
}
