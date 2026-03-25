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

Graduate the visualizer `/configure` flow to a supported CLI surface.

This release makes structured config editing available by default while keeping repo YAML canonical and preserving the guarded preview and save path. It also ships the control-plane configuration snapshot improvements, run and compare provenance links back into `/configure`, and the aligned evaluator-first docs for the stable configuration-management journey.
