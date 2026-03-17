# Security And DevSecOps Workflow Expansion

This document defines the design target for issue [#55](https://github.com/H9-Foundry/AgentForge/issues/55).

It describes how AgentForge should grow security workflows beyond the current security posture and starter audit behavior.

It does **not** claim that these workflows are implemented or officially shipped today.

## Why This Exists

AgentForge already has strong policy, redaction, and release-trust controls, but it does not yet expose a first-class security workflow family.

Without explicit security workflows:

- security review intent is mixed into generic review paths
- compliance and DevSecOps use cases have no bounded workflow wedge
- security-specific evidence and findings are not normalized separately
- future supply-chain and release-hardening work lacks a clear upstream workflow model

## Design Goal

The first security expansion should define a workflow family that:

- keeps the current security posture as a hard baseline
- adds explicit workflows for bounded security review and evidence collection
- separates deterministic security evidence gathering from model reasoning
- feeds release-trust and maintenance work without overstating compliance claims

## Current Baseline

Available now:

- policy engine with lifecycle overlays and redaction
- lifecycle artifact sanitization and audit linkage
- starter `security-audit` agent
- release verification and trusted publishing

Not yet available:

- official security workflow assets
- dedicated security lifecycle artifacts beyond design targets
- explicit DevSecOps evidence adapters or compliance-oriented workflows

## Recommended Initial Workflow Family

Phase 2 should define one first official wedge:

- `security-review`

Later planned variants can include:

- `dependency-risk-review`
- `compliance-evidence-assembly`
- `supply-chain-verification`

Only `security-review` should be targeted for first implementation planning.

## User Jobs

The first security wedge should solve these jobs:

1. gather bounded security-relevant evidence for a repository change or release candidate
2. separate deterministic evidence from risk judgment
3. emit one structured security report for downstream use
4. provide an explicit handoff to release-trust and maintenance workflows

## Non-Goals

This expansion should not:

- weaken current trust or redaction controls
- claim compliance certifications or enterprise controls that do not exist
- provide unrestricted external scanner execution
- turn AgentForge into a hosted security platform

## Workflow Shape

### Workflow Identity

- workflow name: `security-review`
- trigger: `manual`
- primary lifecycle domain: `security`
- support level at first implementation: `official`
- maturity at first implementation: `mvp`

### Entry Model

Recommended input model:

- keep `agentforge run <workflow>`
- add `.agentops/requests/security.yaml`
- allow references to design records, implementation proposals, QA reports, or release artifacts

### Workflow Stages

1. intake normalization
2. deterministic evidence collection
3. security analysis
4. report and artifact emission

## Deterministic Vs Agentic Boundaries

Deterministic responsibilities:

- request validation
- path and evidence scoping
- local/static security evidence collection
- dependency and release-trust signal normalization
- artifact persistence and audit linkage

Reasoning responsibilities:

- risk prioritization
- exploitability or severity framing
- recommended mitigations
- release or maintenance impact synthesis

## Trust And Policy Boundaries

- security workflows must remain more restrictive than generic review by default
- sensitive findings and payloads remain subject to policy redaction
- external scanners or network evidence sources must be explicit adapters, not implicit behavior
- any remediation side effect remains outside the default security-review path

## Required Artifacts

Primary lifecycle artifact:

- `security-report`

The payload should minimally include:

- `targetRef`
- `evidenceSources`
- `findings`
- `severitySummary`
- `mitigations`
- `releaseImpact`
- `followUpWork`

## Required Deterministic Nodes, Agents, And Adapters

Deterministic needs:

- security request validator
- local/static evidence collector
- severity normalization
- sensitive-payload sanitizer

Starter agent need:

- `security-analyst`

Adapter expectations:

- dependency and advisory ingestion must remain explicit and policy-aware
- future compliance evidence adapters must preserve redaction and auditability

## Follow-On Implementation Slices

This epic should be decomposed into at least:

1. security request schema and official `security-review` workflow asset
2. `security-analyst` starter agent and `security-report` artifact emission
3. deterministic local security evidence collection and normalization
4. security-domain policy wiring for evidence visibility, redaction, and escalation posture

