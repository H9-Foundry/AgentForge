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
  "review-report",
  "release-report",
  "maintenance-report"
]);
export const lifecycleDomainSchema = z.enum(["plan", "design", "review", "release", "maintain"]);
export const lifecycleArtifactSourceTypeSchema = z.enum(["workflow-run", "manual-input", "imported"]);
export const lifecycleArtifactStatusSchema = z.enum(["draft", "complete", "superseded", "cancelled"]);

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
  nodes: z.array(workflowNodeSchema).min(1)
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
  blockedPlugins: z.array(blockedPluginSchema).default([]),
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
  agentOutput: agentOutputSchema,
  agentManifest: agentManifestSchema,
  agentPluginRegistration: agentPluginRegistrationSchema,
  agentforgeConfig: agentforgeConfigSchema,
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
    trigger: "manual",
    nodes: [
      { id: "context", kind: "deterministic", agent: "context-collector", outputsTo: "agentResults.context" },
      { id: "review", kind: "reasoning", agent: "code-review", outputsTo: "agentResults.review" },
      { id: "report", kind: "report", outputsTo: "reports.final" }
    ]
  },
  lifecycleArtifactEnvelope: {
    schemaVersion: "1.0.0",
    artifactKind: "planning-brief",
    lifecycleDomain: "plan",
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
    },
    summary: "Initial planning brief generated for queue item #78.",
    payload: {
      problemStatement: "Define the next planning workflow slice.",
      recommendedNextSteps: ["Draft workflow spec", "Open child implementation issues"]
    }
  }
} as const;
