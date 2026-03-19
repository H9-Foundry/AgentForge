# Evals And Benchmarks Framework

This document defines the design target for issue [#63](https://github.com/H9-Foundry/AgentForge/issues/63).

It describes how AgentForge should measure workflow quality, safety, and regression over time.

It does **not** claim that benchmark comparison or hosted eval orchestration is implemented today.

## Why This Exists

The repository already has:

- unit and integration tests
- CLI smoke tests
- release verification
- local dogfooding against the current wedge

But those checks are not a dedicated evaluation framework for workflow quality and safety.

## Design Goal

The first eval/benchmark roadmap should:

- separate deterministic regression checks from model-dependent evaluations
- define shared artifacts for eval specs, eval runs, and benchmark summaries
- keep provider-specific concerns out of the core contract
- make workflow quality measurable as the catalog expands

## Current Baseline

Available now:

- schema fixtures and runtime tests
- release verification
- local dogfooding for `pr-review`
- `eval-spec` schema plus a deterministic local fixture corpus for the current official workflow surface
- local eval runner via `agentforge eval run <spec-id>`
- `eval-result` lifecycle artifact emission for deterministic local evals
- support matrix and roadmap framing

Not yet available:

- workflow-scoring contracts
- repeatable regression comparison across workflow versions
- benchmark comparison and regression reporting

## Framework Layers

### Layer 1: Deterministic Eval Specs

Define a contract for:

- workflow input fixtures
- expected deterministic outputs
- redaction and policy expectations
- baseline regression assertions

This layer should be provider-agnostic and CI-friendly.

### Layer 2: Local Eval Runs

The first implemented eval runner is intentionally narrow:

- local-first only
- deterministic fixture execution only
- no provider scoring
- no hosted orchestration
- one `eval-result` artifact per eval run

The initial CLI surface is:

- `agentforge eval run <spec-id>`

Each eval run should:

- resolve one built-in eval spec
- execute the referenced workflow locally
- compare deterministic expectations against the resulting workflow bundle
- emit `eval-result` into the normal run bundle for later comparison

### Layer 3: Model-Dependent Eval Runs

Define a contract for:

- model or agent under test
- fixture inputs
- scored outputs and rubric criteria
- safety and quality dimensions

This layer should keep scoring explicit and comparable, not magical.

### Layer 4: Benchmarks And Trend Reporting

Define how AgentForge should compare:

- workflow versions
- agent variants
- quality and safety regressions
- provider differences when relevant

This layer should consume the earlier artifacts rather than invent its own ad hoc output.

## Non-Goals

This roadmap should not:

- claim evaluation guarantees before infrastructure exists
- tie evals to one model provider prematurely
- conflate product telemetry with workflow evaluation
- turn benchmarks into public marketing claims before they are stable

## Trust And Policy Boundaries

- eval fixtures must remain local and explicit by default
- model-dependent runs must preserve redaction and policy posture
- benchmark comparisons must distinguish deterministic facts from rubric judgments
- external eval providers or hosted services remain future-facing and explicit

## Required Artifacts And Contracts

The roadmap should eventually introduce:

- `eval-spec`
- `eval-result`
- `benchmark-summary`

The first phase now defines `eval-spec`, a deterministic fixture corpus, and a bounded local eval runner that emits `eval-result`. The later phase still needs to implement `benchmark-summary` behavior.

## Relationship To Workflow Growth

Evals should grow with the workflow catalog:

- first for `pr-review`
- then for planning/design workflows
- then for build, QA, security, release, maintenance, and operations workflows

The eval framework should never assume a broader workflow surface than the support matrix currently claims.

## Follow-On Implementation Slices

This epic should be decomposed into at least:

1. eval-spec schema and deterministic fixture corpus for core workflows
2. local eval runner with deterministic expectation checks and `eval-result` artifact emission
3. benchmark comparison and regression-reporting surface for workflow and agent variants
