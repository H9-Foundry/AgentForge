# AgentOps

AgentOps is an open-source, secure-by-default, repo-first runtime for software engineering workflows. The initial delivery target is a runnable local PR-review slice that feels more like GitHub Actions for engineering agents than a chat assistant.

## Phase 1 Scope
- TypeScript monorepo with explicit package boundaries
- Contract-first schemas and shared types
- Context engine and policy engine v1
- Deterministic workflow runtime with constrained reasoning hooks
- Safe adapters for git, filesystem, shell, and minimal GitHub integration stubs
- CLI commands for `init`, `scan`, `run`, and `explain last-run`
- Official starter workflow and starter agents

## Workspace Layout
- `packages/*`: core runtime, contracts, CLI, SDK, and support packages
- `agents/*`: official starter agents
- `adapters/*`: policy-aware tool wrappers
- `docs/`: architecture and workflow notes
- `examples/`: starter fixture repositories and config examples
- `.agentops/`: runtime config, workflow definitions, and generated run artifacts

## Development
```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Security And Release Notes

- [SECURITY.md](/Users/ethan/Repo/AgentOps/SECURITY.md)
- [docs/security-model.md](/Users/ethan/Repo/AgentOps/docs/security-model.md)
- [docs/release-trust.md](/Users/ethan/Repo/AgentOps/docs/release-trust.md)
- [docs/github-actions.md](/Users/ethan/Repo/AgentOps/docs/github-actions.md)

## Contributor And Extension Guides

- [CONTRIBUTING.md](/Users/ethan/Repo/AgentOps/CONTRIBUTING.md)
- [docs/runtime-model.md](/Users/ethan/Repo/AgentOps/docs/runtime-model.md)
- [docs/policy-model.md](/Users/ethan/Repo/AgentOps/docs/policy-model.md)
- [docs/agent-manifest-guide.md](/Users/ethan/Repo/AgentOps/docs/agent-manifest-guide.md)
- [docs/plugin-author-guide.md](/Users/ethan/Repo/AgentOps/docs/plugin-author-guide.md)
- [examples/README.md](/Users/ethan/Repo/AgentOps/examples/README.md)
