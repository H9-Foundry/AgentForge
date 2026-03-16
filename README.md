# AgentForge

AgentForge is an open-source, secure-by-default, repo-first runtime for software engineering workflows. The initial delivery target is a runnable local PR-review slice that feels more like GitHub Actions for engineering agents than a chat assistant.

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
pnpm build:packages
```

Use the packaged CLI for local workflow and release-shape checks:

```bash
node packages/cli/dist/bin.js init
node packages/cli/dist/bin.js run pr-review
node packages/cli/dist/bin.js explain last-run
node packages/cli/dist/bin.js release guide
node packages/cli/dist/bin.js release check --json
```

## Release Surface

Curated public packages:

- `@h9-foundry/agentforge-cli`
- `@h9-foundry/agentforge-schemas`
- `@h9-foundry/agentforge-shared-types`
- `@h9-foundry/agentforge-sdk`
- `@h9-foundry/agentforge-context-engine`
- `@h9-foundry/agentforge-policy-engine`
- `@h9-foundry/agentforge-runtime`
- `@h9-foundry/agentforge-audit`

Internal workspace packages remain private until their APIs stabilize.

## Release Bootstrap

Package publishing uses GitHub OIDC trusted publishing for `@h9-foundry/agentforge-*`.

- Run `npm login` once on the workstation that Codex uses. The CLI expects machine-level auth in `~/.npmrc`.
- Use `agentforge release guide` for the external npm bootstrap steps and reference URLs.
- Use `agentforge release check --json` to validate npm auth, package metadata, release workflow config, Changesets config, and local release-shape checks.

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
