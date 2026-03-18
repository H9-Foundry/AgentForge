import { describe, expectTypeOf, it } from "vitest";

import type {
  DesignArtifact,
  DesignArtifactOption,
  DesignRequest,
  ImplementationArtifact,
  ImplementationInventory,
  ImplementationRequest,
  MaintenanceArtifact,
  NormalizedValidationCommand,
  PlanningArtifact,
  PlanningRequest,
  QaArtifact,
  QaEvidenceNormalization,
  QaRequest,
  SecurityArtifact,
  SecurityEvidenceNormalization,
  SecurityRequest,
  ReleaseArtifact,
  ReleaseVerificationCheck,
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
    expectTypeOf<QaArtifact["artifactKind"]>().toEqualTypeOf<"qa-report">();
    expectTypeOf<QaArtifact["lifecycleDomain"]>().toEqualTypeOf<"test">();
    expectTypeOf<SecurityArtifact["artifactKind"]>().toEqualTypeOf<"security-report">();
    expectTypeOf<SecurityArtifact["lifecycleDomain"]>().toEqualTypeOf<"security">();
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
  });

  it("exports workflow request helper types", () => {
    expectTypeOf<PlanningRequest["problemStatement"]>().toEqualTypeOf<string>();
    expectTypeOf<DesignRequest["planningBriefRef"]>().toEqualTypeOf<string>();
    expectTypeOf<ImplementationRequest["designRecordRef"]>().toEqualTypeOf<string>();
    expectTypeOf<ImplementationRequest["approvalMode"]>().toEqualTypeOf<"proposal-only" | "apply-capable">();
    expectTypeOf<QaRequest["targetRef"]>().toEqualTypeOf<string>();
    expectTypeOf<SecurityRequest["targetRef"]>().toEqualTypeOf<string>();
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
