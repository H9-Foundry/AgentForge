import { describe, expect, it } from "vitest";

import {
  agentManifestSchema,
  auditBundleSchema,
  designArtifactSchema,
  getJsonSchemas,
  lifecycleArtifactEnvelopeSchema,
  maintenanceArtifactSchema,
  policyDocumentSchema,
  planningArtifactSchema,
  releaseArtifactSchema,
  reviewArtifactSchema,
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
    expect(jsonSchemas.lifecycleArtifactEnvelope).toBeDefined();
    expect(jsonSchemas.planningArtifact).toBeDefined();
    expect(jsonSchemas.designArtifact).toBeDefined();
    expect(jsonSchemas.reviewArtifact).toBeDefined();
    expect(jsonSchemas.releaseArtifact).toBeDefined();
    expect(jsonSchemas.maintenanceArtifact).toBeDefined();
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

  it("validates the shared lifecycle artifact envelope fixture", () => {
    expect(() =>
      lifecycleArtifactEnvelopeSchema.parse(schemaFixtures.lifecycleArtifactEnvelope)
    ).not.toThrow();
  });

  it("rejects invalid lifecycle artifact envelopes", () => {
    expect(() =>
      lifecycleArtifactEnvelopeSchema.parse({
        ...schemaFixtures.lifecycleArtifactEnvelope,
        artifactKind: "incident-report"
      })
    ).toThrow();

    expect(() =>
      lifecycleArtifactEnvelopeSchema.parse({
        ...schemaFixtures.lifecycleArtifactEnvelope,
        summary: ""
      })
    ).toThrow();
  });

  it("validates the initial lifecycle artifact family schemas", () => {
    const baseArtifact = {
      ...schemaFixtures.lifecycleArtifactEnvelope,
      source: {
        ...schemaFixtures.lifecycleArtifactEnvelope.source,
        issueRefs: ["#90"]
      }
    };

    expect(() =>
      planningArtifactSchema.parse({
        ...baseArtifact,
        artifactKind: "planning-brief",
        lifecycleDomain: "plan",
        payload: {
          problemStatement: "Define the next planning workflow slice.",
          objectives: ["Create a safe planning wedge"],
          constraints: ["Keep the current wedge honest"],
          assumptions: ["CLI remains the primary entry point"],
          inScope: ["Planning artifact design"],
          outOfScope: ["Runtime implementation"],
          recommendedNextSteps: ["Draft MVP", "Open follow-up implementation issues"],
          linkedIssues: ["#78"]
        }
      })
    ).not.toThrow();

    expect(() =>
      designArtifactSchema.parse({
        ...baseArtifact,
        artifactKind: "design-record",
        lifecycleDomain: "design",
        payload: {
          decisionSummary: "Use workflow-scoped design artifacts.",
          context: "The platform needs structured design outputs.",
          optionsConsidered: [
            { option: "artifact-first", summary: "Add explicit design artifacts." },
            { option: "audit-only", summary: "Reuse only the audit bundle." }
          ],
          chosenApproach: "artifact-first",
          tradeOffs: ["More schema surface to maintain"],
          risks: ["Design records could drift from implementation"],
          followUpWork: ["Implement runtime emission later"]
        }
      })
    ).not.toThrow();

    expect(() =>
      reviewArtifactSchema.parse({
        ...baseArtifact,
        artifactKind: "review-report",
        lifecycleDomain: "review",
        payload: {
          findings: [schemaFixtures.finding],
          recommendations: ["Address the blocked-path concern"],
          riskLevel: "medium",
          coverageNotes: ["Static review only"]
        }
      })
    ).not.toThrow();

    expect(() =>
      releaseArtifactSchema.parse({
        ...baseArtifact,
        artifactKind: "release-report",
        lifecycleDomain: "release",
        payload: {
          releaseScope: "Patch release for schema contracts",
          versionTargets: [{ name: "@h9-foundry/agentforge-schemas", version: "0.4.1" }],
          readinessStatus: "ready",
          verificationChecks: [{ name: "release-verify", status: "passed" }],
          publishingPlan: ["Merge version PR", "Let GitHub Actions publish"],
          trustStatus: "trusted-publishing-configured"
        }
      })
    ).not.toThrow();

    expect(() =>
      maintenanceArtifactSchema.parse({
        ...baseArtifact,
        artifactKind: "maintenance-report",
        lifecycleDomain: "maintain",
        payload: {
          maintenanceScope: "Docs and dependency hygiene",
          currentFindings: ["README needs clearer first-run guidance"],
          recommendedActions: ["Rewrite quickstart", "Refresh sample repo docs"],
          priorityAssessment: "high"
        }
      })
    ).not.toThrow();
  });

  it("rejects mismatched lifecycle artifact family payloads", () => {
    expect(() =>
      planningArtifactSchema.parse({
        ...schemaFixtures.lifecycleArtifactEnvelope,
        artifactKind: "planning-brief",
        lifecycleDomain: "plan",
        payload: {
          decisionSummary: "This is not a planning payload."
        }
      })
    ).toThrow();

    expect(() =>
      reviewArtifactSchema.parse({
        ...schemaFixtures.lifecycleArtifactEnvelope,
        artifactKind: "review-report",
        lifecycleDomain: "release",
        payload: {
          findings: [],
          recommendations: [],
          riskLevel: "low",
          coverageNotes: []
        }
      })
    ).toThrow();
  });
});
