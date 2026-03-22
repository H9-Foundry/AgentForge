# SDLC Coverage

This document describes lifecycle coverage across AgentForge using three honest status markers:

- **Available now**: implemented and shipped in the current repo
- **In progress**: explicitly targeted in the near-term backlog
- **Planned**: not implemented yet, but intentionally on the roadmap

Workflow coverage is not the same thing as plug-and-play external usability. A lifecycle domain can be implemented and still require technical early-adopter setup; less-technical external adoption is tracked separately as a productization/readiness target.

## Coverage Map

| Lifecycle Domain | Status | Current Reality | Next Target |
| --- | --- | --- | --- |
| Plan / intake / discovery | Available now | `planning-discovery` is an official local workflow that validates `.agentops/requests/planning.yaml` and emits a `planning-brief` artifact. | Harden the planning workflow with richer request fixtures, policy overlays, and follow-on implementation workflow handoff. |
| Architecture / design | Available now | `architecture-design-review` is an official local workflow that validates `.agentops/requests/design.yaml`, requires a `planningBriefRef`, and emits a `design-record` artifact. | Expand deterministic impact inventory and downstream implementation/design review handoff. |
| Build / implementation | Available now | `implementation-proposal` is an official local workflow that validates `.agentops/requests/implementation.yaml`, requires a `designRecordRef`, and emits an `implementation-proposal` artifact without widening the default side-effect posture. | Expand from proposal-only implementation planning into downstream QA, security review, and gated apply-capable follow-ons. |
| Review / test / QA | Available now | `pr-review` remains available, and `qa-review` is now an official local workflow that validates `.agentops/requests/qa.yaml`, consumes an implementation proposal bundle, and emits a `qa-report` artifact with deterministic evidence normalization. | Broaden into additional QA variants such as regression triage and release-readiness QA. |
| Security / compliance / DevSecOps | Available now | `security-review` is an official local workflow that validates `.agentops/requests/security.yaml`, consumes bounded local evidence, and emits a `security-report` artifact without widening the default side-effect posture. | Expand beyond `security-review` into additional security/DevSecOps variants, adapters, and evals. |
| Release / CI/CD | Available now | `release-readiness`, `pipeline-evidence-review`, `deployment-gate-review`, and `promotion-approval` are official local workflows on `main` that validate `.agentops/requests/release.yaml`, `.agentops/requests/pipeline.yaml`, `.agentops/requests/deployment.yaml`, and `.agentops/requests/promotion.yaml`, consume bounded local CI and release evidence, and emit `release-report`, `pipeline-report`, `deployment-gate-report`, and `promotion-approval-report` artifacts without widening the default side-effect posture. | Expand into additional approval-oriented release/promotion variants and richer release/deployment review follow-ons after the current review family lands broadly. |
| Operate / incident response / observability handoff | Available now | `incident-handoff` is an official local workflow that validates `.agentops/requests/incident.yaml`, consumes staged local incident evidence, and emits an `incident-brief` artifact with deterministic provenance and follow-up routing. | Expand into additional incident and operations variants such as postmortem review and alert triage. |
| Maintain / upgrade / docs / dependency hygiene | Available now | `maintenance-triage` is an official local workflow that validates `.agentops/requests/maintenance.yaml`, consumes bounded maintenance evidence, and emits a `maintenance-report` artifact with deterministic routing support. | Expand into additional maintenance variants such as dependency-upgrade review, docs-hygiene review, and backlog refresh. |

## Official Workflows

### Available now

- `pr-review`
  - location: `.agentops/workflows/pr-review.yaml`
  - purpose: demonstrate secure local repository review with audit output
- `planning-discovery`
  - location: `.agentops/workflows/planning-discovery.yaml`
  - purpose: validate a planning request and emit a `planning-brief` lifecycle artifact
- `architecture-design-review`
  - location: `.agentops/workflows/architecture-design-review.yaml`
  - purpose: validate a design request, consume a planning brief, and emit a `design-record` lifecycle artifact
- `implementation-proposal`
  - location: `.agentops/workflows/implementation-proposal.yaml`
  - purpose: validate an implementation request, consume a design record, and emit an `implementation-proposal` lifecycle artifact
- `qa-review`
  - location: `.agentops/workflows/qa-review.yaml`
  - purpose: validate a QA request, consume an implementation proposal bundle, normalize bounded local evidence, and emit a `qa-report` lifecycle artifact
- `security-review`
  - location: `.agentops/workflows/security-review.yaml`
  - purpose: validate a security request, consume bounded local evidence, and emit a `security-report` lifecycle artifact with deterministic evidence normalization and tighter policy handling
- `release-readiness`
  - location: `.agentops/workflows/release-readiness.yaml`
  - purpose: validate a release request, consume bounded local release evidence, and emit a `release-report` lifecycle artifact without widening the default side-effect posture
- `pipeline-evidence-review`
  - location: `.agentops/workflows/pipeline-evidence-review.yaml`
  - purpose: validate a pipeline review request, consume bounded local shared CI evidence, and emit a `pipeline-report` lifecycle artifact without assuming a release target
- `deployment-gate-review`
  - location: `.agentops/workflows/deployment-gate-review.yaml`
  - purpose: validate a deployment gate request, consume bounded local shared CI evidence plus referenced QA, security, release, and pipeline artifacts, and emit a `deployment-gate-report` lifecycle artifact without adding deployment side effects
- `promotion-approval`
  - location: `.agentops/workflows/promotion-approval.yaml`
  - purpose: validate a promotion approval request, consume bounded local shared CI evidence plus ready release and deployment gate artifacts, and emit a `promotion-approval-report` lifecycle artifact without adding deploy or publish side effects
- `incident-handoff`
  - location: `.agentops/workflows/incident-handoff.yaml`
  - purpose: validate an incident request, consume staged local incident evidence, and emit an `incident-brief` lifecycle artifact with deterministic provenance capture and routing
- `maintenance-triage`
  - location: `.agentops/workflows/maintenance-triage.yaml`
  - purpose: validate a maintenance request, consume bounded maintenance evidence, and emit a `maintenance-report` lifecycle artifact with deterministic routing support

### Planned

- additional QA variants beyond `qa-review`
- security/DevSecOps
- additional approval-oriented release/promotion variants and release/CI-CD follow-ons
- additional operations/incident variants
- additional maintenance/dependency/docs hygiene variants

## Official Agents

### Available now

- `context-collector`
- `security-audit`
- `code-review`
- `test-generation`
- `planning-analyst`
- `design-analyst`
- `implementation-planner`
- `qa-analyst`
- `security-analyst`
- `release-analyst`
- `incident-analyst`
- `maintenance-analyst`

### Planned expansion areas

- release coordination
- incident and operational handoff
- additional maintenance and upgrade hygiene variants

## Official Adapters

### Available now

- filesystem
- git
- shell
- GitHub

### Planned expansion areas

- broader SCM adapters
- CI system adapters
- issue/project-system adapters
- observability and incident-system adapters
- registry and supply-chain adapters

## Guidance

Do not interpret a lifecycle domain appearing in this document as implemented support. Unless it is listed under **Available now**, it is either roadmap work or a longer-term platform direction.
