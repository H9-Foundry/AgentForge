# Runtime Interaction Hardening

This document defines the next design layer for AgentForge's runtime interaction model.

It does **not** claim that the behavior below is fully implemented today. It describes the target contract for Phase 1 platform-foundation work so broader SDLC workflows can be added without weakening the current secure-by-default posture.

## Why This Exists

The current runtime is credible for the local `pr-review` wedge:

- ordered workflow nodes
- explicit tool mediation
- approval-gated side effects
- structured audit output

That is not yet enough for a broader SDLC platform. Additional lifecycle workflows will need:

- clearer capability boundaries per workflow node
- clearer effect classes for requested actions
- clearer context-slice contracts
- clearer runtime, policy, schema, and audit handoffs

This design work is the foundation for issues [#73](https://github.com/H9-Foundry/AgentForge/issues/73), [#74](https://github.com/H9-Foundry/AgentForge/issues/74), [#75](https://github.com/H9-Foundry/AgentForge/issues/75), [#76](https://github.com/H9-Foundry/AgentForge/issues/76), and [#77](https://github.com/H9-Foundry/AgentForge/issues/77).

## Current Baseline

Available now:

- workflow nodes declare agent, requested context sections, and allowed tools
- runtime mediates tool access through adapters and policy
- approval-gated tools are blocked before execution
- audit bundles capture findings, proposed actions, redaction metadata, and trust metadata

Still implicit or incomplete:

- what each node is allowed to request beyond a tool allowlist
- how the runtime should distinguish observation, proposal, write, and network effects
- how context slices should be budgeted and truncated across different workflow domains
- how lifecycle-specific policies should be expressed without widening defaults

## Design Goals

- Keep the runtime deterministic before agentic behavior.
- Keep the node contract explicit enough to review statically.
- Keep policy authoritative over side effects and context assembly.
- Keep the audit trail precise enough to explain what was requested, allowed, blocked, or truncated.
- Keep the model broad enough for SDLC expansion without pretending broad workflow coverage already exists.

## Non-Goals

- enabling unrestricted shell execution
- enabling unrestricted network access
- letting workflow definitions bypass policy
- turning workflows into free-form chat sessions
- implementing every runtime, schema, and policy change in one slice

## Proposed Interaction Model

### 1. Capability Envelope Per Node

Each workflow node should have an explicit capability envelope that the runtime can validate before execution.

Proposed envelope categories:

- `context`
  - which slice categories the node may request
  - whether the node may request prior artifacts
- `reasoning`
  - whether bounded model access is permitted
  - whether the node is deterministic-only
- `tools`
  - which adapters/tool names may be requested
- `effects`
  - the highest side-effect class the node may ever request
- `outputs`
  - which artifact or audit surfaces the node may emit

The envelope is a ceiling, not a grant. Policy can narrow it further at runtime.

### 2. Side-Effect Classes

The runtime should classify requested actions into explicit effect classes.

Proposed classes:

- `read_only`
  - repository reads, git inspection, deterministic analysis
- `propose_only`
  - findings, recommendations, plans, patches-as-artifacts, but no external mutation
- `write_approval_required`
  - filesystem or repository writes that require explicit approval
- `network_approval_required`
  - external network calls or remote system mutations that require explicit approval
- `release_approval_required`
  - package publishing, tag creation, deployment, or other release-significant actions

Implications:

- a node that is marked `read_only` cannot escalate itself into write or network behavior
- adapters declare the effect class of each action they expose
- the runtime rejects requests above the node envelope before adapter execution
- policy still decides whether a request within the envelope is allowed, denied, or approval-gated

### 3. Two-Layer Decision Model

The runtime and policy engine should have distinct roles:

- **runtime**
  - validates workflow shape
  - validates node capability envelope
  - validates requested action effect class
  - routes requests through the correct adapter
  - records requested versus executed behavior in audit output
- **policy**
  - resolves whether the requested action is allowed at all
  - applies path, environment, trust, and overlay rules
  - determines whether human approval is required
  - owns redaction and effective-policy reporting

This preserves the principle:

- LLMs reason
- runtime decides
- tools execute
- policy permits
- humans approve side effects

### 4. Context-Slice Contracts

Broader workflows will need more than "requested context sections." The platform should move toward explicit slice contracts.

Proposed slice categories:

- `repo_structure`
- `changed_files`
- `file_content`
- `history`
- `policy_snapshot`
- `workflow_state`
- `prior_artifacts`
- `external_inputs`

Each slice should eventually carry:

- category
- origin
- selection rule
- budget or truncation rule
- redaction status

The runtime should record when a requested slice was:

- fully provided
- partially provided
- truncated for budget reasons
- denied by policy

### 5. Structured Output Boundaries

Every node output should remain structured and typed. For broader SDLC coverage, that means the runtime should distinguish between:

- findings
- proposed actions
- lifecycle artifacts
- audit events

The runtime should not treat free-form markdown as the source of truth. Markdown remains a presentation layer over structured artifacts and audit data.

## Proposed Runtime Handshake

For each node:

1. Load node definition and resolve effective capability envelope.
2. Assemble the smallest allowed context slice set.
3. Invoke deterministic steps first, if present.
4. If bounded reasoning is allowed, invoke the agent/provider with only the allowed state slice.
5. For each requested tool action:
   - map it to an adapter action
   - determine its effect class
   - verify it fits the node envelope
   - pass it through policy evaluation
   - require approval where policy says so
   - execute only after approval if needed
6. Record all requested, denied, approved, executed, and truncated behaviors in the audit bundle.

## Audit Requirements

The audit bundle should eventually make these distinctions explicit:

- requested capability envelope
- effective envelope after policy narrowing
- requested context slices
- provided versus truncated context slices
- requested tool actions
- effect class for each requested action
- policy decision for each requested action
- approval requirement and approval outcome
- executed actions versus blocked actions

That is necessary if AgentForge is going to expand beyond review workflows while staying credible about control boundaries.

## How This Maps To Open Issues

- [#73](https://github.com/H9-Foundry/AgentForge/issues/73)
  - node capability envelopes and side-effect classes
- [#74](https://github.com/H9-Foundry/AgentForge/issues/74)
  - context-slice categories, budgets, and truncation rules
- [#75](https://github.com/H9-Foundry/AgentForge/issues/75)
  - lifecycle-domain policy overlays and approval classes
- [#76](https://github.com/H9-Foundry/AgentForge/issues/76)
  - manifest metadata for SDLC domain, maturity, and trust scope
- [#77](https://github.com/H9-Foundry/AgentForge/issues/77)
  - lifecycle artifact schema design

## Recommended Implementation Order

1. finalize capability envelopes and effect classes
2. finalize context-slice contracts and budget reporting
3. expand policy overlays and approval classes
4. expand manifest metadata and artifact schemas
5. only then start broader workflow MVP implementation

That order preserves the current secure posture while making the platform more general.
