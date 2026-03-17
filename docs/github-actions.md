# GitHub Action Integration

AgentForge includes a GitHub Actions wrapper for the starter `pr-review` workflow.

## Workflows

- `.github/workflows/agentforge-pr-review.yml`
  - pull request and manual workflow execution
  - comments on PRs and the configured tracker issue
  - validates bot-created `changeset-release/*` version PRs through a same-repo `pull_request_target` path so protected-branch checks still attach to Changesets release PRs
- `.github/workflows/release-provenance.yml`
  - build artifact provenance for the workspace
  - attests the workspace build artifact by default when the repository is public
  - falls back to a documented skip path for private repositories unless `AGENTFORGE_ENABLE_PRIVATE_ATTESTATION=true` is set after GitHub attestation support is enabled
- `.github/workflows/release-packages.yml`
  - Changesets version PRs and trusted npm publishing for the curated public subset
  - enables npm package provenance automatically when the repository is public
  - falls back to trusted publishing without provenance when the repository is private because npm only accepts provenance from public GitHub repositories

## What It Does
- installs dependencies
- builds the workspace and package outputs
- runs `agentforge run pr-review --json`
- uploads the JSON bundle and markdown summary as workflow artifacts
- appends the run summary to the GitHub Actions step summary
- comments on the pull request when triggered by `pull_request`
- comments on bot-created `changeset-release/*` release PRs when triggered through the same-repo `pull_request_target` path
- comments on the configured tracker issue so GitHub issues remain the planning source of truth

## Permissions
- `contents: read`
- `issues: write`
- `pull-requests: write`
- `id-token: write` for release provenance and trusted publishing workflows

The repository workflows are configured for the Node 24 JavaScript action runtime transition. Trusted publishing should continue using GitHub OIDC instead of a long-lived npm token.

For release PR validation, AgentForge uses `pull_request_target` only for same-repository `changeset-release/*` branches and checks out the PR head SHA with persisted credentials disabled. Human-authored PRs continue to use the standard `pull_request` path.

## Tracker Issue
- The default tracker issue is `#1`
- Manual dispatch can override the tracker issue number
- The local `.agentops/agentops.yaml` template now includes `reporting.github.tracker_issue`
