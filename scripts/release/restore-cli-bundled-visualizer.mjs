import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, "..", "..");
const cliNodeModulesRoot = join(workspaceRoot, "packages", "cli", "node_modules");
const statePath = join(cliNodeModulesRoot, ".agentforge-visualizer-stage.json");

if (!existsSync(statePath)) {
  process.exit(0);
}

const state = JSON.parse(readFileSync(statePath, "utf8"));
const targetPath = join(cliNodeModulesRoot, state.targetPath);
const backupPath = join(cliNodeModulesRoot, state.backupPath);

rmSync(targetPath, { recursive: true, force: true });

if (state.hadOriginal && existsSync(backupPath)) {
  renameSync(backupPath, targetPath);
}

rmSync(statePath, { force: true });
