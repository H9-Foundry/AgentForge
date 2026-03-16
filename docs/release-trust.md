# Release Trust

## Public Package Policy

AgentForge now treats a curated subset of the workspace as publishable:

- `@h9-foundry/agentforge-cli`
- `@h9-foundry/agentforge-schemas`
- `@h9-foundry/agentforge-shared-types`
- `@h9-foundry/agentforge-sdk`
- `@h9-foundry/agentforge-context-engine`
- `@h9-foundry/agentforge-policy-engine`
- `@h9-foundry/agentforge-runtime`
- `@h9-foundry/agentforge-audit`

Everything else stays private for now, including `@h9-foundry/agentforge-registry-client`, all official agents, and all adapters.

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

AgentForge does not store npm credentials in repo config. Codex-assisted npm setup depends on machine-level npm auth on the workstation, typically through `npm login` writing `~/.npmrc`.

Use the CLI to separate guidance from verification:

- `agentforge release guide`
  - prints the external bootstrap sequence for npm org creation, ownership confirmation, trusted publishing setup, and hosted release reruns
- `agentforge release check`
  - runs read-only preflight checks for npm auth, current npm username resolution, package metadata, release workflow trusted publishing config, Changesets config, and local release-shape commands
- `agentforge release check --json`
  - emits the same result as structured JSON for Codex or CI consumption

## Build Provenance

`.github/workflows/release-provenance.yml` remains useful even when package publishing is active. It attests the build artifact for the full workspace so reviewers can inspect a reproducible CI build independent of npm publication.

For private repositories, artifact attestation is skipped unless the repository or organization enables it and sets `AGENTFORGE_ENABLE_PRIVATE_ATTESTATION=true`.

## Prerequisites

Before relying on the package release workflow, confirm:

- the npm scope `@h9-foundry` is owned by the correct org
- the workstation used for Codex/npm admin work has a valid npm login in `~/.npmrc`
- GitHub Actions trusted publishing is configured for that scope
- the repository permissions allow `id-token: write`
- the public package list in `.changeset/config.json` still matches repo intent

## Plugin Trust And Releases

Local/manual plugins are not part of the publishable surface yet. They must still declare trust metadata because the CLI and runtime enforce plugin trust policy during startup and record blocked plugins in the audit bundle when policy rejects them.
