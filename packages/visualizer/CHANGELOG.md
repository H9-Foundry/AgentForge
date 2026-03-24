# @h9-foundry/agentforge-visualizer

## 0.12.0

### Minor Changes

- 3b5f04e: Release the packaged local visualizer and CLI-first benchmark workflow surface.

  This cut adds the new public `@h9-foundry/agentforge-visualizer` package and exposes the visualizer through the CLI with `agentforge visualizer`, `agentforge ui`, and `agentforge visualizer export`.

  It also adds CLI-first benchmark authoring support with `agentforge eval benchmark-wizard`, stabilizes the visualizer-facing run and benchmark-ledger contract, and carries measured token plus estimated cost metadata from provider-backed runs into outcomes and release-benchmark review flows.

### Patch Changes

- Updated dependencies [3b5f04e]
  - @h9-foundry/agentforge-schemas@0.12.0
  - @h9-foundry/agentforge-shared-types@0.12.0
