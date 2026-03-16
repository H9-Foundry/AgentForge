# Plugin Author Starter Guide

Phase 1 does not ship a full plugin installation system yet, but it does define the shape of a basic custom agent and the runtime expectations around safety.

## Start With The Template

See [examples/custom-agent-template/README.md](/Users/ethan/Repo/AgentOps/examples/custom-agent-template/README.md).

The minimum custom agent package should include:

- `package.json`
- `agent.manifest.json`
- `src/index.ts`

## Authoring Rules

- keep context sections minimal
- prefer deterministic logic first
- request tools explicitly instead of reading arbitrary state
- return structured output only
- do not assume policy will allow every tool your manifest names

## Trust And Review

Custom agents should declare trust metadata even though Phase 1 does not yet enforce install-time trust policy. That metadata is still recorded in audit output and should be reviewed before promotion into official workflows.

## When To Avoid A Plugin

Do not add a custom agent if:

- the behavior belongs in an existing official agent
- the need is only a one-off workflow tweak
- the agent would require unrestricted shell or network access

## Next Step

Copy the template, rename the package and manifest, then wire the agent into a workflow after adding it to the local registry in the CLI or runtime bootstrap.
