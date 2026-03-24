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

## Visualizer Rule

For the visualizer specifically:

- `agentforge visualizer`
- `agentforge visualizer export`
- `agentforge eval benchmark-record --prefill-run`
- `agentforge eval benchmark-wizard`

are the default dogfooding surfaces.

Maintainer-only shortcuts such as `pnpm visualizer:dev` remain valid for local debugging but do not replace CLI-path acceptance.
