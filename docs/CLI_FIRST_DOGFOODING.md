# CLI-First Dogfooding

This document defines the internal dogfooding rule for user-facing AgentForge surfaces.

AgentForge should be dogfooded **CLI-first**, not CLI-only.

## Policy

For user-facing workflow, benchmark, and visualizer slices:

- benchmarking should use the CLI path by default
- acceptance checks should use the CLI path by default
- documentation examples should use the CLI path by default
- release signoff should use the CLI path by default

Source-build paths are still allowed for:

- maintainer debugging
- package-development work
- pre-release validation before npm publish lands

## External-Readiness Rule

A user-facing capability is only externally ready when:

- it works through the CLI path a technical user would use
- docs match the shipped CLI behavior
- release verification passes with packed public packages

If a capability works only through direct package entrypoints or maintainer-only source-build commands, it is not externally ready.

For external package-user validation, the proof path is a clean external repo plus the published CLI. Local source behavior can help debug, but it does not close a package-user gap unless the exact repro also works through the published package path.

## Visualizer Rule

For the visualizer specifically:

- `agentforge visualizer`
- `agentforge visualizer export`
- `agentforge eval benchmark-record --prefill-run`
- `agentforge eval benchmark-wizard`

are the default dogfooding surfaces.

Maintainer-only shortcuts such as `pnpm visualizer:dev` remain valid for local debugging but do not replace CLI-path acceptance.

## External Feedback Rule

For long-lived external package-user pilots:

- Discussion-first feedback is preferred
- promote only reproducible reusable defects into Issues
- include exact version, exact command, and exact bundle path in every promoted issue
- do not mark a package-user issue fixed until the exact repro succeeds on the published CLI in a clean external repo
