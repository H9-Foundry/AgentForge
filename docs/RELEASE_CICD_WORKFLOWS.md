# Release And CI-CD Workflow Expansion

This document defines the design target for issue [#59](https://github.com/H9-Foundry/AgentForge/issues/59).

It describes how AgentForge should grow from the current release/readiness tooling into a broader release and CI/CD workflow family.

It does **not** claim that a broader CI/CD workflow family is implemented or officially shipped today.

## Why This Exists

AgentForge already has real release automation:

- `release guide`
- `release check`
- `release verify`
- trusted publishing through GitHub Actions

But those capabilities are still narrow tooling rather than an explicit lifecycle workflow family.

## Design Goal

The first release/CI-CD expansion should:

- preserve the current trusted release posture
- formalize a first release-oriented workflow wedge around release evidence and gating
- define where broader CI evidence ingestion belongs
- keep GitHub-specific behavior separate from general pipeline support

## Current Baseline

Available now:

- release readiness CLI commands
- release validation and publish automation
- package/version verification
- audit and lifecycle artifact infrastructure
- bounded `release-readiness` request validation and workflow asset scaffolding
- bounded `release-report` artifact emission from the local `release-readiness` workflow
- deterministic release-state normalization across bounded local evidence, QA/security report refs, and workspace version targets
- approval-classified publish or promotion follow-on recommendations that remain read-only by default

Not yet available:

- explicit CI evidence ingestion into a release workflow
- support for broader host-agnostic pipeline orchestration

## Recommended Initial Workflow Family

Phase 2 should define one first official wedge:

- `release-readiness`

Later planned variants can include:

- `pipeline-evidence-review`
- `deployment-gate-review`
- `promotion-approval`

Only `release-readiness` should be targeted for first implementation planning.

## User Jobs

The first release wedge should solve these jobs:

1. collect deterministic release evidence for a candidate version or merge state
2. summarize publish blockers and follow-up actions
3. normalize local and CI evidence into one release artifact
4. preserve approval boundaries between readiness review and actual publish/promote steps

## Non-Goals

This expansion should not:

- replace the existing release workflow immediately
- promise deep integration with every CI provider
- auto-promote or publish without explicit trusted controls
- collapse release review and deployment into one opaque step

## Workflow Shape

### Workflow Identity

- workflow name: `release-readiness`
- trigger: `manual`
- primary lifecycle domain: `release`
- support level at the intake-only implementation slice: `partial`
- official promotion only after the evaluator path is stable and the workflow is documented against the published npm surface
- maturity at first implementation: `mvp`

### Entry Model

Recommended input model:

- keep `agentforge run <workflow>`
- add `.agentops/requests/release.yaml`
- allow references to QA reports, security reports, and version targets

### Workflow Stages

1. intake normalization
2. deterministic release evidence collection
3. release analysis
4. report and artifact emission

## Deterministic Vs Agentic Boundaries

Deterministic responsibilities:

- request validation
- package/version and tag inspection
- local and CI status normalization
- trusted-publishing configuration checks
- artifact persistence and audit linkage

Reasoning responsibilities:

- release blocker synthesis
- readiness judgment
- recommended mitigation sequencing

## Trust And Policy Boundaries

- the release-readiness workflow remains read-only by default
- publish, tag, or promote actions stay outside the default path
- CI evidence ingestion must be adapter-mediated and policy-aware
- trusted publishing remains mandatory for official publish automation

## Required Artifacts

Primary lifecycle artifact:

- `release-report`

The payload should minimally include:

- `targetVersion`
- `packageSet`
- `evidenceSources`
- `blockers`
- `readinessStatus`
- `requiredApprovals`
- `recommendedNextSteps`

## Required Deterministic Nodes, Agents, And Adapters

Deterministic needs:

- release request validator
- package/version and tag collector
- CI/check-run status normalizer
- trusted-publishing posture verifier

Starter agent need:

- `release-analyst`

Adapter expectations:

- CI evidence adapters remain explicit
- publish orchestration stays approval-gated and separate from readiness review

## Follow-On Implementation Slices

This epic should be decomposed into at least:

1. release request schema and official `release-readiness` workflow asset
2. `release-analyst` starter agent and `release-report` artifact emission
3. deterministic CI evidence ingestion and release-state normalization
4. approval-gated publish/promotion orchestration aligned to release-trust controls
