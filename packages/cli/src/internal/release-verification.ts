import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { findWorkspaceRoot } from "@h9-foundry/agentforge-context-engine";

import { EXPECTED_PUBLIC_PACKAGES, TARGET_NPM_SCOPE } from "./release-preflight.js";

interface CommandResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ReleaseVerifyEntry {
  id: string;
  label: string;
  status: "pass" | "fail";
  detail: string;
}

export interface ReleaseVerifyTarball {
  packageName: string;
  version: string;
  tarballPath: string;
  packageDir: string;
}

export interface ReleaseVerifyResult {
  workspaceRoot: string;
  targetScope: string;
  tempDir: string;
  consumerProjectDir: string;
  globalPrefixDir: string;
  tarballs: ReleaseVerifyTarball[];
  checks: ReleaseVerifyEntry[];
  ready: boolean;
}

export interface ReleaseVerifyOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly runCommand?: (command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) => CommandResult;
}

interface PackedTarballJson {
  id?: string;
  name?: string;
  version?: string;
  filename?: string;
  files?: Array<{ path?: string }>;
}

function defaultRunCommand(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8"
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? (result.error instanceof Error ? result.error.message : "")
  };
}

function pushCheck(
  checks: ReleaseVerifyEntry[],
  id: string,
  label: string,
  status: ReleaseVerifyEntry["status"],
  detail: string
): void {
  checks.push({ id, label, status, detail });
}

function summarizeCommandOutput(result: CommandResult): string {
  const output = `${result.stdout}\n${result.stderr}`.trim();
  return output ? output.split("\n").slice(0, 4).join(" | ") : "Command completed.";
}

function getPublicPackageDirectories(root: string): Array<{ packageName: string; packageDir: string }> {
  return EXPECTED_PUBLIC_PACKAGES.map((packageName) => ({
    packageName,
    packageDir: join(root, "packages", packageName.split("/")[1].replace("agentforge-", ""))
  }));
}

function packPublicPackage(
  packageName: string,
  packageDir: string,
  tarballDir: string,
  env: NodeJS.ProcessEnv,
  runCommand: ReleaseVerifyOptions["runCommand"]
): { tarball?: ReleaseVerifyTarball; checks: ReleaseVerifyEntry[] } {
  const checks: ReleaseVerifyEntry[] = [];
  const execute = runCommand ?? defaultRunCommand;
  const result = execute("npm", ["pack", "--json", "--pack-destination", tarballDir], packageDir, env);

  if (result.status !== 0) {
    pushCheck(
      checks,
      `pack-${packageName}`,
      `pack ${packageName}`,
      "fail",
      `npm pack failed for ${packageName}: ${summarizeCommandOutput(result)}`
    );
    return { checks };
  }

  let metadata: PackedTarballJson | PackedTarballJson[];
  try {
    metadata = JSON.parse(result.stdout) as PackedTarballJson | PackedTarballJson[];
  } catch {
    pushCheck(
      checks,
      `pack-json-${packageName}`,
      `parse pack metadata for ${packageName}`,
      "fail",
      `npm pack did not return valid JSON for ${packageName}: ${summarizeCommandOutput(result)}`
    );
    return { checks };
  }

  const packed = Array.isArray(metadata) ? metadata[0] : metadata;
  if (!packed?.filename || !packed?.name || !packed?.version) {
    pushCheck(
      checks,
      `pack-metadata-${packageName}`,
      `pack metadata for ${packageName}`,
      "fail",
      `npm pack did not include filename/name/version for ${packageName}.`
    );
    return { checks };
  }

  const packedFiles = Array.isArray(packed.files) ? packed.files.map((file) => file.path ?? "") : [];
  const hasPackageJson = packedFiles.includes("package.json");
  const hasDistFile = packedFiles.some((file) => file.startsWith("dist/"));

  pushCheck(
    checks,
    `pack-files-${packageName}`,
    `packed files for ${packageName}`,
    hasPackageJson && hasDistFile ? "pass" : "fail",
    hasPackageJson && hasDistFile
      ? `Packed tarball includes package.json and dist assets.`
      : `Packed tarball is missing ${hasPackageJson ? "dist assets" : "package.json"} for ${packageName}.`
  );

  return {
    tarball: {
      packageName,
      version: packed.version,
      tarballPath: join(tarballDir, packed.filename),
      packageDir
    },
    checks
  };
}

function verifyInstalledPackageFiles(
  consumerProjectDir: string,
  tarballs: ReleaseVerifyTarball[],
  checks: ReleaseVerifyEntry[]
): void {
  for (const tarball of tarballs) {
    const packageRoot = join(consumerProjectDir, "node_modules", ...tarball.packageName.split("/"));
    const manifestPath = join(packageRoot, "package.json");

    if (!existsSync(manifestPath)) {
      pushCheck(
        checks,
        `installed-manifest-${tarball.packageName}`,
        `installed manifest for ${tarball.packageName}`,
        "fail",
        `Expected ${manifestPath} to exist after tarball install.`
      );
      continue;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      main?: string;
      types?: string;
      dependencies?: Record<string, string>;
    };
    const dependencyVersions = Object.values(manifest.dependencies ?? {});
    const hasWorkspaceProtocol = dependencyVersions.some((version) => version.startsWith("workspace:"));
    const mainPath = typeof manifest.main === "string" ? join(packageRoot, manifest.main) : undefined;
    const typesPath = typeof manifest.types === "string" ? join(packageRoot, manifest.types) : undefined;

    pushCheck(
      checks,
      `manifest-deps-${tarball.packageName}`,
      `installed dependency metadata for ${tarball.packageName}`,
      hasWorkspaceProtocol ? "fail" : "pass",
      hasWorkspaceProtocol
        ? `Installed package.json for ${tarball.packageName} still contains workspace protocol dependencies.`
        : `Installed package.json for ${tarball.packageName} does not expose workspace protocol dependencies.`
    );

    pushCheck(
      checks,
      `manifest-main-${tarball.packageName}`,
      `installed entrypoints for ${tarball.packageName}`,
      mainPath && typesPath && existsSync(mainPath) && existsSync(typesPath) ? "pass" : "fail",
      mainPath && typesPath && existsSync(mainPath) && existsSync(typesPath)
        ? `Installed package entrypoints exist for ${tarball.packageName}.`
        : `Installed package entrypoints are missing for ${tarball.packageName}.`
    );
  }
}

function writeImportProbe(consumerProjectDir: string): string {
  const probePath = join(consumerProjectDir, "verify-imports.mjs");
  const probeContents = `const packages = ${JSON.stringify(EXPECTED_PUBLIC_PACKAGES, null, 2)};

for (const packageName of packages) {
  const loaded = await import(packageName);
  if (!loaded || typeof loaded !== "object") {
    throw new Error(\`Failed to load \${packageName}\`);
  }
}

console.log(JSON.stringify({ verified: packages }, null, 2));
`;
  writeFileSync(probePath, probeContents, "utf8");
  return probePath;
}

function verifyBundledCliDependencies(
  cliPackageRoot: string,
  checks: ReleaseVerifyEntry[],
  tarballs: ReleaseVerifyTarball[]
): void {
  const cliTarball = tarballs.find((tarball) => tarball.packageName === "@h9-foundry/agentforge-cli");
  if (!cliTarball) {
    pushCheck(
      checks,
      "global-cli-bundled-deps",
      "global CLI bundled first-party dependencies",
      "fail",
      "Unable to locate the CLI tarball metadata during global install verification."
    );
    return;
  }

  const cliManifestPath = join(cliPackageRoot, "package.json");
  if (!existsSync(cliManifestPath)) {
    pushCheck(
      checks,
      "global-cli-bundled-deps",
      "global CLI bundled first-party dependencies",
      "fail",
      `Expected ${cliManifestPath} to exist after global install verification.`
    );
    return;
  }

  const cliManifest = JSON.parse(readFileSync(cliManifestPath, "utf8")) as {
    bundleDependencies?: string[];
  };
  const bundledDependencies = Array.isArray(cliManifest.bundleDependencies) ? cliManifest.bundleDependencies : [];
  const sourceCliManifest = JSON.parse(readFileSync(join(cliTarball.packageDir, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const firstPartyDependencies = Object.keys(sourceCliManifest.dependencies ?? {})
    .filter((packageName) => packageName.startsWith("@h9-foundry/"))
    .sort();

  const missingDependencies = firstPartyDependencies.filter((packageName) => {
    if (!bundledDependencies.includes(packageName)) {
      return true;
    }

    const packageRoot = join(cliPackageRoot, "node_modules", ...packageName.split("/"));
    return !existsSync(join(packageRoot, "package.json")) || !existsSync(join(packageRoot, "dist"));
  });

  pushCheck(
    checks,
    "global-cli-bundled-deps",
    "global CLI bundled first-party dependencies",
    missingDependencies.length === 0 ? "pass" : "fail",
    missingDependencies.length === 0
      ? `Bundled first-party CLI dependencies were installed with package.json and dist assets.`
      : `Global CLI install is missing bundled first-party packages: ${missingDependencies.join(", ")}`
  );
}

export function verifyReleaseArtifacts(cwd = process.cwd(), options: ReleaseVerifyOptions = {}): ReleaseVerifyResult {
  const workspaceRoot = findWorkspaceRoot(cwd);
  const env = { ...process.env, ...options.env };
  const runCommand = options.runCommand ?? defaultRunCommand;
  const tempDir = mkdtempSync(join(tmpdir(), "agentforge-release-verify-"));
  const tarballDir = join(tempDir, "tarballs");
  const consumerProjectDir = join(tempDir, "consumer");
  const globalPrefixDir = join(tempDir, "global-prefix");
  const checks: ReleaseVerifyEntry[] = [];

  mkdirSync(tarballDir, { recursive: true });
  mkdirSync(consumerProjectDir, { recursive: true });
  mkdirSync(globalPrefixDir, { recursive: true });
  writeFileSync(
    join(consumerProjectDir, "package.json"),
    JSON.stringify(
      {
        name: "agentforge-release-verify-consumer",
        private: true,
        type: "module"
      },
      null,
      2
    ),
    "utf8"
  );

  const tarballs: ReleaseVerifyTarball[] = [];
  const buildPackages = runCommand("pnpm", ["build:packages"], workspaceRoot, env);
  pushCheck(
    checks,
    "build-packages",
    "build packages for verification",
    buildPackages.status === 0 ? "pass" : "fail",
    buildPackages.status === 0
      ? "Built package distributions before packing tarballs."
      : `Failed to build packages before verification: ${summarizeCommandOutput(buildPackages)}`
  );

  if (buildPackages.status !== 0) {
    return {
      workspaceRoot,
      targetScope: TARGET_NPM_SCOPE,
      tempDir,
      consumerProjectDir,
      globalPrefixDir,
      tarballs,
      checks,
      ready: false
    };
  }

  for (const packageInfo of getPublicPackageDirectories(workspaceRoot)) {
    const packed = packPublicPackage(packageInfo.packageName, packageInfo.packageDir, tarballDir, env, runCommand);
    checks.push(...packed.checks);
    if (packed.tarball) {
      tarballs.push(packed.tarball);
    }
  }

  const installTarballs = tarballs.map((tarball) => tarball.tarballPath);
  if (installTarballs.length === EXPECTED_PUBLIC_PACKAGES.length) {
    const install = runCommand("npm", ["install", "--no-package-lock", ...installTarballs], consumerProjectDir, env);
    pushCheck(
      checks,
      "install-clean-room",
      "install packed public packages",
      install.status === 0 ? "pass" : "fail",
      install.status === 0
        ? `Installed ${installTarballs.length} tarballs into a clean temp project.`
        : `Failed to install packed tarballs: ${summarizeCommandOutput(install)}`
    );

    if (install.status === 0) {
      verifyInstalledPackageFiles(consumerProjectDir, tarballs, checks);

      const importProbe = writeImportProbe(consumerProjectDir);
      const importResult = runCommand("node", [importProbe], consumerProjectDir, env);
      pushCheck(
        checks,
        "esm-imports",
        "ESM imports from packed tarballs",
        importResult.status === 0 ? "pass" : "fail",
        importResult.status === 0
          ? "Imported every public package from a clean-room install."
          : `Failed to import public packages from clean-room install: ${summarizeCommandOutput(importResult)}`
      );

      const cliBinary = join(consumerProjectDir, "node_modules", ".bin", "agentforge");
      const cliHelp = runCommand(cliBinary, ["--help"], consumerProjectDir, env);
      pushCheck(
        checks,
        "cli-help",
        "installed CLI help",
        cliHelp.status === 0 ? "pass" : "fail",
        cliHelp.status === 0 ? "Installed CLI binary rendered --help successfully." : summarizeCommandOutput(cliHelp)
      );

      const cliVisualizerHelp = runCommand(cliBinary, ["visualizer", "--help"], consumerProjectDir, env);
      pushCheck(
        checks,
        "cli-visualizer-help",
        "installed CLI visualizer help",
        cliVisualizerHelp.status === 0 ? "pass" : "fail",
        cliVisualizerHelp.status === 0
          ? "Installed CLI rendered visualizer --help successfully."
          : summarizeCommandOutput(cliVisualizerHelp)
      );

      const cliVisualizerExport = runCommand(
        cliBinary,
        ["visualizer", "export", "--format", "json", "--runs-root", join(workspaceRoot, ".agentops", "runs")],
        consumerProjectDir,
        env
      );
      pushCheck(
        checks,
        "cli-visualizer-export",
        "installed CLI visualizer export",
        cliVisualizerExport.status === 0 ? "pass" : "fail",
        cliVisualizerExport.status === 0
          ? "Installed CLI exported outcomes JSON successfully."
          : summarizeCommandOutput(cliVisualizerExport)
      );

      const cliGuide = runCommand(cliBinary, ["release", "guide"], consumerProjectDir, env);
      pushCheck(
        checks,
        "cli-guide",
        "installed CLI release guide",
        cliGuide.status === 0 ? "pass" : "fail",
        cliGuide.status === 0 ? "Installed CLI rendered release guide successfully." : summarizeCommandOutput(cliGuide)
      );

      const cliCheck = runCommand(
        cliBinary,
        ["release", "check", "--json", "--skip-npm-auth", "--skip-local-commands"],
        workspaceRoot,
        {
          ...env,
          AGENTFORGE_SKIP_NPM_AUTH: "1",
          AGENTFORGE_SKIP_LOCAL_COMMANDS: "1"
        }
      );
      pushCheck(
        checks,
        "cli-release-check",
        "installed CLI release check",
        cliCheck.status === 0 ? "pass" : "fail",
        cliCheck.status === 0
          ? "Installed CLI ran release check --json successfully against the workspace."
          : `Installed CLI failed release check --json against the workspace: ${summarizeCommandOutput(cliCheck)}`
      );

      const cliTarball = tarballs.find((tarball) => tarball.packageName === "@h9-foundry/agentforge-cli");
      if (cliTarball) {
        const globalInstall = runCommand("npm", ["install", "-g", "--prefix", globalPrefixDir, cliTarball.tarballPath], workspaceRoot, env);
        pushCheck(
          checks,
          "global-cli-install",
          "global-prefix install of packed CLI",
          globalInstall.status === 0 ? "pass" : "fail",
          globalInstall.status === 0
            ? "Installed the packed CLI through a global-prefix path."
            : `Failed to install the packed CLI through a global-prefix path: ${summarizeCommandOutput(globalInstall)}`
        );

        if (globalInstall.status === 0) {
          const globalCliPackageRoot = join(globalPrefixDir, "lib", "node_modules", "@h9-foundry", "agentforge-cli");
          verifyBundledCliDependencies(globalCliPackageRoot, checks, tarballs);

          const globalEnv = {
            ...env,
            PATH: `${join(globalPrefixDir, "bin")}:${env.PATH ?? ""}`
          };
          const globalCliHelp = runCommand("agentforge", ["--help"], workspaceRoot, globalEnv);
          pushCheck(
            checks,
            "global-cli-help",
            "global CLI help",
            globalCliHelp.status === 0 ? "pass" : "fail",
            globalCliHelp.status === 0
              ? "Global CLI binary rendered --help successfully from PATH."
              : summarizeCommandOutput(globalCliHelp)
          );

          const globalCliVisualizerHelp = runCommand("agentforge", ["visualizer", "--help"], workspaceRoot, globalEnv);
          pushCheck(
            checks,
            "global-cli-visualizer-help",
            "global CLI visualizer help",
            globalCliVisualizerHelp.status === 0 ? "pass" : "fail",
            globalCliVisualizerHelp.status === 0
              ? "Global CLI rendered visualizer --help successfully from PATH."
              : summarizeCommandOutput(globalCliVisualizerHelp)
          );
        }
      }
    }
  } else {
    pushCheck(
      checks,
      "install-clean-room",
      "install packed public packages",
      "fail",
      `Expected ${EXPECTED_PUBLIC_PACKAGES.length} tarballs but only packed ${tarballs.length}.`
    );
  }

  return {
    workspaceRoot,
    targetScope: TARGET_NPM_SCOPE,
    tempDir,
    consumerProjectDir,
    globalPrefixDir,
    tarballs,
    checks,
    ready: checks.every((check) => check.status === "pass")
  };
}
