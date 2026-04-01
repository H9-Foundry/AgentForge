# Release And CI-CD Workflow Expansion

This document defines the design target for issue [#59](https://github.com/H9-Foundry/AgentForge/issues/59).

It describes how AgentForge should grow from the current release/readiness tooling into a broader release and CI/CD workflow family.

It does **not** claim that broader CI/CD orchestration or publish automation is fully implemented today beyond the current local review-oriented release workflow family.

## Why This Exists

AgentForge already has real release automation:

- `release guide`
- `release check`
- `release verify`
- trusted publishing through GitHub Actions

But those capabilities are still narrow tooling rather than an explicit lifecycle workflow family.

## Design Goal

The first release/CI-CD expansion should:

- preserve the current trusted release posture
- formalize a first release-oriented workflow wedge around release evidence and gating
- define where broader CI evidence ingestion belongs
- keep GitHub-specific behavior separate from general pipeline support

## Current Baseline

Available now:

- release readiness CLI commands
- release validation and publish automation
- package/version verification
- audit and lifecycle artifact infrastructure
- official `release-readiness` workflow asset and request validation
- official `pipeline-evidence-review` workflow asset and request validation
- official `deployment-gate-review` workflow asset and request validation
- official `promotion-approval` workflow asset and request validation on `main`
- bounded `release-report` artifact emission from the local `release-readiness` workflow
- bounded `pipeline-report` artifact emission from the local `pipeline-evidence-review` workflow
- bounded `deployment-gate-report` artifact emission from the local `deployment-gate-review` workflow
- bounded `promotion-approval-report` artifact emission from the local `promotion-approval` workflow on `main`
- deterministic release-state normalization across bounded local evidence, QA/security report refs, and workspace version targets
- deterministic pipeline and deployment-gate normalization across bounded local CI evidence and referenced lifecycle artifacts
- approval-classified publish or promotion follow-on recommendations that remain read-only by default

Not yet available:

- publish or deploy orchestration on the default local path
- broader host-agnostic pipeline orchestration beyond the current local review family

## Package-User Evidence Guidance

For package users evaluating the published CLI in a real repository:

- direct repo evidence is enough to run `release-readiness` and `pipeline-evidence-review`
- imported CI evidence is optional, but it improves the resulting evidence picture
- when imported CI evidence is present, release and pipeline reports can move from `CI Evidence (missing)` to `CI Evidence (present)` / `imported-ci-evidence: passed`
- `qa-review` only shows CI evidence when CI evidence is actually supplied to QA; adding CI evidence to release or pipeline does not backfill QA automatically

This is the current supported package-user story:

- use normal repo surfaces such as concrete files under `.github/workflows/`, docs, or prior workflow bundles when you want a minimal local-first run
- add bounded local CI evidence exports under `.agentops/evidence/*.json` when you want stronger release and pipeline evidence completeness
- keep imported CI evidence local and explicit; AgentForge does not auto-fetch CI state on the default path

## Concrete Imported-CI Example

The following example matches the proven external package-user path from the standing AI-Gorilla pilot.

Create two bounded local CI evidence files:

```bash
mkdir -p .agentops/evidence
cat > .agentops/evidence/github-actions-ci.json <<'EOF'
{
  "sourcePath": ".agentops/evidence/github-actions-ci.json",
  "repository": "your-org/your-repo",
  "workflowName": "CI",
  "workflowRunId": 2026040101,
  "runAttempt": 1,
  "event": "push",
  "headBranch": "main",
  "headSha": "0123456789abcdef0123456789abcdef01234567",
  "status": "completed",
  "conclusion": "success",
  "htmlUrl": "https://github.com/your-org/your-repo/actions/runs/2026040101",
  "jobs": [
    {
      "name": "lint",
      "status": "completed",
      "conclusion": "success",
      "htmlUrl": "https://github.com/your-org/your-repo/actions/runs/2026040101/job/1"
    },
    {
      "name": "build",
      "status": "completed",
      "conclusion": "success",
      "htmlUrl": "https://github.com/your-org/your-repo/actions/runs/2026040101/job/2"
    }
  ],
  "checkRuns": []
}
EOF

cat > .agentops/evidence/generic-ci.json <<'EOF'
{
  "sourcePath": ".agentops/evidence/generic-ci.json",
  "providerName": "Staging Health",
  "host": "staging.example.local",
  "repository": "your-org/your-repo",
  "pipelineName": "Staging Health",
  "pipelineRunId": "staging-health-20260401",
  "runAttempt": 1,
  "event": "workflow_dispatch",
  "branch": "main",
  "commitSha": "0123456789abcdef0123456789abcdef01234567",
  "status": "completed",
  "conclusion": "success",
  "htmlUrl": "https://staging.example.local/pipelines/staging-health-20260401",
  "jobs": [
    {
      "name": "health-check",
      "status": "completed",
      "conclusion": "success"
    }
  ],
  "artifacts": []
}
EOF
```

Reference those files from the release and pipeline requests:

```yaml
# .agentops/requests/release.yaml
releaseScope: Prepare the next release candidate
versionTargets:
  - name: your-package-or-app
    version: 0.0.1
qaReportRefs:
  - .agentops/runs/<qa-run-id>/bundle.json
securityReportRefs:
  - .agentops/runs/<security-run-id>/bundle.json
evidenceSources:
  - docs/ENVIRONMENTS.md
  - .agentops/evidence/github-actions-ci.json
  - .agentops/evidence/generic-ci.json
constraints:
  - Keep release readiness read-only by default
```

```yaml
# .agentops/requests/pipeline.yaml
pipelineScope: Review the current candidate pipeline set
focusAreas:
  - pipeline-risk
  - deployment-readiness
constraints:
  - Keep the workflow read-only
qaReportRefs:
  - .agentops/runs/<qa-run-id>/bundle.json
securityReportRefs:
  - .agentops/runs/<security-run-id>/bundle.json
releaseReportRefs:
  - .agentops/runs/<release-run-id>/bundle.json
evidenceSources:
  - .agentops/evidence/github-actions-ci.json
  - .agentops/evidence/generic-ci.json
```

Run the two workflows on the published CLI:

```bash
npx -y @h9-foundry/agentforge-cli@<version> run release-readiness --json
npx -y @h9-foundry/agentforge-cli@<version> run pipeline-evidence-review --json
```

Expected effect:

- `release-readiness` reports imported CI evidence as passed/present instead of missing
- `pipeline-evidence-review` becomes ready with no blocker caused by missing imported CI evidence
- `/outcomes`, `/api/outcomes/export.json`, and `visualizer export --format json` should reflect the same release/pipeline evidence state

## Recommended Initial Workflow Family

Phase 2 now builds on the current official local release and CI review family:

- `release-readiness`
- `pipeline-evidence-review`
- `deployment-gate-review`
- `promotion-approval`

The four current workflows are implemented on `main` and published in the current npm release. Later release-family work should extend this bounded review family rather than reopening first-wedge planning.

## User Jobs

The first release wedge should solve these jobs:

1. collect deterministic release evidence for a candidate version or merge state
2. summarize publish blockers and follow-up actions
3. normalize local and CI evidence into one release artifact
4. preserve approval boundaries between readiness review and actual publish/promote steps

## Non-Goals

This expansion should not:

- replace the existing release workflow immediately
- promise deep integration with every CI provider
- auto-promote or publish without explicit trusted controls
- collapse release review and deployment into one opaque step

## Workflow Shape

### Workflow Identity

- workflow name: `release-readiness`
- trigger: `manual`
- primary lifecycle domain: `release`
- support level at the current implementation slice: `official`
- current maturity: `mvp`

### Entry Model

Recommended input model:

- keep `agentforge run <workflow>`
- add `.agentops/requests/release.yaml`
- allow references to QA reports, security reports, and version targets

### Workflow Stages

1. intake normalization
2. deterministic release evidence collection
3. release analysis
4. report and artifact emission

## Deterministic Vs Agentic Boundaries

Deterministic responsibilities:

- request validation
- package/version and tag inspection
- local and CI status normalization
- trusted-publishing configuration checks
- artifact persistence and audit linkage

Reasoning responsibilities:

- release blocker synthesis
- readiness judgment
- recommended mitigation sequencing

## Trust And Policy Boundaries

- the release-readiness workflow remains read-only by default
- publish, tag, or promote actions stay outside the default path
- CI evidence ingestion must be adapter-mediated and policy-aware
- trusted publishing remains mandatory for official publish automation

## Required Artifacts

Primary lifecycle artifact:

- `release-report`

The payload should minimally include:

- `targetVersion`
- `packageSet`
- `evidenceSources`
- `blockers`
- `readinessStatus`
- `requiredApprovals`
- `recommendedNextSteps`

## Required Deterministic Nodes, Agents, And Adapters

Deterministic needs:

- release request validator
- package/version and tag collector
- CI/check-run status normalizer
- trusted-publishing posture verifier

Starter agent need:

- `release-analyst`

Adapter expectations:

- CI evidence adapters remain explicit
- publish orchestration stays approval-gated and separate from readiness review

## Follow-On Implementation Slices

Implemented on current `main`:

1. release request schema and official `release-readiness` workflow asset
2. `release-analyst` starter agent and `release-report` artifact emission
3. deterministic CI evidence ingestion and release-state normalization across bounded local evidence
4. richer host-agnostic CI provenance and status summaries in `release-report`
5. `pipeline-evidence-review` workflow, request schema, starter agents, and `pipeline-report` artifact
6. `deployment-gate-review` workflow, request schema, starter agents, and `deployment-gate-report` artifact
7. `promotion-approval` workflow, request schema, starter agents, and `promotion-approval-report` artifact on `main`

Next release-family follow-ons:

1. approval-gated publish or promotion orchestration aligned to release-trust controls
