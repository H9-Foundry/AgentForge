# GitHub Action Integration

AgentForge includes a GitHub Actions wrapper for the starter `pr-review` workflow.

## Workflows

- `.github/workflows/agentforge-pr-review.yml`
  - pull request and manual workflow execution
  - comments on PRs and the configured tracker issue
- `.github/workflows/release-provenance.yml`
  - build artifact provenance for the workspace
  - skips artifact attestation on private repositories unless `AGENTFORGE_ENABLE_PRIVATE_ATTESTATION=true` is set after GitHub attestation support is enabled
- `.github/workflows/release-packages.yml`
  - Changesets version PRs and trusted npm publishing for the curated public subset
  - disables npm package provenance automatically on private repositories because npm only accepts provenance from public GitHub repositories

## What It Does
- installs dependencies
- builds the workspace and package outputs
- runs `agentforge run pr-review --json`
- uploads the JSON bundle and markdown summary as workflow artifacts
- appends the run summary to the GitHub Actions step summary
- comments on the pull request when triggered by `pull_request`
- comments on the configured tracker issue so GitHub issues remain the planning source of truth

## Permissions
- `contents: read`
- `issues: write`
- `pull-requests: write`
- `id-token: write` for release provenance and trusted publishing workflows

The repository workflows are configured for the Node 24 JavaScript action runtime transition. Trusted publishing should continue using GitHub OIDC instead of a long-lived npm token.

## Tracker Issue
- The default tracker issue is `#1`
- Manual dispatch can override the tracker issue number
- The local `.agentops/agentops.yaml` template now includes `reporting.github.tracker_issue`
