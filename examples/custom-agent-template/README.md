# Custom Agent Template

This template shows the minimum structure for a local AgentOps agent plugin package.

## Files

- `agent.manifest.json`: declarative permissions and trust metadata
- `src/index.ts`: runtime implementation
- `agentops.plugin-example.yaml`: positive registration example
- `policy.plugin-block-example.yaml`: negative policy example that blocks the plugin

## Positive Example

Register the plugin in `.agentops/agentops.yaml`:

```yaml
version: 1
project:
  name: sample-repo
  language: typescript
runtime:
  mode: inspect
  runs_path: .agentops/runs
providers:
  default: disabled
plugins:
  agents:
    - name: custom-agent-template
      package: "@agentops/custom-agent-template"
      enabled: true
```

Then reference the agent in a workflow node. The plugin will load only if it is a local workspace package and its trust metadata passes policy.

## Negative Example

If policy forbids the plugin trust metadata, the CLI records the rejection instead of silently skipping it. See `policy.plugin-block-example.yaml` for a concrete example that blocks a plugin by source and review status.

## Usage

1. Copy this folder into a new workspace package.
2. Rename the package and agent identifiers.
3. Adjust the manifest permissions and trust metadata.
4. Register the agent in `.agentops/agentops.yaml`.
5. Confirm the plugin passes `.agentops/policy.yaml` before wiring it into a workflow.
