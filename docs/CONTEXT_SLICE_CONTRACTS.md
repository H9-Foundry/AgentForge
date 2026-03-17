# Context Slice Contracts

This document defines the design target for issue [#74](https://github.com/H9-Foundry/AgentForge/issues/74).

It describes how AgentForge should represent, budget, truncate, and audit context slices as the platform expands beyond the initial `pr-review` workflow.

It does **not** claim that all of these contracts are implemented in the runtime today.

## Why This Exists

The current context engine already produces a useful workflow-state envelope:

- repository metadata
- change metadata
- execution context
- effective policy snapshot

That is enough for the initial workflow wedge, but it is still too implicit for a broader SDLC platform.

Without explicit context-slice contracts, future workflows will tend to:

- over-assemble repository data
- pass large unstructured blobs to reasoning nodes
- hide truncation decisions
- make audit trails weaker

## Design Goals

- keep context assembly minimal and reviewable
- make slice categories explicit and typed
- make truncation visible instead of implicit
- separate deterministic metadata slices from large-content slices
- let policy narrow context access without silently widening defaults

## Non-Goals

- implementing token-based provider budgeting in this slice
- allowing arbitrary repository dumps into agent inputs
- making context assembly provider-specific
- weakening blocked-path or approval behavior

## Current Baseline

Today, `createWorkflowState()` builds a normalized envelope with:

- `repo`
- `changes`
- `context`
- `policy`
- placeholders for findings, proposed actions, blocked plugins, agent results, and audit trail

What is still missing:

- explicit slice categories
- explicit slice provenance
- explicit budget/truncation metadata
- explicit denied/omitted slice reporting

## Proposed Slice Model

Each slice should eventually be represented as a structured object with:

- `id`
  - unique identifier within the run
- `category`
  - which slice family this belongs to
- `origin`
  - where the data came from
- `selector`
  - what was requested to produce the slice
- `content`
  - the actual structured payload
- `budget`
  - the limit or policy used for assembly
- `status`
  - how fully the request was satisfied
- `redaction`
  - whether redaction was applied

### Proposed Categories

Initial category set:

- `repo_metadata`
- `change_summary`
- `path_inventory`
- `file_excerpt`
- `history_summary`
- `policy_snapshot`
- `workflow_runtime_state`
- `prior_artifact`
- `external_input`

These categories are narrow on purpose. New categories should only be added when they represent a stable new contract, not a one-off workflow convenience.

## Category Definitions

### `repo_metadata`

Purpose:

- stable repository facts needed by most workflows

Typical content:

- repo root
- repo name
- branch
- package manager
- detected languages
- CI/provider flags

Budget rule:

- no truncation expected under normal operation

### `change_summary`

Purpose:

- structured summary of what changed without embedding file bodies

Typical content:

- changed files
- staged files
- untracked files
- impacted paths
- diff stats
- file detail summaries

Budget rule:

- full structured summary preferred
- if the changed-file set is large, truncate only detailed per-file lists first and retain aggregate counts

### `path_inventory`

Purpose:

- bounded lists of files or directories selected for a workflow step

Typical content:

- selected path list
- selection reason
- whether the list came from diff analysis, a manifest, or deterministic scanning

Budget rule:

- cap the item list
- always retain total-match count and truncated count

### `file_excerpt`

Purpose:

- bounded content windows from specific files

Typical content:

- path
- line range or region identifier
- excerpt text
- excerpt rationale

Budget rule:

- never pass full-repository source dumps as one slice
- prefer targeted excerpts
- cap both per-file excerpt size and total slice count per node

### `history_summary`

Purpose:

- bounded repository history or prior-change context

Typical content:

- branch or commit identifiers
- summarized history window
- selected commit metadata

Budget rule:

- summarize first
- expand only when a workflow explicitly requests it and policy permits it

### `policy_snapshot`

Purpose:

- the effective policy information relevant to the current node

Typical content:

- environment
- defaults
- path rules
- plugin rules
- relevant tool decisions

Budget rule:

- include only the effective, relevant subset for the node where possible

### `workflow_runtime_state`

Purpose:

- bounded run-state information from earlier workflow steps

Typical content:

- current workflow
- current node
- prior node outputs by reference
- approval state

Budget rule:

- prefer references and summaries over raw duplication of prior outputs

### `prior_artifact`

Purpose:

- consume outputs from earlier runs or workflow stages

Typical content:

- artifact type
- artifact identifier
- summary metadata
- selected structured payload

Budget rule:

- prefer structured summaries
- retrieve full payloads only when a workflow explicitly depends on them

### `external_input`

Purpose:

- user-provided or system-provided inputs that are not repository-native

Typical content:

- issue metadata
- manual intake fields
- imported design references

Budget rule:

- treat as untrusted input
- summarize and redact before broad reuse

## Slice Status Model

Each requested slice should record one of:

- `full`
  - the request was satisfied completely
- `partial`
  - only part of the requested content was provided
- `truncated`
  - content was reduced because of budget limits
- `denied`
  - policy or path rules blocked the request
- `omitted`
  - the slice was unnecessary or unavailable

This should be auditable, not hidden in implementation details.

## Initial Budget And Truncation Rules

These rules are the proposed default design target for future implementation.

### Structured Metadata First

Prefer full fidelity for:

- repo metadata
- aggregate diff stats
- effective policy metadata
- workflow/run identifiers

These are small and should not be truncated unless something is abnormal.

### Lists Before File Bodies

For larger contexts:

- preserve counts before details
- preserve path summaries before file excerpts
- preserve file excerpts before full file bodies

If something must be dropped, drop the least reusable high-volume detail first.

### Bounded File Content

For `file_excerpt` slices:

- excerpts should be tied to explicit paths and regions
- selection should be reasoned from diff impact, deterministic scanning, or prior findings
- the runtime should never package all changed-file content as the default slice behavior

### Explicit Overflow Reporting

Whenever a slice is truncated, the recorded slice metadata should include:

- requested amount
- provided amount
- truncation reason
- enough summary detail for a human or later workflow step to know what was omitted

## Enforcement Responsibilities

### Context Engine

Should be responsible for:

- deterministic collection of base repository and change metadata
- constructing slice candidates
- applying deterministic budget/truncation rules where possible

### Runtime

Should be responsible for:

- deciding which slice categories a node may request
- binding slice requests to the node capability envelope
- passing only allowed slices to agents or deterministic nodes
- recording requested versus provided slice behavior

### Policy Engine

Should be responsible for:

- restricting slice categories or selectors when policy requires it
- enforcing blocked-path implications before slice assembly
- defining whether certain slice families are denied or narrowed in local vs CI contexts

## Audit Requirements

The audit trail should eventually capture:

- requested slice categories
- selectors used for assembly
- slice status
- truncation events
- denied slice requests
- redaction applied to slices

That visibility is required if AgentForge is going to stay credible as it expands into broader SDLC workflows.

## Implementation Follow-Ups

This design should eventually drive follow-up work in:

- `packages/schemas`
  - slice schemas, status enums, and audit fields
- `packages/shared-types`
  - typed slice contracts
- `packages/context-engine`
  - structured slice assembly and truncation metadata
- `packages/runtime`
  - node-level slice request mediation
- `packages/policy-engine`
  - slice-category and selector restrictions

## Relationship To Other Phase 1 Issues

- [#75](https://github.com/H9-Foundry/AgentForge/issues/75)
  - policy overlays and approval classes must align with slice access rules
- [#76](https://github.com/H9-Foundry/AgentForge/issues/76)
  - workflow metadata should eventually declare which slice categories are expected
- [#77](https://github.com/H9-Foundry/AgentForge/issues/77)
  - lifecycle artifacts should be consumable as `prior_artifact` slices
- [#78](https://github.com/H9-Foundry/AgentForge/issues/78)
  - planning/discovery workflow design should use these slice categories instead of ad hoc context sections

## Recommended Implementation Order

1. finalize slice categories and status model
2. finalize default budget/truncation rules
3. add schema/types for slice metadata
4. add runtime and context-engine reporting for requested versus provided slices
5. add policy-level slice restrictions

That keeps the platform bounded before broader workflow families are introduced.
