import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, "..", "..");
const cliNodeModulesRoot = join(workspaceRoot, "packages", "cli", "node_modules");
const statePath = join(cliNodeModulesRoot, ".agentforge-first-party-stage.json");
const cliManifestPath = join(workspaceRoot, "packages", "cli", "package.json");

if (!existsSync(statePath)) {
  process.exit(0);
}

const state = JSON.parse(readFileSync(statePath, "utf8"));
const targetPath = join(cliNodeModulesRoot, state.targetPath);
const backupPath = join(cliNodeModulesRoot, state.backupPath);
const lockPath = typeof state.lockPath === "string" ? join(cliNodeModulesRoot, state.lockPath) : undefined;

rmSync(targetPath, { recursive: true, force: true });

if (state.hadOriginal && existsSync(backupPath)) {
  renameSync(backupPath, targetPath);
}

const cliManifest = JSON.parse(readFileSync(cliManifestPath, "utf8"));
const firstPartyDependencies = Object.keys(cliManifest.dependencies ?? {}).filter((dependencyName) =>
  dependencyName.startsWith("@h9-foundry/agentforge-")
);
mkdirSync(targetPath, { recursive: true });

for (const dependencyName of firstPartyDependencies) {
  const folderName = dependencyName.split("/")[1]?.replace("agentforge-", "");
  if (!folderName) {
    continue;
  }

  const dependencyPath = join(targetPath, dependencyName.split("/")[1]);
  if (existsSync(dependencyPath)) {
    continue;
  }

  symlinkSync(join("..", "..", "..", folderName), dependencyPath, "dir");
}

rmSync(statePath, { force: true });
if (lockPath) {
  rmSync(lockPath, { recursive: true, force: true });
}
