# AgentForge Architecture

AgentForge is currently an early SDLC platform core with an official local workflow surface that spans review, planning, design, implementation, QA, security, release and CI review, incident handoff, and maintenance. The architecture is intentionally broader than the current workflow set so the platform can expand across more lifecycle domains without abandoning deterministic control.

## Package Map

- `packages/schemas`
  - shared validation contracts and bundled fixtures
- `packages/shared-types`
  - TypeScript types inferred from the shared schemas
- `packages/context-engine`
  - repository metadata, git status, diff stats, and workflow state creation
- `packages/policy-engine`
  - policy loading, overlay resolution, path gating, tool gating, trust evaluation, and redaction
- `packages/runtime`
  - deterministic workflow orchestration, tool mediation, and audit capture
- `packages/audit`
  - audit bundle assembly and human-readable markdown reporting
- `packages/sdk`
  - runtime interfaces for agents, adapters, and providers
- `packages/cli`
  - current CLI commands for config scaffolding, scanning, workflow execution, explanation, and release verification
- `packages/registry-client`
  - future-facing registry surface, not a production registry feature today

## Runtime Flow

1. The CLI loads `.agentops` config, policy, and workflow definition.
2. The context engine creates a normalized workflow state envelope from repository and git metadata.
3. The policy engine resolves the effective local or CI policy.
4. The runtime executes workflow nodes in order, passing each node only the context sections it requested.
5. Tool requests are mediated through policy before adapter execution.
6. Audit data is persisted as JSON and markdown under `.agentops/runs/<run-id>/`.

## Current Official Workflow Surface

- `.agentops/workflows/pr-review.yaml`
- `.agentops/workflows/planning-discovery.yaml`
- `.agentops/workflows/architecture-design-review.yaml`
- `.agentops/workflows/implementation-proposal.yaml`
- `.agentops/workflows/qa-review.yaml`
- `.agentops/workflows/security-review.yaml`
- `.agentops/workflows/release-readiness.yaml`
- `.agentops/workflows/pipeline-evidence-review.yaml`
- `.agentops/workflows/deployment-gate-review.yaml`
- `.agentops/workflows/incident-handoff.yaml`
- `.agentops/workflows/maintenance-triage.yaml`

Broader workflow coverage beyond those bundled assets still belongs to the roadmap rather than the current implementation claim.

## Extension Surfaces

- `agents/*` are the reasoning or deterministic workflow nodes
- `adapters/*` are explicit tool wrappers with schemas, side-effect classes, permissions, and trust metadata
- plugin registration exists locally through `.agentops/agentops.yaml`
- provider integration remains optional and disabled by default in the starter flow

## Design Constraints

- read-only by default
- structured outputs for all agent behavior
- policy wins over manifests and runtime requests
- blocked paths and redaction are enforced before artifacts are written
- approval-gated tools are blocked before execution

## Architectural Direction

The architecture is intended to support more SDLC workflows over time, but the runtime should only claim support for workflows, agents, adapters, and integrations that are actually present and documented.

For more detail on execution and policy behavior, see [runtime-model.md](runtime-model.md) and [policy-model.md](policy-model.md).
