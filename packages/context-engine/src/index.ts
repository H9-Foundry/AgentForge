import { existsSync, readdirSync } from "node:fs";
import { basename } from "node:path";
import { execFileSync } from "node:child_process";

import { workflowStateEnvelopeSchema } from "@h9-foundry/agentforge-schemas";
import type { EffectivePolicySnapshot, WorkflowStateEnvelope } from "@h9-foundry/agentforge-shared-types";

export interface CreateWorkflowStateOptions {
  readonly cwd?: string;
  readonly workflow: string;
  readonly mode: "inspect" | "suggest" | "apply";
  readonly policy: EffectivePolicySnapshot;
  readonly trigger?: "manual" | "pull_request" | "ci";
}

interface GitStatusEntry {
  path: string;
  status: string;
}

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

export function findWorkspaceRoot(startDir = process.cwd()): string {
  const gitRoot = runGit(startDir, ["rev-parse", "--show-toplevel"]).trim();

  return gitRoot || startDir;
}

export function detectPackageManager(root: string): string {
  if (existsSync(`${root}/pnpm-lock.yaml`)) return "pnpm";
  if (existsSync(`${root}/package-lock.json`)) return "npm";
  if (existsSync(`${root}/yarn.lock`)) return "yarn";
  return "unknown";
}

export function detectLanguages(root: string): string[] {
  const files = readdirSync(root);
  const detected = new Set<string>();

  if (files.some((file) => file.endsWith(".ts") || file === "tsconfig.json")) detected.add("typescript");
  if (files.includes("package.json")) detected.add("javascript");
  if (files.includes("pyproject.toml") || files.includes("requirements.txt")) detected.add("python");
  if (files.includes("Cargo.toml")) detected.add("rust");

  return [...detected];
}

function parseGitStatusLine(line: string): GitStatusEntry | undefined {
  if (!line.trim()) return undefined;
  const match = line.match(/^(.{2})\s+(.*)$/);
  if (!match) return undefined;
  const status = match[1].trim() || "??";
  const path = match[2].trim();
  return { path, status };
}

function collectGitStatus(root: string): GitStatusEntry[] {
  return runGit(root, ["status", "--porcelain"])
    .split("\n")
    .map((line) => parseGitStatusLine(line))
    .filter((entry): entry is GitStatusEntry => Boolean(entry));
}

function collectDiffStats(root: string): { filesChanged: number; insertions: number; deletions: number; perFile: Map<string, { insertions: number; deletions: number }> } {
  const output = runGit(root, ["diff", "--numstat", "HEAD"]).trim();
  const perFile = new Map<string, { insertions: number; deletions: number }>();
  let filesChanged = 0;
  let insertions = 0;
  let deletions = 0;

  if (!output) {
    return { filesChanged, insertions, deletions, perFile };
  }

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const [insertedRaw, deletedRaw, filePath] = line.split("\t");
    const added = Number.parseInt(insertedRaw, 10) || 0;
    const removed = Number.parseInt(deletedRaw, 10) || 0;
    filesChanged += 1;
    insertions += added;
    deletions += removed;
    perFile.set(filePath, { insertions: added, deletions: removed });
  }

  return { filesChanged, insertions, deletions, perFile };
}

function listTopLevelFiles(root: string): string[] {
  return readdirSync(root)
    .filter((entry) => !entry.startsWith(".git"))
    .slice(0, 20);
}

export function createWorkflowState(options: CreateWorkflowStateOptions): WorkflowStateEnvelope {
  const root = findWorkspaceRoot(options.cwd);
  const gitStatus = collectGitStatus(root);
  const diffStats = collectDiffStats(root);
  const changedFiles = gitStatus.map((entry) => entry.path);
  const branch = runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim() || "main";
  const state = workflowStateEnvelopeSchema.parse({
    version: "1.0.0",
    runId: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    workflow: options.workflow,
    mode: options.mode,
    repo: {
      root,
      name: basename(root),
      branch,
      packageManager: detectPackageManager(root),
      languages: detectLanguages(root),
      ci: Boolean(process.env.CI),
      provider: process.env.GITHUB_ACTIONS ? "github-actions" : undefined,
      detectedFiles: listTopLevelFiles(root)
    },
    changes: {
      changedFiles,
      stagedFiles: gitStatus.filter((entry) => entry.status.startsWith("A") || entry.status.startsWith("M")).map((entry) => entry.path),
      untrackedFiles: gitStatus.filter((entry) => entry.status === "??").map((entry) => entry.path),
      impactedPaths: [...new Set(changedFiles.map((filePath) => filePath.split("/")[0] ?? filePath))],
      diffStats: {
        filesChanged: diffStats.filesChanged || changedFiles.length,
        insertions: diffStats.insertions,
        deletions: diffStats.deletions
      },
      fileDetails: changedFiles.map((filePath) => ({
        path: filePath,
        status: gitStatus.find((entry) => entry.path === filePath)?.status ?? "M",
        insertions: diffStats.perFile.get(filePath)?.insertions ?? 0,
        deletions: diffStats.perFile.get(filePath)?.deletions ?? 0
      }))
    },
    context: {
      localExecution: !process.env.CI,
      ciExecution: Boolean(process.env.CI),
      trigger: options.trigger ?? "manual",
      timestamp: new Date().toISOString()
    },
    policy: options.policy
  });

  return state;
}
