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
  githubActionsCheckRunEvidenceSchema,
  githubActionsEvidenceNormalizationSchema,
  githubActionsEvidenceSchema,
  githubActionsJobEvidenceSchema,
  githubHandoffSectionSchema,
  githubHandoffSummarySchema,
  githubReferenceSchema,
  githubWorkflowStatusMappingSchema,
  implementationArtifactPayloadSchema,
  implementationArtifactSchema,
  implementationInventorySchema,
  implementationRequestSchema,
  maintenanceArtifactPayloadSchema,
  maintenanceArtifactSchema,
  normalizedValidationCommandSchema,
  policyDocumentSchema,
  qaArtifactPayloadSchema,
  qaArtifactSchema,
  qaEvidenceNormalizationSchema,
  qaRequestSchema,
  securityEvidenceNormalizationSchema,
  securityArtifactPayloadSchema,
  securityArtifactSchema,
  securityRequestSchema,
  planningRequestSchema,
  planningArtifactPayloadSchema,
  planningArtifactSchema,
  proposedActionSchema,
  releaseArtifactPayloadSchema,
  releaseArtifactSchema,
  releaseRequestSchema,
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
export type GithubActionsJobEvidence = Infer<typeof githubActionsJobEvidenceSchema>;
export type GithubActionsCheckRunEvidence = Infer<typeof githubActionsCheckRunEvidenceSchema>;
export type GithubActionsEvidence = Infer<typeof githubActionsEvidenceSchema>;
export type GithubActionsEvidenceNormalization = Infer<typeof githubActionsEvidenceNormalizationSchema>;
export type GithubHandoffSection = Infer<typeof githubHandoffSectionSchema>;
export type GithubHandoffSummary = Infer<typeof githubHandoffSummarySchema>;
export type GithubReference = Infer<typeof githubReferenceSchema>;
export type GithubWorkflowStatusMapping = Infer<typeof githubWorkflowStatusMappingSchema>;
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
export type ImplementationArtifactPayload = Infer<typeof implementationArtifactPayloadSchema>;
export type ImplementationArtifact = Infer<typeof implementationArtifactSchema>;
export type ImplementationInventory = Infer<typeof implementationInventorySchema>;
export type ImplementationRequest = Infer<typeof implementationRequestSchema>;
export type QaArtifactPayload = Infer<typeof qaArtifactPayloadSchema>;
export type QaArtifact = Infer<typeof qaArtifactSchema>;
export type QaEvidenceNormalization = Infer<typeof qaEvidenceNormalizationSchema>;
export type QaRequest = Infer<typeof qaRequestSchema>;
export type SecurityEvidenceNormalization = Infer<typeof securityEvidenceNormalizationSchema>;
export type SecurityArtifactPayload = Infer<typeof securityArtifactPayloadSchema>;
export type SecurityArtifact = Infer<typeof securityArtifactSchema>;
export type SecurityRequest = Infer<typeof securityRequestSchema>;
export type ReviewArtifactPayload = Infer<typeof reviewArtifactPayloadSchema>;
export type ReviewArtifact = Infer<typeof reviewArtifactSchema>;
export type NormalizedValidationCommand = Infer<typeof normalizedValidationCommandSchema>;
export type ReleaseVerificationCheck = Infer<typeof releaseVerificationCheckSchema>;
export type ReleaseVersionTarget = Infer<typeof releaseVersionTargetSchema>;
export type ReleaseRequest = Infer<typeof releaseRequestSchema>;
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
