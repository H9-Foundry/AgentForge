# Plugin Author Guide

AgentForge currently supports local/manual agent plugins only. There is no remote registry, install flow, or adapter plugin system in this phase.

## Package Shape

Start from [examples/custom-agent-template/README.md](/Users/ethan/Repo/AgentOps/examples/custom-agent-template/README.md).

Your local plugin package should export a `RuntimeAgent` through one of these shapes:

- `default`
- `agent`
- a named export whose value is the `RuntimeAgent`

The exported manifest is validated at load time.

## Registration

Register the plugin in `.agentops/agentops.yaml`:

```yaml
plugins:
  agents:
    - name: local-review
      package: "@your-scope/local-review"
      enabled: true
```

The `name` must match the exported `manifest.name`. Registration names that collide with built-in agents are rejected.

## Trust Enforcement

Policy now enforces plugin trust metadata before the plugin can run. The relevant controls live in `.agentops/policy.yaml`:

```yaml
plugins:
  allowed_tiers:
    - core
    - verified
  allowed_sources:
    - official
    - local
  require_reviewed: true
```

A plugin is blocked when any of these checks fail:

- its `trust.tier` is not allowed
- its `trust.source` is not allowed
- `trust.reviewed` is `false` while policy requires review

Blocked plugins are recorded in the audit bundle and markdown summary.

## Operational Constraints

- plugin loading is limited to local workspace packages
- plugin trust is evaluated before workflow execution
- blocked plugins are never executed
- workflows that reference a blocked plugin fail fast with an explicit reason

## What This Phase Does Not Include

- remote plugin discovery
- package installation
- signed third-party plugin distribution
- adapter or provider plugin loading
