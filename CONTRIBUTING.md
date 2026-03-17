# Contributing

AgentForge is an open-source SDLC workflow platform core with a deliberately narrow current implementation wedge. Contributions should preserve that honesty: improve what exists, extend roadmap work explicitly, and avoid claiming lifecycle coverage that has not been implemented.

## Start Here

- read [README.md](README.md)
- read [docs/PLATFORM_VISION.md](docs/PLATFORM_VISION.md)
- read [docs/ROADMAP.md](docs/ROADMAP.md)
- read [docs/ISSUE_TAXONOMY.md](docs/ISSUE_TAXONOMY.md)
- read [docs/github-issue-source-of-truth.md](docs/github-issue-source-of-truth.md)

## Planning And Tracking

- GitHub Issues are the planning and progress source of truth.
- Use the issue templates under `.github/ISSUE_TEMPLATE/`.
- Match work to the correct roadmap milestone.
- Use the documented label taxonomy for type, area, priority, and status.
- Open an epic when work spans multiple packages, workflows, or phases.
- Open a feature issue for bounded implementation slices.
- Record deferred work as follow-up issues instead of hiding it in TODO comments.

## Development Workflow

1. Install dependencies with `pnpm install`.
2. Create or link the relevant GitHub issue before broad work.
3. Keep changes scoped to the package, workflow, adapter, or doc surface you are modifying.
4. Update tests and documentation when behavior or public contracts change.
5. Run `pnpm lint`, `pnpm test`, `pnpm typecheck`, and `pnpm build` before proposing changes.
6. If you touch public packages or release automation, also run `pnpm build:packages`, `pnpm pack:public`, and `pnpm release:verify`.
7. Maintainers should use signed commits for normal repo work. See [docs/maintainer-signing.md](docs/maintainer-signing.md).

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

## Roadmap Hygiene

- use `Platform Phase 1` through `Platform Phase 4` milestones for new roadmap work
- keep labels consistent with [docs/ISSUE_TAXONOMY.md](docs/ISSUE_TAXONOMY.md)
- update roadmap docs when the platform direction materially changes
- avoid merging broad planning changes without updating both the docs and the GitHub issue state

## Before Opening A Pull Request

- explain the change in the relevant GitHub issue
- note any unverified behavior or residual risks
- prefer small reviewable slices over broad mixed changes
- use the pull request template
- if you are a maintainer, confirm your commits show as `Verified` on GitHub

## Help

If you are unsure whether work belongs in the current implementation, the near-term roadmap, or the longer-term platform vision, open a docs/proposal issue first and link it to the appropriate roadmap milestone.
