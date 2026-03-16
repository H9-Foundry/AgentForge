# Release Trust

## Current Phase 1 Position

AgentOps is not yet using package publication as the primary release channel. The current safeguard is build provenance for workspace artifacts, combined with repository-level policy and audit data.

## Build Provenance Workflow

`.github/workflows/release-provenance.yml`:

- builds the workspace from source
- creates a versioned build artifact
- uploads the artifact to GitHub Actions
- attests build provenance for the generated archive

This gives reviewers a verifiable record for the generated build artifact without pretending that package publishing is already finalized.

## Trusted Publishing

Trusted publishing for npm or other registries is intentionally deferred until:

- package boundaries are stable
- release packaging is explicitly defined per package
- registry ownership and scope decisions are finalized

That follow-up work should stay tracked in GitHub under Phase 2 or a dedicated release-hardening issue, not hidden in ad hoc release notes.

## Review Guidance

Before treating a build as releasable, verify:

- GitHub Actions build provenance completed successfully
- `pnpm lint`, `pnpm test`, `pnpm typecheck`, and `pnpm build` passed
- audit bundle metadata shows the expected trust tiers and redaction summary
- no open high-severity issues remain against the active release candidate
