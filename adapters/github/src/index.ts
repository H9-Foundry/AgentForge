import { z } from "zod";

import type { ToolAdapter } from "@h9-foundry/agentforge-sdk";

const createCheckInputSchema = z.object({
  repository: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1)
});

const createCheckOutputSchema = z.object({
  accepted: z.boolean(),
  message: z.string()
});

export function createGitHubAdapters(): ToolAdapter[] {
  return [
    {
      manifest: {
        name: "github.create-check",
        description: "Placeholder for GitHub check creation.",
        inputSchema: createCheckInputSchema,
        outputSchema: createCheckOutputSchema,
        sideEffectClass: "apply-high-risk",
        permission: "network",
        defaultTimeoutMs: 2_000,
        trust: {
          tier: "verified",
          source: "official",
          reviewed: true
        }
      },
      async execute() {
        return createCheckOutputSchema.parse({
          accepted: false,
          message: "GitHub integration is deferred in the initial local-only vertical slice."
        });
      }
    }
  ];
}
