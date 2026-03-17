/* eslint-disable @typescript-eslint/consistent-type-imports */
import type { infer as Infer } from "zod/v3";

import {
  agentManifestSchema,
  agentPluginRegistrationSchema,
  agentforgeConfigSchema,
  agentOutputSchema,
  approvalCheckpointSchema,
  auditBundleSchema,
  auditComponentSchema,
  lifecycleArtifactAuditLinkSchema,
  lifecycleArtifactEnvelopeSchema,
  lifecycleArtifactRepoReferenceSchema,
  lifecycleArtifactSourceReferenceSchema,
  lifecycleArtifactWorkflowReferenceSchema,
  auditProvenanceSchema,
  auditRedactionSchema,
  auditEntrySchema,
  blockedPluginSchema,
  effectivePolicySnapshotSchema,
  findingSchema,
  policyDocumentSchema,
  proposedActionSchema,
  trustMetadataSchema,
  trustSourceSchema,
  trustTierSchema,
  toolRequestSchema,
  toolResultSchema,
  workflowDefinitionSchema,
  workflowStateEnvelopeSchema
} from "@h9-foundry/agentforge-schemas";

export type Finding = Infer<typeof findingSchema>;
export type BlockedPlugin = Infer<typeof blockedPluginSchema>;
export type ProposedAction = Infer<typeof proposedActionSchema>;
export type ToolRequest = Infer<typeof toolRequestSchema>;
export type ToolResult = Infer<typeof toolResultSchema>;
export type ApprovalCheckpoint = Infer<typeof approvalCheckpointSchema>;
export type AuditEntry = Infer<typeof auditEntrySchema>;
export type AuditComponent = Infer<typeof auditComponentSchema>;
export type AuditProvenance = Infer<typeof auditProvenanceSchema>;
export type AuditRedaction = Infer<typeof auditRedactionSchema>;
export type LifecycleArtifactWorkflowReference = Infer<typeof lifecycleArtifactWorkflowReferenceSchema>;
export type LifecycleArtifactSourceReference = Infer<typeof lifecycleArtifactSourceReferenceSchema>;
export type LifecycleArtifactRepoReference = Infer<typeof lifecycleArtifactRepoReferenceSchema>;
export type LifecycleArtifactAuditLink = Infer<typeof lifecycleArtifactAuditLinkSchema>;
export type LifecycleArtifactEnvelope = Infer<typeof lifecycleArtifactEnvelopeSchema>;
export type AgentOutput = Infer<typeof agentOutputSchema>;
export type AgentManifest = Infer<typeof agentManifestSchema>;
export type AgentPluginRegistration = Infer<typeof agentPluginRegistrationSchema>;
export type AgentForgeConfig = Infer<typeof agentforgeConfigSchema>;
export type PolicyDocument = Infer<typeof policyDocumentSchema>;
export type EffectivePolicySnapshot = Infer<typeof effectivePolicySnapshotSchema>;
export type WorkflowDefinition = Infer<typeof workflowDefinitionSchema>;
export type WorkflowStateEnvelope = Infer<typeof workflowStateEnvelopeSchema>;
export type AuditBundle = Infer<typeof auditBundleSchema>;
export type TrustMetadata = Infer<typeof trustMetadataSchema>;
export type TrustTier = Infer<typeof trustTierSchema>;
export type TrustSource = Infer<typeof trustSourceSchema>;

export type ExecutionEnvironment = "local" | "ci";
