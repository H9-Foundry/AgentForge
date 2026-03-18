---
"@h9-foundry/agentforge-cli": patch
---

Fix `explain last-run` so it deterministically selects the newest completed run bundle instead of relying on unstable run-directory name ordering.
