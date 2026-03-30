import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

import { describe, expect, it } from "vitest";

import { EXPECTED_PUBLIC_PACKAGES } from "./index.js";

function runCommand(args: string[]): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("pnpm", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (status) => {
      resolve({
        status: status ?? 1,
        stdout,
        stderr
      });
    });
  });
}

describe("release verification", () => {
  it("verifies packed public packages from a clean-room install", async () => {
    const result = await runCommand([
      "exec",
      "tsx",
      "--eval",
      "import { verifyReleaseArtifacts } from './packages/cli/src/index.ts'; console.log(JSON.stringify(verifyReleaseArtifacts(process.cwd()), null, 2));"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ready: boolean;
      tarballs: Array<{ tarballPath: string }>;
      checks: Array<{ status: string }>;
    };

    expect(result.status).toBe(0);
    expect(parsed.ready).toBe(true);
    expect(parsed.tarballs).toHaveLength(EXPECTED_PUBLIC_PACKAGES.length);
    expect(parsed.tarballs.every((entry) => existsSync(entry.tarballPath))).toBe(true);
    expect(parsed.checks.every((check) => check.status === "pass")).toBe(true);
    expect(parsed.checks.some((check) => check.id === "global-cli-install" && check.status === "pass")).toBe(true);
    expect(parsed.checks.some((check) => check.id === "global-cli-help" && check.status === "pass")).toBe(true);
    expect(parsed.checks.some((check) => check.id === "global-cli-visualizer-help" && check.status === "pass")).toBe(true);
  }, 180000);

  it("exposes the release verify command from the CLI", async () => {
    const result = await runCommand(["exec", "tsx", "packages/cli/src/bin.ts", "release", "verify", "--json"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"ready": true');
    expect(result.stdout).toContain("@h9-foundry/agentforge-cli");
  }, 180000);
});
