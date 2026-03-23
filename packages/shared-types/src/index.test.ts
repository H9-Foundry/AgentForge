import { describe, expectTypeOf, it } from "vitest";

import type {
  BenchmarkArtifact,
  BenchmarkArtifactPayload,
  BenchmarkComparedRun,
  BenchmarkDecisionOutcome,
  BenchmarkDeterministicDelta,
  BenchmarkLedgerDocument,
  BenchmarkLedgerEntry,
  BenchmarkLedgerFriction,
  DesignArtifact,
  DesignArtifactOption,
  DesignRequest,
  DeploymentGateArtifact,
  DeploymentGateEvidenceNormalization,
  DeploymentRequest,
  EvalArtifact,
  EvalArtifactPayload,
  EvalArtifactExpectation,
  EvalDeterministicCheck,
  EvalFixtureCorpus,
  EvalModelDependentCheck,
  EvalPolicyExpectation,
  EvalRedactionExpectation,
  EvalSetupRun,
  EvalSpec,
  ImplementationArtifact,
  ImplementationInventory,
  ImplementationRequest,
  IncidentArtifact,
  IncidentEvidenceNormalization,
  IncidentRequest,
  MaintenanceArtifact,
  MaintenanceRequest,
  NormalizedValidationCommand,
  PipelineArtifact,
  PipelineEvidenceNormalization,
  PipelineRequest,
  PlanningArtifact,
  PlanningRequest,
  QaArtifact,
  QaEvidenceNormalization,
  QaRequest,
  ReleaseApprovalRecommendation,
  ReleaseRequest,
  ReleaseEvidenceNormalization,
  RegistryPluginCatalog,
  RegistryPluginCatalogEntry,
  RegistryPluginCompatibility,
  RegistryPluginDistribution,
  SecurityArtifact,
  SecurityEvidenceNormalization,
  SecurityRequest,
  ReleaseArtifact,
  ReleaseVerificationCheck,
  ReleaseVersionResolution,
  ReleaseVersionTarget,
  ReviewArtifact
} from "./index.js";

describe("shared lifecycle artifact types", () => {
  it("exports family-specific artifact literals", () => {
    expectTypeOf<PlanningArtifact["artifactKind"]>().toEqualTypeOf<"planning-brief">();
    expectTypeOf<PlanningArtifact["lifecycleDomain"]>().toEqualTypeOf<"plan">();
    expectTypeOf<DesignArtifact["artifactKind"]>().toEqualTypeOf<"design-record">();
    expectTypeOf<DesignArtifact["lifecycleDomain"]>().toEqualTypeOf<"design">();
    expectTypeOf<ImplementationArtifact["artifactKind"]>().toEqualTypeOf<"implementation-proposal">();
    expectTypeOf<ImplementationArtifact["lifecycleDomain"]>().toEqualTypeOf<"build">();
    expectTypeOf<IncidentArtifact["artifactKind"]>().toEqualTypeOf<"incident-brief">();
    expectTypeOf<IncidentArtifact["lifecycleDomain"]>().toEqualTypeOf<"operate">();
    expectTypeOf<PipelineArtifact["artifactKind"]>().toEqualTypeOf<"pipeline-report">();
    expectTypeOf<PipelineArtifact["lifecycleDomain"]>().toEqualTypeOf<"release">();
    expectTypeOf<QaArtifact["artifactKind"]>().toEqualTypeOf<"qa-report">();
    expectTypeOf<QaArtifact["lifecycleDomain"]>().toEqualTypeOf<"test">();
    expectTypeOf<SecurityArtifact["artifactKind"]>().toEqualTypeOf<"security-report">();
    expectTypeOf<SecurityArtifact["lifecycleDomain"]>().toEqualTypeOf<"security">();
    expectTypeOf<EvalArtifact["artifactKind"]>().toEqualTypeOf<"eval-result">();
    expectTypeOf<EvalArtifact["lifecycleDomain"]>().toEqualTypeOf<"evaluate">();
    expectTypeOf<BenchmarkArtifact["artifactKind"]>().toEqualTypeOf<"benchmark-summary">();
    expectTypeOf<BenchmarkArtifact["lifecycleDomain"]>().toEqualTypeOf<"evaluate">();
    expectTypeOf<ReviewArtifact["artifactKind"]>().toEqualTypeOf<"review-report">();
    expectTypeOf<ReviewArtifact["lifecycleDomain"]>().toEqualTypeOf<"review">();
    expectTypeOf<ReleaseArtifact["artifactKind"]>().toEqualTypeOf<"release-report">();
    expectTypeOf<ReleaseArtifact["lifecycleDomain"]>().toEqualTypeOf<"release">();
    expectTypeOf<DeploymentGateArtifact["artifactKind"]>().toEqualTypeOf<"deployment-gate-report">();
    expectTypeOf<DeploymentGateArtifact["lifecycleDomain"]>().toEqualTypeOf<"release">();
    expectTypeOf<MaintenanceArtifact["artifactKind"]>().toEqualTypeOf<"maintenance-report">();
    expectTypeOf<MaintenanceArtifact["lifecycleDomain"]>().toEqualTypeOf<"maintain">();
  });

  it("exports nested payload helper types", () => {
    expectTypeOf<DesignArtifact["payload"]["optionsConsidered"]>().toEqualTypeOf<DesignArtifactOption[]>();
    expectTypeOf<ReleaseArtifact["payload"]["verificationChecks"]>().toEqualTypeOf<ReleaseVerificationCheck[]>();
    expectTypeOf<ReleaseArtifact["payload"]["versionTargets"]>().toEqualTypeOf<ReleaseVersionTarget[]>();
    expectTypeOf<ReleaseArtifact["payload"]["versionResolutions"]>().toEqualTypeOf<ReleaseVersionResolution[]>();
    expectTypeOf<ReleaseArtifact["payload"]["approvalRecommendations"]>().toEqualTypeOf<ReleaseApprovalRecommendation[]>();
  });

  it("exports workflow request helper types", () => {
    expectTypeOf<PlanningRequest["problemStatement"]>().toEqualTypeOf<string>();
    expectTypeOf<DesignRequest["planningBriefRef"]>().toEqualTypeOf<string>();
    expectTypeOf<EvalSpec["schemaVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<EvalSpec["expectedStatus"]>().toEqualTypeOf<"success" | "partial" | "failed">();
    expectTypeOf<EvalFixtureCorpus["specs"]>().toEqualTypeOf<EvalSpec[]>();
    expectTypeOf<EvalArtifactExpectation["requiredPayloadFields"]>().toEqualTypeOf<string[]>();
    expectTypeOf<EvalPolicyExpectation["readOnly"]>().toEqualTypeOf<boolean>();
    expectTypeOf<EvalRedactionExpectation["expectedCategories"]>().toEqualTypeOf<string[]>();
    expectTypeOf<EvalArtifactPayload["deterministicChecks"]>().toEqualTypeOf<EvalDeterministicCheck[]>();
    expectTypeOf<EvalArtifactPayload["modelDependentChecks"]>().toEqualTypeOf<EvalModelDependentCheck[]>();
    expectTypeOf<EvalArtifactPayload["setupRuns"]>().toEqualTypeOf<EvalSetupRun[]>();
    expectTypeOf<BenchmarkArtifactPayload["comparedRuns"]>().toEqualTypeOf<BenchmarkComparedRun[]>();
    expectTypeOf<BenchmarkComparedRun["regressions"]>().toEqualTypeOf<BenchmarkDeterministicDelta[]>();
    expectTypeOf<BenchmarkDeterministicDelta["classification"]>().toEqualTypeOf<
      "regression" | "improvement" | "unchanged" | "non_comparable"
    >();
    expectTypeOf<BenchmarkDecisionOutcome>().toEqualTypeOf<
      | "scope_reduction"
      | "added_validation"
      | "blocked_approval"
      | "remediation_before_merge"
      | "added_confidence"
      | "no_meaningful_change"
    >();
    expectTypeOf<BenchmarkLedgerEntry["taskId"]>().toEqualTypeOf<string>();
    expectTypeOf<BenchmarkLedgerEntry["friction"]>().toEqualTypeOf<BenchmarkLedgerFriction>();
    expectTypeOf<BenchmarkLedgerDocument["entries"]>().toEqualTypeOf<BenchmarkLedgerEntry[]>();
    expectTypeOf<ImplementationRequest["designRecordRef"]>().toEqualTypeOf<string>();
    expectTypeOf<ImplementationRequest["approvalMode"]>().toEqualTypeOf<"proposal-only" | "apply-capable">();
    expectTypeOf<IncidentRequest["incidentSummary"]>().toEqualTypeOf<string>();
    expectTypeOf<PipelineRequest["pipelineScope"]>().toEqualTypeOf<string>();
    expectTypeOf<IncidentEvidenceNormalization["severityHint"]>().toEqualTypeOf<
      "unknown" | "low" | "medium" | "high" | "critical"
    >();
    expectTypeOf<MaintenanceRequest["maintenanceGoal"]>().toEqualTypeOf<string>();
    expectTypeOf<QaRequest["targetRef"]>().toEqualTypeOf<string>();
    expectTypeOf<SecurityRequest["targetRef"]>().toEqualTypeOf<string>();
    expectTypeOf<ReleaseRequest["releaseScope"]>().toEqualTypeOf<string>();
    expectTypeOf<ReleaseRequest["versionTargets"]>().toEqualTypeOf<ReleaseVersionTarget[]>();
    expectTypeOf<DeploymentRequest["targetEnvironment"]>().toEqualTypeOf<string>();
    expectTypeOf<ReleaseEvidenceNormalization["approvalRecommendations"]>().toEqualTypeOf<ReleaseApprovalRecommendation[]>();
    expectTypeOf<ReleaseEvidenceNormalization["versionResolutions"]>().toEqualTypeOf<ReleaseVersionResolution[]>();
    expectTypeOf<PipelineEvidenceNormalization["reviewStatus"]>().toEqualTypeOf<"ready" | "needs_follow_up" | "blocked">();
    expectTypeOf<DeploymentGateEvidenceNormalization["gateStatus"]>().toEqualTypeOf<
      "ready_for_approval" | "conditionally_ready" | "blocked"
    >();
    expectTypeOf<QaEvidenceNormalization["targetType"]>().toEqualTypeOf<
      "artifact-bundle" | "validation-output" | "local-reference"
    >();
    expectTypeOf<SecurityEvidenceNormalization["targetType"]>().toEqualTypeOf<"artifact-bundle" | "local-reference">();
    expectTypeOf<ImplementationInventory["resolvedAffectedPaths"]>().toEqualTypeOf<string[]>();
    expectTypeOf<NormalizedValidationCommand["classification"]>().toEqualTypeOf<
      "allow" | "approval_required" | "deny"
    >();
    expectTypeOf<RegistryPluginCompatibility["agentforgeVersionRange"]>().toEqualTypeOf<string>();
    expectTypeOf<RegistryPluginCompatibility["supportedWorkflowDomains"]>().toEqualTypeOf<
      Array<"foundation" | "plan" | "design" | "build" | "review" | "test" | "security" | "release" | "operate" | "maintain">
    >();
    expectTypeOf<RegistryPluginDistribution["activationSupport"]>().toEqualTypeOf<
      "not-supported" | "approval-required"
    >();
    expectTypeOf<RegistryPluginCatalogEntry["pluginType"]>().toEqualTypeOf<"agent" | "adapter" | "workflow">();
    expectTypeOf<RegistryPluginCatalog["entries"]>().toEqualTypeOf<RegistryPluginCatalogEntry[]>();
  });
});
