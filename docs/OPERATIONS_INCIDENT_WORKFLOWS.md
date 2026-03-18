# Operations And Incident Workflow Expansion

This document defines the design target for issue [#60](https://github.com/H9-Foundry/AgentForge/issues/60).

It now records the implemented `incident-handoff` intake wedge and the remaining planned expansion beyond that first operations entry point.

It does **not** claim that the broader operations or incident workflow family is fully implemented or officially promoted today.

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
- official `incident-handoff` workflow asset with bounded staged-evidence intake
- deterministic incident request validation and release-report reference checks
- bounded `incident-analyst`
- `incident-brief` lifecycle artifact emission
- explicit local staged-evidence posture with read-only default behavior

Not yet available:

- deterministic staged incident-evidence normalization and routing
- broader operations or observability adapter support

## Recommended Initial Workflow Family

Phase 2 should define one first official wedge:

- `incident-handoff`

Later planned variants can include:

- `postmortem-review`
- `alert-triage`
- `operational-readiness-review`

`incident-handoff` is now implemented as an intake-only wedge. The later incident and operations variants remain planned.

## User Jobs

The current incident intake wedge solves these jobs:

1. capture bounded operational evidence for an incident or production issue
2. validate release-report handoff inputs and staged local evidence before reasoning
3. preserve a clean handoff into the later incident analysis slice
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
- support level at the intake-only implementation slice: `partial`
- official promotion only after `incident-analyst`, `incident-brief`, deterministic evidence normalization, and the evaluator path are all implemented and validated
- maturity at first implementation: `mvp`

### Entry Model

Recommended input model:

- keep `agentforge run <workflow>`
- add `.agentops/requests/incident.yaml`
- allow references to logs, alert summaries, release reports, or external incident notes that have been staged locally

### Workflow Stages

1. intake normalization
2. deterministic evidence staging and release-report reference validation
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

Implemented on current `main`:

1. incident request schema and official `incident-handoff` workflow asset
2. deterministic validation of staged incident evidence and referenced `release-report` artifacts before reasoning
3. `incident-analyst` starter agent and `incident-brief` artifact emission

Next incident family follow-ons:

1. deterministic staged incident-evidence normalization and source provenance capture
2. redaction/policy wiring for sensitive operational evidence and follow-up routing
