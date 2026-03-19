import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { schemaFixtures } from "@h9-foundry/agentforge-schemas";
import { afterEach, describe, expect, it } from "vitest";

import { RegistryClient } from "./index.js";

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
});
