import { describe, expect, it } from "vitest";

import {
  agentManifestSchema,
  auditBundleSchema,
  getJsonSchemas,
  policyDocumentSchema,
  schemaFixtures,
  workflowDefinitionSchema
} from "./index.js";

describe("schema fixtures", () => {
  it("validates the bundled fixtures", () => {
    expect(() => agentManifestSchema.parse(schemaFixtures.agentManifest)).not.toThrow();
    expect(() => policyDocumentSchema.parse(schemaFixtures.policyDocument)).not.toThrow();
    expect(() => workflowDefinitionSchema.parse(schemaFixtures.workflowDefinition)).not.toThrow();
  });

  it("rejects invalid manifests", () => {
    expect(() =>
      agentManifestSchema.parse({
        version: 1,
        name: "broken"
      })
    ).toThrow();
  });

  it("exports JSON schema snapshots", () => {
    const jsonSchemas = getJsonSchemas();

    expect(jsonSchemas.agentManifest).toBeDefined();
    expect(jsonSchemas.workflowDefinition).toBeDefined();
  });

  it("validates audit bundle metadata", () => {
    expect(() =>
      auditBundleSchema.parse({
        version: "1.0.0",
        runId: "run-1",
        workflow: "pr-review",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: "success",
        policy: {
          version: 1,
          environment: "local",
          resolvedAt: new Date().toISOString(),
          defaults: schemaFixtures.policyDocument.defaults,
          paths: schemaFixtures.policyDocument.paths,
          plugins: schemaFixtures.policyDocument.plugins,
          tools: schemaFixtures.policyDocument.tools
        },
        entries: [],
        findings: [],
        proposedActions: [],
        blockedPlugins: [],
        artifactPaths: {
          json: ".agentops/runs/run-1/bundle.json",
          markdown: ".agentops/runs/run-1/summary.md"
        },
        provenance: {
          generatedBy: "agentforge-runtime",
          schemaVersion: "1.0.0",
          executionEnvironment: "local",
          repoRoot: "/repo"
        },
        redaction: {
          applied: true,
          strategyVersion: "1.0.0",
          categories: ["github-token"]
        },
        components: [
          {
            kind: "agent",
            name: "code-review",
            version: "0.1.0",
            trust: {
              tier: "core",
              source: "official",
              reviewed: true
            },
            permissions: ["model", "filesystem.read-file"]
          }
        ]
      })
    ).not.toThrow();
  });
});
