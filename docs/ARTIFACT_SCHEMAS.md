# Artifact Schemas For Planning, Design, Review, Release, And Maintenance

This document defines the design target for issue [#77](https://github.com/H9-Foundry/AgentForge/issues/77).

It describes the first lifecycle artifact families AgentForge should standardize as the platform expands beyond the current `pr-review` wedge.

It does **not** claim that these schema families are implemented today.

## Why This Exists

AgentForge already produces one real structured artifact family:

- the audit bundle
- the markdown summary rendered from that audit bundle

That is enough for the current review-oriented wedge. It is not enough for a broader SDLC platform where planning, design, release, and maintenance workflows need stable, comparable, auditable outputs.

Without shared artifact contracts:

- each workflow will invent its own output shape
- audit and reporting will drift from workflow to workflow
- CLI and future registry/catalog surfaces will have no stable way to reason about lifecycle outputs
- structured outputs will degrade back into ad hoc markdown

## Design Goals

- keep structured artifacts as the source of truth
- preserve the current audit bundle instead of replacing it
- add a shared artifact envelope for broader lifecycle outputs
- keep deterministic and agent-generated fields explicit
- make future schema and CLI work additive, not disruptive

## Non-Goals

- replacing the current `auditBundle`
- implementing all schema packages in this slice
- creating every possible workflow artifact family now
- turning markdown into the canonical artifact format

## Current Baseline

Available now:

- `workflowStateEnvelope` as runtime input/state context
- `auditBundle` as the current official structured output artifact
- markdown summaries rendered from `auditBundle`
- findings, proposed actions, blocked plugins, and audit entries as review-oriented structures

Current limitations:

- `auditBundle` is optimized for execution audit, not general lifecycle deliverables
- there is no stable artifact family for planning outputs
- there is no stable artifact family for design outputs
- there is no stable artifact family for release deliverables beyond release automation metadata
- there is no stable artifact family for maintenance recommendations or hygiene work

## Design Principles

- artifacts remain structured and schema-validated
- the audit bundle remains the execution trace
- lifecycle artifacts describe domain outputs, not low-level runtime events
- markdown stays a presentation layer over structured artifact data
- artifacts must preserve provenance, redaction, and audit linkage

## Shared Artifact Envelope

All lifecycle artifact families should share a common envelope.

This envelope is the stable cross-workflow contract that lets the CLI, audit/reporting layer, and future workflow catalog reason about artifact families consistently.

### Proposed Shared Fields

| Field | Purpose |
| --- | --- |
| `schemaVersion` | Version of the artifact schema family |
| `artifactKind` | Specific artifact family identifier |
| `lifecycleDomain` | Primary SDLC domain for the artifact |
| `workflow` | Workflow identifier and display metadata |
| `source` | Run id or equivalent source reference |
| `status` | Artifact completion or lifecycle status |
| `generatedAt` | Artifact generation timestamp |
| `updatedAt` | Last update timestamp when applicable |
| `repo` | Repository and branch context reference |
| `provenance` | Tool/runtime provenance for the artifact |
| `redaction` | Whether and how redaction affected the artifact |
| `auditLink` | Linkage back to audit-bundle and audit-entry surfaces |
| `summary` | Small canonical human-readable summary |

### Proposed Envelope Shape

```yaml
schemaVersion: 1.0.0
artifactKind: planning-brief
lifecycleDomain: plan
workflow:
  name: planning-discovery
  displayName: Planning And Discovery
source:
  runId: run-123
  sourceType: workflow-run
status: complete
generatedAt: 2026-03-17T12:00:00Z
updatedAt: 2026-03-17T12:00:00Z
repo:
  root: /repo
  name: AgentForge
  branch: main
provenance:
  generatedBy: agentforge-runtime
  executionEnvironment: local
redaction:
  applied: true
  categories:
    - secrets
auditLink:
  bundlePath: .agentops/runs/run-123/bundle.json
  entryIds:
    - plan-collector
summary: Initial planning brief generated for queue item #78.
payload: {}
```

## Shared Semantics

### `artifactKind`

This should be the concrete family identifier, not just the SDLC domain.

Initial families proposed in this slice:

- `planning-brief`
- `design-record`
- `review-report`
- `release-report`
- `maintenance-report`

### `lifecycleDomain`

This should align with the lifecycle-domain terminology used in:

- [docs/MANIFEST_METADATA.md](MANIFEST_METADATA.md)
- [docs/SDLC_COVERAGE.md](SDLC_COVERAGE.md)
- [docs/SUPPORT_MATRIX.md](SUPPORT_MATRIX.md)

Proposed initial domain values used here:

- `plan`
- `design`
- `review`
- `release`
- `maintain`

### `source`

Artifacts should always record where they came from.

Proposed fields:

- `sourceType`
  - `workflow-run`
  - `manual-input`
  - `imported`
- `runId`
- `inputRefs`
- `issueRefs`

This allows artifact consumers to know whether the artifact came from an executed workflow, a manually seeded planning step, or a future import path.

### `status`

This is the artifact status, not the runtime status of every internal step.

Proposed status values:

- `draft`
- `complete`
- `superseded`
- `cancelled`

Future implementation can decide whether some artifact families also need domain-specific status extensions.

### `auditLink`

The lifecycle artifact should not duplicate the full audit trail. It should reference it.

Proposed fields:

- `bundlePath`
- `entryIds`
- `findingIds`
- `proposedActionIds`

This preserves a clean boundary:

- `auditBundle` stays the operational trace
- lifecycle artifacts stay the domain output layer

## Domain-Specific Artifact Families

## Planning Artifact

### Purpose

Capture scoped intake, problem framing, constraints, and recommended next actions for planning and discovery workflows.

### Proposed Kind

- `planning-brief`

### Required Fields

- `problemStatement`
- `objectives`
- `constraints`
- `assumptions`
- `inScope`
- `outOfScope`
- `recommendedNextSteps`

### Optional Fields

- `stakeholders`
- `risks`
- `openQuestions`
- `candidateWorkstreams`
- `linkedIssues`

### Deterministic vs Agent-Generated

Deterministic candidates:

- linked issue references
- repository metadata
- changed-file summaries
- detected worktree signals

Agent-generated candidates:

- problem framing
- assumptions
- recommended next steps
- risk summaries

The artifact should keep those distinct in future implementation, for example through metadata on each section origin or by separate deterministic and analysis subfields.

## Design Artifact

### Purpose

Capture architecture and design decisions, trade-offs, constraints, and follow-up implementation implications.

### Proposed Kind

- `design-record`

### Required Fields

- `decisionSummary`
- `context`
- `optionsConsidered`
- `chosenApproach`
- `tradeOffs`
- `risks`
- `followUpWork`

### Optional Fields

- `interfacesImpacted`
- `schemaChangesNeeded`
- `policyChangesNeeded`
- `migrationNotes`
- `compatibilityNotes`

### Deterministic vs Agent-Generated

Deterministic candidates:

- impacted packages/files
- existing interface references
- current schema references

Agent-generated candidates:

- option comparison
- chosen approach rationale
- trade-off framing
- risk narratives

## Review Artifact

### Purpose

Capture the structured outcome of review-oriented workflows beyond just the current audit output.

### Proposed Kind

- `review-report`

### Required Fields

- `summary`
- `findings`
- `recommendations`
- `riskLevel`
- `coverageNotes`

### Optional Fields

- `blockedItems`
- `testGaps`
- `securityConcerns`
- `approvalRecommendations`

### Deterministic vs Agent-Generated

Deterministic candidates:

- changed-file statistics
- blocked-action records
- policy snapshot references

Agent-generated candidates:

- review summaries
- recommendation framing
- risk-level synthesis
- test-gap interpretation

### Relationship To Current Baseline

The current `auditBundle` plus markdown summary already covers part of this space.

The future `review-report` should sit above the audit bundle:

- reuse findings and proposed-action structures where practical
- avoid replacing audit entries
- provide a cleaner lifecycle-domain artifact for review outcomes

## Release Artifact

### Purpose

Capture release readiness, publication intent, versioning outcome, and trust/provenance linkage for release-oriented workflows.

### Proposed Kind

- `release-report`

### Required Fields

- `releaseScope`
- `versionTargets`
- `readinessStatus`
- `verificationChecks`
- `publishingPlan`
- `trustStatus`

### Optional Fields

- `publishedPackages`
- `tagRefs`
- `provenanceRefs`
- `rollbackNotes`
- `externalDependencies`

### Deterministic vs Agent-Generated

Deterministic candidates:

- package versions
- check results
- tag refs
- workflow run references

Agent-generated candidates:

- release-scope summary
- readiness narrative
- rollback guidance

### Relationship To Current Baseline

Current release/readiness behavior already provides:

- `release guide`
- `release check`
- `release verify`
- GitHub Actions release workflows

The future release artifact family should unify their output shape without pretending the full release workflow family already exists as a general SDLC workflow surface.

## Maintenance Artifact

### Purpose

Capture dependency hygiene, documentation upkeep, maintenance recommendations, and low-risk follow-up work.

### Proposed Kind

- `maintenance-report`

### Required Fields

- `maintenanceScope`
- `currentFindings`
- `recommendedActions`
- `priorityAssessment`

### Optional Fields

- `dependencyUpdates`
- `docsUpdates`
- `stalenessSignals`
- `followUpIssues`

### Deterministic vs Agent-Generated

Deterministic candidates:

- dependency version diffs
- stale file markers
- release metadata
- docs/reference existence checks

Agent-generated candidates:

- prioritization rationale
- grouping of maintenance work
- recommended sequencing

## Relationship To `auditBundle` And Markdown Summary

The current `auditBundle` remains the execution audit artifact.

It should continue to answer:

- what ran
- what was requested
- what was blocked
- what was executed
- what policy and redaction rules applied

The new lifecycle artifacts should answer:

- what the workflow produced for the SDLC domain
- what decisions, plans, reports, or recommendations came out of the run

Markdown summaries should remain derived views over structured artifact data and audit data. They should not become the canonical schema contract.

## Proposed Implementation Boundaries

This slice is design-only. It defines the intended next implementation work without applying it yet.

### Future Shared Schema Work

Under [#50](https://github.com/H9-Foundry/AgentForge/issues/50):

1. add a shared lifecycle artifact envelope schema
2. add initial artifact-family schemas for:
   - planning
   - design
   - review
   - release
   - maintenance
3. add fixtures and tests
4. export inferred shared types from `packages/shared-types`

### Future Runtime And Policy Work

Under [#48](https://github.com/H9-Foundry/AgentForge/issues/48) and [#49](https://github.com/H9-Foundry/AgentForge/issues/49):

1. define where lifecycle artifacts are emitted in the runtime state
2. define how artifact emission is represented in node contracts
3. define whether artifact families need lifecycle-specific policy narrowing
4. define audit linkage and redaction semantics for artifact payloads

### Future CLI And Reporting Work

Later CLI/reporting work should:

- surface lifecycle artifact metadata and paths
- keep `explain` and summary flows aligned with structured artifact families
- avoid claiming artifact families as user-facing supported outputs until schemas and workflow surfaces actually exist

## Out Of Scope Until Later Workflow MVPs

This slice should not attempt to fully define:

- planning/discovery workflow stage design beyond artifact needs
- architecture/design workflow stage design beyond artifact needs
- broad release orchestration semantics
- operations/incident artifact families
- multi-tenant or external registry artifact transport

Those belong to later slices, especially:

- [#78](https://github.com/H9-Foundry/AgentForge/issues/78)
- [#79](https://github.com/H9-Foundry/AgentForge/issues/79)

## Recommended Next Steps

After this design lands:

1. open child schema/type issues under [#50](https://github.com/H9-Foundry/AgentForge/issues/50) for the shared envelope and first artifact families
2. open runtime/policy wiring issues under [#48](https://github.com/H9-Foundry/AgentForge/issues/48) and [#49](https://github.com/H9-Foundry/AgentForge/issues/49)
3. use the artifact design as an input to:
   - [#78](https://github.com/H9-Foundry/AgentForge/issues/78)
   - [#79](https://github.com/H9-Foundry/AgentForge/issues/79)
4. only surface artifact families as official supported behavior once schemas, types, runtime emission, and reporting are actually implemented
