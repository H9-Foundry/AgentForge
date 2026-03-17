# Manifest Metadata For SDLC Domain, Maturity, Trust Scope, And Support

This document defines the metadata model from issue [#76](https://github.com/H9-Foundry/AgentForge/issues/76) and records the first implementation now used by the official workflow and agent assets.

It describes the metadata AgentForge should add to workflow and agent manifests so the platform can grow from a single `pr-review` wedge into a broader SDLC catalog without losing clarity about what is actually supported.

The initial shared schema implementation now exists, but the broader catalog and registry surfaces described here remain future work.

## Why This Exists

The current manifest surface is enough for the shipped baseline:

- one official workflow: `pr-review`
- four official starter agents
- existing runtime and trust metadata for execution

That is enough to execute the current wedge, but it is not enough to explain a larger SDLC catalog.

Before this metadata landed, the repo had no manifest-level way to answer questions like:

- which lifecycle domain an asset belongs to
- whether it is part of the official supported surface or still internal
- how mature it is
- what trust boundary it assumes at runtime

Those distinctions currently live in docs and roadmap language, not in the manifests themselves.

## Design Goals

- add small, explicit metadata that supports cataloging and support reporting
- keep runtime execution metadata separate from product/support metadata
- align manifest terminology with [docs/SUPPORT_MATRIX.md](SUPPORT_MATRIX.md)
- make current official assets classifiable without pretending the future catalog already exists
- avoid weakening current trust enforcement or policy semantics

## Non-Goals

- implementing schema or CLI changes in this slice
- introducing a large workflow registry now
- replacing the current `trust` metadata used by policy enforcement
- exposing internal packages or assets as officially supported surfaces before they are ready

## Current Baseline

Current manifest coverage:

- workflow manifests:
  - `version`
  - `name`
  - `description`
  - `trigger`
  - `nodes`
- agent manifests:
  - `version`
  - `name`
  - `displayName`
  - `category`
  - `runtime`
  - `permissions`
  - `inputs`
  - `outputs`
  - `contextPolicy`
  - `trust`

Current support classification is documented only in [docs/SUPPORT_MATRIX.md](SUPPORT_MATRIX.md).

Current trust metadata already exists for execution and policy:

- `trust.tier`
- `trust.source`
- `trust.reviewed`

That trust metadata is execution-facing and policy-facing. It is not yet enough to describe the supported catalog surface in a stable platform-oriented way.

## Proposed Metadata Model

Add a new `catalog` section to workflow and agent manifests.

This section is intended for:

- support reporting
- catalog filtering
- future registry presentation
- CLI and docs surfacing

It is **not** intended to replace runtime policy or trust enforcement.

### Proposed Workflow Shape

```yaml
catalog:
  domain: review
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
```

### Proposed Agent Shape

```yaml
catalog:
  domain: security
  supportLevel: official
  maturity: mvp
  trustScope: official-core-only
```

## Field Definitions

### `catalog.domain`

The SDLC or foundation domain the asset primarily belongs to.

Proposed enum:

- `foundation`
- `plan`
- `design`
- `build`
- `review`
- `test`
- `security`
- `release`
- `operate`
- `maintain`

#### Domain Guidance

- use `foundation` for assets that are cross-cutting or enable other lifecycle domains directly
- use exactly one primary domain per manifest
- avoid multi-domain labels in the manifest; cross-domain relationships belong in docs or future dependency metadata

Examples:

- `pr-review` workflow: `review`
- `context-collector` agent: `foundation`
- `security-audit` agent: `security`
- `code-review` agent: `review`
- `test-generation` agent: `test`

### `catalog.supportLevel`

The public support status for the asset.

Proposed enum:

- `official`
- `partial`
- `planned`
- `internal`

This should align exactly with [docs/SUPPORT_MATRIX.md](SUPPORT_MATRIX.md).

#### Support-Level Guidance

- `official`: implemented and part of the current supported surface
- `partial`: some behavior or infrastructure exists, but the surface is incomplete
- `planned`: defined as roadmap intent but not yet implemented as a supported asset
- `internal`: present in the repository for implementation purposes, but not part of the supported public surface

For current manifest-bearing assets, only `official` and `internal` should be expected initially.

### `catalog.maturity`

The delivery maturity of the asset within its support level.

Proposed enum:

- `concept`
- `prototype`
- `mvp`
- `expanding`
- `stable`

#### Maturity Guidance

- `concept`: design target only, not executable yet
- `prototype`: early implementation exists but is not the recommended supported default
- `mvp`: first real supported slice with intentionally narrow scope
- `expanding`: beyond the first slice, but still under active capability growth
- `stable`: broadly exercised, with relatively predictable behavior and compatibility expectations

Current official assets should generally classify as `mvp`, not `stable`.

### `catalog.trustScope`

The coarse trust boundary the asset assumes for execution and composition.

Proposed enum:

- `core-only`
- `official-core-only`
- `official-reviewed-only`
- `official-and-reviewed-local`
- `review-required-third-party`

#### Trust-Scope Guidance

- `core-only`: only built-in core runtime assets are expected
- `official-core-only`: only official/core reviewed assets are expected
- `official-reviewed-only`: official reviewed components are required, but composition may expand within that set
- `official-and-reviewed-local`: local reviewed assets may participate when policy allows them
- `review-required-third-party`: third-party assets may participate only when explicitly reviewed and permitted

This field is a catalog/support description, not the enforcement input itself.

The runtime and policy engine should continue to rely on `trust.tier`, `trust.source`, `trust.reviewed`, and policy evaluation for actual allow/deny behavior.

## Relationship To Existing `trust` Metadata

The existing `trust` block stays authoritative for policy enforcement.

The proposed `catalog.trustScope` is intentionally coarser:

- `trust` answers: what does policy evaluate for this component?
- `catalog.trustScope` answers: what trust boundary should users expect when this asset is presented in a workflow or catalog?

These should be consistent, but they serve different purposes.

Examples:

- a current official starter agent may have:
  - `trust.tier: core`
  - `trust.source: official`
  - `trust.reviewed: true`
  - `catalog.trustScope: official-core-only`
- a future local reviewed workflow could still require:
  - policy-approved local plugins at runtime
  - `catalog.trustScope: official-and-reviewed-local`

## Current Asset Classification

This section identifies how current official assets should classify once the metadata exists.

### Official Workflow

| Asset | Domain | Support Level | Maturity | Trust Scope |
| --- | --- | --- | --- | --- |
| `pr-review` | `review` | `official` | `mvp` | `official-core-only` |

### Official Starter Agents

| Asset | Domain | Support Level | Maturity | Trust Scope |
| --- | --- | --- | --- | --- |
| `context-collector` | `foundation` | `official` | `mvp` | `official-core-only` |
| `security-audit` | `security` | `official` | `mvp` | `official-core-only` |
| `code-review` | `review` | `official` | `mvp` | `official-core-only` |
| `test-generation` | `test` | `official` | `mvp` | `official-core-only` |

### Internal Surfaces

Internal assets should eventually classify with `supportLevel: internal` until explicitly promoted.

Examples:

- starter adapters under `adapters/*`
- future internal workflow prototypes not yet part of the official catalog
- future registry-client-backed discovery surfaces before public support is declared

## Workflow Metadata Semantics

For workflows, the metadata should describe the workflow as a supported orchestration asset.

Rules:

- `domain` should describe the workflow’s primary lifecycle job
- `supportLevel` should match whether it is truly part of the supported surface
- `maturity` should stay conservative for first-slice workflows
- `trustScope` should describe the trust boundary of the workflow’s expected execution path

The workflow metadata should not try to encode every detail of every node. That remains the job of:

- node definitions
- agent manifests
- policy evaluation
- audit output

## Agent Metadata Semantics

For agents, the metadata should describe their catalog position and lifecycle role.

Rules:

- `domain` should match the agent’s primary SDLC function, not every possible downstream use
- `supportLevel` should describe whether the agent is part of the supported surface
- `maturity` should describe the delivery maturity of the agent itself
- `trustScope` should describe the coarse trust boundary the agent is intended to run within

This metadata is descriptive. It should not grant permissions or bypass policy.

## What This Enables

Once implemented, this metadata should support:

- better CLI and docs classification of workflows and agents
- future registry/selector filtering by domain and support level
- clearer support-matrix generation from real manifests instead of docs-only curation
- explicit separation between official, internal, and planned assets
- safer future workflow expansion because trust boundaries are visible up front

## What This Does Not Enable Yet

This metadata alone does not provide:

- a general workflow registry
- broader autonomous workflow execution
- lifecycle-aware policy overlays by itself
- artifact schema standardization by itself

Those depend on:

- [#75](https://github.com/H9-Foundry/AgentForge/issues/75) policy overlays and approval classes
- [#77](https://github.com/H9-Foundry/AgentForge/issues/77) lifecycle artifact schema families
- child schema/runtime/policy implementation issues under [#48](https://github.com/H9-Foundry/AgentForge/issues/48), [#49](https://github.com/H9-Foundry/AgentForge/issues/49), and [#50](https://github.com/H9-Foundry/AgentForge/issues/50)

## Schema Follow-Up

When this design moves into implementation, the first schema work should be:

1. add a shared `catalogMetadataSchema`
2. extend `workflowDefinitionSchema`
3. extend `agentManifestSchema`
4. add fixtures and tests for valid classifications
5. add shared inferred types in `packages/shared-types`

The first schema implementation should stay additive and backward-compatible where possible.

## CLI And Docs Follow-Up

Once implemented, the first CLI/docs follow-up should be:

- surface workflow metadata in scaffolded official workflow examples
- surface agent/workflow metadata in docs generation or future catalog views
- avoid adding user-facing “list the whole platform catalog” commands until the backing catalog is real

The CLI should not claim registry or discovery behavior that does not exist yet.

## Recommended Next Steps

After this design lands:

1. complete [#77](https://github.com/H9-Foundry/AgentForge/issues/77) for artifact schemas
2. create child schema/type issues under [#50](https://github.com/H9-Foundry/AgentForge/issues/50)
3. create runtime/policy follow-up issues under [#48](https://github.com/H9-Foundry/AgentForge/issues/48) and [#49](https://github.com/H9-Foundry/AgentForge/issues/49)
4. only then expand into the planning/discovery and architecture/design workflow MVP specs
