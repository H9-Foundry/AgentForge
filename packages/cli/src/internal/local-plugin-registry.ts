import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { agentManifestSchema } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";

interface WorkspacePackageRecord {
  readonly name: string;
  readonly root: string;
  readonly manifest: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function findWorkspacePackages(repoRoot: string): WorkspacePackageRecord[] {
  const workspaces = ["packages", "agents", "adapters"];
  const found: WorkspacePackageRecord[] = [];

  for (const workspace of workspaces) {
    const workspaceRoot = join(repoRoot, workspace);
    if (!existsSync(workspaceRoot)) {
      continue;
    }

    for (const entry of readdirSync(workspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageRoot = join(workspaceRoot, entry.name);
      const manifestPath = join(packageRoot, "package.json");
      if (!existsSync(manifestPath)) {
        continue;
      }

      const manifest = readJson(manifestPath);
      if (typeof manifest.name !== "string" || manifest.name.length === 0) {
        continue;
      }

      found.push({
        name: manifest.name,
        root: packageRoot,
        manifest
      });
    }
  }

  return found;
}

function resolveModuleEntrypoint(workspacePackage: WorkspacePackageRecord): string {
  const exportsRecord =
    isRecord(workspacePackage.manifest.exports) && isRecord(workspacePackage.manifest.exports["."])
      ? (workspacePackage.manifest.exports["."] as Record<string, unknown>)
      : undefined;
  const candidateEntries = [
    typeof exportsRecord?.default === "string" ? exportsRecord.default : undefined,
    typeof workspacePackage.manifest.module === "string" ? workspacePackage.manifest.module : undefined,
    typeof workspacePackage.manifest.main === "string" ? workspacePackage.manifest.main : undefined,
    "dist/index.js",
    "src/index.ts"
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidateEntries) {
    const resolvedPath = resolve(workspacePackage.root, candidate);
    if (existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  throw new Error(`No loadable entrypoint found for ${workspacePackage.name}`);
}

function isRuntimeAgent(value: unknown): value is RuntimeAgent {
  if (!isRecord(value)) {
    return false;
  }

  return isRecord(value.manifest) && typeof value.execute === "function" && "outputSchema" in value;
}

function pickRuntimeAgent(moduleValue: unknown): RuntimeAgent | undefined {
  if (isRuntimeAgent(moduleValue)) {
    return moduleValue;
  }

  if (!isRecord(moduleValue)) {
    return undefined;
  }

  if (isRuntimeAgent(moduleValue.default)) {
    return moduleValue.default;
  }

  if (isRuntimeAgent(moduleValue.agent)) {
    return moduleValue.agent;
  }

  return Object.values(moduleValue).find((candidate): candidate is RuntimeAgent => isRuntimeAgent(candidate));
}

export class LocalPluginRegistry {
  constructor(private readonly repoRoot: string) {}

  async loadLocalAgentPlugin(packageName: string): Promise<RuntimeAgent> {
    const workspacePackage = findWorkspacePackages(this.repoRoot).find((candidate) => candidate.name === packageName);

    if (!workspacePackage) {
      throw new Error(`Plugin package is not a local workspace package: ${packageName}`);
    }

    const entrypoint = resolveModuleEntrypoint(workspacePackage);
    const imported = await import(pathToFileURL(entrypoint).href);
    const agent = pickRuntimeAgent(imported);

    if (!agent) {
      throw new Error(`Plugin package does not export a RuntimeAgent: ${packageName}`);
    }

    return {
      ...agent,
      manifest: agentManifestSchema.parse(agent.manifest)
    };
  }
}
