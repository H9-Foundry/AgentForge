# External Starter Agent Packaging

This document answers one narrow question:

How should external users think about starter agents and presets today?

## Supported External Consumption Today

The supported external surface is:

- the published CLI
- the official workflows shipped with the CLI
- the presets exposed through the CLI

That means external users should consume AgentForge through workflow commands such as:

- `agentforge run pr-review`
- `agentforge run planning-discovery`
- `agentforge init --preset planning-discovery`

The CLI is the supported packaging boundary. The individual starter agents that power those workflows are not separately supported external packages today.

## What Stays Repo-Internal

These remain repo-internal implementation assets:

- `agents/*`
- `adapters/*`
- `packages/registry-client`

They are real and used by the runtime, but they are not yet a supported external installation surface.

## External Boundary

Use these rules when describing the current product:

- official workflows are externally consumable through the CLI
- official starter agents are bundled implementation assets behind those workflows
- presets are supported entry points for common external workflow startup
- local/manual plugins are supported only through explicit local registration
- remote registry discovery, install, and activation remain future-facing

## Trust Boundary

Current trust posture stays unchanged:

- built-in workflow assets and bundled starter agents are core official assets
- local/manual plugins must still pass existing trust-policy checks
- third-party registry-backed discovery or activation is not supported yet
- `packages/registry-client` remains internal until the registry roadmap lands

## Future Packaging Direction

The intended direction is:

1. keep the CLI and official workflows as the supported external surface
2. make presets more discoverable and easier to start
3. define registry metadata and read-only discovery
4. only then define any bounded third-party activation path

This document does not imply that starter agents will become individually supported npm packages.
