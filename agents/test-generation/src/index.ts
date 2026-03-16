import { agentManifestSchema, agentOutputSchema } from "@agentops/schemas";
import type { RuntimeAgent } from "@agentops/sdk";

export const manifest = agentManifestSchema.parse({
  version: 1,
  name: "test-generation",
  displayName: "Test Generation",
  category: "quality",
  runtime: {
    minVersion: "0.1.0",
    kind: "reasoning"
  },
  permissions: {
    model: true,
    network: false,
    tools: [],
    readPaths: ["src/**", "packages/**", "tests/**"],
    writePaths: ["tests/**"]
  },
  inputs: ["changes"],
  outputs: ["proposedActions"],
  contextPolicy: {
    sections: ["changes"],
    minimalContext: true
  },
  trust: {
    tier: "core",
    source: "official",
    reviewed: true
  }
});

export const testGenerationAgent: RuntimeAgent = {
  manifest,
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const changedFiles = stateSlice.changes?.changedFiles ?? [];
    const srcTargets = changedFiles.filter((file) => /(^src\/|^packages\/.+\/src\/).+\.ts$/.test(file));
    const hasTests = changedFiles.some((file) => file.includes(".test.") || file.includes(".spec."));
    const proposedActions =
      srcTargets.length > 0 && !hasTests
        ? [
            {
              id: "tests-add-coverage",
              title: "Add focused tests for changed source files",
              summary: `Changed source files (${srcTargets.join(", ")}) do not have matching updated tests in this run.`,
              sideEffectClass: "suggest" as const,
              targetPaths: ["tests/**"],
              approvalRequired: false
            }
          ]
        : [];

    return agentOutputSchema.parse({
      summary:
        proposedActions.length > 0
          ? "Test generation identified missing test coverage opportunities."
          : "Test generation found no obvious test coverage gaps from the current diff metadata.",
      findings: [],
      proposedActions,
      requestedTools: [],
      blockedActionFlags: [],
      confidence: proposedActions.length > 0 ? 0.73 : 0.57,
      metadata: {
        changedFiles
      }
    });
  }
};
