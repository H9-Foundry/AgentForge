import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lifecycleArtifactSchema, schemaFixtures } from "@h9-foundry/agentforge-schemas";

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

  it("approval-gates supported plugin activation and denies unsupported activation", () => {
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

    expect(
      engine.evaluatePluginActivation(
        "local-review",
        { tier: "verified", source: "local", reviewed: true },
        { activationSupport: "approval-required", approvalGranted: false }
      )
    ).toEqual({
      allowed: true,
      effect: "approval_required",
      requiresApproval: true,
      reason: "Plugin activation requires approval for local-review"
    });

    expect(
      engine.evaluatePluginActivation(
        "local-review",
        { tier: "verified", source: "local", reviewed: true },
        { activationSupport: "approval-required", approvalGranted: true }
      )
    ).toEqual({
      allowed: true,
      effect: "allow",
      requiresApproval: false
    });

    expect(
      engine.evaluatePluginActivation(
        "local-review",
        { tier: "verified", source: "local", reviewed: true },
        { activationSupport: "not-supported", approvalGranted: true }
      )
    ).toEqual({
      allowed: false,
      effect: "deny",
      requiresApproval: false,
      reason: "Plugin activation is not supported for local-review"
    });
  });

  it("denies plugin activation when compatibility checks fail", () => {
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

    expect(
      engine.evaluatePluginActivation(
        "local-review",
        { tier: "verified", source: "local", reviewed: true },
        {
          activationSupport: "approval-required",
          approvalGranted: true,
          compatibilityIssues: [{ message: "AgentForge 0.8.0 does not satisfy >=0.9.0" }]
        }
      )
    ).toEqual({
      allowed: false,
      effect: "deny",
      requiresApproval: false,
      reason: "Plugin compatibility check failed for local-review: AgentForge 0.8.0 does not satisfy >=0.9.0"
    });
  });

  it("sanitizes lifecycle artifact summaries and nested payload strings", () => {
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

    const planningArtifact = lifecycleArtifactSchema.parse(JSON.parse(JSON.stringify(schemaFixtures.planningArtifact)));
    expect(planningArtifact.artifactKind).toBe("planning-brief");
    if (planningArtifact.artifactKind !== "planning-brief") {
      throw new Error("Expected planning artifact fixture");
    }

    const sanitized = engine.sanitizeLifecycleArtifact({
      ...planningArtifact,
      summary: "summary token=ghp_1234567890ABCDE",
      payload: {
        ...planningArtifact.payload,
        assumptions: ["password=hunter2"],
        recommendedNextSteps: ["Call Bearer sk-abcdef123456"]
      }
    });

    expect(sanitized.summary).toContain("[REDACTED_TOKEN]");
    expect(sanitized.artifactKind).toBe("planning-brief");
    if (sanitized.artifactKind !== "planning-brief") {
      throw new Error("Expected sanitized planning artifact");
    }
    expect(sanitized.payload.assumptions[0]).toContain("[REDACTED_PASSWORD]");
    expect(sanitized.payload.recommendedNextSteps[0]).toContain("[REDACTED_API_KEY]");
    expect(sanitized.payload.linkedIssues).toEqual(planningArtifact.payload.linkedIssues);
  });

  it("marks security-report artifacts as security-sensitive during sanitization", () => {
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

    const securityArtifact = lifecycleArtifactSchema.parse(JSON.parse(JSON.stringify(schemaFixtures.securityArtifact)));
    expect(securityArtifact.artifactKind).toBe("security-report");
    if (securityArtifact.artifactKind !== "security-report") {
      throw new Error("Expected security artifact fixture");
    }

    const sanitized = engine.sanitizeLifecycleArtifact({
      ...securityArtifact,
      summary: "summary token=ghp_1234567890ABCDE"
    });

    expect(sanitized.summary).toContain("[REDACTED_TOKEN]");
    expect(sanitized.artifactKind).toBe("security-report");
    if (sanitized.artifactKind !== "security-report") {
      throw new Error("Expected sanitized security artifact");
    }
    expect(sanitized.redaction.categories).toContain("security-sensitive");
  });

  it("marks incident-brief artifacts as operational-sensitive during sanitization", () => {
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

    const incidentArtifact = lifecycleArtifactSchema.parse(JSON.parse(JSON.stringify(schemaFixtures.incidentArtifact)));
    expect(incidentArtifact.artifactKind).toBe("incident-brief");
    if (incidentArtifact.artifactKind !== "incident-brief") {
      throw new Error("Expected incident artifact fixture");
    }

    const sanitized = engine.sanitizeLifecycleArtifact({
      ...incidentArtifact,
      redaction: {
        ...incidentArtifact.redaction,
        categories: ["github-token"]
      },
      summary: "summary token=ghp_1234567890ABCDE"
    });

    expect(sanitized.summary).toContain("[REDACTED_TOKEN]");
    expect(sanitized.artifactKind).toBe("incident-brief");
    if (sanitized.artifactKind !== "incident-brief") {
      throw new Error("Expected sanitized incident artifact");
    }
    expect(sanitized.redaction.categories).toContain("operational-sensitive");
  });
});
