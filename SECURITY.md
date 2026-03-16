# Security Policy

## Supported Versions

Pre-1.0 AgentForge development is supported on the latest default branch and the latest tagged `0.x` release, when tags exist.

## Reporting A Vulnerability

Please do not open a public GitHub issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting flow for this repository when it is available. If private reporting is not available, contact the maintainers through a private GitHub channel before disclosing details publicly.

Include:
- affected version or commit
- impact summary
- reproduction steps or proof of concept
- any suggested mitigation

## Response Expectations

- Initial acknowledgement target: within 5 business days
- Triage outcome target: within 10 business days
- Public disclosure only after a fix or mitigation is available, or after explicit maintainer agreement

## Scope

The current Phase 1 focus is:
- policy enforcement and blocked-path protections
- approval-gated side effects
- artifact and log redaction for common secret patterns
- release provenance for build artifacts

Hardening follow-ups that are not yet complete should be tracked in GitHub issues and linked from the active phase tracker.
