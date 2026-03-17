# Platform Vision

## Positioning

AgentForge is the open-source workflow/runtime core for secure, repository-aware SDLC automation.

It is not trying to become a generic chat shell with tools attached. The platform model is:

- workflows define intent
- context assembly stays minimal and explicit
- policy decides what is allowed
- runtime decides what actually executes
- tools remain explicit adapters
- humans approve side effects when policy requires it

## Product Wedge

The current wedge is intentionally narrow:

- one official local `pr-review` workflow
- one secure-by-default runtime path from config loading through audit output
- one coherent set of policy, trust, redaction, and release controls

This wedge proves the core operating model before AgentForge expands across the rest of the SDLC.

## Problem Framing

Engineering teams increasingly want automation that can reason about repositories, diffs, policies, and release processes. The current market usually forces a bad tradeoff:

- deterministic CI that is rigid but explainable
- agentic assistants that are flexible but often under-governed

AgentForge is designed to close that gap by keeping deterministic control around bounded reasoning.

## Core Principles

- workflow-first, not chat-first
- secure by default
- read-only by default
- approval-gated side effects
- deterministic before agentic
- minimal context slices
- structured outputs
- auditable actions
- plugin-extensible architecture
- honest capability boundaries

## Personas

### Maintainers

Need a safe way to automate repository workflows without turning the repo into an unconstrained agent sandbox.

### Platform Engineers

Need reusable runtime, policy, audit, and workflow contracts for internal engineering automation.

### Security And Governance Owners

Need explicit policy gates, trust metadata, redaction, side-effect approvals, and audit bundles that can be inspected after the fact.

### Contributors And Plugin Authors

Need a clear extension surface for workflows, agents, adapters, and plugins without guessing at hidden behavior.

## Near-Term Expansion

AgentForge should expand from the `pr-review` wedge into adjacent SDLC workflows while preserving the same execution model:

- planning and discovery
- architecture and design review
- build and implementation assistance
- review, test, and QA
- security and compliance
- release and CI/CD
- operations and incident response handoff
- maintenance, upgrades, and documentation hygiene

## Longer-Term Platform Direction

Longer-term platform work is expected to include:

- a broader catalog of official workflows
- richer official agents and deterministic nodes
- more SCM/CI and observability adapters
- stronger evals and benchmarking
- plugin and registry-facing lifecycle support
- compatibility matrices and enterprise governance features

These are platform directions, not shipped capabilities today.

## Strategic Boundaries

AgentForge should not:

- weaken policy defaults for convenience
- treat untrusted repository content as instruction authority
- hide side effects behind prompts
- imply support for workflows or integrations that do not exist
- couple all lifecycle domains into one monolithic package

## Current Reality vs Vision

### Current Reality

- secure workflow runtime core is real
- policy engine, context engine, schemas, audit, and CLI are real
- release and publishing hardening are real
- plugin trust baseline is real
- lifecycle coverage outside `pr-review` is mostly not built yet

### Platform Vision

Expand the same secure operating model into a general-purpose SDLC automation platform, without abandoning determinism, policy control, or auditability.
