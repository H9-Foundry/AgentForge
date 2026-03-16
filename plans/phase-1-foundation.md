# Phase 1 AgentOps Foundation

## Current Repo State
- Repository started as an empty scaffold with only `README.md` and `.gitignore`.
- No existing workspace configuration, packages, schemas, or runtime logic were present.

## Summary
- Build a runnable local PR-review vertical slice first.
- Use `pnpm` workspaces with `turbo`.
- Keep the CLI in `packages/cli`.
- Start with provider abstraction only; live model integration remains optional and off by default.
- Split repository configuration across `.agentops/agentops.yaml`, `.agentops/policy.yaml`, and `.agentops/workflows/pr-review.yaml`.

## Architecture
- Root workspace tooling: TypeScript, project references, Vitest, ESLint, and Turbo task orchestration.
- Contract-first packages: `packages/schemas` and `packages/shared-types`.
- Core execution packages: `packages/context-engine`, `packages/policy-engine`, `packages/runtime`, `packages/audit`, `packages/sdk`.
- Official starter assets: four agents, safe adapters, starter workflow, CLI commands, and local audit bundle output.

## Milestones
1. Bootstrap the monorepo, repo guidance, and workspace scripts.
2. Define shared schemas, exported types, and example fixtures.
3. Implement context collection and policy resolution with test coverage.
4. Implement runtime orchestration, audit bundle generation, and safe adapters.
5. Implement starter agents and the local `pr-review` workflow.
6. Implement CLI commands: `init`, `scan`, `run`, and `explain last-run`.
7. Validate the vertical slice with unit, smoke, and end-to-end tests.

## Security-Critical Decisions
- Read-only by default.
- Side effects are classified as `observe`, `suggest`, `apply-low-risk`, or `apply-high-risk`.
- Policy wins over manifests and runtime requests.
- Blocked paths are filtered before agents receive context and before adapters execute.
- External content is treated as untrusted data.
- Audit artifacts are written only to `.agentops/runs/**`.

## Test Strategy
- Validate fixtures for every shared schema.
- Cover policy overlays, blocked paths, redaction, and approval-gated write/network checks.
- Cover repo context creation for local and CI contexts.
- Cover runtime sequencing, blocked tool handling, adapter failures, and audit output.
- Cover CLI smoke flows and one end-to-end fixture repository run.

## Definition Of Done
- The monorepo installs, builds, typechecks, and tests successfully.
- `agentops init`, `agentops scan`, `agentops run pr-review`, and `agentops explain last-run` work locally.
- The starter workflow produces human-readable and machine-readable artifacts.
- Deferred work is limited to GitHub integration, expanded docs/examples, and later hardening tasks.
