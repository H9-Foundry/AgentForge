# Plugin And Registry Roadmap

This document defines the design target for issue [#62](https://github.com/H9-Foundry/AgentForge/issues/62).

It describes how AgentForge should evolve from local/manual plugin trust into a broader plugin and registry roadmap without overstating current support.

It does **not** claim that a remote registry, third-party install flow, or plugin marketplace is implemented today.

## Why This Exists

AgentForge already has a real local plugin trust baseline:

- local workspace agent plugins can be loaded manually
- plugin trust metadata is evaluated before execution
- blocked plugins are recorded in the audit bundle

But the broader ecosystem story is still undefined.

## Design Goal

The roadmap should:

- preserve the current local/manual plugin trust baseline
- define how workflow, agent, and adapter plugins could expand safely
- separate read-only registry discovery from install or activation behavior
- keep registry-facing work downstream of schema, policy, and trust contracts

## Current Baseline

Available now:

- local/manual agent plugins only
- trust-tier, trust-source, and reviewed-state enforcement
- blocked-plugin reporting in audit output
- internal `packages/registry-client` placeholder package

Not yet available:

- remote plugin discovery
- registry metadata schema
- signed third-party plugin distribution
- adapter/provider plugin loading
- install or update flows

## Roadmap Wedges

### Wedge 1: Registry Metadata Contract

Define the registry-facing metadata needed to describe:

- plugin identity
- plugin type
- version and compatibility range
- trust tier and verification evidence
- supported workflow domains and maturity

This wedge should remain read-only and catalog-oriented.

### Wedge 2: Read-Only Registry Discovery

Define a bounded registry client surface that can:

- fetch or cache plugin metadata
- validate metadata against trust and compatibility contracts
- expose install candidates without activating them

This wedge should not install anything automatically.

### Wedge 3: Verified Plugin Activation

Define the eventual path for:

- verified third-party plugin acquisition
- signature or provenance checks
- explicit maintainer approval before activation
- policy-aware activation and rollback

This wedge remains future-facing until the earlier two wedges exist.

## Non-Goals

This roadmap should not:

- launch a plugin marketplace now
- imply that `packages/registry-client` is a public production surface today
- weaken local plugin trust requirements for convenience
- introduce network-backed plugin loading into the default workflow path

## Trust And Policy Boundaries

- local/manual plugin loading remains the current supported baseline
- registry reads must remain explicit and bounded
- plugin activation must remain separate from plugin discovery
- third-party plugin activation must remain approval-gated and policy-aware
- trust metadata continues to be evaluated before workflow execution

## Required Artifacts And Contracts

The roadmap should eventually introduce:

- registry plugin metadata schema
- plugin compatibility contract
- verification or provenance record for registry entries
- activation decision record linked to audit output

## Relationship To The Current Support Matrix

Current truthful state:

- local/manual plugin trust is real
- registry integrations are planned
- `packages/registry-client` remains internal

The roadmap should keep those statements true until later implementation lands.

## Follow-On Implementation Slices

This epic should be decomposed into at least:

1. registry metadata schema and plugin-catalog contract
2. read-only registry-client discovery and compatibility verification surface
3. verified third-party plugin activation flow with explicit approval and trust checks

