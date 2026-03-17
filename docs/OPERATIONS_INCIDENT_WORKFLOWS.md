# Operations And Incident Workflow Expansion

This document defines the design target for issue [#60](https://github.com/H9-Foundry/AgentForge/issues/60).

It describes how AgentForge should support operational handoff and incident response workflows without pretending to be a hosted observability platform.

It does **not** claim that these workflows are implemented or officially shipped today.

## Why This Exists

The current platform stops at build, review, and release-oriented repository work.

Without an explicit operations/incident workflow family:

- production-facing handoff remains out of model
- observability evidence has no bounded ingestion contract
- incident follow-up work cannot be tied cleanly back to design, implementation, QA, or release artifacts

## Design Goal

The first operations expansion should define one bounded incident-handoff wedge that:

- ingests explicitly provided operational evidence
- normalizes that evidence deterministically
- emits one incident-oriented artifact for follow-up planning and maintenance
- keeps runtime and policy boundaries tighter than a hosted ops platform would require

## Current Baseline

Available now:

- context, policy, artifact, and audit infrastructure
- planning and design workflow design targets
- release/readiness tooling

Not yet available:

- official operations or incident workflow assets
- explicit observability evidence adapters
- incident-oriented lifecycle artifacts in runtime use

## Recommended Initial Workflow Family

Phase 2 should define one first official wedge:

- `incident-handoff`

Later planned variants can include:

- `postmortem-review`
- `alert-triage`
- `operational-readiness-review`

Only `incident-handoff` should be targeted for first implementation planning.

## User Jobs

The first incident wedge should solve these jobs:

1. capture bounded operational evidence for an incident or production issue
2. summarize likely impacted repository areas and follow-up work
3. hand off incident findings into planning, maintenance, or security workflows
4. keep sensitive operational data policy-aware and auditable

## Non-Goals

This expansion should not:

- build a hosted monitoring or paging product
- claim deep live-system integration before explicit adapters exist
- allow arbitrary remote-system access from the default workflow

## Workflow Shape

### Workflow Identity

- workflow name: `incident-handoff`
- trigger: `manual`
- primary lifecycle domain: `operate`
- support level at first implementation: `official`
- maturity at first implementation: `mvp`

### Entry Model

Recommended input model:

- keep `agentforge run <workflow>`
- add `.agentops/requests/incident.yaml`
- allow references to logs, alert summaries, release reports, or external incident notes that have been staged locally

### Workflow Stages

1. intake normalization
2. deterministic evidence staging and normalization
3. incident analysis
4. report and artifact emission

## Deterministic Vs Agentic Boundaries

Deterministic responsibilities:

- request validation
- local evidence staging and schema validation
- timestamp/source normalization
- path and artifact linkage
- redaction and audit linkage

Reasoning responsibilities:

- likely impact synthesis
- follow-up workflow recommendation
- incident severity framing
- open-question identification

## Trust And Policy Boundaries

- operations evidence must be staged explicitly rather than fetched implicitly
- sensitive logs and notes remain subject to strict redaction
- no default live-system access
- any future network-backed observability adapter must stay explicit and approval-aware

## Required Artifacts

Primary lifecycle artifact:

- `incident-brief`

The payload should minimally include:

- `incidentSummary`
- `evidenceSources`
- `timelineSummary`
- `likelyImpactedAreas`
- `followUpWorkflowRefs`
- `openQuestions`

## Required Deterministic Nodes, Agents, And Adapters

Deterministic needs:

- incident request validator
- staged evidence normalizer
- timestamp/source normalizer
- redaction-aware incident evidence collector

Starter agent need:

- `incident-analyst`

Adapter expectations:

- local staged-evidence adapters first
- observability/log adapters later and only with explicit trust boundaries

## Follow-On Implementation Slices

This epic should be decomposed into at least:

1. incident request schema and official `incident-handoff` workflow asset
2. `incident-analyst` starter agent and `incident-brief` artifact emission
3. deterministic staged incident-evidence normalization and source provenance capture
4. redaction/policy wiring for sensitive operational evidence and follow-up routing

