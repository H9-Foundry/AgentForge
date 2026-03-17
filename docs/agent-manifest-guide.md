# Agent Manifest Guide

Each official agent ships with an `agent.manifest.json` file plus a parsed manifest in its runtime package.

## Required Fields

- `version`
- `name`
- `displayName`
- `category`
- `runtime`
- `permissions`
- `inputs`
- `outputs`
- `contextPolicy`
- `trust`

## Runtime

`runtime.kind` is either:

- `deterministic`
- `reasoning`

Use `deterministic` whenever the work can be expressed as direct logic over structured inputs.

## Permissions

Declare:

- whether the agent can use a model
- whether the agent can use network access
- which tools it may request
- which read and write path patterns it expects

These permissions are descriptive and auditable. Policy can still deny them.

## Context Policy

Keep `sections` minimal. Agents should receive only the state they need.

Examples:

- context collector: `repo`, `changes`, `context`
- security audit: `repo`, `changes`, `policy`
- test generation: `changes`

## Trust

Phase 1 manifests record trust metadata:

- `tier`
- `source`
- `reviewed`

This metadata is scaffolding for stronger plugin trust enforcement in later phases.

Planned catalog-facing metadata such as SDLC domain, support level, maturity, and trust scope is tracked separately in [docs/MANIFEST_METADATA.md](MANIFEST_METADATA.md). Do not add those fields ad hoc until the shared schema contract lands.

## Authoring Rule

If your agent output or manifest shape changes, update the shared schemas and tests in the same change.
