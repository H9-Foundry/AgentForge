import { agentManifestSchema, agentOutputSchema, maintenanceArtifactSchema, maintenanceEvidenceNormalizationSchema } from "@h9-foundry/agentforge-schemas";
import type {
  GithubReference,
  MaintenanceArtifact,
  MaintenanceEvidenceNormalization,
  MaintenanceRequest,
  WorkflowStateEnvelope
} from "@h9-foundry/agentforge-shared-types";
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
      displayName: "Maintenance Triage"
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
  name: "maintenance-analyst",
  displayName: "Maintenance Analyst",
  category: "maintain",
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
    domain: "maintain",
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

export const maintenanceAnalystAgent: RuntimeAgent = {
  manifest,
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const maintenanceRequest = getWorkflowInput<MaintenanceRequest>(stateSlice, "maintenanceRequest");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    const maintenanceIssueRefs = getWorkflowInput<string[]>(stateSlice, "maintenanceIssueRefs") ?? [];
    const maintenanceGithubRefs = asGithubRefs(getWorkflowInput<unknown>(stateSlice, "maintenanceGithubRefs"));
    if (!maintenanceRequest) {
      throw new Error("maintenance-triage requires validated maintenance inputs before maintenance analysis.");
    }

    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const evidenceMetadata = maintenanceEvidenceNormalizationSchema.safeParse(stateSlice.agentResults?.evidence?.metadata);
    const normalizedEvidence: MaintenanceEvidenceNormalization | undefined = evidenceMetadata.success ? evidenceMetadata.data : undefined;
    const dependencyAlertRefs =
      normalizedEvidence?.dependencyAlertRefs ??
      (asStringArray(intakeMetadata.dependencyAlertRefs).length > 0
        ? asStringArray(intakeMetadata.dependencyAlertRefs)
        : maintenanceRequest.dependencyAlertRefs);
    const docsTaskRefs =
      normalizedEvidence?.docsTaskRefs ??
      (asStringArray(intakeMetadata.docsTaskRefs).length > 0
        ? asStringArray(intakeMetadata.docsTaskRefs)
        : maintenanceRequest.docsTaskRefs);
    const releaseReportRefs =
      normalizedEvidence?.releaseReportRefs ??
      (asStringArray(intakeMetadata.releaseReportRefs).length > 0
        ? asStringArray(intakeMetadata.releaseReportRefs)
        : maintenanceRequest.releaseReportRefs);
    const constraints = asStringArray(intakeMetadata.constraints);
    const evidenceSources =
      normalizedEvidence?.normalizedEvidenceSources ?? [...new Set([...dependencyAlertRefs, ...docsTaskRefs, ...releaseReportRefs])];
    const affectedPackagesOrDocs = normalizedEvidence?.affectedPackagesOrDocs ?? [];
    const followUpWorkflowRefs = normalizedEvidence?.followUpWorkflowRefs ?? [];
    const routingRecommendation = normalizedEvidence?.routingRecommendation ?? "implementation-proposal";
    const maintenanceSignals = normalizedEvidence?.maintenanceSignals ?? [];
    const referencedArtifactKinds = normalizedEvidence?.referencedArtifactKinds ?? [];
    const currentFindings = [
      ...(maintenanceSignals.length > 0
        ? maintenanceSignals
        : [
            ...(dependencyAlertRefs.length > 0 ? [`${dependencyAlertRefs.length} dependency alert reference(s) require maintenance triage.`] : []),
            ...(docsTaskRefs.length > 0 ? [`${docsTaskRefs.length} docs task reference(s) require maintenance triage.`] : []),
            ...(releaseReportRefs.length > 0 ? [`${releaseReportRefs.length} release-report reference(s) contribute maintenance follow-up context.`] : [])
          ])
    ];
    const recommendedActions = [
      ...dependencyAlertRefs.map((pathValue) => `Review dependency alert reference \`${pathValue}\` before choosing a follow-up workflow.`),
      ...docsTaskRefs.map((pathValue) => `Review docs task reference \`${pathValue}\` before choosing a follow-up workflow.`),
      ...releaseReportRefs.map((pathValue) => `Review release report reference \`${pathValue}\` for maintenance-linked follow-up work.`),
      ...(affectedPackagesOrDocs.length > 0 ? [`Review the affected maintenance surfaces: ${affectedPackagesOrDocs.join(", ")}.`] : []),
      ...(followUpWorkflowRefs.length > 0
        ? [`Route the next bounded follow-up through ${routingRecommendation} (${followUpWorkflowRefs.join(", ")} considered).`]
        : []),
      ...(constraints.length > 0 ? [`Keep maintenance follow-up bounded by: ${constraints.join("; ")}.`] : [])
    ];
    const priorityAssessment =
      dependencyAlertRefs.length > 1 || releaseReportRefs.length > 0
        ? "Elevated maintenance triage: release-linked or multi-alert follow-up should be prioritized before broader maintenance work."
        : "Routine maintenance triage: review bounded references and route follow-up deliberately.";
    const risks = [
      ...(releaseReportRefs.length > 0 ? ["Release-linked maintenance follow-up can drift if release-readiness is deferred."] : []),
      ...(dependencyAlertRefs.length > 0 ? ["Dependency alert follow-up can widen change scope once implementation work begins."] : []),
      ...(docsTaskRefs.length > 0 ? ["Documentation debt can diverge from implemented behavior if maintenance triage is deferred."] : []),
      ...(referencedArtifactKinds.includes("security-report")
        ? ["Security-linked maintenance follow-up should remain prioritized until the linked evidence is resolved."]
        : [])
    ];
    const stalenessSignals = [
      ...(dependencyAlertRefs.length > 0 ? ["Dependency alert follow-up remains pending review."] : []),
      ...(docsTaskRefs.length > 0 ? ["Documentation maintenance follow-up remains pending review."] : []),
      ...(releaseReportRefs.length > 0 ? ["Release-linked maintenance follow-up remains pending review."] : [])
    ];
    const summary = `Maintenance report prepared for ${maintenanceRequest.maintenanceGoal}.`;
    const maintenanceReport = maintenanceArtifactSchema.parse({
      ...buildArtifactEnvelopeBase(
        state,
        summary,
        [requestFile ?? ".agentops/requests/maintenance.yaml", ...evidenceSources],
        maintenanceIssueRefs,
        maintenanceGithubRefs
      ),
      artifactKind: "maintenance-report",
      lifecycleDomain: "maintain",
      payload: {
        maintenanceScope: maintenanceRequest.maintenanceGoal,
        evidenceSources,
        affectedPackagesOrDocs,
        currentFindings:
          currentFindings.length > 0
            ? currentFindings
            : ["Maintenance triage remained bounded to validated references; no additional findings were synthesized."],
        recommendedActions:
          recommendedActions.length > 0
            ? recommendedActions
            : ["Add at least one bounded maintenance reference before broadening the workflow surface."],
        routingRecommendation,
        followUpWorkflowRefs,
        risks,
        priorityAssessment,
        dependencyUpdates: dependencyAlertRefs,
        docsUpdates: docsTaskRefs,
        stalenessSignals,
        followUpIssues: maintenanceIssueRefs
      }
    });

    return agentOutputSchema.parse({
      summary,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [maintenanceReport satisfies MaintenanceArtifact],
      requestedTools: [],
      blockedActionFlags: [],
      confidence: 0.73,
      metadata: {
        deterministicInputs: {
          evidenceSources,
          dependencyAlertRefs,
          docsTaskRefs,
          releaseReportRefs,
          affectedPackagesOrDocs,
          maintenanceSignals,
          referencedArtifactKinds,
          issueRefs: maintenanceIssueRefs,
          constraints
        },
        synthesizedAssessment: {
          priorityAssessment: maintenanceReport.payload.priorityAssessment,
          recommendedActions: maintenanceReport.payload.recommendedActions,
          routingRecommendation: maintenanceReport.payload.routingRecommendation,
          followUpWorkflowRefs: maintenanceReport.payload.followUpWorkflowRefs,
          risks: maintenanceReport.payload.risks,
          followUpIssues: maintenanceReport.payload.followUpIssues
        }
      }
    });
  }
};
