# Policy Lifecycle Overlays And Approval Classes

This document defines the design target for issue [#75](https://github.com/H9-Foundry/AgentForge/issues/75).

It describes how AgentForge policy should expand from the current environment-only overlay model into a lifecycle-aware policy model without weakening the current secure-by-default baseline.

It does **not** claim that the policy engine already implements this full behavior.

## Why This Exists

The current policy model is intentionally small:

- defaults
- path rules
- tool rules
- environment overlays for `local` and `ci`
- plugin trust rules

That is enough for the current `pr-review` wedge. It is not enough for a broader SDLC platform where planning, design, build, release, operations, and maintenance workflows need different controls without turning policy into an ad hoc exception system.

## Design Goals

- keep the secure baseline intact across all lifecycle domains
- allow lifecycle-specific tightening and specialization
- make policy precedence deterministic and reviewable
- keep approval requirements explicit for high-impact actions
- preserve blocked-path and trust rules as hard guardrails

## Non-Goals

- broadening default permissions
- adding unconstrained workflow-specific exceptions
- allowing lifecycle overlays to bypass blocked paths
- implementing all engine/schema changes in this slice

## Current Baseline

Today, the effective policy snapshot resolves:

- `defaults.executionMode`
- `defaults.modelAccess`
- `defaults.network`
- `defaults.writes`
- `paths.allowedRead`
- `paths.allowedWrite`
- `paths.blocked`
- `plugins.allowedTiers`
- `plugins.allowedSources`
- `plugins.requireReviewed`
- `tools.*`

Current overlays are environment-only:

- `local`
- `ci`

## Proposed Policy Structure

The future policy model should keep the current top-level shape and add lifecycle-aware overlays explicitly.

Proposed top-level sections:

- `defaults`
- `paths`
- `tools`
- `plugins`
- `approvalClasses`
- `overlays`

### Proposed Overlay Families

`overlays` should eventually support:

- `environment`
  - `local`
  - `ci`
- `lifecycle`
  - `plan`
  - `design`
  - `build`
  - `review`
  - `security`
  - `release`
  - `operate`
  - `maintain`
- `workflow`
  - optional explicit per-workflow overlays for official workflows only

The lifecycle families should be stable and small. They map to SDLC domains, not arbitrary user labels.

## Overlay Precedence

The merge order should be:

1. base policy
2. environment overlay
3. lifecycle overlay
4. explicit workflow overlay, if one exists

For safety-sensitive policy fields, **most restrictive wins**.

### Restriction Rules

For permission-like values:

- `deny` overrides `approval_required`
- `approval_required` overrides `allow`

For path sets:

- `blocked` merges by union
- `allowedRead` narrows by intersection where overlays are present
- `allowedWrite` narrows by intersection where overlays are present

For plugin trust:

- allowed tiers narrow by intersection
- allowed sources narrow by intersection
- `requireReviewed` resolves to `true` if any active layer requires it

For tool rules:

- if the same tool is defined in multiple active layers, the most restrictive effect wins
- path/host/command allowlists narrow rather than widen

These rules ensure overlays specialize policy safely instead of turning it into a widening mechanism.

## Lifecycle Overlay Intent

### `plan`

Typical posture:

- read-only
- model access allowed only if explicitly enabled
- no write or network widening
- strong bias toward summaries, intake artifacts, and discovery outputs

### `design`

Typical posture:

- read-only
- bounded reasoning allowed where explicitly enabled
- no automatic code writes
- access to prior planning artifacts where permitted

### `build`

Typical posture:

- write-oriented activity possible, but only under explicit approval rules
- stronger distinction between generated-file writes and source-file writes
- deterministic checks should still precede agentic steps

### `review`

Typical posture:

- mostly read-only
- proposal-oriented
- test and audit artifacts allowed

### `security`

Typical posture:

- strong audit and reporting requirements
- no silent mutation of repository or external systems
- network actions remain tightly constrained

### `release`

Typical posture:

- highest scrutiny for network and repository mutation
- explicit approval for publish, tag, and deployment-significant actions
- auditable release metadata required

### `operate`

Typical posture:

- high sensitivity for external-system mutation
- incident or observability actions should default to approval-gated behavior

### `maintain`

Typical posture:

- bounded maintenance changes may be possible
- strong path controls around source, config, docs, and dependency files

## Approval Classes

Lifecycle overlays are not enough by themselves. The policy model also needs explicit approval classes so the runtime and audit layer can explain *what kind* of approval-gated action was requested.

### Proposed Approval Class Set

- `filesystem_write_low_risk`
  - generated artifacts or clearly bounded low-risk writes
- `filesystem_write_high_risk`
  - source, config, workflow, or policy changes
- `repo_mutation`
  - branch mutation, tag mutation, merge, or other repository state changes
- `network_read`
  - outbound read-only network access
- `network_mutation`
  - external system mutation, ticket creation, comment posting, or API-side effects
- `release_action`
  - publish, deploy, release creation, provenance-significant actions
- `credential_or_secret_touch`
  - any action involving secrets, signing material, or credential-bearing paths

These classes are more specific than the broad runtime effect classes and should be used for approval semantics, audit visibility, and future UI/reporting.

## Mapping From Runtime Effects To Approval Classes

The runtime effect classes from [docs/RUNTIME_INTERACTION_HARDENING.md](RUNTIME_INTERACTION_HARDENING.md) should map into approval classes like this:

- `read_only`
  - no approval class
- `propose_only`
  - no approval class
- `write_approval_required`
  - `filesystem_write_low_risk` or `filesystem_write_high_risk`
- `network_approval_required`
  - `network_read` or `network_mutation`
- `release_approval_required`
  - `release_action`

Tools and adapters should be able to declare a default approval class, with policy allowed to narrow or escalate it.

## Policy Semantics By Field

### Defaults

The base defaults remain conservative:

- execution mode defaults to `inspect`
- model access defaults to `false`
- network defaults to `deny`
- writes default to `approval_required`

Lifecycle overlays may specialize these values, but not bypass approval classes or blocked-path rules.

### Paths

Blocked paths remain non-negotiable:

- lifecycle overlays may add more blocked paths
- lifecycle overlays may narrow allowed reads/writes
- lifecycle overlays may not relax a blocked path inherited from a lower layer

### Tools

Tool policy should evolve toward:

- explicit effect class
- optional approval class
- optional lifecycle-domain narrowing
- path/host/command restrictions that only narrow under overlays

### Plugins

Plugin trust rules should stay global by default, with lifecycle overlays only allowed to narrow acceptance.

The platform should avoid lifecycle-specific trust widening because that would create hard-to-review exceptions.

## Audit Expectations

The audit output should eventually capture:

- which overlay layers were active
- which lifecycle domain was applied
- which approval class was mapped to each requested action
- whether an action was denied, approval-gated, or allowed
- why a more restrictive policy decision won when multiple layers applied

This is necessary if AgentForge is going to support more workflow domains without becoming opaque.

## Implementation Follow-Ups

This design should eventually drive changes in:

- `packages/schemas`
  - lifecycle overlay and approval-class schema additions
- `packages/shared-types`
  - typed overlay and approval-class contracts
- `packages/policy-engine`
  - precedence logic and narrowing semantics
- `packages/runtime`
  - effect-to-approval-class mapping and audit recording
- workflow definitions
  - explicit lifecycle-domain metadata from [#76](https://github.com/H9-Foundry/AgentForge/issues/76)

## Relationship To Other Phase 1 Issues

- [#74](https://github.com/H9-Foundry/AgentForge/issues/74)
  - slice access rules should be narrowed by lifecycle overlays
- [#76](https://github.com/H9-Foundry/AgentForge/issues/76)
  - workflow metadata should identify the lifecycle domain that selects the overlay
- [#77](https://github.com/H9-Foundry/AgentForge/issues/77)
  - artifacts should record the effective lifecycle policy context where relevant
- [#78](https://github.com/H9-Foundry/AgentForge/issues/78)
  - planning/discovery workflow MVP should use the `plan` overlay
- [#79](https://github.com/H9-Foundry/AgentForge/issues/79)
  - architecture/design workflow MVP should use the `design` overlay

## Recommended Implementation Order

1. finalize lifecycle overlay families
2. finalize precedence and narrowing semantics
3. finalize approval-class taxonomy
4. add schema/types for overlays and approval classes
5. implement effective-policy resolution and audit visibility

That keeps policy explicit and conservative before broader workflow execution is introduced.
