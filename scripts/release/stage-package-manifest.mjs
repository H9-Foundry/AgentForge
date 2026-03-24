import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { sanitizeManifest } from "./package-manifest-utils.mjs";

const packageRoot = process.cwd();
const packageManifestPath = join(packageRoot, "package.json");
const backupPath = join(packageRoot, ".agentforge-package-manifest.backup.json");

if (!existsSync(packageManifestPath)) {
  throw new Error(`Expected package.json at ${packageManifestPath}.`);
}

if (!existsSync(backupPath)) {
  writeFileSync(backupPath, readFileSync(packageManifestPath, "utf8"), "utf8");
}

const packageManifest = JSON.parse(readFileSync(packageManifestPath, "utf8"));
const sanitizedManifest = sanitizeManifest(packageManifest);
writeFileSync(packageManifestPath, JSON.stringify(sanitizedManifest, null, 2) + "\n", "utf8");
