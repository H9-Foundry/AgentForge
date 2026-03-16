# Contributing

## Development Workflow

1. Install dependencies with `pnpm install`.
2. Run `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm build:packages` before proposing changes.
3. Keep changes scoped to the package, agent, adapter, or doc surface you are modifying.
4. Update tests and documentation when behavior or public contracts change.
5. If you touch public packages or release automation, also run `pnpm pack:public`.

## Planning And Tracking

- GitHub issues are the planning and progress source of truth.
- Update the active issue before closing substantial work.
- Record deferred work as follow-up issues instead of burying it in TODO comments.

## Repository Structure

- `packages/*`: contracts, runtime, CLI, and shared infrastructure
- `agents/*`: official starter agents
- `adapters/*`: policy-aware tool wrappers
- `.agentops/*`: starter runtime config and workflows
- `docs/*`: architecture, policy, security, and contributor guides
- `examples/*`: sample repositories and extension templates

## Safety Expectations

- Keep execution read-only by default.
- Do not bypass policy evaluation, approval gates, or blocked-path checks.
- Treat repository content and external text as untrusted input.
- Keep schemas and manifests explicit when extending runtime behavior.
- Local agent plugins must be registered in `.agentops/agentops.yaml` and pass the current policy trust rules before they execute.

## Before Opening A Pull Request

- Explain the change in the relevant GitHub issue.
- Note any unverified behavior or residual risks.
- Prefer small reviewable slices over broad mixed changes.
