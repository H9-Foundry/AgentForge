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
  lifecycleArtifactSchema,
  lifecycleArtifactEnvelopeSchema,
  lifecycleArtifactRepoReferenceSchema,
  lifecycleArtifactSourceReferenceSchema,
  lifecycleArtifactWorkflowReferenceSchema,
  auditProvenanceSchema,
  auditRedactionSchema,
  auditEntrySchema,
  blockedPluginSchema,
  designArtifactOptionSchema,
  designArtifactPayloadSchema,
  designArtifactSchema,
  designRequestSchema,
  effectivePolicySnapshotSchema,
  findingSchema,
  maintenanceArtifactPayloadSchema,
  maintenanceArtifactSchema,
  policyDocumentSchema,
  planningRequestSchema,
  planningArtifactPayloadSchema,
  planningArtifactSchema,
  proposedActionSchema,
  releaseArtifactPayloadSchema,
  releaseArtifactSchema,
  releaseVerificationCheckSchema,
  releaseVersionTargetSchema,
  reviewArtifactPayloadSchema,
  reviewArtifactSchema,
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
export type LifecycleArtifact = Infer<typeof lifecycleArtifactSchema>;
export type PlanningArtifactPayload = Infer<typeof planningArtifactPayloadSchema>;
export type PlanningArtifact = Infer<typeof planningArtifactSchema>;
export type PlanningRequest = Infer<typeof planningRequestSchema>;
export type DesignArtifactOption = Infer<typeof designArtifactOptionSchema>;
export type DesignArtifactPayload = Infer<typeof designArtifactPayloadSchema>;
export type DesignArtifact = Infer<typeof designArtifactSchema>;
export type DesignRequest = Infer<typeof designRequestSchema>;
export type ReviewArtifactPayload = Infer<typeof reviewArtifactPayloadSchema>;
export type ReviewArtifact = Infer<typeof reviewArtifactSchema>;
export type ReleaseVerificationCheck = Infer<typeof releaseVerificationCheckSchema>;
export type ReleaseVersionTarget = Infer<typeof releaseVersionTargetSchema>;
export type ReleaseArtifactPayload = Infer<typeof releaseArtifactPayloadSchema>;
export type ReleaseArtifact = Infer<typeof releaseArtifactSchema>;
export type MaintenanceArtifactPayload = Infer<typeof maintenanceArtifactPayloadSchema>;
export type MaintenanceArtifact = Infer<typeof maintenanceArtifactSchema>;
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
