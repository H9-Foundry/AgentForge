# AI-Gorilla Package-User Pilot

This document defines the standing external package-user dogfood loop for `AI-Gorilla`.

It is an operational feedback contract, not a shipped workflow or a broad external-support claim.

Use [#318](https://github.com/H9-Foundry/AgentForge/issues/318) as the planning/status tracker and [Discussion #307](https://github.com/H9-Foundry/AgentForge/discussions/307) as the permanent umbrella thread for this pilot.

## Goal

Prove that the published AgentForge CLI can add useful advisory value in a complex external application repository without relying on maintainer-only setup or source-build shortcuts.

The pilot should answer:

- whether onboarding produces a runnable next step on the published CLI
- whether repo-fit inference works for a real app repo, not just package-shaped repos
- whether security, release, and pipeline workflows work on direct real-repo evidence paths
- whether CLI exports, browser visualizer pages, and local visualizer APIs remain consistent for the same run corpus

## Target Repository

- repository: [H9-Foundry/AI-Gorilla](https://github.com/H9-Foundry/AI-Gorilla)
- planning/status tracker: [#318](https://github.com/H9-Foundry/AgentForge/issues/318)
- canonical feedback sink: [Discussion #307](https://github.com/H9-Foundry/AgentForge/discussions/307)

This pilot is separate from:

- the AgentForge-on-AgentForge benchmark ledger in [#268](https://github.com/H9-Foundry/AgentForge/issues/268)
- the bounded CreateCVs portability benchmark in [docs/CREATECVS_PORTABILITY_PHASE.md](CREATECVS_PORTABILITY_PHASE.md)

## Package-User Rule

Every AI-Gorilla cycle must execute through the published package path only, for example:

```bash
npx -y @h9-foundry/agentforge-cli@<version> ...
```

Do not count these as proof that a package-user gap is fixed:

- local AgentForge source behavior
- unpublished builds
- maintainer-only source-build commands
- manual request-file authoring as the default path
- evidence-file copying or repo-specific workarounds unless the product explicitly documents them as advanced/manual mode

## Per-Cycle Behavior

Each cycle should:

1. run inside a clean AI-Gorilla clone or worktree
2. inspect the repo and recent changes first
3. rerun onboarding only when needed or when onboarding itself is under evaluation
4. run the bounded advisory workflow set relevant to the current repo state
5. compare the results against the baseline already recorded in [Discussion #307](https://github.com/H9-Foundry/AgentForge/discussions/307)
6. append one dated follow-up comment to `#307`

Default advisory workflow set:

- `planning-discovery`
- `architecture-design-review`
- `security-review`
- `release-readiness`
- `pipeline-evidence-review`

Defer `implementation-proposal` until the current published CLI cycle shows low enough friction on the advisory path.

## Evidence Contract

Every reported gap must include:

- exact AgentForge published version
- exact command run
- exact run id
- exact bundle path
- expected behavior
- actual behavior

The comment on [Discussion #307](https://github.com/H9-Foundry/AgentForge/discussions/307) should also state whether the current cycle passed these package-user bars:

- repo-fit inference for an app repo
- runnable onboarding next step
- direct repo evidence path support
- visualizer consistency with CLI export

## Discussion And Issue Model

Use [#318](https://github.com/H9-Foundry/AgentForge/issues/318) as the planning/status record and [Discussion #307](https://github.com/H9-Foundry/AgentForge/discussions/307) as the narrative history for the pilot.

Open a new Issue only when the current cycle finds:

- a new reproducible product defect
- a regression of a behavior previously reported as fixed in `#307`
- a persistent mismatch between published CLI behavior and documented package-user expectations

Each promoted issue must link back to `#307`.

## Follow-Up Comment Template For Discussion #307

Use this compact structure for every later cycle comment on [Discussion #307](https://github.com/H9-Foundry/AgentForge/discussions/307):

````md
## <YYYY-MM-DD> follow-up: AI-Gorilla on published AgentForge <version>

### Repo under test
- branch:
- commit:
- clone/worktree path:

### Commands run
```bash
<exact commands>
```

### Onboarding rerun
- yes|no

### Workflow verdicts
- planning-discovery:
- architecture-design-review:
- security-review:
- release-readiness:
- pipeline-evidence-review:

### Package-user bars
- repo-fit inference: pass|fail
- runnable onboarding next step: pass|fail
- direct repo evidence path support: pass|fail
- visualizer consistency: pass|fail

### Comparison to previous #307 baseline
- improved|unchanged|regressed

### New or reopened issues
- none|<issue links>

### Next recommended cycle
- <short next step>
````

Do not close a package-user issue until the exact original repro works:

- in a clean external repo
- on the published CLI
- without the workaround that originally caused the friction

## Success Bar

Do not treat AI-Gorilla as a clean external package-user success until all of these are true on the published CLI:

- onboarding leads to a runnable next step without hidden setup
- repo-fit inference no longer assumes a package-shaped repo when the target is clearly an application repo
- security, release, and pipeline workflows accept direct evidence from normal repo surfaces when policy allows them
- browser visualizer outputs and CLI export agree on the same run corpus

## Relationship To Other Dogfood Work

The intended order is:

1. keep [#268](https://github.com/H9-Foundry/AgentForge/issues/268) as the internal AgentForge-first benchmark ledger
2. keep AI-Gorilla as the standing complex external package-user pilot through [#318](https://github.com/H9-Foundry/AgentForge/issues/318) plus [Discussion #307](https://github.com/H9-Foundry/AgentForge/discussions/307)
3. keep CreateCVs as the bounded external portability benchmark after the package-user path is stable enough to benchmark without changing the rules midstream
