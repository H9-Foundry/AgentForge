"@h9-foundry/agentforge-cli": patch

Bundle the visualizer into the published CLI instead of treating it as a separately installed npm package.

This keeps `agentforge visualizer`, `agentforge ui`, `agentforge visualizer export`, and the benchmark-authoring helpers available through the published CLI while avoiding the standalone first-publish blocker for `@h9-foundry/agentforge-visualizer`.
