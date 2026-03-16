# Security Model

## Core Rules

- Repository content, PR text, issue comments, logs, and external data are untrusted input.
- Policy is authoritative over agent manifests and runtime requests.
- Execution is read-only by default.
- Writes and network effects must remain explicitly approval-gated or denied.
- Blocked paths are filtered before context assembly and before tool execution.

## Enforcement Layers

1. `packages/policy-engine`
   - resolves repo-local policy and overlays
   - evaluates path and tool access
   - redacts common secret patterns from outputs and artifacts
2. `packages/runtime`
   - blocks denied and approval-gated tools before execution
   - sanitizes tool outputs, agent outputs, tool errors, and blocked reasons
   - records trust and provenance metadata in the audit bundle
3. `adapters/*`
   - expose explicit schemas and side-effect classes
   - enforce path checks for filesystem operations
   - avoid unrestricted shell, filesystem write, or network access

## Trust Tiers

AgentForge now carries trust metadata for runtime components:

- `core`: first-party components maintained in this repository
- `verified`: approved external or privileged integrations with explicit review
- `community`: third-party extensions that may be useful but are not first-party maintained
- `untrusted`: components that should be isolated or denied by policy until reviewed

Phase 1 only ships `core` components plus a minimal `verified` GitHub stub. Plugin installation and trust enforcement remain Phase 2 follow-up work.

## Blocked Paths

The default Phase 1 policy blocks common sensitive paths such as:

- `.env*`
- `secrets/**`
- `infra/prod/**`
- `**/*.pem`
- `**/*.key`
- `**/id_rsa*`

These defaults are intentionally conservative and should be tightened per repository when higher-risk assets exist.

## Redaction Coverage

The current redaction layer targets common high-risk strings in outputs and artifacts:

- GitHub tokens
- OpenAI-style API keys
- AWS access keys
- bearer tokens
- password and token assignments
- PEM private key blocks

This is best-effort redaction, not a guarantee that every secret format is detected. Repositories with custom credentials should extend policy and testing accordingly.

## Known Limits

- Provider execution is still optional and disabled by default in the initial slice.
- Trust-tier metadata exists, but plugin trust policy and installation flow are not complete yet.
- Release provenance currently covers build artifacts, not package publication, because package publishing boundaries are still being hardened.
