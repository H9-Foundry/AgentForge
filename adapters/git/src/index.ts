import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { z } from "zod/v3";

import type { ToolAdapter } from "@h9-foundry/agentforge-sdk";

const execFileAsync = promisify(execFile);

const emptyInputSchema = z.object({});
const statusOutputSchema = z.object({
  lines: z.array(z.string())
});
const diffSummaryOutputSchema = z.object({
  summary: z.string()
});

export function createGitAdapters(): ToolAdapter[] {
  return [
    {
      manifest: {
        name: "git.status",
        description: "Return git porcelain status lines.",
        inputSchema: emptyInputSchema,
        outputSchema: statusOutputSchema,
        sideEffectClass: "observe",
        permission: "read",
        defaultTimeoutMs: 2_000,
        trust: {
          tier: "core",
          source: "official",
          reviewed: true
        }
      },
      async execute(_input, context) {
        const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd: context.workingDirectory });
        return statusOutputSchema.parse({ lines: stdout.split("\n").filter(Boolean) });
      }
    },
    {
      manifest: {
        name: "git.diff-summary",
        description: "Return a concise git diff stat summary.",
        inputSchema: emptyInputSchema,
        outputSchema: diffSummaryOutputSchema,
        sideEffectClass: "observe",
        permission: "read",
        defaultTimeoutMs: 2_000,
        trust: {
          tier: "core",
          source: "official",
          reviewed: true
        }
      },
      async execute(_input, context) {
        const { stdout } = await execFileAsync("git", ["diff", "--stat", "HEAD"], { cwd: context.workingDirectory });
        return diffSummaryOutputSchema.parse({ summary: stdout.trim() });
      }
    }
  ];
}
