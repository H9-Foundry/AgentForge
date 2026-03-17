# AgentForge

AgentForge is an open-source, secure-by-default SDLC workflow platform core for repository-aware software engineering automation.

It is workflow-first, not chat-first: workflows define the job, policy defines what is allowed, the runtime decides what executes, tools perform the work, and humans approve side effects when required.

## Project Definition

AgentForge provides the runtime, policy, context, audit, and packaging foundation for software engineering workflows that need to reason over a repository without abandoning deterministic controls. The current product wedge is a local, repo-first `pr-review` workflow that demonstrates the model end to end.

## Problem Statement

Most engineering automation is split between brittle scripted CI, loosely governed chat assistants, and bespoke internal tooling. That leaves teams with three recurring problems:

- too much implicit trust in unstructured LLM output
- too much context passed to tools and models
- too little auditability around what was read, proposed, blocked, or executed

AgentForge exists to make software engineering workflows safer to automate by default while still leaving room for bounded reasoning where it adds value.

## Why This Is Useful

- Keep workflow definitions explicit and reviewable.
- Keep the runtime deterministic before agentic behavior is introduced.
- Keep policies authoritative over tools, manifests, and workflow requests.
- Keep side effects approval-gated instead of silently happening inside prompts or tool wrappers.
- Keep artifacts, redactions, trust metadata, and run summaries auditable.
- Keep the architecture extensible through plugins without defaulting to a plugin free-for-all.

## Current Status And Maturity

AgentForge is an early open-source platform core, not a complete end-to-end SDLC platform yet.

### Available Now

- secure-by-default runtime, policy, context, audit, and schema foundation
- one official local workflow slice: `.agentops/workflows/pr-review.yaml`
- official starter agents for context collection, security audit, code review, and test generation
- internal starter adapters for filesystem, git, shell, and GitHub-aware mediation
- public npm packages for the runtime core, CLI, contracts, and audit surfaces
- GitHub Actions release automation, trusted publishing, and package verification tooling
- local/manual plugin registration with policy-based trust enforcement

### In Progress

- platform narrative, roadmap, and SDLC planning hygiene
- broader workflow coverage across planning, design, build, QA, security, release, operations, and maintenance
- clearer support matrix for workflows, agents, adapters, environments, and integrations

### Planned

- broader official workflow catalog across the SDLC
- expanded policy, schema, and runtime interaction model
- richer GitHub integration plus additional SCM/CI adapters
- plugin ecosystem and registry-facing surfaces
- evals, benchmarks, and compatibility guarantees
- enterprise governance, tenancy, and scale-oriented controls

## SDLC Lifecycle Coverage

| SDLC Domain | Status | Notes |
| --- | --- | --- |
| Plan / intake / discovery | Planned | Not implemented yet; currently represented only in roadmap and issue backlog. |
| Architecture / design | Planned | No official workflow yet. |
| Build / implementation | Planned | No implementation workflow yet beyond secure runtime scaffolding. |
| Review / test / QA | Available now | The `pr-review` wedge covers review, security audit, and proposed test-generation outputs. |
| Security / compliance / DevSecOps | Partial | Policy, trust, redaction, and audit exist; broader security workflows are planned. |
| Release / CI/CD | Partial | Release verification and package publishing exist; broader CI/CD workflow coverage is planned. |
| Operate / incidents / observability handoff | Planned | Not implemented yet. |
| Maintain / upgrades / docs hygiene | Partial | Release hygiene and dependency maintenance are present; dedicated workflows are planned. |

See [docs/SDLC_COVERAGE.md](docs/SDLC_COVERAGE.md) for the detailed lifecycle map and [docs/SUPPORT_MATRIX.md](docs/SUPPORT_MATRIX.md) for the current support matrix.

## Architecture Summary

AgentForge follows a strict separation of concerns:

- **LLMs reason** when a workflow node explicitly permits bounded reasoning.
- **The runtime decides** workflow sequencing, tool mediation, and audit capture.
- **Tools execute** only through explicit adapters with schemas and side-effect classifications.
- **Policy permits** reads, writes, network, paths, and tools.
- **Humans approve side effects** when policy or runtime requires it.

Current runtime flow:

1. The CLI loads `.agentops` configuration, policy, and workflow definition.
2. The context engine builds a normalized repository-aware state envelope.
3. The policy engine resolves the effective policy snapshot.
4. The runtime executes ordered workflow nodes with minimal context slices.
5. Adapters are invoked only after policy mediation.
6. Audit bundles and summaries are written under `.agentops/runs/<run-id>/`.

See [docs/architecture.md](docs/architecture.md), [docs/runtime-model.md](docs/runtime-model.md), [docs/policy-model.md](docs/policy-model.md), and [docs/security-model.md](docs/security-model.md).

## Package And Workspace Overview

### Public Packages

- `@h9-foundry/agentforge-cli`
- `@h9-foundry/agentforge-schemas`
- `@h9-foundry/agentforge-shared-types`
- `@h9-foundry/agentforge-sdk`
- `@h9-foundry/agentforge-context-engine`
- `@h9-foundry/agentforge-policy-engine`
- `@h9-foundry/agentforge-runtime`
- `@h9-foundry/agentforge-audit`

### Internal Workspace Surfaces

- `packages/registry-client`: future registry-facing surface, not a production registry integration yet
- `agents/*`: official starter agents shipped in-repo
- `adapters/*`: internal starter adapters with explicit side-effect classes and policy mediation
- `.agentops/*`: starter config and workflow assets
- `examples/*`: starter repositories and extension examples

Internal packages remain private until their APIs stabilize and their support expectations are documented.

## Quickstart

Install and build the workspace:

```bash
pnpm install
pnpm build
pnpm build:packages
```

Initialize local config and run the current official workflow slice:

```bash
node packages/cli/dist/bin.js init
node packages/cli/dist/bin.js scan
node packages/cli/dist/bin.js run pr-review
node packages/cli/dist/bin.js explain last-run
```

Release tooling:

```bash
node packages/cli/dist/bin.js release guide
node packages/cli/dist/bin.js release check --json
node packages/cli/dist/bin.js release verify --json
```

See [docs/quickstart.md](docs/quickstart.md) for a more explicit walkthrough.

## Examples

- [examples/README.md](examples/README.md)
- [examples/sample-repo/README.md](examples/sample-repo/README.md)
- [examples/custom-agent-template/README.md](examples/custom-agent-template/README.md)

## Security And Trust Model

AgentForge is intentionally conservative:

- read-only by default
- network denied by default
- writes require approval
- blocked paths win over broader allow rules
- policy decisions override workflow intent and adapter capability
- approval-gated tools are blocked before execution
- run outputs are structured, redacted, and auditable
- plugin trust metadata is validated against policy before execution

See [SECURITY.md](SECURITY.md), [docs/security-model.md](docs/security-model.md), [docs/release-trust.md](docs/release-trust.md), and [docs/plugin-author-guide.md](docs/plugin-author-guide.md).

## Roadmap Summary

AgentForge is moving from a single secure `pr-review` wedge toward a broader SDLC workflow platform core.

- **Platform Foundation:** strengthen runtime, policy, schema, and platform framing
- **General SDLC Expansion:** add workflow support across planning, design, build, QA, security, release, operations, and maintenance
- **Ecosystem And Plugins:** improve adapters, plugin surfaces, and registry-facing workflows
- **Enterprise / Governance / Scale:** add compatibility, governance, and scale-oriented controls

Current dogfooding posture:

- use AgentForge on AgentForge for planning, design, review, QA, and release verification
- do not treat it as a broad autonomous implementation engine yet

See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) and [docs/CONTEXT_SLICE_CONTRACTS.md](docs/CONTEXT_SLICE_CONTRACTS.md).

Roadmap docs:

- [docs/PLATFORM_VISION.md](docs/PLATFORM_VISION.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)
- [docs/SDLC_COVERAGE.md](docs/SDLC_COVERAGE.md)
- [docs/SUPPORT_MATRIX.md](docs/SUPPORT_MATRIX.md)
- [docs/GAP_ANALYSIS_GENERAL_SDLC.md](docs/GAP_ANALYSIS_GENERAL_SDLC.md)
- [docs/ISSUE_TAXONOMY.md](docs/ISSUE_TAXONOMY.md)

## Contributor Entry Points

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [docs/github-issue-source-of-truth.md](docs/github-issue-source-of-truth.md)
- [docs/agent-manifest-guide.md](docs/agent-manifest-guide.md)
- [docs/maintainer-signing.md](docs/maintainer-signing.md)

## Issues, Milestones, And Help

- Use GitHub Issues for planning, bugs, features, and proposals.
- Follow the platform roadmap milestones in the GitHub milestone list.
- Start with the roadmap docs before proposing broad new workflow claims or integration work.
- Use the issue templates in `.github/ISSUE_TEMPLATE/` so planning data stays consistent.

If you need help or want to contribute, open an issue in this repository with the relevant template and link it to the appropriate roadmap phase or epic.
