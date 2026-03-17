# Support Matrix

This matrix separates current official support from roadmap intent.

Manifest-level catalog metadata now exists for official workflow and agent assets, and this matrix remains the human-readable support summary for the current shipped surface.

## Maturity Levels

- **Official**: implemented, documented, and treated as current supported surface
- **Partial**: some supporting infrastructure exists, but the end-user workflow surface is incomplete
- **Planned**: not implemented yet
- **Internal**: present in the repository but not yet supported as public surface

## Workflow Support

| Workflow | Maturity | Notes |
| --- | --- | --- |
| `pr-review` | Official | The current official workflow wedge. |
| `planning-discovery` | Official | CLI-first planning and intake workflow that emits a `planning-brief` artifact. |
| `architecture-design-review` | Official | CLI-first design workflow that consumes a planning brief and emits a `design-record` artifact. |
| `implementation-proposal` | Official | CLI-first implementation workflow that consumes a design record, emits an `implementation-proposal` artifact, and keeps the default path read-only and proposal-only. |
| test / QA | Planned | The current `pr-review` flow touches QA, but there is no dedicated official QA workflow yet. |
| security / DevSecOps | Planned | Security controls exist, but not a broader official security workflow family. |
| release / CI-CD | Planned | Release automation exists, but not as a broader official SDLC workflow family. |
| operations / incident handoff | Planned | Roadmap item only. |
| maintenance / dependency/docs hygiene | Planned | Roadmap item only. |

## Agent Support

| Agent | Maturity | Notes |
| --- | --- | --- |
| `context-collector` | Official | Current starter agent. |
| `planning-analyst` | Official | Starter planning agent for `planning-discovery`. |
| `design-analyst` | Official | Starter design agent for `architecture-design-review`. |
| `implementation-planner` | Official | Starter implementation agent for `implementation-proposal`. |
| `security-audit` | Official | Current starter agent. |
| `code-review` | Official | Current starter agent. |
| `test-generation` | Official | Current starter agent. |
| release/operations/maintenance agents | Planned | Not implemented yet. |

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

## Self-Hosting Scope

| Self-hosted use | Maturity | Notes |
| --- | --- | --- |
| planning/design on the AgentForge repo | Official | Covered by `planning-discovery` and `architecture-design-review` with lifecycle artifact output. |
| implementation planning on the AgentForge repo | Official | Covered by `implementation-proposal` with deterministic inventory and proposal-only output. |
| PR review and QA on the AgentForge repo | Official | Covered by the current `pr-review` wedge and audit outputs. |
| release/readiness verification on the AgentForge repo | Official | Covered by `release guide`, `release check`, and `release verify`. |
| autonomous implementation on the AgentForge repo | Planned | Not an official supported mode yet. |

## Compatibility Notes

- Current support is strongest for local repository execution and GitHub-centric release workflows.
- Public compatibility commitments are intentionally narrow until broader workflow and integration support exists.
- Planned support in this matrix should be treated as roadmap direction, not shipped capability.
