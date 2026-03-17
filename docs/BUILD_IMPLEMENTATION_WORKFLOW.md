# Build And Implementation Workflow MVP

This document defines the design target for issue [#53](https://github.com/H9-Foundry/AgentForge/issues/53).

It describes the first build/implementation workflow wedge AgentForge should add after planning/discovery and architecture/design.

It does **not** claim that this workflow is implemented or officially shipped today.

## Why This Exists

AgentForge can now define what to build and how the repository should change, but it still stops before controlled implementation work begins.

Without an explicit build/implementation workflow:

- implementation requests remain informal and hard to audit
- write-intent boundaries are not captured as workflow policy
- deterministic preflight checks are not separated cleanly from agentic proposal work
- build/test readiness cannot be tied to implementation artifacts explicitly

## MVP Goal

The MVP should let a maintainer take a design record and produce one bounded implementation proposal that:

- identifies the intended repository edits
- records deterministic preflight checks and blocked conditions
- distinguishes proposal generation from side-effectful apply/build steps
- captures approval-gated next actions for patch application and validation

The workflow should remain:

- workflow-first, not chat-first
- read-only by default
- explicit about where approval-gated side effects begin
- auditable through the existing runtime and lifecycle artifact model

## User Jobs

The first workflow wedge should solve these jobs:

1. turn a design record into a bounded implementation proposal
2. identify the exact packages, files, and interfaces expected to change
3. separate deterministic repository/build checks from agentic implementation reasoning
4. prepare approval-gated apply/build steps without executing them by default

The MVP should optimize first for:

- maintainers turning a design decision into bounded implementation work
- contributors who need a controlled implementation plan before editing
- local repository execution on the current CLI surface

## Non-Goals

This MVP should not:

- provide unrestricted autonomous code writing
- apply patches or run write-heavy build steps automatically on the default path
- replace standard developer review before merge
- broaden network or filesystem side-effect permissions

## Current Baseline

Available now:

- planning and design workflow design targets
- lifecycle artifact envelopes and family schemas
- lifecycle artifact sanitization and audit linkage
- runtime/policy contracts for capability envelopes and side-effect classes
- one official `pr-review` workflow and release/readiness tooling

Not yet available:

- an official build/implementation workflow asset
- an implementation proposal artifact emitted by the runtime
- approval-class wiring for proposal versus apply/build execution
- deterministic build-target inventory as workflow output

## Recommended MVP Wedge

### Workflow Identity

- workflow name: `implementation-proposal`
- trigger: `manual`
- primary lifecycle domain: `build`
- support level at first implementation: `official`
- maturity at first implementation: `mvp`

### Entry Model

The first evaluator path should stay CLI-first without expanding the command surface.

Recommended input model:

- keep `agentforge run <workflow>` as the invocation shape
- add a repo-local request document under `.agentops/requests/implementation.yaml`
- require that request document to reference a prior design record artifact

### Implementation Request Contract

The request document should include:

- `designRecordRef` as required
- `implementationGoal` as required
- `targetPaths` as optional list
- `validationCommands` as optional allowlisted list
- `constraints` as optional list
- `approvalMode` as required enum describing whether the run is proposal-only or apply-capable

The MVP should reject a request without a valid design record or explicit approval mode before any reasoning node runs.

## Workflow Stages

The MVP should use five stages.

### 1. Implementation Intake Normalization

Type:

- deterministic

Responsibilities:

- load `.agentops/requests/implementation.yaml`
- validate required fields
- load and validate the referenced design record artifact
- normalize target paths and validation commands

Outputs:

- normalized implementation request
- validated design record input
- deterministic findings if blocked

### 2. Repository And Build Discovery

Type:

- deterministic

Responsibilities:

- assemble bounded repository context for the implementation target
- identify affected packages and entrypoints
- identify known build/test scripts and validation surfaces
- reject unsafe or disallowed requested commands

Outputs:

- implementation context slice
- deterministic affected-surface inventory
- allowed validation command set

### 3. Implementation Analysis

Type:

- reasoning

Responsibilities:

- translate the design record into a bounded implementation proposal
- describe expected edits, risks, and unknowns
- propose an execution order for edits and validation

Preferred starter agent:

- new `implementation-planner`

Outputs:

- `implementation-proposal` lifecycle artifact

### 4. Approval-Gated Apply Planning

Type:

- deterministic plus policy

Responsibilities:

- classify which follow-on actions would be read-only versus side-effectful
- map apply/build/test steps to approval classes
- preserve the default path as proposal-only

Outputs:

- gated action plan
- explicit approval requirements

### 5. Report

Type:

- report

Responsibilities:

- render a compact markdown summary from the implementation proposal
- preserve the audit bundle as the execution trace

Outputs:

- audit bundle
- markdown summary
- implementation proposal artifact persisted in workflow state and audit linkage

## Deterministic Vs Agentic Boundaries

Deterministic responsibilities:

- request loading and validation
- design-record reference validation
- path filtering and context budgeting
- package/build/test inventory collection
- command allowlisting
- action-plan approval classification
- artifact persistence and audit linkage

Reasoning responsibilities:

- proposed edit plan
- sequencing recommendations
- implementation risk synthesis
- uncertainty and rollback considerations

## Trust And Policy Boundaries

The MVP must keep the current security posture intact:

- proposal generation is read-only by default
- any patch application, build write, or network side effect remains approval-gated
- requested commands must be allowlisted before they can be surfaced as candidate validation steps
- policy overrides the workflow request, starter agent defaults, and any proposed apply step

## Required Artifacts

Primary lifecycle artifact:

- `implementation-proposal`

The payload should minimally include:

- `designRecordRef`
- `implementationGoal`
- `affectedPaths`
- `proposedChanges`
- `validationPlan`
- `approvalRequiredSteps`
- `risks`
- `openQuestions`

Follow-on implementation should also add a deterministic companion inventory artifact or embedded section for:

- package impacts
- allowed validation commands
- blocked side-effect classes

## Required Deterministic Nodes, Agents, And Adapters

Deterministic needs:

- implementation-request validator
- affected-surface collector
- allowlisted command inventory
- approval-class mapper

Starter agent need:

- `implementation-planner`

Adapter expectations:

- filesystem and shell adapters remain tightly policy-gated
- no unrestricted shell execution
- no new unrestricted write path

## Follow-On Implementation Slices

This epic should be decomposed into at least:

1. implementation request schema and official `implementation-proposal` workflow asset
2. `implementation-planner` starter agent and `implementation-proposal` artifact emission
3. deterministic affected-surface and allowlisted validation-command inventory
4. approval-gated apply/build execution mediation that preserves read-only defaults

