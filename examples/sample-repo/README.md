# Sample Repo

This example is a minimal standalone repository shape for trying the Phase 1 local workflow.

## Intended Use

Copy this directory outside the AgentForge monorepo, initialize it as its own git repository, and then run the built CLI against it.

Example:

```bash
cp -R examples/sample-repo /tmp/agentforge-sample
cd /tmp/agentforge-sample
git init
git add .
git commit -m "initial sample"
node /path/to/AgentForge/.build/packages/cli/src/bin.js init
node /path/to/AgentForge/.build/packages/cli/src/bin.js scan --json
node /path/to/AgentForge/.build/packages/cli/src/bin.js run pr-review --json
```

The sample code is intentionally small so the audit output is easy to inspect.
