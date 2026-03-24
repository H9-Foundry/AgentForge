# Visualizer

AgentForge now includes an officially supported local visualizer surface in the CLI on `main` for inspecting workflow runs, outcomes, and benchmark summaries.

The visualizer is shipped through `@h9-foundry/agentforge-cli`, not as a separately installed public npm package.

Use [docs/CLI_FIRST_DOGFOODING.md](./CLI_FIRST_DOGFOODING.md) as the dogfooding policy for this surface. Internal acceptance and release-signoff should prefer the CLI path over maintainer-only source-build shortcuts.

This visualizer is intentionally narrow and local-first:

- local-only
- read-only
- backed only by existing `.agentops/runs/**/bundle.json` and `summary.md`
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
- a benchmark dashboard for local `benchmark-summary` artifacts

The visualizer reads the same audit bundles and lifecycle artifacts that `agentforge explain last-run --json` exposes. It does not write back to run state or change runtime behavior.

## Local Launch

Current release-ready command surface:

```bash
agentforge visualizer --open
```

Until the next npm publish lands, use it from a source checkout or a locally built CLI:

```bash
pnpm build:packages
node packages/cli/dist/bin.js visualizer --open
```

Default behavior:

- serves a local web app on `http://127.0.0.1:4313`
- reads runs from `.agentops/runs` under the current workspace root
- uses `/outcomes` as the canonical route for process-impact inspection
- keeps `/value` as a compatibility alias for one transition cycle

Optional flags:

```bash
node packages/cli/dist/bin.js visualizer --runs-root /absolute/path/to/.agentops/runs --benchmark-ledger /absolute/path/to/.agentops/benchmark-ledger.json --port 4314 --host 127.0.0.1
```

Contributor/source-build path:

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

The visualizer is a presentation layer only.

- it parses run bundles with the existing shared schemas where possible
- it falls back to a generic payload view for forward-compatibility cases
- it never rewrites run bundles
- it should work without network access

Use it to inspect local run state and benchmark value signals more quickly than reading raw JSON, not as a replacement for the CLI or the benchmark ledger in [#268](https://github.com/H9-Foundry/AgentForge/issues/268).

Supported in this phase:

- packaged local app via the official CLI surface on `main`
- local outcomes export for sharing
- local benchmark-ledger workflows

Not supported in this phase:

- hosted dashboards
- central aggregation
- live streaming execution views
