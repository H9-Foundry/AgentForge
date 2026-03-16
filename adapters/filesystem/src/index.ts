import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { z } from "zod";

import type { ToolAdapter } from "@agentops/sdk";

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

function resolveRepositoryPath(root: string, requestedPath: string): string {
  const absolutePath = resolve(root, requestedPath);
  const relativePath = relative(root, absolutePath);
  if (relativePath.startsWith("..") || relativePath === "..") {
    throw new Error(`Path escapes repository root: ${requestedPath}`);
  }
  return absolutePath;
}

export function createFilesystemAdapters(): ToolAdapter[] {
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
    }
  ];
}
