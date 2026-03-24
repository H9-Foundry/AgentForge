# External Local-Only Adoption Readiness

This document answers one practical question:

Can AgentForge be used in another repository today as a local-only pre-PR quality layer?

## Current Answer

- technical early-adopter local-only adoption: `Partial`
- less-technical plug-and-play local-only adoption: `Partial`

Today, a technical evaluator can install the published CLI, run the official local workflow surface, and inspect bounded run artifacts without GitHub wiring. That is enough for pilot-style local usage in another repository.

The new visualizer plus benchmark-authoring CLI surface is release-ready on `main`, but it is not yet part of the published-CLI claim until the next npm release is cut and verified.

It is not yet fully plug-and-play for less technical adopters. The published CLI now includes preset-based startup and the canonical four-step quick path, and the external support boundary is explicit: the CLI plus official workflows and presets are the supported external surface, while `agents/*` and `packages/registry-client` remain repo-internal. The remaining gap is broader ease-of-use beyond the first bounded local-first path.

## Readiness Levels

- `Planned`: the capability is a target, but the required product surface is not usable yet
- `Partial`: the capability is usable with constraints, but still expects technical early-adopter setup or judgment
- `Official`: the capability is intentionally supported, documented, and usable without hidden maintainer knowledge for the stated audience

## Minimum Checklist For External Local-Only Adoption

The local-only adoption bar is met only when all of these are true:

- the published CLI matches the workflows and capabilities claimed in README and support docs
- official workflows are discoverable through CLI help and quickstart guidance
- the evaluator path stays local-first and read-only by default
- run artifacts are deterministic and easy to inspect through `bundle.json` and `summary.md`
- product-facing docs clearly distinguish published CLI support from source-build-only capability
- the documented quick path can be followed without maintainer-only docs

## Current Evaluation

| Criterion | Status | Current Reality |
| --- | --- | --- |
| Published CLI parity | Pass | The currently published CLI includes the official local workflow surface plus the bounded planning preset startup path, `eval run`, and `eval compare`. |
| Official workflow discoverability | Pass | README, support docs, and quickstart now describe the published CLI surface explicitly. |
| Safe local-first defaults | Pass | Default posture remains local-first and read-only, with approval-gated side effects. |
| Deterministic artifact inspection | Pass | Official workflows and evals emit inspectable run bundles with structured artifact output. |
| Quick path without maintainer docs | Pass | The published CLI now provides one canonical four-step quick path for the first request-driven workflow. |
| No-YAML startup for a common path | Pass | `init --preset planning-discovery` is now available in the published CLI. |
| External starter-agent packaging clarity | Pass | The support boundary is now explicit: external users consume workflows and presets through the CLI, while `agents/*` and `packages/registry-client` remain repo-internal. |
| Visualizer and benchmark CLI surface | Source-build only | `agentforge visualizer`, `visualizer export`, and `eval benchmark-wizard` are release-ready on `main`, but they should not be described as published-CLI capability until the next npm release is verified. |

## Decision Guidance

### Use In Another Repo Today

Yes, if all of these are acceptable:

- the user is comfortable with CLI-first setup
- the goal is local-only pre-PR review, planning, QA, security, or maintenance assistance
- the team accepts proposal/reporting workflows rather than autonomous write-heavy behavior
- the team can inspect `.agentops/runs/<run-id>/bundle.json` and `.agentops/runs/<run-id>/summary.md`

## Next Proof Phase

The next adoption proof step is not a broad plug-and-play claim. It is the first bounded external portability benchmark in a real second repository.

Current next target:

- `CreateCVs`
- use the published CLI plus official workflows only
- use the embedded pilot contract already merged in that repository
- compare the same agent's default flow versus the AgentForge-gated flow using the same benchmark rules established in the AgentForge-first dogfood phase

See [docs/CREATECVS_PORTABILITY_PHASE.md](CREATECVS_PORTABILITY_PHASE.md) for the current portability benchmark contract.

### Do Not Describe As Plug-And-Play Yet

Do not describe AgentForge as plug-and-play for less technical adopters until:

- preset-based startup exists
- one non-technical quick path exists and is documented as supported
- external agent packaging/support boundaries are explicit
- product-facing docs no longer assume request-file authoring for the first successful path

## Related Work

- [#224](https://github.com/H9-Foundry/AgentForge/issues/224) published CLI parity with documented official workflows
- [#220](https://github.com/H9-Foundry/AgentForge/issues/220) preset-based workflow startup for external repos
- [#222](https://github.com/H9-Foundry/AgentForge/issues/222) non-technical adopter quick path
- [#221](https://github.com/H9-Foundry/AgentForge/issues/221) external agent packaging and starter preset distribution

See [docs/EXTERNAL_STARTER_AGENT_PACKAGING.md](EXTERNAL_STARTER_AGENT_PACKAGING.md) for the current starter-agent and preset packaging boundary.
