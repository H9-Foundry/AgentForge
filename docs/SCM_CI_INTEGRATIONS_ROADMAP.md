# Additional SCM And CI Integrations Roadmap

This document defines the design target for issue [#64](https://github.com/H9-Foundry/AgentForge/issues/64) and the active Phase 2 tracker [#245](https://github.com/H9-Foundry/AgentForge/issues/245).

It describes how AgentForge should expand beyond the current GitHub-centric baseline without promising broad integration support prematurely.

It does **not** claim that broad cross-platform SCM or CI support or broad remote-host parity is implemented today.

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

Implemented now:

- host-agnostic SCM reference contracts
- host-agnostic CI evidence contracts
- adapter capability metadata for bounded host behavior
- bounded GitLab issue and merge-request normalization into the shared SCM contract
- bounded local GitLab CI evidence normalization into the shared CI contract
- bounded local Buildkite CI evidence normalization into the shared CI contract
- bounded local Jenkins CI evidence normalization into the shared CI contract
- bounded generic CI evidence ingestion for local pipeline status and artifact exports
- shared SCM and CI handoff summary rendering across lifecycle artifacts where normalized host-agnostic evidence is available

Not yet available:

- broader generic release and deployment workflow surfaces across multiple providers
- additional CI provider wedges beyond the current GitHub Actions, GitLab CI, Buildkite, Jenkins, and generic local export baseline
- live remote SCM or CI reads on the default local path

## Recommended Priority Order

### Priority 1: Host-Agnostic Reference Contracts

Status: implemented as the first contract slice.

Before adding more hosts, define:

- SCM reference model
- CI run/check evidence model
- host capability classification

This keeps future adapters from inventing incompatible contracts.

### Priority 2: One Additional SCM/CI Pair

Status: implemented as the first concrete non-GitHub host pair.

The first additional target validates the host-agnostic model with one concrete ecosystem:

- GitLab SCM plus GitLab CI

This provides a meaningful contrast to GitHub without exploding scope.

### Priority 3: Additional Provider And Generic CI Evidence

Status: implemented for Buildkite, Jenkins, and the first generic local CI evidence wedge.

After the first new host pair:

- validate additional explicit provider-specific CI wedges
- expand to generic CI evidence adapters
- consider additional bounded CI systems only where local exported evidence makes sense

### Priority 4: Generic Release And CI Workflow Consumption

Status: active next family.

After the shared CI baseline is proven across the current providers:

- expand provider-agnostic workflow consumption instead of opening another provider wedge first
- add generic release and deployment review workflows that consume shared `CiEvidence`
- keep provider provenance explicit while avoiding host-specific request models

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
2. implemented: GitLab issue/MR and CI evidence integration wedge as the first additional concrete host pair
3. implemented: generic CI evidence adapter surface for bounded local pipeline status and artifact ingestion
4. implemented: Buildkite CI evidence adapter wedge as the next additional bounded provider
5. implemented: Jenkins CI evidence adapter wedge as the next bounded CI-only provider follow-on
6. implemented: richer host-agnostic workflow consumption and handoff rendering built on the shared contracts
7. next: provider-agnostic release and deployment workflow family built on shared `CiEvidence`
