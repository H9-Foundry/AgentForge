import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const workspaceRoot = resolve(scriptDir, "..", "..");

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function getPackageDir(packageName) {
  const shortName = packageName.split("/")[1];
  if (!shortName?.startsWith("agentforge-")) {
    throw new Error(`Unsupported workspace package name: ${packageName}`);
  }

  return join(workspaceRoot, "packages", shortName.replace("agentforge-", ""));
}

export function resolveWorkspaceVersion(packageName, versionRange) {
  if (typeof versionRange !== "string" || !versionRange.startsWith("workspace:")) {
    return versionRange;
  }

  const packageDir = getPackageDir(packageName);
  const packageManifestPath = join(packageDir, "package.json");
  if (!existsSync(packageManifestPath)) {
    throw new Error(`Unable to resolve workspace dependency ${packageName} from ${packageManifestPath}.`);
  }

  const packageManifest = readJson(packageManifestPath);
  const localVersion = packageManifest.version;

  if (versionRange === "workspace:*") {
    return localVersion;
  }

  return versionRange.replace("workspace:", "");
}

export function sanitizeManifest(manifest) {
  const sanitized = { ...manifest };
  const sections = ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies"];

  for (const section of sections) {
    if (!sanitized[section]) {
      continue;
    }

    sanitized[section] = Object.fromEntries(
      Object.entries(sanitized[section]).map(([packageName, versionRange]) => [
        packageName,
        resolveWorkspaceVersion(packageName, versionRange)
      ])
    );
  }

  return sanitized;
}
