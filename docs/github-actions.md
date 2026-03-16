# GitHub Action Integration

AgentOps includes a GitHub Actions wrapper for the starter `pr-review` workflow.

## Workflow
- File: `.github/workflows/agentops-pr-review.yml`
- Triggers on pull requests and manual dispatch
- Uses the existing CLI and run bundle output rather than a separate runtime path

## What It Does
- installs dependencies
- builds the workspace
- runs `agentops run pr-review --json`
- uploads the JSON bundle and markdown summary as workflow artifacts
- appends the run summary to the GitHub Actions step summary
- comments on the pull request when triggered by `pull_request`
- comments on the configured tracker issue so GitHub issues remain the planning source of truth

## Permissions
- `contents: read`
- `issues: write`
- `pull-requests: write`

The workflow uses the repository `GITHUB_TOKEN`. No separate long-lived token is required for basic Phase 1 reporting.

## Tracker Issue
- The default tracker issue is `#1`
- Manual dispatch can override the tracker issue number
- The local `.agentops/agentops.yaml` template now includes `reporting.github.tracker_issue`
