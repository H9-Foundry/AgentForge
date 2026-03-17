# Planning And Discovery Workflow MVP

This document defines the design target for issue [#78](https://github.com/H9-Foundry/AgentForge/issues/78).

It describes the first planning/discovery workflow wedge AgentForge should add beyond `pr-review`.

It does **not** claim that this workflow is implemented or officially shipped today.

## Why This Exists

AgentForge currently begins at review:

- one official local `pr-review` workflow
- one secure runtime path through context, policy, audit, and reporting
- no official workflow for turning an early request into a scoped plan

That leaves the platform unable to support the start of the lifecycle even though the runtime, policy, manifest, and artifact contracts are now broad enough to define it safely.

## MVP Goal

The MVP should let a maintainer or evaluator take a bounded planning request and produce one structured planning brief that:

- frames the problem
- identifies relevant repository areas
- captures constraints and assumptions
- defines in-scope and out-of-scope work
- records open questions
- recommends next implementation slices

The workflow should stay:

- local-first
- read-only by default
- approval-free for the normal success path
- explicit about deterministic versus reasoning steps
- auditable through the existing runtime and audit bundle

## User Jobs

The first workflow wedge should solve these jobs:

1. turn a rough repository change request into a scoped planning brief
2. inspect repository context to identify likely impact areas and constraints
3. surface missing information before implementation starts
4. propose bounded next steps that can become issues or implementation slices

The MVP should optimize first for:

- maintainers working from an issue or local request
- contributors trying to understand what to build next
- local repository execution on the current CLI surface

## Non-Goals

This MVP should not:

- implement architecture/design review yet
- create or edit source files automatically
- require GitHub network access for the normal path
- expand the current side-effect posture
- turn AgentForge into a conversational intake shell

## Current Baseline

Available now:

- manual workflow trigger
- `context-collector`
- report node support
- lifecycle artifact schemas including `planning-brief`
- lifecycle artifact sanitization and audit linkage
- manifest metadata design and lifecycle policy overlay design

Not yet available:

- an official planning workflow asset
- a starter planning/discovery agent
- a stable planning request input contract
- CLI guidance for running a planning/discovery wedge

## Recommended MVP Wedge

### Workflow Identity

- workflow name: `planning-discovery`
- trigger: `manual`
- primary lifecycle domain: `plan`
- support level at first implementation: `official`
- maturity at first implementation: `mvp`

### Entry Model

The first evaluator path should stay CLI-first without expanding the command surface.

Recommended input model:

- keep `agentforge run <workflow>` as the invocation shape
- add a repo-local planning request document under `.agentops/requests/planning.yaml`
- treat that request document as the normal input for `run planning-discovery`

This keeps the first implementation workflow-first rather than prompt-first, and avoids needing a new free-form CLI argument surface before the workflow exists.

### Planning Request Contract

The request document should include:

- `problemStatement` as required
- `goals` as optional list
- `constraints` as optional list
- `issueRefs` as optional list of local or repository issue references
- `pathHints` as optional list of repository paths
- `assumptions` as optional list supplied by the requester

The MVP should reject empty or underspecified requests deterministically before any reasoning node runs.

## Workflow Stages

The MVP should use four stages.

### 1. Intake Normalization

Type:

- deterministic

Responsibilities:

- load `.agentops/requests/planning.yaml`
- validate required fields
- normalize issue references and path hints
- reject incomplete input deterministically

Outputs:

- normalized planning request
- input validation findings if blocked

### 2. Repository Discovery

Type:

- deterministic

Responsibilities:

- assemble bounded repository context using existing context-slice rules
- prioritize requested path hints when present
- capture repository signals relevant to the request:
  - repository metadata
  - branch/worktree status
  - diff summary when relevant
  - nearby files and package boundaries

Preferred implementation surface:

- reuse `context-collector`

Outputs:

- discovery context slice
- requested versus provided context trace

### 3. Planning Analysis

Type:

- reasoning

Responsibilities:

- synthesize the planning brief from normalized request plus discovery context
- distinguish deterministic facts from planning judgments
- produce:
  - objectives
  - constraints
  - assumptions
  - in-scope/out-of-scope boundaries
  - open questions
  - recommended next steps

Preferred starter agent:

- new `planning-analyst`

Outputs:

- `planning-brief` lifecycle artifact

### 4. Report

Type:

- report

Responsibilities:

- render a compact markdown summary from the planning brief
- preserve the audit bundle as the execution trace

Outputs:

- audit bundle
- markdown summary
- planning brief artifact persisted in workflow state/audit linkage

## Deterministic Vs Agentic Boundaries

Deterministic responsibilities:

- request loading and validation
- issue-ref normalization
- path filtering and context-slice budgeting
- repository metadata collection
- artifact persistence and audit linkage

Reasoning responsibilities:

- problem framing
- scope analysis
- assumptions and open-question synthesis
- recommended next-step proposals

The planning brief must keep these boundaries visible in the artifact:

- deterministic repository facts should stay attributable to context collection
- synthesized recommendations should stay attributable to the planning-analysis node

## Artifact Contract

Primary lifecycle artifact:

- `planning-brief`

The payload should minimally include:

- `problemStatement`
- `objectives`
- `constraints`
- `assumptions`
- `inScope`
- `outOfScope`
- `recommendedNextSteps`

The MVP should also populate when available:

- `risks`
- `openQuestions`
- `candidateWorkstreams`
- `linkedIssues`

The audit bundle remains the execution trace. The planning brief is the domain artifact.

## Policy And Approval Posture

The MVP should use the `plan` lifecycle posture described in [docs/POLICY_LIFECYCLE_OVERLAYS.md](POLICY_LIFECYCLE_OVERLAYS.md).

Expected policy shape for the first implementation:

- read-only by default
- no repository writes in the normal path
- no network widening
- no external-system mutation
- model access only for the planning-analysis node when policy allows reasoning

The normal success path should not require side-effect approvals because it should only:

- read repository context
- emit structured artifacts
- write workflow outputs under the existing local run directory

## Starter Agents And Adapters

### Reuse

- `context-collector`
- existing report node behavior
- existing local filesystem/git/context surfaces

### New Starter Agent

- `planning-analyst`

Responsibilities:

- consume normalized request plus discovery context
- emit one `planning-brief`
- avoid architecture-level design decisions that belong to `#79`

### Explicitly Deferred

- dedicated GitHub issue-hydration adapter behavior
- network-backed intake
- planning-specific write-capable adapters
- multi-step collaborator orchestration

## First Evaluator Path

The MVP should inherit the CLI-first framing established by the newcomer-usability lane.

The first supported evaluator path should be:

1. `agentforge init`
2. create `.agentops/requests/planning.yaml`
3. `agentforge run planning-discovery`
4. inspect the planning brief artifact and summary
5. `agentforge explain last-run`

This path should be documented when the workflow is implemented, but not claimed as available before then.

## Follow-On Implementation Slices

This design should decompose into at least these child issues:

1. add the request schema and official `planning-discovery` workflow asset
2. implement the `planning-analyst` starter agent and planning brief artifact emission path
3. wire planning workflow manifests to catalog metadata and `plan` lifecycle-policy expectations
4. add CLI/docs onboarding for the planning-discovery evaluator path once the workflow exists

## Completion Criteria For This Design Issue

This issue is complete when:

- the planning/discovery workflow MVP is documented end to end
- inputs, outputs, stages, and policy posture are explicit
- deterministic versus agentic boundaries are explicit
- starter agent/adapter reuse is identified
- follow-on implementation issues are opened

## Relationship To The Next Slice

The next design issue, [#79](https://github.com/H9-Foundry/AgentForge/issues/79), should treat this planning brief as an upstream artifact.

Architecture/design workflow work should build on:

- the planning request and discovery posture defined here
- the `planning-brief` artifact family
- the same CLI-first, workflow-first local execution posture
