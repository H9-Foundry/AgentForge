import { describe, expectTypeOf, it } from "vitest";

import type {
  BenchmarkArtifact,
  BenchmarkArtifactPayload,
  BenchmarkComparedRun,
  BenchmarkDeterministicDelta,
  DesignArtifact,
  DesignArtifactOption,
  DesignRequest,
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
  PlanningArtifact,
  PlanningRequest,
  QaArtifact,
  QaEvidenceNormalization,
  QaRequest,
  ReleaseApprovalRecommendation,
  ReleaseRequest,
  ReleaseEvidenceNormalization,
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
    expectTypeOf<ImplementationRequest["designRecordRef"]>().toEqualTypeOf<string>();
    expectTypeOf<ImplementationRequest["approvalMode"]>().toEqualTypeOf<"proposal-only" | "apply-capable">();
    expectTypeOf<IncidentRequest["incidentSummary"]>().toEqualTypeOf<string>();
    expectTypeOf<IncidentEvidenceNormalization["severityHint"]>().toEqualTypeOf<
      "unknown" | "low" | "medium" | "high" | "critical"
    >();
    expectTypeOf<MaintenanceRequest["maintenanceGoal"]>().toEqualTypeOf<string>();
    expectTypeOf<QaRequest["targetRef"]>().toEqualTypeOf<string>();
    expectTypeOf<SecurityRequest["targetRef"]>().toEqualTypeOf<string>();
    expectTypeOf<ReleaseRequest["releaseScope"]>().toEqualTypeOf<string>();
    expectTypeOf<ReleaseRequest["versionTargets"]>().toEqualTypeOf<ReleaseVersionTarget[]>();
    expectTypeOf<ReleaseEvidenceNormalization["approvalRecommendations"]>().toEqualTypeOf<ReleaseApprovalRecommendation[]>();
    expectTypeOf<ReleaseEvidenceNormalization["versionResolutions"]>().toEqualTypeOf<ReleaseVersionResolution[]>();
    expectTypeOf<QaEvidenceNormalization["targetType"]>().toEqualTypeOf<
      "artifact-bundle" | "validation-output" | "local-reference"
    >();
    expectTypeOf<SecurityEvidenceNormalization["targetType"]>().toEqualTypeOf<"artifact-bundle" | "local-reference">();
    expectTypeOf<ImplementationInventory["resolvedAffectedPaths"]>().toEqualTypeOf<string[]>();
    expectTypeOf<NormalizedValidationCommand["classification"]>().toEqualTypeOf<
      "allow" | "approval_required" | "deny"
    >();
  });
});
