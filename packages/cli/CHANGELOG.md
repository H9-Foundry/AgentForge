# @h9-foundry/agentforge-cli

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
