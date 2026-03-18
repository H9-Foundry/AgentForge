# Maintenance, Dependency, And Docs Workflow Expansion

This document defines the design target for issue [#61](https://github.com/H9-Foundry/AgentForge/issues/61).

It describes how AgentForge should support routine maintenance work as a lifecycle domain separate from review and release.

It does **not** claim that the broader maintenance workflow family is fully implemented or officially promoted today.

## Why This Exists

The repository already has strong release hygiene and structured planning, but routine maintenance work still relies on ad hoc process:

- dependency upgrades
- documentation refreshes
- maintenance triage
- recurring hygiene review

Without a maintenance workflow family:

- maintenance work is overloaded onto `pr-review`
- dependency and docs stewardship do not produce lifecycle-specific artifacts
- release and GitHub automation do not feed into a bounded maintenance model

## Design Goal

The first maintenance expansion should define one bounded workflow wedge that:

- normalizes maintenance requests
- gathers deterministic maintenance evidence
- emits one structured maintenance report
- provides a safe handoff into implementation, QA, and release workflows

## Current Baseline

Available now:

- release/readiness automation
- GitHub issue planning and queue tracking
- newcomer and contributor docs/process scaffolding
- lifecycle artifact and audit infrastructure
- official `maintenance-triage` workflow asset with bounded maintenance request intake
- deterministic maintenance request validation and release-report reference checks

Not yet available:

- `maintenance-analyst` and `maintenance-report` artifact emission
- deterministic dependency/docs/release signal collection and routing classification
- official promotion of `maintenance-triage` before the later maintenance slices land

## Recommended Initial Workflow Family

Phase 2 should define one first official wedge:

- `maintenance-triage`

Later planned variants can include:

- `dependency-upgrade-review`
- `docs-hygiene-review`
- `maintenance-backlog-refresh`

`maintenance-triage` is now implemented as an intake-only wedge. The later maintenance variants remain planned.

## User Jobs

The first maintenance wedge should solve these jobs:

1. turn a maintenance request or recurring hygiene task into a bounded maintenance brief
2. collect deterministic dependency/docs/release signals relevant to the request
3. recommend whether the next step is implementation, QA, security, or release work
4. keep maintenance expectations explicit for contributors and maintainers

## Non-Goals

This expansion should not:

- treat dependency bots alone as full maintenance support
- merge all maintenance work into release or PR review forever
- create write-heavy recurring automation by default

## Workflow Shape

### Workflow Identity

- workflow name: `maintenance-triage`
- trigger: `manual` first, with recurring use only after explicit later work
- primary lifecycle domain: `maintain`
- support level at first implementation: `official`
- maturity at first implementation: `mvp`

### Entry Model

Recommended input model:

- keep `agentforge run <workflow>`
- add `.agentops/requests/maintenance.yaml`
- allow references to dependency alerts, docs tasks, release reports, or backlog issues

### Workflow Stages

1. intake normalization
2. deterministic maintenance reference validation
3. maintenance analysis
4. report and artifact emission

## Deterministic Vs Agentic Boundaries

Deterministic responsibilities:

- request validation
- dependency/docs/release signal collection
- issue and package reference normalization
- artifact persistence and audit linkage

Reasoning responsibilities:

- maintenance prioritization
- recommended next-workflow routing
- contributor-facing triage guidance

## Trust And Policy Boundaries

- maintenance review remains read-only by default
- any follow-on dependency update or docs edit remains explicit downstream implementation work
- network-backed maintenance signals must remain adapter-mediated and policy-aware

## Required Artifacts

Primary lifecycle artifact:

- `maintenance-report`

The payload should minimally include:

- `maintenanceGoal`
- `evidenceSources`
- `affectedPackagesOrDocs`
- `recommendedActions`
- `routingRecommendation`
- `risks`

## Required Deterministic Nodes, Agents, And Adapters

Deterministic needs:

- maintenance request validator
- dependency/docs/release signal collector
- routing classifier

Starter agent need:

- `maintenance-analyst`

Adapter expectations:

- GitHub and dependency-alert ingestion must remain explicit and bounded
- recurring automation stays downstream of manual workflow design

## Follow-On Implementation Slices

Implemented on current `main`:

1. maintenance request schema and official `maintenance-triage` workflow asset
2. deterministic validation of dependency alert refs, docs task refs, release-report refs, and backlog issue refs before reasoning

Next maintenance family follow-ons:

1. `maintenance-analyst` starter agent and `maintenance-report` artifact emission
2. deterministic dependency/docs/release signal collection and routing classification
3. GitHub and release/readiness handoff wiring for maintenance follow-up work
