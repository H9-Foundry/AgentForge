# @h9-foundry/agentforge-schemas

## 0.10.0

### Minor Changes

- 0dbf030: Add bounded attestation verification evidence and trust-summary reporting for release workflows.
- 9261149: Add bounded dependency-integrity inventory evidence and surface it through security-review and release-readiness reports.
- 0367e8c: Add registry distribution verification metadata and policy hardening for non-manual plugin activation.

### Patch Changes

- ffdab26: Add a bounded Buildkite CI evidence export contract and normalize Buildkite pipeline exports into shared CI evidence.
- c3df71b: Add provider-agnostic `pipeline-evidence-review` and `deployment-gate-review` workflows with shared CI evidence consumption and lifecycle artifacts.
- b5253bf: Add a bounded Jenkins CI evidence export contract and normalize Jenkins pipeline exports into shared CI evidence.
- fa4d206: Expose normalized host-agnostic CI provenance and status summaries in release-readiness artifacts.
- 25fb68d: Render shared SCM and CI provenance summaries across lifecycle handoff outputs.

## 0.9.0

### Minor Changes

- 203d736: Add a read-only registry metadata contract, including catalog entry and catalog schemas plus inferred shared types for plugin identity, compatibility, trust, and distribution support boundaries.

## 0.8.0

### Minor Changes

- 9ce38fa: Add local benchmark comparison via `agentforge eval compare ...` and emit `benchmark-summary` artifacts for deterministic eval-result deltas.
- ebf3f39: Add a bounded local eval runner with `agentforge eval run <spec-id>` and emit `eval-result` artifacts for deterministic workflow fixture checks.

### Patch Changes

- 005e3ba: Add provider-agnostic `eval-spec` contracts and a deterministic local fixture corpus for the current official workflow surface.

## 0.7.1

### Patch Changes

- 967d03b: Add deterministic local GitHub Actions evidence normalization for QA workflows and shared workflow-linkage contracts for later release-readiness use.
- caf3644: Add deterministic GitHub handoff rendering contracts and audit helpers for planning, design, QA, and release lifecycle artifacts.
- 9f6df53: Add deterministic GitHub issue and pull request normalization primitives for lifecycle workflows, including shared reference/status contracts and propagated normalized refs in workflow artifacts.
- 7a599ac: Add the bounded `incident-analyst` workflow stage and first `incident-brief` lifecycle artifact for `incident-handoff`.
- 565142e: Add deterministic incident-evidence normalization, provenance capture, and redaction-aware routing for `incident-handoff`.
- 46fcef9: Add the bounded `incident-handoff` intake workflow, incident request schema, and deterministic staged-evidence validation.
- 0499804: Add the bounded `maintenance-analyst` starter agent and emit `maintenance-report` lifecycle artifacts for `maintenance-triage`.
- 6d3b36a: Add deterministic maintenance evidence normalization and bounded routing classification for `maintenance-triage`.
- e7a3286: Add the `maintenance-triage` intake workflow, request schema, and deterministic maintenance request validation.
- 6d0a3b6: Add the bounded `release-readiness` request schema, workflow asset scaffolding, and deterministic CLI intake validation.
- 63d571d: Add deterministic release-state normalization and approval-classified publish or promotion mediation for the local `release-readiness` workflow.

## 0.7.0

### Minor Changes

- b0f9b53: Normalize bounded QA evidence deterministically and wire `qa-review` to consume allowlisted validation evidence before QA reasoning.
- df17a9c: Add the bounded `qa-analyst` starter agent and emit `qa-report` lifecycle artifacts for `qa-review`.
- 65b7ee1: Add the bounded `security-review` request contract and official workflow asset.

### Patch Changes

- 9c1d8d0: Add deterministic security evidence normalization and stricter security-report redaction handling for `security-review`.
- bdae136: Add the bounded `security-analyst` workflow stage and first `security-report` lifecycle artifact for `security-review`.

## 0.6.0

### Minor Changes

- 01934f6: Add deterministic implementation inventory metadata and allowlisted validation command normalization for the implementation-proposal workflow.
- b32f49a: Add implementation-proposal artifact emission and the bounded implementation planner workflow node.
- ed5d181: Add the implementation request schema and local workflow intake path for `implementation-proposal`.
- 5ec8683: Add the bounded QA request contract and the initial official `qa-review` workflow asset with deterministic intake validation.

## 0.5.0

### Minor Changes

- b8a25bb: Ship official `planning-discovery` and `architecture-design-review` workflow wedges with validated request inputs, lifecycle artifact emission, and CLI-first evaluator docs.

## 0.4.2

## 0.4.1

### Patch Changes

- 6bd74e6: Add a shared lifecycle artifact envelope schema and inferred types for future SDLC artifact families.
- 86edea7: Add the initial planning, design, review, release, and maintenance lifecycle artifact family schemas.
- b78fb05: Add lifecycle artifact fixtures and focused schema coverage.
- 65eb7e0: Add runtime lifecycle artifact emission and audit linkage support.

## 0.4.0

### Minor Changes

- 608b8cb: Update the published dependency surface for Commander 14 and Zod 4, and add repository CODEOWNERS for stricter branch protection.

## 0.3.2

### Patch Changes

- 1c6c323: Refresh package metadata and documentation for the public open-source release cutover.

## 0.3.1

### Patch Changes

- f53dbd9: Trigger a real GitHub-owned publish to verify npm trusted publishing after the
  initial bootstrap release.

## 0.3.0

### Minor Changes

- 97f5848: Rename the public package family from `@agentops/*` to `@h9-foundry/agentforge-*`, rename the CLI command to `agentforge`, and update release/reporting workflows to the AgentForge brand while keeping the current GitHub repository slug unchanged.

## 0.2.0

### Minor Changes

- 9a94beb: Harden the public release surface for Phase 2 by separating workspace and package builds, adding trusted publishing automation, and enforcing local plugin trust policy in the CLI and runtime audit path.
