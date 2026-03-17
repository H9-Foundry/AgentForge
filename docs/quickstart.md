# Quickstart

This quickstart walks through the current official AgentForge wedge: secure local repository review with auditable outputs.

## Fastest Evaluator Path

Use the published CLI if you want to try the current wedge without cloning the monorepo.

```bash
mkdir agentforge-demo
cd agentforge-demo
git init
npx @h9-foundry/agentforge-cli init
npx @h9-foundry/agentforge-cli scan --json
npx @h9-foundry/agentforge-cli run pr-review --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

That flow creates `.agentops/` locally and writes run artifacts under `.agentops/runs/<run-id>/`.

## What To Inspect After The First Run

- `.agentops/runs/<run-id>/bundle.json`
  - structured audit bundle with workflow metadata, findings, proposed actions, redaction state, and audit entries
- `.agentops/runs/<run-id>/summary.md`
  - human-readable summary of workflow status and the audit trail

For a small clean repository, a successful run should report:

- workflow `pr-review`
- `status: success`
- zero findings, blocked actions, and blocked plugins
- completed audit steps for `context-collector`, `security-audit`, `code-review`, `test-generation`, and `final-report`

## Contributor And Source-Build Path

If you want to work on AgentForge itself, build the monorepo locally:

```bash
pnpm install
pnpm build
pnpm build:packages
```

## Initialize Local Config

```bash
node packages/cli/dist/bin.js init
```

This writes starter config under `.agentops/`.

## Inspect The Repository

```bash
node packages/cli/dist/bin.js scan
```

## Run The Current Official Workflow

```bash
node packages/cli/dist/bin.js run pr-review
```

## Inspect The Latest Run

```bash
node packages/cli/dist/bin.js explain last-run
```

Run artifacts are written under `.agentops/runs/<run-id>/`.

## Validate The Public Package Set

```bash
pnpm pack:public
pnpm release:verify
```

## Related Docs

- [README.md](../README.md)
- [architecture.md](architecture.md)
- [security-model.md](security-model.md)
- [release-trust.md](release-trust.md)
- [PLATFORM_VISION.md](PLATFORM_VISION.md)
- [ROADMAP.md](ROADMAP.md)
