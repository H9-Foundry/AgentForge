# SDLC Coverage

This document describes lifecycle coverage across AgentForge using three honest status markers:

- **Available now**: implemented and shipped in the current repo
- **In progress**: explicitly targeted in the near-term backlog
- **Planned**: not implemented yet, but intentionally on the roadmap

## Coverage Map

| Lifecycle Domain | Status | Current Reality | Next Target |
| --- | --- | --- | --- |
| Plan / intake / discovery | Available now | `planning-discovery` is an official local workflow that validates `.agentops/requests/planning.yaml` and emits a `planning-brief` artifact. | Harden the planning workflow with richer request fixtures, policy overlays, and follow-on implementation workflow handoff. |
| Architecture / design | Available now | `architecture-design-review` is an official local workflow that validates `.agentops/requests/design.yaml`, requires a `planningBriefRef`, and emits a `design-record` artifact. | Expand deterministic impact inventory and downstream implementation/design review handoff. |
| Build / implementation | Available now | `implementation-proposal` is an official local workflow that validates `.agentops/requests/implementation.yaml`, requires a `designRecordRef`, and emits an `implementation-proposal` artifact without widening the default side-effect posture. | Expand from proposal-only implementation planning into downstream QA, security review, and gated apply-capable follow-ons. |
| Review / test / QA | Available now | `pr-review` remains available, and `qa-review` is now an official local workflow that validates `.agentops/requests/qa.yaml`, consumes an implementation proposal bundle, and emits a `qa-report` artifact with deterministic evidence normalization. | Broaden into additional QA variants such as regression triage and release-readiness QA. |
| Security / compliance / DevSecOps | In progress | Policy, redaction, trust metadata, release trust, and audit exist. | Add richer security workflow coverage and security-specific adapters/evals. |
| Release / CI/CD | In progress | Release verification, trusted publishing, package validation, and GitHub workflows exist. | Add broader release/CI workflow coverage beyond package publishing. |
| Operate / incident response / observability handoff | Planned | No official workflow yet. | Add incident-handoff and operational context workflows. |
| Maintain / upgrade / docs / dependency hygiene | In progress | Dependency and release hygiene exist through GitHub workflows and repo maintenance practices. | Add explicit maintenance workflows and docs hygiene automation. |

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

### In progress

- security / DevSecOps
- release / CI-CD
- maintenance / dependency / docs hygiene

### Planned

- additional QA variants beyond `qa-review`
- security/DevSecOps
- release/CI-CD
- operations/incident handoff
- maintenance/dependency/docs hygiene

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

### Planned expansion areas

- release coordination
- incident and operational handoff
- maintenance and upgrade hygiene

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
