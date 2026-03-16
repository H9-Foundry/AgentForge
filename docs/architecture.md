# AgentForge Architecture

Phase 1 is deliberately narrow: one secure-by-default local workflow slice, with the contracts and guardrails made explicit before broad feature expansion.

## Package Map

- `packages/schemas`
  - shared validation contracts and bundled fixtures
- `packages/shared-types`
  - TypeScript types inferred from the shared schemas
- `packages/context-engine`
  - repository metadata, git status, diff stats, and workflow state creation
- `packages/policy-engine`
  - policy loading, overlay resolution, path gating, tool gating, and redaction
- `packages/runtime`
  - deterministic workflow orchestration, tool mediation, and audit capture
- `packages/audit`
  - audit bundle assembly and human-readable markdown reporting
- `packages/sdk`
  - runtime interfaces for agents, adapters, and providers
- `packages/cli`
  - `init`, `scan`, `run`, and `explain last-run`

## Runtime Flow

1. The CLI loads `.agentops` config, policy, and workflow definition.
2. The context engine creates a normalized workflow state envelope from repository and git metadata.
3. The policy engine resolves the effective local or CI policy.
4. The runtime executes workflow nodes in order, passing each agent only the context sections it requested.
5. Tool requests are mediated through policy before adapter execution.
6. Audit data is persisted as JSON and markdown under `.agentops/runs/<run-id>/`.

## Extension Surfaces

- `agents/*` are the reasoning or deterministic workflow nodes.
- `adapters/*` are explicit tool wrappers with schemas, side-effect classes, permissions, and trust metadata.
- `providers` remain optional in Phase 1 and are disabled by default in the starter flow.

## Design Constraints

- read-only by default
- structured outputs for all agent behavior
- policy wins over manifests and runtime requests
- blocked paths and redaction are enforced before artifacts are written

For more detail on execution and policy behavior, see [docs/runtime-model.md](/Users/ethan/Repo/AgentOps/docs/runtime-model.md) and [docs/policy-model.md](/Users/ethan/Repo/AgentOps/docs/policy-model.md).
