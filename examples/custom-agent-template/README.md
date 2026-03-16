# Custom Agent Template

This template shows the minimum structure for a basic AgentOps agent package.

## Files

- `agent.manifest.json`: declarative permissions and trust metadata
- `src/index.ts`: runtime implementation

## Usage

1. Copy this folder into a new workspace package or separate repository.
2. Rename the package and agent identifiers.
3. Adjust the manifest permissions and context policy.
4. Register the agent in your local runtime bootstrap.

This template is intentionally deterministic and read-only. Use it as a safe starting point before adding reasoning or tool requests.
