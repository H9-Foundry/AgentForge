import type {
  AuditBundle,
  AuditEntry,
  DesignArtifact,
  GithubHandoffSection,
  GithubHandoffSummary,
  GithubReference,
  GithubWorkflowStatusMapping,
  IncidentArtifact,
  PlanningArtifact,
  QaArtifact,
  ReleaseCiEvidenceSummary,
  ReleaseArtifact,
  ScmReference,
  WorkflowStateEnvelope
} from "@h9-foundry/agentforge-shared-types";

type GitHubRenderableArtifact = PlanningArtifact | DesignArtifact | IncidentArtifact | QaArtifact | ReleaseArtifact;

export function createAuditEntry(entry: AuditEntry): AuditEntry {
  return entry;
}

function splitGitHubRefs(githubRefs: readonly GithubReference[]): { issueRefs: GithubReference[]; pullRequestRefs: GithubReference[] } {
  return githubRefs.reduce(
    (accumulator, githubRef) => {
      if (githubRef.kind === "pull_request") {
        accumulator.pullRequestRefs.push(githubRef);
      } else {
        accumulator.issueRefs.push(githubRef);
      }

      return accumulator;
    },
    { issueRefs: [] as GithubReference[], pullRequestRefs: [] as GithubReference[] }
  );
}

function mapArtifactStatusToGitHubStatus(
  artifactStatus: GitHubRenderableArtifact["status"],
  statusMapping?: GithubWorkflowStatusMapping
): GithubHandoffSummary["githubStatus"] {
  if (statusMapping) {
    return statusMapping.githubStatus;
  }

  if (artifactStatus === "complete") {
    return "completed";
  }

  if (artifactStatus === "draft") {
    return "in_progress";
  }

  return "blocked";
}

function renderPlanningSections(artifact: PlanningArtifact): GithubHandoffSection[] {
  return [
    { heading: "Summary", lines: [artifact.summary] },
    { heading: "Objectives", lines: artifact.payload.objectives },
    { heading: "Recommended Next Steps", lines: artifact.payload.recommendedNextSteps },
    { heading: "Risks", lines: artifact.payload.risks ?? [] },
    { heading: "Open Questions", lines: artifact.payload.openQuestions ?? [] }
  ].filter((section) => section.lines.length > 0);
}

function renderDesignSections(artifact: DesignArtifact): GithubHandoffSection[] {
  return [
    { heading: "Summary", lines: [artifact.summary] },
    { heading: "Chosen Approach", lines: [artifact.payload.chosenApproach] },
    {
      heading: "Options Considered",
      lines: artifact.payload.optionsConsidered.map((option) => `${option.option}: ${option.summary}`)
    },
    { heading: "Trade-Offs", lines: artifact.payload.tradeOffs ?? [] },
    { heading: "Risks", lines: artifact.payload.risks ?? [] },
    { heading: "Follow-Up Work", lines: artifact.payload.followUpWork ?? [] }
  ].filter((section) => section.lines.length > 0);
}

function renderQaSections(artifact: QaArtifact): GithubHandoffSection[] {
  return [
    { heading: "Summary", lines: [artifact.summary] },
    {
      heading: "Findings",
      lines: artifact.payload.findings.map((finding) => `[${finding.severity}] ${finding.title}: ${finding.summary}`)
    },
    { heading: "Coverage Gaps", lines: artifact.payload.coverageGaps ?? [] },
    { heading: "Recommended Next Checks", lines: artifact.payload.recommendedNextChecks ?? [] },
    { heading: "Release Impact", lines: [artifact.payload.releaseImpact] }
  ].filter((section) => section.lines.length > 0);
}

function renderIncidentSections(artifact: IncidentArtifact): GithubHandoffSection[] {
  return [
    { heading: "Summary", lines: [artifact.summary] },
    { heading: "Timeline Summary", lines: artifact.payload.timelineSummary ?? [] },
    { heading: "Likely Impacted Areas", lines: artifact.payload.likelyImpactedAreas ?? [] },
    { heading: "Follow-Up Workflows", lines: artifact.payload.followUpWorkflowRefs ?? [] },
    { heading: "Open Questions", lines: artifact.payload.openQuestions ?? [] }
  ].filter((section) => section.lines.length > 0);
}

function renderReleaseSections(artifact: ReleaseArtifact): GithubHandoffSection[] {
  return [
    { heading: "Summary", lines: [artifact.summary] },
    { heading: "Readiness Status", lines: [artifact.payload.readinessStatus] },
    {
      heading: "Verification Checks",
      lines: artifact.payload.verificationChecks.map((check) => `${check.name}: ${check.status}${check.detail ? ` (${check.detail})` : ""}`)
    },
    { heading: "Publishing Plan", lines: artifact.payload.publishingPlan ?? [] },
    { heading: "Rollback Notes", lines: artifact.payload.rollbackNotes ?? [] }
  ].filter((section) => section.lines.length > 0);
}

function renderSharedScmSection(artifact: GitHubRenderableArtifact): GithubHandoffSection[] {
  const githubCanonicals = new Set((artifact.source.githubRefs ?? []).map((entry) => entry.canonical));
  const lines = [...new Set(
    (artifact.source.scmRefs ?? [])
      .filter((entry) => !githubCanonicals.has(entry.canonical))
      .map((entry: ScmReference) => `${entry.platform} ${entry.kind}: ${entry.canonical}`)
  )];

  return lines.length > 0 ? [{ heading: "SCM References", lines }] : [];
}

function readArtifactCiEvidenceSummary(artifact: GitHubRenderableArtifact): ReleaseCiEvidenceSummary[] {
  switch (artifact.artifactKind) {
    case "qa-report":
      return artifact.payload.ciEvidenceSummary ?? [];
    case "release-report":
      return artifact.payload.ciEvidenceSummary ?? [];
    default:
      return [];
  }
}

function renderSharedCiSection(artifact: GitHubRenderableArtifact): GithubHandoffSection[] {
  const ciEvidenceSummary = readArtifactCiEvidenceSummary(artifact);
  if (ciEvidenceSummary.length === 0) {
    return [];
  }

  const lines = ciEvidenceSummary.flatMap((entry) =>
    entry.failingChecks.length > 0
      ? [entry.statusSummary, `Failing checks: ${entry.failingChecks.join(", ")}`]
      : [entry.statusSummary]
  );

  return [{ heading: "CI Evidence", lines }];
}

function buildGitHubHandoffSections(artifact: GitHubRenderableArtifact): GithubHandoffSection[] {
  const baseSections = (() => {
    switch (artifact.artifactKind) {
    case "planning-brief":
      return renderPlanningSections(artifact);
    case "design-record":
      return renderDesignSections(artifact);
    case "incident-brief":
      return renderIncidentSections(artifact);
    case "qa-report":
      return renderQaSections(artifact);
    case "release-report":
      return renderReleaseSections(artifact);
    }
  })();

  return [...baseSections, ...renderSharedScmSection(artifact), ...renderSharedCiSection(artifact)];
}

function buildHandoffTitle(artifact: GitHubRenderableArtifact, issueRefs: readonly GithubReference[], pullRequestRefs: readonly GithubReference[]): string {
  const primaryRef = issueRefs[0] ?? pullRequestRefs[0];
  if (!primaryRef) {
    return `${artifact.workflow.displayName ?? artifact.workflow.name} handoff`;
  }

  return `${artifact.workflow.displayName ?? artifact.workflow.name} handoff for ${primaryRef.canonical}`;
}

function renderHandoffBody(artifact: GitHubRenderableArtifact, sections: readonly GithubHandoffSection[]): string {
  const lines = [`${artifact.workflow.displayName ?? artifact.workflow.name} handoff for \`${artifact.workflow.name}\`.`, ""];

  for (const section of sections) {
    lines.push(`${section.heading}:`);
    for (const line of section.lines) {
      lines.push(`- ${line}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function renderGitHubHandoffSummary(
  artifact: GitHubRenderableArtifact,
  options?: { statusMapping?: GithubWorkflowStatusMapping }
): GithubHandoffSummary {
  const { issueRefs, pullRequestRefs } = splitGitHubRefs(artifact.source.githubRefs);
  const sections = buildGitHubHandoffSections(artifact);
  const summary = sections[0]?.lines[0] ?? artifact.summary;

  return {
    artifactKind: artifact.artifactKind,
    workflow: artifact.workflow.name,
    githubStatus: mapArtifactStatusToGitHubStatus(artifact.status, options?.statusMapping),
    title: buildHandoffTitle(artifact, issueRefs, pullRequestRefs),
    summary,
    body: renderHandoffBody(artifact, sections),
    issueRefs,
    pullRequestRefs,
    provenanceRefs: [...new Set([artifact.auditLink.bundlePath, ...artifact.source.inputRefs].filter((entry): entry is string => Boolean(entry)))],
    sections
  };
}

export function buildAuditBundle(
  state: WorkflowStateEnvelope,
  options: {
    startedAt: string;
    finishedAt: string;
    status: "success" | "partial" | "failed";
    jsonPath: string;
    markdownPath: string;
    provenance: AuditBundle["provenance"];
    redaction: AuditBundle["redaction"];
    components: AuditBundle["components"];
  }
): AuditBundle {
  return {
    version: state.version,
    runId: state.runId,
    workflow: state.workflow,
    startedAt: options.startedAt,
    finishedAt: options.finishedAt,
    status: options.status,
    policy: state.policy,
    entries: state.auditTrail,
    findings: state.findings,
    proposedActions: state.proposedActions,
    blockedPlugins: state.blockedPlugins,
    lifecycleArtifacts: state.lifecycleArtifacts,
    artifactPaths: {
      json: options.jsonPath,
      markdown: options.markdownPath
    },
    provenance: options.provenance,
    redaction: options.redaction,
    components: options.components
  };
}

export function renderAuditBundleMarkdown(bundle: AuditBundle): string {
  const lines = [
    `# AgentForge Run ${bundle.runId}`,
    "",
    `- Workflow: ${bundle.workflow}`,
    `- Status: ${bundle.status}`,
    `- Started: ${bundle.startedAt}`,
    `- Finished: ${bundle.finishedAt}`,
    `- Findings: ${bundle.findings.length}`,
    `- Proposed actions: ${bundle.proposedActions.length}`,
    `- Blocked plugins: ${bundle.blockedPlugins.length}`,
    `- Redaction applied: ${bundle.redaction.applied ? "yes" : "no"}`,
    `- Trusted components recorded: ${bundle.components.length}`,
    ""
  ];

  if (bundle.findings.length > 0) {
    lines.push("## Findings", "");
    for (const finding of bundle.findings) {
      lines.push(`- [${finding.severity}] ${finding.title}: ${finding.summary}`);
    }
    lines.push("");
  }

  const blockedEntries = bundle.entries.filter((entry) => entry.blockedActions.length > 0);
  if (blockedEntries.length > 0) {
    lines.push("## Blocked Actions", "");
    for (const entry of blockedEntries) {
      lines.push(`- ${entry.nodeName}: ${entry.blockedActions.join(", ")}`);
    }
    lines.push("");
  }

  if (bundle.blockedPlugins.length > 0) {
    lines.push("## Blocked Plugins", "");
    for (const blockedPlugin of bundle.blockedPlugins) {
      lines.push(`- ${blockedPlugin.name} (${blockedPlugin.package}): ${blockedPlugin.reason}`);
    }
    lines.push("");
  }

  if (bundle.lifecycleArtifacts.length > 0) {
    lines.push("## Lifecycle Artifacts", "");
    for (const artifact of bundle.lifecycleArtifacts) {
      lines.push(`- ${artifact.artifactKind}: ${artifact.summary}`);
    }
    lines.push("");
  }

  lines.push("## Audit Trail", "");
  for (const entry of bundle.entries) {
    lines.push(`- ${entry.nodeName}: ${entry.status} (${entry.summary})`);
  }

  return lines.join("\n");
}
