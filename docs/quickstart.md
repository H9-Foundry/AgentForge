# Quickstart

```bash
pnpm install
pnpm build
node .build/packages/cli/src/bin.js init
node .build/packages/cli/src/bin.js scan
node .build/packages/cli/src/bin.js run pr-review
node .build/packages/cli/src/bin.js explain last-run
```

The starter configuration is written under `.agentops/`. Run artifacts are written under `.agentops/runs/<run-id>/`.

For the GitHub CI wrapper and PR/issue reporting flow, see [docs/github-actions.md](/Users/ethan/Repo/AgentOps/docs/github-actions.md).
For the Phase 1 security posture and build provenance approach, see [docs/security-model.md](/Users/ethan/Repo/AgentOps/docs/security-model.md) and [docs/release-trust.md](/Users/ethan/Repo/AgentOps/docs/release-trust.md).
For contributor workflow and extension authoring, start with [CONTRIBUTING.md](/Users/ethan/Repo/AgentOps/CONTRIBUTING.md), [docs/agent-manifest-guide.md](/Users/ethan/Repo/AgentOps/docs/agent-manifest-guide.md), and [docs/plugin-author-guide.md](/Users/ethan/Repo/AgentOps/docs/plugin-author-guide.md).
