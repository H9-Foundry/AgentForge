# Visualizer

AgentForge now includes an officially supported local visualizer surface in the published CLI for inspecting workflow runs, outcomes, and benchmark summaries.

The visualizer is shipped through `@h9-foundry/agentforge-cli`, not as a separately installed public npm package.

Use [docs/CLI_FIRST_DOGFOODING.md](./CLI_FIRST_DOGFOODING.md) as the dogfooding policy for this surface. Internal acceptance and release-signoff should prefer the CLI path over maintainer-only source-build shortcuts.

This visualizer is intentionally narrow and local-first:

- local-only
- stable run inspection and outcomes analysis are read-focused
- backed by existing `.agentops/runs/**/bundle.json` and `summary.md`
- optionally overlaid with `.agentops/benchmark-ledger.json`
- intended first for technical early adopters and benchmark review

It does **not** currently provide:

- hosted dashboards
- live workflow streaming
- cross-repo benchmark aggregation

## What It Shows

The current visualization layer includes:

- a runs index
- an outcomes dashboard for decision impact, risk, release benchmark speed/quality/spend, evidence completeness, friction, and workflow-chain coverage
- a single run detail view
- a run comparison view
- a benchmark dashboard for local `benchmark-summary` artifacts

Stable now:

- request `meta` resolution surfaced in run bundles
- run-bundle configuration snapshots
- run comparison and configuration hotspot reporting
- `/configure`
- `/api/config/editor`
- `/api/config/render`
- `/api/config/preview`
- `/api/config/save`

Direct repo YAML remains canonical for request, repo-fit, and control edits. The browser editor is now a supported authoring layer over those files, and it is enabled by default. Repositories that need a temporary compatibility fallback can still disable browser editing with:

```yaml
visualizer:
  experimental_config_editing: false
```

When disabled, `/configure` remains read-only. When enabled, it defaults to a structured editor for requests, workflow controls, policy presets, defaults, and the repo-fit contract, keeps canonical YAML behind an Advanced toggle, and still routes preview/save through the same CLI-backed validation used by `agentforge config validate`.

## Local Launch

Published CLI launch path:

```bash
agentforge visualizer --open
```

Contributor/source-build path:

```bash
pnpm build:packages
node packages/cli/dist/bin.js visualizer --open
```

Default behavior:

- serves a local web app on `http://127.0.0.1:4313`
- reads runs from `.agentops/runs` under the current workspace root
- redirects `/` to `/outcomes` so evaluator-first review is the default landing path
- uses `/outcomes` as the canonical route for process-impact inspection
- keeps `/value` as a compatibility alias for one transition cycle

## Expected User Journey

Use the visualizer in this order unless you are already doing operator-level investigation:

1. `/outcomes`
   - evaluator-first landing page
   - answers whether AgentForge changed the plan, reduced risk, or improved evidence
2. `/runs`
   - practitioner drill-down into one run
   - use when a metric or artifact needs local forensic review
3. `/runs/compare`
   - secondary analysis once two candidate runs are known
   - shows control selections before outcome deltas
4. `/benchmarks`
   - deterministic `eval compare` evidence only
   - not the default product-onboarding page
5. `/configure`
   - supported structured authoring layer over canonical repo YAML
   - structured editor first, Advanced YAML second
   - includes a dedicated repo-fit target for repo structure, conventions, and optional starter-profile adoption
   - direct repo YAML plus `agentforge config validate` remains canonical

This distinction matters for requirements management:

- requests, workflow controls, and policy presets are managed in repo YAML first
- `.agentops/repo-fit.yaml` is the canonical repo-conventions contract that onboarding and workflows read
- `/configure` is subordinate to that YAML and remains a guarded convenience layer
- run bundles and `/runs/compare` explain how a given configuration produced a given outcome
- `/outcomes` and configuration hotspots answer which setup correlated with changed decisions or blocked actions

Use [docs/VISUALIZER_UX_ACCEPTANCE.md](./VISUALIZER_UX_ACCEPTANCE.md) as the release-time verification checklist for this journey.

Optional flags:

```bash
agentforge visualizer --runs-root /absolute/path/to/.agentops/runs --benchmark-ledger /absolute/path/to/.agentops/benchmark-ledger.json --port 4314 --host 127.0.0.1
```

Contributor/source-build path for local package development:

```bash
pnpm install
pnpm visualizer:dev -- --runs-root /absolute/path/to/.agentops/runs
```

## Export

The same CLI surface can export a normalized outcomes snapshot for CI artifacts or team review:

```bash
node packages/cli/dist/bin.js visualizer export --format json
node packages/cli/dist/bin.js visualizer export --format markdown --output ./agentforge-outcomes.md
```

## Optional Benchmark Ledger Overlay

To surface adjudicated decision-impact, release benchmark speed/quality/spend, override, false-positive, evidence-gap, and friction summaries directly in the outcomes dashboard, add an optional local JSON file at:

- `.agentops/benchmark-ledger.json`

The packaged CLI helpers for that ledger are:

```bash
agentforge eval benchmark-ledger --json
agentforge eval benchmark-record <task-id> <control|agentforge> --source <replay|live> --task-type <type> --prefill-run <run-id> --json
agentforge eval benchmark-wizard <task-id> <control|agentforge> --prefill-run <run-id>
```

These commands are local-first workflow support. They do not introduce a hosted service or any automatic sync requirement.

When the referenced run bundle already contains runtime-emitted provider usage, `--prefill-run` also copies:

- measured input/output/total token counts
- request count
- estimated cost when a matching local pricing-table entry exists
- pricing provenance fields for single-model runs

The visualizer uses the ledger as an adjudication overlay while keeping run bundles as the primary source of truth.

For release-category ledger entries, `/outcomes` shows:

- median cycle time by arm
- release decision clarity by arm
- blocked release decisions by arm
- total token/API spend by arm
- cost per confirmed risk caught
- cost per blocked premature release when cost data is available

For provider-backed local runs, run detail pages now also show:

- a measured usage summary sourced from the run bundle
- per-node token/request breakdowns
- cost provenance that distinguishes measured tokens from locally estimated cost

See [docs/VISUALIZER_DATA_CONTRACT.md](./VISUALIZER_DATA_CONTRACT.md) for the versioned visualizer-facing run/ledger contract and the compatibility rules for older bundles or missing pricing/ledger data.

## Troubleshooting

### Empty runs root

If the UI is empty, first confirm `.agentops/runs` exists in the current workspace or pass `--runs-root` explicitly.

### Malformed bundle

Malformed bundles are listed as invalid runs. Valid runs remain visible; the visualizer does not stop on one bad bundle.

### Missing benchmark ledger

If `.agentops/benchmark-ledger.json` is absent, `/outcomes` still renders with inferred provenance instead of ledger-adjudicated overlays.

### Missing pricing

If token counts exist but no local pricing entry matches the model, the visualizer shows measured tokens and marks cost unavailable.

### No measured token usage

If provider-backed usage was not captured for a run, the run still renders normally; measured token/cost views remain empty for that run until runtime usage data exists.

## Trust Boundary

The visualizer is a local presentation and inspection layer first.

- it parses run bundles with the existing shared schemas where possible
- it falls back to a generic payload view for forward-compatibility cases
- it never rewrites run bundles
- it only edits request/control YAML through the guarded preview-and-save flow backed by CLI validation and allowlisted paths
- it should work without network access

Use it to inspect local run state and benchmark value signals more quickly than reading raw JSON, not as a replacement for the CLI or the benchmark ledger in [#268](https://github.com/H9-Foundry/AgentForge/issues/268).

Supported in this phase:

- packaged local app via the published CLI
- local outcomes export for sharing
- local benchmark-ledger workflows
- evaluator-first outcomes landing with practitioner drill-down and run comparison

Not supported in this phase:

- hosted dashboards
- central aggregation
- live streaming execution views
