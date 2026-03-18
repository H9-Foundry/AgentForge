# Test And QA Workflow Expansion

This document defines the QA workflow family for issue [#54](https://github.com/H9-Foundry/AgentForge/issues/54) and records the status of the first official wedge.

It now describes the implemented `qa-review` wedge plus the follow-on QA variants that remain planned.

## Why This Exists

`pr-review` already touches tests and QA implicitly, but QA remains embedded inside review rather than represented as its own workflow family.

Without dedicated QA workflows:

- validation intent is mixed with code-review intent
- test evidence is not normalized into lifecycle-specific artifacts
- deterministic test/result handling is harder to separate from model reasoning
- later release and maintenance workflows have no stable QA handoff

## Design Goal

The first QA expansion should define a workflow family that:

- accepts a bounded QA request or implementation/design artifact input
- gathers deterministic test and evidence context
- emits one structured QA artifact
- keeps execution support explicit and narrow at each stage

## Current Baseline

Available now:

- official `pr-review` workflow
- official `qa-review` workflow
- starter `qa-analyst` agent
- `qa-report` lifecycle artifact emission
- deterministic QA evidence normalization and allowlisted validation collection
- deterministic ingestion of explicit local GitHub Actions/check-run evidence exports
- audit bundle and lifecycle artifact infrastructure
- release verification and package checks

Not yet available:

- additional QA workflow variants beyond `qa-review`
- broader CI-hosted or network-backed QA evidence ingestion

## Recommended Initial Workflow Family

Phase 2 should treat QA as a family with one initial official wedge:

- `qa-review`

Later planned variants can include:

- `test-generation-review`
- `regression-triage`
- `release-readiness-qa`

`qa-review` is the first official QA wedge. Later variants should build on the same evidence and artifact contracts.

## User Jobs

The current QA wedge solves these jobs:

1. gather deterministic evidence about validation surfaces for a bounded change
2. summarize test gaps, risks, and recommended next checks
3. separate QA outcomes from code review comments
4. provide a clean handoff to release and maintenance workflows

## Non-Goals

This expansion should not:

- imply broad arbitrary test execution support on day one
- replace dedicated CI systems
- merge every QA function into `pr-review`
- promise flaky-test management or hosted lab execution

## Workflow Shape

### Workflow Identity

- workflow name: `qa-review`
- trigger: `manual`
- primary lifecycle domain: `qa`
- support level at first implementation: `official`
- maturity at first implementation: `mvp`

### Entry Model

Recommended input model:

- keep `agentforge run <workflow>`
- add `.agentops/requests/qa.yaml`
- allow references to design records, implementation proposals, or local validation outputs

Recommended first request fields:

- `targetRef` as required reference to a prior artifact bundle or bounded local validation output
- `evidenceSources` as optional additional local evidence paths
- `executedChecks` as optional list of already-run validation commands
- `focusAreas` as optional list of QA emphasis areas
- `constraints` as optional bounded QA constraints
- `releaseContext` as optional enum describing whether the request is exploratory, candidate-facing, or blocking

### Workflow Stages

1. intake normalization
2. deterministic evidence collection
3. QA analysis
4. report and artifact emission

## Deterministic Vs Agentic Boundaries

Deterministic responsibilities:

- request validation
- evidence collection from allowlisted local sources
- normalization of known test outputs and explicit local GitHub Actions exports
- artifact persistence and audit linkage

Reasoning responsibilities:

- QA risk framing
- test-gap synthesis
- prioritization of recommended follow-up checks

## Trust And Policy Boundaries

- read-only by default
- test execution support must remain explicit and allowlisted
- external CI ingestion must stay adapter- and policy-bounded
- any write or network side effect remains approval-gated

## Required Artifacts

Primary lifecycle artifact:

- `qa-report`

The payload should minimally include:

- `targetRef`
- `evidenceSources`
- `executedChecks`
- `findings`
- `coverageGaps`
- `recommendedNextChecks`
- `releaseImpact`

## Required Deterministic Nodes, Agents, And Adapters

Deterministic needs:

- QA request validator
- test-output normalizer
- check inventory collector
- release-impact classifier

Starter agent need:

- `qa-analyst`

Adapter expectations:

- local filesystem and shell evidence remain policy-bounded
- future CI/test-result adapters must normalize into one QA evidence contract

## Implementation Status

Implemented on current `main`:

1. QA request schema and official `qa-review` workflow asset
2. `qa-analyst` starter agent and `qa-report` artifact emission
3. deterministic test-output normalization and QA evidence ingestion

Next QA family follow-ons:

1. regression-triage
2. release-readiness QA
3. richer CI and external evidence ingestion through bounded adapters
