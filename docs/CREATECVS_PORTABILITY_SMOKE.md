# CreateCVs Portability Smoke

Date: March 25, 2026

This document records the first bounded portability smoke for the repo-fit onboarding slice against `CreateCVs`.

It is not the official portability benchmark from [docs/CREATECVS_PORTABILITY_PHASE.md](CREATECVS_PORTABILITY_PHASE.md). It exists to answer a narrower question first:

- does the current `main` repo-fit onboarding contract work in a second real repository without hand-writing YAML?

## Scope

Target repository:

- `CreateCVs`
- local clone used for the smoke: `/tmp/CreateCVs-portability`
- target contract reference: [/tmp/CreateCVs-portability/docs/agentforge-pilot.md](/tmp/CreateCVs-portability/docs/agentforge-pilot.md)

AgentForge surface used:

- local built CLI from this repo, not the published npm package
- command path: `/Users/ethan/Repo/AgentOps/packages/cli/dist/bin.js`

Reason:

- the published npm release already includes `agentforge onboard`, but it does not yet ship the full `.agentops/repo-fit.yaml` contract flow from `main`

## Commands Run

Onboarding:

```bash
cd /tmp/CreateCVs-portability
node /Users/ethan/Repo/AgentOps/packages/cli/dist/bin.js onboard --json
```

Workflow smoke:

```bash
node /Users/ethan/Repo/AgentOps/packages/cli/dist/bin.js run planning-discovery --json
node /Users/ethan/Repo/AgentOps/packages/cli/dist/bin.js run architecture-design-review --json
node /Users/ethan/Repo/AgentOps/packages/cli/dist/bin.js run implementation-proposal --json
```

Visualizer smoke:

```bash
node /Users/ethan/Repo/AgentOps/packages/cli/dist/bin.js visualizer --host 127.0.0.1 --port 43111
```

## What Onboarding Inferred Correctly

The onboarding pass wrote `.agentops/repo-fit.yaml` without any hand-authored YAML and correctly inferred:

- package manager: `npm`
- languages: `typescript`, `javascript`
- architecture style: `package-repo`
- source roots: `src`, `tests`, `docs`, `scripts`
- repo path conventions for `src/`, `tests/`, `docs/`, and `.github/workflows/`
- validation commands:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `npm test`
  - `npm run test:e2e`
- release evidence:
  - `docs/release-runbook.md`
- recommended workflow families:
  - `review/planning`
  - `qa/security`
  - `release/pipeline/deployment`
  - `maintenance/incident`
- recommended starter profile:
  - `agentforge-ts-package`
  - adoption: `partial`

The generated contract left one field unresolved:

- `structure.packageRoots`

That is acceptable for this smoke. It indicates the contract is useful immediately, but not complete enough yet to claim zero-touch repo understanding.

## Workflow Results

The request-driven smoke chain succeeded in the CreateCVs clone:

1. `planning-discovery`
   - status: `success`
   - findings: `0`
   - artifact: `planning-brief`
2. `architecture-design-review`
   - status: `success`
   - findings: `0`
   - artifact: `design-record`
3. `implementation-proposal`
   - status: `success`
   - findings: `1`
   - artifact: `implementation-proposal`

The planning and design bundles carried the resolved repo-fit snapshot under `configuration.repoFit`, including:

- path: `.agentops/repo-fit.yaml`
- selected profile: `agentforge-ts-package`
- adoption: `partial`
- inferred fields list
- unresolved fields list
- source roots and package roots

The implementation bundle surfaced one advisory repo-fit finding:

- `repo-contract-mismatch`
- summary: the workflow input did not reference the repo-fit validation commands

That is the intended posture for this slice:

- repo-fit is advisory
- it changes findings and follow-up guidance
- it does not hard-block the workflow

## Portability Friction Found

One concrete friction theme appeared immediately during the first smoke pass:

- onboarding inferred `npm run lint` and `npm run typecheck` correctly for CreateCVs
- but `implementation-proposal` initially rejected `npm run lint` as a non-allowlisted validation command when it was explicitly supplied in the request

This was a reusable portability bug, not a CreateCVs-specific edge case. The root cause was command normalization for npm package scripts inside implementation validation discovery.

Status:

- fixed on `main` on March 25, 2026
- rerun succeeded with explicit `npm run lint` and `npm run typecheck`
- the CreateCVs implementation request now completes with `status: success` and `findings: 0`

That means the repo-fit contract, onboarding scan, and implementation validation allowlist are now aligned for this external npm repository case.

## Visualizer UX Check

The local visualizer was launched against the CreateCVs run set and manually inspected at:

- `/outcomes`
- `/runs`
- `/configure?target=repo-fit`

The smoke confirmed:

- `/outcomes` still reads as the correct first page in a non-AgentForge repo
- `/runs` remains understandable as the forensic drill-down page
- `/configure?target=repo-fit` exposes the inferred repo-fit contract in structured form without forcing users to type YAML first

The current UI is usable, but still dense:

- `repo-fit` is understandable
- `workflow-control` remains the heavier surface and was not the focus of this portability smoke

## What This Smoke Proves

- the current `main` repo-fit onboarding slice is portable enough to test in a second real repository
- onboarding can infer meaningful repo structure and evidence without hand-written YAML
- repo-fit provenance flows into run bundles and the visualizer
- advisory repo-fit findings make sense in downstream workflows

## What This Smoke Does Not Prove Yet

- it is not the formal CreateCVs benchmark
- it does not use the benchmark ledger or adjudicated `/outcomes` overlays
- it does not prove the published npm package yet, because the smoke used the local built CLI from `main`
- it does not yet prove the released npm package, because the smoke and follow-up fix were validated against the local built CLI from `main`

## Recommended Follow-Up

Before the formal portability phase:

1. release the repo-fit onboarding slice so the published CLI matches `main`
2. rerun this same CreateCVs onboarding and workflow chain against the published package once the repo-fit slice is released
3. start the bounded portability benchmark only after the preconditions in [docs/CREATECVS_PORTABILITY_PHASE.md](CREATECVS_PORTABILITY_PHASE.md) are satisfied
