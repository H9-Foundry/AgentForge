import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { getPackageDir, readJson, workspaceRoot } from "./package-manifest-utils.mjs";

function readLocalPackageVersion(packageName) {
  const manifest = readJson(join(getPackageDir(packageName), "package.json"));
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error(`Missing version in local manifest for ${packageName}.`);
  }

  return manifest.version;
}

export function loadFixedPackageVersions() {
  const changesetConfig = JSON.parse(readFileSync(join(workspaceRoot, ".changeset", "config.json"), "utf8"));
  const fixedSets = Array.isArray(changesetConfig.fixed) ? changesetConfig.fixed : [];
  const packageNames = [...new Set(fixedSets.flatMap((entry) => Array.isArray(entry) ? entry : []))];

  return packageNames.map((packageName) => ({
    packageName,
    targetVersion: readLocalPackageVersion(packageName)
  }));
}

export function readPublishedPackageVersion(packageName, spawn = spawnSync) {
  const result = spawn("npm", ["view", packageName, "version", "--json"], {
    encoding: "utf8",
    env: process.env
  });

  if ((result.status ?? 1) !== 0) {
    return undefined;
  }

  const raw = result.stdout?.trim();
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : undefined;
  } catch {
    return raw.replace(/^"|"$/g, "");
  }
}

export function reconcilePublishedFixedPackages(
  packageVersions,
  spawn = spawnSync
) {
  const mismatches = packageVersions
    .map(({ packageName, targetVersion }) => {
      const publishedVersion = readPublishedPackageVersion(packageName, spawn);
      return {
        packageName,
        targetVersion,
        publishedVersion,
        status: publishedVersion === targetVersion ? "published" : "missing"
      };
    });

  return {
    packageStatuses: mismatches,
    allPublished: mismatches.every((entry) => entry.status === "published")
  };
}

export function runChangesetPublish(
  argv = process.argv.slice(2),
  spawn = spawnSync,
  log = console.log,
  errorLog = console.error
) {
  const result = spawn("changeset", ["publish", ...argv], {
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_node_linker: "hoisted"
    }
  });

  if ((result.status ?? 1) === 0) {
    return 0;
  }

  const fixedPackageVersions = loadFixedPackageVersions();
  const reconciliation = reconcilePublishedFixedPackages(fixedPackageVersions, spawn);

  if (reconciliation.allPublished) {
    log(
      `[release] changeset publish exited with status ${result.status ?? 1}, but all fixed packages are already published at ${fixedPackageVersions[0]?.targetVersion ?? "the target version"}. Treating this as reconciled success.`
    );
    return 0;
  }

  const missingSummary = reconciliation.packageStatuses
    .filter((entry) => entry.status !== "published")
    .map((entry) => `${entry.packageName}@${entry.targetVersion} (registry: ${entry.publishedVersion ?? "missing"})`)
    .join(", ");
  errorLog(
    `[release] changeset publish failed and the fixed package set was not fully published. Recovery required for: ${missingSummary}`
  );
  return result.status ?? 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runChangesetPublish());
}
