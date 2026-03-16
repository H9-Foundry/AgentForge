# GitHub Issues As Source Of Truth

The intended operating model for AgentOps is to track active planning and delivery in GitHub issues rather than only in local markdown files.

## Issue Structure
- One umbrella issue for the active phase, including scope, milestones, risks, and links to child issues.
- One issue per milestone or reviewable implementation slice.
- Follow-up issues for deferred work discovered during implementation.

## Minimum Update Rules
- Update the umbrella issue when scope, assumptions, or milestone order changes.
- Update the active implementation issue when code lands or behavior changes.
- Record tests run, passes, failures, risks, and deferred work in the issue update, not only in local notes.
- Open a follow-up issue instead of burying deferred work in a code comment or commit message.

## Initial Issue Set For Phase 1
- Phase 1 foundation umbrella
- Monorepo bootstrap and tooling
- Shared schemas and typed contracts
- Context engine v1
- Policy engine v1
- Runtime kernel and audit bundle
- Safe adapters
- Starter agents and `pr-review` workflow
- CLI commands and local artifact UX
- Deferred: GitHub Action integration and PR reporting

## Current Implementation
- Phase 1 issue structure is now seeded in GitHub.
- The repository includes a GitHub Actions workflow that can comment on pull requests and update the tracker issue from the latest run bundle.
- The default tracker issue is `#1`, and the local `.agentops/agentops.yaml` template carries that value for future automation.
