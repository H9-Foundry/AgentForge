# Supply-Chain And Release Trust Hardening

This document defines the design target for issue [#65](https://github.com/H9-Foundry/AgentForge/issues/65).

It describes the remaining supply-chain and release-trust work beyond the current trusted publishing baseline.

It does **not** claim that all hardening work is implemented today.

## Why This Exists

AgentForge already has a strong release-trust baseline:

- curated public packages
- trusted publishing
- release verification
- build provenance
- signed maintainer commits

But that baseline is not the end of the supply-chain story.

## Design Goal

The next hardening roadmap should:

- preserve and extend the current trusted release posture
- define remaining gaps across dependency integrity, artifact verification, and consumer trust
- connect release-trust work to security, release, plugin, and compatibility roadmaps
- keep public claims aligned with implemented protections

## Current Baseline

Available now:

- trusted publishing through GitHub Actions
- release verification and publish gating
- provenance attestation for build artifacts
- signed maintainer workflow and protected `main`

Not yet available:

- consumer-facing verification guidance beyond the current release tooling
- full enterprise-grade SBOM generation or distribution verification
- registry/plugin distribution trust hardening beyond local plugin trust
- cross-host supply-chain evidence normalization

Implemented now in a bounded first slice:

- workspace-inventory style dependency-integrity evidence for local repos
- release-readiness dependency-integrity checks derived from local manifests and lockfiles
- security-review dependency-integrity signals derived from bounded local manifests and lockfiles

## Remaining Hardening Areas

### 1. Dependency Integrity

First bounded implementation available now:

- local manifest inventory with lockfile-aware integrity status
- deterministic dependency-integrity signals surfaced in `security-report` and `release-report`
- release-readiness verification checks for dependency-integrity

Still to define or extend:

- lockfile integrity expectations
- dependency source and update provenance
- richer SBOM or inventory outputs where appropriate

### 2. Artifact And Attestation Verification

Define how workflows should consume:

- provenance attestations
- package verification results
- trusted-publishing posture checks

This should extend the current release-readiness direction without replacing it.

### 3. Plugin And Registry Trust Expansion

Define how future plugin and registry work must incorporate:

- verification records
- signature or attestation checks
- explicit activation approval

### 4. Consumer And Maintainer Guidance

Define what additional guidance and reporting is needed so maintainers and consumers can understand:

- what is verified today
- what is not yet verified
- how to interpret release-trust signals

## Non-Goals

This roadmap should not:

- weaken current release posture for convenience
- claim full enterprise supply-chain coverage before it exists
- replace the existing trusted release path during design

## Trust And Policy Boundaries

- current trusted publishing remains mandatory for official publishes
- new hardening work should narrow trust gaps rather than widening capabilities
- verification and attestation evidence remain explicit and auditable
- maintainer convenience must not override release trust boundaries

## Required Artifacts And Contracts

The roadmap should eventually introduce:

- supply-chain verification artifact or report extensions
- dependency-integrity evidence contract
- attestation verification result contract
- consumer-facing trust-summary outputs derived from release artifacts

## Relationship To Other Workstreams

This roadmap is downstream of:

- security and DevSecOps workflow expansion
- release and CI-CD workflow expansion
- plugin and registry roadmap
- additional SCM/CI integration work where host evidence is relevant

## Follow-On Implementation Slices

This epic should be decomposed into at least:

1. dependency-integrity and SBOM-oriented verification/reporting surface
2. attestation verification and trust-summary integration for release workflows
3. plugin and registry distribution hardening requirements aligned to verified activation and consumer trust signals

Status:

- item 1 is now partially implemented as a bounded workspace-inventory and dependency-integrity reporting wedge
- items 2 and 3 remain next
