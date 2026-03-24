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
- an outcomes dashboard for decision impact, risk, release benchmark speed/quality/spend, evidence completeness, friction, and workflow-chain coverage
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
- uses `/outcomes` as the canonical route for process-impact inspection
- keeps `/value` as a local compatibility alias for one transition cycle

Optional flags:

```bash
pnpm visualizer:dev -- --runs-root /absolute/path/to/.agentops/runs --benchmark-ledger /absolute/path/to/.agentops/benchmark-ledger.json --port 4314
```

## Optional Benchmark Ledger Overlay

To surface adjudicated decision-impact, release benchmark speed/quality/spend, override, false-positive, evidence-gap, and friction summaries directly in the outcomes dashboard, add an optional local JSON file at:

- `.agentops/benchmark-ledger.json`

The current internal CLI helpers for that ledger are:

```bash
agentforge eval benchmark-ledger --json
agentforge eval benchmark-record <task-id> <control|agentforge> --source <replay|live> --task-type <type> --prefill-run <run-id> --json
```

These commands are intended for local dogfooding and benchmark review only. They are not part of the published npm support commitment yet.

The visualizer treats this file as an internal overlay, not a product contract. The expected shape is:

```json
{
  "schemaVersion": "1.0.0",
  "entries": [
    {
      "taskId": "task-1",
      "benchmarkCategory": "release",
      "source": "live",
      "taskType": "release/deployment",
      "arm": "agentforge",
      "runId": "1774182026977-5f74df",
      "workflow": "planning-discovery",
      "cycleTimeSeconds": 300,
      "decisionOutcome": "added_validation",
      "releaseDecision": "conditional",
      "decisionClarity": "clear",
      "agentforgeChangedDecision": true,
      "summary": "AgentForge forced a release-evidence follow-up before merge.",
      "decisionImpactReason": "Derived from missing release evidence and required verification checks.",
      "finalRecommendationSummary": "Do not approve release until CI-backed evidence is complete.",
      "rerunCount": 1,
      "blockedStateCount": 1,
      "triggerRefs": [
        {
          "runId": "1774182026977-5f74df",
          "artifactKind": "release-report",
          "section": "required-verification",
          "note": "Release report still had missing CI evidence."
        }
      ],
      "confirmedRiskRefs": [
        {
          "severity": "medium",
          "title": "Missing CI evidence before release decision",
          "runId": "1774182026977-5f74df",
          "artifactKind": "release-report"
        }
      ],
      "confirmedRisks": {
        "high": 0,
        "medium": 1,
        "low": 0,
        "noisy": 0,
        "unresolved": 1
      },
      "tokenUsage": {
        "provider": "openai",
        "model": "gpt-5.4",
        "inputTokens": 1200,
        "outputTokens": 400,
        "totalTokens": 1600,
        "estimatedCostUsd": 0.24,
        "requestCount": 4
      },
      "evidence": {
        "present": ["qa-report"],
        "missing": ["release-report"],
        "partial": ["ci-evidence"]
      },
      "evidenceGapRefs": [
        {
          "runId": "1774182026977-5f74df",
          "artifactKind": "release-report",
          "section": "evidence",
          "note": "CI evidence was only partial."
        }
      ],
      "workflowStatuses": [
        {
          "workflow": "planning-discovery",
          "status": "success"
        }
      ],
      "friction": {
        "override": false,
        "falsePositiveRefs": [],
        "falsePositivePatterns": [],
        "manualSteps": [],
        "requestFriction": []
      },
      "notes": ["AgentForge forced an extra validation pass before merge."]
    }
  ]
}
```

For release-category ledger entries, `/outcomes` now shows:

- median cycle time by arm
- release decision clarity by arm
- blocked release decisions by arm
- total token/API spend by arm
- cost per confirmed risk caught
- cost per blocked premature release when cost data is available

## Trust Boundary

The visualizer is a presentation layer only.

- it parses run bundles with the existing shared schemas where possible
- it falls back to a generic payload view for forward-compatibility cases
- it never rewrites run bundles
- it should work without network access

Use it to inspect local run state and benchmark value signals more quickly than reading raw JSON, not as a replacement for the CLI or the benchmark ledger in [#268](https://github.com/H9-Foundry/AgentForge/issues/268).
