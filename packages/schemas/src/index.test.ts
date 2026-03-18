import { describe, expect, it } from "vitest";

import {
  agentManifestSchema,
  auditBundleSchema,
  designArtifactSchema,
  designRequestSchema,
  githubActionsEvidenceNormalizationSchema,
  githubActionsEvidenceSchema,
  githubHandoffSummarySchema,
  githubReferenceSchema,
  githubWorkflowStatusMappingSchema,
  getJsonSchemas,
  implementationArtifactSchema,
  implementationInventorySchema,
  implementationRequestSchema,
  incidentArtifactSchema,
  incidentRequestSchema,
  lifecycleArtifactEnvelopeSchema,
  maintenanceArtifactSchema,
  normalizedValidationCommandSchema,
  policyDocumentSchema,
  qaArtifactSchema,
  qaEvidenceNormalizationSchema,
  qaRequestSchema,
  releaseEvidenceNormalizationSchema,
  releaseRequestSchema,
  securityArtifactSchema,
  securityEvidenceNormalizationSchema,
  securityRequestSchema,
  planningRequestSchema,
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
    expect(() => planningRequestSchema.parse(schemaFixtures.planningRequest)).not.toThrow();
    expect(() => designRequestSchema.parse(schemaFixtures.designRequest)).not.toThrow();
    expect(() => implementationRequestSchema.parse(schemaFixtures.implementationRequest)).not.toThrow();
    expect(() => incidentRequestSchema.parse(schemaFixtures.incidentRequest)).not.toThrow();
    expect(() => qaRequestSchema.parse(schemaFixtures.qaRequest)).not.toThrow();
    expect(() => securityRequestSchema.parse(schemaFixtures.securityRequest)).not.toThrow();
    expect(() => releaseRequestSchema.parse(schemaFixtures.releaseRequest)).not.toThrow();
    expect(() => githubReferenceSchema.parse(schemaFixtures.githubReference)).not.toThrow();
    expect(() => githubActionsEvidenceSchema.parse(schemaFixtures.githubActionsEvidence)).not.toThrow();
    expect(() =>
      githubActionsEvidenceNormalizationSchema.parse(schemaFixtures.qaEvidenceNormalization.githubActions)
    ).not.toThrow();
    expect(() => githubHandoffSummarySchema.parse(schemaFixtures.githubHandoffSummary)).not.toThrow();
    expect(() => githubWorkflowStatusMappingSchema.parse(schemaFixtures.githubWorkflowStatusMapping)).not.toThrow();
    expect(() => normalizedValidationCommandSchema.parse(schemaFixtures.normalizedValidationCommand)).not.toThrow();
    expect(() => implementationInventorySchema.parse(schemaFixtures.implementationInventory)).not.toThrow();
    expect(() => incidentArtifactSchema.parse(schemaFixtures.incidentArtifact)).not.toThrow();
    expect(() => qaEvidenceNormalizationSchema.parse(schemaFixtures.qaEvidenceNormalization)).not.toThrow();
    expect(() => securityEvidenceNormalizationSchema.parse(schemaFixtures.securityEvidenceNormalization)).not.toThrow();
    expect(() => releaseEvidenceNormalizationSchema.parse(schemaFixtures.releaseEvidenceNormalization)).not.toThrow();
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
    expect(jsonSchemas.planningRequest).toBeDefined();
    expect(jsonSchemas.designRequest).toBeDefined();
    expect(jsonSchemas.implementationRequest).toBeDefined();
    expect(jsonSchemas.incidentRequest).toBeDefined();
    expect(jsonSchemas.qaRequest).toBeDefined();
    expect(jsonSchemas.securityRequest).toBeDefined();
    expect(jsonSchemas.releaseRequest).toBeDefined();
    expect(jsonSchemas.githubReference).toBeDefined();
    expect(jsonSchemas.githubActionsEvidence).toBeDefined();
    expect(jsonSchemas.githubActionsEvidenceNormalization).toBeDefined();
    expect(jsonSchemas.githubHandoffSummary).toBeDefined();
    expect(jsonSchemas.githubWorkflowStatusMapping).toBeDefined();
    expect(jsonSchemas.normalizedValidationCommand).toBeDefined();
    expect(jsonSchemas.implementationInventory).toBeDefined();
    expect(jsonSchemas.qaEvidenceNormalization).toBeDefined();
    expect(jsonSchemas.securityEvidenceNormalization).toBeDefined();
    expect(jsonSchemas.releaseEvidenceNormalization).toBeDefined();
    expect(jsonSchemas.lifecycleArtifactEnvelope).toBeDefined();
    expect(jsonSchemas.planningArtifact).toBeDefined();
    expect(jsonSchemas.designArtifact).toBeDefined();
    expect(jsonSchemas.implementationArtifact).toBeDefined();
    expect(jsonSchemas.incidentArtifact).toBeDefined();
    expect(jsonSchemas.qaArtifact).toBeDefined();
    expect(jsonSchemas.securityArtifact).toBeDefined();
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
        lifecycleArtifacts: [schemaFixtures.planningArtifact],
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
    expect(() => planningArtifactSchema.parse(schemaFixtures.planningArtifact)).not.toThrow();
    expect(() => designArtifactSchema.parse(schemaFixtures.designArtifact)).not.toThrow();
    expect(() => implementationArtifactSchema.parse(schemaFixtures.implementationArtifact)).not.toThrow();
    expect(() => qaArtifactSchema.parse(schemaFixtures.qaArtifact)).not.toThrow();
    expect(() => securityArtifactSchema.parse(schemaFixtures.securityArtifact)).not.toThrow();
    expect(() => reviewArtifactSchema.parse(schemaFixtures.reviewArtifact)).not.toThrow();
    expect(() => releaseArtifactSchema.parse(schemaFixtures.releaseArtifact)).not.toThrow();
    expect(() => maintenanceArtifactSchema.parse(schemaFixtures.maintenanceArtifact)).not.toThrow();
  });

  it("rejects mismatched lifecycle artifact family payloads", () => {
    expect(() => lifecycleArtifactEnvelopeSchema.parse(schemaFixtures.invalidLifecycleArtifactEnvelope)).toThrow();
    expect(() => planningArtifactSchema.parse(schemaFixtures.invalidPlanningArtifact)).toThrow();
    expect(() => reviewArtifactSchema.parse(schemaFixtures.invalidReviewArtifact)).toThrow();
  });
});
