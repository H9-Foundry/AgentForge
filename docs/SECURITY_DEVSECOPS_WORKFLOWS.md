# Security And DevSecOps Workflow Expansion

This document defines the security workflow expansion for issue [#55](https://github.com/H9-Foundry/AgentForge/issues/55).

It now records the implemented `security-review` wedge and the remaining planned growth beyond that initial workflow.

It does **not** claim that the broader security family is fully implemented today.

## Why This Exists

AgentForge already has strong policy, redaction, and release-trust controls, and it now exposes one first-class security workflow wedge.

Before `security-review`, the repo lacked:

- security review intent is mixed into generic review paths
- compliance and DevSecOps use cases have no bounded workflow wedge
- security-specific evidence and findings are not normalized separately
- future supply-chain and release-hardening work lacks a clear upstream workflow model

## Current Goal

The current security expansion should:

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
- official `security-review` workflow asset
- starter `security-analyst`
- `security-report` lifecycle artifact emission
- deterministic security evidence normalization and security-domain policy handling

Not yet available:

- explicit DevSecOps evidence adapters or compliance-oriented workflows
- additional official security variants beyond `security-review`

## Recommended Initial Workflow Family

The first official security wedge is now:

- `security-review`

Later planned variants can include:

- `dependency-risk-review`
- `compliance-evidence-assembly`
- `supply-chain-verification`

Only `security-review` is implemented today. The later variants remain planned.

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

## Implemented Initial Slices

Completed:

1. security request schema and official `security-review` workflow asset
2. `security-analyst` starter agent and `security-report` artifact emission
3. deterministic local security evidence collection and normalization
4. security-domain policy wiring for evidence visibility, redaction, and escalation posture

## Remaining Planned Expansion

The broader security/DevSecOps family still needs:

1. additional security variants such as dependency-risk review and compliance evidence assembly
2. richer explicit evidence adapters beyond bounded local security evidence
3. workflow-level GitHub and CI handoff integration
4. eval and benchmark coverage for security-specific workflow quality
