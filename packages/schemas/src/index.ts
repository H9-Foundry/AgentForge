import { z, type ZodTypeAny } from "zod/v3";
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
export const registryPluginTypeSchema = z.enum(["agent", "adapter", "workflow"]);
export const registryDistributionChannelSchema = z.enum(["manual", "npm"]);
export const registryInstallSupportSchema = z.enum(["manual-only", "not-supported"]);
export const registryActivationSupportSchema = z.enum(["not-supported", "approval-required"]);
export const registryDistributionVerificationModeSchema = z.enum(["none", "checksum", "attestation"]);
export const lifecycleArtifactKindSchema = z.enum([
  "planning-brief",
  "design-record",
  "implementation-proposal",
  "incident-brief",
  "pipeline-report",
  "qa-report",
  "security-report",
  "eval-result",
  "benchmark-summary",
  "review-report",
  "release-report",
  "deployment-gate-report",
  "promotion-approval-report",
  "maintenance-report"
]);
export const lifecycleDomainSchema = z.enum(["plan", "design", "build", "test", "security", "evaluate", "review", "release", "operate", "maintain"]);
export const lifecycleArtifactSourceTypeSchema = z.enum(["workflow-run", "manual-input", "imported"]);
export const lifecycleArtifactStatusSchema = z.enum(["draft", "complete", "superseded", "cancelled"]);
export const githubReferenceKindSchema = z.enum(["issue", "pull_request"]);
export const githubWorkflowStatusSchema = z.enum(["planned", "in_progress", "blocked", "completed", "failed"]);
export const githubActionsRunStatusSchema = z.enum(["queued", "in_progress", "completed"]);
export const githubActionsConclusionSchema = z.enum([
  "success",
  "failure",
  "neutral",
  "cancelled",
  "skipped",
  "timed_out",
  "action_required",
  "stale"
]);
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
export const evalRepoFixtureSchema = z.enum(["agentforge-monorepo", "blank-local"]);
export const evalWorkflowSchema = z.enum([
  "pr-review",
  "planning-discovery",
  "architecture-design-review",
  "implementation-proposal",
  "qa-review",
  "security-review",
  "maintenance-triage"
]);
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

export const registryPluginCompatibilitySchema = z.object({
  agentforgeVersionRange: z.string().min(1),
  manifestVersion: z.number().int().positive().default(1),
  supportedWorkflowDomains: z.array(catalogDomainSchema).default([])
});

export const registryPluginDistributionSchema = z.object({
  channel: registryDistributionChannelSchema,
  packageName: z.string().min(1),
  version: z.string().min(1),
  reference: z.string().min(1),
  installSupport: registryInstallSupportSchema.default("manual-only"),
  activationSupport: registryActivationSupportSchema.default("not-supported"),
  verificationMode: registryDistributionVerificationModeSchema.default("none"),
  verificationEvidenceRefs: z.array(z.string().min(1)).default([])
});

export const registryPluginCatalogEntrySchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  pluginType: registryPluginTypeSchema,
  description: z.string().min(1).optional(),
  catalog: catalogMetadataSchema,
  trust: trustMetadataSchema,
  compatibility: registryPluginCompatibilitySchema,
  distribution: registryPluginDistributionSchema
});

export const registryPluginCatalogSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string().datetime().optional(),
  entries: z.array(registryPluginCatalogEntrySchema).default([])
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

export const securityRequestSchema = z.object({
  targetRef: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  focusAreas: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([]),
  releaseContext: z.enum(["none", "candidate", "blocking"]).default("none")
});

export const pipelineRequestSchema = z.object({
  pipelineScope: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  qaReportRefs: z.array(z.string().min(1)).default([]),
  securityReportRefs: z.array(z.string().min(1)).default([]),
  releaseReportRefs: z.array(z.string().min(1)).default([]),
  issueRefs: z.array(z.string().min(1)).default([]),
  focusAreas: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([])
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

export const githubActionsJobEvidenceSchema = z.object({
  name: z.string().min(1),
  status: githubActionsRunStatusSchema,
  conclusion: githubActionsConclusionSchema.optional(),
  htmlUrl: z.string().url().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional()
});

export const githubActionsCheckRunEvidenceSchema = z.object({
  name: z.string().min(1),
  status: githubActionsRunStatusSchema,
  conclusion: githubActionsConclusionSchema.optional(),
  detailsUrl: z.string().url().optional()
});

export const githubActionsEvidenceSchema = z.object({
  sourcePath: z.string().min(1).optional(),
  repository: z.string().min(1),
  workflowName: z.string().min(1),
  workflowRunId: z.number().int().positive(),
  runAttempt: z.number().int().positive().default(1),
  event: z.string().min(1).optional(),
  headBranch: z.string().min(1).optional(),
  headSha: z.string().min(1).optional(),
  status: githubActionsRunStatusSchema,
  conclusion: githubActionsConclusionSchema.optional(),
  htmlUrl: z.string().url(),
  jobs: z.array(githubActionsJobEvidenceSchema).default([]),
  checkRuns: z.array(githubActionsCheckRunEvidenceSchema).default([])
});

export const githubActionsEvidenceNormalizationSchema = z.object({
  evidence: z.array(githubActionsEvidenceSchema).default([]),
  workflowNames: z.array(z.string().min(1)).default([]),
  failingChecks: z.array(z.string().min(1)).default([]),
  provenanceRefs: z.array(z.string().min(1)).default([])
});

export const scmPlatformSchema = z.enum(["github", "gitlab", "generic"]);
export const scmReferenceKindSchema = z.enum(["issue", "pull_request", "merge_request", "commit", "branch"]);
export const ciPlatformSchema = z.enum(["github-actions", "gitlab-ci", "buildkite", "jenkins-ci", "generic-ci"]);

export const scmReferenceSchema = z.object({
  platform: scmPlatformSchema,
  host: z.string().min(1),
  namespace: z.string().min(1),
  repo: z.string().min(1),
  kind: scmReferenceKindSchema,
  identifier: z.string().min(1),
  number: z.number().int().positive().optional(),
  canonical: z.string().min(1),
  url: z.string().url().optional(),
  source: z.string().min(1)
});

export const ciJobEvidenceSchema = z.object({
  name: z.string().min(1),
  status: githubActionsRunStatusSchema,
  conclusion: githubActionsConclusionSchema.optional(),
  htmlUrl: z.string().url().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional()
});

export const ciArtifactEvidenceSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  htmlUrl: z.string().url().optional()
});

export const ciEvidenceSchema = z.object({
  platform: ciPlatformSchema,
  providerName: z.string().min(1).optional(),
  host: z.string().min(1),
  repository: z.string().min(1),
  pipelineName: z.string().min(1),
  pipelineRunId: z.string().min(1),
  runAttempt: z.number().int().positive().default(1),
  event: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  commitSha: z.string().min(1).optional(),
  status: githubActionsRunStatusSchema,
  conclusion: githubActionsConclusionSchema.optional(),
  htmlUrl: z.string().url().optional(),
  jobs: z.array(ciJobEvidenceSchema).default([]),
  artifacts: z.array(ciArtifactEvidenceSchema).default([]),
  provenanceSource: z.enum(["local-export", "adapter-read"]).default("local-export")
});

export const gitlabCiJobExportStatusSchema = z.enum(["pending", "running", "success", "failed", "canceled", "skipped"]);

export const gitlabCiJobEvidenceExportSchema = z.object({
  name: z.string().min(1),
  status: gitlabCiJobExportStatusSchema,
  webUrl: z.string().url().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional()
});

export const gitlabCiEvidenceExportSchema = z.object({
  sourcePath: z.string().min(1).optional(),
  host: z.string().min(1).default("gitlab.com"),
  projectPath: z.string().min(1),
  pipelineId: z.number().int().positive(),
  pipelineName: z.string().min(1).default("GitLab CI"),
  runAttempt: z.number().int().positive().default(1),
  event: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  commitSha: z.string().min(1).optional(),
  status: gitlabCiJobExportStatusSchema,
  webUrl: z.string().url().optional(),
  jobs: z.array(gitlabCiJobEvidenceExportSchema).default([])
});

export const buildkiteCiEvidenceExportSchema = z.object({
  sourcePath: z.string().min(1).optional(),
  providerName: z.literal("Buildkite"),
  host: z.string().min(1).default("buildkite.com"),
  repository: z.string().min(1),
  pipelineName: z.string().min(1).default("Buildkite"),
  pipelineRunId: z.string().min(1),
  runAttempt: z.number().int().positive().default(1),
  event: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  commitSha: z.string().min(1).optional(),
  status: githubActionsRunStatusSchema,
  conclusion: githubActionsConclusionSchema.optional(),
  htmlUrl: z.string().url().optional(),
  jobs: z.array(ciJobEvidenceSchema).default([]),
  artifacts: z.array(ciArtifactEvidenceSchema).default([])
});

export const jenkinsCiEvidenceExportSchema = z.object({
  sourcePath: z.string().min(1).optional(),
  providerName: z.literal("Jenkins"),
  host: z.string().min(1).default("jenkins.local"),
  repository: z.string().min(1),
  pipelineName: z.string().min(1).default("Jenkins CI"),
  pipelineRunId: z.string().min(1),
  runAttempt: z.number().int().positive().default(1),
  event: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  commitSha: z.string().min(1).optional(),
  status: githubActionsRunStatusSchema,
  conclusion: githubActionsConclusionSchema.optional(),
  htmlUrl: z.string().url().optional(),
  jobs: z.array(ciJobEvidenceSchema).default([]),
  artifacts: z.array(ciArtifactEvidenceSchema).default([])
});

export const genericCiEvidenceExportSchema = z.object({
  sourcePath: z.string().min(1).optional(),
  providerName: z.string().min(1),
  host: z.string().min(1).default("local"),
  repository: z.string().min(1),
  pipelineName: z.string().min(1),
  pipelineRunId: z.string().min(1),
  runAttempt: z.number().int().positive().default(1),
  event: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  commitSha: z.string().min(1).optional(),
  status: githubActionsRunStatusSchema,
  conclusion: githubActionsConclusionSchema.optional(),
  htmlUrl: z.string().url().optional(),
  jobs: z.array(ciJobEvidenceSchema).default([]),
  artifacts: z.array(ciArtifactEvidenceSchema).default([])
});

export const dependencyManifestSectionSchema = z.enum([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
]);

export const dependencyInventoryEntrySchema = z.object({
  manifestPath: z.string().min(1),
  packageName: z.string().min(1),
  dependencyName: z.string().min(1),
  dependencyType: dependencyManifestSectionSchema,
  requestedVersion: z.string().min(1)
});

export const dependencyIntegrityStatusSchema = z.enum([
  "verified-lockfile",
  "manifest-only",
  "missing-lockfile"
]);

export const dependencyIntegrityEvidenceSchema = z.object({
  inventoryFormat: z.literal("workspace-inventory"),
  packageManager: z.string().min(1),
  integrityStatus: dependencyIntegrityStatusSchema,
  lockfilePath: z.string().min(1).optional(),
  manifestPaths: z.array(z.string().min(1)).default([]),
  packageNames: z.array(z.string().min(1)).default([]),
  packageCount: z.number().int().min(0),
  dependencyEntryCount: z.number().int().min(0),
  inventoryEntries: z.array(dependencyInventoryEntrySchema).default([]),
  provenanceSource: z.enum(["workspace-scan", "local-export"]).default("workspace-scan"),
  provenanceRefs: z.array(z.string().min(1)).default([])
});

export const attestationVerificationEvidenceSchema = z.object({
  sourcePath: z.string().min(1).optional(),
  verifier: z.enum(["github-artifact-attestation", "npm-provenance", "local-verifier"]),
  subject: z.string().min(1),
  issuer: z.string().min(1),
  status: z.enum(["verified", "failed", "skipped"]),
  detail: z.string().min(1),
  predicateType: z.string().min(1).optional(),
  verifiedAt: z.string().datetime().optional(),
  provenanceRefs: z.array(z.string().min(1)).default([])
});

export const adapterCapabilityKindSchema = z.enum([
  "issue-reference-normalization",
  "pull-request-reference-normalization",
  "merge-request-reference-normalization",
  "local-ci-evidence-ingestion",
  "remote-scm-read",
  "remote-ci-read",
  "comment-write",
  "status-write"
]);

export const adapterCapabilityMetadataSchema = z.object({
  platform: scmPlatformSchema,
  host: z.string().min(1),
  supportedScmReferenceKinds: z.array(scmReferenceKindSchema).default([]),
  supportedCiPlatforms: z.array(ciPlatformSchema).default([]),
  capabilities: z.array(adapterCapabilityKindSchema).default([]),
  trustBoundary: z.enum(["local-only", "explicit-read", "approval-gated-write"])
});

export const qaEvidenceNormalizationSchema = z.object({
  targetRef: z.string().min(1),
  targetType: z.enum(["artifact-bundle", "validation-output", "local-reference"]),
  referencedArtifactKinds: z.array(z.string().min(1)).default([]),
  normalizedEvidenceSources: z.array(z.string().min(1)).default([]),
  missingEvidenceSources: z.array(z.string().min(1)).default([]),
  normalizedExecutedChecks: z.array(z.string().min(1)).default([]),
  unrecognizedExecutedChecks: z.array(z.string().min(1)).default([]),
  affectedPackages: z.array(z.string().min(1)).default([]),
  allowedValidationCommands: z.array(normalizedValidationCommandSchema).default([]),
  ciEvidence: z.array(ciEvidenceSchema).default([]),
  githubActions: githubActionsEvidenceNormalizationSchema.default({
    evidence: [],
    workflowNames: [],
    failingChecks: [],
    provenanceRefs: []
  })
});

export const securityEvidenceNormalizationSchema = z.object({
  targetRef: z.string().min(1),
  targetType: z.enum(["artifact-bundle", "local-reference"]),
  referencedArtifactKinds: z.array(z.string().min(1)).default([]),
  normalizedEvidenceSources: z.array(z.string().min(1)).default([]),
  missingEvidenceSources: z.array(z.string().min(1)).default([]),
  normalizedFocusAreas: z.array(z.string().min(1)).default([]),
  securitySignals: z.array(z.string().min(1)).default([]),
  dependencyIntegrityEvidence: z.array(dependencyIntegrityEvidenceSchema).default([]),
  provenanceRefs: z.array(z.string().min(1)).default([]),
  affectedPackages: z.array(z.string().min(1)).default([])
});

export const incidentEvidenceNormalizationSchema = z.object({
  incidentSummary: z.string().min(1),
  severityHint: z.enum(["unknown", "low", "medium", "high", "critical"]),
  normalizedEvidenceSources: z.array(z.string().min(1)).default([]),
  missingEvidenceSources: z.array(z.string().min(1)).default([]),
  releaseReportRefs: z.array(z.string().min(1)).default([]),
  timelineSummary: z.array(z.string().min(1)).default([]),
  likelyImpactedAreas: z.array(z.string().min(1)).default([]),
  followUpWorkflowRefs: z.array(z.string().min(1)).default([]),
  provenanceRefs: z.array(z.string().min(1)).default([]),
  redactionCategories: z.array(z.string().min(1)).default([]),
  referencedArtifactKinds: z.array(z.string().min(1)).default([])
});

export const maintenanceEvidenceNormalizationSchema = z.object({
  maintenanceGoal: z.string().min(1),
  dependencyAlertRefs: z.array(z.string().min(1)).default([]),
  docsTaskRefs: z.array(z.string().min(1)).default([]),
  releaseReportRefs: z.array(z.string().min(1)).default([]),
  normalizedEvidenceSources: z.array(z.string().min(1)).default([]),
  missingEvidenceSources: z.array(z.string().min(1)).default([]),
  referencedArtifactKinds: z.array(z.string().min(1)).default([]),
  affectedPackagesOrDocs: z.array(z.string().min(1)).default([]),
  maintenanceSignals: z.array(z.string().min(1)).default([]),
  followUpWorkflowRefs: z.array(z.string().min(1)).default([]),
  routingRecommendation: z.string().min(1),
  provenanceRefs: z.array(z.string().min(1)).default([])
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

export const githubReferenceSchema = z.object({
  platform: z.literal("github"),
  host: z.string().min(1).default("github.com"),
  owner: z.string().min(1),
  repo: z.string().min(1),
  kind: githubReferenceKindSchema,
  number: z.number().int().positive(),
  canonical: z.string().min(1),
  url: z.string().url(),
  source: z.string().min(1)
});

export const githubWorkflowStatusMappingSchema = z.object({
  workflow: z.string().min(1),
  localRunStatus: runStatusSchema,
  githubStatus: githubWorkflowStatusSchema,
  reason: z.string().min(1)
});

export const githubHandoffArtifactKindSchema = z.enum([
  "planning-brief",
  "design-record",
  "incident-brief",
  "qa-report",
  "release-report",
  "promotion-approval-report"
]);

export const githubHandoffSectionSchema = z.object({
  heading: z.string().min(1),
  lines: z.array(z.string().min(1)).default([])
});

export const githubHandoffSummarySchema = z.object({
  artifactKind: githubHandoffArtifactKindSchema,
  workflow: z.string().min(1),
  githubStatus: githubWorkflowStatusSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  issueRefs: z.array(githubReferenceSchema).default([]),
  pullRequestRefs: z.array(githubReferenceSchema).default([]),
  provenanceRefs: z.array(z.string().min(1)).default([]),
  sections: z.array(githubHandoffSectionSchema).default([])
});

export const lifecycleArtifactSourceReferenceSchema = z.object({
  sourceType: lifecycleArtifactSourceTypeSchema,
  runId: z.string().min(1).optional(),
  inputRefs: z.array(z.string()).default([]),
  issueRefs: z.array(z.string()).default([]),
  scmRefs: z.array(scmReferenceSchema).default([]),
  githubRefs: z.array(githubReferenceSchema).default([])
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
  ciEvidenceSummary: z.array(z.lazy(() => releaseCiEvidenceSummarySchema)).default([]),
  findings: z.array(findingSchema).default([]),
  coverageGaps: z.array(z.string().min(1)).default([]),
  recommendedNextChecks: z.array(z.string().min(1)).default([]),
  releaseImpact: z.string().min(1)
});

export const securityArtifactPayloadSchema = z.object({
  targetRef: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  findings: z.array(findingSchema).default([]),
  severitySummary: z.string().min(1),
  mitigations: z.array(z.string().min(1)).default([]),
  releaseImpact: z.string().min(1),
  followUpWork: z.array(z.string().min(1)).default([]),
  dependencyIntegritySignals: z.array(z.string().min(1)).default([])
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

export const incidentArtifactPayloadSchema = z.object({
  incidentSummary: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  timelineSummary: z.array(z.string().min(1)).default([]),
  likelyImpactedAreas: z.array(z.string().min(1)).default([]),
  followUpWorkflowRefs: z.array(z.string().min(1)).default([]),
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

export const releaseVersionResolutionSchema = z.object({
  name: z.string().min(1),
  targetVersion: z.string().min(1),
  currentVersion: z.string().min(1).optional(),
  status: z.enum(["matches-target", "pending-version-bump", "package-missing"])
});

export const releaseApprovalRecommendationSchema = z.object({
  action: z.string().min(1),
  classification: z.enum(["allow", "approval_required", "deny"]),
  reason: z.string().min(1)
});

export const releaseCiEvidenceSummarySchema = z.object({
  provider: z.string().min(1),
  platform: ciPlatformSchema,
  host: z.string().min(1),
  repository: z.string().min(1),
  pipelineName: z.string().min(1),
  pipelineRunId: z.string().min(1),
  status: githubActionsRunStatusSchema,
  conclusion: githubActionsConclusionSchema.optional(),
  branch: z.string().min(1).optional(),
  commitSha: z.string().min(1).optional(),
  failingChecks: z.array(z.string().min(1)).default([]),
  provenanceSource: z.enum(["local-export", "adapter-read"]).default("local-export"),
  displayLabel: z.string().min(1),
  statusSummary: z.string().min(1)
});

export const releaseRequestSchema = z.object({
  releaseScope: z.string().min(1),
  versionTargets: z.array(releaseVersionTargetSchema).min(1),
  qaReportRefs: z.array(z.string().min(1)).default([]),
  securityReportRefs: z.array(z.string().min(1)).default([]),
  evidenceSources: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([])
});

export const deploymentRequestSchema = z.object({
  deploymentScope: z.string().min(1),
  targetEnvironment: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  qaReportRefs: z.array(z.string().min(1)).default([]),
  securityReportRefs: z.array(z.string().min(1)).default([]),
  releaseReportRefs: z.array(z.string().min(1)).default([]),
  pipelineReportRefs: z.array(z.string().min(1)).default([]),
  issueRefs: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([])
});

export const promotionRequestSchema = z.object({
  promotionScope: z.string().min(1),
  targetEnvironment: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  qaReportRefs: z.array(z.string().min(1)).default([]),
  securityReportRefs: z.array(z.string().min(1)).default([]),
  releaseReportRefs: z.array(z.string().min(1)).default([]),
  deploymentGateReportRefs: z.array(z.string().min(1)).default([]),
  issueRefs: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([])
});

export const incidentRequestSchema = z.object({
  incidentSummary: z.string().min(1),
  severityHint: z.enum(["unknown", "low", "medium", "high", "critical"]).default("unknown"),
  evidenceSources: z.array(z.string().min(1)).default([]),
  releaseReportRefs: z.array(z.string().min(1)).default([]),
  issueRefs: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([])
});

export const maintenanceRequestSchema = z.object({
  maintenanceGoal: z.string().min(1),
  dependencyAlertRefs: z.array(z.string().min(1)).default([]),
  docsTaskRefs: z.array(z.string().min(1)).default([]),
  releaseReportRefs: z.array(z.string().min(1)).default([]),
  issueRefs: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([])
});

export const evalPolicyExpectationSchema = z.object({
  executionMode: executionModeSchema.default("inspect"),
  readOnly: z.boolean().default(true),
  sideEffectClasses: z.array(sideEffectClassSchema).default(["observe", "suggest"]),
  approvalRequiredActions: z.array(z.string().min(1)).default([])
});

export const evalRedactionExpectationSchema = z.object({
  applied: z.boolean().default(true),
  expectedCategories: z.array(z.string().min(1)).default([])
});

export const evalArtifactExpectationSchema = z.object({
  artifactKind: lifecycleArtifactKindSchema,
  lifecycleDomain: lifecycleDomainSchema,
  requiredPayloadFields: z.array(z.string().min(1)).default([]),
  requiredSummaryTerms: z.array(z.string().min(1)).default([])
});

const evalSpecBaseShape = {
  schemaVersion: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  repoFixture: evalRepoFixtureSchema,
  expectedStatus: runStatusSchema.default("success"),
  notes: z.array(z.string().min(1)).default([]),
  policyExpectations: evalPolicyExpectationSchema,
  redactionExpectations: evalRedactionExpectationSchema,
  artifactExpectations: z.array(evalArtifactExpectationSchema).default([])
} as const;

export const prReviewEvalSpecSchema = z.object({
  ...evalSpecBaseShape,
  workflow: z.literal("pr-review")
});

export const planningEvalSpecSchema = z.object({
  ...evalSpecBaseShape,
  workflow: z.literal("planning-discovery"),
  request: planningRequestSchema
});

export const designEvalSpecSchema = z.object({
  ...evalSpecBaseShape,
  workflow: z.literal("architecture-design-review"),
  request: designRequestSchema
});

export const implementationEvalSpecSchema = z.object({
  ...evalSpecBaseShape,
  workflow: z.literal("implementation-proposal"),
  request: implementationRequestSchema
});

export const qaEvalSpecSchema = z.object({
  ...evalSpecBaseShape,
  workflow: z.literal("qa-review"),
  request: qaRequestSchema
});

export const securityEvalSpecSchema = z.object({
  ...evalSpecBaseShape,
  workflow: z.literal("security-review"),
  request: securityRequestSchema
});

export const maintenanceEvalSpecSchema = z.object({
  ...evalSpecBaseShape,
  workflow: z.literal("maintenance-triage"),
  request: maintenanceRequestSchema
});

export const evalSpecSchema = z.discriminatedUnion("workflow", [
  prReviewEvalSpecSchema,
  planningEvalSpecSchema,
  designEvalSpecSchema,
  implementationEvalSpecSchema,
  qaEvalSpecSchema,
  securityEvalSpecSchema,
  maintenanceEvalSpecSchema
]);

export const evalFixtureCorpusSchema = z.object({
  schemaVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  specs: z.array(evalSpecSchema).min(1)
});

export const releaseEvidenceNormalizationSchema = z.object({
  qaReportRefs: z.array(z.string().min(1)).default([]),
  securityReportRefs: z.array(z.string().min(1)).default([]),
  normalizedEvidenceSources: z.array(z.string().min(1)).default([]),
  missingEvidenceSources: z.array(z.string().min(1)).default([]),
  ciEvidence: z.array(ciEvidenceSchema).default([]),
  ciEvidenceSummary: z.array(releaseCiEvidenceSummarySchema).default([]),
  dependencyIntegrityEvidence: z.array(dependencyIntegrityEvidenceSchema).default([]),
  attestationVerificationEvidence: z.array(attestationVerificationEvidenceSchema).default([]),
  versionResolutions: z.array(releaseVersionResolutionSchema).default([]),
  localReadinessChecks: z.array(releaseVerificationCheckSchema).default([]),
  readinessStatus: z.enum(["ready", "blocked", "partial"]),
  approvalRecommendations: z.array(releaseApprovalRecommendationSchema).default([]),
  trustSummary: z.array(z.string().min(1)).default([]),
  provenanceRefs: z.array(z.string().min(1)).default([])
});

export const pipelineReviewStatusSchema = z.enum(["ready", "needs_follow_up", "blocked"]);

export const pipelineEvidenceNormalizationSchema = z.object({
  qaReportRefs: z.array(z.string().min(1)).default([]),
  securityReportRefs: z.array(z.string().min(1)).default([]),
  releaseReportRefs: z.array(z.string().min(1)).default([]),
  normalizedEvidenceSources: z.array(z.string().min(1)).default([]),
  missingEvidenceSources: z.array(z.string().min(1)).default([]),
  ciEvidence: z.array(ciEvidenceSchema).default([]),
  ciEvidenceSummary: z.array(releaseCiEvidenceSummarySchema).default([]),
  referencedArtifactKinds: z.array(z.string().min(1)).default([]),
  verificationChecks: z.array(releaseVerificationCheckSchema).default([]),
  reviewStatus: pipelineReviewStatusSchema,
  provenanceRefs: z.array(z.string().min(1)).default([])
});

export const releaseArtifactPayloadSchema = z.object({
  releaseScope: z.string().min(1),
  versionTargets: z.array(releaseVersionTargetSchema).min(1),
  readinessStatus: z.enum(["ready", "blocked", "partial"]),
  verificationChecks: z.array(releaseVerificationCheckSchema).default([]),
  versionResolutions: z.array(releaseVersionResolutionSchema).default([]),
  ciEvidenceSummary: z.array(releaseCiEvidenceSummarySchema).default([]),
  dependencyIntegritySignals: z.array(z.string().min(1)).default([]),
  trustSummary: z.array(z.string().min(1)).default([]),
  approvalRecommendations: z.array(releaseApprovalRecommendationSchema).default([]),
  publishingPlan: z.array(z.string().min(1)).default([]),
  trustStatus: z.string().min(1),
  publishedPackages: z.array(z.string().min(1)).default([]),
  tagRefs: z.array(z.string().min(1)).default([]),
  provenanceRefs: z.array(z.string().min(1)).default([]),
  rollbackNotes: z.array(z.string().min(1)).default([]),
  externalDependencies: z.array(z.string().min(1)).default([])
});

export const pipelineArtifactPayloadSchema = z.object({
  pipelineScope: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  verificationChecks: z.array(releaseVerificationCheckSchema).default([]),
  ciEvidenceSummary: z.array(releaseCiEvidenceSummarySchema).default([]),
  reviewStatus: pipelineReviewStatusSchema,
  blockers: z.array(z.string().min(1)).default([]),
  riskSummary: z.array(z.string().min(1)).default([]),
  recommendedNextSteps: z.array(z.string().min(1)).default([]),
  referencedArtifactKinds: z.array(z.string().min(1)).default([]),
  provenanceRefs: z.array(z.string().min(1)).default([])
});

export const deploymentGateStatusSchema = z.enum(["ready_for_approval", "conditionally_ready", "blocked"]);

export const deploymentGateEvidenceNormalizationSchema = z.object({
  qaReportRefs: z.array(z.string().min(1)).default([]),
  securityReportRefs: z.array(z.string().min(1)).default([]),
  releaseReportRefs: z.array(z.string().min(1)).default([]),
  pipelineReportRefs: z.array(z.string().min(1)).default([]),
  normalizedEvidenceSources: z.array(z.string().min(1)).default([]),
  missingEvidenceSources: z.array(z.string().min(1)).default([]),
  ciEvidence: z.array(ciEvidenceSchema).default([]),
  ciEvidenceSummary: z.array(releaseCiEvidenceSummarySchema).default([]),
  referencedArtifactKinds: z.array(z.string().min(1)).default([]),
  verificationChecks: z.array(releaseVerificationCheckSchema).default([]),
  gateStatus: deploymentGateStatusSchema,
  provenanceRefs: z.array(z.string().min(1)).default([])
});

export const deploymentGateArtifactPayloadSchema = z.object({
  deploymentScope: z.string().min(1),
  targetEnvironment: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  verificationChecks: z.array(releaseVerificationCheckSchema).default([]),
  ciEvidenceSummary: z.array(releaseCiEvidenceSummarySchema).default([]),
  gateStatus: deploymentGateStatusSchema,
  blockers: z.array(z.string().min(1)).default([]),
  requiredFollowUpChecks: z.array(z.string().min(1)).default([]),
  referencedArtifactKinds: z.array(z.string().min(1)).default([]),
  provenanceRefs: z.array(z.string().min(1)).default([])
});

export const promotionApprovalStatusSchema = z.enum(["approval_recommended", "needs_follow_up", "blocked"]);

export const promotionApprovalEvidenceNormalizationSchema = z.object({
  qaReportRefs: z.array(z.string().min(1)).default([]),
  securityReportRefs: z.array(z.string().min(1)).default([]),
  releaseReportRefs: z.array(z.string().min(1)).default([]),
  deploymentGateReportRefs: z.array(z.string().min(1)).default([]),
  normalizedEvidenceSources: z.array(z.string().min(1)).default([]),
  missingEvidenceSources: z.array(z.string().min(1)).default([]),
  ciEvidence: z.array(ciEvidenceSchema).default([]),
  ciEvidenceSummary: z.array(releaseCiEvidenceSummarySchema).default([]),
  referencedArtifactKinds: z.array(z.string().min(1)).default([]),
  verificationChecks: z.array(releaseVerificationCheckSchema).default([]),
  approvalRecommendations: z.array(releaseApprovalRecommendationSchema).default([]),
  approvalStatus: promotionApprovalStatusSchema,
  provenanceRefs: z.array(z.string().min(1)).default([])
});

export const promotionApprovalArtifactPayloadSchema = z.object({
  promotionScope: z.string().min(1),
  targetEnvironment: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  verificationChecks: z.array(releaseVerificationCheckSchema).default([]),
  ciEvidenceSummary: z.array(releaseCiEvidenceSummarySchema).default([]),
  approvalStatus: promotionApprovalStatusSchema,
  blockers: z.array(z.string().min(1)).default([]),
  requiredApprovals: z.array(z.string().min(1)).default([]),
  recommendedNextSteps: z.array(z.string().min(1)).default([]),
  approvalRecommendations: z.array(releaseApprovalRecommendationSchema).default([]),
  referencedArtifactKinds: z.array(z.string().min(1)).default([]),
  provenanceRefs: z.array(z.string().min(1)).default([])
});

export const maintenanceArtifactPayloadSchema = z.object({
  maintenanceScope: z.string().min(1),
  evidenceSources: z.array(z.string().min(1)).default([]),
  affectedPackagesOrDocs: z.array(z.string().min(1)).default([]),
  currentFindings: z.array(z.string().min(1)).default([]),
  recommendedActions: z.array(z.string().min(1)).default([]),
  routingRecommendation: z.string().min(1),
  followUpWorkflowRefs: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  priorityAssessment: z.string().min(1),
  dependencyUpdates: z.array(z.string().min(1)).default([]),
  docsUpdates: z.array(z.string().min(1)).default([]),
  stalenessSignals: z.array(z.string().min(1)).default([]),
  followUpIssues: z.array(z.string().min(1)).default([])
});

export const evalCheckStatusSchema = z.enum(["passed", "failed", "not_applicable"]);

export const evalDeterministicCheckSchema = z.object({
  name: z.string().min(1),
  status: evalCheckStatusSchema,
  expected: z.string().min(1),
  actual: z.string().min(1).optional(),
  details: z.string().min(1).optional()
});

export const evalModelDependentCheckSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["not_executed", "passed", "failed"]).default("not_executed"),
  details: z.string().min(1).optional()
});

export const evalSetupRunSchema = z.object({
  workflow: z.string().min(1),
  runId: z.string().min(1),
  bundlePath: z.string().min(1)
});

export const evalArtifactPayloadSchema = z.object({
  specId: z.string().min(1),
  specName: z.string().min(1),
  workflow: evalWorkflowSchema,
  repoFixture: evalRepoFixtureSchema,
  workspacePath: z.string().min(1),
  evaluatedRunId: z.string().min(1).optional(),
  evaluatedBundlePath: z.string().min(1).optional(),
  setupRuns: z.array(evalSetupRunSchema).default([]),
  deterministicChecks: z.array(evalDeterministicCheckSchema).default([]),
  modelDependentChecks: z.array(evalModelDependentCheckSchema).default([]),
  passed: z.boolean(),
  failureCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative().default(0)
});

export const benchmarkComparisonClassificationSchema = z.enum(["regression", "improvement", "unchanged", "non_comparable"]);
export const benchmarkDecisionOutcomeSchema = z.enum([
  "scope_reduction",
  "added_validation",
  "blocked_approval",
  "remediation_before_merge",
  "added_confidence",
  "no_meaningful_change"
]);
export const benchmarkCategorySchema = z.enum(["general", "release"]);
export const benchmarkLedgerSourceSchema = z.enum(["replay", "live"]);
export const benchmarkLedgerArmSchema = z.enum(["control", "agentforge"]);
export const benchmarkReleaseDecisionSchema = z.enum(["go", "no-go", "conditional", "unclear"]);
export const benchmarkDecisionClaritySchema = z.enum(["clear", "mixed", "ambiguous"]);

export const benchmarkDeterministicDeltaSchema = z.object({
  name: z.string().min(1),
  classification: benchmarkComparisonClassificationSchema,
  baselineStatus: evalCheckStatusSchema.optional(),
  candidateStatus: evalCheckStatusSchema.optional(),
  details: z.string().min(1).optional()
});

export const benchmarkComparedRunSchema = z.object({
  runId: z.string().min(1),
  bundlePath: z.string().min(1),
  specId: z.string().min(1).optional(),
  workflow: evalWorkflowSchema.optional(),
  comparable: z.boolean(),
  passed: z.boolean().optional(),
  failureCount: z.number().int().nonnegative().optional(),
  deterministicCheckCount: z.number().int().nonnegative().default(0),
  regressions: z.array(benchmarkDeterministicDeltaSchema).default([]),
  improvements: z.array(benchmarkDeterministicDeltaSchema).default([]),
  unchangedCount: z.number().int().nonnegative().default(0),
  nonComparableFindings: z.array(z.string().min(1)).default([])
});

export const benchmarkArtifactPayloadSchema = z.object({
  baselineRunId: z.string().min(1),
  baselineBundlePath: z.string().min(1),
  baselineSpecId: z.string().min(1).optional(),
  baselineWorkflow: evalWorkflowSchema.optional(),
  comparedRuns: z.array(benchmarkComparedRunSchema).min(1),
  regressionCount: z.number().int().nonnegative(),
  improvementCount: z.number().int().nonnegative(),
  unchangedCount: z.number().int().nonnegative(),
  nonComparableCount: z.number().int().nonnegative(),
  summaryConclusion: z.string().min(1)
});

export const benchmarkLedgerTraceReferenceSchema = z.object({
  runId: z.string().min(1).optional(),
  artifactKind: z.string().min(1).optional(),
  section: z.string().min(1).optional(),
  findingId: z.string().min(1).optional(),
  note: z.string().min(1)
});

export const benchmarkLedgerConfirmedRiskReferenceSchema = z.object({
  severity: z.enum(["high", "medium", "low"]),
  title: z.string().min(1),
  runId: z.string().min(1).optional(),
  artifactKind: z.string().min(1).optional(),
  note: z.string().min(1).optional()
});

export const benchmarkLedgerWorkflowStatusSchema = z.object({
  workflow: z.string().min(1),
  status: z.string().min(1)
});

export const benchmarkLedgerTokenUsageSchema = z.object({
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  inputTokens: z.number().int().nonnegative().nullable().optional(),
  outputTokens: z.number().int().nonnegative().nullable().optional(),
  totalTokens: z.number().int().nonnegative().nullable().optional(),
  estimatedCostUsd: z.number().nonnegative().nullable().optional(),
  requestCount: z.number().int().nonnegative().nullable().optional()
});

export const benchmarkLedgerFrictionSchema = z.object({
  override: z.boolean().default(false),
  overrideReason: z.string().min(1).optional(),
  falsePositivePatterns: z.array(z.string().min(1)).default([]),
  falsePositiveRefs: z.array(benchmarkLedgerTraceReferenceSchema).default([]),
  manualSteps: z.array(z.string().min(1)).default([]),
  requestFriction: z.array(z.string().min(1)).default([])
});

export const benchmarkLedgerEntrySchema = z.object({
  taskId: z.string().min(1),
  taskLink: z.string().min(1).optional(),
  benchmarkCategory: benchmarkCategorySchema.default("general"),
  source: benchmarkLedgerSourceSchema,
  taskType: z.string().min(1),
  arm: benchmarkLedgerArmSchema,
  runId: z.string().min(1).optional(),
  workflow: z.string().min(1).optional(),
  agent: z.string().min(1).optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  cycleTimeSeconds: z.number().int().nonnegative().optional(),
  summary: z.string().min(1).optional(),
  decisionOutcome: benchmarkDecisionOutcomeSchema.optional(),
  decisionImpactReason: z.string().min(1).optional(),
  agentforgeChangedDecision: z.boolean().optional(),
  releaseDecision: benchmarkReleaseDecisionSchema.optional(),
  decisionClarity: benchmarkDecisionClaritySchema.optional(),
  finalRecommendationSummary: z.string().min(1).optional(),
  rerunCount: z.number().int().nonnegative().default(0),
  blockedStateCount: z.number().int().nonnegative().default(0),
  triggerRefs: z.array(benchmarkLedgerTraceReferenceSchema).default([]),
  confirmedRisks: z.object({
    high: z.number().int().nonnegative().default(0),
    medium: z.number().int().nonnegative().default(0),
    low: z.number().int().nonnegative().default(0),
    noisy: z.number().int().nonnegative().default(0),
    unresolved: z.number().int().nonnegative().default(0)
  }),
  confirmedRiskRefs: z.array(benchmarkLedgerConfirmedRiskReferenceSchema).default([]),
  tokenUsage: benchmarkLedgerTokenUsageSchema.optional(),
  evidence: z.object({
    present: z.array(z.string().min(1)).default([]),
    missing: z.array(z.string().min(1)).default([]),
    partial: z.array(z.string().min(1)).default([])
  }),
  evidenceGapRefs: z.array(benchmarkLedgerTraceReferenceSchema).default([]),
  workflowStatuses: z.array(benchmarkLedgerWorkflowStatusSchema).default([]),
  friction: benchmarkLedgerFrictionSchema.default({
    override: false,
    falsePositivePatterns: [],
    falsePositiveRefs: [],
    manualSteps: [],
    requestFriction: []
  }),
  notes: z.array(z.string().min(1)).default([])
});

export const benchmarkLedgerDocumentSchema = z.object({
  schemaVersion: z.string().min(1).default("1.0.0"),
  entries: z.array(benchmarkLedgerEntrySchema).default([])
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

export const incidentArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("incident-brief"),
  lifecycleDomain: z.literal("operate"),
  payload: incidentArtifactPayloadSchema
});

export const pipelineArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("pipeline-report"),
  lifecycleDomain: z.literal("release"),
  payload: pipelineArtifactPayloadSchema
});

export const qaArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("qa-report"),
  lifecycleDomain: z.literal("test"),
  payload: qaArtifactPayloadSchema
});

export const securityArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("security-report"),
  lifecycleDomain: z.literal("security"),
  payload: securityArtifactPayloadSchema
});

export const evalArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("eval-result"),
  lifecycleDomain: z.literal("evaluate"),
  payload: evalArtifactPayloadSchema
});

export const benchmarkArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("benchmark-summary"),
  lifecycleDomain: z.literal("evaluate"),
  payload: benchmarkArtifactPayloadSchema
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

export const deploymentGateArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("deployment-gate-report"),
  lifecycleDomain: z.literal("release"),
  payload: deploymentGateArtifactPayloadSchema
});

export const promotionApprovalArtifactSchema = lifecycleArtifactEnvelopeSchema.extend({
  artifactKind: z.literal("promotion-approval-report"),
  lifecycleDomain: z.literal("release"),
  payload: promotionApprovalArtifactPayloadSchema
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
  incidentArtifactSchema,
  pipelineArtifactSchema,
  qaArtifactSchema,
  securityArtifactSchema,
  evalArtifactSchema,
  benchmarkArtifactSchema,
  reviewArtifactSchema,
  releaseArtifactSchema,
  deploymentGateArtifactSchema,
  promotionApprovalArtifactSchema,
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

export const schemaRegistry: Record<string, ZodTypeAny> = {
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
  scmReference: scmReferenceSchema,
  ciJobEvidence: ciJobEvidenceSchema,
  ciArtifactEvidence: ciArtifactEvidenceSchema,
  ciEvidence: ciEvidenceSchema,
  gitlabCiJobEvidenceExport: gitlabCiJobEvidenceExportSchema,
  gitlabCiEvidenceExport: gitlabCiEvidenceExportSchema,
  buildkiteCiEvidenceExport: buildkiteCiEvidenceExportSchema,
  jenkinsCiEvidenceExport: jenkinsCiEvidenceExportSchema,
  genericCiEvidenceExport: genericCiEvidenceExportSchema,
  dependencyInventoryEntry: dependencyInventoryEntrySchema,
  dependencyIntegrityEvidence: dependencyIntegrityEvidenceSchema,
  attestationVerificationEvidence: attestationVerificationEvidenceSchema,
  adapterCapabilityMetadata: adapterCapabilityMetadataSchema,
  githubReference: githubReferenceSchema,
  githubActionsJobEvidence: githubActionsJobEvidenceSchema,
  githubActionsCheckRunEvidence: githubActionsCheckRunEvidenceSchema,
  githubActionsEvidence: githubActionsEvidenceSchema,
  githubActionsEvidenceNormalization: githubActionsEvidenceNormalizationSchema,
  githubHandoffSection: githubHandoffSectionSchema,
  githubHandoffSummary: githubHandoffSummarySchema,
  githubWorkflowStatusMapping: githubWorkflowStatusMappingSchema,
  lifecycleArtifactWorkflowReference: lifecycleArtifactWorkflowReferenceSchema,
  lifecycleArtifactSourceReference: lifecycleArtifactSourceReferenceSchema,
  lifecycleArtifactRepoReference: lifecycleArtifactRepoReferenceSchema,
  lifecycleArtifactAuditLink: lifecycleArtifactAuditLinkSchema,
  lifecycleArtifactEnvelope: lifecycleArtifactEnvelopeSchema,
  catalogMetadata: catalogMetadataSchema,
  registryPluginCompatibility: registryPluginCompatibilitySchema,
  registryPluginDistribution: registryPluginDistributionSchema,
  registryPluginCatalogEntry: registryPluginCatalogEntrySchema,
  registryPluginCatalog: registryPluginCatalogSchema,
  planningArtifactPayload: planningArtifactPayloadSchema,
  designArtifactOption: designArtifactOptionSchema,
  designArtifactPayload: designArtifactPayloadSchema,
  implementationArtifactPayload: implementationArtifactPayloadSchema,
  incidentArtifactPayload: incidentArtifactPayloadSchema,
  qaArtifactPayload: qaArtifactPayloadSchema,
  securityArtifactPayload: securityArtifactPayloadSchema,
  evalDeterministicCheck: evalDeterministicCheckSchema,
  evalModelDependentCheck: evalModelDependentCheckSchema,
  evalSetupRun: evalSetupRunSchema,
  evalArtifactPayload: evalArtifactPayloadSchema,
  benchmarkDecisionOutcome: benchmarkDecisionOutcomeSchema,
  benchmarkCategory: benchmarkCategorySchema,
  benchmarkLedgerSource: benchmarkLedgerSourceSchema,
  benchmarkLedgerArm: benchmarkLedgerArmSchema,
  benchmarkReleaseDecision: benchmarkReleaseDecisionSchema,
  benchmarkDecisionClarity: benchmarkDecisionClaritySchema,
  benchmarkDeterministicDelta: benchmarkDeterministicDeltaSchema,
  benchmarkComparedRun: benchmarkComparedRunSchema,
  benchmarkArtifactPayload: benchmarkArtifactPayloadSchema,
  benchmarkLedgerTraceReference: benchmarkLedgerTraceReferenceSchema,
  benchmarkLedgerConfirmedRiskReference: benchmarkLedgerConfirmedRiskReferenceSchema,
  benchmarkLedgerWorkflowStatus: benchmarkLedgerWorkflowStatusSchema,
  benchmarkLedgerTokenUsage: benchmarkLedgerTokenUsageSchema,
  benchmarkLedgerFriction: benchmarkLedgerFrictionSchema,
  benchmarkLedgerEntry: benchmarkLedgerEntrySchema,
  benchmarkLedgerDocument: benchmarkLedgerDocumentSchema,
  reviewArtifactPayload: reviewArtifactPayloadSchema,
  releaseVerificationCheck: releaseVerificationCheckSchema,
  releaseVersionTarget: releaseVersionTargetSchema,
  releaseVersionResolution: releaseVersionResolutionSchema,
  releaseApprovalRecommendation: releaseApprovalRecommendationSchema,
  releaseCiEvidenceSummary: releaseCiEvidenceSummarySchema,
  releaseEvidenceNormalization: releaseEvidenceNormalizationSchema,
  releaseArtifactPayload: releaseArtifactPayloadSchema,
  pipelineArtifactPayload: pipelineArtifactPayloadSchema,
  deploymentGateArtifactPayload: deploymentGateArtifactPayloadSchema,
  promotionApprovalArtifactPayload: promotionApprovalArtifactPayloadSchema,
  maintenanceArtifactPayload: maintenanceArtifactPayloadSchema,
  planningArtifact: planningArtifactSchema,
  designArtifact: designArtifactSchema,
  implementationArtifact: implementationArtifactSchema,
  incidentArtifact: incidentArtifactSchema,
  pipelineArtifact: pipelineArtifactSchema,
  qaArtifact: qaArtifactSchema,
  securityArtifact: securityArtifactSchema,
  evalArtifact: evalArtifactSchema,
  benchmarkArtifact: benchmarkArtifactSchema,
  reviewArtifact: reviewArtifactSchema,
  releaseArtifact: releaseArtifactSchema,
  deploymentGateArtifact: deploymentGateArtifactSchema,
  promotionApprovalArtifact: promotionApprovalArtifactSchema,
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
  securityRequest: securityRequestSchema,
  pipelineRequest: pipelineRequestSchema,
  releaseRequest: releaseRequestSchema,
  deploymentRequest: deploymentRequestSchema,
  promotionRequest: promotionRequestSchema,
  incidentRequest: incidentRequestSchema,
  maintenanceRequest: maintenanceRequestSchema,
  evalPolicyExpectation: evalPolicyExpectationSchema,
  evalRedactionExpectation: evalRedactionExpectationSchema,
  evalArtifactExpectation: evalArtifactExpectationSchema,
  evalSpec: evalSpecSchema,
  evalFixtureCorpus: evalFixtureCorpusSchema,
  normalizedValidationCommand: normalizedValidationCommandSchema,
  implementationInventory: implementationInventorySchema,
  qaEvidenceNormalization: qaEvidenceNormalizationSchema,
  securityEvidenceNormalization: securityEvidenceNormalizationSchema,
  pipelineEvidenceNormalization: pipelineEvidenceNormalizationSchema,
  deploymentGateEvidenceNormalization: deploymentGateEvidenceNormalizationSchema,
  promotionApprovalEvidenceNormalization: promotionApprovalEvidenceNormalizationSchema,
  incidentEvidenceNormalization: incidentEvidenceNormalizationSchema,
  maintenanceEvidenceNormalization: maintenanceEvidenceNormalizationSchema,
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
    issueRefs: ["#78"],
    githubRefs: [
      {
        platform: "github",
        host: "github.com",
        owner: "H9-Foundry",
        repo: "AgentForge",
        kind: "issue",
        number: 78,
        canonical: "H9-Foundry/AgentForge#78",
        url: "https://github.com/H9-Foundry/AgentForge/issues/78",
        source: "#78"
      }
    ]
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

const incidentArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "incident-brief",
  lifecycleDomain: "operate",
  summary: "Incident brief prepared for elevated 500s after the latest release candidate.",
  payload: {
    incidentSummary: "Customers saw elevated 500s after the latest release candidate.",
    evidenceSources: [
      ".agentops/evidence/incident-summary.md",
      ".agentops/evidence/alerts.json",
      ".agentops/runs/run-release/bundle.json"
    ],
    timelineSummary: [
      "Severity hint: high.",
      "Two staged evidence sources and one release-report reference were validated before reasoning."
    ],
    likelyImpactedAreas: ["release-readiness", "maintenance-triage", "packages/cli"],
    followUpWorkflowRefs: ["maintenance-triage", "security-review"],
    openQuestions: ["Which release candidate introduced the first reproducible 500 response?"]
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
    ciEvidenceSummary: [
      {
        provider: "Buildkite",
        platform: "buildkite",
        host: "buildkite.com",
        repository: "H9-Foundry/AgentForge",
        pipelineName: "qa",
        pipelineRunId: "bk-41",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "abc123",
        failingChecks: [],
        provenanceSource: "local-export",
        displayLabel: "Buildkite (buildkite) pipeline `qa` run `bk-41`",
        statusSummary: "Buildkite (buildkite) pipeline `qa` run `bk-41` completed from local-export evidence with success."
      }
    ],
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

const securityArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "security-report",
  lifecycleDomain: "security",
  summary: "Security report for the bounded implementation proposal handoff.",
  payload: {
    targetRef: ".agentops/runs/run-790/bundle.json",
    evidenceSources: [".agentops/runs/run-790/summary.md"],
    findings: [
      {
        id: "security-finding-1",
        title: "Dependency risk still needs bounded interpretation",
        summary: "The security workflow synthesized a dependency-risk concern from validated references.",
        severity: "medium",
        rationale:
          "This slice emits a structured security report from validated evidence references before deterministic evidence normalization lands.",
        confidence: 0.78,
        location: ".agentops/requests/security.yaml",
        tags: ["security", "dependency-risk"]
      }
    ],
    severitySummary: "highest severity: medium; 1 synthesized security finding.",
    mitigations: ["Review dependency-risk evidence before release promotion."],
    releaseImpact: "candidate release requires explicit security review before promotion.",
    followUpWork: ["Use deterministic security evidence normalization outputs before broader promotion."],
    dependencyIntegritySignals: [
      "Dependency inventory covers 2 manifest(s) with 4 declared dependency entries.",
      "Workspace dependency integrity is verified against pnpm-lock.yaml."
    ]
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
    versionResolutions: [
      {
        name: "@h9-foundry/agentforge-schemas",
        targetVersion: "0.4.1",
        currentVersion: "0.4.0",
        status: "pending-version-bump"
      }
    ],
    ciEvidenceSummary: [
      {
        provider: "GitHub Actions",
        platform: "github-actions",
        host: "github.com",
        repository: "H9-Foundry/AgentForge",
        pipelineName: "publish",
        pipelineRunId: "321",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "abc123",
        failingChecks: [],
        provenanceSource: "adapter-read",
        displayLabel: "GitHub Actions (github-actions) pipeline `publish` run `321`",
        statusSummary: "GitHub Actions (github-actions) pipeline `publish` run `321` completed from adapter-read evidence with success."
      }
    ],
    dependencyIntegritySignals: [
      "Dependency inventory covers 2 manifest(s) with 4 declared dependency entries.",
      "Workspace dependency integrity is verified against pnpm-lock.yaml."
    ],
    trustSummary: [
      "Verified 1 attestation or provenance evidence export.",
      "Trusted publishing remains reviewed separately from bounded attestation verification."
    ],
    approvalRecommendations: [
      {
        action: "publish-packages",
        classification: "approval_required",
        reason: "Package publication remains outside the default read-only workflow path."
      }
    ],
    publishingPlan: ["Merge version PR", "Let GitHub Actions publish"],
    trustStatus: "trusted-publishing-configured",
    publishedPackages: [],
    tagRefs: [],
    provenanceRefs: [".agentops/runs/run-321/bundle.json"],
    rollbackNotes: ["Pause the release if the verification set changes before publish."],
    externalDependencies: ["Trusted publishing remains configured in GitHub Actions."]
  }
} as const;

const pipelineArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "pipeline-report",
  lifecycleDomain: "release",
  summary: "Pipeline evidence review report for the current candidate CI set.",
  payload: {
    pipelineScope: "Review the bounded CI evidence for the current candidate pipeline set.",
    evidenceSources: [
      ".agentops/evidence/buildkite-ci.json",
      ".agentops/evidence/jenkins-ci.json",
      ".agentops/evidence/generic-ci.json",
      ".agentops/runs/run-qa/bundle.json",
      ".agentops/runs/run-security/bundle.json",
      ".agentops/runs/run-release/bundle.json"
    ],
    verificationChecks: [
      { name: "imported-ci-evidence", status: "passed", detail: "Using three imported CI evidence exports." },
      { name: "referenced-artifacts", status: "passed", detail: "Validated referenced QA, security, and release artifacts." }
    ],
    ciEvidenceSummary: [
      {
        provider: "Buildkite",
        platform: "buildkite",
        host: "buildkite.com",
        repository: "H9-Foundry/AgentForge",
        pipelineName: "release",
        pipelineRunId: "bk-42",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "abc123",
        failingChecks: [],
        provenanceSource: "local-export",
        displayLabel: "Buildkite (buildkite) pipeline `release` run `bk-42`",
        statusSummary: "Buildkite (buildkite) pipeline `release` run `bk-42` completed from local-export evidence with success."
      },
      {
        provider: "Jenkins",
        platform: "jenkins-ci",
        host: "jenkins.local",
        repository: "H9-Foundry/AgentForge",
        pipelineName: "Jenkins CI",
        pipelineRunId: "jenkins-42",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "abc123",
        failingChecks: [],
        provenanceSource: "local-export",
        displayLabel: "Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42`",
        statusSummary: "Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42` completed from local-export evidence with success."
      },
      {
        provider: "CircleCI",
        platform: "generic-ci",
        host: "circleci.local",
        repository: "H9-Foundry/AgentForge",
        pipelineName: "CircleCI",
        pipelineRunId: "circleci-42",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "abc123",
        failingChecks: [],
        provenanceSource: "local-export",
        displayLabel: "CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42`",
        statusSummary: "CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42` completed from local-export evidence with success."
      }
    ],
    reviewStatus: "needs_follow_up",
    blockers: [],
    riskSummary: [
      "The candidate CI set is green, but deployment readiness still depends on an explicit gate review.",
      "Cross-provider CI evidence remains reviewable through local exports only."
    ],
    recommendedNextSteps: [
      "Run deployment-gate-review before approving any deploy or promotion step.",
      "Confirm the referenced QA, security, and release artifacts still match the candidate revision."
    ],
    referencedArtifactKinds: ["qa-report", "security-report", "release-report"],
    provenanceRefs: [
      ".agentops/evidence/buildkite-ci.json",
      ".agentops/evidence/jenkins-ci.json",
      ".agentops/evidence/generic-ci.json",
      ".agentops/runs/run-qa/bundle.json",
      ".agentops/runs/run-security/bundle.json",
      ".agentops/runs/run-release/bundle.json"
    ]
  }
} as const;

const deploymentGateArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "deployment-gate-report",
  lifecycleDomain: "release",
  summary: "Deployment gate review report for the staging candidate.",
  payload: {
    deploymentScope: "Review the staging deployment gate for the current release candidate.",
    targetEnvironment: "staging",
    evidenceSources: [
      ".agentops/evidence/buildkite-ci.json",
      ".agentops/evidence/jenkins-ci.json",
      ".agentops/evidence/generic-ci.json",
      ".agentops/runs/run-pipeline/bundle.json",
      ".agentops/runs/run-release/bundle.json"
    ],
    verificationChecks: [
      { name: "imported-ci-evidence", status: "passed", detail: "Using three imported CI evidence exports." },
      { name: "referenced-artifacts", status: "passed", detail: "Validated referenced QA, security, release, and pipeline artifacts." }
    ],
    ciEvidenceSummary: pipelineArtifactFixture.payload.ciEvidenceSummary,
    gateStatus: "conditionally_ready",
    blockers: [],
    requiredFollowUpChecks: [
      "Confirm staging deploy approvals from the owning maintainer.",
      "Re-check the latest release and pipeline reports immediately before promotion."
    ],
    referencedArtifactKinds: ["qa-report", "security-report", "release-report", "pipeline-report"],
    provenanceRefs: [
      ".agentops/evidence/buildkite-ci.json",
      ".agentops/evidence/jenkins-ci.json",
      ".agentops/evidence/generic-ci.json",
      ".agentops/runs/run-pipeline/bundle.json",
      ".agentops/runs/run-release/bundle.json"
    ]
  }
} as const;

const promotionApprovalArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "promotion-approval-report",
  lifecycleDomain: "release",
  summary: "Promotion approval review report for the production candidate.",
  payload: {
    promotionScope: "Review approval readiness for promoting the current release candidate.",
    targetEnvironment: "production",
    evidenceSources: [
      ".agentops/evidence/jenkins-ci.json",
      ".agentops/evidence/generic-ci.json",
      ".agentops/runs/run-release/bundle.json",
      ".agentops/runs/run-deployment/bundle.json"
    ],
    verificationChecks: [
      { name: "release-report-refs", status: "passed", detail: "Using 1 ready release report reference(s)." },
      {
        name: "deployment-gate-report-refs",
        status: "passed",
        detail: "Using 1 ready deployment gate report reference(s) for production."
      },
      { name: "imported-ci-evidence", status: "passed", detail: "Using 2 imported CI evidence export(s) across 2 pipeline(s)." }
    ],
    ciEvidenceSummary: [
      {
        provider: "Jenkins",
        platform: "jenkins-ci",
        host: "jenkins.local",
        repository: "H9-Foundry/AgentForge",
        pipelineName: "Jenkins CI",
        pipelineRunId: "jenkins-42",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "abc123",
        failingChecks: [],
        provenanceSource: "local-export",
        displayLabel: "Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42`",
        statusSummary: "Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42` completed from local-export evidence with success."
      },
      {
        provider: "CircleCI",
        platform: "generic-ci",
        host: "circleci.local",
        repository: "H9-Foundry/AgentForge",
        pipelineName: "CircleCI",
        pipelineRunId: "circleci-42",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "abc123",
        failingChecks: [],
        provenanceSource: "local-export",
        displayLabel: "CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42`",
        statusSummary: "CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42` completed from local-export evidence with success."
      }
    ],
    approvalStatus: "approval_recommended",
    blockers: [],
    requiredApprovals: [
      "Obtain explicit maintainer approval before any promotion or publish action.",
      "Confirm the production deployment owner accepts the current promotion window."
    ],
    recommendedNextSteps: [
      "Use the ready release and deployment-gate reports as the bounded approval package for promotion review.",
      "Keep deployment and publish execution outside this review-only workflow."
    ],
    approvalRecommendations: [
      {
        action: "promote-release",
        classification: "approval_required",
        reason: "Promotion remains a release-significant side effect and requires explicit maintainer approval."
      },
      {
        action: "publish-packages",
        classification: "approval_required",
        reason: "Package publication remains outside the default read-only workflow path."
      }
    ],
    referencedArtifactKinds: ["qa-report", "security-report", "release-report", "deployment-gate-report"],
    provenanceRefs: [
      ".agentops/evidence/jenkins-ci.json",
      ".agentops/evidence/generic-ci.json",
      ".agentops/runs/run-release/bundle.json",
      ".agentops/runs/run-deployment/bundle.json"
    ]
  }
} as const;

const maintenanceArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "maintenance-report",
  lifecycleDomain: "maintain",
  summary: "Maintenance report for documentation and dependency hygiene.",
  payload: {
    maintenanceScope: "Docs and dependency hygiene",
    evidenceSources: [
      ".agentops/evidence/dependency-alerts.json",
      ".agentops/evidence/docs-task.md",
      ".agentops/runs/run-release/bundle.json"
    ],
    affectedPackagesOrDocs: ["docs/quickstart.md", "packages/cli"],
    currentFindings: ["README needs clearer first-run guidance"],
    recommendedActions: ["Rewrite quickstart", "Refresh sample repo docs"],
    routingRecommendation: "implementation-proposal",
    followUpWorkflowRefs: ["implementation-proposal", "release-readiness"],
    risks: [
      "Release-linked maintenance follow-up may drift if the latest release report is not revisited.",
      "Docs debt can diverge from implemented behavior if maintenance triage is deferred."
    ],
    priorityAssessment: "high",
    dependencyUpdates: ["vitest@4.1.0"],
    docsUpdates: ["docs/quickstart.md"],
    stalenessSignals: ["example repo path is source-centric"],
    followUpIssues: ["#98", "#100"]
  }
} as const;

const evalArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "eval-result",
  lifecycleDomain: "evaluate",
  summary: "Eval result confirmed deterministic expectations for planning-discovery-local-brief.",
  payload: {
    specId: "planning-discovery-local-brief",
    specName: "Planning discovery emits planning brief",
    workflow: "planning-discovery",
    repoFixture: "blank-local",
    workspacePath: ".agentops/evals/planning-discovery-local-brief/workspace",
    evaluatedRunId: "run-456",
    evaluatedBundlePath: ".agentops/evals/planning-discovery-local-brief/workspace/.agentops/runs/run-456/bundle.json",
    setupRuns: [],
    deterministicChecks: [
      {
        name: "run-status",
        status: "passed",
        expected: "success",
        actual: "success",
        details: "The evaluated workflow completed successfully."
      },
      {
        name: "artifact-kind:planning-brief",
        status: "passed",
        expected: "planning-brief",
        actual: "planning-brief",
        details: "The evaluated bundle emitted the expected lifecycle artifact."
      }
    ],
    modelDependentChecks: [
      {
        name: "rubric-scoring",
        status: "not_executed",
        details: "Provider-dependent scoring is out of scope for the first local eval runner slice."
      }
    ],
    passed: true,
    failureCount: 0,
    warningCount: 0
  }
} as const;

const benchmarkArtifactFixture = {
  ...lifecycleArtifactFixtureBase,
  artifactKind: "benchmark-summary",
  lifecycleDomain: "evaluate",
  summary: "Benchmark summary found 1 deterministic regression across local eval candidates.",
  payload: {
    baselineRunId: "run-100",
    baselineBundlePath: ".agentops/runs/run-100/bundle.json",
    baselineSpecId: "planning-discovery-local-brief",
    baselineWorkflow: "planning-discovery",
    comparedRuns: [
      {
        runId: "run-101",
        bundlePath: ".agentops/runs/run-101/bundle.json",
        specId: "planning-discovery-local-brief",
        workflow: "planning-discovery",
        comparable: true,
        passed: false,
        failureCount: 1,
        deterministicCheckCount: 2,
        regressions: [
          {
            name: "run-status",
            classification: "regression",
            baselineStatus: "passed",
            candidateStatus: "failed",
            details: "Candidate failed a deterministic status expectation that the baseline passed."
          }
        ],
        improvements: [],
        unchangedCount: 1,
        nonComparableFindings: []
      }
    ],
    regressionCount: 1,
    improvementCount: 0,
    unchangedCount: 1,
    nonComparableCount: 0,
    summaryConclusion: "Detected 1 deterministic regression compared with the baseline eval result."
  }
} as const;

const benchmarkLedgerDocumentFixture = {
  schemaVersion: "1.0.0",
  entries: [
    {
      taskId: "task-1",
      taskLink: "https://github.com/H9-Foundry/AgentForge/issues/268#issuecomment-example",
      benchmarkCategory: "release",
      source: "live",
      taskType: "release/deployment",
      arm: "agentforge",
      runId: "1774182026977-5f74df",
      workflow: "planning-discovery",
      agent: "codex",
      startedAt: "2026-03-23T10:00:00.000Z",
      finishedAt: "2026-03-23T10:05:00.000Z",
      cycleTimeSeconds: 300,
      summary: "AgentForge forced a release-evidence follow-up before merge.",
      decisionOutcome: "added_validation",
      decisionImpactReason: "Derived from missing release evidence and required verification checks.",
      agentforgeChangedDecision: true,
      releaseDecision: "conditional",
      decisionClarity: "clear",
      finalRecommendationSummary: "Do not approve release until CI-backed evidence is complete.",
      rerunCount: 1,
      blockedStateCount: 1,
      triggerRefs: [
        {
          runId: "1774182026977-5f74df",
          artifactKind: "release-report",
          section: "required-verification",
          note: "Release report still had missing CI evidence."
        }
      ],
      confirmedRisks: {
        high: 0,
        medium: 1,
        low: 0,
        noisy: 0,
        unresolved: 1
      },
      confirmedRiskRefs: [
        {
          severity: "medium",
          title: "Missing CI evidence before release decision",
          runId: "1774182026977-5f74df",
          artifactKind: "release-report"
        }
      ],
      tokenUsage: {
        provider: "openai",
        model: "gpt-5.4",
        inputTokens: 1200,
        outputTokens: 400,
        totalTokens: 1600,
        estimatedCostUsd: 0.24,
        requestCount: 4
      },
      evidence: {
        present: ["qa-report"],
        missing: ["release-report"],
        partial: ["ci-evidence"]
      },
      evidenceGapRefs: [
        {
          runId: "1774182026977-5f74df",
          artifactKind: "release-report",
          section: "evidence",
          note: "CI evidence was only partial."
        }
      ],
      workflowStatuses: [
        {
          workflow: "planning-discovery",
          status: "success"
        }
      ],
      friction: {
        override: false,
        falsePositivePatterns: [],
        falsePositiveRefs: [],
        manualSteps: [],
        requestFriction: []
      },
      notes: ["AgentForge forced an extra validation pass before merge."]
    }
  ]
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

const securityRequestFixture = {
  targetRef: ".agentops/runs/run-790/bundle.json",
  evidenceSources: [".agentops/runs/run-790/summary.md"],
  focusAreas: ["dependency-risk", "release-readiness"],
  constraints: ["Keep security evidence collection read-only"],
  releaseContext: "candidate"
} as const;

const pipelineRequestFixture = {
  pipelineScope: "Review the bounded CI evidence for the current candidate pipeline set.",
  evidenceSources: [
    ".agentops/evidence/buildkite-ci.json",
    ".agentops/evidence/jenkins-ci.json",
    ".agentops/evidence/generic-ci.json"
  ],
  qaReportRefs: [".agentops/runs/run-789/bundle.json"],
  securityReportRefs: [".agentops/runs/run-790/bundle.json"],
  releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
  issueRefs: ["#245", "#259"],
  focusAreas: ["pipeline-health", "release-risk"],
  constraints: ["Keep pipeline evidence review read-only"]
} as const;

const releaseRequestFixture = {
  releaseScope: "Prepare the 0.7.0 candidate for maintainer review",
  versionTargets: [{ name: "@h9-foundry/agentforge-cli", version: "0.7.0" }],
  qaReportRefs: [".agentops/runs/run-789/bundle.json"],
  securityReportRefs: [".agentops/runs/run-790/bundle.json"],
  evidenceSources: [".agentops/runs/run-790/summary.md"],
  constraints: ["Keep release readiness read-only by default"]
} as const;

const deploymentRequestFixture = {
  deploymentScope: "Review the staging deployment gate for the current release candidate.",
  targetEnvironment: "staging",
  evidenceSources: [
    ".agentops/evidence/buildkite-ci.json",
    ".agentops/evidence/jenkins-ci.json",
    ".agentops/evidence/generic-ci.json"
  ],
  qaReportRefs: [".agentops/runs/run-789/bundle.json"],
  securityReportRefs: [".agentops/runs/run-790/bundle.json"],
  releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
  pipelineReportRefs: [".agentops/runs/run-pipeline/bundle.json"],
  issueRefs: ["#245", "#260"],
  constraints: ["Keep deployment gate review read-only"]
} as const;

const promotionRequestFixture = {
  promotionScope: "Review approval readiness for promoting the current release candidate.",
  targetEnvironment: "production",
  evidenceSources: [
    ".agentops/evidence/jenkins-ci.json",
    ".agentops/evidence/generic-ci.json"
  ],
  qaReportRefs: [".agentops/runs/run-789/bundle.json"],
  securityReportRefs: [".agentops/runs/run-790/bundle.json"],
  releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
  deploymentGateReportRefs: [".agentops/runs/run-deployment/bundle.json"],
  issueRefs: ["#245", "#261"],
  constraints: ["Keep promotion approval review read-only"]
} as const;

const incidentRequestFixture = {
  incidentSummary: "Customers saw elevated 500s after the last release candidate.",
  severityHint: "high",
  evidenceSources: [".agentops/evidence/incident-summary.md", ".agentops/evidence/alerts.json"],
  releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
  issueRefs: ["#144"],
  constraints: ["Keep staged incident evidence read-only"]
} as const;

const maintenanceRequestFixture = {
  maintenanceGoal: "Triage dependency and docs hygiene follow-up after the latest release.",
  dependencyAlertRefs: [".agentops/evidence/dependency-alerts.json"],
  docsTaskRefs: [".agentops/evidence/docs-task.md"],
  releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
  issueRefs: ["#145"],
  constraints: ["Keep maintenance triage read-only"]
} as const;

const normalizedValidationCommandFixture = {
  command: "pnpm test",
  source: "request",
  classification: "approval_required",
  reason: "Requested command matches a discovered allowlisted validation script."
} as const;

const githubReferenceFixture = {
  platform: "github",
  host: "github.com",
  owner: "H9-Foundry",
  repo: "AgentForge",
  kind: "issue",
  number: 142,
  canonical: "H9-Foundry/AgentForge#142",
  url: "https://github.com/H9-Foundry/AgentForge/issues/142",
  source: "#142"
} as const;

const scmReferenceFixture = {
  platform: "github",
  host: "github.com",
  namespace: "H9-Foundry",
  repo: "AgentForge",
  kind: "issue",
  identifier: "142",
  number: 142,
  canonical: "github.com/H9-Foundry/AgentForge#142",
  url: "https://github.com/H9-Foundry/AgentForge/issues/142",
  source: "#142"
} as const;

const gitlabIssueScmReferenceFixture = {
  platform: "gitlab",
  host: "gitlab.com",
  namespace: "h9-foundry/platform",
  repo: "agentforge",
  kind: "issue",
  identifier: "123",
  number: 123,
  canonical: "gitlab.com/h9-foundry/platform/agentforge#123",
  url: "https://gitlab.com/h9-foundry/platform/agentforge/-/issues/123",
  source: "#123"
} as const;

const gitlabMergeRequestScmReferenceFixture = {
  platform: "gitlab",
  host: "gitlab.com",
  namespace: "h9-foundry/platform",
  repo: "agentforge",
  kind: "merge_request",
  identifier: "45",
  number: 45,
  canonical: "gitlab.com/h9-foundry/platform/agentforge!45",
  url: "https://gitlab.com/h9-foundry/platform/agentforge/-/merge_requests/45",
  source: "!45"
} as const;

const githubWorkflowStatusMappingFixture = {
  workflow: "planning-discovery",
  localRunStatus: "success",
  githubStatus: "completed",
  reason: "Successful local workflow runs map to completed GitHub handoff status."
} as const;

const githubActionsEvidenceFixture = {
  sourcePath: ".agentops/evidence/github-actions-ci.json",
  repository: "H9-Foundry/AgentForge",
  workflowName: "CI",
  workflowRunId: 123456789,
  runAttempt: 1,
  event: "pull_request",
  headBranch: "main",
  headSha: "caf36447a49fc6e9fc308c34b98424958237aa1e",
  status: "completed",
  conclusion: "failure",
  htmlUrl: "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789",
  jobs: [
    {
      name: "test",
      status: "completed",
      conclusion: "success",
      htmlUrl: "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789/job/1"
    },
    {
      name: "lint",
      status: "completed",
      conclusion: "failure",
      htmlUrl: "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789/job/2"
    }
  ],
  checkRuns: [
    {
      name: "validate-public-packages",
      status: "completed",
      conclusion: "success",
      detailsUrl: "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789/job/3"
    }
  ]
} as const;

const ciEvidenceFixture = {
  platform: "github-actions",
  providerName: "GitHub Actions",
  host: "github.com",
  repository: "H9-Foundry/AgentForge",
  pipelineName: "CI",
  pipelineRunId: "123456789",
  runAttempt: 1,
  event: "pull_request",
  branch: "main",
  commitSha: "caf36447a49fc6e9fc308c34b98424958237aa1e",
  status: "completed",
  conclusion: "failure",
  htmlUrl: "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789",
  jobs: [
    {
      name: "test",
      status: "completed",
      conclusion: "success",
      htmlUrl: "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789/job/1"
    },
    {
      name: "lint",
      status: "completed",
      conclusion: "failure",
      htmlUrl: "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789/job/2"
    }
  ],
  artifacts: [],
  provenanceSource: "local-export"
} as const;

const gitlabCiEvidenceExportFixture = {
  sourcePath: ".agentops/evidence/gitlab-ci.json",
  host: "gitlab.com",
  projectPath: "h9-foundry/platform/agentforge",
  pipelineId: 987654321,
  pipelineName: "GitLab CI",
  runAttempt: 1,
  event: "merge_request_event",
  branch: "main",
  commitSha: "caf36447a49fc6e9fc308c34b98424958237aa1e",
  status: "failed",
  webUrl: "https://gitlab.com/h9-foundry/platform/agentforge/-/pipelines/987654321",
  jobs: [
    {
      name: "test",
      status: "success",
      webUrl: "https://gitlab.com/h9-foundry/platform/agentforge/-/jobs/1"
    },
    {
      name: "lint",
      status: "failed",
      webUrl: "https://gitlab.com/h9-foundry/platform/agentforge/-/jobs/2"
    }
  ]
} as const;

const gitlabCiEvidenceFixture = {
  platform: "gitlab-ci",
  providerName: "GitLab CI",
  host: "gitlab.com",
  repository: "h9-foundry/platform/agentforge",
  pipelineName: "GitLab CI",
  pipelineRunId: "987654321",
  runAttempt: 1,
  event: "merge_request_event",
  branch: "main",
  commitSha: "caf36447a49fc6e9fc308c34b98424958237aa1e",
  status: "completed",
  conclusion: "failure",
  htmlUrl: "https://gitlab.com/h9-foundry/platform/agentforge/-/pipelines/987654321",
  jobs: [
    {
      name: "test",
      status: "completed",
      conclusion: "success",
      htmlUrl: "https://gitlab.com/h9-foundry/platform/agentforge/-/jobs/1"
    },
    {
      name: "lint",
      status: "completed",
      conclusion: "failure",
      htmlUrl: "https://gitlab.com/h9-foundry/platform/agentforge/-/jobs/2"
    }
  ],
  artifacts: [],
  provenanceSource: "local-export"
} as const;

const buildkiteCiEvidenceExportFixture = {
  sourcePath: ".agentops/evidence/buildkite-ci.json",
  providerName: "Buildkite",
  host: "buildkite.local",
  repository: "h9-foundry/platform/agentforge",
  pipelineName: "Buildkite CI",
  pipelineRunId: "bk-123",
  runAttempt: 1,
  event: "pull_request",
  branch: "main",
  commitSha: "caf36447a49fc6e9fc308c34b98424958237aa1e",
  status: "completed",
  conclusion: "failure",
  htmlUrl: "https://buildkite.example.com/organizations/h9-foundry/pipelines/agentforge/builds/123",
  jobs: [
    {
      name: "test",
      status: "completed",
      conclusion: "success",
      htmlUrl: "https://buildkite.example.com/organizations/h9-foundry/pipelines/agentforge/builds/123/jobs/1"
    },
    {
      name: "lint",
      status: "completed",
      conclusion: "failure",
      htmlUrl: "https://buildkite.example.com/organizations/h9-foundry/pipelines/agentforge/builds/123/jobs/2"
    }
  ],
  artifacts: [
    {
      name: "junit-report",
      type: "junit-xml",
      path: "artifacts/junit.xml"
    }
  ]
} as const;

const buildkiteCiEvidenceFixture = {
  platform: "buildkite",
  providerName: "Buildkite",
  host: "buildkite.local",
  repository: "h9-foundry/platform/agentforge",
  pipelineName: "Buildkite CI",
  pipelineRunId: "bk-123",
  runAttempt: 1,
  event: "pull_request",
  branch: "main",
  commitSha: "caf36447a49fc6e9fc308c34b98424958237aa1e",
  status: "completed",
  conclusion: "failure",
  htmlUrl: "https://buildkite.example.com/organizations/h9-foundry/pipelines/agentforge/builds/123",
  jobs: [
    {
      name: "test",
      status: "completed",
      conclusion: "success",
      htmlUrl: "https://buildkite.example.com/organizations/h9-foundry/pipelines/agentforge/builds/123/jobs/1"
    },
    {
      name: "lint",
      status: "completed",
      conclusion: "failure",
      htmlUrl: "https://buildkite.example.com/organizations/h9-foundry/pipelines/agentforge/builds/123/jobs/2"
    }
  ],
  artifacts: [
    {
      name: "junit-report",
      type: "junit-xml",
      path: "artifacts/junit.xml"
    }
  ],
  provenanceSource: "local-export"
} as const;

const jenkinsCiEvidenceExportFixture = {
  sourcePath: ".agentops/evidence/jenkins-ci.json",
  providerName: "Jenkins",
  host: "jenkins.local",
  repository: "h9-foundry/platform/agentforge",
  pipelineName: "Jenkins CI",
  pipelineRunId: "jenkins-42",
  runAttempt: 1,
  event: "push",
  branch: "main",
  commitSha: "caf36447a49fc6e9fc308c34b98424958237aa1e",
  status: "completed",
  conclusion: "success",
  htmlUrl: "https://jenkins.example.com/job/agentforge/42",
  jobs: [
    {
      name: "test",
      status: "completed",
      conclusion: "success",
      htmlUrl: "https://jenkins.example.com/job/agentforge/42/test"
    }
  ],
  artifacts: [
    {
      name: "coverage-report",
      type: "html-report",
      path: "artifacts/coverage/index.html"
    }
  ]
} as const;

const jenkinsCiEvidenceFixture = {
  platform: "jenkins-ci",
  providerName: "Jenkins",
  host: "jenkins.local",
  repository: "h9-foundry/platform/agentforge",
  pipelineName: "Jenkins CI",
  pipelineRunId: "jenkins-42",
  runAttempt: 1,
  event: "push",
  branch: "main",
  commitSha: "caf36447a49fc6e9fc308c34b98424958237aa1e",
  status: "completed",
  conclusion: "success",
  htmlUrl: "https://jenkins.example.com/job/agentforge/42",
  jobs: [
    {
      name: "test",
      status: "completed",
      conclusion: "success",
      htmlUrl: "https://jenkins.example.com/job/agentforge/42/test"
    }
  ],
  artifacts: [
    {
      name: "coverage-report",
      type: "html-report",
      path: "artifacts/coverage/index.html"
    }
  ],
  provenanceSource: "local-export"
} as const;

const genericCiEvidenceExportFixture = {
  sourcePath: ".agentops/evidence/generic-ci.json",
  providerName: "CircleCI",
  host: "circleci.local",
  repository: "h9-foundry/platform/agentforge",
  pipelineName: "CircleCI",
  pipelineRunId: "circleci-42",
  runAttempt: 1,
  event: "push",
  branch: "main",
  commitSha: "caf36447a49fc6e9fc308c34b98424958237aa1e",
  status: "completed",
  conclusion: "success",
  htmlUrl: "https://circleci.example.com/pipelines/github/h9-foundry/platform/agentforge/42",
  jobs: [
    {
      name: "test",
      status: "completed",
      conclusion: "success",
      htmlUrl: "https://circleci.example.com/pipelines/github/h9-foundry/platform/agentforge/42/workflows/test"
    }
  ],
  artifacts: [
    {
      name: "coverage-report",
      type: "html-report",
      path: "artifacts/coverage/index.html"
    }
  ]
} as const;

const genericCiEvidenceFixture = {
  platform: "generic-ci",
  providerName: "CircleCI",
  host: "circleci.local",
  repository: "h9-foundry/platform/agentforge",
  pipelineName: "CircleCI",
  pipelineRunId: "circleci-42",
  runAttempt: 1,
  event: "push",
  branch: "main",
  commitSha: "caf36447a49fc6e9fc308c34b98424958237aa1e",
  status: "completed",
  conclusion: "success",
  htmlUrl: "https://circleci.example.com/pipelines/github/h9-foundry/platform/agentforge/42",
  jobs: [
    {
      name: "test",
      status: "completed",
      conclusion: "success",
      htmlUrl: "https://circleci.example.com/pipelines/github/h9-foundry/platform/agentforge/42/workflows/test"
    }
  ],
  artifacts: [
    {
      name: "coverage-report",
      type: "html-report",
      path: "artifacts/coverage/index.html"
    }
  ],
  provenanceSource: "local-export"
} as const;

const adapterCapabilityMetadataFixture = {
  platform: "github",
  host: "github.com",
  supportedScmReferenceKinds: ["issue", "pull_request"],
  supportedCiPlatforms: ["github-actions"],
  capabilities: [
    "issue-reference-normalization",
    "pull-request-reference-normalization",
    "local-ci-evidence-ingestion"
  ],
  trustBoundary: "local-only"
} as const;

const gitlabAdapterCapabilityMetadataFixture = {
  platform: "gitlab",
  host: "gitlab.com",
  supportedScmReferenceKinds: ["issue", "merge_request"],
  supportedCiPlatforms: ["gitlab-ci"],
  capabilities: [
    "issue-reference-normalization",
    "merge-request-reference-normalization",
    "local-ci-evidence-ingestion"
  ],
  trustBoundary: "local-only"
} as const;

const buildkiteAdapterCapabilityMetadataFixture = {
  platform: "generic",
  host: "buildkite.local",
  supportedScmReferenceKinds: [],
  supportedCiPlatforms: ["buildkite"],
  capabilities: ["local-ci-evidence-ingestion"],
  trustBoundary: "local-only"
} as const;

const jenkinsAdapterCapabilityMetadataFixture = {
  platform: "generic",
  host: "jenkins.local",
  supportedScmReferenceKinds: [],
  supportedCiPlatforms: ["jenkins-ci"],
  capabilities: ["local-ci-evidence-ingestion"],
  trustBoundary: "local-only"
} as const;

const genericCiAdapterCapabilityMetadataFixture = {
  platform: "generic",
  host: "local-ci-export",
  supportedScmReferenceKinds: [],
  supportedCiPlatforms: ["generic-ci"],
  capabilities: ["local-ci-evidence-ingestion"],
  trustBoundary: "local-only"
} as const;

const githubHandoffSummaryFixture = {
  artifactKind: "planning-brief",
  workflow: "planning-discovery",
  githubStatus: "completed",
  title: "Planning handoff for H9-Foundry/AgentForge#78",
  summary: "Planning brief scoped the next bounded workflow slice.",
  body: [
    "Planning handoff for `planning-discovery`.",
    "",
    "Summary:",
    "- Planning brief scoped the next bounded workflow slice."
  ].join("\n"),
  issueRefs: [githubReferenceFixture],
  pullRequestRefs: [],
  provenanceRefs: [".agentops/runs/run-123/bundle.json", "docs/ROADMAP.md"],
  sections: [
    {
      heading: "Summary",
      lines: ["Planning brief scoped the next bounded workflow slice."]
    }
  ]
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

const qaEvidenceNormalizationFixture = {
  targetRef: ".agentops/runs/run-789/bundle.json",
  targetType: "artifact-bundle",
  referencedArtifactKinds: ["implementation-proposal"],
  normalizedEvidenceSources: [".agentops/runs/run-789/bundle.json", ".agentops/runs/run-789/summary.md"],
  missingEvidenceSources: [],
  normalizedExecutedChecks: ["pnpm test"],
  unrecognizedExecutedChecks: [],
  affectedPackages: ["packages/cli"],
  allowedValidationCommands: [
    normalizedValidationCommandFixture,
    {
      command: "pnpm build",
      source: "package-script",
      classification: "approval_required",
      reason: "Discovered from a bounded repository script; execution would still require approval."
    }
  ],
  ciEvidence: [gitlabCiEvidenceFixture],
  githubActions: {
    evidence: [githubActionsEvidenceFixture],
    workflowNames: ["CI"],
    failingChecks: ["CI / lint"],
    provenanceRefs: [
      ".agentops/evidence/github-actions-ci.json",
      "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789",
      "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789/job/1",
      "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789/job/2",
      "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789/job/3"
    ]
  }
} as const;

const dependencyIntegrityEvidenceFixture = {
  inventoryFormat: "workspace-inventory",
  packageManager: "pnpm",
  integrityStatus: "verified-lockfile",
  lockfilePath: "pnpm-lock.yaml",
  manifestPaths: ["package.json", "packages/cli/package.json"],
  packageNames: ["fixture", "@h9-foundry/agentforge-cli"],
  packageCount: 2,
  dependencyEntryCount: 4,
  inventoryEntries: [
    {
      manifestPath: "package.json",
      packageName: "fixture",
      dependencyName: "typescript",
      dependencyType: "devDependencies",
      requestedVersion: "^5.8.0"
    },
    {
      manifestPath: "package.json",
      packageName: "fixture",
      dependencyName: "vitest",
      dependencyType: "devDependencies",
      requestedVersion: "^4.1.0"
    },
    {
      manifestPath: "packages/cli/package.json",
      packageName: "@h9-foundry/agentforge-cli",
      dependencyName: "@h9-foundry/agentforge-schemas",
      dependencyType: "dependencies",
      requestedVersion: "workspace:*"
    },
    {
      manifestPath: "packages/cli/package.json",
      packageName: "@h9-foundry/agentforge-cli",
      dependencyName: "@h9-foundry/agentforge-shared-types",
      dependencyType: "dependencies",
      requestedVersion: "workspace:*"
    }
  ],
  provenanceSource: "workspace-scan",
  provenanceRefs: ["package.json", "packages/cli/package.json", "pnpm-lock.yaml"]
} as const;

const attestationVerificationEvidenceFixture = {
  sourcePath: ".agentops/evidence/attestation-verification.json",
  verifier: "github-artifact-attestation",
  subject: "@h9-foundry/agentforge-cli@0.7.0",
  issuer: "https://token.actions.githubusercontent.com",
  status: "verified",
  detail: "Verified GitHub artifact attestation for the release package artifact.",
  predicateType: "https://slsa.dev/provenance/v1",
  verifiedAt: "2026-03-19T12:45:00.000Z",
  provenanceRefs: [
    ".agentops/evidence/attestation-verification.json",
    "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789"
  ]
} as const;

const securityEvidenceNormalizationFixture = {
  targetRef: ".agentops/runs/run-790/bundle.json",
  targetType: "artifact-bundle",
  referencedArtifactKinds: ["implementation-proposal"],
  normalizedEvidenceSources: [".agentops/runs/run-790/bundle.json", ".agentops/runs/run-790/summary.md"],
  missingEvidenceSources: [],
  normalizedFocusAreas: ["dependency-risk", "release-readiness"],
  securitySignals: [
    "Referenced artifact kinds: implementation-proposal",
    "Affected packages inferred from bounded artifact payloads: packages/cli, packages/runtime",
    "Dependency inventory covers 2 manifest(s) with 4 declared dependency entries.",
    "Workspace dependency integrity is verified against pnpm-lock.yaml."
  ],
  dependencyIntegrityEvidence: [dependencyIntegrityEvidenceFixture],
  provenanceRefs: [
    ".agentops/runs/run-790/bundle.json#implementation-proposal",
    ".agentops/runs/run-790/summary.md",
    "package.json",
    "packages/cli/package.json",
    "pnpm-lock.yaml"
  ],
  affectedPackages: ["packages/cli", "packages/runtime"]
} as const;

const incidentEvidenceNormalizationFixture = {
  incidentSummary: "Customers saw elevated 500s after the last release candidate.",
  severityHint: "high",
  normalizedEvidenceSources: [
    ".agentops/evidence/incident-summary.md",
    ".agentops/evidence/alerts.json",
    ".agentops/runs/run-release/bundle.json"
  ],
  missingEvidenceSources: [],
  releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
  timelineSummary: [
    "Severity hint: high.",
    "Normalized staged incident evidence and release-report references before reasoning.",
    "Observed source .agentops/evidence/incident-summary.md during deterministic intake.",
    "Observed source .agentops/evidence/alerts.json during deterministic intake.",
    "Observed source .agentops/runs/run-release/bundle.json during deterministic intake."
  ],
  likelyImpactedAreas: ["release-readiness", "staged-operational-evidence", "security-follow-up"],
  followUpWorkflowRefs: ["maintenance-triage", "release-readiness", "security-review"],
  provenanceRefs: [
    ".agentops/evidence/incident-summary.md",
    ".agentops/evidence/alerts.json",
    ".agentops/runs/run-release/bundle.json#release-report"
  ],
  redactionCategories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key", "operational-sensitive"],
  referencedArtifactKinds: ["release-report"]
} as const;

const maintenanceEvidenceNormalizationFixture = {
  maintenanceGoal: "Triage dependency and docs hygiene follow-up after the latest release.",
  dependencyAlertRefs: [".agentops/evidence/dependency-alerts.json"],
  docsTaskRefs: [".agentops/evidence/docs-task.md"],
  releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
  normalizedEvidenceSources: [
    ".agentops/evidence/dependency-alerts.json",
    ".agentops/evidence/docs-task.md",
    ".agentops/runs/run-release/bundle.json"
  ],
  missingEvidenceSources: [],
  referencedArtifactKinds: ["release-report"],
  affectedPackagesOrDocs: ["docs/quickstart.md", "packages/cli"],
  maintenanceSignals: [
    "Observed source .agentops/evidence/dependency-alerts.json during deterministic intake.",
    "Observed source .agentops/evidence/docs-task.md during deterministic intake.",
    "Observed source .agentops/runs/run-release/bundle.json during deterministic intake.",
    "Release report references contribute bounded maintenance follow-up context."
  ],
  followUpWorkflowRefs: ["implementation-proposal", "release-readiness"],
  routingRecommendation: "implementation-proposal",
  provenanceRefs: [
    ".agentops/evidence/dependency-alerts.json",
    ".agentops/evidence/docs-task.md",
    ".agentops/runs/run-release/bundle.json#release-report"
  ]
} as const;

const evalFixtureCorpusFixture = {
  schemaVersion: "1.0.0",
  generatedAt: "2026-03-18T12:00:00.000Z",
  specs: [
    {
      schemaVersion: "1.0.0",
      id: "pr-review-local-baseline",
      name: "PR review local baseline",
      workflow: "pr-review",
      description: "Baseline deterministic expectations for the official PR review wedge.",
      repoFixture: "agentforge-monorepo",
      expectedStatus: "success",
      notes: ["No lifecycle artifact is emitted in the current official PR review wedge."],
      policyExpectations: {
        executionMode: "inspect",
        readOnly: true,
        sideEffectClasses: ["observe", "suggest"],
        approvalRequiredActions: []
      },
      redactionExpectations: {
        applied: true,
        expectedCategories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key"]
      },
      artifactExpectations: []
    },
    {
      schemaVersion: "1.0.0",
      id: "planning-discovery-local-brief",
      name: "Planning discovery emits planning brief",
      workflow: "planning-discovery",
      description: "Deterministic expectations for the first official planning workflow.",
      repoFixture: "blank-local",
      expectedStatus: "success",
      request: {
        problemStatement: "Define the first planning-discovery workflow wedge.",
        goals: ["Produce one planning brief artifact"],
        constraints: ["Keep the workflow local-first and read-only"],
        issueRefs: ["#127", "#128"],
        pathHints: ["packages/cli", "packages/runtime", "docs/PLANNING_DISCOVERY_WORKFLOW.md"],
        assumptions: ["CLI-first execution remains the evaluator path"]
      },
      notes: ["The CLI-first local path should remain read-only by default."],
      policyExpectations: {
        executionMode: "inspect",
        readOnly: true,
        sideEffectClasses: ["observe", "suggest"],
        approvalRequiredActions: []
      },
      redactionExpectations: {
        applied: true,
        expectedCategories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key"]
      },
      artifactExpectations: [
        {
          artifactKind: "planning-brief",
          lifecycleDomain: "plan",
          requiredPayloadFields: ["problemStatement", "objectives", "recommendedNextSteps"],
          requiredSummaryTerms: ["planning", "brief"]
        }
      ]
    },
    {
      schemaVersion: "1.0.0",
      id: "architecture-design-review-local-record",
      name: "Architecture design review emits design record",
      workflow: "architecture-design-review",
      description: "Deterministic expectations for the first official design workflow.",
      repoFixture: "blank-local",
      expectedStatus: "success",
      request: {
        planningBriefRef: ".agentops/runs/run-123/bundle.json",
        decisionTarget: "Choose the first planning workflow implementation shape.",
        constraints: ["Keep deterministic intake validation before reasoning"],
        pathHints: ["packages/schemas", "packages/runtime", "packages/cli"],
        alternatives: ["single-agent workflow", "deterministic intake plus reasoning"],
        questions: ["How should planning artifacts be referenced downstream?"]
      },
      notes: ["Design review requires a prior planning brief reference."],
      policyExpectations: {
        executionMode: "inspect",
        readOnly: true,
        sideEffectClasses: ["observe", "suggest"],
        approvalRequiredActions: []
      },
      redactionExpectations: {
        applied: true,
        expectedCategories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key"]
      },
      artifactExpectations: [
        {
          artifactKind: "design-record",
          lifecycleDomain: "design",
          requiredPayloadFields: ["decisionSummary", "chosenApproach", "optionsConsidered"],
          requiredSummaryTerms: ["design", "record"]
        }
      ]
    },
    {
      schemaVersion: "1.0.0",
      id: "implementation-proposal-local-plan",
      name: "Implementation proposal emits implementation artifact",
      workflow: "implementation-proposal",
      description: "Deterministic expectations for the official implementation workflow.",
      repoFixture: "blank-local",
      expectedStatus: "success",
      request: implementationRequestFixture,
      notes: ["The initial implementation wedge is proposal-only and read-only."],
      policyExpectations: {
        executionMode: "inspect",
        readOnly: true,
        sideEffectClasses: ["observe", "suggest"],
        approvalRequiredActions: ["Any validation command execution remains approval-gated."]
      },
      redactionExpectations: {
        applied: true,
        expectedCategories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key"]
      },
      artifactExpectations: [
        {
          artifactKind: "implementation-proposal",
          lifecycleDomain: "build",
          requiredPayloadFields: ["designRecordRef", "implementationGoal", "validationPlan"],
          requiredSummaryTerms: ["implementation", "proposal"]
        }
      ]
    },
    {
      schemaVersion: "1.0.0",
      id: "qa-review-local-report",
      name: "QA review emits qa report",
      workflow: "qa-review",
      description: "Deterministic expectations for the official QA workflow.",
      repoFixture: "blank-local",
      expectedStatus: "success",
      request: qaRequestFixture,
      notes: ["QA remains bounded to validated local evidence and normalized check references."],
      policyExpectations: {
        executionMode: "inspect",
        readOnly: true,
        sideEffectClasses: ["observe", "suggest"],
        approvalRequiredActions: ["Executing new validation commands remains approval-gated."]
      },
      redactionExpectations: {
        applied: true,
        expectedCategories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key"]
      },
      artifactExpectations: [
        {
          artifactKind: "qa-report",
          lifecycleDomain: "test",
          requiredPayloadFields: ["targetRef", "evidenceSources", "recommendedNextChecks"],
          requiredSummaryTerms: ["QA", "report"]
        }
      ]
    },
    {
      schemaVersion: "1.0.0",
      id: "security-review-local-report",
      name: "Security review emits security report",
      workflow: "security-review",
      description: "Deterministic expectations for the official security workflow.",
      repoFixture: "blank-local",
      expectedStatus: "success",
      request: securityRequestFixture,
      notes: ["Security review remains read-only and more restrictive than generic review wedges."],
      policyExpectations: {
        executionMode: "inspect",
        readOnly: true,
        sideEffectClasses: ["observe", "suggest"],
        approvalRequiredActions: []
      },
      redactionExpectations: {
        applied: true,
        expectedCategories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key"]
      },
      artifactExpectations: [
        {
          artifactKind: "security-report",
          lifecycleDomain: "security",
          requiredPayloadFields: ["targetRef", "severitySummary", "releaseImpact"],
          requiredSummaryTerms: ["security", "report"]
        }
      ]
    },
    {
      schemaVersion: "1.0.0",
      id: "maintenance-triage-local-report",
      name: "Maintenance triage emits maintenance report",
      workflow: "maintenance-triage",
      description: "Deterministic expectations for the official maintenance workflow.",
      repoFixture: "blank-local",
      expectedStatus: "success",
      request: maintenanceRequestFixture,
      notes: ["Maintenance triage stays read-only and routes work without applying dependency or docs changes."],
      policyExpectations: {
        executionMode: "inspect",
        readOnly: true,
        sideEffectClasses: ["observe", "suggest"],
        approvalRequiredActions: []
      },
      redactionExpectations: {
        applied: true,
        expectedCategories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key"]
      },
      artifactExpectations: [
        {
          artifactKind: "maintenance-report",
          lifecycleDomain: "maintain",
          requiredPayloadFields: ["maintenanceScope", "routingRecommendation", "priorityAssessment"],
          requiredSummaryTerms: ["maintenance", "report"]
        }
      ]
    }
  ]
} as const;

const releaseEvidenceNormalizationFixture = {
  qaReportRefs: [".agentops/runs/run-789/bundle.json"],
  securityReportRefs: [".agentops/runs/run-790/bundle.json"],
  normalizedEvidenceSources: [
    ".agentops/runs/run-789/bundle.json",
    ".agentops/runs/run-790/bundle.json",
    ".agentops/runs/run-790/summary.md",
    ".agentops/evidence/buildkite-ci.json",
    ".agentops/evidence/jenkins-ci.json",
    ".agentops/evidence/generic-ci.json"
  ],
  missingEvidenceSources: [],
  ciEvidence: [buildkiteCiEvidenceFixture, jenkinsCiEvidenceFixture, genericCiEvidenceFixture],
  ciEvidenceSummary: [
    {
      provider: "Buildkite",
      platform: "buildkite",
      host: "buildkite.com",
      repository: "H9-Foundry/AgentForge",
      pipelineName: "release",
      pipelineRunId: "bk-42",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "abc123",
      failingChecks: [],
      provenanceSource: "local-export",
      displayLabel: "Buildkite (buildkite) pipeline `release` run `bk-42`",
      statusSummary: "Buildkite (buildkite) pipeline `release` run `bk-42` completed from local-export evidence with success."
    },
    {
      provider: "Jenkins",
      platform: "jenkins-ci",
      host: "jenkins.local",
      repository: "H9-Foundry/AgentForge",
      pipelineName: "Jenkins CI",
      pipelineRunId: "jenkins-42",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "abc123",
      failingChecks: [],
      provenanceSource: "local-export",
      displayLabel: "Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42`",
      statusSummary: "Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42` completed from local-export evidence with success."
    },
    {
      provider: "CircleCI",
      platform: "generic-ci",
      host: "circleci.local",
      repository: "H9-Foundry/AgentForge",
      pipelineName: "CircleCI",
      pipelineRunId: "circleci-42",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "abc123",
      failingChecks: [],
      provenanceSource: "local-export",
      displayLabel: "CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42`",
      statusSummary: "CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42` completed from local-export evidence with success."
    }
  ],
  dependencyIntegrityEvidence: [dependencyIntegrityEvidenceFixture],
  attestationVerificationEvidence: [attestationVerificationEvidenceFixture],
  versionResolutions: [
    {
      name: "@h9-foundry/agentforge-cli",
      targetVersion: "0.7.0",
      currentVersion: "0.6.0",
      status: "pending-version-bump"
    }
  ],
  localReadinessChecks: [
    { name: "qa-report-refs", status: "passed", detail: "Using one validated QA report reference." },
    { name: "security-report-refs", status: "passed", detail: "Using one validated security report reference." },
    { name: "dependency-integrity", status: "passed", detail: "Dependency inventory is verified against pnpm-lock.yaml." },
    { name: "attestation-verification", status: "passed", detail: "Verified 1 attestation or provenance evidence export." },
    { name: "workspace-version-targets", status: "passed", detail: "Resolved one workspace version target." }
  ],
  readinessStatus: "ready",
  approvalRecommendations: [
    {
      action: "publish-packages",
      classification: "approval_required",
      reason: "Package publication remains outside the default read-only workflow path."
    },
    {
      action: "promote-release",
      classification: "approval_required",
      reason: "Promotion remains a release-significant side effect and requires explicit maintainer approval."
    }
  ],
  trustSummary: [
    "Verified 1 attestation or provenance evidence export.",
    "Trusted publishing remains reviewed separately from bounded attestation verification."
  ],
  provenanceRefs: [
    ".agentops/runs/run-789/bundle.json",
    ".agentops/runs/run-790/bundle.json",
    ".agentops/runs/run-790/summary.md",
    "package.json",
    "packages/cli/package.json",
    ".agentops/evidence/attestation-verification.json",
    "https://github.com/H9-Foundry/AgentForge/actions/runs/123456789"
  ]
} as const;

const pipelineEvidenceNormalizationFixture = {
  qaReportRefs: [".agentops/runs/run-789/bundle.json"],
  securityReportRefs: [".agentops/runs/run-790/bundle.json"],
  releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
  normalizedEvidenceSources: [
    ".agentops/runs/run-789/bundle.json",
    ".agentops/runs/run-790/bundle.json",
    ".agentops/runs/run-release/bundle.json",
    ".agentops/evidence/buildkite-ci.json",
    ".agentops/evidence/jenkins-ci.json",
    ".agentops/evidence/generic-ci.json"
  ],
  missingEvidenceSources: [],
  ciEvidence: [buildkiteCiEvidenceFixture, jenkinsCiEvidenceFixture, genericCiEvidenceFixture],
  ciEvidenceSummary: pipelineArtifactFixture.payload.ciEvidenceSummary,
  referencedArtifactKinds: ["qa-report", "security-report", "release-report"],
  verificationChecks: [
    { name: "imported-ci-evidence", status: "passed", detail: "Using three imported CI evidence exports." },
    { name: "referenced-artifacts", status: "passed", detail: "Validated referenced QA, security, and release artifacts." }
  ],
  reviewStatus: "needs_follow_up",
  provenanceRefs: [
    ".agentops/runs/run-789/bundle.json",
    ".agentops/runs/run-790/bundle.json",
    ".agentops/runs/run-release/bundle.json",
    ".agentops/evidence/buildkite-ci.json",
    ".agentops/evidence/jenkins-ci.json",
    ".agentops/evidence/generic-ci.json"
  ]
} as const;

const deploymentGateEvidenceNormalizationFixture = {
  qaReportRefs: [".agentops/runs/run-789/bundle.json"],
  securityReportRefs: [".agentops/runs/run-790/bundle.json"],
  releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
  pipelineReportRefs: [".agentops/runs/run-pipeline/bundle.json"],
  normalizedEvidenceSources: [
    ".agentops/runs/run-789/bundle.json",
    ".agentops/runs/run-790/bundle.json",
    ".agentops/runs/run-release/bundle.json",
    ".agentops/runs/run-pipeline/bundle.json",
    ".agentops/evidence/buildkite-ci.json",
    ".agentops/evidence/jenkins-ci.json",
    ".agentops/evidence/generic-ci.json"
  ],
  missingEvidenceSources: [],
  ciEvidence: [buildkiteCiEvidenceFixture, jenkinsCiEvidenceFixture, genericCiEvidenceFixture],
  ciEvidenceSummary: pipelineArtifactFixture.payload.ciEvidenceSummary,
  referencedArtifactKinds: ["qa-report", "security-report", "release-report", "pipeline-report"],
  verificationChecks: [
    { name: "imported-ci-evidence", status: "passed", detail: "Using three imported CI evidence exports." },
    { name: "referenced-artifacts", status: "passed", detail: "Validated referenced QA, security, release, and pipeline artifacts." }
  ],
  gateStatus: "conditionally_ready",
  provenanceRefs: [
    ".agentops/runs/run-789/bundle.json",
    ".agentops/runs/run-790/bundle.json",
    ".agentops/runs/run-release/bundle.json",
    ".agentops/runs/run-pipeline/bundle.json",
    ".agentops/evidence/buildkite-ci.json",
    ".agentops/evidence/jenkins-ci.json",
    ".agentops/evidence/generic-ci.json"
  ]
} as const;

const promotionApprovalEvidenceNormalizationFixture = {
  qaReportRefs: [".agentops/runs/run-789/bundle.json"],
  securityReportRefs: [".agentops/runs/run-790/bundle.json"],
  releaseReportRefs: [".agentops/runs/run-release/bundle.json"],
  deploymentGateReportRefs: [".agentops/runs/run-deployment/bundle.json"],
  normalizedEvidenceSources: [
    ".agentops/runs/run-789/bundle.json",
    ".agentops/runs/run-790/bundle.json",
    ".agentops/runs/run-release/bundle.json",
    ".agentops/runs/run-deployment/bundle.json",
    ".agentops/evidence/jenkins-ci.json",
    ".agentops/evidence/generic-ci.json"
  ],
  missingEvidenceSources: [],
  ciEvidence: [jenkinsCiEvidenceFixture, genericCiEvidenceFixture],
  ciEvidenceSummary: promotionApprovalArtifactFixture.payload.ciEvidenceSummary,
  referencedArtifactKinds: ["qa-report", "security-report", "release-report", "deployment-gate-report"],
  verificationChecks: promotionApprovalArtifactFixture.payload.verificationChecks,
  approvalRecommendations: promotionApprovalArtifactFixture.payload.approvalRecommendations,
  approvalStatus: "approval_recommended",
  provenanceRefs: [
    ".agentops/runs/run-789/bundle.json",
    ".agentops/runs/run-790/bundle.json",
    ".agentops/runs/run-release/bundle.json",
    ".agentops/runs/run-deployment/bundle.json",
    ".agentops/evidence/jenkins-ci.json",
    ".agentops/evidence/generic-ci.json"
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
  registryPluginCatalogEntry: {
    id: "local-review",
    displayName: "Local Review Plugin",
    pluginType: "agent",
    description: "Catalog entry for a locally registered review plugin.",
    catalog: {
      domain: "review",
      supportLevel: "planned",
      maturity: "prototype",
      trustScope: "official-and-reviewed-local"
    },
    trust: {
      tier: "verified",
      source: "local",
      reviewed: true
    },
    compatibility: {
      agentforgeVersionRange: ">=0.8.0",
      manifestVersion: 1,
      supportedWorkflowDomains: ["review", "test"]
    },
    distribution: {
      channel: "manual",
      packageName: "@example/local-review",
      version: "0.1.0",
      reference: "packages/local-review",
      installSupport: "manual-only",
      activationSupport: "approval-required",
      verificationMode: "none",
      verificationEvidenceRefs: []
    }
  },
  verifiedRegistryPluginCatalogEntry: {
    id: "remote-review",
    displayName: "Remote Review Plugin",
    pluginType: "agent",
    description: "Catalog entry for a remote review plugin with verified distribution metadata.",
    catalog: {
      domain: "review",
      supportLevel: "planned",
      maturity: "prototype",
      trustScope: "official-and-reviewed-local"
    },
    trust: {
      tier: "verified",
      source: "official",
      reviewed: true
    },
    compatibility: {
      agentforgeVersionRange: ">=0.9.0",
      manifestVersion: 1,
      supportedWorkflowDomains: ["review", "test"]
    },
    distribution: {
      channel: "npm",
      packageName: "@example/remote-review",
      version: "1.2.3",
      reference: "npm:@example/remote-review@1.2.3",
      installSupport: "not-supported",
      activationSupport: "approval-required",
      verificationMode: "attestation",
      verificationEvidenceRefs: ["https://example.com/attestations/remote-review"]
    }
  },
  registryPluginCatalog: {
    version: 1,
    generatedAt: "2026-03-19T11:30:00.000Z",
    entries: [
      {
        id: "local-review",
        displayName: "Local Review Plugin",
        pluginType: "agent",
        description: "Catalog entry for a locally registered review plugin.",
        catalog: {
          domain: "review",
          supportLevel: "planned",
          maturity: "prototype",
          trustScope: "official-and-reviewed-local"
        },
        trust: {
          tier: "verified",
          source: "local",
          reviewed: true
        },
        compatibility: {
          agentforgeVersionRange: ">=0.8.0",
          manifestVersion: 1,
          supportedWorkflowDomains: ["review", "test"]
        },
        distribution: {
          channel: "manual",
          packageName: "@example/local-review",
          version: "0.1.0",
          reference: "packages/local-review",
          installSupport: "manual-only",
          activationSupport: "approval-required",
          verificationMode: "none",
          verificationEvidenceRefs: []
        }
      }
    ]
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
  securityRequest: securityRequestFixture,
  pipelineRequest: pipelineRequestFixture,
  releaseRequest: releaseRequestFixture,
  deploymentRequest: deploymentRequestFixture,
  promotionRequest: promotionRequestFixture,
  incidentRequest: incidentRequestFixture,
  maintenanceRequest: maintenanceRequestFixture,
  evalSpec: evalFixtureCorpusFixture.specs[1],
  evalFixtureCorpus: evalFixtureCorpusFixture,
  githubReference: githubReferenceFixture,
  scmReference: scmReferenceFixture,
  gitlabIssueScmReference: gitlabIssueScmReferenceFixture,
  gitlabMergeRequestScmReference: gitlabMergeRequestScmReferenceFixture,
  ciEvidence: ciEvidenceFixture,
  dependencyIntegrityEvidence: dependencyIntegrityEvidenceFixture,
  attestationVerificationEvidence: attestationVerificationEvidenceFixture,
  gitlabCiEvidenceExport: gitlabCiEvidenceExportFixture,
  gitlabCiEvidence: gitlabCiEvidenceFixture,
  buildkiteCiEvidenceExport: buildkiteCiEvidenceExportFixture,
  buildkiteCiEvidence: buildkiteCiEvidenceFixture,
  jenkinsCiEvidenceExport: jenkinsCiEvidenceExportFixture,
  jenkinsCiEvidence: jenkinsCiEvidenceFixture,
  genericCiEvidenceExport: genericCiEvidenceExportFixture,
  genericCiEvidence: genericCiEvidenceFixture,
  adapterCapabilityMetadata: adapterCapabilityMetadataFixture,
  gitlabAdapterCapabilityMetadata: gitlabAdapterCapabilityMetadataFixture,
  buildkiteAdapterCapabilityMetadata: buildkiteAdapterCapabilityMetadataFixture,
  jenkinsAdapterCapabilityMetadata: jenkinsAdapterCapabilityMetadataFixture,
  genericCiAdapterCapabilityMetadata: genericCiAdapterCapabilityMetadataFixture,
  githubActionsEvidence: githubActionsEvidenceFixture,
  githubHandoffSummary: githubHandoffSummaryFixture,
  githubWorkflowStatusMapping: githubWorkflowStatusMappingFixture,
  normalizedValidationCommand: normalizedValidationCommandFixture,
  implementationInventory: implementationInventoryFixture,
  qaEvidenceNormalization: qaEvidenceNormalizationFixture,
  securityEvidenceNormalization: securityEvidenceNormalizationFixture,
  pipelineEvidenceNormalization: pipelineEvidenceNormalizationFixture,
  deploymentGateEvidenceNormalization: deploymentGateEvidenceNormalizationFixture,
  promotionApprovalEvidenceNormalization: promotionApprovalEvidenceNormalizationFixture,
  incidentEvidenceNormalization: incidentEvidenceNormalizationFixture,
  maintenanceEvidenceNormalization: maintenanceEvidenceNormalizationFixture,
  releaseEvidenceNormalization: releaseEvidenceNormalizationFixture,
  lifecycleArtifactEnvelope: planningArtifactFixture,
  planningArtifact: planningArtifactFixture,
  designArtifact: designArtifactFixture,
  implementationArtifact: implementationArtifactFixture,
  incidentArtifact: incidentArtifactFixture,
  pipelineArtifact: pipelineArtifactFixture,
  qaArtifact: qaArtifactFixture,
  securityArtifact: securityArtifactFixture,
  evalArtifact: evalArtifactFixture,
  benchmarkArtifact: benchmarkArtifactFixture,
  benchmarkLedgerDocument: benchmarkLedgerDocumentFixture,
  reviewArtifact: reviewArtifactFixture,
  releaseArtifact: releaseArtifactFixture,
  deploymentGateArtifact: deploymentGateArtifactFixture,
  promotionApprovalArtifact: promotionApprovalArtifactFixture,
  maintenanceArtifact: maintenanceArtifactFixture,
  invalidLifecycleArtifactEnvelope: invalidLifecycleArtifactEnvelopeFixture,
  invalidPlanningArtifact: invalidPlanningArtifactFixture,
  invalidReviewArtifact: invalidReviewArtifactFixture
} as const;
