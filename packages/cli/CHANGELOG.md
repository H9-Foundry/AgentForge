# @h9-foundry/agentforge-cli

## 0.12.2

### Patch Changes

- 1e4b5a3: Graduate the visualizer `/configure` flow to a supported CLI surface.

  This release makes structured config editing available by default while keeping repo YAML canonical and preserving the guarded preview and save path. It also ships the control-plane configuration snapshot improvements, run and compare provenance links back into `/configure`, and the aligned evaluator-first docs for the stable configuration-management journey.

- Updated dependencies [1e4b5a3]
  - @h9-foundry/agentforge-schemas@0.12.2
  - @h9-foundry/agentforge-shared-types@0.12.2
  - @h9-foundry/agentforge-sdk@0.12.2
  - @h9-foundry/agentforge-context-engine@0.12.2
  - @h9-foundry/agentforge-policy-engine@0.12.2
  - @h9-foundry/agentforge-runtime@0.12.2
  - @h9-foundry/agentforge-audit@0.12.2
  - @h9-foundry/agentforge-visualizer@0.12.2

## 0.12.1

### Patch Changes

- 03a4671: Bundle the visualizer into the published CLI instead of treating it as a separately installed npm package.

  This keeps `agentforge visualizer`, `agentforge ui`, `agentforge visualizer export`, and the benchmark-authoring helpers available through the published CLI while avoiding the standalone first-publish blocker for `@h9-foundry/agentforge-visualizer`.

- Updated dependencies [dc05040]
  - @h9-foundry/agentforge-runtime@0.12.1
  - @h9-foundry/agentforge-schemas@0.12.1
  - @h9-foundry/agentforge-shared-types@0.12.1
  - @h9-foundry/agentforge-sdk@0.12.1
  - @h9-foundry/agentforge-context-engine@0.12.1
  - @h9-foundry/agentforge-policy-engine@0.12.1
  - @h9-foundry/agentforge-audit@0.12.1
  - @h9-foundry/agentforge-visualizer@0.12.1

## 0.12.0

### Minor Changes

- 3b5f04e: Release the packaged local visualizer and CLI-first benchmark workflow surface.

  This cut adds the new public `@h9-foundry/agentforge-visualizer` package and exposes the visualizer through the CLI with `agentforge visualizer`, `agentforge ui`, and `agentforge visualizer export`.

  It also adds CLI-first benchmark authoring support with `agentforge eval benchmark-wizard`, stabilizes the visualizer-facing run and benchmark-ledger contract, and carries measured token plus estimated cost metadata from provider-backed runs into outcomes and release-benchmark review flows.

### Patch Changes

- Updated dependencies [3b5f04e]
  - @h9-foundry/agentforge-visualizer@0.12.0
  - @h9-foundry/agentforge-schemas@0.12.0
  - @h9-foundry/agentforge-shared-types@0.12.0
  - @h9-foundry/agentforge-sdk@0.12.0
  - @h9-foundry/agentforge-runtime@0.12.0
  - @h9-foundry/agentforge-audit@0.12.0
  - @h9-foundry/agentforge-context-engine@0.12.0
  - @h9-foundry/agentforge-policy-engine@0.12.0

## 0.11.0

### Minor Changes

- 3b284b8: Add the `promotion-approval` workflow, request/artifact contracts, and shared handoff rendering for approval-oriented release review on `main`.

### Patch Changes

- Updated dependencies [3b284b8]
  - @h9-foundry/agentforge-audit@0.11.0
  - @h9-foundry/agentforge-schemas@0.11.0
  - @h9-foundry/agentforge-shared-types@0.11.0
  - @h9-foundry/agentforge-runtime@0.11.0
  - @h9-foundry/agentforge-context-engine@0.11.0
  - @h9-foundry/agentforge-policy-engine@0.11.0
  - @h9-foundry/agentforge-sdk@0.11.0

## 0.10.0

### Minor Changes

- 0dbf030: Add bounded attestation verification evidence and trust-summary reporting for release workflows.
- 9261149: Add bounded dependency-integrity inventory evidence and surface it through security-review and release-readiness reports.

### Patch Changes

- ffdab26: Add a bounded Buildkite CI evidence export contract and normalize Buildkite pipeline exports into shared CI evidence.
- c3df71b: Add provider-agnostic `pipeline-evidence-review` and `deployment-gate-review` workflows with shared CI evidence consumption and lifecycle artifacts.
- b5253bf: Add a bounded Jenkins CI evidence export contract and normalize Jenkins pipeline exports into shared CI evidence.
- fa4d206: Expose normalized host-agnostic CI provenance and status summaries in release-readiness artifacts.
- 25fb68d: Render shared SCM and CI provenance summaries across lifecycle handoff outputs.
- Updated dependencies [0dbf030]
- Updated dependencies [ffdab26]
- Updated dependencies [9261149]
- Updated dependencies [c3df71b]
- Updated dependencies [b5253bf]
- Updated dependencies [0367e8c]
- Updated dependencies [fa4d206]
- Updated dependencies [25fb68d]
  - @h9-foundry/agentforge-schemas@0.10.0
  - @h9-foundry/agentforge-shared-types@0.10.0
  - @h9-foundry/agentforge-policy-engine@0.10.0
  - @h9-foundry/agentforge-audit@0.10.0
  - @h9-foundry/agentforge-context-engine@0.10.0
  - @h9-foundry/agentforge-runtime@0.10.0
  - @h9-foundry/agentforge-sdk@0.10.0

## 0.9.0

### Patch Changes

- edd8435: Improve the planning preset quick path by making `init --preset planning-discovery` print explicit next-step guidance and by documenting the source-build-only canonical quick path until the next published release.
- Updated dependencies [9c6c099]
- Updated dependencies [203d736]
  - @h9-foundry/agentforge-policy-engine@0.9.0
  - @h9-foundry/agentforge-schemas@0.9.0
  - @h9-foundry/agentforge-shared-types@0.9.0
  - @h9-foundry/agentforge-runtime@0.9.0
  - @h9-foundry/agentforge-context-engine@0.9.0
  - @h9-foundry/agentforge-audit@0.9.0
  - @h9-foundry/agentforge-sdk@0.9.0

## 0.8.0

### Minor Changes

- 9ce38fa: Add local benchmark comparison via `agentforge eval compare ...` and emit `benchmark-summary` artifacts for deterministic eval-result deltas.
- ebf3f39: Add a bounded local eval runner with `agentforge eval run <spec-id>` and emit `eval-result` artifacts for deterministic workflow fixture checks.

### Patch Changes

- Updated dependencies [9ce38fa]
- Updated dependencies [005e3ba]
- Updated dependencies [ebf3f39]
  - @h9-foundry/agentforge-schemas@0.8.0
  - @h9-foundry/agentforge-shared-types@0.8.0
  - @h9-foundry/agentforge-context-engine@0.8.0
  - @h9-foundry/agentforge-policy-engine@0.8.0
  - @h9-foundry/agentforge-runtime@0.8.0
  - @h9-foundry/agentforge-audit@0.8.0
  - @h9-foundry/agentforge-sdk@0.8.0

## 0.7.1

### Patch Changes

- 967d03b: Add deterministic local GitHub Actions evidence normalization for QA workflows and shared workflow-linkage contracts for later release-readiness use.
- 9f6df53: Add deterministic GitHub issue and pull request normalization primitives for lifecycle workflows, including shared reference/status contracts and propagated normalized refs in workflow artifacts.
- 7a599ac: Add the bounded `incident-analyst` workflow stage and first `incident-brief` lifecycle artifact for `incident-handoff`.
- 565142e: Add deterministic incident-evidence normalization, provenance capture, and redaction-aware routing for `incident-handoff`.
- 46fcef9: Add the bounded `incident-handoff` intake workflow, incident request schema, and deterministic staged-evidence validation.
- 0499804: Add the bounded `maintenance-analyst` starter agent and emit `maintenance-report` lifecycle artifacts for `maintenance-triage`.
- 6d3b36a: Add deterministic maintenance evidence normalization and bounded routing classification for `maintenance-triage`.
- e7a3286: Add the `maintenance-triage` intake workflow, request schema, and deterministic maintenance request validation.
- d303460: Emit a bounded `release-report` artifact from the local `release-readiness` workflow through the new `release-analyst` reasoning step.
- 6d0a3b6: Add the bounded `release-readiness` request schema, workflow asset scaffolding, and deterministic CLI intake validation.
- 63d571d: Add deterministic release-state normalization and approval-classified publish or promotion mediation for the local `release-readiness` workflow.
- Updated dependencies [967d03b]
- Updated dependencies [caf3644]
- Updated dependencies [9f6df53]
- Updated dependencies [7a599ac]
- Updated dependencies [565142e]
- Updated dependencies [46fcef9]
- Updated dependencies [0499804]
- Updated dependencies [6d3b36a]
- Updated dependencies [e7a3286]
- Updated dependencies [6d0a3b6]
- Updated dependencies [63d571d]
  - @h9-foundry/agentforge-schemas@0.7.1
  - @h9-foundry/agentforge-shared-types@0.7.1
  - @h9-foundry/agentforge-audit@0.7.1
  - @h9-foundry/agentforge-policy-engine@0.7.1
  - @h9-foundry/agentforge-context-engine@0.7.1
  - @h9-foundry/agentforge-runtime@0.7.1
  - @h9-foundry/agentforge-sdk@0.7.1

## 0.7.0

### Minor Changes

- b0f9b53: Normalize bounded QA evidence deterministically and wire `qa-review` to consume allowlisted validation evidence before QA reasoning.
- df17a9c: Add the bounded `qa-analyst` starter agent and emit `qa-report` lifecycle artifacts for `qa-review`.
- 65b7ee1: Add the bounded `security-review` request contract and official workflow asset.

### Patch Changes

- ce0f10f: Fix `explain last-run` so it deterministically selects the newest completed run bundle instead of relying on unstable run-directory name ordering.
- 9c1d8d0: Add deterministic security evidence normalization and stricter security-report redaction handling for `security-review`.
- bdae136: Add the bounded `security-analyst` workflow stage and first `security-report` lifecycle artifact for `security-review`.
- Updated dependencies [b0f9b53]
- Updated dependencies [df17a9c]
- Updated dependencies [9c1d8d0]
- Updated dependencies [bdae136]
- Updated dependencies [65b7ee1]
  - @h9-foundry/agentforge-schemas@0.7.0
  - @h9-foundry/agentforge-shared-types@0.7.0
  - @h9-foundry/agentforge-policy-engine@0.7.0
  - @h9-foundry/agentforge-context-engine@0.7.0
  - @h9-foundry/agentforge-runtime@0.7.0
  - @h9-foundry/agentforge-audit@0.7.0
  - @h9-foundry/agentforge-sdk@0.7.0

## 0.6.0

### Minor Changes

- 01934f6: Add deterministic implementation inventory metadata and allowlisted validation command normalization for the implementation-proposal workflow.
- b32f49a: Add implementation-proposal artifact emission and the bounded implementation planner workflow node.
- ed5d181: Add the implementation request schema and local workflow intake path for `implementation-proposal`.
- 5ec8683: Add the bounded QA request contract and the initial official `qa-review` workflow asset with deterministic intake validation.

### Patch Changes

- Updated dependencies [01934f6]
- Updated dependencies [b32f49a]
- Updated dependencies [ed5d181]
- Updated dependencies [5ec8683]
  - @h9-foundry/agentforge-schemas@0.6.0
  - @h9-foundry/agentforge-shared-types@0.6.0
  - @h9-foundry/agentforge-context-engine@0.6.0
  - @h9-foundry/agentforge-policy-engine@0.6.0
  - @h9-foundry/agentforge-runtime@0.6.0
  - @h9-foundry/agentforge-audit@0.6.0
  - @h9-foundry/agentforge-sdk@0.6.0

## 0.5.0

### Minor Changes

- b8a25bb: Ship official `planning-discovery` and `architecture-design-review` workflow wedges with validated request inputs, lifecycle artifact emission, and CLI-first evaluator docs.

### Patch Changes

- Updated dependencies [b8a25bb]
  - @h9-foundry/agentforge-schemas@0.5.0
  - @h9-foundry/agentforge-shared-types@0.5.0
  - @h9-foundry/agentforge-audit@0.5.0
  - @h9-foundry/agentforge-runtime@0.5.0
  - @h9-foundry/agentforge-context-engine@0.5.0
  - @h9-foundry/agentforge-policy-engine@0.5.0
  - @h9-foundry/agentforge-sdk@0.5.0

## 0.4.2

### Patch Changes

- 509464f: Improve the plain-text `run pr-review` success output with clearer artifact and next-step guidance.
- 073c07a: Clarify top-level CLI help and the supported Phase 1 wedge values for `run` and `explain`.
  - @h9-foundry/agentforge-schemas@0.4.2
  - @h9-foundry/agentforge-shared-types@0.4.2
  - @h9-foundry/agentforge-sdk@0.4.2
  - @h9-foundry/agentforge-context-engine@0.4.2
  - @h9-foundry/agentforge-policy-engine@0.4.2
  - @h9-foundry/agentforge-runtime@0.4.2
  - @h9-foundry/agentforge-audit@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [6bd74e6]
- Updated dependencies [86edea7]
- Updated dependencies [0c1af6b]
- Updated dependencies [b78fb05]
- Updated dependencies [2772d1d]
- Updated dependencies [65eb7e0]
  - @h9-foundry/agentforge-schemas@0.4.1
  - @h9-foundry/agentforge-shared-types@0.4.1
  - @h9-foundry/agentforge-policy-engine@0.4.1
  - @h9-foundry/agentforge-runtime@0.4.1
  - @h9-foundry/agentforge-context-engine@0.4.1
  - @h9-foundry/agentforge-audit@0.4.1
  - @h9-foundry/agentforge-sdk@0.4.1

## 0.4.0

### Minor Changes

- 608b8cb: Update the published dependency surface for Commander 14 and Zod 4, and add repository CODEOWNERS for stricter branch protection.

### Patch Changes

- Updated dependencies [608b8cb]
  - @h9-foundry/agentforge-schemas@0.4.0
  - @h9-foundry/agentforge-shared-types@0.4.0
  - @h9-foundry/agentforge-sdk@0.4.0
  - @h9-foundry/agentforge-context-engine@0.4.0
  - @h9-foundry/agentforge-policy-engine@0.4.0
  - @h9-foundry/agentforge-runtime@0.4.0
  - @h9-foundry/agentforge-audit@0.4.0

## 0.3.2

### Patch Changes

- 1c6c323: Refresh package metadata and documentation for the public open-source release cutover.
- Updated dependencies [1c6c323]
  - @h9-foundry/agentforge-schemas@0.3.2
  - @h9-foundry/agentforge-shared-types@0.3.2
  - @h9-foundry/agentforge-sdk@0.3.2
  - @h9-foundry/agentforge-context-engine@0.3.2
  - @h9-foundry/agentforge-policy-engine@0.3.2
  - @h9-foundry/agentforge-runtime@0.3.2
  - @h9-foundry/agentforge-audit@0.3.2

## 0.3.1

### Patch Changes

- f53dbd9: Trigger a real GitHub-owned publish to verify npm trusted publishing after the
  initial bootstrap release.
- Updated dependencies [f53dbd9]
  - @h9-foundry/agentforge-schemas@0.3.1
  - @h9-foundry/agentforge-shared-types@0.3.1
  - @h9-foundry/agentforge-sdk@0.3.1
  - @h9-foundry/agentforge-context-engine@0.3.1
  - @h9-foundry/agentforge-policy-engine@0.3.1
  - @h9-foundry/agentforge-runtime@0.3.1
  - @h9-foundry/agentforge-audit@0.3.1

## 0.3.0

### Minor Changes

- 97f5848: Rename the public package family from `@agentops/*` to `@h9-foundry/agentforge-*`, rename the CLI command to `agentforge`, and update release/reporting workflows to the AgentForge brand while keeping the current GitHub repository slug unchanged.

### Patch Changes

- Updated dependencies [97f5848]
  - @h9-foundry/agentforge-schemas@0.3.0
  - @h9-foundry/agentforge-shared-types@0.3.0
  - @h9-foundry/agentforge-sdk@0.3.0
  - @h9-foundry/agentforge-context-engine@0.3.0
  - @h9-foundry/agentforge-policy-engine@0.3.0
  - @h9-foundry/agentforge-runtime@0.3.0
  - @h9-foundry/agentforge-audit@0.3.0

## 0.2.0

### Minor Changes

- 9a94beb: Harden the public release surface for Phase 2 by separating workspace and package builds, adding trusted publishing automation, and enforcing local plugin trust policy in the CLI and runtime audit path.

### Patch Changes

- Updated dependencies [9a94beb]
  - @h9-foundry/agentforge-audit@0.2.0
  - @h9-foundry/agentforge-context-engine@0.2.0
  - @h9-foundry/agentforge-policy-engine@0.2.0
  - @h9-foundry/agentforge-runtime@0.2.0
  - @h9-foundry/agentforge-schemas@0.2.0
  - @h9-foundry/agentforge-sdk@0.2.0
  - @h9-foundry/agentforge-shared-types@0.2.0
