# Release Trust

## Public Package Policy

AgentOps now treats a curated subset of the workspace as publishable:

- `@agentops/cli`
- `@agentops/schemas`
- `@agentops/shared-types`
- `@agentops/sdk`
- `@agentops/context-engine`
- `@agentops/policy-engine`
- `@agentops/runtime`
- `@agentops/audit`

Everything else stays private for now, including `@agentops/registry-client`, all official agents, and all adapters.

## Versioning

Changesets is configured in fixed-version mode for the public subset. That keeps the external surface moving together while the runtime contracts are still settling.

Before opening or merging release work:

- add a changeset for public-facing changes
- keep internal-only work out of publishable release notes
- run `pnpm build:packages`
- run `pnpm pack:public`

## Trusted Publishing

`.github/workflows/release-packages.yml` is the package release path.

It is designed to:

- build the workspace and package outputs
- dry-run the curated public package tarballs
- open or update version PRs through Changesets
- publish with npm trusted publishing and provenance when a release commit lands on `main`

This workflow should not fall back to a long-lived npm token. If npm trusted publishing is not configured yet, keep the workflow gated and fix the external setup first.

## Build Provenance

`.github/workflows/release-provenance.yml` remains useful even when package publishing is active. It attests the build artifact for the full workspace so reviewers can inspect a reproducible CI build independent of npm publication.

## Prerequisites

Before relying on the package release workflow, confirm:

- the npm scope `@agentops` is owned by the correct org
- GitHub Actions trusted publishing is configured for that scope
- the repository permissions allow `id-token: write`
- the public package list in `.changeset/config.json` still matches repo intent

## Plugin Trust And Releases

Local/manual plugins are not part of the publishable surface yet. They must still declare trust metadata because the CLI and runtime enforce plugin trust policy during startup and record blocked plugins in the audit bundle when policy rejects them.
