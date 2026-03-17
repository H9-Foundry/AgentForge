# Additional SCM And CI Integrations Roadmap

This document defines the design target for issue [#64](https://github.com/H9-Foundry/AgentForge/issues/64).

It describes how AgentForge should expand beyond the current GitHub-centric baseline without promising broad integration support prematurely.

It does **not** claim that additional SCM or CI integrations are implemented today.

## Why This Exists

The current repo is strongest in local execution plus GitHub-backed planning and release workflows.

Broader SCM and CI support is part of the product direction, but there is no explicit sequence for it yet.

## Design Goal

The roadmap should:

- define a host-agnostic contract for SCM and CI references
- prioritize the next adapters rather than implying all hosts are equal
- keep policy, trust, and artifact contracts ahead of new integrations
- maintain an honest support matrix while new hosts remain planned

## Current Baseline

Available now:

- local git context collection
- narrow GitHub integration for planning/release/process work
- GitHub-hosted validation and release automation

Not yet available:

- additional SCM host adapters
- additional CI evidence adapters
- host-agnostic workflow surfaces across multiple providers

## Recommended Priority Order

### Priority 1: Host-Agnostic Reference Contracts

Before adding more hosts, define:

- SCM reference model
- CI run/check evidence model
- host capability classification

This keeps future adapters from inventing incompatible contracts.

### Priority 2: One Additional SCM/CI Pair

The first additional target should validate the host-agnostic model with one concrete ecosystem, likely:

- GitLab SCM plus GitLab CI

This provides a meaningful contrast to GitHub without exploding scope.

### Priority 3: Additional Generic CI Evidence

After the first new host pair:

- expand to generic CI evidence adapters
- consider Buildkite, Jenkins, or similar systems where bounded evidence ingestion makes sense

## Non-Goals

This roadmap should not:

- promise every SCM and CI host equally
- create hidden network dependencies in default local flows
- make host-specific behavior the new core contract

## Trust And Policy Boundaries

- local execution must remain viable without any host integration
- external host reads remain explicit and adapter-mediated
- host writes or state changes must remain approval-gated
- imported host content remains untrusted input

## Required Artifacts And Contracts

The roadmap should eventually introduce:

- host-agnostic SCM reference schema
- host-agnostic CI evidence schema
- adapter capability metadata
- host-handoff summary rendering compatible with lifecycle artifacts

## Relationship To GitHub Maturity

GitHub remains the first mature integration target.

Additional SCM/CI work should:

- build on the GitHub maturity contracts from `docs/GITHUB_INTEGRATION_MATURITY.md`
- reuse lifecycle artifact handoff and evidence normalization patterns
- keep GitHub-specific and host-agnostic layers separate

## Follow-On Implementation Slices

This epic should be decomposed into at least:

1. host-agnostic SCM and CI reference contracts plus adapter capability metadata
2. GitLab issue/MR and CI evidence integration wedge as the first additional concrete host
3. generic CI evidence adapter surface for bounded pipeline status and artifact ingestion

