# SDLC Coverage

This document describes lifecycle coverage across AgentForge using three honest status markers:

- **Available now**: implemented and shipped in the current repo
- **In progress**: explicitly targeted in the near-term backlog
- **Planned**: not implemented yet, but intentionally on the roadmap

## Coverage Map

| Lifecycle Domain | Status | Current Reality | Next Target |
| --- | --- | --- | --- |
| Plan / intake / discovery | Planned | No official workflow yet. | Add discovery/intake workflow definitions, schemas, and deterministic context assembly for planning artifacts. |
| Architecture / design | Planned | No official workflow yet. | Add architecture review/design workflow slice and supporting manifests. |
| Build / implementation | Planned | No official workflow yet. | Add implementation workflow support with explicit safe-side-effect policies. |
| Review / test / QA | Available now | `pr-review` workflow with context, security audit, code review, and proposed test generation. | Broaden into dedicated review/test/QA workflow variants. |
| Security / compliance / DevSecOps | In progress | Policy, redaction, trust metadata, release trust, and audit exist. | Add richer security workflow coverage and security-specific adapters/evals. |
| Release / CI/CD | In progress | Release verification, trusted publishing, package validation, and GitHub workflows exist. | Add broader release/CI workflow coverage beyond package publishing. |
| Operate / incident response / observability handoff | Planned | No official workflow yet. | Add incident-handoff and operational context workflows. |
| Maintain / upgrade / docs / dependency hygiene | In progress | Dependency and release hygiene exist through GitHub workflows and repo maintenance practices. | Add explicit maintenance workflows and docs hygiene automation. |

## Official Workflows

### Available now

- `pr-review`
  - location: `.agentops/workflows/pr-review.yaml`
  - purpose: demonstrate secure local repository review with audit output

### In progress

- none shipped yet; roadmap work exists but no official additional workflow assets are committed

### Planned

- planning/discovery
- architecture/design review
- build/implementation
- dedicated test/QA
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

### Planned expansion areas

- planning/discovery
- architecture/design
- implementation/build assistance
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
