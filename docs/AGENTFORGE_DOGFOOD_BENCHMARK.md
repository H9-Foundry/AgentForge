# AgentForge-First Dogfood Benchmark

This document defines how AgentForge should benchmark itself on the AgentForge repository before expanding the benchmark to other repositories.

It is an operational playbook, not a shipped workflow or product guarantee.

Use [#268](https://github.com/H9-Foundry/AgentForge/issues/268) as the benchmark feedback sink and scorecard log.

Use the local benchmark-ledger file at `.agentops/benchmark-ledger.json` as the adjudicated machine-readable overlay for the visualizer. The current internal CLI helpers are:

- `agentforge eval benchmark-ledger --json`
- `agentforge eval benchmark-record <task-id> <control|agentforge> --source <replay|live> --task-type <type> ...`

## Goal

Measure whether AgentForge improves the same agent's SDLC behavior on this repository when compared with that agent's normal default workflow.

The benchmark optimizes first for:

- confirmed risk caught before merge or release decisions
- evidence completeness and decision clarity
- release review quality versus token/cost spend on the same agent/model path

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

Release benchmark entries should use `benchmarkCategory: release` and compare one release candidate review cycle from agent start to final go/no-go recommendation. Do not include publish/deploy side effects or waiting time for external human approvals.

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
- benchmark category: `general` or `release`
- source: `replay` or `live`
- task type
- arm: `control` or `agentforge`
- agent and model
- start and end timestamps
- cycle time seconds
- validations run
- workflow statuses for treatment runs
- confirmed risks or issues caught before merge
- reviewer judgment on validity and severity
- whether AgentForge changed the plan or decision
- release decision and decision clarity for release-category entries
- token usage and optional estimated API cost for release-category entries
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
- release decision clarity
- token/API spend
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

The GitHub comment remains the human source of truth for the benchmark narrative. The ledger exists to make those adjudications visible in the local `/outcomes` visualizer without scraping issue comments.
- keep / tighten / simplify / deprioritize recommendation

The current internal ledger command also supports release-benchmark fields such as:

- `--benchmark-category release`
- `--cycle-time-seconds <seconds>`
- `--release-decision <go|no-go|conditional|unclear>`
- `--decision-clarity <clear|mixed|ambiguous>`
- `--rerun-count <count>`
- `--blocked-state-count <count>`
- `--token-usage <json>`

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

When those conditions are met, move to the first external portability benchmark defined in [docs/CREATECVS_PORTABILITY_PHASE.md](CREATECVS_PORTABILITY_PHASE.md).

## Non-Goals

This benchmark does not:

- create new product runtime surface
- turn dogfood results into public marketing claims
- replace normal repository validation or review
- broaden self-hosted behavior beyond the current narrow-assist posture
