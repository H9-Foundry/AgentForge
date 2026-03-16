import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { z } from "zod/v3";

import type { ToolAdapter } from "@h9-foundry/agentforge-sdk";

const execFileAsync = promisify(execFile);

const runTemplateInputSchema = z.object({
  templateId: z.string().min(1)
});

const runTemplateOutputSchema = z.object({
  templateId: z.string().min(1),
  stdout: z.string(),
  stderr: z.string()
});

const allowedTemplates: Record<string, { command: string; args: string[] }> = {
  "git-status": { command: "git", args: ["status", "--short"] },
  "git-diff-stat": { command: "git", args: ["diff", "--stat", "HEAD"] }
};

export function createShellAdapters(): ToolAdapter[] {
  return [
    {
      manifest: {
        name: "shell.run-template",
        description: "Run a pre-approved shell command template.",
        inputSchema: runTemplateInputSchema,
        outputSchema: runTemplateOutputSchema,
        sideEffectClass: "observe",
        permission: "read",
        defaultTimeoutMs: 2_000,
        trust: {
          tier: "core",
          source: "official",
          reviewed: true
        }
      },
      async execute(input, context) {
        const parsed = runTemplateInputSchema.parse(input);
        const template = allowedTemplates[parsed.templateId];
        if (!template) {
          throw new Error(`Unknown shell template: ${parsed.templateId}`);
        }
        const { stdout, stderr } = await execFileAsync(template.command, template.args, { cwd: context.workingDirectory });
        return runTemplateOutputSchema.parse({
          templateId: parsed.templateId,
          stdout,
          stderr
        });
      }
    }
  ];
}
