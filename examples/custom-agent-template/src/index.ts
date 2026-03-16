import { agentManifestSchema, agentOutputSchema } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";

export const manifest = agentManifestSchema.parse({
  version: 1,
  name: "todo-audit",
  displayName: "TODO Audit",
  category: "quality",
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
  inputs: ["changes"],
  outputs: ["findings"],
  contextPolicy: {
    sections: ["changes"],
    minimalContext: true
  },
  trust: {
    tier: "community",
    source: "local",
    reviewed: false
  }
});

export const todoAuditAgent: RuntimeAgent = {
  manifest,
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const todoTargets = (stateSlice.changes?.changedFiles ?? []).filter((path) => path.endsWith(".ts") || path.endsWith(".md"));

    return agentOutputSchema.parse({
      summary: todoTargets.length > 0 ? `TODO audit reviewed ${todoTargets.length} candidate file(s).` : "TODO audit found no candidate files.",
      findings: [],
      proposedActions: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        candidateFiles: todoTargets
      }
    });
  }
};
