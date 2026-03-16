import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import type { ToolAdapter } from "@agentops/sdk";

const execFileAsync = promisify(execFile);

const readFileInputSchema = z.object({
  path: z.string().min(1)
});

const readFileOutputSchema = z.object({
  path: z.string().min(1),
  contents: z.string()
});

const listFilesInputSchema = z.object({
  path: z.string().min(1).default(".")
});

const listFilesOutputSchema = z.object({
  path: z.string().min(1),
  entries: z.array(z.string())
});

const writeFileInputSchema = z.object({
  path: z.string().min(1),
  contents: z.string()
});

const writeFileOutputSchema = z.object({
  path: z.string().min(1),
  bytesWritten: z.number().min(0)
});

const emptyInputSchema = z.object({});
const statusOutputSchema = z.object({
  lines: z.array(z.string())
});
const diffSummaryOutputSchema = z.object({
  summary: z.string()
});

const runTemplateInputSchema = z.object({
  templateId: z.string().min(1)
});

const runTemplateOutputSchema = z.object({
  templateId: z.string().min(1),
  stdout: z.string(),
  stderr: z.string()
});

const createCheckInputSchema = z.object({
  repository: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1)
});

const createCheckOutputSchema = z.object({
  accepted: z.boolean(),
  message: z.string()
});

const allowedTemplates: Record<string, { command: string; args: string[] }> = {
  "git-status": { command: "git", args: ["status", "--short"] },
  "git-diff-stat": { command: "git", args: ["diff", "--stat", "HEAD"] }
};

function resolveRepositoryPath(root: string, requestedPath: string): string {
  const absolutePath = resolve(root, requestedPath);
  const relativePath = relative(root, absolutePath);
  if (relativePath.startsWith("..") || relativePath === "..") {
    throw new Error(`Path escapes repository root: ${requestedPath}`);
  }
  return absolutePath;
}

export function createBuiltinAdapters(): ToolAdapter[] {
  return [
    {
      manifest: {
        name: "filesystem.read-file",
        description: "Read a UTF-8 text file from the repository.",
        inputSchema: readFileInputSchema,
        outputSchema: readFileOutputSchema,
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
        const parsed = readFileInputSchema.parse(input);
        const decision = context.policy.canReadPath(parsed.path);
        if (!decision.allowed) {
          throw new Error(decision.reason ?? `Read denied for ${parsed.path}`);
        }
        const absolutePath = resolveRepositoryPath(context.workingDirectory, parsed.path);
        const contents = await readFile(absolutePath, "utf8");
        return readFileOutputSchema.parse({ path: parsed.path, contents });
      }
    },
    {
      manifest: {
        name: "filesystem.list-files",
        description: "List files in a repository directory.",
        inputSchema: listFilesInputSchema,
        outputSchema: listFilesOutputSchema,
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
        const parsed = listFilesInputSchema.parse(input);
        const decision = context.policy.canReadPath(parsed.path);
        if (!decision.allowed) {
          throw new Error(decision.reason ?? `Directory listing denied for ${parsed.path}`);
        }
        const absolutePath = resolveRepositoryPath(context.workingDirectory, parsed.path);
        const entries = await readdir(absolutePath);
        return listFilesOutputSchema.parse({ path: parsed.path, entries });
      }
    },
    {
      manifest: {
        name: "filesystem.write-file",
        description: "Write a UTF-8 text file inside the repository.",
        inputSchema: writeFileInputSchema,
        outputSchema: writeFileOutputSchema,
        sideEffectClass: "apply-low-risk",
        permission: "write",
        defaultTimeoutMs: 2_000,
        trust: {
          tier: "core",
          source: "official",
          reviewed: true
        }
      },
      async execute(input, context) {
        const parsed = writeFileInputSchema.parse(input);
        const decision = context.policy.canWritePath(parsed.path);
        if (!decision.allowed || decision.requiresApproval) {
          throw new Error(decision.reason ?? `Write denied for ${parsed.path}`);
        }
        const absolutePath = resolveRepositoryPath(context.workingDirectory, parsed.path);
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, parsed.contents, "utf8");
        return writeFileOutputSchema.parse({ path: parsed.path, bytesWritten: Buffer.byteLength(parsed.contents) });
      }
    },
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
    },
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
    },
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
