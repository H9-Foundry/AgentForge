---
"@h9-foundry/agentforge-cli": patch
---

Improve onboarding repo-fit source root inference for application repos by including top-level `admin/` surfaces.

This prevents repeated advisory findings where planning and design workflows report `admin/` as out-of-contract immediately after onboarding in multi-surface app repositories.
