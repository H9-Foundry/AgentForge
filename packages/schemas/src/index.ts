import { z } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";

export const schemaVersion = "1.0.0";

export const severitySchema = z.enum(["info", "low", "medium", "high", "critical"]);
export const sideEffectClassSchema = z.enum(["observe", "suggest", "apply-low-risk", "apply-high-risk"]);
export const permissionEffectSchema = z.enum(["allow", "deny", "approval_required"]);
export const executionModeSchema = z.enum(["inspect", "suggest", "apply"]);
export const nodeKindSchema = z.enum(["deterministic", "reasoning", "report"]);
export const triggerSchema = z.enum(["manual", "pull_request", "ci"]);
export const toolResultStatusSchema = z.enum(["success", "blocked", "failed"]);
export const runStatusSchema = z.enum(["success", "partial", "failed"]);
export const trustTierSchema = z.enum(["core", "verified", "community", "untrusted"]);
export const trustSourceSchema = z.enum(["official", "local", "third-party"]);
export const lifecycleArtifactKindSchema = z.enum([
  "planning-brief",
  "design-record",
  "implementation-proposal",
  "qa-report",
  "review-report",
  "release-report",
  "maintenance-report"
]);
export const lifecycleDomainSchema = z.enum(["plan", "design", "build", "test", "review", "release", "maintain"]);
export const lifecycleArtifactSourceTypeSchema = z.enum(["workflow-run", "manual-input", "imported"]);
export const lifecycleArtifactStatusSchema = z.enum(["draft", "complete", "superseded", "cancelled"]);
export const catalogDomainSchema = z.enum([
  "foundation",
  "plan",
  "design",
  "build",
  "review",
  "test",
  "security",
  "release",
  "operate",
  "maintain"
]);
export const supportLevelSchema = z.enum(["official", "partial", "planned", "internal"]);
export const maturitySchema = z.enum(["concept", "prototype", "mvp", "expanding", "stable"]);
export const trustScopeSchema = z.enum([
  "core-only",
  "official-core-only",
  "official-reviewed-only",
  "official-and-reviewed-local",
  "review-required-third-party"
]);

export const catalogMetadataSchema = z.object({
  domain: catalogDomainSchema,
  supportLevel: supportLevelSchema,
  maturity: maturitySchema,
  trustScope: trustScopeSchema
});

export const trustMetadataSchema = z.object({
  tier: trustTierSchema.default("core"),
  source: trustSourceSchema.default("official"),
  reviewed: z.boolean().default(true)
});

export const agentPluginRegistrationSchema = z.object({
  name: z.string().min(1),
  package: z.string().min(1),
  enabled: z.boolean().default(true)
});

export const blockedPluginSchema = z.object({
  name: z.string().min(1),
  package: z.string().min(1),
  reason: z.string().min(1),
  trust: trustMetadataSchema.optional()
});

export const agentforgeConfigSchema = z.object({
  version: z.number().int().positive(),
  project: z.object({
    name: z.string().min(1),
    language: z.string().min(1)
  }),
  runtime: z.object({
    mode: executionModeSchema.default("inspect"),
    runsPath: z.string().min(1).default(".agentops/runs")
  }),
  providers: z
    .object({
      default: z.string().min(1).default("disabled")
    })
    .default({ default: "disabled" }),
  reporting: z
    .object({
      github: z
        .object({
          trackerIssue: z.number().int().positive().optional()
        })
        .optional()
    })
    .default({}),
  plugins: z
    .object({
      agents: z.array(agentPluginRegistrationSchema).default([])
    })
    .default({ agents: [] })
});

export const findingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  severity: severitySchema,
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
  location: z.string().optional(),
  tags: z.array(z.string()).default([])
});

export const proposedActionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  sideEffectClass: sideEffectClassSchema,
  targetPaths: z.array(z.string()).default([]),
  approvalRequired: z.boolean().default(true)
});

export const toolRequestSchema = z.object({
  tool: z.string().min(1),
  input: z.unknown(),
  justification: z.string().min(1).optional(),
  requestedBy: z.string().min(1),
  requestedAt: z.string().datetime()
});

export const toolResultSchema = z.object({
  tool: z.string().min(1),
  status: toolResultStatusSchema,
  sideEffectClass: sideEffectClassSchema,
  output: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number().min(0),
  blockedReason: z.string().optional()
});

export const approvalCheckpointSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected"]),
  reason: z.string().optional()
});

export const auditEntrySchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  nodeName: z.string().min(1),
  kind: nodeKindSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: z.enum(["success", "failed", "blocked"]),
  model: z.string().optional(),
  summary: z.string().min(1),
  toolsRequested: z.array(toolRequestSchema).default([]),
  toolsExecuted: z.array(toolResultSchema).default([]),
  blockedActions: z.array(z.string()).default([]),
  validationPassed: z.boolean()
});

export const agentOutputSchema = z.object({
  summary: z.string().min(1),
  findings: z.array(findingSchema).default([]),
  proposedActions: z.array(proposedActionSchema).default([]),
  lifecycleArtifacts: z.array(z.lazy(() => lifecycleArtifactSchema)).default([]),
  requestedTools: z.array(toolRequestSchema).default([]),
  blockedActionFlags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const agentManifestSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().min(1),
  displayName: z.string().min(1),
  category: z.string().min(1),
  runtime: z.object({
    minVersion: z.string().min(1),
    kind: z.enum(["deterministic", "reasoning"])
  }),
  permissions: z.object({
    model: z.boolean(),
    network: z.boolean(),
    tools: z.array(z.string()).default([]),
    readPaths: z.array(z.string()).default([]),
    writePaths: z.array(z.string()).default([])
  }),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  contextPolicy: z.object({
    sections: z.array(z.string()).default([]),
    minimalContext: z.boolean().default(true)
  }),
  catalog: catalogMetadataSchema.optional(),
  trust: trustMetadataSchema.default({
    tier: "core",
    source: "official",
    reviewed: true
  })
});

export const toolPolicySchema = z.object({
  effect: permissionEffectSchema,
  allowedCommands: z.array(z.string()).optional(),
  allowedPaths: z.array(z.string()).optional(),
  allowedHosts: z.array(z.string()).optional()
});

const policyDefaultsShape = {
  executionMode: executionModeSchema.default("inspect"),
  modelAccess: z.boolean().default(false),
  network: permissionEffectSchema.default("deny"),
  writes: permissionEffectSchema.default("approval_required")
} as const;

const policyPathsShape = {
  allowedRead: z.array(z.string()).default(["**/*"]),
  allowedWrite: z.array(z.string()).default([".agentops/runs/**"]),
  blocked: z.array(z.string()).default([".env*", "secrets/**"])
} as const;

const policyPluginShape = {
  allowedTiers: z.array(trustTierSchema).default(["core", "verified"]),
  allowedSources: z.array(trustSourceSchema).default(["official", "local"]),
  requireReviewed: z.boolean().default(true)
} as const;

export const effectivePolicySnapshotSchema = z.object({
  version: z.number().int().positive(),
  environment: z.enum(["local", "ci"]),
  resolvedAt: z.string().datetime(),
  defaults: z.object(policyDefaultsShape),
  paths: z.object(policyPathsShape),
  plugins: z.object(policyPluginShape),
  tools: z.record(z.string(), toolPolicySchema).default({})
});

export const policyDocumentSchema = z.object({
  version: z.number().int().positive(),
  defaults: z.object(policyDefaultsShape),
  paths: z.object(policyPathsShape),
  plugins: z.object(policyPluginShape),
  tools: z.record(z.string(), toolPolicySchema).default({}),
  overlays: z
    .object({
      local: z
        .object({
          defaults: z.object(policyDefaultsShape).partial().optional(),
          paths: z.object(policyPathsShape).partial().optional(),
          plugins: z.object(policyPluginShape).partial().optional(),
          tools: z.record(z.string(), toolPolicySchema).optional()
        })
        .optional(),
      ci: z
        .object({
          defaults: z.object(policyDefaultsShape).partial().optional(),
          paths: z.object(policyPathsShape).partial().optional(),
          plugins: z.object(policyPluginShape).partial().optional(),
          tools: z.record(z.string(), toolPolicySchema).optional()
        })
        .optional()
    })
    .default({})
});

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  kind: nodeKindSchema,
  agent: z.string().min(1).optional(),
  outputsTo: z.string().min(1),
  contextSections: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([])
});

export const workflowDefinitionSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: triggerSchema.default("manual"),
  catalog: catalogMetadataSchema.optional(),
  nodes: z.array(workflowNodeSchema).min(1)
});

export const planningRequestSchema = z.object({
  problemStatement: z.string().min(1),
  goals: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([]),
  issueRefs: z.array(z.string().min(1)).default([]),
  pathHints: z.array(z.string().min(1)).default([]),
  assumptions: z.array(z.string().min(1)).default([])
});

export const designRequestSchema = z.object({
  planningBriefRef: z.string().min(1),
  decisionTarget: z.string().min(1),
  constraints: z.array(z.string().min(1)).default([]),
  pathHints: z.array(z.string().min(1)).default([]),
  alternatives: z.array(z.string().min(1)).default([]),
  questions: z.array(z.string().min(1)).default([])
});

export const implementationRequestSchema = z.object({
  designRecordRef: z.string().min(1),
  implementationGoal: z.string().min(1),
  targetPaths: z.array(z.string().min(1)).default([]),
  validationCommands: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([]),
  approvalMode: z.enum(["proposal-only", "apply-capable"])
});

export const qaRequestSchema = z.object({
  targetRef: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  executedChecks: z.array(z.string().min(1)).default([]),
  focusAreas: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([]),
  releaseContext: z.enum(["none", "candidate", "blocking"]).default("none")
});

export const normalizedValidationCommandSchema = z.object({
  command: z.string().min(1),
  source: z.enum(["request", "package-script", "workspace-script"]),
  classification: z.enum(["allow", "approval_required", "deny"]),
  reason: z.string().min(1)
});

export const implementationInventorySchema = z.object({
  requestedTargetPaths: z.array(z.string().min(1)).default([]),
  resolvedAffectedPaths: z.array(z.string().min(1)).default([]),
  affectedPackages: z.array(z.string().min(1)).default([]),
  entrypoints: z.array(z.string().min(1)).default([]),
  schemaSurfaces: z.array(z.string().min(1)).default([]),
  policySurfaces: z.array(z.string().min(1)).default([]),
  discoveredValidationCommands: z.array(normalizedValidationCommandSchema).default([])
});

export const repoMetadataSchema = z.object({
  root: z.string().min(1),
  name: z.string().min(1),
  branch: z.string().default("unknown"),
  packageManager: z.string().default("unknown"),
  languages: z.array(z.string()).default([]),
  ci: z.boolean().default(false),
  provider: z.string().optional(),
  detectedFiles: z.array(z.string()).default([])
});

export const changeFileSchema = z.object({
  path: z.string().min(1),
  status: z.string().min(1),
  insertions: z.number().min(0).default(0),
  deletions: z.number().min(0).default(0)
});

export const changeContextSchema = z.object({
  changedFiles: z.array(z.string()).default([]),
  stagedFiles: z.array(z.string()).default([]),
  untrackedFiles: z.array(z.string()).default([]),
  impactedPaths: z.array(z.string()).default([]),
  diffStats: z.object({
    filesChanged: z.number().min(0),
    insertions: z.number().min(0),
    deletions: z.number().min(0)
  }),
  fileDetails: z.array(changeFileSchema).default([])
});

export const workflowExecutionContextSchema = z.object({
  localExecution: z.boolean(),
  ciExecution: z.boolean(),
  trigger: triggerSchema,
  timestamp: z.string().datetime()
});

export const workflowStateEnvelopeSchema = z.object({
  version: z.string().min(1),
  runId: z.string().min(1),
  workflow: z.string().min(1),
  mode: executionModeSchema,
  repo: repoMetadataSchema,
  changes: changeContextSchema,
  context: workflowExecutionContextSchema,
  policy: effectivePolicySnapshotSchema,
  approvals: z.array(approvalCheckpointSchema).default([]),
  findings: z.array(findingSchema).default([]),
  proposedActions: z.array(proposedActionSchema).default([]),
  lifecycleArtifacts: z.array(z.lazy(() => lifecycleArtifactSchema)).default([]),
  blockedPlugins: z.array(blockedPluginSchema).default([]),
  workflowInputs: z.record(z.string(), z.unknown()).default({}),
  agentResults: z.record(z.string(), agentOutputSchema).default({}),
  auditTrail: z.array(auditEntrySchema).default([])
});

export const auditComponentSchema = z.object({
  kind: z.enum(["agent", "adapter", "provider"]),
  name: z.string().min(1),
  version: z.string().min(1).default("workspace"),
  trust: trustMetadataSchema,
  permissions: z.array(z.string()).default([])
});

export const auditProvenanceSchema = z.object({
  generatedBy: z.string().min(1),
  schemaVersion: z.string().min(1),
  executionEnvironment: z.enum(["local", "ci"]),
  repoRoot: z.string().min(1)
});

export const auditRedactionSchema = z.object({
  applied: z.boolean(),
  strategyVersion: z.string().min(1),
  categories: z.array(z.string()).default([])
});

export const lifecycleArtifactWorkflowReferenceSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1).optional()
});

export const lifecycleArtifactSourceReferenceSchema = z.object({
  sourceType: lifecycleArtifactSourceTypeSchema,
  runId: z.string().min(1).optional(),
  inputRefs: z.array(z.string()).default([]),
  issueRefs: z.array(z.string()).default([])
});

export const lifecycleArtifactRepoReferenceSchema = z.object({
  root: z.string().min(1),
  name: z.string().min(1),
  branch: z.string().default("unknown"),
  commitSha: z.string().min(1).optional()
});

export const lifecycleArtifactAuditLinkSchema = z.object({
  bundlePath: z.string().min(1).optional(),
  entryIds: z.array(z.string()).default([]),
  findingIds: z.array(z.string()).default([]),
  proposedActionIds: z.array(z.string()).default([])
});

export const lifecycleArtifactEnvelopeSchema = z.object({
  schemaVersion: z.string().min(1),
  artifactKind: lifecycleArtifactKindSchema,
  lifecycleDomain: lifecycleDomainSchema,
  workflow: lifecycleArtifactWorkflowReferenceSchema,
  source: lifecycleArtifactSourceReferenceSchema,
  status: lifecycleArtifactStatusSchema,
  generatedAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  repo: lifecycleArtifactRepoReferenceSchema,
  provenance: auditProvenanceSchema,
  redaction: auditRedactionSchema,
  auditLink: lifecycleArtifactAuditLinkSchema,
  summary: z.string().min(1),
  payload: z.record(z.string(), z.unknown())
});

export const planningArtifactPayloadSchema = z.object({
  problemStatement: z.string().min(1),
  objectives: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string().min(1)).default([]),
  assumptions: z.array(z.string().min(1)).default([]),
  inScope: z.array(z.string().min(1)).default([]),
  outOfScope: z.array(z.string().min(1)).default([]),
  recommendedNextSteps: z.array(z.string().min(1)).min(1),
  stakeholders: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  openQuestions: z.array(z.string().min(1)).default([]),
  candidateWorkstreams: z.array(z.string().min(1)).default([]),
  linkedIssues: z.array(z.string().min(1)).default([])
});

export const designArtifactOptionSchema = z.object({
  option: z.string().min(1),
  summary: z.string().min(1)
});

export const designArtifactPayloadSchema = z.object({
  decisionSummary: z.string().min(1),
  context: z.string().min(1),
  optionsConsidered: z.array(designArtifactOptionSchema).min(1),
  chosenApproach: z.string().min(1),
  tradeOffs: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  followUpWork: z.array(z.string().min(1)).default([]),
  interfacesImpacted: z.array(z.string().min(1)).default([]),
  schemaChangesNeeded: z.array(z.string().min(1)).default([]),
  policyChangesNeeded: z.array(z.string().min(1)).default([]),
  migrationNotes: z.array(z.string().min(1)).default([]),
  compatibilityNotes: z.array(z.string().min(1)).default([])
});

export const reviewArtifactPayloadSchema = z.object({
  findings: z.array(findingSchema).default([]),
  recommendations: z.array(z.string().min(1)).default([]),
  riskLevel: severitySchema,
  coverageNotes: z.array(z.string().min(1)).default([]),
  blockedItems: z.array(z.string().min(1)).default([]),
  testGaps: z.array(z.string().min(1)).default([]),
  securityConcerns: z.array(z.string().min(1)).default([]),
  approvalRecommendations: z.array(z.string().min(1)).default([])
});

export const qaArtifactPayloadSchema = z.object({
  targetRef: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  executedChecks: z.array(z.string().min(1)).default([]),
  findings: z.array(findingSchema).default([]),
  coverageGaps: z.array(z.string().min(1)).default([]),
  recommendedNextChecks: z.array(z.string().min(1)).default([]),
  releaseImpact: z.string().min(1)
});

export const implementationArtifactPayloadSchema = z.object({
  designRecordRef: z.string().min(1),
  implementationGoal: z.string().min(1),
  affectedPaths: z.array(z.string().min(1)).default([]),
  proposedChanges: z.array(z.string().min(1)).default([]),
  validationPlan: z.array(z.string().min(1)).default([]),
  approvalRequiredSteps: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  openQuestions: z.array(z.string().min(1)).default([])
});

export const releaseVerificationCheckSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["passed", "failed", "skipped"]),
  detail: z.string().min(1).optional()
});

export const releaseVersionTargetSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1)
});

export const releaseArtifactPayloadSchema = z.object({
  releaseScope: z.string().min(1),
  versionTargets: z.array(releaseVersionTargetSchema).min(1),
  readinessStatus: z.enum(["ready", "blocked", "partial"]),
  verificationChecks: z.array(releaseVerificationCheckSchema).default([]),
  publishingPlan: z.array(z.string().min(1)).default([]),
  trustStatus: z.string().min(1),
  publishedPackages: z.array(z.string().min(1)).default([]),
  tagRefs: z.array(z.string().min(1)).default([]),
  provenanceRefs: z.array(z.string().min(1)).default([]),
  rollbackNotes: z.array(z.string().min(1)).default([]),
  externalDependencies: z.array(z.string().min(1)).default([])
});

export const maintenanceArtifactPayloadSchema = z.object({
  maintenanceScope: z.string().min(1),
  currentFindings: z.array(z.string().min(1)).default([]),
  recommendedActions: z.array(z.string().min(1)).default([]),
  priorityAssessment: z.string().min(1),
  dependencyUpdates: z.array(z.string().min(1)).default([]),
  docsUpdates: z.array(z.string().min(1)).default([]),
  stalenessSignals: z.array(z.string().min(1)).default([]),
  followUpIssues: z.array(z.string().min(1)).default([])
});

export const planningArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("planning-brief"),
  lifecycleDomain: z.literal("plan"),
  payload: planningArtifactPayloadSchema
});

export const designArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("design-record"),
  lifecycleDomain: z.literal("design"),
  payload: designArtifactPayloadSchema
});

export const implementationArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("implementation-proposal"),
  lifecycleDomain: z.literal("build"),
  payload: implementationArtifactPayloadSchema
});

export const qaArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("qa-report"),
  lifecycleDomain: z.literal("test"),
  payload: qaArtifactPayloadSchema
});

export const reviewArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("review-report"),
  lifecycleDomain: z.literal("review"),
  payload: reviewArtifactPayloadSchema
});

export const releaseArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("release-report"),
  lifecycleDomain: z.literal("release"),
  payload: releaseArtifactPayloadSchema
});

export const maintenanceArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("maintenance-report"),
  lifecycleDomain: z.literal("maintain"),
  payload: maintenanceArtifactPayloadSchema
});

export const lifecycleArtifactSchema = z.discriminatedUnion("artifactKind", [
  planningArtifactSchema,
  designArtifactSchema,
  implementationArtifactSchema,
  qaArtifactSchema,
  reviewArtifactSchema,
  releaseArtifactSchema,
  maintenanceArtifactSchema
]);

export const auditBundleSchema = z.object({
  version: z.string().min(1),
  runId: z.string().min(1),
  workflow: z.string().min(1),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  status: runStatusSchema,
  policy: effectivePolicySnapshotSchema,
  entries: z.array(auditEntrySchema).default([]),
  findings: z.array(findingSchema).default([]),
  proposedActions: z.array(proposedActionSchema).default([]),
  blockedPlugins: z.array(blockedPluginSchema).default([]),
  lifecycleArtifacts: z.array(lifecycleArtifactSchema).default([]),
  artifactPaths: z.object({
    json: z.string().min(1),
    markdown: z.string().min(1)
  }),
  provenance: auditProvenanceSchema,
  redaction: auditRedactionSchema,
  components: z.array(auditComponentSchema).default([])
});

export const schemaRegistry = {
  finding: findingSchema,
  blockedPlugin: blockedPluginSchema,
  proposedAction: proposedActionSchema,
  toolRequest: toolRequestSchema,
  toolResult: toolResultSchema,
  approvalCheckpoint: approvalCheckpointSchema,
  auditEntry: auditEntrySchema,
  auditComponent: auditComponentSchema,
  auditProvenance: auditProvenanceSchema,
  auditRedaction: auditRedactionSchema,
  lifecycleArtifactWorkflowReference: lifecycleArtifactWorkflowReferenceSchema,
  lifecycleArtifactSourceReference: lifecycleArtifactSourceReferenceSchema,
  lifecycleArtifactRepoReference: lifecycleArtifactRepoReferenceSchema,
  lifecycleArtifactAuditLink: lifecycleArtifactAuditLinkSchema,
  lifecycleArtifactEnvelope: lifecycleArtifactEnvelopeSchema,
  catalogMetadata: catalogMetadataSchema,
  planningArtifactPayload: planningArtifactPayloadSchema,
  designArtifactOption: designArtifactOptionSchema,
  designArtifactPayload: designArtifactPayloadSchema,
  implementationArtifactPayload: implementationArtifactPayloadSchema,
  qaArtifactPayload: qaArtifactPayloadSchema,
  reviewArtifactPayload: reviewArtifactPayloadSchema,
  releaseVerificationCheck: releaseVerificationCheckSchema,
  releaseVersionTarget: releaseVersionTargetSchema,
  releaseArtifactPayload: releaseArtifactPayloadSchema,
  maintenanceArtifactPayload: maintenanceArtifactPayloadSchema,
  planningArtifact: planningArtifactSchema,
  designArtifact: designArtifactSchema,
  implementationArtifact: implementationArtifactSchema,
  qaArtifact: qaArtifactSchema,
  reviewArtifact: reviewArtifactSchema,
  releaseArtifact: releaseArtifactSchema,
  maintenanceArtifact: maintenanceArtifactSchema,
  lifecycleArtifact: lifecycleArtifactSchema,
  agentOutput: agentOutputSchema,
  agentManifest: agentManifestSchema,
  agentPluginRegistration: agentPluginRegistrationSchema,
  agentforgeConfig: agentforgeConfigSchema,
  planningRequest: planningRequestSchema,
  designRequest: designRequestSchema,
  implementationRequest: implementationRequestSchema,
  qaRequest: qaRequestSchema,
  normalizedValidationCommand: normalizedValidationCommandSchema,
  implementationInventory: implementationInventorySchema,
  policyDocument: policyDocumentSchema,
  effectivePolicySnapshot: effectivePolicySnapshotSchema,
  workflowDefinition: workflowDefinitionSchema,
  workflowStateEnvelope: workflowStateEnvelopeSchema,
  auditBundle: auditBundleSchema
} as const;

export function validateWithSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

export function getJsonSchemas(): Record<string, object> {
  return Object.fromEntries(
    Object.entries(schemaRegistry).map(([name, schema]) => [name, zodToJsonSchema(schema, name)])
  );
}

const lifecycleArtifactFixtureBase = {
  schemaVersion: "1.0.0",
  workflow: {
    name: "planning-discovery",
    displayName: "Planning And Discovery"
  },
  source: {
    sourceType: "workflow-run",
    runId: "run-123",
    inputRefs: ["docs/ROADMAP.md"],
    issueRefs: ["#78"]
  },
  status: "complete",
  generatedAt: "2026-03-17T12:00:00.000Z",
  updatedAt: "2026-03-17T12:00:00.000Z",
  repo: {
    root: "/repo",
    name: "AgentForge",
    branch: "main",
    commitSha: "abc123"
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
    categories: ["secrets"]
  },
  auditLink: {
    bundlePath: ".agentops/runs/run-123/bundle.json",
    entryIds: ["plan-collector"],
    findingIds: [],
    proposedActionIds: []
  }
} as const;

const planningArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "planning-brief",
  lifecycleDomain: "plan",
  summary: "Initial planning brief generated for queue item #78.",
  payload: {
    problemStatement: "Define the next planning workflow slice.",
    objectives: ["Create a safe planning wedge"],
    constraints: ["Keep the current wedge honest"],
    assumptions: ["CLI remains the primary entry point"],
    inScope: ["Planning artifact design"],
    outOfScope: ["Runtime implementation"],
    recommendedNextSteps: ["Draft workflow spec", "Open child implementation issues"],
    linkedIssues: ["#78"]
  }
} as const;

const designArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "design-record",
  lifecycleDomain: "design",
  summary: "Design record for workflow-scoped lifecycle artifacts.",
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
} as const;

const implementationArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "implementation-proposal",
  lifecycleDomain: "build",
  summary: "Implementation proposal for the next bounded workflow slice.",
  payload: {
    designRecordRef: ".agentops/runs/run-456/bundle.json",
    implementationGoal: "Prepare the next bounded implementation proposal",
    affectedPaths: ["packages/cli", "packages/runtime"],
    proposedChanges: [
      "Add the implementation planner starter agent.",
      "Emit an implementation-proposal artifact through the runtime."
    ],
    validationPlan: ["Review requested validation commands before execution."],
    approvalRequiredSteps: [
      "Any future patch application requires explicit approval.",
      "Any future build or validation execution requires approval after allowlist review."
    ],
    risks: ["Affected repository surfaces may widen once deterministic inventory lands."],
    openQuestions: ["Which validation commands should become allowlisted in the next slice?"]
  }
} as const;

const qaArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "qa-report",
  lifecycleDomain: "test",
  summary: "QA report for the bounded implementation proposal handoff.",
  payload: {
    targetRef: ".agentops/runs/run-789/bundle.json",
    evidenceSources: [".agentops/runs/run-789/summary.md"],
    executedChecks: ["pnpm test"],
    findings: [
      {
        id: "qa-finding-1",
        title: "Coverage evidence still needs review",
        summary: "The bounded QA handoff references validation output, but coverage evidence still needs interpretation.",
        severity: "medium",
        rationale: "The MVP QA workflow is read-only and request-driven, so it cannot infer full coverage status without normalized evidence.",
        confidence: 0.82,
        location: ".agentops/requests/qa.yaml",
        tags: ["qa", "coverage"]
      }
    ],
    coverageGaps: ["Coverage evidence was referenced but not normalized into a deterministic summary."],
    recommendedNextChecks: ["Review the referenced validation output before promotion.", "Confirm release-risk expectations with the owning maintainer."],
    releaseImpact: "candidate release requires QA follow-up before promotion."
  }
} as const;

const reviewArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "review-report",
  lifecycleDomain: "review",
  summary: "Review report for the initial lifecycle artifact contracts.",
  payload: {
    findings: [
      {
        id: "finding-1",
        title: "Suspicious write attempt",
        summary: "The workflow proposed a write outside approved paths.",
        severity: "high",
        rationale: "Blocked paths and policy do not permit this target.",
        confidence: 0.91,
        location: "src/index.ts",
        tags: ["policy", "write"]
      }
    ],
    recommendations: ["Address the blocked-path concern"],
    riskLevel: "medium",
    coverageNotes: ["Static review only"]
  }
} as const;

const releaseArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "release-report",
  lifecycleDomain: "release",
  summary: "Release readiness report for the lifecycle artifact schema work.",
  payload: {
    releaseScope: "Patch release for schema contracts",
    versionTargets: [{ name: "@h9-foundry/agentforge-schemas", version: "0.4.1" }],
    readinessStatus: "ready",
    verificationChecks: [{ name: "release-verify", status: "passed" }],
    publishingPlan: ["Merge version PR", "Let GitHub Actions publish"],
    trustStatus: "trusted-publishing-configured"
  }
} as const;

const maintenanceArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "maintenance-report",
  lifecycleDomain: "maintain",
  summary: "Maintenance report for documentation and dependency hygiene.",
  payload: {
    maintenanceScope: "Docs and dependency hygiene",
    currentFindings: ["README needs clearer first-run guidance"],
    recommendedActions: ["Rewrite quickstart", "Refresh sample repo docs"],
    priorityAssessment: "high",
    dependencyUpdates: ["vitest@4.1.0"],
    docsUpdates: ["docs/quickstart.md"],
    stalenessSignals: ["example repo path is source-centric"],
    followUpIssues: ["#98", "#100"]
  }
} as const;

const invalidLifecycleArtifactEnvelopeFixture = {
  ...planningArtifactFixture,
  artifactKind: "incident-report",
  summary: ""
} as const;

const invalidPlanningArtifactFixture = {
  ...planningArtifactFixture,
  payload: {
    decisionSummary: "This is not a planning payload."
  }
} as const;

const invalidReviewArtifactFixture = {
  ...reviewArtifactFixture,
  lifecycleDomain: "release"
} as const;

const implementationRequestFixture = {
  designRecordRef: ".agentops/runs/run-456/bundle.json",
  implementationGoal: "Prepare a bounded implementation proposal for the next workflow wedge.",
  targetPaths: ["packages/cli", "packages/runtime"],
  validationCommands: ["pnpm test", "pnpm typecheck"],
  constraints: ["Keep the default path read-only"],
  approvalMode: "proposal-only"
} as const;

const qaRequestFixture = {
  targetRef: ".agentops/runs/run-789/bundle.json",
  evidenceSources: [".agentops/runs/run-789/summary.md"],
  executedChecks: ["pnpm test -- --runInBand"],
  focusAreas: ["coverage", "release-risk"],
  constraints: ["Keep QA evidence collection read-only"],
  releaseContext: "candidate"
} as const;

const normalizedValidationCommandFixture = {
  command: "pnpm test",
  source: "request",
  classification: "approval_required",
  reason: "Requested command matches a discovered allowlisted validation script."
} as const;

const implementationInventoryFixture = {
  requestedTargetPaths: ["packages/cli", "packages/runtime"],
  resolvedAffectedPaths: ["packages/cli/src/index.ts", "packages/runtime/src/index.ts"],
  affectedPackages: ["packages/cli", "packages/runtime"],
  entrypoints: ["packages/cli/src/index.ts", "packages/runtime/src/index.ts"],
  schemaSurfaces: ["packages/schemas/src/index.ts"],
  policySurfaces: ["packages/policy-engine/src/index.ts"],
  discoveredValidationCommands: [
    normalizedValidationCommandFixture,
    {
      command: "pnpm release:publish",
      source: "package-script",
      classification: "deny",
      reason: "Command is not in the bounded allowlist for implementation validation."
    }
  ]
} as const;

export const schemaFixtures = {
  finding: {
    id: "finding-1",
    title: "Suspicious write attempt",
    summary: "The workflow proposed a write outside approved paths.",
    severity: "high",
    rationale: "Blocked paths and policy do not permit this target.",
    confidence: 0.91,
    location: "src/index.ts",
    tags: ["policy", "write"]
  },
  agentManifest: {
    version: 1,
    name: "code-review",
    displayName: "Code Review",
    category: "review",
    runtime: { minVersion: "0.1.0", kind: "reasoning" },
    permissions: {
      model: true,
      network: false,
      tools: ["filesystem.read-file"],
      readPaths: ["src/**", "tests/**"],
      writePaths: []
    },
    inputs: ["changes", "repo"],
    outputs: ["findings", "proposedActions"],
    contextPolicy: {
      sections: ["repo", "changes"],
      minimalContext: true
    },
    catalog: {
      domain: "review",
      supportLevel: "official",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  },
  policyDocument: {
    version: 1,
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
    },
    overlays: {
      ci: {
        defaults: {
          network: "deny"
        }
      }
    }
  },
  workflowDefinition: {
    version: 1,
    name: "pr-review",
    catalog: {
      domain: "review",
      supportLevel: "official",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trigger: "manual",
    nodes: [
      { id: "context", kind: "deterministic", agent: "context-collector", outputsTo: "agentResults.context" },
      { id: "review", kind: "reasoning", agent: "code-review", outputsTo: "agentResults.review" },
      { id: "report", kind: "report", outputsTo: "reports.final" }
    ]
  },
  planningRequest: {
    problemStatement: "Define the first planning-discovery workflow wedge.",
    goals: ["Produce one planning brief artifact"],
    constraints: ["Keep the workflow local-first and read-only"],
    issueRefs: ["#127", "#128"],
    pathHints: ["packages/cli", "packages/runtime", "docs/PLANNING_DISCOVERY_WORKFLOW.md"],
    assumptions: ["CLI-first execution remains the evaluator path"]
  },
  designRequest: {
    planningBriefRef: ".agentops/runs/run-123/bundle.json",
    decisionTarget: "Choose the first planning workflow implementation shape.",
    constraints: ["Keep deterministic intake validation before reasoning"],
    pathHints: ["packages/schemas", "packages/runtime", "packages/cli"],
    alternatives: ["single-agent workflow", "deterministic intake plus reasoning"],
    questions: ["How should planning artifacts be referenced downstream?"]
  },
  implementationRequest: implementationRequestFixture,
  qaRequest: qaRequestFixture,
  normalizedValidationCommand: normalizedValidationCommandFixture,
  implementationInventory: implementationInventoryFixture,
  lifecycleArtifactEnvelope: planningArtifactFixture,
  planningArtifact: planningArtifactFixture,
  designArtifact: designArtifactFixture,
  implementationArtifact: implementationArtifactFixture,
  qaArtifact: qaArtifactFixture,
  reviewArtifact: reviewArtifactFixture,
  releaseArtifact: releaseArtifactFixture,
  maintenanceArtifact: maintenanceArtifactFixture,
  invalidLifecycleArtifactEnvelope: invalidLifecycleArtifactEnvelopeFixture,
  invalidPlanningArtifact: invalidPlanningArtifactFixture,
  invalidReviewArtifact: invalidReviewArtifactFixture
} as const;
