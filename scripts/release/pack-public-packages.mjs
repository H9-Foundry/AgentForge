import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packagesDir = join(root, "packages");

const packageDirs = readdirSync(packagesDir)
  .map((entry) => join(packagesDir, entry))
  .filter((entry) => {
    try {
      const manifest = JSON.parse(readFileSync(join(entry, "package.json"), "utf8"));
      return manifest.private !== true;
    } catch {
      return false;
    }
  });

for (const packageDir of packageDirs) {
  const result = spawnSync("npm", ["pack", "--dry-run"], {
    cwd: packageDir,
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
