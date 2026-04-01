# GitHub Issues As Source Of Truth

AgentForge uses GitHub Issues as the primary planning and delivery source of truth.

This does not make GitHub Issues the canonical usage reference. Usage and onboarding guidance should stay versioned with the codebase in repo docs, while the GitHub wiki can provide curated how-to views that mirror those repo docs.

For long-lived external package-user dogfood pilots, a GitHub Discussion may serve as the canonical narrative feedback sink, with GitHub Issues reserved for reproducible reusable defects promoted out of that discussion thread.

## Operating Model

- roadmap intent is documented in `docs/`
- active execution state lives in GitHub Issues and milestones
- canonical usage and reference guidance lives in repo docs such as `README.md` and `docs/quickstart.md`
- the GitHub wiki is a curated user-facing mirror and how-to layer derived from repo docs
- epics track multi-slice work
- feature, docs, bug, and tech-debt issues track implementation slices

## Required Behaviors

- open or reference an issue before broad work starts
- keep milestone, status, and dependency information current
- update the relevant epic or tracker when scope, order, or risk changes
- open follow-up issues for deferred work instead of burying it in code comments
- update canonical repo docs when user-facing behavior or usage guidance changes
- update the relevant wiki pages when repo-doc-backed onboarding guidance changes
- when an external package-user pilot uses a canonical Discussion, keep the linked defect issues aligned with that discussion so planning state does not drift

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
