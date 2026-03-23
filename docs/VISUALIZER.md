# Visualizer

AgentForge now includes a **source-build-only** local visualization layer for inspecting workflow runs and benchmark summaries during dogfooding.

This visualizer is intentionally narrow and local-first:

- local-only
- read-only
- backed only by existing `.agentops/runs/**/bundle.json` and `summary.md`
- intended first for AgentForge-on-AgentForge inspection and benchmark review

It does **not** currently provide:

- published CLI support
- hosted dashboards
- live workflow streaming
- cross-repo benchmark aggregation

## What It Shows

The current visualization layer includes:

- a runs index
- a value dashboard for decision impact, risk, evidence completeness, friction, and workflow-chain coverage
- a single run detail view
- a benchmark dashboard for local `benchmark-summary` artifacts

The visualizer reads the same audit bundles and lifecycle artifacts that `agentforge explain last-run --json` exposes. It does not write back to run state or change runtime behavior.

## Local Launch

From a source checkout of AgentForge:

```bash
pnpm install
pnpm visualizer:dev
```

Default behavior:

- serves a local web app on `http://127.0.0.1:4313`
- reads runs from `.agentops/runs` under the current workspace root

Optional flags:

```bash
pnpm visualizer:dev -- --runs-root /absolute/path/to/.agentops/runs --benchmark-ledger /absolute/path/to/.agentops/benchmark-ledger.json --port 4314
```

## Optional Benchmark Ledger Overlay

To surface decision-impact, override, false-positive, and friction summaries directly in the value dashboard, add an optional local JSON file at:

- `.agentops/benchmark-ledger.json`

The visualizer treats this file as an internal overlay, not a product contract. The expected shape is:

```json
{
  "schemaVersion": "1.0.0",
  "entries": [
    {
      "taskId": "task-1",
      "source": "live",
      "taskType": "release/deployment",
      "arm": "agentforge",
      "runId": "1774182026977-5f74df",
      "workflow": "planning-discovery",
      "decisionOutcome": "added_validation",
      "agentforgeChangedDecision": true,
      "confirmedRisks": {
        "high": 0,
        "medium": 1,
        "low": 0,
        "noisy": 0,
        "unresolved": 1
      },
      "evidence": {
        "present": ["qa-report"],
        "missing": ["release-report"],
        "partial": ["ci-evidence"]
      },
      "friction": {
        "override": false,
        "falsePositivePatterns": [],
        "manualSteps": [],
        "requestFriction": []
      },
      "notes": ["AgentForge forced an extra validation pass before merge."]
    }
  ]
}
```

## Trust Boundary

The visualizer is a presentation layer only.

- it parses run bundles with the existing shared schemas where possible
- it falls back to a generic payload view for forward-compatibility cases
- it never rewrites run bundles
- it should work without network access

Use it to inspect local run state and benchmark value signals more quickly than reading raw JSON, not as a replacement for the CLI or the benchmark ledger in [#268](https://github.com/H9-Foundry/AgentForge/issues/268).
