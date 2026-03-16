import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createPolicyEngine, loadPolicyDocument, resolvePolicy } from "./index.js";

describe("policy engine", () => {
  it("loads yaml policy files and resolves overlays", () => {
    const root = mkdtempSync(join(tmpdir(), "agentops-policy-"));
    const policyPath = join(root, "policy.yaml");

    writeFileSync(
      policyPath,
      [
        "version: 1",
        "defaults:",
        "  execution_mode: inspect",
        "  model_access: false",
        "  network: deny",
        "  writes: approval_required",
        "paths:",
        "  allowed_read:",
        "    - '**/*'",
        "  allowed_write:",
        "    - '.agentops/runs/**'",
        "  blocked:",
        "    - '.env*'",
        "plugins:",
        "  allowed_tiers:",
        "    - core",
        "    - verified",
        "  allowed_sources:",
        "    - official",
        "    - local",
        "  require_reviewed: true",
        "tools:",
        "  filesystem.read-file:",
        "    effect: allow",
        "overlays:",
        "  ci:",
        "    defaults:",
        "      network: deny"
      ].join("\n")
    );

    const resolved = resolvePolicy(loadPolicyDocument(policyPath), "ci");
    expect(resolved.environment).toBe("ci");
    expect(resolved.defaults.network).toBe("deny");
  });

  it("blocks blocked paths and approval-gates writes", () => {
    const engine = createPolicyEngine(
      {
        version: 1,
        environment: "local",
        resolvedAt: new Date().toISOString(),
        defaults: {
          executionMode: "inspect",
          modelAccess: false,
          network: "deny",
          writes: "approval_required"
        },
        paths: {
          allowedRead: ["**/*"],
          allowedWrite: [".agentops/runs/**", "tests/**"],
          blocked: [".env*", "secrets/**"]
        },
        plugins: {
          allowedTiers: ["core", "verified"],
          allowedSources: ["official", "local"],
          requireReviewed: true
        },
        tools: {
          "filesystem.read-file": { effect: "allow" },
          "filesystem.write-file": { effect: "approval_required" }
        }
      },
      "/repo"
    );

    expect(engine.canReadPath("/repo/.env").allowed).toBe(false);
    expect(engine.canWritePath("/repo/tests/example.test.ts").requiresApproval).toBe(true);
  });

  it("denies paths outside the repo root and redacts common secrets", () => {
    const engine = createPolicyEngine(
      {
        version: 1,
        environment: "local",
        resolvedAt: new Date().toISOString(),
        defaults: {
          executionMode: "inspect",
          modelAccess: false,
          network: "deny",
          writes: "approval_required"
        },
        paths: {
          allowedRead: ["**/*"],
          allowedWrite: [".agentops/runs/**", "tests/**"],
          blocked: [".env*", "secrets/**"]
        },
        plugins: {
          allowedTiers: ["core", "verified"],
          allowedSources: ["official", "local"],
          requireReviewed: true
        },
        tools: {
          "filesystem.read-file": { effect: "allow" }
        }
      },
      "/repo"
    );

    expect(engine.canReadPath("../secrets.txt").allowed).toBe(false);
    expect(engine.redactSecrets("token=ghp_1234567890ABCDE password=hunter2 Bearer sk-abcdef123456")).toContain("[REDACTED");
  });

  it("enforces plugin trust tiers, sources, and review state", () => {
    const engine = createPolicyEngine(
      {
        version: 1,
        environment: "local",
        resolvedAt: new Date().toISOString(),
        defaults: {
          executionMode: "inspect",
          modelAccess: false,
          network: "deny",
          writes: "approval_required"
        },
        paths: {
          allowedRead: ["**/*"],
          allowedWrite: [".agentops/runs/**", "tests/**"],
          blocked: [".env*", "secrets/**"]
        },
        plugins: {
          allowedTiers: ["core", "verified"],
          allowedSources: ["official", "local"],
          requireReviewed: true
        },
        tools: {
          "filesystem.read-file": { effect: "allow" }
        }
      },
      "/repo"
    );

    expect(engine.evaluatePluginTrust("verified-plugin", { tier: "verified", source: "local", reviewed: true }).allowed).toBe(true);
    expect(engine.evaluatePluginTrust("community-plugin", { tier: "community", source: "local", reviewed: true }).allowed).toBe(false);
    expect(engine.evaluatePluginTrust("remote-plugin", { tier: "verified", source: "third-party", reviewed: true }).allowed).toBe(false);
    expect(engine.evaluatePluginTrust("unreviewed-plugin", { tier: "verified", source: "local", reviewed: false }).allowed).toBe(false);
  });
});
