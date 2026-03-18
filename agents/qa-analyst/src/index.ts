import { agentManifestSchema, agentOutputSchema, qaArtifactSchema } from "@h9-foundry/agentforge-schemas";
import type { QaArtifact, QaRequest, WorkflowStateEnvelope } from "@h9-foundry/agentforge-shared-types";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";

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
      displayName: "QA Review"
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
  name: "qa-analyst",
  displayName: "QA Analyst",
  category: "qa",
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
    domain: "test",
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

export const qaAnalystAgent: RuntimeAgent = {
  manifest,
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const qaRequest = getWorkflowInput<QaRequest>(stateSlice, "qaRequest");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!qaRequest) {
      throw new Error("qa-review requires validated QA inputs before QA analysis.");
    }

    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const evidenceMetadata = isRecord(stateSlice.agentResults?.evidence?.metadata) ? stateSlice.agentResults.evidence.metadata : {};
    const normalizedEvidenceSources = asStringArray(evidenceMetadata.normalizedEvidenceSources);
    const normalizedExecutedChecks = asStringArray(evidenceMetadata.normalizedExecutedChecks);
    const normalizedFocusAreas = asStringArray(intakeMetadata.focusAreas);
    const normalizedConstraints = asStringArray(intakeMetadata.constraints);
    const missingEvidenceSources = asStringArray(evidenceMetadata.missingEvidenceSources);
    const unrecognizedExecutedChecks = asStringArray(evidenceMetadata.unrecognizedExecutedChecks);
    const targetType =
      typeof evidenceMetadata.targetType === "string"
        ? evidenceMetadata.targetType
        : typeof intakeMetadata.targetType === "string"
          ? intakeMetadata.targetType
          : "local-reference";
    const evidenceSources =
      normalizedEvidenceSources.length > 0
        ? normalizedEvidenceSources
        : [...new Set([qaRequest.targetRef, ...qaRequest.evidenceSources])];
    const executedChecks = normalizedExecutedChecks.length > 0 ? normalizedExecutedChecks : qaRequest.executedChecks;
    const focusAreas = normalizedFocusAreas.length > 0 ? normalizedFocusAreas : qaRequest.focusAreas;
    const findings =
      focusAreas.length > 0
        ? focusAreas.map((focusArea, index) => ({
            id: `qa-finding-${index + 1}`,
            title: `Inspect ${focusArea} evidence before promotion`,
            summary: `QA review flagged ${focusArea} as an area requiring bounded interpretation for ${qaRequest.targetRef}.`,
            severity: qaRequest.releaseContext === "blocking" ? "high" : qaRequest.releaseContext === "candidate" ? "medium" : "low",
            rationale: `The MVP QA workflow remains read-only and request-driven, so ${focusArea} still depends on referenced evidence rather than automatic execution.`,
            confidence: 0.74,
            location: qaRequest.targetRef,
            tags: ["qa", focusArea]
          }))
        : [
            {
              id: "qa-finding-1",
              title: "Review referenced QA evidence before promotion",
              summary: `QA review requires bounded interpretation of the referenced evidence for ${qaRequest.targetRef}.`,
              severity: qaRequest.releaseContext === "blocking" ? "high" : "medium",
              rationale: "The current QA workflow synthesizes a report from validated references and does not execute arbitrary test commands.",
              confidence: 0.71,
              location: qaRequest.targetRef,
              tags: ["qa", "evidence"]
            }
          ];
    const coverageGaps = [
      ...(evidenceSources.length === 0 ? ["No QA evidence sources were provided beyond the target reference."] : []),
      ...missingEvidenceSources.map((pathValue) => `Referenced QA evidence is missing: ${pathValue}`),
      ...(focusAreas.includes("coverage") ? ["Coverage evidence still needs deterministic normalization before it can be promoted to an official QA signal."] : []),
      ...(executedChecks.length === 0 ? ["No executed validation checks were recorded in the request."] : []),
      ...unrecognizedExecutedChecks.map((command) => `Executed check is outside the bounded allowlist and still needs manual interpretation: ${command}`)
    ];
    const recommendedNextChecks = [
      ...executedChecks.map((command) => `Review the recorded output for \`${command}\` before promotion.`),
      ...focusAreas.map((focusArea) => `Confirm whether ${focusArea} needs additional deterministic QA evidence.`),
      ...(normalizedConstraints.length > 0 ? [`Keep QA follow-up bounded by: ${normalizedConstraints.join("; ")}.`] : [])
    ];
    const summary = `QA report prepared for ${qaRequest.targetRef}.`;
    const qaReport = qaArtifactSchema.parse({
      ...buildArtifactEnvelopeBase(state, summary, [requestFile ?? ".agentops/requests/qa.yaml", qaRequest.targetRef, ...qaRequest.evidenceSources]),
      artifactKind: "qa-report",
      lifecycleDomain: "test",
      payload: {
        targetRef: qaRequest.targetRef,
        evidenceSources,
        executedChecks,
        findings,
        coverageGaps,
        recommendedNextChecks:
          recommendedNextChecks.length > 0
            ? recommendedNextChecks
            : ["Capture additional bounded QA evidence before promotion."],
        releaseImpact:
          qaRequest.releaseContext === "blocking"
            ? "release-blocking QA findings require resolution before promotion."
            : qaRequest.releaseContext === "candidate"
              ? "candidate release still requires explicit QA review before promotion."
              : "no release context was supplied; QA output remains advisory."
      }
    });

    return agentOutputSchema.parse({
      summary,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [qaReport satisfies QaArtifact],
      requestedTools: [],
      blockedActionFlags: [],
      confidence: 0.74,
      metadata: {
        deterministicInputs: {
          targetRef: qaRequest.targetRef,
          targetType,
          evidenceSources,
          executedChecks,
          focusAreas,
          constraints: normalizedConstraints
        },
        synthesizedAssessment: {
          releaseContext: qaRequest.releaseContext,
          recommendedNextChecks: qaReport.payload.recommendedNextChecks,
          coverageGaps: qaReport.payload.coverageGaps
        }
      }
    });
  }
};
