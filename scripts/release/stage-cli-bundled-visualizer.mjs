import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { sanitizeManifest, workspaceRoot } from "./package-manifest-utils.mjs";

const cliRoot = join(workspaceRoot, "packages", "cli");
const visualizerRoot = join(workspaceRoot, "packages", "visualizer");
const visualizerDist = join(visualizerRoot, "dist");
const cliNodeModulesRoot = join(cliRoot, "node_modules");
const targetRoot = join(cliNodeModulesRoot, "@h9-foundry");
const targetPath = join(targetRoot, "agentforge-visualizer");
const backupPath = join(cliNodeModulesRoot, ".agentforge-h9-foundry-backup");
const statePath = join(cliNodeModulesRoot, ".agentforge-visualizer-stage.json");

if (!existsSync(visualizerDist)) {
  throw new Error(`Expected built visualizer assets at ${visualizerDist}. Run the package build first.`);
}

mkdirSync(cliNodeModulesRoot, { recursive: true });

if (existsSync(statePath)) {
  rmSync(statePath, { force: true });
}

if (existsSync(backupPath)) {
  rmSync(backupPath, { recursive: true, force: true });
}

let hadOriginal = false;
if (existsSync(targetRoot)) {
  renameSync(targetRoot, backupPath);
  hadOriginal = true;
}

mkdirSync(targetRoot, { recursive: true });
mkdirSync(targetPath, { recursive: true });
cpSync(visualizerDist, join(targetPath, "dist"), { recursive: true });

const visualizerManifest = JSON.parse(readFileSync(join(visualizerRoot, "package.json"), "utf8"));
const sanitizedManifest = {
  ...sanitizeManifest(visualizerManifest),
  files: ["dist"]
};

writeFileSync(join(targetPath, "package.json"), JSON.stringify(sanitizedManifest, null, 2));
writeFileSync(
  statePath,
  JSON.stringify(
    {
      hadOriginal,
      backupPath: relative(cliNodeModulesRoot, backupPath),
      targetPath: relative(cliNodeModulesRoot, targetRoot)
    },
    null,
    2
  )
);

if (!existsSync(join(targetPath, "package.json"))) {
  throw new Error(`Failed to stage bundled visualizer manifest at ${targetPath}.`);
}
