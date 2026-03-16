# Quickstart

```bash
pnpm install
pnpm build
pnpm build:packages
node packages/cli/dist/bin.js init
node packages/cli/dist/bin.js scan
node packages/cli/dist/bin.js run pr-review
node packages/cli/dist/bin.js explain last-run
```

The starter configuration is written under `.agentops/`. Run artifacts are written under `.agentops/runs/<run-id>/`.

To dry-run the publishable package set:

```bash
pnpm pack:public
pnpm release:verify
```

For the GitHub CI wrapper and PR/issue reporting flow, see [docs/github-actions.md](./github-actions.md).
For the Phase 1 security posture and build provenance approach, see [docs/security-model.md](./security-model.md) and [docs/release-trust.md](./release-trust.md).
For contributor workflow and extension authoring, start with [CONTRIBUTING.md](../CONTRIBUTING.md), [docs/agent-manifest-guide.md](./agent-manifest-guide.md), and [docs/plugin-author-guide.md](./plugin-author-guide.md).
