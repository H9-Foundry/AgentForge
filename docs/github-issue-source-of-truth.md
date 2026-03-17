# GitHub Issues As Source Of Truth

AgentForge uses GitHub Issues as the primary planning and delivery source of truth.

## Operating Model

- roadmap intent is documented in `docs/`
- active execution state lives in GitHub Issues and milestones
- epics track multi-slice work
- feature, docs, bug, and tech-debt issues track implementation slices

## Required Behaviors

- open or reference an issue before broad work starts
- keep milestone, status, and dependency information current
- update the relevant epic or tracker when scope, order, or risk changes
- open follow-up issues for deferred work instead of burying it in code comments

## Milestone Model

New SDLC-platform work should use:

- `Platform Phase 1: Platform Foundation`
- `Platform Phase 2: General SDLC Expansion`
- `Platform Phase 3: Ecosystem and Plugins`
- `Platform Phase 4: Enterprise / Governance / Scale`

Historical milestones from the original foundation work should remain as completed record, not as the active planning model.

## Issue Taxonomy

Use the label taxonomy defined in [docs/ISSUE_TAXONOMY.md](docs/ISSUE_TAXONOMY.md).

At minimum, each issue should capture:

- problem / motivation
- desired outcome
- proposed scope
- non-goals
- acceptance criteria
- dependencies
- labels
- milestone

## Tracker Shape

The expected structure for major platform work is:

- one umbrella tracker for the active repositioning or phase
- one epic per major workstream
- child implementation issues for the first reviewable slices

## Current Direction

The repository has moved beyond the original Phase 1 foundation work. The active platform direction is the broader SDLC workflow/runtime roadmap described in:

- [docs/PLATFORM_VISION.md](PLATFORM_VISION.md)
- [docs/ROADMAP.md](ROADMAP.md)
- [docs/SDLC_COVERAGE.md](SDLC_COVERAGE.md)
- [docs/SUPPORT_MATRIX.md](SUPPORT_MATRIX.md)
- [docs/GAP_ANALYSIS_GENERAL_SDLC.md](GAP_ANALYSIS_GENERAL_SDLC.md)
