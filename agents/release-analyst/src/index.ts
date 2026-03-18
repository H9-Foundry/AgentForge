import { agentManifestSchema, agentOutputSchema, releaseArtifactSchema } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";
import type { GithubReference, ReleaseArtifact, ReleaseRequest, WorkflowStateEnvelope } from "@h9-foundry/agentforge-shared-types";

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
      displayName: "Release Readiness"
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
  name: "release-analyst",
  displayName: "Release Analyst",
  category: "release",
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
  inputs: ["workflowInputs", "repo", "agentResults"],
  outputs: ["lifecycleArtifacts"],
  contextPolicy: {
    sections: ["workflowInputs", "repo", "agentResults"],
    minimalContext: true
  },
  catalog: {
    domain: "release",
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

export const releaseAnalystAgent: RuntimeAgent = {
  manifest,
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const releaseRequest = getWorkflowInput<ReleaseRequest>(stateSlice, "releaseRequest");
    const releaseIssueRefs = getWorkflowInput<string[]>(stateSlice, "releaseIssueRefs") ?? [];
    const releaseGithubRefs = getWorkflowInput<GithubReference[]>(stateSlice, "releaseGithubRefs") ?? [];
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!releaseRequest) {
      throw new Error("release-readiness requires validated release inputs before release analysis.");
    }

    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const qaReportRefs = asStringArray(intakeMetadata.qaReportRefs).length > 0
      ? asStringArray(intakeMetadata.qaReportRefs)
      : releaseRequest.qaReportRefs;
    const securityReportRefs = asStringArray(intakeMetadata.securityReportRefs).length > 0
      ? asStringArray(intakeMetadata.securityReportRefs)
      : releaseRequest.securityReportRefs;
    const evidenceSources = asStringArray(intakeMetadata.evidenceSources).length > 0
      ? asStringArray(intakeMetadata.evidenceSources)
      : releaseRequest.evidenceSources;
    const constraints = asStringArray(intakeMetadata.constraints);
    const allEvidenceRefs = [...new Set([...qaReportRefs, ...securityReportRefs, ...evidenceSources])];
    const verificationChecks = [
      {
        name: "qa-report-refs",
        status: qaReportRefs.length > 0 ? "passed" : "skipped",
        detail: qaReportRefs.length > 0
          ? `Using ${qaReportRefs.length} validated QA report reference(s).`
          : "No QA report references were supplied."
      },
      {
        name: "security-report-refs",
        status: securityReportRefs.length > 0 ? "passed" : "skipped",
        detail: securityReportRefs.length > 0
          ? `Using ${securityReportRefs.length} validated security report reference(s).`
          : "No security report references were supplied."
      },
      {
        name: "local-release-evidence",
        status: evidenceSources.length > 0 ? "passed" : "skipped",
        detail: evidenceSources.length > 0
          ? `Using ${evidenceSources.length} bounded local release evidence source(s).`
          : "No additional local release evidence sources were supplied."
      }
    ] as const;
    const readinessStatus =
      qaReportRefs.length > 0 && securityReportRefs.length > 0
        ? "ready"
        : qaReportRefs.length > 0 || securityReportRefs.length > 0
          ? "partial"
          : "blocked";
    const summary = `Release report prepared for ${releaseRequest.releaseScope}.`;
    const publishingPlan = [
      "Review the bounded QA and security evidence before invoking any publish or promotion step.",
      "Run `agentforge release check --json` and `agentforge release verify --json` before any release cut.",
      "Keep trusted publishing and tag or publish actions outside this default read-only workflow path."
    ];
    const rollbackNotes = [
      "Use the release report to decide whether to pause or defer promotion before any publish step.",
      "If readiness remains partial or blocked, keep the current version set unchanged and resolve evidence gaps first."
    ];
    const externalDependencies = [
      ...(qaReportRefs.length > 0 ? ["Validated QA report inputs remain available for reviewer inspection."] : []),
      ...(securityReportRefs.length > 0 ? ["Validated security report inputs remain available for reviewer inspection."] : [])
    ];
    const releaseReport = releaseArtifactSchema.parse({
      ...buildArtifactEnvelopeBase(
        state,
        summary,
        [requestFile ?? ".agentops/requests/release.yaml", ...allEvidenceRefs],
        releaseIssueRefs,
        releaseGithubRefs
      ),
      artifactKind: "release-report",
      lifecycleDomain: "release",
      payload: {
        releaseScope: releaseRequest.releaseScope,
        versionTargets: releaseRequest.versionTargets,
        readinessStatus,
        verificationChecks: verificationChecks.map((check) => ({ ...check })),
        publishingPlan,
        trustStatus: "trusted-publishing-reviewed-separately",
        publishedPackages: [],
        tagRefs: [],
        provenanceRefs: allEvidenceRefs,
        rollbackNotes,
        externalDependencies
      }
    });

    return agentOutputSchema.parse({
      summary,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [releaseReport satisfies ReleaseArtifact],
      requestedTools: [],
      blockedActionFlags: [],
      confidence: 0.77,
      metadata: {
        deterministicInputs: {
          versionTargets: releaseRequest.versionTargets,
          qaReportRefs,
          securityReportRefs,
          evidenceSources,
          constraints
        },
        synthesizedAssessment: {
          readinessStatus,
          publishingPlan,
          rollbackNotes
        }
      }
    });
  }
};

export default releaseAnalystAgent;
