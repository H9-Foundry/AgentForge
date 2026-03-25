---
"@h9-foundry/agentforge-cli": patch
"@h9-foundry/agentforge-schemas": patch
"@h9-foundry/agentforge-shared-types": patch
"@h9-foundry/agentforge-sdk": patch
"@h9-foundry/agentforge-context-engine": patch
"@h9-foundry/agentforge-policy-engine": patch
"@h9-foundry/agentforge-runtime": patch
"@h9-foundry/agentforge-audit": patch
---

Add the repo-fit onboarding contract for existing repositories.

This release adds `.agentops/repo-fit.yaml` as the canonical repository-fit contract, extends `agentforge onboard` to infer and write that contract, surfaces repo-fit editing in `/configure?target=repo-fit`, persists repo-fit provenance into run configuration snapshots, and expands advisory repo-fit findings across QA, security, release, pipeline, deployment, promotion, incident, and maintenance workflows.
