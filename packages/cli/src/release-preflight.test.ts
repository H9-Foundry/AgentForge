import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { EXPECTED_PUBLIC_PACKAGES, TARGET_NPM_SCOPE, checkReleaseReadiness, renderReleaseGuide } from "./index.js";

function writeJson(pathValue: string, value: unknown): void {
  mkdirSync(dirname(pathValue), { recursive: true });
  writeFileSync(pathValue, JSON.stringify(value, null, 2));
}

function createReleaseFixture(options?: {
  workflow?: string;
  publicPackages?: string[];
  fixedPackages?: string[];
}): string {
  const root = mkdtempSync(join(tmpdir(), "agentforge-release-"));
  const publicPackages = options?.publicPackages ?? [...EXPECTED_PUBLIC_PACKAGES];
  const fixedPackages = options?.fixedPackages ?? [...EXPECTED_PUBLIC_PACKAGES];
  const workflow =
    options?.workflow ??
    [
      "name: Release Packages",
      "permissions:",
      "  contents: write",
      "  pull-requests: write",
      "  id-token: write",
      "jobs:",
      "  release:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      '      - uses: actions/setup-node@v6.3.0',
      '        with:',
      '          registry-url: "https://registry.npmjs.org"',
      "      - uses: changesets/action@v1.7.0",
      "        env:",
      "          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}"
    ].join("\n");

  writeJson(join(root, ".changeset", "config.json"), {
    fixed: [fixedPackages],
    ignore: ["@h9-foundry/agentforge-registry-client"]
  });
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  writeFileSync(join(root, ".github", "workflows", "release-packages.yml"), workflow, "utf8");

  for (const packageName of publicPackages) {
    const folderName = packageName.split("/")[1];
    writeJson(join(root, "packages", folderName, "package.json"), {
      name: packageName,
      version: "0.2.0",
      type: "module"
    });
  }

  return root;
}

function createRunner(overrides?: {
  npmWhoami?: { status: number; stdout?: string; stderr?: string };
  commands?: Record<string, { status: number; stdout?: string; stderr?: string }>;
}) {
  return (command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) => {
    void cwd;
    void env;
    if (command === "npm" && args.join(" ") === "whoami") {
      return {
        status: overrides?.npmWhoami?.status ?? 0,
        stdout: overrides?.npmWhoami?.stdout ?? "ethan\n",
        stderr: overrides?.npmWhoami?.stderr ?? ""
      };
    }

    const key = `${command} ${args.join(" ")}`;
    const entry = overrides?.commands?.[key];
    if (entry) {
      return {
        status: entry.status,
        stdout: entry.stdout ?? "",
        stderr: entry.stderr ?? ""
      };
    }

    return {
      status: 0,
      stdout: "ok\n",
      stderr: ""
    };
  };
}

describe("release preflight", () => {
  it("reports missing npm auth when ~/.npmrc is absent", () => {
    const root = createReleaseFixture();
    const home = mkdtempSync(join(tmpdir(), "agentforge-home-"));
    const result = checkReleaseReadiness(root, {
      env: { HOME: home },
      runCommand: createRunner()
    });

    expect(result.npmAuth.present).toBe(false);
    expect(result.npmUser.resolved).toBe(false);
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.id === "npm-auth")?.status).toBe("fail");
  });

  it("resolves the npm username when auth is configured", () => {
    const root = createReleaseFixture();
    const home = mkdtempSync(join(tmpdir(), "agentforge-home-"));
    writeFileSync(join(home, ".npmrc"), "//registry.npmjs.org/:_authToken=fake\n", "utf8");

    const result = checkReleaseReadiness(root, {
      env: { HOME: home },
      runCommand: createRunner({
        npmWhoami: {
          status: 0,
          stdout: "ethanchung1\n"
        }
      })
    });

    expect(result.npmUser.resolved).toBe(true);
    expect(result.npmUser.value).toBe("ethanchung1");
    expect(result.targetScope).toBe(TARGET_NPM_SCOPE);
  });

  it("fails when the public package set drifts from the curated publishable list", () => {
    const root = createReleaseFixture({
      publicPackages: EXPECTED_PUBLIC_PACKAGES.slice(0, -1)
    });
    const home = mkdtempSync(join(tmpdir(), "agentforge-home-"));
    writeFileSync(join(home, ".npmrc"), "//registry.npmjs.org/:_authToken=fake\n", "utf8");

    const result = checkReleaseReadiness(root, {
      env: { HOME: home },
      runCommand: createRunner()
    });

    expect(result.publicPackages.matches).toBe(false);
    expect(result.ready).toBe(false);
  });

  it("fails when the release workflow is not configured for trusted publishing", () => {
    const root = createReleaseFixture({
      workflow: [
        "name: Release Packages",
        "permissions:",
        "  contents: write",
        "jobs:",
        "  release:",
        "    steps:",
        "      - run: echo broken",
        "        env:",
        "          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}"
      ].join("\n")
    });
    const home = mkdtempSync(join(tmpdir(), "agentforge-home-"));
    writeFileSync(join(home, ".npmrc"), "//registry.npmjs.org/:_authToken=fake\n", "utf8");

    const result = checkReleaseReadiness(root, {
      env: { HOME: home },
      runCommand: createRunner()
    });

    expect(result.workflowTrustedPublishing.matches).toBe(false);
    expect(result.ready).toBe(false);
  });

  it("reports ready when npm auth, package metadata, workflow config, and local checks all pass", () => {
    const root = createReleaseFixture();
    const home = mkdtempSync(join(tmpdir(), "agentforge-home-"));
    writeFileSync(join(home, ".npmrc"), "//registry.npmjs.org/:_authToken=fake\n", "utf8");

    const result = checkReleaseReadiness(root, {
      env: { HOME: home },
      runCommand: createRunner()
    });

    expect(result.ready).toBe(true);
    expect(result.publicPackages.matches).toBe(true);
    expect(result.workflowTrustedPublishing.matches).toBe(true);
    expect(result.changesetConfig.matches).toBe(true);
  });

  it("renders a deterministic release guide", () => {
    const guide = renderReleaseGuide();

    expect(guide).toContain("npm login");
    expect(guide).toContain("@h9-foundry");
    expect(guide).toContain("https://www.npmjs.com/org/create");
  });

  it("exposes the release guide command from the CLI", () => {
    const result = spawnSync("pnpm", ["exec", "tsx", "packages/cli/src/bin.ts", "release", "guide"], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("AgentForge npm bootstrap guide");
  });

  it("exposes the release check command from the CLI", () => {
    const home = mkdtempSync(join(tmpdir(), "agentforge-home-"));
    const result = spawnSync("pnpm", ["exec", "tsx", "packages/cli/src/bin.ts", "release", "check"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: home
      }
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Target scope: @h9-foundry");
    expect(result.stdout).toContain("[fail] npm auth file");
  }, 40000);
});
