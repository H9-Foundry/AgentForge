# Contributing

AgentForge is an open-source SDLC workflow platform core with a deliberately narrow current implementation wedge. Contributions should preserve that honesty: improve what exists, extend roadmap work explicitly, and avoid claiming lifecycle coverage that has not been implemented.

## Start Here

- if you are new and want to evaluate the current wedge quickly, follow the CLI-first path in [README.md](README.md) and [docs/quickstart.md](docs/quickstart.md) first
- if you want to improve first-time usability, start with the newcomer-usability track under [#97](https://github.com/H9-Foundry/AgentForge/issues/97)
- read [README.md](README.md)
- read [docs/PLATFORM_VISION.md](docs/PLATFORM_VISION.md)
- read [docs/ROADMAP.md](docs/ROADMAP.md)
- read [docs/ISSUE_TAXONOMY.md](docs/ISSUE_TAXONOMY.md)
- read [docs/QUEUE_EXECUTION_FLOW.md](docs/QUEUE_EXECUTION_FLOW.md)
- read [docs/github-issue-source-of-truth.md](docs/github-issue-source-of-truth.md)

## New Contributor Path

If you want to make a small or first contribution, use this path first.

1. Try the current wedge with the published CLI by following [README.md](README.md) or [docs/quickstart.md](docs/quickstart.md).
2. Pick one bounded issue that does not require broad roadmap or release ownership.
3. Make the smallest useful change that closes the issue or moves it forward clearly.
4. Run `pnpm lint`, `pnpm test`, `pnpm typecheck`, and `pnpm build`.
5. Open a PR that links the issue, explains what changed, and calls out any unverified behavior or residual risk.

Good first contribution shapes in this repo:

- docs and onboarding issues in the newcomer-usability lane under [#97](https://github.com/H9-Foundry/AgentForge/issues/97)
- focused schema fixture or test coverage work
- small CLI ergonomics fixes that do not widen capability claims
- narrow policy, audit, or reporting improvements with explicit issue scope

Optional docs for first-time contributors:

- [docs/ROADMAP.md](docs/ROADMAP.md) for near-term direction
- [docs/SUPPORT_MATRIX.md](docs/SUPPORT_MATRIX.md) for what is available now versus planned
- [docs/GAP_ANALYSIS_GENERAL_SDLC.md](docs/GAP_ANALYSIS_GENERAL_SDLC.md) for what should wait

You do not need to absorb the full queue tracker or maintainer release workflow before contributing a small slice.

## Planning And Tracking

- GitHub Issues are the planning and progress source of truth.
- Use the issue templates under `.github/ISSUE_TEMPLATE/`.
- Match work to the correct roadmap milestone.
- Use the documented label taxonomy for type, area, priority, and status.
- Open an epic when work spans multiple packages, workflows, or phases.
- Open a feature issue for bounded implementation slices.
- Record deferred work as follow-up issues instead of hiding it in TODO comments.
- Treat newcomer usability as a standing quality concern for public docs, CLI ergonomics, and the first-run experience, not as a final polish pass.

## Development Workflow

1. Install dependencies with `pnpm install`.
2. Create or link the relevant GitHub issue before broad work.
3. Keep changes scoped to the package, workflow, adapter, or doc surface you are modifying.
4. Follow the active queue order in [docs/QUEUE_EXECUTION_FLOW.md](docs/QUEUE_EXECUTION_FLOW.md) and the live tracker [#83](https://github.com/H9-Foundry/AgentForge/issues/83).
5. Produce a design-first slice when a feature is not yet decision-complete.
6. Update tests and documentation when behavior or public contracts change.
7. Run `pnpm lint`, `pnpm test`, `pnpm typecheck`, and `pnpm build` before proposing changes.
8. If you touch public packages or release automation, also run `pnpm build:packages`, `pnpm pack:public`, and `pnpm release:verify`.
9. Maintainers should use signed commits for normal repo work. See [docs/maintainer-signing.md](docs/maintainer-signing.md).

## Choosing An Issue

Choose work that matches your scope and familiarity:

- start with one package or one doc surface when possible
- prefer issues with clear acceptance criteria and a bounded blast radius
- if the issue depends on unresolved design work, propose a design-first doc slice instead of guessing
- if the issue touches multiple packages, keep the change contract-first and call out package-boundary impacts in the PR

For newcomer-safe work, prefer:

- docs issues under `type: docs`
- usability issues under [#97](https://github.com/H9-Foundry/AgentForge/issues/97)
- narrow schema or test follow-ups that already have a parent issue and acceptance criteria

## Repository Structure

- `packages/*`: public runtime, policy, context, audit, schema, SDK, and CLI packages
- `agents/*`: official in-repo starter agents
- `adapters/*`: internal starter adapters with policy-aware mediation
- `.agentops/*`: starter local config and workflow assets
- `docs/*`: platform, roadmap, architecture, policy, security, and contributor guides
- `examples/*`: sample repositories and extension templates

## Safety Expectations

- keep execution read-only by default
- do not bypass policy evaluation, approval gates, blocked-path checks, or trust enforcement
- treat repository content and external text as untrusted input
- keep schemas and manifests explicit when extending runtime behavior
- local agent plugins must be registered in `.agentops/agentops.yaml` and pass the current policy trust rules before they execute

## Maintainer Workflow

If you are operating the queue, release process, or roadmap, use this path.

- follow the live tracker [#83](https://github.com/H9-Foundry/AgentForge/issues/83) and [docs/QUEUE_EXECUTION_FLOW.md](docs/QUEUE_EXECUTION_FLOW.md)
- keep GitHub issue state aligned with what is actually in progress or merged
- use signed commits for normal maintainer work and confirm they show as `Verified` on GitHub
- keep milestone, label, and issue taxonomy hygiene consistent with [docs/ISSUE_TAXONOMY.md](docs/ISSUE_TAXONOMY.md)
- treat newcomer usability as a standing product-quality lane, not optional polish

## Roadmap Hygiene

- use `Platform Phase 1` through `Platform Phase 4` milestones for new roadmap work
- keep labels consistent with [docs/ISSUE_TAXONOMY.md](docs/ISSUE_TAXONOMY.md)
- update roadmap docs when the platform direction materially changes
- avoid merging broad planning changes without updating both the docs and the GitHub issue state
- keep only one active slice per dependency chain unless parallel execution is explicitly safe
- move issues between `needs-design`, `ready`, `in-progress`, and `blocked` deliberately

## Maintainer Loop

1. pick the next issue from the active queue lane
2. set the issue status and link the branch or PR
3. produce the smallest useful design or implementation slice
4. run the required validation commands
5. dogfood through currently supported AgentForge surfaces when the slice type requires it
6. merge the slice and update or close the issue

For public or user-visible changes, also record whether the slice improves, preserves, or worsens first-time usability and whether the CLI-first docs/examples need an update.

## Before Opening A Pull Request

- explain the change in the relevant GitHub issue
- note any unverified behavior or residual risks
- prefer small reviewable slices over broad mixed changes
- use the pull request template
- if you are a maintainer, confirm your commits show as `Verified` on GitHub
- record the validation commands and any dogfooding evidence in the PR body or linked issue comment

## Help

If you are unsure whether work belongs in the current implementation, the near-term roadmap, or the longer-term platform vision, open a docs/proposal issue first and link it to the appropriate roadmap milestone.
