import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { registryPluginCatalogEntrySchema, schemaFixtures } from "@h9-foundry/agentforge-schemas";
import { afterEach, describe, expect, it } from "vitest";

import type { RegistryPluginCatalogEntry } from "@h9-foundry/agentforge-shared-types";
import { RegistryClient } from "./index.js";

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createCatalogEntryFixture(): RegistryPluginCatalogEntry {
  return registryPluginCatalogEntrySchema.parse(JSON.parse(JSON.stringify(schemaFixtures.registryPluginCatalogEntry)));
}

function createRepoFixture(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), "agentforge-registry-client-"));
  mkdirSync(join(repoRoot, "packages", "cli"), { recursive: true });
  writeJson(join(repoRoot, "package.json"), { name: "agentforge", version: "0.1.0", private: true });
  writeJson(join(repoRoot, "packages", "cli", "package.json"), {
    name: "@h9-foundry/agentforge-cli",
    version: "0.8.0"
  });

  return repoRoot;
}

describe("RegistryClient read-only catalog discovery", () => {
  const repoRoots: string[] = [];

  afterEach(() => {
    while (repoRoots.length > 0) {
      rmSync(repoRoots.pop()!, { recursive: true, force: true });
    }
  });

  it("loads and validates an explicit catalog file", () => {
    const repoRoot = createRepoFixture();
    repoRoots.push(repoRoot);
    const catalogPath = join(repoRoot, "catalog.json");
    writeJson(catalogPath, schemaFixtures.registryPluginCatalog);

    const client = new RegistryClient(repoRoot);
    const catalog = client.loadCatalogFromFile("catalog.json");

    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0]?.id).toBe("local-review");
  });

  it("returns only compatible entries by default", () => {
    const repoRoot = createRepoFixture();
    repoRoots.push(repoRoot);
    const client = new RegistryClient(repoRoot);

    const results = client.discoverCatalogEntries(schemaFixtures.registryPluginCatalog, {
      workflowDomain: "review",
      pluginType: "agent"
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.compatible).toBe(true);
    expect(results[0]?.issues).toEqual([]);
  });

  it("can include incompatible entries with explicit reasons", () => {
    const repoRoot = createRepoFixture();
    repoRoots.push(repoRoot);
    const client = new RegistryClient(repoRoot);

    const results = client.discoverCatalogEntries(schemaFixtures.registryPluginCatalog, {
      workflowDomain: "security",
      includeIncompatible: true
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.compatible).toBe(false);
    expect(results[0]?.issues).toEqual([
      {
        code: "workflow_domain_not_supported",
        message: "Plugin does not declare support for the security workflow domain"
      }
    ]);
  });

  it("reports unsupported AgentForge version syntax conservatively", () => {
    const repoRoot = createRepoFixture();
    repoRoots.push(repoRoot);
    const client = new RegistryClient(repoRoot);
    const catalog = {
      ...schemaFixtures.registryPluginCatalog,
      entries: [
        {
          ...schemaFixtures.registryPluginCatalog.entries[0],
          compatibility: {
            ...schemaFixtures.registryPluginCatalog.entries[0]!.compatibility,
            agentforgeVersionRange: ">=0.8.0 <1.0.0"
          }
        }
      ]
    };

    const results = client.discoverCatalogEntries(catalog, { includeIncompatible: true });

    expect(results).toHaveLength(1);
    expect(results[0]?.compatible).toBe(false);
    expect(results[0]?.issues[0]).toEqual({
      code: "agentforge_version_range_unsupported",
      message: "Unsupported AgentForge version range syntax: >=0.8.0 <1.0.0"
    });
  });

  it("uses the local CLI package version when no explicit version override is provided", () => {
    const repoRoot = createRepoFixture();
    repoRoots.push(repoRoot);
    const client = new RegistryClient(repoRoot);

    const results = client.discoverCatalogEntries(schemaFixtures.registryPluginCatalog);

    expect(results).toHaveLength(1);
    expect(results[0]?.compatible).toBe(true);
  });

  it("derives consumer trust signals for manual and verified-distribution catalog entries", () => {
    const repoRoot = createRepoFixture();
    repoRoots.push(repoRoot);
    const client = new RegistryClient(repoRoot);

    const manualSummary = client.summarizeCatalogEntryTrust(createCatalogEntryFixture());
    const verifiedSummary = client.summarizeCatalogEntryTrust(
      registryPluginCatalogEntrySchema.parse(JSON.parse(JSON.stringify(schemaFixtures.verifiedRegistryPluginCatalogEntry)))
    );

    expect(manualSummary.status).toBe("local-manual");
    expect(manualSummary.consumerSignals).toEqual(
      expect.arrayContaining([
        expect.stringContaining("manual-only"),
        expect.stringContaining("Activation remains approval-gated")
      ])
    );
    expect(verifiedSummary.status).toBe("verification-present");
    expect(verifiedSummary.consumerSignals).toEqual(
      expect.arrayContaining([
        expect.stringContaining("attestation verification support"),
        expect.stringContaining("Verification evidence refs")
      ])
    );
  });

  it("prepares approval-gated activation decisions with audit-ready output", () => {
    const repoRoot = createRepoFixture();
    repoRoots.push(repoRoot);
    const client = new RegistryClient(repoRoot);

    const decision = client.prepareCatalogAgentActivation(
      createCatalogEntryFixture(),
      {
        evaluatePluginActivation: (_name, _trust, options) => ({
          allowed: true,
          effect: options.approvalGranted ? "allow" : "approval_required",
          requiresApproval: !options.approvalGranted,
          reason: options.approvalGranted ? undefined : "Plugin activation requires approval for Local Review Plugin"
        })
      },
      { approvalGranted: false, workflowDomain: "review" }
    );

    expect(decision.activated).toBe(false);
    expect(decision.trustSummary.status).toBe("local-manual");
    expect(decision.policyDecision.effect).toBe("approval_required");
    expect(decision.auditEntry.status).toBe("blocked");
    expect(decision.auditEntry.blockedActions).toEqual(["Plugin activation requires approval for Local Review Plugin"]);
  });

  it("loads the local agent only when activation is approved", async () => {
    const client = new RegistryClient("/Users/ethan/Repo/AgentOps");
    const { decision, agent } = await client.activateCatalogAgentPlugin(
      {
        ...createCatalogEntryFixture(),
        distribution: {
          ...createCatalogEntryFixture().distribution,
          packageName: "@h9-foundry/agentforge-agent-code-review"
        }
      },
      {
        evaluatePluginActivation: () => ({
          allowed: true,
          effect: "allow",
          requiresApproval: false
        })
      },
      { approvalGranted: true, workflowDomain: "review", agentforgeVersion: "0.8.0" }
    );

    expect(decision.activated).toBe(true);
    expect(agent?.manifest.name).toBe("code-review");
  });

  it("returns no agent when activation is denied by compatibility or policy", async () => {
    const repoRoot = createRepoFixture();
    repoRoots.push(repoRoot);
    const client = new RegistryClient(repoRoot);

    const { decision, agent } = await client.activateCatalogAgentPlugin(
      createCatalogEntryFixture(),
      {
        evaluatePluginActivation: () => ({
          allowed: false,
          effect: "deny",
          requiresApproval: false,
          reason: "Plugin compatibility check failed for Local Review Plugin"
        })
      },
      { approvalGranted: true, workflowDomain: "review", agentforgeVersion: "0.8.0" }
    );

    expect(decision.activated).toBe(false);
    expect(agent).toBeUndefined();
    expect(decision.auditEntry.status).toBe("blocked");
  });
});
