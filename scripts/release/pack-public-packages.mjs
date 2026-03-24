import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

const packDir = mkdtempSync(join(tmpdir(), "agentforge-pack-public-"));

for (const packageDir of packageDirs) {
  const result = spawnSync("npm", ["pack", "--json", "--pack-destination", packDir], {
    cwd: packageDir,
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    rmSync(packDir, { recursive: true, force: true });
    process.exit(result.status ?? 1);
  }
}

rmSync(packDir, { recursive: true, force: true });
