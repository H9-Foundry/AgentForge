# Runtime Model

## Workflow Shape

A workflow is a versioned document with ordered nodes. In Phase 1, the starter `pr-review` flow is:

1. context collection
2. security audit
3. code review
4. test generation
5. final report

Each node declares:

- `kind`
- `agent`
- output target
- requested context sections
- allowed tool names

## Agent Execution Contract

Agents receive:

- the full workflow state
- a minimal `stateSlice`
- the resolved policy snapshot
- an optional provider
- an `invokeTool` function mediated by runtime and policy

Agents return structured output:

- `summary`
- `findings`
- `proposedActions`
- `requestedTools`
- `blockedActionFlags`
- optional metadata

## Tool Mediation

Tool requests are checked in this order:

1. adapter exists
2. policy allows the tool at all
3. approval requirements are evaluated before adapter execution
4. adapter-level path checks run for filesystem operations
5. outputs and errors are redacted before they are persisted

This order matters. Approval-gated tools must not execute and then get marked blocked after the fact.

## Audit Output

Each run produces:

- `bundle.json`
- `summary.md`

The audit bundle includes:

- workflow and run identifiers
- policy snapshot
- audit trail entries
- findings and proposed actions
- provenance metadata
- redaction metadata
- trust metadata for runtime components

## Execution Modes

- `inspect`: no side effects, focus on observation and reporting
- `suggest`: recommendations are allowed, writes still require approval
- `apply`: reserved for more explicit change application flows and still subject to policy

## Next Hardening Layer

The current model is enough for the initial `pr-review` wedge, but broader SDLC workflows need a stricter interaction contract around:

- capability envelopes per workflow node
- explicit side-effect classes
- context-slice contracts and budget handling
- clearer runtime versus policy responsibilities

See [docs/RUNTIME_INTERACTION_HARDENING.md](RUNTIME_INTERACTION_HARDENING.md) for the Phase 1 design target that will drive the next runtime, policy, and schema hardening work.
