# Self-Hosting Posture

This document defines how AgentForge should be used on the AgentForge repository itself.

It is intentionally conservative. The goal is to let AgentForge help build AgentForge without pretending the platform is already mature enough for broad autonomous implementation.

## Current Decision

AgentForge should dogfood itself in **narrow-assist mode** for now.

That means:

- use AgentForge for planning and design work
- use AgentForge for review, QA checks, and release verification
- keep implementation changes human-led unless they are later introduced as tightly approval-gated, low-risk, explicitly supported workflows

## Why This Is The Current Posture

The platform is already credible in a few areas:

- repo-aware workflow execution
- secure-by-default policy mediation
- auditable findings and summaries
- release readiness and package verification checks

The platform is not yet mature enough for broad self-directed implementation across SDLC domains because the following foundation work is still in progress:

- context-slice contracts and budget enforcement
- lifecycle-domain policy overlays and approval classes
- manifest metadata for domain, maturity, and trust scope
- lifecycle artifact schema families

Those gaps are tracked in:

- [#74](https://github.com/H9-Foundry/AgentForge/issues/74)
- [#75](https://github.com/H9-Foundry/AgentForge/issues/75)
- [#76](https://github.com/H9-Foundry/AgentForge/issues/76)
- [#77](https://github.com/H9-Foundry/AgentForge/issues/77)

## What AgentForge May Do On Itself Today

### 1. Planning And Design

Allowed:

- backlog decomposition
- roadmap and support-matrix updates
- design-doc generation
- proposal artifacts linked to GitHub issues

Expected output:

- structured docs
- explicit issue linkage
- auditable rationale

### 2. Review And QA

Allowed:

- repository scanning
- PR review
- risk detection
- test-gap detection
- structured findings and summaries

Expected output:

- findings
- proposed actions
- run artifacts
- blocked-action visibility when something is not allowed

### 3. Release And Readiness

Allowed:

- `agentforge release guide`
- `agentforge release check`
- `agentforge release verify`
- release documentation and trust-review work

Expected output:

- machine-readable or structured readiness results
- clear pass/fail reporting
- auditable release-preflight artifacts

## What AgentForge Should Not Do On Itself Yet

Not yet supported as official self-hosting behavior:

- broad autonomous code-writing workflows
- broad autonomous build/change/deploy flows
- unconstrained networked implementation loops
- hidden side effects behind planning or design prompts
- workflows that rely on large implicit context grabs

That work should wait until the Phase 1 foundation contracts are fully defined and at least partially implemented.

## Rules For Self-Hosted Use

Any self-hosted AgentForge workflow should remain:

- read-only by default
- approval-gated for side effects
- minimal-context
- schema-validated
- auditable

Additionally:

- planning artifacts must link back to GitHub issues
- review or QA runs must emit structured findings or an explicit no-findings result
- release-oriented checks must stay deterministic and machine-readable where possible
- documentation must not describe a self-hosted capability as official until it actually exists in the repo

## Graduation Criteria For Broader Self-Hosting

AgentForge should not move from narrow-assist mode to broader self-hosted implementation until:

1. context-slice categories and truncation rules are defined
2. policy overlays and approval classes are defined
3. manifest metadata for workflow domain and trust scope is defined
4. lifecycle artifact schemas are defined
5. at least one broader lifecycle workflow MVP is specified against those contracts

At that point, the project can consider tightly approval-gated implementation-assist workflows, but not before.
