# Queue Execution Flow

This document defines how maintainers should work through the AgentForge backlog.

It is a **maintainer operating flow**, not a shipped product workflow. Official runtime workflow support is tracked in [docs/SUPPORT_MATRIX.md](SUPPORT_MATRIX.md); this document exists to sequence backlog work and maintain truthful queue state.

The live execution tracker for this process is [#245](https://github.com/H9-Foundry/AgentForge/issues/245).

The original Phase 1 foundation tracker is [#83](https://github.com/H9-Foundry/AgentForge/issues/83) and should now be treated as a completed baseline record rather than the live next-work queue.

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

Cross-cutting productization target:

- plug-and-play external adoption and less-technical user readiness
  - this is a tracked umbrella epic that cuts across onboarding, workflow packaging, evals, registry work, published CLI parity, and external local-only adoption readiness
  - it should influence sequencing and acceptance for user-facing slices
  - it is not complete and must not be treated as shipped product status

### Active Lane

Work that is currently being executed now.

Rules:

- only one active design or implementation slice per core dependency chain
- must already be linked to an issue
- must have explicit validation and dogfooding gates

Current active lane:

1. [#245](https://github.com/H9-Foundry/AgentForge/issues/245) Phase 2 provider and integration expansion tracker
2. [#259](https://github.com/H9-Foundry/AgentForge/issues/259) Pipeline evidence review workflow

### Ready Lane

Work that is explicitly designed or queued next, but should not start until the active dependency chain is satisfied.

Current ready lane:

3. [#260](https://github.com/H9-Foundry/AgentForge/issues/260) Deployment gate review workflow
4. [#261](https://github.com/H9-Foundry/AgentForge/issues/261) Promotion approval review follow-on
5. additional generic release and CI workflow consumption after the first provider-agnostic workflow family lands
6. additional provider-specific SCM and CI wedges after the generic release and CI workflow family is stable
7. deeper supply-chain and enterprise trust work reopened only after the next provider/integration family is defined explicitly

### Parallel Safe Lane

Work that improves first-time evaluation and contributor usability without reordering the core foundation dependency chain.

Current parallel safe lane:

- [#97](https://github.com/H9-Foundry/AgentForge/issues/97) CLI-first onboarding and newcomer usability (complete and ready to close)
- [#98](https://github.com/H9-Foundry/AgentForge/issues/98) CLI-first README and quick trial path
- [#99](https://github.com/H9-Foundry/AgentForge/issues/99) first-run output example and artifact walkthrough
- [#100](https://github.com/H9-Foundry/AgentForge/issues/100) quickstart and sample repo external-evaluation flow
- [#101](https://github.com/H9-Foundry/AgentForge/issues/101) contributor onboarding split
- [#102](https://github.com/H9-Foundry/AgentForge/issues/102) CLI help and first-run UX review
- [#116](https://github.com/H9-Foundry/AgentForge/issues/116) sample repo evaluator path alignment
- [#114](https://github.com/H9-Foundry/AgentForge/issues/114) top-level CLI help and command descriptions
- [#115](https://github.com/H9-Foundry/AgentForge/issues/115) plain-text first-run guidance after `run pr-review`

Rules:

- this lane can run in parallel with the active workflow-design chain when it does not depend on runtime or policy changes
- it must not reorder the core dependency chain for the current active slice
- it should optimize first for evaluators trying the current wedge and early contributors making small changes
- the first usability lane is materially complete through `#116`, `#114`, and `#115`
- keep the lane idle until a new bounded newcomer-facing issue is opened

### Mapped Lane

Work that is part of the roadmap and ordered relative to dependencies, but not yet active.

Current mapped lane:

- Phase 1 workflow implementation follow-ons under [#139](https://github.com/H9-Foundry/AgentForge/issues/139) through [#159](https://github.com/H9-Foundry/AgentForge/issues/159) are implemented on `main`
- eval runner / benchmark completion under [#165](https://github.com/H9-Foundry/AgentForge/issues/165) and [#166](https://github.com/H9-Foundry/AgentForge/issues/166) is implemented on `main`
- the external adoption/readiness umbrella is implemented in its first bounded form and now informs Phase 2 acceptance rather than acting as the active queue

### Deferred Lane

Work that remains part of the roadmap but should not be pulled forward until earlier workflow and contract work exists.

Current deferred lane:

- no additional deferred lane items beyond the mapped Phase 3 and 4 design epics yet

## Do-Not-Start-Before Rules

- Do not start broader workflow MVP work before the Phase 1 contract docs exist.
- Do not start build, QA, security, release, maintenance, or operations workflow design until the planning/discovery and architecture/design MVP specs are written.
- Do not start Phase 3 ecosystem and Phase 4 governance work as active implementation unless the earlier workflow contracts and MVP specs are stable enough to support them.
- Do not start a new broad implementation family until the live queue tracker reflects the actual completed baseline on `main`.

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
- do not claim `available in the published CLI` in README, quickstart, or support docs until the latest npm release contains the capability and published verification has been re-run
- if `pnpm test` is being run from a long-lived wrapper session, confirm the direct-shell exit code with `pnpm test; echo EXIT:$?` before treating a stalled session as a repo failure
- [#120](https://github.com/H9-Foundry/AgentForge/issues/120) tracks the earlier validation ambiguity and its local-guidance resolution

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

The live queue tracker should be rolled forward when a dependency family is complete; completed trackers should remain as phase-baseline records rather than continuing to list already-merged work as upcoming.
