# GitHub Integration Maturity

This document defines the design target for issue [#56](https://github.com/H9-Foundry/AgentForge/issues/56).

It describes how GitHub should mature as an SDLC integration surface without turning AgentForge into a GitHub-only product.

It does **not** claim that broader GitHub integration is implemented or officially shipped today.

## Why This Exists

GitHub is already part of the current execution story:

- issue planning is tracked in GitHub
- release and validation automation run in GitHub Actions
- PR review is the current official workflow wedge

But the platform does not yet define what "mature GitHub support" actually means.

## Design Goal

The first maturity pass should:

- document current GitHub support honestly
- define the near-term GitHub surfaces worth formalizing
- keep GitHub support explicitly downstream of the core workflow/runtime model
- avoid coupling the overall product identity to one host platform

## Current Baseline

Available now:

- GitHub issues and milestones as planning source of truth
- GitHub Actions for validation and release automation
- GitHub-centric release hardening
- narrow PR-review integration and release/version PR handling

Not yet available:

- official GitHub-backed workflow adapters beyond the current narrow paths
- explicit project/status-sync workflow surfaces
- formalized issue/PR handoff artifacts for the broader SDLC lifecycle

## Near-Term Maturity Wedge

Phase 2 should focus on these GitHub surfaces:

1. issue and PR reference normalization across workflows
2. bounded issue/PR comment/report handoff for planning, design, QA, and release outputs
3. GitHub Actions evidence ingestion for QA and release workflows
4. queue/status synchronization that remains subordinate to local workflow truth

## Non-Goals

This maturity pass should not:

- assume GitHub is the only supported SCM/CI target forever
- create hidden network dependencies in local workflows
- promise GitHub Projects or enterprise admin integrations before design and trust controls exist

## Trust And Policy Boundaries

- local workflow execution must stay viable without GitHub access on the default path
- any GitHub write side effect must remain adapter-mediated and approval-gated where appropriate
- imported GitHub text remains untrusted input
- GitHub status should reflect workflow state, not override local policy/runtime decisions

## Required Artifacts And Contracts

GitHub maturity work should align with these artifact needs:

- normalized issue and PR references in planning/design/build/QA artifacts
- optional GitHub handoff summaries derived from lifecycle artifacts
- explicit execution-status mapping between local workflow state and GitHub reporting

## Required Adapters And Deterministic Nodes

Deterministic needs:

- GitHub reference normalizer
- PR and issue metadata collector
- Actions/check-run status normalizer
- artifact-to-GitHub summary renderer

Adapter expectations:

- GitHub issue/PR reads remain explicit
- comment/status writes stay clearly bounded and policy-aware

## Relationship To Broader SCM/CI Support

GitHub is the first mature integration target because it already anchors planning and release.

It should remain:

- the best-supported near-term host integration
- a reference design for future SCM/CI adapters
- explicitly narrower than the broader cross-platform roadmap

## Follow-On Implementation Slices

This epic should be decomposed into at least:

1. GitHub issue/PR reference and status normalization shared across lifecycle workflows
2. bounded GitHub handoff/comment/report surfaces for planning, design, QA, and release artifacts
3. GitHub Actions evidence ingestion for QA and release workflows
4. support-matrix and policy guidance for GitHub-specific versus host-agnostic behavior

