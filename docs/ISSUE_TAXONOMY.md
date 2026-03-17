# Issue Taxonomy

GitHub Issues are the primary planning source of truth for AgentForge.

## Principles

- use issues for active work, decisions, risks, and deferred work
- keep epics separate from implementation issues
- keep milestones phase-oriented
- keep issue status and priority explicit through labels
- keep docs and issue state aligned

## Milestone Strategy

Use the platform roadmap milestones:

- `Platform Phase 1: Platform Foundation`
- `Platform Phase 2: General SDLC Expansion`
- `Platform Phase 3: Ecosystem and Plugins`
- `Platform Phase 4: Enterprise / Governance / Scale`

Historical implementation milestones can remain for completed foundation work, but new SDLC-platform work should use the platform milestone set.

## Label Families

### Type

- `type: epic`
- `type: feature`
- `type: bug`
- `type: docs`
- `type: tech-debt`

### Area

- `area: runtime`
- `area: cli`
- `area: policy`
- `area: context`
- `area: agents`
- `area: adapters`
- `area: github`
- `area: security`
- `area: docs`
- `area: evals`
- `area: plugins`
- `area: registry`
- `area: release`
- `area: observability`
- `area: workflow`

### Priority

- `priority: p0`
- `priority: p1`
- `priority: p2`
- `priority: p3`

### Status

- `status: blocked`
- `status: needs-design`
- `status: ready`
- `status: in-progress`

## Epic vs Feature Guidance

### Epic

Use an epic when the work:

- spans multiple packages or workflow surfaces
- needs child issues
- carries roadmap-level sequencing or risk
- represents a lifecycle/domain expansion, not just one implementation slice

### Feature

Use a feature when the work:

- is reviewable in one PR or a small set of linked PRs
- has a bounded output
- is subordinate to an epic or milestone

### Docs / Proposal

Use a docs/proposal issue when the work is about:

- narrative, documentation, or contributor process
- design exploration without immediate implementation

### Bug

Use a bug when behavior exists and is incorrect, unsafe, or regressed.

### Tech Debt

Use tech-debt when the work is cleanup or maintenance that improves reliability, clarity, or future delivery without being a user-facing feature.

## Recommended Issue Structure

Each issue should include:

1. **Problem / motivation**
2. **Desired outcome**
3. **Proposed scope**
4. **Non-goals**
5. **Acceptance criteria**
6. **Dependencies**
7. **Suggested labels**
8. **Suggested milestone**

## Dependency Conventions

- link parent epics from child issues
- list blocking issues explicitly in a `Dependencies` section
- update epic tracker checklists as child work lands
- prefer opening follow-up issues over burying deferred work in comments or TODOs

## Workflow Expectations

- contributors should open or reference an issue before broad implementation work
- maintainers should keep milestone and status labels current
- roadmap docs should be updated when milestone shape or platform direction changes

For the operational model behind this taxonomy, see [docs/github-issue-source-of-truth.md](github-issue-source-of-truth.md).
