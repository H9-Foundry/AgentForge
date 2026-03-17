# Sample Repo

This example is a minimal standalone repository shape for trying the Phase 1 local workflow.

## Intended Use

Copy this directory outside the AgentForge monorepo, initialize it as its own git repository, and then run the published CLI against it.

This sample already includes `.agentops`, so you do not need to run `agentforge init` unless you want to regenerate the starter config yourself.

Example:

```bash
cp -R examples/sample-repo /tmp/agentforge-sample
cd /tmp/agentforge-sample
git init
git add .
git commit -m "initial sample"
npx @h9-foundry/agentforge-cli scan --json
npx @h9-foundry/agentforge-cli run pr-review --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

Inspect the generated artifacts under `.agentops/runs/<run-id>/`:

- `bundle.json` for the structured audit bundle
- `summary.md` for the human-readable run summary

The sample code is intentionally small so the first-run output is easy to inspect.
