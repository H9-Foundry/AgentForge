# Queue Execution Flow

This document defines how maintainers should work through the AgentForge backlog.

It is a **maintainer operating flow**, not a shipped product workflow. The only official runtime workflow remains `.agentops/workflows/pr-review.yaml`, plus the existing release/readiness tooling.

The live execution tracker for this process is [#83](https://github.com/H9-Foundry/AgentForge/issues/83).

## Operating Posture

AgentForge should be used on itself in **narrow-assist mode** while capability expands.

Allowed self-hosted use during queue execution:

- planning and design-doc generation
- PR review, QA, and test-gap detection
- release and readiness verification

Not yet supported as official self-hosted behavior:

- broad autonomous implementation
- broad write-heavy workflow execution
- any queue process represented as a shipped runtime workflow asset

See [docs/SELF_HOSTING.md](SELF_HOSTING.md).

## Queue Lanes

The backlog is managed in four lanes plus one parallel safe lane for newcomer usability work.

### Active Lane

Work that is currently being executed now.

Rules:

- only one active design or implementation slice per core dependency chain
- must already be linked to an issue
- must have explicit validation and dogfooding gates

Current active lane:

1. [#76](https://github.com/H9-Foundry/AgentForge/issues/76) manifest metadata
2. [#77](https://github.com/H9-Foundry/AgentForge/issues/77) artifact schemas
3. child implementation issues under [#50](https://github.com/H9-Foundry/AgentForge/issues/50)
4. child implementation issues under [#48](https://github.com/H9-Foundry/AgentForge/issues/48) and [#49](https://github.com/H9-Foundry/AgentForge/issues/49)

### Ready Lane

Work that is explicitly designed or queued next, but should not start until the active dependency chain is satisfied.

Current ready lane:

5. [#78](https://github.com/H9-Foundry/AgentForge/issues/78) planning/discovery workflow MVP
6. [#79](https://github.com/H9-Foundry/AgentForge/issues/79) architecture/design workflow MVP

### Parallel Safe Lane

Work that improves first-time evaluation and contributor usability without reordering the core foundation dependency chain.

Current parallel safe lane:

- [#97](https://github.com/H9-Foundry/AgentForge/issues/97) CLI-first onboarding and newcomer usability
- [#98](https://github.com/H9-Foundry/AgentForge/issues/98) CLI-first README and quick trial path
- [#99](https://github.com/H9-Foundry/AgentForge/issues/99) first-run output example and artifact walkthrough
- [#100](https://github.com/H9-Foundry/AgentForge/issues/100) quickstart and sample repo external-evaluation flow
- [#101](https://github.com/H9-Foundry/AgentForge/issues/101) contributor onboarding split
- [#102](https://github.com/H9-Foundry/AgentForge/issues/102) CLI help and first-run UX review
- [#116](https://github.com/H9-Foundry/AgentForge/issues/116) sample repo evaluator path alignment
- [#114](https://github.com/H9-Foundry/AgentForge/issues/114) top-level CLI help and command descriptions
- [#115](https://github.com/H9-Foundry/AgentForge/issues/115) plain-text first-run guidance after `run pr-review`

Rules:

- this lane can run in parallel with the active foundation chain when it does not depend on runtime or policy changes
- it must not reorder `#90` through `#94`
- it should optimize first for evaluators trying the current wedge and early contributors making small changes
- `#114` is the current active usability slice, with `#115` ready behind it

### Mapped Lane

Work that is part of the roadmap and ordered relative to dependencies, but not yet active.

Current mapped lane:

7. [#53](https://github.com/H9-Foundry/AgentForge/issues/53) build/implementation workflow support
8. [#54](https://github.com/H9-Foundry/AgentForge/issues/54) test/QA workflow expansion
9. [#55](https://github.com/H9-Foundry/AgentForge/issues/55) security/DevSecOps workflow expansion
10. [#59](https://github.com/H9-Foundry/AgentForge/issues/59) release/CI-CD workflow expansion
11. [#61](https://github.com/H9-Foundry/AgentForge/issues/61) maintenance/dependency/docs workflow expansion
12. [#60](https://github.com/H9-Foundry/AgentForge/issues/60) operations/incident workflow expansion

### Deferred Lane

Work that remains part of the roadmap but should not be pulled forward until earlier workflow and contract work exists.

Current deferred lane:

- [#62](https://github.com/H9-Foundry/AgentForge/issues/62) plugin and registry roadmap
- [#63](https://github.com/H9-Foundry/AgentForge/issues/63) evals and benchmarks framework
- [#64](https://github.com/H9-Foundry/AgentForge/issues/64) additional SCM and CI integrations roadmap
- [#65](https://github.com/H9-Foundry/AgentForge/issues/65) supply-chain and release trust hardening

## Do-Not-Start-Before Rules

- Do not start broader workflow MVP work before the Phase 1 contract docs exist.
- Do not start build, QA, security, release, maintenance, or operations workflow design until the planning/discovery and architecture/design MVP specs are written.
- Do not start Phase 3 ecosystem and Phase 4 governance work as active implementation unless the earlier workflow contracts and MVP specs are stable enough to support them.

## Maintainer Loop

For each slice:

1. pick the next issue from the active lane
2. set the issue to `status: in-progress` and link the branch/PR
3. produce the smallest useful design or implementation slice
4. run validation
5. dogfood using currently supported AgentForge surfaces
6. merge the slice
7. close the issue or move the parent epic/tracker state forward

Prefer child issues over broad epic-only work once a slice becomes concrete enough to review independently.

## Validation Gates

### Design And Docs Slices

Required:

- linked GitHub issue
- structured design or planning artifact in `docs/`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- one repo review pass using the current supported workflow or equivalent review pass before merge
- issue comment or PR body that records the validation commands

Not required:

- new workflow assets
- `pnpm build:packages` unless package contracts or CLI behavior changed

### Schema / Runtime / Policy Code Slices

Required:

- focused tests for changed behavior
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:packages` if public package contracts changed
- `agentforge run pr-review`
- `agentforge explain last-run`
- docs/support updates only if capability actually becomes available
- one explicit usability note in the PR or linked issue comment that answers:
  - does this slice improve, preserve, or worsen first-time usability?
  - do README, quickstart, or examples need an update?
  - can a new evaluator still complete the documented CLI-first wedge without reading maintainer-only docs?

### Release / Public Package Slices

Add:

- `agentforge release check --json`
- `agentforge release verify --json`
- track local validation ambiguity separately when the suite output is passing but the process does not return a final exit, as in [#120](https://github.com/H9-Foundry/AgentForge/issues/120)

## Dogfooding Rules

While the queue is being executed, AgentForge should be used on itself for:

- planning and design
- PR review and QA
- release/readiness verification

It should **not** be used as a general autonomous implementation engine until:

- context-slice contracts are defined and partly implemented
- lifecycle policy overlays and approval classes are defined and partly implemented
- manifest metadata is defined and partly implemented
- artifact schemas are defined and partly implemented

## Definition Of Done For A Queue Slice

A slice is done when:

- the linked issue is updated accurately
- the PR merged cleanly
- required validation commands passed
- dogfooding evidence was captured where required
- docs remain honest about current capability
- newcomer usability impact was assessed for user-visible or public-contract changes
- residual risks are called out explicitly

The queue tracker stays open until the current dependency chain and active execution rules change materially.
