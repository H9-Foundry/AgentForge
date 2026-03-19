# Support Matrix

This matrix separates current official support from roadmap intent.

Manifest-level catalog metadata now exists for official workflow and agent assets, and this matrix remains the human-readable support summary for the current shipped surface.

## Maturity Levels

- **Official**: implemented, documented, and treated as current supported surface
- **Partial**: some supporting infrastructure exists, but the end-user workflow surface is incomplete
- **Planned**: not implemented yet
- **Internal**: present in the repository but not yet supported as public surface

## Published CLI Availability Terms

- **Published now**: available in the latest npm release of `@h9-foundry/agentforge-cli`
- **Source-build only**: implemented on `main`, but not yet in the latest npm release
- Product-facing docs must say `available in the published CLI` only after published parity is verified

## Workflow Support

| Workflow | Maturity | Notes |
| --- | --- | --- |
| `pr-review` | Official | The current official workflow wedge. |
| `planning-discovery` | Official | CLI-first planning and intake workflow that emits a `planning-brief` artifact. |
| `architecture-design-review` | Official | CLI-first design workflow that consumes a planning brief and emits a `design-record` artifact. |
| `implementation-proposal` | Official | CLI-first implementation workflow that consumes a design record, emits an `implementation-proposal` artifact, and keeps the default path read-only and proposal-only. |
| `qa-review` | Official | Dedicated QA workflow that consumes an implementation proposal and emits a `qa-report` artifact with deterministic evidence normalization ahead of reasoning. |
| `security-review` | Official | Dedicated security workflow that consumes bounded local evidence, emits a `security-report` artifact, and keeps the default path read-only with tighter policy handling. |
| `maintenance-triage` | Official | Dedicated maintenance workflow that consumes bounded maintenance evidence, emits a `maintenance-report` artifact, and keeps the default path read-only with deterministic routing support. |
| security / DevSecOps extensions | Planned | Additional security variants beyond `security-review` are not implemented yet. |
| release / CI-CD | Planned | Release automation exists, but not as a broader official SDLC workflow family. |
| operations / incident handoff | Planned | Roadmap item only. |
| maintenance / dependency/docs hygiene variants | Planned | Additional maintenance variants beyond `maintenance-triage` are not implemented yet. |

## Agent Support

| Agent | Maturity | Notes |
| --- | --- | --- |
| `context-collector` | Official | Current starter agent. |
| `planning-analyst` | Official | Starter planning agent for `planning-discovery`. |
| `design-analyst` | Official | Starter design agent for `architecture-design-review`. |
| `implementation-planner` | Official | Starter implementation agent for `implementation-proposal`. |
| `qa-analyst` | Official | Starter QA agent for `qa-review`. |
| `security-analyst` | Official | Starter security agent for `security-review`. |
| `maintenance-analyst` | Official | Starter maintenance agent for `maintenance-triage`. |
| `security-audit` | Official | Current starter agent. |
| `code-review` | Official | Current starter agent. |
| `test-generation` | Official | Current starter agent. |
| release/operations agents | Planned | Not implemented yet. |

## Adapter And Integration Support

| Surface | Maturity | Notes |
| --- | --- | --- |
| filesystem adapter | Internal | Used by the runtime, not a separately supported public package. |
| git adapter | Internal | Used by the runtime, not a separately supported public package. |
| shell adapter | Internal | Present, but side effects remain tightly constrained by policy. |
| GitHub adapter | Internal | Current GitHub-aware mediation is narrow and intentionally bounded. |
| additional SCM integrations | Planned | Not implemented yet. |
| additional CI integrations | Planned | Not implemented yet. |
| observability/incident integrations | Planned | Not implemented yet. |
| registry integrations | Planned | `packages/registry-client` remains a future-facing surface. |

## Package Support

| Package | Maturity | Notes |
| --- | --- | --- |
| `@h9-foundry/agentforge-cli` | Official | Public CLI package. |
| `@h9-foundry/agentforge-schemas` | Official | Public schema contracts. |
| `@h9-foundry/agentforge-shared-types` | Official | Public inferred TS types. |
| `@h9-foundry/agentforge-sdk` | Official | Public runtime interfaces. |
| `@h9-foundry/agentforge-context-engine` | Official | Public context engine package. |
| `@h9-foundry/agentforge-policy-engine` | Official | Public policy engine package. |
| `@h9-foundry/agentforge-runtime` | Official | Public runtime package. |
| `@h9-foundry/agentforge-audit` | Official | Public audit/reporting package. |
| `packages/registry-client` | Internal | Future-facing registry surface. |
| `agents/*` | Internal | Official in-repo agents, not yet public packages. |
| `adapters/*` | Internal | Internal starter adapters, not yet public packages. |

## Environment Support

| Environment | Maturity | Notes |
| --- | --- | --- |
| local repository execution | Official | Primary current usage mode. |
| GitHub-hosted release and validation workflows | Official | Current release automation path. |
| general CI runtime support | Partial | Some workflow behavior exists in CI, but general CI workflow support is not complete. |
| hosted multi-tenant service | Planned | Not implemented. |

## Adoption Readiness

See [docs/EXTERNAL_LOCAL_ADOPTION_READINESS.md](EXTERNAL_LOCAL_ADOPTION_READINESS.md) for the explicit go/no-go checklist for external local-only adoption.

| Adoption Surface | Maturity | Notes |
| --- | --- | --- |
| technical local-first adoption | Partial | Strongest current external fit: technical evaluators can install the CLI, run official local workflows, and inspect audit artifacts without GitHub wiring. |
| less-technical plug-and-play adoption | Planned | This is now an explicit product target, but it is not complete yet; common workflow startup still expects too much familiarity with request files and repo structure. |
| agent-stack integration readiness | Planned | Internal starter agents exist, but external packaging, preset distribution, and low-friction agent consumption are not yet supported as a public surface. |

## Self-Hosting Scope

| Self-hosted use | Maturity | Notes |
| --- | --- | --- |
| planning/design on the AgentForge repo | Official | Covered by `planning-discovery` and `architecture-design-review` with lifecycle artifact output. |
| implementation planning on the AgentForge repo | Official | Covered by `implementation-proposal` with deterministic inventory and proposal-only output. |
| PR review and QA on the AgentForge repo | Official | Covered by `pr-review` for repository review and `qa-review` for dedicated QA handoff and `qa-report` artifacts. |
| security and maintenance triage on the AgentForge repo | Official | Covered by `security-review` and `maintenance-triage` with bounded evidence normalization and lifecycle artifact output. |
| release/readiness verification on the AgentForge repo | Official | Covered by `release guide`, `release check`, and `release verify`. |
| autonomous implementation on the AgentForge repo | Planned | Not an official supported mode yet. |

## Compatibility Notes

- Workflow maturity and published CLI availability are related but not identical. A workflow can be official on `main` and still need an explicit `source-build only` note until the latest npm release includes it.
- Current support is strongest for local repository execution and GitHub-centric release workflows.
- Public compatibility commitments are intentionally narrow until broader workflow and integration support exists.
- Planned support in this matrix should be treated as roadmap direction, not shipped capability.
