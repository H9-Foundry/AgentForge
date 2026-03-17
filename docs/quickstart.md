# Quickstart

This quickstart walks through the current official AgentForge wedge: secure local repository review with auditable outputs.

## Install And Build

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
