import { agentManifestSchema, agentOutputSchema, securityArtifactSchema } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";
import type { SecurityArtifact, SecurityRequest, WorkflowStateEnvelope } from "@h9-foundry/agentforge-shared-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function getWorkflowInput<T>(stateSlice: Partial<WorkflowStateEnvelope>, key: string): T | undefined {
  if (!isRecord(stateSlice.workflowInputs)) {
    return undefined;
  }

  return stateSlice.workflowInputs[key] as T | undefined;
}

function buildArtifactEnvelopeBase(state: WorkflowStateEnvelope, summary: string, inputRefs: readonly string[]) {
  return {
    schemaVersion: state.version,
    workflow: {
      name: state.workflow,
      displayName: "Security Review"
    },
    source: {
      sourceType: "workflow-run" as const,
      runId: state.runId,
      inputRefs: [...inputRefs],
      issueRefs: []
    },
    status: "complete" as const,
    generatedAt: new Date().toISOString(),
    repo: {
      root: state.repo.root,
      name: state.repo.name,
      branch: state.repo.branch
    },
    provenance: {
      generatedBy: "agentforge-runtime",
      schemaVersion: state.version,
      executionEnvironment: state.context.ciExecution ? "ci" as const : "local" as const,
      repoRoot: state.repo.root
    },
    redaction: {
      applied: true,
      strategyVersion: "1.0.0",
      categories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key"]
    },
    auditLink: {
      entryIds: [],
      findingIds: [],
      proposedActionIds: []
    },
    summary
  };
}

export const manifest = agentManifestSchema.parse({
  version: 1,
  name: "security-analyst",
  displayName: "Security Analyst",
  category: "security",
  runtime: {
    minVersion: "0.1.0",
    kind: "reasoning"
  },
  permissions: {
    model: true,
    network: false,
    tools: [],
    readPaths: ["**/*"],
    writePaths: []
  },
  inputs: ["workflowInputs", "repo", "changes", "agentResults"],
  outputs: ["lifecycleArtifacts"],
  contextPolicy: {
    sections: ["workflowInputs", "repo", "changes", "agentResults"],
    minimalContext: true
  },
  catalog: {
    domain: "security",
    supportLevel: "internal",
    maturity: "mvp",
    trustScope: "official-core-only"
  },
  trust: {
    tier: "core",
    source: "official",
    reviewed: true
  }
});

export const securityAnalystAgent: RuntimeAgent = {
  manifest,
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const securityRequest = getWorkflowInput<SecurityRequest>(stateSlice, "securityRequest");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!securityRequest) {
      throw new Error("security-review requires validated security inputs before security analysis.");
    }

    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const evidenceMetadata = isRecord(stateSlice.agentResults?.evidence?.metadata) ? stateSlice.agentResults.evidence.metadata : {};
    const referencedArtifactKinds = asStringArray(evidenceMetadata.referencedArtifactKinds).length > 0
      ? asStringArray(evidenceMetadata.referencedArtifactKinds)
      : asStringArray(intakeMetadata.referencedArtifactKinds);
    const normalizedFocusAreas = asStringArray(evidenceMetadata.normalizedFocusAreas).length > 0
      ? asStringArray(evidenceMetadata.normalizedFocusAreas)
      : asStringArray(intakeMetadata.focusAreas);
    const normalizedConstraints = asStringArray(intakeMetadata.constraints);
    const evidenceSources =
      asStringArray(evidenceMetadata.normalizedEvidenceSources).length > 0
        ? asStringArray(evidenceMetadata.normalizedEvidenceSources)
        : asStringArray(intakeMetadata.evidenceSources).length > 0
          ? asStringArray(intakeMetadata.evidenceSources)
        : [...new Set([securityRequest.targetRef, ...securityRequest.evidenceSources])];
    const focusAreas = normalizedFocusAreas.length > 0 ? normalizedFocusAreas : securityRequest.focusAreas;
    const inferredSeverity = securityRequest.releaseContext === "blocking" ? "high" : securityRequest.releaseContext === "candidate" ? "medium" : "low";
    const findings =
      focusAreas.length > 0
        ? focusAreas.map((focusArea, index) => ({
            id: `security-finding-${index + 1}`,
            title: `Inspect ${focusArea} evidence before promotion`,
            summary: `Security review flagged ${focusArea} for bounded follow-up on ${securityRequest.targetRef}.`,
            severity: inferredSeverity,
            rationale:
              "The MVP security workflow synthesizes a structured report from validated references before deterministic evidence normalization lands.",
            confidence: 0.76,
            location: securityRequest.targetRef,
            tags: ["security", focusArea]
          }))
        : [
            {
              id: "security-finding-1",
              title: "Inspect referenced security evidence before promotion",
              summary: `Security review requires bounded interpretation of the referenced evidence for ${securityRequest.targetRef}.`,
              severity: inferredSeverity,
              rationale:
                "The current security workflow is read-only and request-driven, so findings remain tied to validated local references rather than automatic scanning.",
              confidence: 0.72,
              location: securityRequest.targetRef,
              tags: ["security", "evidence"]
            }
          ];
    const mitigations = [
      ...focusAreas.map((focusArea) => `Review ${focusArea} evidence and document the release impact before promotion.`),
      ...(normalizedConstraints.length > 0 ? [`Keep security follow-up bounded by: ${normalizedConstraints.join("; ")}.`] : [])
    ];
    const followUpWork = [
      ...asStringArray(evidenceMetadata.securitySignals),
      ...(referencedArtifactKinds.length > 0
        ? [`Confirm the security posture for referenced artifacts: ${referencedArtifactKinds.join(", ")}.`]
        : []),
      "Use deterministic security evidence normalization outputs before broadening the workflow surface."
    ];
    const summary = `Security report prepared for ${securityRequest.targetRef}.`;
    const securityReport = securityArtifactSchema.parse({
      ...buildArtifactEnvelopeBase(
        state,
        summary,
        [
          requestFile ?? ".agentops/requests/security.yaml",
          ...(
            asStringArray(evidenceMetadata.provenanceRefs).length > 0
              ? asStringArray(evidenceMetadata.provenanceRefs)
              : [securityRequest.targetRef, ...securityRequest.evidenceSources]
          )
        ]
      ),
      artifactKind: "security-report",
      lifecycleDomain: "security",
      redaction: {
        applied: true,
        strategyVersion: "1.0.0",
        categories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key", "security-sensitive"]
      },
      payload: {
        targetRef: securityRequest.targetRef,
        evidenceSources,
        findings,
        severitySummary: `highest severity: ${inferredSeverity}; ${findings.length} synthesized security finding(s).`,
        mitigations:
          mitigations.length > 0
            ? mitigations
            : ["Review the referenced security evidence before promoting this workflow output."],
        releaseImpact:
          securityRequest.releaseContext === "blocking"
            ? "release-blocking security findings require resolution before promotion."
            : securityRequest.releaseContext === "candidate"
              ? "candidate release requires explicit security review before promotion."
              : "no release context was supplied; security output remains advisory.",
        followUpWork
      }
    });

    return agentOutputSchema.parse({
      summary,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [securityReport satisfies SecurityArtifact],
      requestedTools: [],
      blockedActionFlags: [],
      confidence: 0.76,
      metadata: {
        deterministicInputs: {
          targetRef: securityRequest.targetRef,
          evidenceSources,
          focusAreas,
          constraints: normalizedConstraints,
          referencedArtifactKinds
        },
        synthesizedAssessment: {
          severitySummary: securityReport.payload.severitySummary,
          mitigations: securityReport.payload.mitigations,
          followUpWork: securityReport.payload.followUpWork
        }
      }
    });
  }
};
