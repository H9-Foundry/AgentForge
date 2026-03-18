import { agentManifestSchema, agentOutputSchema, incidentArtifactSchema, incidentEvidenceNormalizationSchema } from "@h9-foundry/agentforge-schemas";
import type { GithubReference, IncidentArtifact, IncidentEvidenceNormalization, IncidentRequest, WorkflowStateEnvelope } from "@h9-foundry/agentforge-shared-types";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asGithubRefs(value: unknown): GithubReference[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is GithubReference =>
          Boolean(entry) && typeof entry === "object" && "canonical" in entry && typeof (entry as { canonical?: unknown }).canonical === "string"
      )
    : [];
}

function getWorkflowInput<T>(stateSlice: Partial<WorkflowStateEnvelope>, key: string): T | undefined {
  if (!isRecord(stateSlice.workflowInputs)) {
    return undefined;
  }

  return stateSlice.workflowInputs[key] as T | undefined;
}

function buildArtifactEnvelopeBase(
  state: WorkflowStateEnvelope,
  summary: string,
  inputRefs: readonly string[],
  issueRefs: readonly string[],
  githubRefs: readonly GithubReference[]
) {
  return {
    schemaVersion: state.version,
    workflow: {
      name: state.workflow,
      displayName: "Incident Handoff"
    },
    source: {
      sourceType: "workflow-run" as const,
      runId: state.runId,
      inputRefs: [...inputRefs],
      issueRefs: [...issueRefs],
      githubRefs: [...githubRefs]
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
      categories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key", "operational-sensitive"]
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
  name: "incident-analyst",
  displayName: "Incident Analyst",
  category: "operate",
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
    domain: "operate",
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

export const incidentAnalystAgent: RuntimeAgent = {
  manifest,
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const incidentRequest = getWorkflowInput<IncidentRequest>(stateSlice, "incidentRequest");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    const incidentIssueRefs = getWorkflowInput<string[]>(stateSlice, "incidentIssueRefs") ?? [];
    const incidentGithubRefs = asGithubRefs(getWorkflowInput<unknown>(stateSlice, "incidentGithubRefs"));
    if (!incidentRequest) {
      throw new Error("incident-handoff requires validated incident inputs before incident analysis.");
    }

    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const evidenceMetadata = incidentEvidenceNormalizationSchema.safeParse(stateSlice.agentResults?.evidence?.metadata);
    const normalizedEvidence = evidenceMetadata.success ? evidenceMetadata.data : undefined;
    const severityHint =
      normalizedEvidence?.severityHint ??
      (typeof intakeMetadata.severityHint === "string" ? intakeMetadata.severityHint : incidentRequest.severityHint);
    const evidenceSources =
      normalizedEvidence?.normalizedEvidenceSources && normalizedEvidence.normalizedEvidenceSources.length > 0
        ? normalizedEvidence.normalizedEvidenceSources
        : [
            ...new Set([
              ...asStringArray(intakeMetadata.evidenceSources),
              ...asStringArray(intakeMetadata.releaseReportRefs),
              ...incidentRequest.evidenceSources,
              ...incidentRequest.releaseReportRefs
            ])
          ];
    const constraints = asStringArray(intakeMetadata.constraints);
    const followUpWorkflowRefs =
      normalizedEvidence?.followUpWorkflowRefs && normalizedEvidence.followUpWorkflowRefs.length > 0
        ? normalizedEvidence.followUpWorkflowRefs
        : [
            "maintenance-triage",
            ...(incidentRequest.releaseReportRefs.length > 0 ? ["release-readiness"] : []),
            ...(severityHint === "high" || severityHint === "critical" ? ["security-review"] : [])
          ];
    const likelyImpactedAreas =
      normalizedEvidence?.likelyImpactedAreas && normalizedEvidence.likelyImpactedAreas.length > 0
        ? normalizedEvidence.likelyImpactedAreas
        : [
            ...(incidentRequest.releaseReportRefs.length > 0 ? ["release-readiness"] : []),
            ...(incidentRequest.evidenceSources.length > 0 ? ["staged-operational-evidence"] : []),
            ...(severityHint === "high" || severityHint === "critical" ? ["security-follow-up"] : [])
          ];
    const openQuestions = [
      ...(incidentRequest.issueRefs.length === 0 ? ["Should this incident be linked to a tracked issue before escalation?"] : []),
      ...(incidentRequest.releaseReportRefs.length === 0 ? ["Is there a release-report bundle that should be attached for additional provenance?"] : [])
    ];
    const summary = `Incident brief prepared for ${incidentRequest.incidentSummary}.`;
    const incidentBrief = incidentArtifactSchema.parse({
      ...buildArtifactEnvelopeBase(
        state,
        summary,
        [requestFile ?? ".agentops/requests/incident.yaml", ...evidenceSources],
        incidentIssueRefs,
        incidentGithubRefs
      ),
      artifactKind: "incident-brief",
      lifecycleDomain: "operate",
      payload: {
        incidentSummary: incidentRequest.incidentSummary,
        evidenceSources,
        timelineSummary:
          normalizedEvidence?.timelineSummary ??
          [
            `Severity hint: ${severityHint}.`,
            `Validated ${incidentRequest.evidenceSources.length} staged evidence source(s) and ${incidentRequest.releaseReportRefs.length} release-report reference(s) before reasoning.`
          ],
        likelyImpactedAreas:
          likelyImpactedAreas.length > 0
            ? likelyImpactedAreas
            : ["manual incident triage is still required to identify impacted repository areas."],
        followUpWorkflowRefs: [...new Set(followUpWorkflowRefs)],
        openQuestions
      }
    });

    return agentOutputSchema.parse({
      summary,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [incidentBrief satisfies IncidentArtifact],
      requestedTools: [],
      blockedActionFlags: [],
      confidence: severityHint === "critical" ? 0.7 : 0.74,
      metadata: {
        deterministicInputs: {
          severityHint,
          evidenceSources,
          issueRefs: incidentIssueRefs,
          constraints,
          normalizedEvidence: (normalizedEvidence ?? null) satisfies IncidentEvidenceNormalization | null
        },
        synthesizedAssessment: {
          likelyImpactedAreas: incidentBrief.payload.likelyImpactedAreas,
          followUpWorkflowRefs: incidentBrief.payload.followUpWorkflowRefs,
          openQuestions: incidentBrief.payload.openQuestions
        }
      }
    });
  }
};
