# AgentForge

AgentForge is an open-source, secure-by-default SDLC workflow platform core for repository-aware software engineering automation.

It is workflow-first, not chat-first: workflows define the job, policy defines what is allowed, the runtime decides what executes, tools perform the work, and humans approve side effects when required.

## What You Can Do Today

- try the current official workflow wedge with the published CLI, without cloning this monorepo
- initialize a repository, scan it, and run `pr-review`, `planning-discovery`, `architecture-design-review`, `implementation-proposal`, `qa-review`, `security-review`, and `maintenance-triage` with the latest published CLI
- use the published CLI today for the current official workflow surface, and use the source build on `main` for newer startup UX that has not reached npm yet
- inspect generated audit bundles plus lifecycle artifacts such as `planning-brief`, `design-record`, `implementation-proposal`, `qa-report`, `security-report`, and `maintenance-report`
- run `agentforge eval run` and `agentforge eval compare` locally against the deterministic workflow fixture corpus in the latest published CLI
- evaluate the secure-by-default runtime model before broader SDLC workflow support lands

## Adoption Target

AgentForge is ready now for technical early adopters who want local-first, read-only workflow tooling before PR creation. Plug-and-play external adoption for less technical users is an active product target, not a completed claim: the goal is to make the published CLI installable, understandable, and usable in other repositories without monorepo knowledge or hand-authoring request YAML for common paths.

See [docs/EXTERNAL_LOCAL_ADOPTION_READINESS.md](docs/EXTERNAL_LOCAL_ADOPTION_READINESS.md) for the current local-only readiness rubric and the exact constraints on external use today.

Published CLI wording rule:

- `available in the published CLI` means the capability is present in the latest npm release
- `source-build only` means the capability exists on `main` but has not reached the latest npm release yet
- product-facing docs must use those terms consistently whenever repo `main` is ahead of npm

## Quick Path

The current canonical quick path for the first request-driven workflow is source-build only until the next npm release includes `init --preset planning-discovery`.

```bash
git clone https://github.com/H9-Foundry/AgentForge.git
cd AgentForge
pnpm install
pnpm build
node packages/cli/dist/bin.js init --preset planning-discovery
node packages/cli/dist/bin.js run planning-discovery --json
node packages/cli/dist/bin.js explain last-run --json
```

That path is intentionally four steps only:
1. clone, install, and build
2. start the preset
3. run the planning workflow
4. inspect the latest run through `agentforge explain last-run`

The preset writes an explicit starter request to `.agentops/requests/planning.yaml`, never auto-runs the workflow, and never overwrites an existing request file.

If you want the fastest published CLI evaluator path today, keep using `init`, `scan`, and `run pr-review` until the next npm release includes the preset startup surface.

If you want to develop AgentForge itself, use the contributor/source-build path in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/quickstart.md](docs/quickstart.md).

## What Success Looks Like

After a clean official workflow run, the CLI returns a compact JSON summary like this:

```json
{
  "runId": "1773758683225-4271ed",
  "status": "success",
  "findings": 0,
  "blockedActions": 0,
  "blockedPlugins": 0,
  "artifactCount": 1,
  "artifactKinds": ["planning-brief"],
  "jsonPath": ".agentops/runs/1773758683225-4271ed/bundle.json",
  "markdownPath": ".agentops/runs/1773758683225-4271ed/summary.md"
}
```

Inspect these two artifacts next:

- `bundle.json`: structured audit bundle for tools, automation, or deeper review
- `summary.md`: human-readable run summary with workflow status and audit trail

For a small clean repository, the markdown summary will usually show:

- workflow `pr-review`
- `status: success`
- zero findings, blocked actions, and blocked plugins
- an audit trail for `context-collector`, `security-audit`, `code-review`, `test-generation`, and `final-report`

For the new lifecycle wedges, `bundle.json` also persists one structured lifecycle artifact per run:

- `planning-discovery` emits `planning-brief`
- `architecture-design-review` emits `design-record`
- `implementation-proposal` emits an `implementation-proposal` artifact with deterministic inventory, validation-command classification, and a proposal-only next-step plan
- `qa-review` emits a `qa-report`
- `security-review` emits a `security-report`
- `maintenance-triage` emits a `maintenance-report`

## Project Definition

AgentForge provides the runtime, policy, context, audit, and packaging foundation for software engineering workflows that need to reason over a repository without abandoning deterministic controls. The current official workflow surface is local and repo-first: `pr-review`, `planning-discovery`, `architecture-design-review`, `implementation-proposal`, `qa-review`, `security-review`, and `maintenance-triage`.

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
- seven official local workflow slices:
  - `.agentops/workflows/pr-review.yaml`
  - `.agentops/workflows/planning-discovery.yaml`
  - `.agentops/workflows/architecture-design-review.yaml`
  - `.agentops/workflows/implementation-proposal.yaml`
  - `.agentops/workflows/qa-review.yaml`
  - `.agentops/workflows/security-review.yaml`
  - `.agentops/workflows/maintenance-triage.yaml`
- official in-repo starter agents for context collection, planning analysis, design analysis, implementation planning, QA analysis, security analysis, maintenance analysis, security audit, code review, and test generation; these are bundled workflow assets, not separately supported external packages
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
- plug-and-play external adoption and less-technical user readiness

## SDLC Lifecycle Coverage

| SDLC Domain | Status | Notes |
| --- | --- | --- |
| Plan / intake / discovery | Available now | `planning-discovery` is an official local workflow that emits a `planning-brief` artifact. |
| Architecture / design | Available now | `architecture-design-review` is an official local workflow that consumes a planning brief and emits a `design-record` artifact. |
| Build / implementation | Available now | `implementation-proposal` is an official local workflow that consumes a design record, emits an `implementation-proposal` artifact, and keeps the default path read-only and proposal-only. |
| Review / test / QA | Available now | `pr-review` remains official, and `qa-review` is now an official local workflow that consumes an implementation proposal and emits a `qa-report` artifact without widening the default side-effect posture. |
| Security / compliance / DevSecOps | Available now | `security-review` is an official local workflow that consumes bounded local evidence, emits a `security-report` artifact, and keeps the default path read-only; broader security variants remain planned. |
| Release / CI/CD | Partial | Release verification and package publishing exist; broader CI/CD workflow coverage is planned. |
| Operate / incidents / observability handoff | Planned | Not implemented yet. |
| Maintain / upgrades / docs hygiene | Available now | `maintenance-triage` is an official local workflow that consumes bounded maintenance evidence, emits a `maintenance-report` artifact, and keeps the default path read-only; broader maintenance variants remain planned. |

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

For the official planning, design, implementation, QA, security, and maintenance wedges, the same run directory now also persists lifecycle artifacts inside `bundle.json`, which makes the lifecycle handoff inspectable without widening the side-effect posture.

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

See [docs/EXTERNAL_STARTER_AGENT_PACKAGING.md](docs/EXTERNAL_STARTER_AGENT_PACKAGING.md) for the current external support boundary for starter agents, presets, and registry-facing surfaces.

## Quickstart

### Fastest Evaluator Path

Use the published CLI if you want to try the current wedge quickly:

```bash
npx @h9-foundry/agentforge-cli init
npx @h9-foundry/agentforge-cli scan --json
npx @h9-foundry/agentforge-cli run pr-review --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

The last command should point you to:

- `.agentops/runs/<run-id>/bundle.json`
- `.agentops/runs/<run-id>/summary.md`

### Planning To Design Evaluator Path

Once `.agentops/` exists, you can evaluate the first lifecycle handoff end to end:

```bash
mkdir -p .agentops/requests
cat > .agentops/requests/planning.yaml <<'EOF'
problemStatement: Plan the first workflow wedge
goals:
  - Produce a planning brief
constraints:
  - Keep the workflow local-first
issueRefs:
  - '#127'
pathHints:
  - packages/cli
  - packages/runtime
EOF

npx @h9-foundry/agentforge-cli run planning-discovery --json
```

Then point the design workflow at the prior planning bundle:

```bash
cat > .agentops/requests/design.yaml <<'EOF'
planningBriefRef: .agentops/runs/<planning-run-id>/bundle.json
decisionTarget: Choose the first design workflow implementation shape
pathHints:
  - packages/runtime
  - packages/schemas
alternatives:
  - single-workflow-pass
EOF

npx @h9-foundry/agentforge-cli run architecture-design-review --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

That flow gives you:

- one `planning-brief` artifact in the planning run bundle
- one `design-record` artifact in the design run bundle
- a fully local, read-only planning-to-design evaluator path

### Contributor And Source-Build Path

Install and build the monorepo if you want to work on AgentForge itself:

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

Current onboarding focus:

- keep the current wedge CLI-first and as frictionless as possible for new evaluators
- improve README, quickstart, examples, and contributor entry points in parallel with the Phase 1 foundation work

See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md), [docs/CONTEXT_SLICE_CONTRACTS.md](docs/CONTEXT_SLICE_CONTRACTS.md), and [docs/QUEUE_EXECUTION_FLOW.md](docs/QUEUE_EXECUTION_FLOW.md).

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
- Follow the newcomer-usability track if you want to improve the first-run CLI and onboarding experience: [#97](https://github.com/H9-Foundry/AgentForge/issues/97)

If you need help or want to contribute, open an issue in this repository with the relevant template and link it to the appropriate roadmap phase or epic.
