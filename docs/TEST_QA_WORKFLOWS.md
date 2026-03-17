# Test And QA Workflow Expansion

This document defines the design target for issue [#54](https://github.com/H9-Foundry/AgentForge/issues/54).

It describes the first dedicated QA workflow family AgentForge should add beyond the current `pr-review` wedge.

It does **not** claim that these workflows are implemented or officially shipped today.

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

- one official `pr-review` workflow
- starter `test-generation` agent
- audit bundle and lifecycle artifact infrastructure
- release verification and package checks

Not yet available:

- a dedicated QA workflow asset
- a dedicated QA artifact family implementation beyond the design contract
- deterministic normalization of test evidence into QA-specific outputs

## Recommended Initial Workflow Family

Phase 2 should treat QA as a family with one initial official wedge:

- `qa-review`

Later planned variants can include:

- `test-generation-review`
- `regression-triage`
- `release-readiness-qa`

Only `qa-review` should be targeted for first implementation planning.

## User Jobs

The first QA wedge should solve these jobs:

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

### Workflow Stages

1. intake normalization
2. deterministic evidence collection
3. QA analysis
4. report and artifact emission

## Deterministic Vs Agentic Boundaries

Deterministic responsibilities:

- request validation
- evidence collection from allowlisted local sources
- normalization of known test outputs
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

## Follow-On Implementation Slices

This epic should be decomposed into at least:

1. QA request schema and official `qa-review` workflow asset
2. `qa-analyst` starter agent and `qa-report` artifact emission
3. deterministic test-output normalization and QA evidence ingestion
4. policy/runtime wiring for QA-specific validation commands and evidence visibility

