# Quickstart

This quickstart is the expanded published-CLI walkthrough for external evaluators. It starts with the zero-install `npx` path, then walks through the current official AgentForge wedges: secure local repository review plus the planning-to-design-to-implementation-to-QA-to-security-to-maintenance lifecycle handoff, all with auditable outputs.

Published CLI wording rule:

- `available in the published CLI` means available in the latest npm release
- `source-build only` means the capability exists on `main` but has not reached npm yet
- this document should use those terms explicitly whenever repo `main` is ahead of the latest published package set

For internal evaluation and release signoff of user-facing surfaces, use the CLI-first rule in [docs/CLI_FIRST_DOGFOODING.md](CLI_FIRST_DOGFOODING.md).

## Fastest Evaluator Path

Use the published CLI if you want to try the current published wedges without cloning the monorepo. The latest published CLI now includes the full official local workflow surface plus `eval run` and `eval compare`.

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

All examples in this document use `npx @h9-foundry/agentforge-cli ...` as the default invocation method. If you plan to run AgentForge repeatedly, a persistent install is optional, but it is not required for the first-run path.

## Optional Installed CLI Path

If you want a shorter repeated command inside one repository, install the published CLI locally and use `npx agentforge ...` instead of the full package name.

```bash
npm install -D @h9-foundry/agentforge-cli
npx agentforge --help
npx agentforge init --preset planning-discovery
npx agentforge run planning-discovery --json
npx agentforge explain last-run --json
```

Use the full `npx @h9-foundry/agentforge-cli ...` form for the least-setup first run. Use the installed `npx agentforge ...` form when you want the same published CLI pinned in one repository with shorter commands.

## Canonical Quick Path

The canonical quick path for the first request-driven workflow is now available in the published CLI.

```bash
mkdir agentforge-demo
cd agentforge-demo
git init
npx @h9-foundry/agentforge-cli init --preset planning-discovery
npx @h9-foundry/agentforge-cli run planning-discovery --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

That path is intentionally four steps only:
1. create a local repo
2. start the preset
3. run the planning workflow
4. inspect the latest run through `agentforge explain last-run`

## Start A Request-Driven Workflow From A Preset

If you want the first request-driven success path without hand-writing YAML, the published CLI now supports one bounded startup preset.

```bash
npx @h9-foundry/agentforge-cli init --preset planning-discovery
```

That command keeps the normal local-first init behavior and also writes `.agentops/requests/planning.yaml` if it does not already exist. It never auto-runs a workflow and it will not overwrite an existing request file.

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

## Run The Official Planning Workflow

Create a bounded planning request. If you used `init --preset planning-discovery`, you can inspect and edit the generated `.agentops/requests/planning.yaml` instead of creating this file by hand:

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
```

Run the official planning wedge:

```bash
npx @h9-foundry/agentforge-cli run planning-discovery --json
```

Inspect the planning run bundle:

- `.agentops/runs/<planning-run-id>/bundle.json`
- `.agentops/runs/<planning-run-id>/summary.md`

The planning bundle should include one `planning-brief` lifecycle artifact.

## Run The Official Design Workflow

Create a design request that points at the prior planning bundle:

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
```

Run the official design wedge:

```bash
npx @h9-foundry/agentforge-cli run architecture-design-review --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

The design bundle should include one `design-record` lifecycle artifact and remain read-only on the normal path.

## Run The Official Implementation Workflow

Create an implementation request that points at the prior design bundle:

```bash
cat > .agentops/requests/implementation.yaml <<'EOF'
designRecordRef: .agentops/runs/<design-run-id>/bundle.json
implementationGoal: Prepare the next bounded implementation proposal
approvalMode: proposal-only
targetPaths:
  - .agentops/agentops.yaml
  - .agentops/policy.yaml
constraints:
  - Keep the default path read-only
EOF
```

Run the official implementation wedge:

```bash
npx @h9-foundry/agentforge-cli run implementation-proposal --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

The implementation bundle should include one `implementation-proposal` lifecycle artifact with deterministic affected-path inventory plus approval-required validation guidance. The default path remains read-only and proposal-only.

If `scan --json` still reports `packageManager: "unknown"` in a generic repo, `implementation-proposal` will still accept bounded root-package validation commands such as `pnpm test`, `npm test`, or `yarn test` when they match discovered allowlisted scripts in `package.json`.

## Run The Official QA Workflow

`qa-review` is now available in the published CLI as part of the official local workflow surface.

Create a QA request that points at the prior implementation bundle:

```bash
cat > .agentops/requests/qa.yaml <<'EOF'
targetRef: .agentops/runs/<implementation-run-id>/bundle.json
evidenceSources:
  - .agentops/runs/<implementation-run-id>/summary.md
focusAreas:
  - regression-risk
releaseContext: candidate
EOF
```

Run the official QA wedge:

```bash
npx @h9-foundry/agentforge-cli run qa-review --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

The QA bundle should include one `qa-report` lifecycle artifact with normalized evidence sources, normalized executed checks, coverage gaps, findings, and recommended next checks. The default path remains read-only and bounded to local evidence.

If `scan --json` still reports `packageManager: "unknown"` in a generic repo, `qa-review` will still accept bounded root-package executed checks such as `pnpm test`, `npm test`, or `yarn test` when they match discovered allowlisted scripts in `package.json`.

## Run The Official Security Workflow

`security-review` is now available in the published CLI as part of the official local workflow surface.

Create a security request that points at the prior QA or implementation bundle:

```bash
cat > .agentops/requests/security.yaml <<'EOF'
targetRef: .agentops/runs/<qa-or-implementation-run-id>/bundle.json
evidenceSources:
  - .agentops/runs/<qa-or-implementation-run-id>/summary.md
focusAreas:
  - dependency-risk
  - release-candidate-review
severityThreshold: medium
releaseContext: candidate
EOF
```

Run the official security wedge:

```bash
npx @h9-foundry/agentforge-cli run security-review --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

The security bundle should include one `security-report` lifecycle artifact with normalized security evidence provenance, findings, severity summary, mitigations, release impact, and follow-up work. The default path remains read-only and more restrictive than the generic review wedges.

## Run The Official Maintenance Workflow

`maintenance-triage` is now available in the published CLI as part of the official local workflow surface.

Create a maintenance request that points at bounded maintenance follow-up context. The published maintenance request accepts `dependencyAlertRefs`, `docsTaskRefs`, `releaseReportRefs`, or `issueRefs`; it does not accept a security bundle in `releaseReportRefs`.

```bash
cat > .agentops/requests/maintenance.yaml <<'EOF'
maintenanceGoal: Review dependency and docs hygiene after the latest workflow chain
issueRefs:
  - '#224'
constraints:
  - Keep the workflow read-only
EOF
```

Run the official maintenance wedge:

```bash
npx @h9-foundry/agentforge-cli run maintenance-triage --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

The maintenance bundle should include one `maintenance-report` lifecycle artifact with deterministic evidence sources, affected packages or docs, routing recommendation, and bounded next-step guidance. The default path remains read-only and does not apply dependency updates or docs edits automatically.

## Contributor And Source-Build Path

This section is for contributors working on AgentForge itself. If you are only evaluating the product in another repository, stop at the published-CLI sections above and use the wiki as a curated how-to layer only; repo docs remain canonical.

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

## Run The Current Official Workflows From Source

```bash
node packages/cli/dist/bin.js run pr-review
node packages/cli/dist/bin.js run planning-discovery
node packages/cli/dist/bin.js run architecture-design-review
node packages/cli/dist/bin.js run implementation-proposal
node packages/cli/dist/bin.js run qa-review
node packages/cli/dist/bin.js run security-review
node packages/cli/dist/bin.js run release-readiness
node packages/cli/dist/bin.js run pipeline-evidence-review
node packages/cli/dist/bin.js run deployment-gate-review
node packages/cli/dist/bin.js run promotion-approval
node packages/cli/dist/bin.js run incident-handoff
node packages/cli/dist/bin.js run maintenance-triage
```

## Inspect The Latest Run

```bash
node packages/cli/dist/bin.js explain last-run
```

## Dogfood The Official Workflows With Local Evals

Use the published CLI to execute the deterministic eval corpus against the official workflow surface:

```bash
npx @h9-foundry/agentforge-cli eval run planning-discovery-local-brief --json
npx @h9-foundry/agentforge-cli eval run maintenance-triage-local-report --json
```

Each eval writes a normal run bundle under `.agentops/runs/<eval-run-id>/` and emits one `eval-result` lifecycle artifact.

To compare two eval runs deterministically and emit a benchmark artifact:

```bash
npx @h9-foundry/agentforge-cli eval compare <baseline-eval-run-id> <candidate-eval-run-id> --json
npx @h9-foundry/agentforge-cli explain last-run --json
```

The benchmark compare path remains local-first and deterministic. It distinguishes:

- deterministic regressions
- deterministic improvements
- non-comparable changes such as spec or workflow mismatches

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
