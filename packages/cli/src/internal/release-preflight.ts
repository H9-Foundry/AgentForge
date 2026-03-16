import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { findWorkspaceRoot } from "@h9-foundry/agentforge-context-engine";

export const TARGET_NPM_SCOPE = "@h9-foundry";

export const EXPECTED_PUBLIC_PACKAGES = [
  "@h9-foundry/agentforge-cli",
  "@h9-foundry/agentforge-schemas",
  "@h9-foundry/agentforge-shared-types",
  "@h9-foundry/agentforge-sdk",
  "@h9-foundry/agentforge-context-engine",
  "@h9-foundry/agentforge-policy-engine",
  "@h9-foundry/agentforge-runtime",
  "@h9-foundry/agentforge-audit"
] as const;

export interface ReleaseCheckEntry {
  id: string;
  label: string;
  status: "pass" | "fail";
  detail: string;
}

export interface ReleaseCheckResult {
  npmAuth: {
    path: string;
    present: boolean;
    readable: boolean;
  };
  npmUser: {
    resolved: boolean;
    value?: string;
    error?: string;
  };
  targetScope: string;
  publicPackages: {
    expected: string[];
    actual: string[];
    matches: boolean;
  };
  workflowTrustedPublishing: {
    workflowPath: string;
    idTokenWrite: boolean;
    registryUrl: boolean;
    usesChangesetsAction: boolean;
    requiresNpmToken: boolean;
    matches: boolean;
  };
  changesetConfig: {
    configPath: string;
    fixed: string[];
    ignore: string[];
    matches: boolean;
  };
  checks: ReleaseCheckEntry[];
  ready: boolean;
}

export interface ReleaseGuide {
  readonly title: string;
  readonly steps: string[];
  readonly urls: string[];
}

interface CommandResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ReleaseCheckOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly runCommand?: (command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) => CommandResult;
  readonly skipNpmAuth?: boolean;
  readonly skipLocalCommands?: boolean;
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

function compareStringArrays(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function resolveNpmUserConfigPath(env: NodeJS.ProcessEnv): string {
  if (env.NPM_CONFIG_USERCONFIG) {
    return resolve(env.NPM_CONFIG_USERCONFIG);
  }

  const baseHome = env.HOME || env.USERPROFILE || homedir();
  return join(baseHome, ".npmrc");
}

function listPublicWorkspacePackages(root: string): string[] {
  const packagesDir = join(root, "packages");
  if (!existsSync(packagesDir)) {
    return [];
  }

  return readdirSync(packagesDir)
    .map((entry) => join(packagesDir, entry, "package.json"))
    .filter((manifestPath) => existsSync(manifestPath))
    .map((manifestPath) => JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: string; private?: boolean })
    .filter((manifest) => manifest.private !== true && typeof manifest.name === "string")
    .map((manifest) => manifest.name as string)
    .sort();
}

function inspectReleaseWorkflow(root: string): ReleaseCheckResult["workflowTrustedPublishing"] {
  const workflowPath = join(root, ".github", "workflows", "release-packages.yml");
  const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, "utf8") : "";
  const idTokenWrite = /id-token:\s*write/.test(workflow);
  const registryUrl = /registry-url:\s*"https:\/\/registry\.npmjs\.org"/.test(workflow);
  const usesChangesetsAction = /changesets\/action@/.test(workflow);
  const requiresNpmToken = /\bNPM_TOKEN\b/.test(workflow);

  return {
    workflowPath,
    idTokenWrite,
    registryUrl,
    usesChangesetsAction,
    requiresNpmToken,
    matches: idTokenWrite && registryUrl && usesChangesetsAction && !requiresNpmToken
  };
}

function inspectChangesetConfig(root: string): ReleaseCheckResult["changesetConfig"] {
  const configPath = join(root, ".changeset", "config.json");
  const config = existsSync(configPath)
    ? (JSON.parse(readFileSync(configPath, "utf8")) as {
        fixed?: string[][];
        ignore?: string[];
      })
    : {};

  const fixed = Array.isArray(config.fixed?.[0]) ? [...config.fixed[0]].sort() : [];
  const ignore = Array.isArray(config.ignore) ? [...config.ignore].sort() : [];

  return {
    configPath,
    fixed,
    ignore,
    matches: compareStringArrays(fixed, [...EXPECTED_PUBLIC_PACKAGES].sort())
  };
}

function pushCheck(
  checks: ReleaseCheckEntry[],
  id: string,
  label: string,
  status: ReleaseCheckEntry["status"],
  detail: string
): void {
  checks.push({ id, label, status, detail });
}

function summarizeCommandOutput(result: CommandResult): string {
  const output = `${result.stdout}\n${result.stderr}`.trim();
  return output ? output.split("\n").slice(0, 3).join(" | ") : "Command completed.";
}

export function getReleaseGuide(): ReleaseGuide {
  return {
    title: "AgentForge npm bootstrap guide",
    steps: [
      "Run `npm login` on this workstation so npm auth is available through your user-scoped ~/.npmrc.",
      "Create the npm organization `h9-foundry` and confirm your npm account is an owner before attempting any publish.",
      "Confirm the public package target remains @h9-foundry/agentforge-* and keep GitHub Actions trusted publishing enabled in .github/workflows/release-packages.yml.",
      "After npm org ownership is confirmed, configure npm trusted publishing for H9-Foundry/AgentForge and rerun the Release Packages workflow on main.",
      "Use `agentforge release check --json` before and after external npm setup to confirm the repo is ready and to capture remaining blockers."
    ],
    urls: [
      "https://www.npmjs.com/login",
      "https://www.npmjs.com/org/create",
      "https://www.npmjs.com/settings",
      "https://docs.npmjs.com/trusted-publishers",
      "https://github.com/H9-Foundry/AgentForge/actions/workflows/release-packages.yml"
    ]
  };
}

export function renderReleaseGuide(): string {
  const guide = getReleaseGuide();
  return [
    guide.title,
    "",
    ...guide.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Reference URLs:",
    ...guide.urls.map((url) => `- ${url}`)
  ].join("\n");
}

export function checkReleaseReadiness(cwd = process.cwd(), options: ReleaseCheckOptions = {}): ReleaseCheckResult {
  const root = findWorkspaceRoot(cwd);
  const env = { ...process.env, ...options.env };
  const runCommand = options.runCommand ?? defaultRunCommand;
  const skipNpmAuth = options.skipNpmAuth ?? env.AGENTFORGE_SKIP_NPM_AUTH === "1";
  const skipLocalCommands = options.skipLocalCommands ?? env.AGENTFORGE_SKIP_LOCAL_COMMANDS === "1";
  const checks: ReleaseCheckEntry[] = [];

  const npmrcPath = resolveNpmUserConfigPath(env);
  let npmReadable = false;
  if (existsSync(npmrcPath)) {
    try {
      readFileSync(npmrcPath, "utf8");
      npmReadable = true;
    } catch {
      npmReadable = false;
    }
  }

  const npmAuth = {
    path: npmrcPath,
    present: existsSync(npmrcPath),
    readable: npmReadable
  };

  if (skipNpmAuth) {
    pushCheck(checks, "npm-auth", "npm auth file", "pass", "Skipped npm auth verification for this environment.");
  } else if (npmAuth.present && npmAuth.readable) {
    pushCheck(checks, "npm-auth", "npm auth file", "pass", `Found readable npm auth at ${npmAuth.path}.`);
  } else {
    pushCheck(checks, "npm-auth", "npm auth file", "fail", `Expected a readable npm auth file at ${npmAuth.path}. Run npm login first.`);
  }

  let npmUser: ReleaseCheckResult["npmUser"];
  if (skipNpmAuth) {
    npmUser = {
      resolved: false,
      error: "Skipped npm username resolution for this environment."
    };
    pushCheck(checks, "npm-user", "npm username", "pass", "Skipped npm username resolution for this environment.");
  } else if (npmAuth.present && npmAuth.readable) {
    const whoami = runCommand("npm", ["whoami"], root, env);
    if (whoami.status === 0) {
      npmUser = {
        resolved: true,
        value: whoami.stdout.trim()
      };
      pushCheck(checks, "npm-user", "npm username", "pass", `Authenticated as ${npmUser.value}.`);
    } else {
      npmUser = {
        resolved: false,
        error: summarizeCommandOutput(whoami)
      };
      pushCheck(checks, "npm-user", "npm username", "fail", `npm whoami failed: ${npmUser.error}`);
    }
  } else {
    npmUser = {
      resolved: false,
      error: "npm auth is not configured on this workstation."
    };
    pushCheck(checks, "npm-user", "npm username", "fail", npmUser.error ?? "npm auth is not configured on this workstation.");
  }

  const publicPackages = {
    expected: [...EXPECTED_PUBLIC_PACKAGES].sort(),
    actual: listPublicWorkspacePackages(root),
    matches: false
  };
  publicPackages.matches = compareStringArrays(publicPackages.actual, publicPackages.expected);

  pushCheck(
    checks,
    "public-packages",
    "public package set",
    publicPackages.matches ? "pass" : "fail",
    publicPackages.matches
      ? `Workspace public packages match ${TARGET_NPM_SCOPE}.`
      : `Expected ${publicPackages.expected.join(", ")} but found ${publicPackages.actual.join(", ")}.`
  );

  const workflowTrustedPublishing = inspectReleaseWorkflow(root);
  pushCheck(
    checks,
    "trusted-publishing",
    "release workflow trusted publishing",
    workflowTrustedPublishing.matches ? "pass" : "fail",
    workflowTrustedPublishing.matches
      ? `Trusted publishing is configured in ${workflowTrustedPublishing.workflowPath}.`
      : "Release workflow must use id-token: write, registry-url, changesets/action, and no NPM_TOKEN."
  );

  const changesetConfig = inspectChangesetConfig(root);
  pushCheck(
    checks,
    "changeset-config",
    "changeset public package config",
    changesetConfig.matches ? "pass" : "fail",
    changesetConfig.matches
      ? `Changesets fixed package set matches ${TARGET_NPM_SCOPE}.`
      : `Changesets fixed package set does not match the expected public package list in ${changesetConfig.configPath}.`
  );

  const localCommandChecks: Array<{ id: string; label: string; args: string[] }> = [
    { id: "typecheck", label: "typecheck", args: ["typecheck"] },
    { id: "build-packages", label: "build packages", args: ["build:packages"] },
    { id: "pack-public", label: "pack public packages", args: ["pack:public"] },
    { id: "changeset-status", label: "changeset status", args: ["changeset", "status"] }
  ];

  if (skipLocalCommands) {
    pushCheck(checks, "local-commands", "local release-shape commands", "pass", "Skipped local command checks for this environment.");
  } else {
    for (const commandCheck of localCommandChecks) {
      const result = runCommand("pnpm", commandCheck.args, root, env);
      pushCheck(
        checks,
        commandCheck.id,
        commandCheck.label,
        result.status === 0 ? "pass" : "fail",
        result.status === 0
          ? summarizeCommandOutput(result)
          : `Command failed: pnpm ${commandCheck.args.join(" ")} | ${summarizeCommandOutput(result)}`
      );
    }
  }

  return {
    npmAuth,
    npmUser,
    targetScope: TARGET_NPM_SCOPE,
    publicPackages,
    workflowTrustedPublishing,
    changesetConfig,
    checks,
    ready: checks.every((check) => check.status === "pass")
  };
}
