# Architecture And Design Workflow MVP

This document records the design target from issue [#79](https://github.com/H9-Foundry/AgentForge/issues/79) and the first shipped implementation slices [#132](https://github.com/H9-Foundry/AgentForge/issues/132) through [#136](https://github.com/H9-Foundry/AgentForge/issues/136).

It describes the first architecture/design workflow wedge that now follows the planning/discovery workflow defined in [docs/PLANNING_DISCOVERY_WORKFLOW.md](PLANNING_DISCOVERY_WORKFLOW.md).

The workflow is implemented as an official local wedge, but the broader build, QA, security, release, and operations families remain planned.

## Why This Exists

Planning/discovery can define what should be built next, but it does not answer how the repository should change.

AgentForge needs an explicit architecture/design wedge so maintainers can turn a planning brief into one structured design record before implementation starts.

Without this workflow:

- design decisions stay buried in issue comments and ad hoc markdown
- interface and package impacts are not captured consistently
- implementation work starts before trade-offs are made explicit
- follow-on build/test/security/release workflows have no stable upstream design artifact

## MVP Goal

The MVP should let a maintainer or evaluator take a bounded planning brief and produce one structured design record that:

- summarizes the decision to be made
- identifies the current repository context that matters
- compares candidate approaches
- records a chosen approach and trade-offs
- surfaces risks, schema/policy impacts, and follow-up implementation work

The workflow should remain:

- local-first
- read-only by default
- approval-free on the normal success path
- explicit about deterministic versus reasoning steps
- auditable through the existing runtime and audit bundle

## User Jobs

The first workflow wedge should solve these jobs:

1. turn a planning brief into a design decision record
2. identify which packages, interfaces, schemas, or policy surfaces are likely impacted
3. compare viable approaches before implementation begins
4. record downstream work items for implementation and validation

The MVP should optimize first for:

- maintainers turning scoped planning work into a design decision
- contributors who need a bounded design before coding
- local repository execution on the current CLI surface

## Non-Goals

This MVP should not:

- generate production code automatically
- replace full architecture decision record systems across every use case
- cover visual design or product design tooling
- require network-backed issue or spec ingestion in the normal path
- broaden the current side-effect posture

## Current Baseline

Available now:

- official workflow asset: `.agentops/workflows/architecture-design-review.yaml`
- schema-validated request input at `.agentops/requests/design.yaml`
- deterministic design intake plus impacted-surface inventory collection
- `design-analyst` starter agent
- lifecycle artifact emission for `design-record`
- audit-bundle persistence and markdown reporting for the design artifact

Remaining gaps:

- deterministic inventory is heuristic rather than full static analysis
- no code-generation or implementation workflow handoff yet
- no network-backed design intake in the normal path

## Recommended MVP Wedge

### Workflow Identity

- workflow name: `architecture-design-review`
- trigger: `manual`
- primary lifecycle domain: `design`
- support level at first implementation: `official`
- maturity at first implementation: `mvp`

### Entry Model

The evaluator path stays CLI-first without expanding the command surface.

Current input model:

- keep `agentforge run <workflow>` as the invocation shape
- add a repo-local design request document under `.agentops/requests/design.yaml`
- require that request document to reference a prior planning brief artifact

That keeps this wedge workflow-first and makes the dependency on planning/discovery explicit instead of implicit.

### Design Request Contract

The request document should include:

- `planningBriefRef` as required
- `decisionTarget` as required
- `constraints` as optional list
- `pathHints` as optional list
- `alternatives` as optional list of candidate approaches to compare
- `questions` as optional list of specific design questions

The MVP should reject a request without a valid planning-brief reference deterministically before any reasoning node runs.

## Workflow Stages

The MVP should use four stages.

### 1. Design Intake Normalization

Type:

- deterministic

Responsibilities:

- load `.agentops/requests/design.yaml`
- validate required fields
- load and validate the referenced planning brief artifact
- normalize decision target, alternatives, and path hints

Outputs:

- normalized design request
- validated planning brief input
- deterministic validation findings if blocked

### 2. Repository And Interface Discovery

Type:

- deterministic

Responsibilities:

- assemble bounded repository context relevant to the design question
- prioritize packages, files, and interfaces implicated by the planning brief and path hints
- collect the current state of likely impacted surfaces:
  - package boundaries
  - public entrypoints
  - schema references
  - policy/config touch points when identifiable

Preferred implementation surface:

- reuse `context-collector`
- add a bounded deterministic design-context collector only if the existing collector cannot express interface impact cleanly

Outputs:

- design discovery context slice
- impacted-surface inventory
- requested versus provided context trace

### 3. Design Analysis

Type:

- reasoning

Responsibilities:

- compare candidate approaches
- select or recommend a preferred design
- identify trade-offs, risks, and downstream implications
- produce:
  - chosen approach
  - trade-offs
  - compatibility and migration notes when relevant
  - follow-up implementation work

Preferred starter agent:

- new `design-analyst`

Outputs:

- `design-record` lifecycle artifact

### 4. Report

Type:

- report

Responsibilities:

- render a compact markdown summary from the design record
- preserve the audit bundle as the execution trace

Outputs:

- audit bundle
- markdown summary
- design record artifact persisted in workflow state/audit linkage

## Deterministic Vs Agentic Boundaries

Deterministic responsibilities:

- request loading and validation
- planning-brief reference validation
- path filtering and context-slice budgeting
- package/interface/schema inventory collection
- artifact persistence and audit linkage

Reasoning responsibilities:

- option comparison
- chosen approach rationale
- trade-off framing
- risk synthesis
- follow-up implementation proposal

The design record must keep those boundaries visible:

- repository/package/interface facts should remain attributable to deterministic discovery
- selected approach and rationale should remain attributable to the design-analysis node

## Artifact Contract

Primary lifecycle artifact:

- `design-record`

The payload should minimally include:

- `decisionSummary`
- `context`
- `optionsConsidered`
- `chosenApproach`
- `tradeOffs`
- `risks`
- `followUpWork`

The MVP should also populate when available:

- `interfacesImpacted`
- `schemaChangesNeeded`
- `policyChangesNeeded`
- `migrationNotes`
- `compatibilityNotes`

The planning brief remains the upstream artifact. The audit bundle remains the execution trace.

## Policy And Approval Posture

The MVP should use the `design` lifecycle posture described in [docs/POLICY_LIFECYCLE_OVERLAYS.md](POLICY_LIFECYCLE_OVERLAYS.md).

Expected policy shape for the first implementation:

- read-only by default
- no repository writes in the normal path
- no network widening
- no external-system mutation
- bounded reasoning only for the design-analysis node when policy allows model access

The normal success path should not require side-effect approvals because it should only:

- read repository context
- read a prior planning brief artifact
- emit structured artifacts
- write workflow outputs under the existing local run directory

## Starter Agents And Adapters

### Reuse

- `context-collector`
- existing report node behavior
- existing local filesystem/git/context surfaces
- planning brief artifact from the planning/discovery wedge

### New Starter Agent

- `design-analyst`

Responsibilities:

- consume the validated planning brief plus design discovery context
- emit one `design-record`
- stay focused on architecture and implementation-shaping decisions, not release or incident behavior

### Explicitly Deferred

- network-backed issue/spec ingestion
- visual design tooling
- code-writing or code-editing agents
- architecture workflow variants for different tech stacks

## First Evaluator Path

The implemented wedge inherits the CLI-first framing established earlier in Phase 1.

The current supported evaluator path is:

1. run `planning-discovery` and produce a planning brief
2. create `.agentops/requests/design.yaml` referencing that planning brief
3. `agentforge run architecture-design-review`
4. inspect the design record artifact and summary
5. `agentforge explain last-run`

## Next Hardening Slices

The first implementation wave is now landed. The next hardening work should focus on:

1. a richer deterministic impacted-interface/schema/policy inventory
2. stronger lifecycle-policy overlays for the `design` domain
3. cleaner implementation and QA handoff from the emitted `design-record`
4. workflow variants for larger repositories and deeper design reviews

## Completion Criteria For This Design Issue

This issue is complete when:

- the architecture/design workflow MVP is documented end to end
- its dependency on planning/discovery artifacts is explicit
- inputs, outputs, stages, and policy posture are explicit
- deterministic versus agentic boundaries are explicit
- starter agent/adapter reuse is identified
- follow-on implementation issues are opened

## Relationship To Later Workflow Slices

Later workflow families should treat this design record as an upstream artifact.

In particular:

- build/implementation workflows should consume the chosen approach and follow-up work
- test/QA workflows should consume interfaces, risks, and compatibility notes
- security/release workflows should reuse any declared policy/schema impacts rather than rediscovering them from scratch
