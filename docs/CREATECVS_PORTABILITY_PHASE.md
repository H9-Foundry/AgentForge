# CreateCVs Portability Phase

This document defines the first external portability phase after the AgentForge-on-AgentForge dogfood benchmark.

It is an operational benchmark playbook, not a shipped runtime workflow or hosted integration promise.

For the pre-benchmark smoke that validated the current `main` repo-fit onboarding slice against CreateCVs, see [docs/CREATECVS_PORTABILITY_SMOKE.md](CREATECVS_PORTABILITY_SMOKE.md).

Use it only after the AgentForge-first benchmark loop is stable enough to support comparison in another repository without changing the benchmark rules mid-stream.

## Goal

Prove that the current published AgentForge CLI and official workflow surface can improve SDLC behavior in a second real repository without relying on AgentForge-repo-specific maintainer intuition.

The first portability target is:

- `CreateCVs`
- repository: [H9-Foundry/CreateCVs](https://github.com/H9-Foundry/CreateCVs)
- feedback sink: [CreateCVs issue #119](https://github.com/H9-Foundry/CreateCVs/issues/119)

## Preconditions

Do not start this phase until all of these are true:

- the AgentForge-first benchmark has at least three live tasks recorded
- the local benchmark-ledger tooling is available and stable enough to support adjudicated `/outcomes` review
- the Outcomes page no longer overcounts a single blocked release chain across pipeline, deployment, and promotion
- the CreateCVs embedded pilot contract is merged in the target repository

## Scope

The portability phase is still:

- local-only
- advisory-gated
- read-only by default
- CLI-first

It is not:

- a hosted service test
- a multi-repo aggregation benchmark
- a broad plug-and-play claim for less technical users

## Benchmark Model

Use the same comparison model as the AgentForge-first benchmark:

- **Control arm:** same agent, same repo, same task brief style, same validations, no AgentForge workflow requirement
- **Treatment arm:** same agent, same repo, same task brief style, relevant AgentForge workflows required through the embedded CreateCVs pilot contract

The portability phase measures process value, not model quality.

## Task Mix

Run at least three portability tasks in `CreateCVs`.

Required mix:

- one feature or UI/content task
- one cross-domain or security-sensitive task
- one release, pipeline, deployment, or promotion review task

Preferred examples:

- onboarding or dashboard UX change
- auth, Supabase, export, billing, or edge-function change
- release/deployment candidate review using the published release/CI review family

## Workflow Routing

Follow the embedded CreateCVs pilot contract exactly.

### Feature / UI / Content

- `planning-discovery`
- `implementation-proposal`
- `qa-review`
- `pr-review`

### Cross-Domain / Risk-Sensitive

- `planning-discovery`
- `architecture-design-review`
- `implementation-proposal`
- `qa-review`
- `security-review`
- `pr-review`

### Release / Deployment Review

- `release-readiness`
- `pipeline-evidence-review`
- `deployment-gate-review`
- `promotion-approval`

## Evidence

Use CreateCVs-native evidence only. Do not add benchmark-only validation commands.

Default validation surface:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run test:e2e` when relevant
- `npm run journeys:check`
- `npm run resources:audit`

Important repo context:

- `docs/user-journeys.md`
- `docs/ux-spec.md`
- `docs/qa-checklist.md`
- `docs/release-runbook.md`
- `docs/github-hardening.md`

## Outputs

For every treatment task:

- run the relevant AgentForge workflow set
- inspect `.agentops/runs/<run-id>/bundle.json`
- inspect `.agentops/runs/<run-id>/summary.md`
- append a structured comment to [CreateCVs issue #119](https://github.com/H9-Foundry/CreateCVs/issues/119)

For the benchmark comparison:

- keep one local benchmark ledger entry per arm when adjudication is complete
- use the same benchmark field set as the AgentForge-first benchmark wherever possible

## Success Bar

Do not treat the portability phase as successful until all of these are true:

- at least one CreateCVs task shows a real decision change or meaningful risk catch in the AgentForge arm
- the embedded pilot contract can be followed without repeated user command prompts
- the portability tasks expose at least one reusable workflow value and at least one concrete friction theme
- the CreateCVs results do not depend on AgentForge-repo-specific context to stay interpretable

## What To Learn

This phase should answer:

- which official workflows still transfer cleanly into a non-AgentForge repository
- where request authoring or evidence collection is still too heavy
- whether the published CLI surface is sufficient without source-build knowledge
- whether the Outcomes dashboard remains understandable outside the home repo

## Decision After This Phase

After the first bounded CreateCVs phase, choose one of three paths:

- continue external portability work if the benchmark remains clean and useful
- refine one or two noisy workflows if portability exposed reusable friction
- stop external expansion temporarily if the benchmark shows the current workflow surface does not generalize cleanly
