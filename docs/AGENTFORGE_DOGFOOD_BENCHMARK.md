# AgentForge-First Dogfood Benchmark

This document defines how AgentForge should benchmark itself on the AgentForge repository before expanding the benchmark to other repositories.

It is an operational playbook, not a shipped workflow or product guarantee.

Use [#268](https://github.com/H9-Foundry/AgentForge/issues/268) as the benchmark feedback sink and scorecard log.

## Goal

Measure whether AgentForge improves the same agent's SDLC behavior on this repository when compared with that agent's normal default workflow.

The benchmark optimizes first for:

- confirmed risk caught before merge or release decisions
- evidence completeness and decision clarity

It treats the following as secondary:

- cycle time
- workflow friction
- override rate

## Benchmark Model

Use the same agent, model, repository, and task brief style in both arms.

- **Control arm:** the agent follows the normal repository workflow with the same validation commands but does not run AgentForge workflows
- **Treatment arm:** the agent follows the same task brief plus the relevant AgentForge workflows and advisory-gate rules

This benchmark does not try to measure model quality. It measures whether AgentForge improves SDLC outcomes around the same agent.

## Task Source

Run the benchmark in two stages.

### Stage 1: Replay Calibration

Use three to four recent completed AgentForge tasks to calibrate the scorecard quickly.

Recommended replay mix:

- one implementation or review task
- one SCM/CI or release task
- one promotion or deployment review task
- optional one security or reliability-sensitive task

Replay tasks should be used to tune the rubric, not to make final product claims.

### Stage 2: Live Benchmark

Benchmark the next six to eight real AgentForge tasks.

Required live mix:

- feature or refactor work
- schema, runtime, policy, or security-sensitive work
- release, pipeline, deployment, or promotion review work

Final conclusions should be weighted toward the live phase.

## Workflow Routing

Treatment tasks should use this fixed routing.

### Feature Or Refactor Work

- `planning-discovery`
- `implementation-proposal`
- `qa-review`
- `pr-review`

### Schema / Runtime / Policy / Security-Sensitive Work

- `planning-discovery`
- `architecture-design-review`
- `implementation-proposal`
- `qa-review`
- `security-review`
- `pr-review`

### Release / Pipeline / Deployment / Promotion Review

- `release-readiness`
- `pipeline-evidence-review`
- `deployment-gate-review`
- `promotion-approval`

### Incident Or Regression Handling

- `incident-handoff`
- optionally `maintenance-triage`

Control tasks should use the same repository validation commands and evidence sources without any AgentForge workflow requirement.

## Validation Commands

Use the normal repository validation surface in both arms as relevant:

- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:packages` when public package contracts change

Use direct-shell exit checks for long-running test wrappers when needed:

- `pnpm test; echo EXIT:$?`

## Scorecard

Create one scorecard entry per task with these fields:

- task id or link
- source: `replay` or `live`
- task type
- arm: `control` or `agentforge`
- agent and model
- start and end timestamps
- validations run
- workflow statuses for treatment runs
- confirmed risks or issues caught before merge
- reviewer judgment on validity and severity
- whether AgentForge changed the plan or decision
- cycle time
- evidence completeness notes
- friction notes
- override note if treatment proceeded past a blocked or partial result

## Scoring

### Primary Metric: Risk-Caught Index

Only count issues that were surfaced before merge or release and later confirmed by review or validation.

Severity weighting:

- high: release blocker, security issue, or broken critical flow
- medium: missing validation, missing evidence, or important design inconsistency
- low: process improvement only

### Secondary Metrics

- cycle time
- evidence completeness
- reviewer confidence
- override rate
- friction score

## Feedback Loop

Each benchmarked task should add one comment to [#268](https://github.com/H9-Foundry/AgentForge/issues/268) with:

- task summary
- task source
- task type
- arm
- workflows run
- final statuses
- whether AgentForge changed the plan or decision
- confirmed findings
- friction or false positives
- override note if applicable
- keep / tighten / simplify / deprioritize recommendation

After every three benchmarked tasks, summarize:

- workflows that changed decisions
- repeated false positives
- repeated request or evidence friction
- workflows that added little value

## Success Bar Before External Expansion

Do not treat the benchmark as ready to expand to another repository until:

- AgentForge catches at least one meaningful issue class that the default flow misses
- treatment tasks do not show a repeated severe usability failure pattern
- median cycle-time penalty stays acceptable for the team
- at least two workflows clearly produce reusable value instead of generic noise

## Non-Goals

This benchmark does not:

- create new product runtime surface
- turn dogfood results into public marketing claims
- replace normal repository validation or review
- broaden self-hosted behavior beyond the current narrow-assist posture
