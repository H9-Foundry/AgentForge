/* eslint-disable @typescript-eslint/consistent-type-imports */
import type { infer as Infer } from "zod/v3";

import {
  agentManifestSchema,
  agentPluginRegistrationSchema,
  agentforgeConfigSchema,
  agentOutputSchema,
  approvalCheckpointSchema,
  attestationVerificationEvidenceSchema,
  auditBundleSchema,
  auditComponentSchema,
  lifecycleArtifactAuditLinkSchema,
  lifecycleArtifactSchema,
  lifecycleArtifactEnvelopeSchema,
  lifecycleArtifactRepoReferenceSchema,
  lifecycleArtifactSourceReferenceSchema,
  lifecycleArtifactWorkflowReferenceSchema,
  auditProvenanceSchema,
  providerUsageAggregateSchema,
  providerUsageAggregateSummarySchema,
  providerUsageByModelSchema,
  providerUsageNodeBreakdownSchema,
  providerUsagePricingSchema,
  auditRedactionSchema,
  auditEntrySchema,
  blockedPluginSchema,
  designArtifactOptionSchema,
  designArtifactPayloadSchema,
  designArtifactSchema,
  designRequestSchema,
  evalArtifactPayloadSchema,
  evalArtifactSchema,
  evalDeterministicCheckSchema,
  evalArtifactExpectationSchema,
  evalFixtureCorpusSchema,
  evalModelDependentCheckSchema,
  evalPolicyExpectationSchema,
  evalRedactionExpectationSchema,
  evalSetupRunSchema,
  evalSpecSchema,
  benchmarkArtifactPayloadSchema,
  benchmarkArtifactSchema,
  benchmarkCategorySchema,
  benchmarkComparedRunSchema,
  benchmarkDecisionClaritySchema,
  benchmarkDeterministicDeltaSchema,
  benchmarkDecisionOutcomeSchema,
  benchmarkLedgerArmSchema,
  benchmarkLedgerConfirmedRiskReferenceSchema,
  benchmarkLedgerDocumentSchema,
  benchmarkLedgerEntrySchema,
  benchmarkLedgerFrictionSchema,
  benchmarkLedgerSourceSchema,
  benchmarkLedgerTraceReferenceSchema,
  benchmarkLedgerTokenUsageSchema,
  benchmarkLedgerWorkflowStatusSchema,
  benchmarkReleaseDecisionSchema,
  buildkiteCiEvidenceExportSchema,
  jenkinsCiEvidenceExportSchema,
  ciArtifactEvidenceSchema,
  ciEvidenceSchema,
  deploymentGateArtifactPayloadSchema,
  deploymentGateArtifactSchema,
  deploymentGateEvidenceNormalizationSchema,
  deploymentRequestSchema,
  promotionApprovalArtifactPayloadSchema,
  promotionApprovalArtifactSchema,
  promotionApprovalEvidenceNormalizationSchema,
  promotionRequestSchema,
  dependencyIntegrityEvidenceSchema,
  dependencyInventoryEntrySchema,
  ciJobEvidenceSchema,
  genericCiEvidenceExportSchema,
  gitlabCiEvidenceExportSchema,
  gitlabCiJobEvidenceExportSchema,
  effectivePolicySnapshotSchema,
  findingSchema,
  adapterCapabilityMetadataSchema,
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
  incidentEvidenceNormalizationSchema,
  implementationRequestSchema,
  incidentArtifactPayloadSchema,
  incidentArtifactSchema,
  pipelineArtifactPayloadSchema,
  pipelineArtifactSchema,
  pipelineEvidenceNormalizationSchema,
  pipelineRequestSchema,
  incidentRequestSchema,
  maintenanceArtifactPayloadSchema,
  maintenanceArtifactSchema,
  maintenanceEvidenceNormalizationSchema,
  maintenanceRequestSchema,
  normalizedValidationCommandSchema,
  policyDocumentSchema,
  qaArtifactPayloadSchema,
  qaArtifactSchema,
  qaEvidenceNormalizationSchema,
  qaRequestSchema,
  releaseApprovalRecommendationSchema,
  releaseCiEvidenceSummarySchema,
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
  releaseEvidenceNormalizationSchema,
  releaseRequestSchema,
  releaseVerificationCheckSchema,
  releaseVersionResolutionSchema,
  releaseVersionTargetSchema,
  registryPluginCatalogEntrySchema,
  registryPluginCatalogSchema,
  registryPluginCompatibilitySchema,
  registryPluginDistributionSchema,
  reviewArtifactPayloadSchema,
  reviewArtifactSchema,
  scmReferenceSchema,
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
export type AttestationVerificationEvidence = Infer<typeof attestationVerificationEvidenceSchema>;
export type AuditEntry = Infer<typeof auditEntrySchema>;
export type AuditComponent = Infer<typeof auditComponentSchema>;
export type AuditProvenance = Infer<typeof auditProvenanceSchema>;
export type ProviderUsagePricing = Infer<typeof providerUsagePricingSchema>;
export type ProviderUsageByModel = Infer<typeof providerUsageByModelSchema>;
export type ProviderUsageAggregateSummary = Infer<typeof providerUsageAggregateSummarySchema>;
export type ProviderUsageNodeBreakdown = Infer<typeof providerUsageNodeBreakdownSchema>;
export type ProviderUsageAggregate = Infer<typeof providerUsageAggregateSchema>;
export type AuditRedaction = Infer<typeof auditRedactionSchema>;
export type CiArtifactEvidence = Infer<typeof ciArtifactEvidenceSchema>;
export type CiJobEvidence = Infer<typeof ciJobEvidenceSchema>;
export type CiEvidence = Infer<typeof ciEvidenceSchema>;
export type BuildkiteCiEvidenceExport = Infer<typeof buildkiteCiEvidenceExportSchema>;
export type JenkinsCiEvidenceExport = Infer<typeof jenkinsCiEvidenceExportSchema>;
export type DependencyInventoryEntry = Infer<typeof dependencyInventoryEntrySchema>;
export type DependencyIntegrityEvidence = Infer<typeof dependencyIntegrityEvidenceSchema>;
export type GenericCiEvidenceExport = Infer<typeof genericCiEvidenceExportSchema>;
export type GitlabCiJobEvidenceExport = Infer<typeof gitlabCiJobEvidenceExportSchema>;
export type GitlabCiEvidenceExport = Infer<typeof gitlabCiEvidenceExportSchema>;
export type DeploymentGateArtifactPayload = Infer<typeof deploymentGateArtifactPayloadSchema>;
export type DeploymentGateArtifact = Infer<typeof deploymentGateArtifactSchema>;
export type DeploymentGateEvidenceNormalization = Infer<typeof deploymentGateEvidenceNormalizationSchema>;
export type DeploymentRequest = Infer<typeof deploymentRequestSchema>;
export type PromotionApprovalArtifactPayload = Infer<typeof promotionApprovalArtifactPayloadSchema>;
export type PromotionApprovalArtifact = Infer<typeof promotionApprovalArtifactSchema>;
export type PromotionApprovalEvidenceNormalization = Infer<typeof promotionApprovalEvidenceNormalizationSchema>;
export type PromotionRequest = Infer<typeof promotionRequestSchema>;
export type AdapterCapabilityMetadata = Infer<typeof adapterCapabilityMetadataSchema>;
export type GithubActionsJobEvidence = Infer<typeof githubActionsJobEvidenceSchema>;
export type GithubActionsCheckRunEvidence = Infer<typeof githubActionsCheckRunEvidenceSchema>;
export type GithubActionsEvidence = Infer<typeof githubActionsEvidenceSchema>;
export type GithubActionsEvidenceNormalization = Infer<typeof githubActionsEvidenceNormalizationSchema>;
export type GithubHandoffSection = Infer<typeof githubHandoffSectionSchema>;
export type GithubHandoffSummary = Infer<typeof githubHandoffSummarySchema>;
export type GithubReference = Infer<typeof githubReferenceSchema>;
export type ScmReference = Infer<typeof scmReferenceSchema>;
export type GithubWorkflowStatusMapping = Infer<typeof githubWorkflowStatusMappingSchema>;
export type ReleaseCiEvidenceSummary = Infer<typeof releaseCiEvidenceSummarySchema>;
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
export type EvalDeterministicCheck = Infer<typeof evalDeterministicCheckSchema>;
export type EvalModelDependentCheck = Infer<typeof evalModelDependentCheckSchema>;
export type EvalSetupRun = Infer<typeof evalSetupRunSchema>;
export type EvalArtifactPayload = Infer<typeof evalArtifactPayloadSchema>;
export type EvalArtifact = Infer<typeof evalArtifactSchema>;
export type EvalArtifactExpectation = Infer<typeof evalArtifactExpectationSchema>;
export type EvalPolicyExpectation = Infer<typeof evalPolicyExpectationSchema>;
export type EvalRedactionExpectation = Infer<typeof evalRedactionExpectationSchema>;
export type EvalSpec = Infer<typeof evalSpecSchema>;
export type EvalFixtureCorpus = Infer<typeof evalFixtureCorpusSchema>;
export type BenchmarkDecisionOutcome = Infer<typeof benchmarkDecisionOutcomeSchema>;
export type BenchmarkCategory = Infer<typeof benchmarkCategorySchema>;
export type BenchmarkLedgerSource = Infer<typeof benchmarkLedgerSourceSchema>;
export type BenchmarkLedgerArm = Infer<typeof benchmarkLedgerArmSchema>;
export type BenchmarkReleaseDecision = Infer<typeof benchmarkReleaseDecisionSchema>;
export type BenchmarkDecisionClarity = Infer<typeof benchmarkDecisionClaritySchema>;
export type BenchmarkDeterministicDelta = Infer<typeof benchmarkDeterministicDeltaSchema>;
export type BenchmarkComparedRun = Infer<typeof benchmarkComparedRunSchema>;
export type BenchmarkArtifactPayload = Infer<typeof benchmarkArtifactPayloadSchema>;
export type BenchmarkArtifact = Infer<typeof benchmarkArtifactSchema>;
export type BenchmarkLedgerTraceReference = Infer<typeof benchmarkLedgerTraceReferenceSchema>;
export type BenchmarkLedgerConfirmedRiskReference = Infer<typeof benchmarkLedgerConfirmedRiskReferenceSchema>;
export type BenchmarkLedgerWorkflowStatus = Infer<typeof benchmarkLedgerWorkflowStatusSchema>;
export type BenchmarkLedgerTokenUsage = Infer<typeof benchmarkLedgerTokenUsageSchema>;
export type BenchmarkLedgerFriction = Infer<typeof benchmarkLedgerFrictionSchema>;
export type BenchmarkLedgerEntry = Infer<typeof benchmarkLedgerEntrySchema>;
export type BenchmarkLedgerDocument = Infer<typeof benchmarkLedgerDocumentSchema>;
export type ImplementationArtifactPayload = Infer<typeof implementationArtifactPayloadSchema>;
export type ImplementationArtifact = Infer<typeof implementationArtifactSchema>;
export type ImplementationInventory = Infer<typeof implementationInventorySchema>;
export type ImplementationRequest = Infer<typeof implementationRequestSchema>;
export type IncidentEvidenceNormalization = Infer<typeof incidentEvidenceNormalizationSchema>;
export type IncidentArtifactPayload = Infer<typeof incidentArtifactPayloadSchema>;
export type IncidentArtifact = Infer<typeof incidentArtifactSchema>;
export type PipelineArtifactPayload = Infer<typeof pipelineArtifactPayloadSchema>;
export type PipelineArtifact = Infer<typeof pipelineArtifactSchema>;
export type PipelineEvidenceNormalization = Infer<typeof pipelineEvidenceNormalizationSchema>;
export type PipelineRequest = Infer<typeof pipelineRequestSchema>;
export type IncidentRequest = Infer<typeof incidentRequestSchema>;
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
export type ReleaseVersionResolution = Infer<typeof releaseVersionResolutionSchema>;
export type ReleaseApprovalRecommendation = Infer<typeof releaseApprovalRecommendationSchema>;
export type RegistryPluginCompatibility = Infer<typeof registryPluginCompatibilitySchema>;
export type RegistryPluginDistribution = Infer<typeof registryPluginDistributionSchema>;
export type RegistryPluginCatalogEntry = Infer<typeof registryPluginCatalogEntrySchema>;
export type RegistryPluginCatalog = Infer<typeof registryPluginCatalogSchema>;
export type ReleaseRequest = Infer<typeof releaseRequestSchema>;
export type ReleaseEvidenceNormalization = Infer<typeof releaseEvidenceNormalizationSchema>;
export type ReleaseArtifactPayload = Infer<typeof releaseArtifactPayloadSchema>;
export type ReleaseArtifact = Infer<typeof releaseArtifactSchema>;
export type MaintenanceArtifactPayload = Infer<typeof maintenanceArtifactPayloadSchema>;
export type MaintenanceArtifact = Infer<typeof maintenanceArtifactSchema>;
export type MaintenanceEvidenceNormalization = Infer<typeof maintenanceEvidenceNormalizationSchema>;
export type MaintenanceRequest = Infer<typeof maintenanceRequestSchema>;
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
