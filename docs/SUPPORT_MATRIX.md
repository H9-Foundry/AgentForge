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
- The packaged visualizer and benchmark CLI surface are release-ready on `main`, but they must keep `source-build only` or equivalent wording until the next npm publish is verified

## Workflow Support

| Workflow | Maturity | Notes |
| --- | --- | --- |
| `pr-review` | Official | The current official workflow wedge. |
| `planning-discovery` | Official | CLI-first planning and intake workflow that emits a `planning-brief` artifact. |
| `architecture-design-review` | Official | CLI-first design workflow that consumes a planning brief and emits a `design-record` artifact. |
| `implementation-proposal` | Official | CLI-first implementation workflow that consumes a design record, emits an `implementation-proposal` artifact, and keeps the default path read-only and proposal-only. |
| `qa-review` | Official | Dedicated QA workflow that consumes an implementation proposal and emits a `qa-report` artifact with deterministic evidence normalization ahead of reasoning. |
| `security-review` | Official | Dedicated security workflow that consumes bounded local evidence, emits a `security-report` artifact, and keeps the default path read-only with tighter policy handling. |
| `release-readiness` | Official | Dedicated release workflow that consumes bounded local release evidence, emits a `release-report` artifact, and keeps publish or promotion follow-ons outside the default read-only path. |
| `pipeline-evidence-review` | Official | Dedicated provider-agnostic pipeline workflow that consumes bounded local CI evidence, emits a `pipeline-report` artifact, and stays local-first and read-only by default. |
| `deployment-gate-review` | Official | Dedicated deployment gate workflow that consumes shared CI evidence plus referenced QA, security, release, and pipeline artifacts, and emits a `deployment-gate-report` artifact without adding deployment side effects. |
| `promotion-approval` | Official | Approval-oriented release review workflow that consumes shared CI evidence plus ready release and deployment gate artifacts and emits a `promotion-approval-report`. |
| `incident-handoff` | Official | Dedicated operations workflow that consumes staged local incident evidence, emits an `incident-brief` artifact, and keeps the default path local-first and read-only. |
| `maintenance-triage` | Official | Dedicated maintenance workflow that consumes bounded maintenance evidence, emits a `maintenance-report` artifact, and keeps the default path read-only with deterministic routing support. |
| security / DevSecOps extensions | Planned | Additional security variants beyond `security-review` are not implemented yet. |
| promotion / approval release follow-ons | Partial | `promotion-approval` is now implemented on `main`, but broader approval-oriented release and promotion variants beyond the current review-only workflow remain unimplemented. |
| operations / incident variants | Planned | Additional operations and incident variants beyond `incident-handoff` are not implemented yet. |
| maintenance / dependency/docs hygiene variants | Planned | Additional maintenance variants beyond `maintenance-triage` are not implemented yet. |

## Agent Support

`Official` in this table means supported as bundled workflow assets behind the CLI and official workflows, not as standalone external packages unless stated otherwise.

| Agent | Maturity | Notes |
| --- | --- | --- |
| `context-collector` | Official | Current starter agent. |
| `planning-analyst` | Official | Starter planning agent for `planning-discovery`. |
| `design-analyst` | Official | Starter design agent for `architecture-design-review`. |
| `implementation-planner` | Official | Starter implementation agent for `implementation-proposal`. |
| `qa-analyst` | Official | Starter QA agent for `qa-review`; supported as an in-repo workflow asset, not as a standalone external package. |
| `security-analyst` | Official | Starter security agent for `security-review`; supported as an in-repo workflow asset, not as a standalone external package. |
| `release-analyst` | Official | Starter release agent for `release-readiness`; supported as an in-repo workflow asset, not as a standalone external package. |
| `incident-analyst` | Official | Starter incident agent for `incident-handoff`; supported as an in-repo workflow asset, not as a standalone external package. |
| `maintenance-analyst` | Official | Starter maintenance agent for `maintenance-triage`; supported as an in-repo workflow asset, not as a standalone external package. |
| `security-audit` | Official | Current starter agent. |
| `code-review` | Official | Current starter agent. |
| `test-generation` | Official | Current starter agent. |
| additional release/operations agents | Planned | Further release and incident variants remain unimplemented. |

## Adapter And Integration Support

| Surface | Maturity | Notes |
| --- | --- | --- |
| filesystem adapter | Internal | Used by the runtime, not a separately supported public package. |
| git adapter | Internal | Used by the runtime, not a separately supported public package. |
| shell adapter | Internal | Present, but side effects remain tightly constrained by policy. |
| GitHub adapter | Internal | Current GitHub-aware mediation is narrow and intentionally bounded. |
| additional SCM integrations | Partial | Shared SCM contracts now exist and the bounded GitLab reference wedge is implemented; broader host support remains planned. |
| additional CI integrations | Partial | Shared CI contracts plus bounded GitHub, GitLab, and generic local CI evidence ingestion now exist; broader provider support remains planned. |
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
| `agents/*` | Internal | Official in-repo agents used by the workflow surface, not individually supported public packages. |
| `adapters/*` | Internal | Internal starter adapters, not yet public packages. |

The visualizer is an official CLI surface, but it is not a separately installed public package.

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
| less-technical plug-and-play adoption | Partial | The published CLI now includes one bounded quick path plus no-YAML preset startup, but broader adoption still expects low-to-mid technical comfort. |
| agent-stack integration readiness | Planned | The supported external surface is still the CLI plus official workflows and presets; starter agents and `packages/registry-client` remain repo-internal. |

## Self-Hosting Scope

| Self-hosted use | Maturity | Notes |
| --- | --- | --- |
| planning/design on the AgentForge repo | Official | Covered by `planning-discovery` and `architecture-design-review` with lifecycle artifact output. |
| implementation planning on the AgentForge repo | Official | Covered by `implementation-proposal` with deterministic inventory and proposal-only output. |
| PR review and QA on the AgentForge repo | Official | Covered by `pr-review` for repository review and `qa-review` for dedicated QA handoff and `qa-report` artifacts. |
| security and maintenance triage on the AgentForge repo | Official | Covered by `security-review` and `maintenance-triage` with bounded evidence normalization and lifecycle artifact output. |
| release/readiness verification on the AgentForge repo | Official | Covered by `release-readiness`, `pipeline-evidence-review`, `deployment-gate-review`, plus `release guide`, `release check`, and `release verify`. |
| incident handoff on the AgentForge repo | Official | Covered by `incident-handoff` with staged evidence intake and `incident-brief` artifact output. |
| autonomous implementation on the AgentForge repo | Planned | Not an official supported mode yet. |

## Compatibility Notes

- Workflow maturity and published CLI availability are related but not identical. A workflow can be official on `main` and still need an explicit `source-build only` note until the latest npm release includes it; the current quick path, preset startup, and release/CI review family are already available in the published CLI.
- Current support is strongest for local repository execution and GitHub-centric release workflows.
- Public compatibility commitments are intentionally narrow until broader workflow and integration support exists.
- Planned support in this matrix should be treated as roadmap direction, not shipped capability.
