import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = process.cwd();
const packageManifestPath = join(packageRoot, "package.json");
const backupPath = join(packageRoot, ".agentforge-package-manifest.backup.json");

if (!existsSync(backupPath)) {
  process.exit(0);
}

writeFileSync(packageManifestPath, readFileSync(backupPath, "utf8"), "utf8");
rmSync(backupPath, { force: true });
