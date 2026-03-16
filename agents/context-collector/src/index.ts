import { agentManifestSchema, agentOutputSchema } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";

export const manifest = agentManifestSchema.parse({
  version: 1,
  name: "context-collector",
  displayName: "Context Collector",
  category: "context",
  runtime: {
    minVersion: "0.1.0",
    kind: "deterministic"
  },
  permissions: {
    model: false,
    network: false,
    tools: [],
    readPaths: ["**/*"],
    writePaths: []
  },
  inputs: ["repo", "changes", "context"],
  outputs: ["summary", "metadata"],
  contextPolicy: {
    sections: ["repo", "changes", "context"],
    minimalContext: true
  },
  trust: {
    tier: "core",
    source: "official",
    reviewed: true
  }
});

export const contextCollectorAgent: RuntimeAgent = {
  manifest,
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const repo = stateSlice.repo;
    const changes = stateSlice.changes;
    const summary = repo && changes
      ? `Collected context for ${repo.name}: ${changes.changedFiles.length} changed file(s), ${changes.impactedPaths.length} impacted path(s).`
      : "Collected base repository context.";

    return agentOutputSchema.parse({
      summary,
      findings: [],
      proposedActions: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        repository: repo?.name,
        changedFiles: changes?.changedFiles ?? [],
        impactedPaths: changes?.impactedPaths ?? []
      }
    });
  }
};
