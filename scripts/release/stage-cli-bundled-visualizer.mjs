import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";

import { getPackageDir, sanitizeManifest, workspaceRoot } from "./package-manifest-utils.mjs";

const cliRoot = join(workspaceRoot, "packages", "cli");
const cliNodeModulesRoot = join(cliRoot, "node_modules");
const targetRoot = join(cliNodeModulesRoot, "@h9-foundry");
const backupPath = join(cliNodeModulesRoot, ".agentforge-h9-foundry-backup");
const statePath = join(cliNodeModulesRoot, ".agentforge-first-party-stage.json");
const bundledPackageNames = [
  "@h9-foundry/agentforge-audit",
  "@h9-foundry/agentforge-context-engine",
  "@h9-foundry/agentforge-policy-engine",
  "@h9-foundry/agentforge-runtime",
  "@h9-foundry/agentforge-schemas",
  "@h9-foundry/agentforge-sdk",
  "@h9-foundry/agentforge-shared-types",
  "@h9-foundry/agentforge-visualizer"
];

function findPackageRoot(resolvedEntryPath) {
  let current = dirname(resolvedEntryPath);

  while (current !== dirname(current)) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
    current = dirname(current);
  }

  throw new Error(`Unable to locate package root for ${resolvedEntryPath}.`);
}

function stagePackage(packageName) {
  const packageDir = getPackageDir(packageName);
  const distPath = join(packageDir, "dist");

  if (!existsSync(distPath)) {
    throw new Error(`Expected built package assets at ${distPath}. Run the package build first.`);
  }

  const targetPath = join(targetRoot, packageName.split("/")[1]);
  mkdirSync(targetPath, { recursive: true });
  cpSync(distPath, join(targetPath, "dist"), { recursive: true });

  for (const assetName of ["README.md", "LICENSE"]) {
    const assetPath = join(packageDir, assetName);
    if (existsSync(assetPath)) {
      cpSync(assetPath, join(targetPath, assetName));
    }
  }

  const packageManifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  const manifestFiles = ["dist"];
  if (existsSync(join(packageDir, "README.md"))) {
    manifestFiles.push("README.md");
  }
  if (existsSync(join(packageDir, "LICENSE"))) {
    manifestFiles.push("LICENSE");
  }

  const sanitizedManifest = {
    ...sanitizeManifest(packageManifest),
    files: manifestFiles
  };

  writeFileSync(join(targetPath, "package.json"), JSON.stringify(sanitizedManifest, null, 2));

  const packageRequire = createRequire(join(packageDir, "package.json"));
  const externalDependencies = Object.keys(packageManifest.dependencies ?? {}).filter(
    (dependencyName) => !dependencyName.startsWith("@h9-foundry/")
  );
  const targetNodeModulesRoot = join(targetPath, "node_modules");

  for (const dependencyName of externalDependencies) {
    const dependencyEntry = packageRequire.resolve(dependencyName);
    const dependencyRoot = findPackageRoot(dependencyEntry);
    const dependencyTargetPath = join(targetNodeModulesRoot, ...dependencyName.split("/"));

    mkdirSync(join(targetNodeModulesRoot, ...dependencyName.split("/").slice(0, -1)), { recursive: true });
    rmSync(dependencyTargetPath, { recursive: true, force: true });
    cpSync(dependencyRoot, dependencyTargetPath, { recursive: true, dereference: true });
  }
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
for (const packageName of bundledPackageNames) {
  stagePackage(packageName);
}
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
for (const packageName of bundledPackageNames) {
  const targetPath = join(targetRoot, packageName.split("/")[1]);
  if (!existsSync(join(targetPath, "package.json"))) {
    throw new Error(`Failed to stage bundled package manifest at ${targetPath}.`);
  }
}
