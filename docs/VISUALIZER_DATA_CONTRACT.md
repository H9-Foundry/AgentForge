# Visualizer Data Contract

This document defines the visualizer-facing data contract for the first production-ready local AgentForge visualizer release.

Contract version: `1.0.0`

The visualizer is still:

- local-first
- read-only
- backed by local `.agentops/runs/**/bundle.json` files
- optionally overlaid with local `.agentops/benchmark-ledger.json`

It is not a hosted platform contract and it does not require network access.

## Canonical Inputs

The visualizer reads from two local sources:

1. run bundles under `.agentops/runs/**/bundle.json`
2. an optional benchmark ledger at `.agentops/benchmark-ledger.json`

The visualizer must continue to render useful output when the benchmark ledger is absent.

## Run Bundle Contract

The visualizer depends on these run-bundle fields when present:

- `runId`
- `workflow`
- `status`
- `startedAt`
- `finishedAt`
- `entries`
- `findings`
- `blockedPlugins`
- `lifecycleArtifacts`
- `artifactPaths`
- `usage`

### Usage Fields

When provider-backed reasoning emits measured usage, the run bundle may include:

- run-level aggregate usage
  - `totalInputTokens`
  - `totalOutputTokens`
  - `totalTokens`
  - `totalRequests`
  - `totalEstimatedCostUsd`
  - `costStatus`
  - `byModel`
  - `byNode`
- per-model pricing provenance
  - `source`
  - `version`
  - `effectiveDate`
  - `currency`
  - `inputCostPerMillionTokensUsd`
  - `outputCostPerMillionTokensUsd`

Compatibility rules:

- if `usage` is missing, the visualizer must still render runs and outcomes cleanly
- if token counts are present but cost is unavailable, the visualizer must show measured tokens and mark cost unavailable
- if older bundles lack outcomes-era fields, the visualizer must fall back to inferred summaries or generic payload rendering instead of failing

## Benchmark Ledger Contract

The benchmark ledger is an optional adjudication overlay, not the primary run store.

Stable entry fields for production use include:

- task identity and routing
  - `taskId`
  - `taskLink`
  - `source`
  - `taskType`
  - `benchmarkCategory`
  - `arm`
  - `runId`
  - `workflow`
  - `agent`
- decision impact
  - `summary`
  - `decisionOutcome`
  - `agentforgeChangedDecision`
  - `decisionImpactReason`
- release benchmark data
  - `releaseDecision`
  - `decisionClarity`
  - `finalRecommendationSummary`
  - `cycleTimeSeconds`
  - `rerunCount`
  - `blockedStateCount`
  - `tokenUsage`
- risk and evidence
  - `confirmedRisks`
  - `confirmedRiskRefs`
  - `evidence`
  - `evidenceGapRefs`
  - `workflowStatuses`
- friction
  - `friction.override`
  - `friction.overrideReason`
  - `friction.falsePositivePatterns`
  - `friction.falsePositiveRefs`
  - `friction.manualSteps`
  - `friction.requestFriction`
- traceability
  - `triggerRefs`
  - `notes`

Compatibility rules:

- if the ledger is missing, `/outcomes` remains available with inferred provenance
- if a ledger entry is malformed, the visualizer should surface the parse problem but continue rendering valid runs
- measurable fields should be prefilled from runs where possible; adjudication remains human-owned

## Outcomes-Derived Categories

The production visualizer treats these categories as stable display concepts:

- decision impact
  - changed decision
  - blocked approval
  - added validation
  - added confidence
  - no meaningful change
- risk buckets
  - confirmed
  - noisy
  - unresolved
- evidence states
  - present
  - partial
  - missing
  - not required
- workflow chain states
  - present
  - current
  - missing upstream evidence
  - not run yet
  - not required

These categories must remain provenance-aware:

- `run-measured`
- `ledger-adjudicated`
- `inferred`

## Support Boundary

Supported for the first production-ready release:

- packaged local launch through `agentforge visualizer`
- packaged local export through `agentforge visualizer export`
- local benchmark authoring through `agentforge eval benchmark-record` and `agentforge eval benchmark-wizard`
- older bundle compatibility and missing-ledger fallback behavior

Not yet part of the contract:

- hosted dashboards
- live workflow streaming
- centralized event ingestion
- cross-repo aggregation
- automatic GitHub issue scraping
