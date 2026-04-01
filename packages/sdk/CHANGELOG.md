# @h9-foundry/agentforge-sdk

## 0.12.8

### Patch Changes

- dd90d43: Update onboarding and starter guidance to use the runnable published-package `npx` command path, so external package users can follow the default next steps without a global install.
- Updated dependencies [dd90d43]
  - @h9-foundry/agentforge-shared-types@0.12.8

## 0.12.7

### Patch Changes

- dcdd428: Fix onboarding so the published CLI suggests a runnable starter workflow in clean external repos, and add regression coverage for release-shaped package-user onboarding guidance.
- Updated dependencies [dcdd428]
  - @h9-foundry/agentforge-shared-types@0.12.7

## 0.12.6

### Patch Changes

- @h9-foundry/agentforge-shared-types@0.12.6

## 0.12.5

### Patch Changes

- @h9-foundry/agentforge-shared-types@0.12.5

## 0.12.4

### Patch Changes

- @h9-foundry/agentforge-shared-types@0.12.4

## 0.12.3

### Patch Changes

- 20f5d35: Add the repo-fit onboarding contract for existing repositories.

  This release adds `.agentops/repo-fit.yaml` as the canonical repository-fit contract, extends `agentforge onboard` to infer and write that contract, surfaces repo-fit editing in `/configure?target=repo-fit`, persists repo-fit provenance into run configuration snapshots, and expands advisory repo-fit findings across QA, security, release, pipeline, deployment, promotion, incident, and maintenance workflows.

- Updated dependencies [20f5d35]
  - @h9-foundry/agentforge-shared-types@0.12.3

## 0.12.2

### Patch Changes

- 1e4b5a3: Graduate the visualizer `/configure` flow to a supported CLI surface.

  This release makes structured config editing available by default while keeping repo YAML canonical and preserving the guarded preview and save path. It also ships the control-plane configuration snapshot improvements, run and compare provenance links back into `/configure`, and the aligned evaluator-first docs for the stable configuration-management journey.

- Updated dependencies [1e4b5a3]
  - @h9-foundry/agentforge-shared-types@0.12.2

## 0.12.1

### Patch Changes

- @h9-foundry/agentforge-shared-types@0.12.1

## 0.12.0

### Minor Changes

- 3b5f04e: Release the packaged local visualizer and CLI-first benchmark workflow surface.

  This cut adds the new public `@h9-foundry/agentforge-visualizer` package and exposes the visualizer through the CLI with `agentforge visualizer`, `agentforge ui`, and `agentforge visualizer export`.

  It also adds CLI-first benchmark authoring support with `agentforge eval benchmark-wizard`, stabilizes the visualizer-facing run and benchmark-ledger contract, and carries measured token plus estimated cost metadata from provider-backed runs into outcomes and release-benchmark review flows.

### Patch Changes

- Updated dependencies [3b5f04e]
  - @h9-foundry/agentforge-shared-types@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [3b284b8]
  - @h9-foundry/agentforge-shared-types@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [0dbf030]
- Updated dependencies [ffdab26]
- Updated dependencies [9261149]
- Updated dependencies [c3df71b]
- Updated dependencies [b5253bf]
- Updated dependencies [0367e8c]
- Updated dependencies [fa4d206]
- Updated dependencies [25fb68d]
  - @h9-foundry/agentforge-shared-types@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [203d736]
  - @h9-foundry/agentforge-shared-types@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [9ce38fa]
- Updated dependencies [005e3ba]
- Updated dependencies [ebf3f39]
  - @h9-foundry/agentforge-shared-types@0.8.0

## 0.7.1

### Patch Changes

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
  - @h9-foundry/agentforge-shared-types@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [b0f9b53]
- Updated dependencies [df17a9c]
- Updated dependencies [9c1d8d0]
- Updated dependencies [bdae136]
- Updated dependencies [65b7ee1]
  - @h9-foundry/agentforge-shared-types@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [01934f6]
- Updated dependencies [b32f49a]
- Updated dependencies [ed5d181]
- Updated dependencies [5ec8683]
  - @h9-foundry/agentforge-shared-types@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [b8a25bb]
  - @h9-foundry/agentforge-shared-types@0.5.0

## 0.4.2

### Patch Changes

- @h9-foundry/agentforge-shared-types@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [6bd74e6]
- Updated dependencies [0c1af6b]
- Updated dependencies [65eb7e0]
  - @h9-foundry/agentforge-shared-types@0.4.1

## 0.4.0

### Minor Changes

- 608b8cb: Update the published dependency surface for Commander 14 and Zod 4, and add repository CODEOWNERS for stricter branch protection.

### Patch Changes

- Updated dependencies [608b8cb]
  - @h9-foundry/agentforge-shared-types@0.4.0

## 0.3.2

### Patch Changes

- 1c6c323: Refresh package metadata and documentation for the public open-source release cutover.
- Updated dependencies [1c6c323]
  - @h9-foundry/agentforge-shared-types@0.3.2

## 0.3.1

### Patch Changes

- f53dbd9: Trigger a real GitHub-owned publish to verify npm trusted publishing after the
  initial bootstrap release.
- Updated dependencies [f53dbd9]
  - @h9-foundry/agentforge-shared-types@0.3.1

## 0.3.0

### Minor Changes

- 97f5848: Rename the public package family from `@agentops/*` to `@h9-foundry/agentforge-*`, rename the CLI command to `agentforge`, and update release/reporting workflows to the AgentForge brand while keeping the current GitHub repository slug unchanged.

### Patch Changes

- Updated dependencies [97f5848]
  - @h9-foundry/agentforge-shared-types@0.3.0

## 0.2.0

### Minor Changes

- 9a94beb: Harden the public release surface for Phase 2 by separating workspace and package builds, adding trusted publishing automation, and enforcing local plugin trust policy in the CLI and runtime audit path.

### Patch Changes

- Updated dependencies [9a94beb]
  - @h9-foundry/agentforge-shared-types@0.2.0
