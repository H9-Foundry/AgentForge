import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  agentManifestSchema,
  agentOutputSchema,
  designArtifactSchema,
  githubActionsEvidenceSchema,
  implementationArtifactSchema,
  implementationInventorySchema,
  incidentArtifactSchema,
  incidentEvidenceNormalizationSchema,
  incidentRequestSchema,
  maintenanceArtifactSchema,
  maintenanceRequestSchema,
  qaArtifactSchema,
  qaEvidenceNormalizationSchema,
  qaRequestSchema,
  releaseApprovalRecommendationSchema,
  releaseArtifactSchema,
  releaseEvidenceNormalizationSchema,
  releaseRequestSchema,
  securityArtifactSchema,
  securityEvidenceNormalizationSchema,
  securityRequestSchema,
  planningArtifactSchema
} from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";
import type {
  DesignArtifact,
  DesignRequest,
  GithubActionsEvidence,
  GithubActionsEvidenceNormalization,
  GithubReference,
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
  ReleaseArtifact,
  ReleaseEvidenceNormalization,
  ReleaseRequest,
  SecurityArtifact,
  SecurityEvidenceNormalization,
  SecurityRequest,
  WorkflowStateEnvelope
} from "@h9-foundry/agentforge-shared-types";

const contextCollectorAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "context-collector",
    displayName: "Context Collector",
    category: "context",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: ["**/*"],
      writePaths: []
    },
    inputs: ["repo", "changes", "context"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["repo", "changes", "context"],
      minimalContext: true
    },
    catalog: {
      domain: "foundation",
      supportLevel: "official",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const repo = stateSlice.repo;
    const changes = stateSlice.changes;
    const summary = repo && changes
      ? `Collected context for ${repo.name}: ${changes.changedFiles.length} changed file(s), ${changes.impactedPaths.length} impacted path(s).`
      : "Collected base repository context.";

    return agentOutputSchema.parse({
      summary,
      findings: [],
      proposedActions: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        repository: repo?.name,
        changedFiles: changes?.changedFiles ?? [],
        impactedPaths: changes?.impactedPaths ?? []
      }
    });
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function parsePackageScripts(packageJsonPath: string): Record<string, string> {
  if (!existsSync(packageJsonPath)) {
    return {};
  }

  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
  if (!isRecord(parsed) || !isRecord(parsed.scripts)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed.scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

interface WorkspacePackageResolution {
  readonly currentVersion?: string;
  readonly manifestPath?: string;
}

function resolveWorkspacePackage(root: string | undefined, packageName: string): WorkspacePackageResolution {
  if (!root) {
    return {};
  }

  for (const topLevel of ["packages", "agents", "adapters"]) {
    const scopeRoot = join(root, topLevel);
    if (!existsSync(scopeRoot)) {
      continue;
    }

    for (const entry of readdirSync(scopeRoot)) {
      const manifestPath = join(scopeRoot, entry, "package.json");
      if (!existsSync(manifestPath)) {
        continue;
      }

      const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
      if (!isRecord(parsed) || parsed.name !== packageName || typeof parsed.version !== "string") {
        continue;
      }

      return {
        currentVersion: parsed.version,
        manifestPath
      };
    }
  }

  return {};
}

const allowedValidationScriptNames = new Set(["test", "lint", "typecheck", "build", "build:packages", "release:verify"]);

function normalizeRequestedCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

function buildValidationCommand(
  packageManager: string,
  scriptName: string,
  packageName?: string
): string {
  if (packageName) {
    return `${packageManager} --filter ${packageName} ${scriptName}`;
  }

  return `${packageManager} ${scriptName}`;
}

function collectValidationCommands(
  repoRoot: string | undefined,
  packageManager: string,
  packageScopes: readonly string[]
): NormalizedValidationCommand[] {
  const discoveredValidationCommands: NormalizedValidationCommand[] = [];
  const registerScripts = (packageJsonPath: string, source: "package-script" | "workspace-script", packageName?: string) => {
    const scripts = parsePackageScripts(packageJsonPath);
    for (const scriptName of Object.keys(scripts)) {
      const command = buildValidationCommand(packageManager, scriptName, packageName);
      discoveredValidationCommands.push({
        command,
        source,
        classification: allowedValidationScriptNames.has(scriptName) ? "approval_required" : "deny",
        reason: allowedValidationScriptNames.has(scriptName)
          ? "Discovered from a bounded repository script; execution would still require approval."
          : "Command is not in the bounded allowlist for workflow validation."
      });
    }
  };

  if (!repoRoot) {
    return discoveredValidationCommands;
  }

  registerScripts(join(repoRoot, "package.json"), "package-script");
  for (const packageScope of packageScopes) {
    const packageJsonPath = join(repoRoot, packageScope, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
    const packageName = isRecord(parsed) && typeof parsed.name === "string" ? parsed.name : packageScope;
    registerScripts(packageJsonPath, "workspace-script", packageName);
  }

  return discoveredValidationCommands;
}

function loadBundleArtifactKinds(bundlePath: string): string[] {
  if (!existsSync(bundlePath)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(bundlePath, "utf8")) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.lifecycleArtifacts)) {
    return [];
  }

  return parsed.lifecycleArtifacts
    .map((artifact) => (isRecord(artifact) && typeof artifact.artifactKind === "string" ? artifact.artifactKind : undefined))
    .filter((artifactKind): artifactKind is string => Boolean(artifactKind));
}

function loadBundleArtifactPayloadPaths(bundlePath: string): string[] {
  if (!existsSync(bundlePath)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(bundlePath, "utf8")) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.lifecycleArtifacts)) {
    return [];
  }

  return parsed.lifecycleArtifacts.flatMap((artifact) => {
    if (!isRecord(artifact) || !isRecord(artifact.payload)) {
      return [];
    }

    const payload = artifact.payload as Record<string, unknown>;
    if (Array.isArray(payload.affectedPaths)) {
      return asStringArray(payload.affectedPaths);
    }

    if (Array.isArray(payload.evidenceSources)) {
      return asStringArray(payload.evidenceSources);
    }

    return [];
  });
}

function loadBundleFinishedAt(bundlePath: string): string | undefined {
  if (!existsSync(bundlePath)) {
    return undefined;
  }

  const parsed = JSON.parse(readFileSync(bundlePath, "utf8")) as unknown;
  return isRecord(parsed) && typeof parsed.finishedAt === "string" ? parsed.finishedAt : undefined;
}

function describeEvidenceObservation(repoRoot: string | undefined, pathValue: string): string {
  if (!repoRoot) {
    return `Observed source ${pathValue} during deterministic intake.`;
  }

  const absolutePath = join(repoRoot, pathValue);
  if (!existsSync(absolutePath)) {
    return `Observed source ${pathValue} during deterministic intake.`;
  }

  const observedAt =
    pathValue.endsWith(".json") && pathValue.includes(".agentops/runs/")
      ? loadBundleFinishedAt(absolutePath)
      : undefined;
  const fallbackObservedAt = observedAt ?? statSync(absolutePath).mtime.toISOString();
  return `Observed source ${pathValue} at ${fallbackObservedAt}.`;
}

function loadGitHubActionsEvidence(bundlePath: string): GithubActionsEvidence | undefined {
  if (!existsSync(bundlePath) || !bundlePath.endsWith(".json")) {
    return undefined;
  }

  const parsed = JSON.parse(readFileSync(bundlePath, "utf8")) as unknown;
  const candidate = isRecord(parsed) ? { ...parsed, sourcePath: parsed.sourcePath ?? bundlePath } : parsed;
  const result = githubActionsEvidenceSchema.safeParse(candidate);
  return result.success ? result.data : undefined;
}

function isFailingGitHubActionsConclusion(conclusion: string | undefined): boolean {
  return Boolean(conclusion && !["success", "neutral", "skipped"].includes(conclusion));
}

function summarizeGitHubActionsFailures(evidence: GithubActionsEvidence): string[] {
  const failedJobs = evidence.jobs
    .filter((job) => job.status === "completed" && isFailingGitHubActionsConclusion(job.conclusion))
    .map((job) => `${evidence.workflowName} / ${job.name}`);
  const failedCheckRuns = evidence.checkRuns
    .filter((checkRun) => checkRun.status === "completed" && isFailingGitHubActionsConclusion(checkRun.conclusion))
    .map((checkRun) => `${evidence.workflowName} / ${checkRun.name}`);
  const runLevelFailure =
    failedJobs.length === 0 &&
      failedCheckRuns.length === 0 &&
      evidence.status === "completed" &&
      isFailingGitHubActionsConclusion(evidence.conclusion)
      ? [`${evidence.workflowName} / workflow-run`]
      : [];

  return [...failedJobs, ...failedCheckRuns, ...runLevelFailure];
}

function normalizeGitHubActionsEvidence(
  repoRoot: string | undefined,
  evidenceSources: readonly string[]
): GithubActionsEvidenceNormalization {
  const evidence = evidenceSources.flatMap((pathValue) => {
    if (!repoRoot) {
      return [];
    }

    const normalized = loadGitHubActionsEvidence(join(repoRoot, pathValue));
    return normalized ? [normalized] : [];
  });
  const workflowNames = [...new Set(evidence.map((entry) => entry.workflowName))];
  const failingChecks = [...new Set(evidence.flatMap((entry) => summarizeGitHubActionsFailures(entry)))];
  const provenanceRefs = [
    ...new Set(
      evidence.flatMap((entry) => [
        entry.sourcePath,
        entry.htmlUrl,
        ...entry.jobs.map((job) => job.htmlUrl),
        ...entry.checkRuns.map((checkRun) => checkRun.detailsUrl)
      ].filter((value): value is string => Boolean(value)))
    )
  ];

  return {
    evidence,
    workflowNames,
    failingChecks,
    provenanceRefs
  };
}

function derivePackageScope(pathValue: string): string | undefined {
  const segments = pathValue.split("/").filter(Boolean);
  if (segments.length < 2) {
    return undefined;
  }

  const [topLevel, scope] = segments;
  if (topLevel === "packages" || topLevel === "agents" || topLevel === "adapters") {
    return `${topLevel}/${scope}`;
  }

  return undefined;
}

function getWorkflowInput<T>(stateSlice: Partial<WorkflowStateEnvelope>, key: string): T | undefined {
  if (!isRecord(stateSlice.workflowInputs)) {
    return undefined;
  }

  return stateSlice.workflowInputs[key] as T | undefined;
}

function buildLifecycleArtifactEnvelopeBase(
  state: WorkflowStateEnvelope,
  displayName: string,
  summary: string,
  inputRefs: readonly string[],
  issueRefs: readonly string[] = [],
  githubRefs: readonly GithubReference[] = []
) {
  return {
    schemaVersion: state.version,
    workflow: {
      name: state.workflow,
      displayName
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

function buildArtifactEnvelopeBase(
  state: WorkflowStateEnvelope,
  summary: string,
  inputRefs: readonly string[],
  issueRefs: readonly string[],
  githubRefs: readonly GithubReference[] = []
) {
  return {
    schemaVersion: state.version,
    workflow: {
      name: state.workflow
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

const planningIntakeAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "planning-intake",
    displayName: "Planning Intake",
    category: "planning",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "context"],
      minimalContext: true
    },
    catalog: {
      domain: "plan",
      supportLevel: "internal",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const planningRequest = getWorkflowInput<PlanningRequest>(stateSlice, "planningRequest");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!planningRequest) {
      throw new Error("planning-discovery requires a validated planning request before runtime execution.");
    }

    return agentOutputSchema.parse({
      summary: `Loaded planning request from ${requestFile ?? ".agentops/requests/planning.yaml"}.`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        requestFile,
        problemStatement: planningRequest.problemStatement,
        goals: planningRequest.goals,
        constraints: planningRequest.constraints,
        issueRefs: planningRequest.issueRefs,
        pathHints: planningRequest.pathHints
      }
    });
  }
};

const planningAnalystAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "planning-analyst",
    displayName: "Planning Analyst",
    category: "planning",
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
      domain: "plan",
      supportLevel: "official",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const planningRequest = getWorkflowInput<PlanningRequest>(stateSlice, "planningRequest");
    const planningGithubRefs = getWorkflowInput<GithubReference[]>(stateSlice, "planningGithubRefs") ?? [];
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!planningRequest) {
      throw new Error("planning-discovery requires a validated planning request before planning analysis.");
    }

    const topLevelHints = [...new Set(planningRequest.pathHints.map((hint) => hint.split("/")[0] ?? hint).filter(Boolean))];
    const objectives =
      planningRequest.goals.length > 0
        ? planningRequest.goals
        : [`Produce a bounded plan for: ${planningRequest.problemStatement}`];
    const inScope = planningRequest.pathHints.length > 0
      ? planningRequest.pathHints
      : ["Repository discovery", "Planning brief synthesis", "Next-step recommendation"];
    const outOfScope = ["Source-file mutation", "Network-backed intake", "Architecture/design decisions"];
    const openQuestions = [
      ...(planningRequest.issueRefs.length === 0 ? ["Should this planning work be linked to a tracked issue?"] : []),
      ...(planningRequest.pathHints.length === 0 ? ["Which repository paths should be prioritized in follow-up design work?"] : [])
    ];
    const candidateWorkstreams = topLevelHints.length > 0 ? topLevelHints : state.changes.impactedPaths;
    const risks = [
      ...(planningRequest.pathHints.length === 0 ? ["Impact area is broad because no path hints were supplied."] : []),
      ...(planningRequest.assumptions.length === 0 ? ["Planning assumptions were not supplied and may need confirmation."] : [])
    ];
    const summary = `Planning brief scoped ${objectives.length} objective(s) for ${state.repo.name}.`;
    const planningBrief = planningArtifactSchema.parse({
      ...buildArtifactEnvelopeBase(
        state,
        summary,
        [requestFile ?? ".agentops/requests/planning.yaml"],
        planningRequest.issueRefs,
        planningGithubRefs
      ),
      artifactKind: "planning-brief",
      lifecycleDomain: "plan",
      workflow: {
        name: state.workflow,
        displayName: "Planning And Discovery"
      },
      payload: {
        problemStatement: planningRequest.problemStatement,
        objectives,
        constraints: planningRequest.constraints,
        assumptions: planningRequest.assumptions,
        inScope,
        outOfScope,
        recommendedNextSteps: [
          "Review the generated planning brief and refine missing constraints or path hints.",
          "Open or update follow-on implementation issues for the accepted planning scope.",
          "Use the planning brief as input to `architecture-design-review` for the next design slice."
        ],
        stakeholders: planningRequest.issueRefs.length > 0 ? ["Maintainers linked to the referenced issues"] : [],
        risks,
        openQuestions,
        candidateWorkstreams,
        linkedIssues: planningRequest.issueRefs
      }
    });

    return agentOutputSchema.parse({
      summary,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [planningBrief],
      requestedTools: [],
      blockedActionFlags: [],
      confidence: 0.8,
      metadata: {
        deterministicContext: {
          pathHints: planningRequest.pathHints,
          impactedPaths: state.changes.impactedPaths,
          repository: state.repo.name
        },
        synthesizedPlanning: {
          recommendedNextSteps: planningBrief.payload.recommendedNextSteps,
          openQuestions
        }
      }
    });
  }
};

const designIntakeAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "design-intake",
    displayName: "Design Intake",
    category: "design",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "context"],
      minimalContext: true
    },
    catalog: {
      domain: "design",
      supportLevel: "internal",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const designRequest = getWorkflowInput<DesignRequest>(stateSlice, "designRequest");
    const planningBrief = getWorkflowInput<PlanningArtifact>(stateSlice, "planningBrief");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!designRequest || !planningBrief) {
      throw new Error("architecture-design-review requires a validated design request and planning brief before runtime execution.");
    }

    return agentOutputSchema.parse({
      summary: `Loaded design request from ${requestFile ?? ".agentops/requests/design.yaml"} with planning brief ${designRequest.planningBriefRef}.`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        requestFile,
        planningBriefRef: designRequest.planningBriefRef,
        decisionTarget: designRequest.decisionTarget,
        planningObjectives: planningBrief.payload.objectives
      }
    });
  }
};

const designInventoryAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "design-inventory",
    displayName: "Design Inventory",
    category: "design",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: ["filesystem.list-files"],
      readPaths: ["**/*"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo", "changes"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "changes"],
      minimalContext: true
    },
    catalog: {
      domain: "design",
      supportLevel: "internal",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice, invokeTool }) {
    const designRequest = getWorkflowInput<DesignRequest>(stateSlice, "designRequest");
    const planningBrief = getWorkflowInput<PlanningArtifact>(stateSlice, "planningBrief");
    if (!designRequest || !planningBrief) {
      throw new Error("architecture-design-review requires deterministic inventory inputs before design analysis.");
    }

    const candidatePaths = [...new Set([...designRequest.pathHints, ...(stateSlice.changes?.impactedPaths ?? [])])];
    const repoRoot = stateSlice.repo?.root;
    const inspectedPaths = candidatePaths
      .filter((pathHint) => {
        if (!pathHint) {
          return false;
        }

        const finalSegment = pathHint.split("/").at(-1) ?? pathHint;
        if (pathHint !== ".agentops" && finalSegment.includes(".")) {
          return false;
        }

        if (!repoRoot) {
          return true;
        }

        return existsSync(join(repoRoot, pathHint));
      })
      .slice(0, 8);
    const listedEntries: string[] = [];
    for (const pathHint of inspectedPaths) {
      const listed = await invokeTool({
        tool: "filesystem.list-files",
        input: { path: pathHint },
        requestedBy: "design-inventory",
        requestedAt: new Date().toISOString()
      });

      if (listed.status === "success" && isRecord(listed.output) && Array.isArray(listed.output.entries)) {
        for (const entry of listed.output.entries) {
          if (typeof entry === "string") {
            listedEntries.push(`${pathHint}/${entry}`.replaceAll("//", "/"));
          }
        }
      }
    }

    const impactedInterfaces = [
      ...new Set(
        [...candidatePaths, ...listedEntries].filter(
          (entry) => entry.endsWith("src/index.ts") || entry.endsWith("package.json") || entry.endsWith("agent.manifest.json")
        )
      )
    ];
    const schemaSurfaces = [
      ...new Set(
        [...candidatePaths, ...listedEntries].filter(
          (entry) => entry.includes("packages/schemas") || entry.includes("schema") || entry.endsWith(".yaml")
        )
      )
    ];
    const policySurfaces = [
      ...new Set(
        [...candidatePaths, ...listedEntries].filter(
          (entry) => entry.includes("policy") || entry.includes("packages/policy-engine") || entry.includes(".agentops/policy.yaml")
        )
      )
    ];

    return agentOutputSchema.parse({
      summary: `Collected deterministic design inventory across ${inspectedPaths.length} candidate path(s).`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        inspectedPaths,
        impactedInterfaces,
        schemaSurfaces,
        policySurfaces,
        planningScope: planningBrief.payload.inScope
      }
    });
  }
};

const implementationIntakeAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "implementation-intake",
    displayName: "Implementation Intake",
    category: "implementation",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "context"],
      minimalContext: true
    },
    catalog: {
      domain: "build",
      supportLevel: "internal",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const implementationRequest = getWorkflowInput<ImplementationRequest>(stateSlice, "implementationRequest");
    const designRecord = getWorkflowInput<DesignArtifact>(stateSlice, "designRecord");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!implementationRequest || !designRecord) {
      throw new Error(
        "implementation-proposal requires a validated implementation request and design record before runtime execution."
      );
    }

    return agentOutputSchema.parse({
      summary: `Loaded implementation request from ${requestFile ?? ".agentops/requests/implementation.yaml"} with design record ${implementationRequest.designRecordRef}.`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        requestFile,
        designRecordRef: implementationRequest.designRecordRef,
        implementationGoal: implementationRequest.implementationGoal,
        approvalMode: implementationRequest.approvalMode,
        targetPaths: implementationRequest.targetPaths,
        validationCommands: implementationRequest.validationCommands,
        designDecisionSummary: designRecord.payload.decisionSummary
      }
    });
  }
};

const qaIntakeAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "qa-intake",
    displayName: "QA Intake",
    category: "qa",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "context"],
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const qaRequest = getWorkflowInput<QaRequest>(stateSlice, "qaRequest");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!qaRequest) {
      throw new Error("qa-review requires a validated QA request before runtime execution.");
    }

    const targetType =
      qaRequest.targetRef.endsWith("bundle.json")
        ? "artifact-bundle"
        : qaRequest.targetRef.endsWith(".xml") || qaRequest.targetRef.endsWith(".json") || qaRequest.targetRef.endsWith(".log")
          ? "validation-output"
          : "local-reference";

    return agentOutputSchema.parse({
      summary: `Loaded QA request from ${requestFile ?? ".agentops/requests/qa.yaml"} targeting ${qaRequest.targetRef}.`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        ...qaRequestSchema.parse({
          ...qaRequest,
          evidenceSources: [...new Set([qaRequest.targetRef, ...qaRequest.evidenceSources])]
        }),
        targetType
      }
    });
  }
};

const securityIntakeAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "security-intake",
    displayName: "Security Intake",
    category: "security",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "context"],
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const securityRequest = getWorkflowInput<SecurityRequest>(stateSlice, "securityRequest");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    const referencedArtifactKinds = getWorkflowInput<string[]>(stateSlice, "securityTargetArtifactKinds") ?? [];
    if (!securityRequest) {
      throw new Error("security-review requires a validated security request before runtime execution.");
    }

    const targetType = securityRequest.targetRef.endsWith("bundle.json") ? "artifact-bundle" : "local-reference";

    return agentOutputSchema.parse({
      summary: `Loaded security request from ${requestFile ?? ".agentops/requests/security.yaml"} targeting ${securityRequest.targetRef}.`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        ...securityRequestSchema.parse({
          ...securityRequest,
          evidenceSources: [...new Set([securityRequest.targetRef, ...securityRequest.evidenceSources])]
        }),
        targetType,
        referencedArtifactKinds
      }
    });
  }
};

const incidentIntakeAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "incident-intake",
    displayName: "Incident Intake",
    category: "operate",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**", "**/*.json", "**/*.log", "**/*.md"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "context"],
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const incidentRequest = getWorkflowInput<IncidentRequest>(stateSlice, "incidentRequest");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!incidentRequest) {
      throw new Error("incident-handoff requires a validated incident request before runtime execution.");
    }

    return agentOutputSchema.parse({
      summary: `Loaded incident request from ${requestFile ?? ".agentops/requests/incident.yaml"} for ${incidentRequest.incidentSummary}.`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        ...incidentRequestSchema.parse({
          ...incidentRequest,
          evidenceSources: [...new Set(incidentRequest.evidenceSources)]
        }),
        evidenceSourceCount: incidentRequest.evidenceSources.length + incidentRequest.releaseReportRefs.length
      }
    });
  }
};

const incidentEvidenceNormalizationAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "incident-evidence-normalizer",
    displayName: "Incident Evidence Normalizer",
    category: "operate",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**", "**/*.json", "**/*.log", "**/*.md", "**/*.txt"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo", "agentResults"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "agentResults"],
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const incidentRequest = getWorkflowInput<IncidentRequest>(stateSlice, "incidentRequest");
    if (!incidentRequest) {
      throw new Error("incident-handoff requires validated incident request inputs before evidence normalization.");
    }

    const repoRoot = stateSlice.repo?.root;
    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const releaseReportRefs =
      asStringArray(intakeMetadata.releaseReportRefs).length > 0
        ? asStringArray(intakeMetadata.releaseReportRefs)
        : incidentRequest.releaseReportRefs;
    const evidenceSources =
      asStringArray(intakeMetadata.evidenceSources).length > 0
        ? asStringArray(intakeMetadata.evidenceSources)
        : incidentRequest.evidenceSources;
    const severityHint =
      typeof intakeMetadata.severityHint === "string" ? intakeMetadata.severityHint : incidentRequest.severityHint;
    const normalizedEvidenceSources = [...new Set([...evidenceSources, ...releaseReportRefs])];
    const missingEvidenceSources = normalizedEvidenceSources.filter((pathValue) => repoRoot && !existsSync(join(repoRoot, pathValue)));
    if (missingEvidenceSources.length > 0) {
      throw new Error(`Incident evidence source not found: ${missingEvidenceSources[0]}`);
    }

    const referencedArtifactKinds = [...new Set(
      releaseReportRefs.flatMap((pathValue) => (repoRoot ? loadBundleArtifactKinds(join(repoRoot, pathValue)) : []))
    )];
    const timelineSummary = [
      `Severity hint: ${severityHint}.`,
      "Normalized staged incident evidence and release-report references before reasoning.",
      ...normalizedEvidenceSources.map((pathValue) => describeEvidenceObservation(repoRoot, pathValue))
    ];
    const likelyImpactedAreas = [
      ...(releaseReportRefs.length > 0 ? ["release-readiness"] : []),
      ...(evidenceSources.length > 0 ? ["staged-operational-evidence"] : []),
      ...(severityHint === "high" || severityHint === "critical" ? ["security-follow-up"] : [])
    ];
    const followUpWorkflowRefs = [
      "maintenance-triage",
      ...(releaseReportRefs.length > 0 ? ["release-readiness"] : []),
      ...(severityHint === "high" || severityHint === "critical" ? ["security-review"] : [])
    ];
    const normalization = incidentEvidenceNormalizationSchema.parse({
      incidentSummary: incidentRequest.incidentSummary,
      severityHint,
      normalizedEvidenceSources,
      missingEvidenceSources: [],
      releaseReportRefs,
      timelineSummary,
      likelyImpactedAreas: [...new Set(likelyImpactedAreas)],
      followUpWorkflowRefs: [...new Set(followUpWorkflowRefs)],
      provenanceRefs: [
        ...new Set([
          ...evidenceSources,
          ...releaseReportRefs.map((pathValue) => `${pathValue}#release-report`)
        ])
      ],
      redactionCategories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key", "operational-sensitive"],
      referencedArtifactKinds
    });

    return agentOutputSchema.parse({
      summary: `Normalized incident evidence across ${normalization.normalizedEvidenceSources.length} staged source(s).`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: normalization satisfies IncidentEvidenceNormalization
    });
  }
};

const maintenanceIntakeAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "maintenance-intake",
    displayName: "Maintenance Intake",
    category: "maintain",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**", "**/*.json", "**/*.md", "**/*.txt"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "context"],
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const maintenanceRequest = getWorkflowInput<MaintenanceRequest>(stateSlice, "maintenanceRequest");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    const maintenanceIssueRefs = getWorkflowInput<string[]>(stateSlice, "maintenanceIssueRefs") ?? [];
    const maintenanceGithubRefs = getWorkflowInput<GithubReference[]>(stateSlice, "maintenanceGithubRefs") ?? [];
    if (!maintenanceRequest) {
      throw new Error("maintenance-triage requires a validated maintenance request before runtime execution.");
    }

    return agentOutputSchema.parse({
      summary: `Loaded maintenance request from ${requestFile ?? ".agentops/requests/maintenance.yaml"} for ${maintenanceRequest.maintenanceGoal}.`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        ...maintenanceRequestSchema.parse({
          ...maintenanceRequest,
          dependencyAlertRefs: [...new Set(maintenanceRequest.dependencyAlertRefs)],
          docsTaskRefs: [...new Set(maintenanceRequest.docsTaskRefs)],
          releaseReportRefs: [...new Set(maintenanceRequest.releaseReportRefs)],
          issueRefs: [...new Set(maintenanceRequest.issueRefs)]
        }),
        maintenanceIssueRefs,
        maintenanceGithubRefs,
        evidenceSourceCount:
          maintenanceRequest.dependencyAlertRefs.length +
          maintenanceRequest.docsTaskRefs.length +
          maintenanceRequest.releaseReportRefs.length
      }
    });
  }
};

const maintenanceAnalystAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const maintenanceRequest = getWorkflowInput<MaintenanceRequest>(stateSlice, "maintenanceRequest");
    const maintenanceIssueRefs = getWorkflowInput<string[]>(stateSlice, "maintenanceIssueRefs") ?? [];
    const maintenanceGithubRefs = getWorkflowInput<GithubReference[]>(stateSlice, "maintenanceGithubRefs") ?? [];
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!maintenanceRequest) {
      throw new Error("maintenance-triage requires validated maintenance inputs before maintenance analysis.");
    }

    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const dependencyAlertRefs = asStringArray(intakeMetadata.dependencyAlertRefs).length > 0
      ? asStringArray(intakeMetadata.dependencyAlertRefs)
      : maintenanceRequest.dependencyAlertRefs;
    const docsTaskRefs = asStringArray(intakeMetadata.docsTaskRefs).length > 0
      ? asStringArray(intakeMetadata.docsTaskRefs)
      : maintenanceRequest.docsTaskRefs;
    const releaseReportRefs = asStringArray(intakeMetadata.releaseReportRefs).length > 0
      ? asStringArray(intakeMetadata.releaseReportRefs)
      : maintenanceRequest.releaseReportRefs;
    const normalizedConstraints = asStringArray(intakeMetadata.constraints);
    const evidenceSources = [...new Set([...dependencyAlertRefs, ...docsTaskRefs, ...releaseReportRefs])];
    const currentFindings = [
      ...(dependencyAlertRefs.length > 0 ? [`${dependencyAlertRefs.length} dependency alert reference(s) require maintenance triage.`] : []),
      ...(docsTaskRefs.length > 0 ? [`${docsTaskRefs.length} docs task reference(s) require maintenance triage.`] : []),
      ...(releaseReportRefs.length > 0 ? [`${releaseReportRefs.length} release-report reference(s) contribute maintenance follow-up context.`] : [])
    ];
    const recommendedActions = [
      ...dependencyAlertRefs.map((pathValue) => `Review dependency alert reference \`${pathValue}\` before choosing a follow-up workflow.`),
      ...docsTaskRefs.map((pathValue) => `Review docs task reference \`${pathValue}\` before choosing a follow-up workflow.`),
      ...releaseReportRefs.map((pathValue) => `Review release report reference \`${pathValue}\` for maintenance-linked follow-up work.`),
      ...(normalizedConstraints.length > 0 ? [`Keep maintenance follow-up bounded by: ${normalizedConstraints.join("; ")}.`] : [])
    ];
    const priorityAssessment =
      releaseReportRefs.length > 0 || dependencyAlertRefs.length > 1
        ? "Elevated maintenance triage: release-linked or multi-alert follow-up should be prioritized before broader maintenance work."
        : "Routine maintenance triage: review bounded references and route follow-up deliberately.";
    const stalenessSignals = [
      ...(dependencyAlertRefs.length > 0 ? ["Dependency alert follow-up remains pending review."] : []),
      ...(docsTaskRefs.length > 0 ? ["Documentation maintenance follow-up remains pending review."] : []),
      ...(releaseReportRefs.length > 0 ? ["Release-linked maintenance follow-up remains pending review."] : [])
    ];
    const summary = `Maintenance report prepared for ${maintenanceRequest.maintenanceGoal}.`;
    const maintenanceReport = maintenanceArtifactSchema.parse({
      ...buildLifecycleArtifactEnvelopeBase(
        state,
        "Maintenance Triage",
        summary,
        [requestFile ?? ".agentops/requests/maintenance.yaml", ...evidenceSources],
        maintenanceIssueRefs,
        maintenanceGithubRefs
      ),
      artifactKind: "maintenance-report",
      lifecycleDomain: "maintain",
      payload: {
        maintenanceScope: maintenanceRequest.maintenanceGoal,
        currentFindings:
          currentFindings.length > 0
            ? currentFindings
            : ["Maintenance triage remained bounded to validated references; no additional findings were synthesized."],
        recommendedActions:
          recommendedActions.length > 0
            ? recommendedActions
            : ["Add at least one bounded maintenance reference before broadening the workflow surface."],
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
          issueRefs: maintenanceIssueRefs,
          constraints: normalizedConstraints
        },
        synthesizedAssessment: {
          priorityAssessment: maintenanceReport.payload.priorityAssessment,
          recommendedActions: maintenanceReport.payload.recommendedActions,
          followUpIssues: maintenanceReport.payload.followUpIssues
        }
      }
    });
  }
};

const incidentAnalystAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const incidentRequest = getWorkflowInput<IncidentRequest>(stateSlice, "incidentRequest");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    const incidentIssueRefs = getWorkflowInput<string[]>(stateSlice, "incidentIssueRefs") ?? [];
    const incidentGithubRefs = getWorkflowInput<GithubReference[]>(stateSlice, "incidentGithubRefs") ?? [];
    if (!incidentRequest) {
      throw new Error("incident-handoff requires validated incident inputs before incident analysis.");
    }

    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const evidenceMetadata = incidentEvidenceNormalizationSchema.safeParse(stateSlice.agentResults?.evidence?.metadata);
    const normalizedEvidence = evidenceMetadata.success ? evidenceMetadata.data : undefined;
    const evidenceSources = normalizedEvidence?.normalizedEvidenceSources && normalizedEvidence.normalizedEvidenceSources.length > 0
      ? normalizedEvidence.normalizedEvidenceSources
      : asStringArray(intakeMetadata.evidenceSources).length > 0
        ? [
            ...new Set([
              ...asStringArray(intakeMetadata.evidenceSources),
              ...asStringArray(intakeMetadata.releaseReportRefs)
            ])
          ]
        : [...new Set([...incidentRequest.evidenceSources, ...incidentRequest.releaseReportRefs])];
    const severityHint = normalizedEvidence?.severityHint ??
      (typeof intakeMetadata.severityHint === "string" ? intakeMetadata.severityHint : incidentRequest.severityHint);
    const constraints = asStringArray(intakeMetadata.constraints);
    const followUpWorkflowRefs = normalizedEvidence?.followUpWorkflowRefs && normalizedEvidence.followUpWorkflowRefs.length > 0
      ? normalizedEvidence.followUpWorkflowRefs
      : [
          "maintenance-triage",
          ...(incidentRequest.releaseReportRefs.length > 0 ? ["release-readiness"] : []),
          ...(severityHint === "high" || severityHint === "critical" ? ["security-review"] : [])
        ];
    const likelyImpactedAreas = normalizedEvidence?.likelyImpactedAreas && normalizedEvidence.likelyImpactedAreas.length > 0
      ? normalizedEvidence.likelyImpactedAreas
      : [
          ...(incidentRequest.releaseReportRefs.length > 0 ? ["release-readiness"] : []),
          ...(incidentRequest.evidenceSources.length > 0 ? ["staged-operational-evidence"] : []),
          ...(severityHint === "high" || severityHint === "critical" ? ["security-follow-up"] : [])
        ];
    const openQuestions = [
      ...(incidentRequest.issueRefs.length === 0 ? ["Should this incident be linked to a tracked issue before escalation?"] : []),
      ...(incidentRequest.releaseReportRefs.length === 0
        ? ["Is there a release-report bundle that should be attached for additional provenance?"]
        : [])
    ];
    const summary = `Incident brief prepared for ${incidentRequest.incidentSummary}.`;
    const incidentBrief = incidentArtifactSchema.parse({
      ...buildLifecycleArtifactEnvelopeBase(
        state,
        "Incident Handoff",
        summary,
        [requestFile ?? ".agentops/requests/incident.yaml", ...evidenceSources],
        incidentIssueRefs,
        incidentGithubRefs
      ),
      artifactKind: "incident-brief",
      lifecycleDomain: "operate",
      redaction: {
        applied: true,
        strategyVersion: "1.0.0",
        categories: normalizedEvidence?.redactionCategories ?? [
          "github-token",
          "api-key",
          "aws-key",
          "bearer-token",
          "password",
          "private-key",
          "operational-sensitive"
        ]
      },
      payload: {
        incidentSummary: incidentRequest.incidentSummary,
        evidenceSources,
        timelineSummary: normalizedEvidence?.timelineSummary ?? [
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
          normalizedEvidence: normalizedEvidence ?? null
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

const releaseIntakeAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "release-intake",
    displayName: "Release Intake",
    category: "release",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "context"],
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const releaseRequest = getWorkflowInput<ReleaseRequest>(stateSlice, "releaseRequest");
    const releaseIssueRefs = getWorkflowInput<string[]>(stateSlice, "releaseIssueRefs") ?? [];
    const releaseGithubRefs = getWorkflowInput<GithubReference[]>(stateSlice, "releaseGithubRefs") ?? [];
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!releaseRequest) {
      throw new Error("release-readiness requires a validated release request before runtime execution.");
    }

    return agentOutputSchema.parse({
      summary: `Loaded release request from ${requestFile ?? ".agentops/requests/release.yaml"} for ${releaseRequest.releaseScope}.`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {
        ...releaseRequestSchema.parse(releaseRequest),
        releaseIssueRefs,
        releaseGithubRefs,
        evidenceSourceCount:
          releaseRequest.qaReportRefs.length + releaseRequest.securityReportRefs.length + releaseRequest.evidenceSources.length
      }
    });
  }
};

const releaseEvidenceNormalizationAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "release-evidence-normalizer",
    displayName: "Release Evidence Normalizer",
    category: "release",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**", "**/*.json", "**/*.md", "**/package.json"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo", "agentResults"],
    outputs: ["summary", "metadata"],
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const releaseRequest = getWorkflowInput<ReleaseRequest>(stateSlice, "releaseRequest");
    if (!releaseRequest) {
      throw new Error("release-readiness requires validated release request inputs before evidence normalization.");
    }

    const repoRoot = stateSlice.repo?.root;
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
    const normalizedEvidenceSources = [...new Set([...qaReportRefs, ...securityReportRefs, ...evidenceSources])];
    const missingEvidenceSources = normalizedEvidenceSources.filter((pathValue) => repoRoot && !existsSync(join(repoRoot, pathValue)));
    if (missingEvidenceSources.length > 0) {
      throw new Error(`Release evidence source not found: ${missingEvidenceSources[0]}`);
    }

    const versionResolutions = releaseRequest.versionTargets.map((target) => {
      const resolved = resolveWorkspacePackage(repoRoot, target.name);
      return {
        name: target.name,
        targetVersion: target.version,
        currentVersion: resolved.currentVersion,
        status:
          !resolved.currentVersion
            ? "package-missing"
            : resolved.currentVersion === target.version
              ? "matches-target"
              : "pending-version-bump",
        manifestPath: resolved.manifestPath
      };
    });
    const missingPackages = versionResolutions.filter((entry) => entry.status === "package-missing").map((entry) => entry.name);
    const versionCheckStatus = missingPackages.length === 0 ? "passed" : "failed";
    const baseReadinessStatus =
      qaReportRefs.length > 0 && securityReportRefs.length > 0
        ? "ready"
        : qaReportRefs.length > 0 || securityReportRefs.length > 0
          ? "partial"
          : "blocked";
    const readinessStatus = missingPackages.length > 0 ? "blocked" : baseReadinessStatus;

    const localReadinessChecks = [
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
      },
      {
        name: "workspace-version-targets",
        status: versionCheckStatus,
        detail:
          missingPackages.length === 0
            ? `Resolved ${versionResolutions.length} workspace version target(s).`
            : `Missing workspace package metadata for: ${missingPackages.join(", ")}.`
      }
    ] as const;

    const approvalRecommendations = [
      {
        action: "publish-packages",
        classification: readinessStatus === "ready" ? "approval_required" : "deny",
        reason:
          readinessStatus === "ready"
            ? "Package publication remains outside the default read-only workflow path and needs explicit release approval."
            : "Keep package publication blocked until bounded release evidence is complete and normalized."
      },
      {
        action: "create-release-tag",
        classification: readinessStatus === "ready" ? "approval_required" : "deny",
        reason:
          readinessStatus === "ready"
            ? "Tag creation is a release-significant side effect and remains approval-gated."
            : "Do not create release tags while readiness remains partial or blocked."
      },
      {
        action: "promote-release",
        classification: readinessStatus === "ready" ? "approval_required" : "deny",
        reason:
          readinessStatus === "ready"
            ? "Promotion remains a release-significant side effect and requires explicit maintainer approval."
            : "Keep release promotion blocked until bounded QA and security evidence is complete."
      }
    ];
    const provenanceRefs = [
      ...normalizedEvidenceSources,
      ...versionResolutions
        .map((entry) => entry.manifestPath)
        .filter((value): value is string => Boolean(value))
    ];
    const normalization = releaseEvidenceNormalizationSchema.parse({
      qaReportRefs,
      securityReportRefs,
      normalizedEvidenceSources,
      missingEvidenceSources: [],
      versionResolutions: versionResolutions.map((entry) => ({
        name: entry.name,
        targetVersion: entry.targetVersion,
        currentVersion: entry.currentVersion,
        status: entry.status
      })),
      localReadinessChecks,
      readinessStatus,
      approvalRecommendations,
      provenanceRefs: [...new Set(provenanceRefs)]
    });

    return agentOutputSchema.parse({
      summary: `Normalized release evidence across ${normalization.normalizedEvidenceSources.length} source(s) and ${normalization.versionResolutions.length} version target(s).`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: normalization satisfies ReleaseEvidenceNormalization
    });
  }
};

const releaseAnalystAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
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
  }),
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
    const evidenceMetadata = releaseEvidenceNormalizationSchema.safeParse(stateSlice.agentResults?.evidence?.metadata);
    const normalizedEvidence = evidenceMetadata.success ? evidenceMetadata.data : undefined;
    const qaReportRefs = normalizedEvidence?.qaReportRefs && normalizedEvidence.qaReportRefs.length > 0
      ? normalizedEvidence.qaReportRefs
      : asStringArray(intakeMetadata.qaReportRefs).length > 0
      ? asStringArray(intakeMetadata.qaReportRefs)
      : releaseRequest.qaReportRefs;
    const securityReportRefs = normalizedEvidence?.securityReportRefs && normalizedEvidence.securityReportRefs.length > 0
      ? normalizedEvidence.securityReportRefs
      : asStringArray(intakeMetadata.securityReportRefs).length > 0
      ? asStringArray(intakeMetadata.securityReportRefs)
      : releaseRequest.securityReportRefs;
    const evidenceSources = normalizedEvidence?.normalizedEvidenceSources && normalizedEvidence.normalizedEvidenceSources.length > 0
      ? normalizedEvidence.normalizedEvidenceSources
      : asStringArray(intakeMetadata.evidenceSources).length > 0
      ? asStringArray(intakeMetadata.evidenceSources)
      : releaseRequest.evidenceSources;
    const constraints = asStringArray(intakeMetadata.constraints);
    const allEvidenceRefs = [...new Set([...qaReportRefs, ...securityReportRefs, ...evidenceSources])];
    const versionResolutions = normalizedEvidence?.versionResolutions ?? [];
    const verificationChecks = normalizedEvidence?.localReadinessChecks ?? [
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
    ];
    const readinessStatus = normalizedEvidence?.readinessStatus ??
      (qaReportRefs.length > 0 && securityReportRefs.length > 0
        ? "ready"
        : qaReportRefs.length > 0 || securityReportRefs.length > 0
          ? "partial"
          : "blocked");
    const approvalRecommendations = normalizedEvidence?.approvalRecommendations ?? [
      {
        action: "publish-packages",
        classification: readinessStatus === "ready" ? "approval_required" : "deny",
        reason:
          readinessStatus === "ready"
            ? "Package publication remains outside the default read-only workflow path and needs explicit release approval."
            : "Keep package publication blocked until bounded release evidence is complete and normalized."
      }
    ];
    const summary = `Release report prepared for ${releaseRequest.releaseScope}.`;
    const publishingPlan = [
      ...(versionResolutions.length > 0
        ? [`Resolved ${versionResolutions.length} workspace version target(s) before any publish or promotion step.`]
        : []),
      "Review the bounded QA and security evidence before invoking any publish or promotion step.",
      "Run `agentforge release check --json` and `agentforge release verify --json` before any release cut.",
      ...approvalRecommendations.map(
        (recommendation) => `${recommendation.action}: ${recommendation.classification.replaceAll("_", " ")} (${recommendation.reason})`
      ),
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
      ...buildLifecycleArtifactEnvelopeBase(
        state,
        "Release Readiness",
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
        versionResolutions,
        approvalRecommendations: approvalRecommendations.map((recommendation) =>
          releaseApprovalRecommendationSchema.parse(recommendation)
        ),
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
          constraints,
          normalizedEvidence: normalizedEvidence ?? null
        },
        synthesizedAssessment: {
          readinessStatus,
          approvalRecommendations,
          publishingPlan,
          rollbackNotes
        }
      }
    });
  }
};

const securityEvidenceNormalizationAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "security-evidence-normalizer",
    displayName: "Security Evidence Normalizer",
    category: "security",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**", "**/*.json", "**/*.md", "**/package.json"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo", "agentResults"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "agentResults"],
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const securityRequest = getWorkflowInput<SecurityRequest>(stateSlice, "securityRequest");
    if (!securityRequest) {
      throw new Error("security-review requires validated security request inputs before evidence normalization.");
    }

    const repoRoot = stateSlice.repo?.root;
    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const targetType = typeof intakeMetadata.targetType === "string" && intakeMetadata.targetType === "artifact-bundle"
      ? "artifact-bundle"
      : "local-reference";
    const targetPath = repoRoot ? join(repoRoot, securityRequest.targetRef) : securityRequest.targetRef;
    if (repoRoot && !existsSync(targetPath)) {
      throw new Error(`Security target reference not found: ${securityRequest.targetRef}`);
    }

    const referencedArtifactKinds = targetType === "artifact-bundle" ? loadBundleArtifactKinds(targetPath) : [];
    const normalizedEvidenceSources = [...new Set([securityRequest.targetRef, ...securityRequest.evidenceSources])];
    const missingEvidenceSources = normalizedEvidenceSources.filter((pathValue) => repoRoot && !existsSync(join(repoRoot, pathValue)));
    if (missingEvidenceSources.length > 0) {
      throw new Error(`Security evidence source not found: ${missingEvidenceSources[0]}`);
    }

    const normalizedFocusAreas = securityRequest.focusAreas.length > 0 ? [...new Set(securityRequest.focusAreas)] : ["general-review"];
    const affectedPackages =
      targetType === "artifact-bundle"
        ? [...new Set(loadBundleArtifactPayloadPaths(targetPath).map(derivePackageScope).filter((value): value is string => Boolean(value)))]
        : [];
    const securitySignals = [
      ...(referencedArtifactKinds.length > 0 ? [`Referenced artifact kinds: ${referencedArtifactKinds.join(", ")}`] : []),
      ...(affectedPackages.length > 0 ? [`Affected packages inferred from bounded artifact payloads: ${affectedPackages.join(", ")}`] : []),
      ...(normalizedFocusAreas.length > 0 ? [`Requested focus areas: ${normalizedFocusAreas.join(", ")}`] : []),
      "Security evidence collection remains local, read-only, and bounded to validated references."
    ];
    const provenanceRefs = [
      securityRequest.targetRef,
      ...securityRequest.evidenceSources,
      ...referencedArtifactKinds.map((artifactKind) => `${securityRequest.targetRef}#${artifactKind}`)
    ];
    const normalization = securityEvidenceNormalizationSchema.parse({
      targetRef: securityRequest.targetRef,
      targetType,
      referencedArtifactKinds,
      normalizedEvidenceSources,
      missingEvidenceSources: [],
      normalizedFocusAreas,
      securitySignals,
      provenanceRefs: [...new Set(provenanceRefs)],
      affectedPackages
    });

    return agentOutputSchema.parse({
      summary: `Normalized security evidence for ${securityRequest.targetRef}.`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: normalization satisfies SecurityEvidenceNormalization
    });
  }
};

const securityAnalystAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const securityRequest = getWorkflowInput<SecurityRequest>(stateSlice, "securityRequest");
    const securityIssueRefs = getWorkflowInput<string[]>(stateSlice, "securityIssueRefs") ?? [];
    const securityGithubRefs = getWorkflowInput<GithubReference[]>(stateSlice, "securityGithubRefs") ?? [];
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!securityRequest) {
      throw new Error("security-review requires validated security inputs before security analysis.");
    }

    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const evidenceMetadata = securityEvidenceNormalizationSchema.safeParse(stateSlice.agentResults?.evidence?.metadata);
    const normalizedEvidence = evidenceMetadata.success ? evidenceMetadata.data : undefined;
    const referencedArtifactKinds =
      normalizedEvidence?.referencedArtifactKinds ?? asStringArray(intakeMetadata.referencedArtifactKinds);
    const normalizedFocusAreas =
      normalizedEvidence?.normalizedFocusAreas ?? asStringArray(intakeMetadata.focusAreas);
    const normalizedConstraints = asStringArray(intakeMetadata.constraints);
    const evidenceSources =
      normalizedEvidence?.normalizedEvidenceSources && normalizedEvidence.normalizedEvidenceSources.length > 0
        ? normalizedEvidence.normalizedEvidenceSources
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
      ...(normalizedEvidence?.securitySignals ?? []),
      ...(referencedArtifactKinds.length > 0
        ? [`Confirm the security posture for referenced artifacts: ${referencedArtifactKinds.join(", ")}.`]
        : []),
      "Use deterministic security evidence normalization outputs before broadening the workflow surface."
    ];
    const summary = `Security report prepared for ${securityRequest.targetRef}.`;
    const securityReport = securityArtifactSchema.parse({
      ...buildLifecycleArtifactEnvelopeBase(
        state,
        "Security Review",
        summary,
        [
          requestFile ?? ".agentops/requests/security.yaml",
          ...(normalizedEvidence?.provenanceRefs ?? [securityRequest.targetRef, ...securityRequest.evidenceSources])
        ],
        securityIssueRefs,
        securityGithubRefs
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
          referencedArtifactKinds,
          normalizedEvidence: normalizedEvidence ?? null
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

const qaEvidenceNormalizationAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "qa-evidence-normalizer",
    displayName: "QA Evidence Normalizer",
    category: "qa",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: [".agentops/requests/**", ".agentops/runs/**", "**/package.json", "**/*.json", "**/*.xml", "**/*.log", "**/*.md"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo", "agentResults"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "agentResults"],
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const qaRequest = getWorkflowInput<QaRequest>(stateSlice, "qaRequest");
    if (!qaRequest) {
      throw new Error("qa-review requires validated QA request inputs before evidence normalization.");
    }

    const repoRoot = stateSlice.repo?.root;
    const packageManager = stateSlice.repo?.packageManager || "pnpm";
    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const targetType = typeof intakeMetadata.targetType === "string" ? intakeMetadata.targetType : "local-reference";
    const targetPath = repoRoot ? join(repoRoot, qaRequest.targetRef) : qaRequest.targetRef;
    if (repoRoot && !existsSync(targetPath)) {
      throw new Error(`QA target reference not found: ${qaRequest.targetRef}`);
    }

    const referencedArtifactKinds = targetType === "artifact-bundle" ? loadBundleArtifactKinds(targetPath) : [];
    const normalizedEvidenceSources = [...new Set([qaRequest.targetRef, ...qaRequest.evidenceSources])];
    const missingEvidenceSources = normalizedEvidenceSources.filter((pathValue) => repoRoot && !existsSync(join(repoRoot, pathValue)));
    if (missingEvidenceSources.length > 0) {
      throw new Error(`QA evidence source not found: ${missingEvidenceSources[0]}`);
    }

    const bundleAffectedPaths =
      targetType === "artifact-bundle" && referencedArtifactKinds.includes("implementation-proposal") && existsSync(targetPath)
        ? asStringArray(
            (() => {
              const parsed = JSON.parse(readFileSync(targetPath, "utf8")) as unknown;
              if (!isRecord(parsed) || !Array.isArray(parsed.lifecycleArtifacts)) {
                return [];
              }

              const implementationArtifact = parsed.lifecycleArtifacts.find(
                (artifact) =>
                  isRecord(artifact) &&
                  artifact.artifactKind === "implementation-proposal" &&
                  isRecord(artifact.payload) &&
                  Array.isArray(artifact.payload.affectedPaths)
              ) as { payload?: { affectedPaths?: unknown[] } } | undefined;
              return implementationArtifact?.payload?.affectedPaths ?? [];
            })()
          )
        : [];
    const affectedPackages = [...new Set(bundleAffectedPaths.map((pathValue) => derivePackageScope(pathValue)).filter((value): value is string => Boolean(value)))];
    const allowedValidationCommands = collectValidationCommands(repoRoot, packageManager, affectedPackages).filter(
      (entry) => entry.classification === "approval_required"
    );
    const allowlistedCommands = new Set(allowedValidationCommands.map((entry) => entry.command));
    const normalizedExecutedChecks = qaRequest.executedChecks.map(normalizeRequestedCommand);
    const unrecognizedExecutedChecks = normalizedExecutedChecks.filter((command) => !allowlistedCommands.has(command));
    const githubActions = normalizeGitHubActionsEvidence(repoRoot, normalizedEvidenceSources);
    const normalization = qaEvidenceNormalizationSchema.parse({
      targetRef: qaRequest.targetRef,
      targetType,
      referencedArtifactKinds,
      normalizedEvidenceSources,
      missingEvidenceSources: [],
      normalizedExecutedChecks,
      unrecognizedExecutedChecks,
      affectedPackages,
      allowedValidationCommands,
      githubActions
    });

    return agentOutputSchema.parse({
      summary: `Normalized QA evidence across ${normalization.normalizedEvidenceSources.length} source(s), ${normalization.allowedValidationCommands.length} allowlisted validation command(s), and ${normalization.githubActions.evidence.length} GitHub Actions evidence export(s).`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: normalization satisfies QaEvidenceNormalization
    });
  }
};

const qaAnalystAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
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
  }),
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const qaRequest = getWorkflowInput<QaRequest>(stateSlice, "qaRequest");
    const qaIssueRefs = getWorkflowInput<string[]>(stateSlice, "qaIssueRefs") ?? [];
    const qaGithubRefs = getWorkflowInput<GithubReference[]>(stateSlice, "qaGithubRefs") ?? [];
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!qaRequest) {
      throw new Error("qa-review requires validated QA inputs before QA analysis.");
    }

    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const evidenceMetadata = qaEvidenceNormalizationSchema.safeParse(stateSlice.agentResults?.evidence?.metadata);
    const normalizedEvidence = evidenceMetadata.success ? evidenceMetadata.data : undefined;
    const normalizedEvidenceSources = normalizedEvidence?.normalizedEvidenceSources ?? [];
    const normalizedExecutedChecks = normalizedEvidence?.normalizedExecutedChecks ?? [];
    const normalizedFocusAreas = asStringArray(intakeMetadata.focusAreas);
    const normalizedConstraints = asStringArray(intakeMetadata.constraints);
    const missingEvidenceSources = normalizedEvidence?.missingEvidenceSources ?? [];
    const unrecognizedExecutedChecks = normalizedEvidence?.unrecognizedExecutedChecks ?? [];
    const normalizedGithubActions: GithubActionsEvidenceNormalization = normalizedEvidence
      ? normalizedEvidence.githubActions
      : {
          evidence: [],
          workflowNames: [],
          failingChecks: [],
          provenanceRefs: []
        };
    const targetType =
      normalizedEvidence?.targetType
        ? normalizedEvidence.targetType
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
      ...unrecognizedExecutedChecks.map((command) => `Executed check is outside the bounded allowlist and still needs manual interpretation: ${command}`),
      ...normalizedGithubActions.failingChecks.map(
        (checkName) => `GitHub Actions evidence still reports a failing check that needs manual review: ${checkName}`
      )
    ];
    const recommendedNextChecks = [
      ...executedChecks.map((command) => `Review the recorded output for \`${command}\` before promotion.`),
      ...focusAreas.map((focusArea) => `Confirm whether ${focusArea} needs additional deterministic QA evidence.`),
      ...normalizedGithubActions.workflowNames.map(
        (workflowName) => `Review the exported GitHub Actions evidence for workflow \`${workflowName}\` before promotion.`
      ),
      ...(normalizedConstraints.length > 0 ? [`Keep QA follow-up bounded by: ${normalizedConstraints.join("; ")}.`] : [])
    ];
    const summary = `QA report prepared for ${qaRequest.targetRef}.`;
    const releaseImpactBase =
      qaRequest.releaseContext === "blocking"
        ? "release-blocking QA findings require resolution before promotion."
        : qaRequest.releaseContext === "candidate"
          ? "candidate release still requires explicit QA review before promotion."
          : "no release context was supplied; QA output remains advisory.";
    const qaReport = qaArtifactSchema.parse({
      ...buildArtifactEnvelopeBase(
        state,
        summary,
        [requestFile ?? ".agentops/requests/qa.yaml", qaRequest.targetRef, ...qaRequest.evidenceSources],
        qaIssueRefs,
        qaGithubRefs
      ),
      artifactKind: "qa-report",
      lifecycleDomain: "test",
      workflow: {
        name: state.workflow,
        displayName: "QA Review"
      },
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
          normalizedGithubActions.failingChecks.length > 0
            ? `${releaseImpactBase} GitHub Actions evidence still shows failing checks: ${normalizedGithubActions.failingChecks.join(", ")}.`
            : releaseImpactBase
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
          constraints: normalizedConstraints,
          githubActions: normalizedGithubActions
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

const implementationInventoryAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "implementation-inventory",
    displayName: "Implementation Inventory",
    category: "implementation",
    runtime: {
      minVersion: "0.1.0",
      kind: "deterministic"
    },
    permissions: {
      model: false,
      network: false,
      tools: [],
      readPaths: ["**/*"],
      writePaths: []
    },
    inputs: ["workflowInputs", "repo", "changes"],
    outputs: ["summary", "metadata"],
    contextPolicy: {
      sections: ["workflowInputs", "repo", "changes"],
      minimalContext: true
    },
    catalog: {
      domain: "build",
      supportLevel: "internal",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const implementationRequest = getWorkflowInput<ImplementationRequest>(stateSlice, "implementationRequest");
    const designRecord = getWorkflowInput<DesignArtifact>(stateSlice, "designRecord");
    if (!implementationRequest || !designRecord) {
      throw new Error("implementation-proposal requires deterministic inventory inputs before proposal analysis.");
    }

    const repoRoot = stateSlice.repo?.root;
    const packageManager = stateSlice.repo?.packageManager || "pnpm";
    const candidatePaths = [
      ...new Set([
        ...implementationRequest.targetPaths,
        ...designRecord.payload.interfacesImpacted,
        ...designRecord.payload.schemaChangesNeeded,
        ...designRecord.payload.policyChangesNeeded
      ])
    ];
    const resolvedAffectedPaths = candidatePaths.filter((pathValue) => {
      if (!pathValue) {
        return false;
      }

      if (!repoRoot) {
        return true;
      }

      return existsSync(join(repoRoot, pathValue));
    });
    const affectedPackages = [...new Set(resolvedAffectedPaths.map(derivePackageScope).filter((value): value is string => Boolean(value)))];
    const entrypoints = [
      ...new Set(
        resolvedAffectedPaths.filter(
          (pathValue) =>
            pathValue.endsWith("src/index.ts") || pathValue.endsWith("package.json") || pathValue.endsWith("agent.manifest.json")
        )
      )
    ];
    const schemaSurfaces = [...new Set(resolvedAffectedPaths.filter((pathValue) => pathValue.includes("schema")))];
    const policySurfaces = [
      ...new Set(
        resolvedAffectedPaths.filter(
          (pathValue) => pathValue.includes("policy") || pathValue.includes(".agentops/policy.yaml")
        )
      )
    ];
    const discoveredValidationCommands = collectValidationCommands(repoRoot, packageManager, affectedPackages);

    const normalizedRequestedCommands = implementationRequest.validationCommands.map(normalizeRequestedCommand);
    const allowlistedCommands = new Set(
      discoveredValidationCommands
        .filter((entry) => entry.classification === "approval_required")
        .map((entry) => entry.command)
    );
    for (const requestedCommand of normalizedRequestedCommands) {
      if (!allowlistedCommands.has(requestedCommand)) {
        throw new Error(`Implementation request contains non-allowlisted validation command: ${requestedCommand}`);
      }

      discoveredValidationCommands.push({
        command: requestedCommand,
        source: "request",
        classification: "approval_required",
        reason: "Requested command matches a discovered allowlisted validation script."
      });
    }

    const inventory = implementationInventorySchema.parse({
      requestedTargetPaths: implementationRequest.targetPaths,
      resolvedAffectedPaths,
      affectedPackages,
      entrypoints,
      schemaSurfaces,
      policySurfaces,
      discoveredValidationCommands
    });

    return agentOutputSchema.parse({
      summary: `Collected deterministic implementation inventory across ${inventory.resolvedAffectedPaths.length} path(s) and ${inventory.discoveredValidationCommands.length} validation command(s).`,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: inventory satisfies ImplementationInventory
    });
  }
};

const implementationPlannerAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "implementation-planner",
    displayName: "Implementation Planner",
    category: "implementation",
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
      domain: "build",
      supportLevel: "official",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const implementationRequest = getWorkflowInput<ImplementationRequest>(stateSlice, "implementationRequest");
    const designRecord = getWorkflowInput<DesignArtifact>(stateSlice, "designRecord");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!implementationRequest || !designRecord) {
      throw new Error("implementation-proposal requires validated implementation inputs before proposal analysis.");
    }

    const inventoryMetadata = implementationInventorySchema.safeParse(stateSlice.agentResults?.inventory?.metadata);
    const inventory = inventoryMetadata.success ? inventoryMetadata.data : undefined;
    const normalizedAffectedPaths =
      inventory && inventory.resolvedAffectedPaths.length > 0
        ? inventory.resolvedAffectedPaths
        : [
            ...new Set([
              ...implementationRequest.targetPaths,
              ...designRecord.payload.interfacesImpacted,
              ...designRecord.payload.schemaChangesNeeded,
              ...designRecord.payload.policyChangesNeeded
            ])
          ];
    const finalAffectedPaths =
      normalizedAffectedPaths.length > 0
        ? normalizedAffectedPaths
        : ["Repository paths still need deterministic build-surface confirmation."];
    const proposedChanges = [
      `Prepare a bounded implementation plan for ${implementationRequest.implementationGoal}.`,
      ...finalAffectedPaths.slice(0, 5).map((pathValue) => `Plan targeted edits for ${pathValue}.`)
    ];
    const selectedCommands = inventory
      ? inventory.discoveredValidationCommands.filter(
          (entry) =>
            entry.classification === "approval_required" &&
            (implementationRequest.validationCommands.length === 0 || entry.source === "request")
        )
      : [];
    const validationPlan =
      selectedCommands.length > 0
        ? selectedCommands.map((entry) => `Command \`${entry.command}\` is available but approval-required before execution.`)
        : ["Confirm allowlisted validation commands in the next deterministic implementation slice before execution."];
    const approvalRequiredSteps =
      implementationRequest.approvalMode === "apply-capable"
        ? [
            "Any future patch application requires explicit approval before execution.",
            "Any future build or validation execution requires approval after allowlist review."
          ]
        : ["The default path remains proposal-only; any patch or build execution requires a separate approved workflow."];
    const risks = [
      ...(implementationRequest.targetPaths.length === 0
        ? ["Target paths were not supplied, so affected surfaces may still broaden after deterministic discovery."]
        : []),
      ...(implementationRequest.validationCommands.length === 0
        ? ["Validation commands are not yet specified and will need deterministic allowlist confirmation later."]
        : [])
    ];
    const openQuestions = [
      ...(implementationRequest.constraints.length === 0
        ? ["Which additional implementation constraints should be captured before execution work begins?"]
        : []),
      ...(designRecord.payload.policyChangesNeeded.length > 0
        ? ["Do the policy surfaces identified in the design record require a separate approval review?"]
        : [])
    ];
    const summary = `Implementation proposal prepared for ${implementationRequest.implementationGoal}.`;
    const implementationProposal = implementationArtifactSchema.parse({
      ...buildArtifactEnvelopeBase(
        state,
        summary,
        [requestFile ?? ".agentops/requests/implementation.yaml", implementationRequest.designRecordRef],
        designRecord.source.issueRefs,
        designRecord.source.githubRefs
      ),
      artifactKind: "implementation-proposal",
      lifecycleDomain: "build",
      workflow: {
        name: state.workflow,
        displayName: "Implementation Proposal"
      },
      payload: {
        designRecordRef: implementationRequest.designRecordRef,
        implementationGoal: implementationRequest.implementationGoal,
        affectedPaths: finalAffectedPaths,
        proposedChanges,
        validationPlan,
        approvalRequiredSteps,
        risks,
        openQuestions
      }
    });

    return agentOutputSchema.parse({
      summary,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [implementationProposal satisfies ImplementationArtifact],
      requestedTools: [],
      blockedActionFlags: [],
      confidence: 0.76,
      metadata: {
        deterministicInputs: {
          targetPaths: implementationRequest.targetPaths,
          validationCommands: implementationRequest.validationCommands,
          constraints: implementationRequest.constraints,
          designInterfaces: designRecord.payload.interfacesImpacted,
          inventory: inventory ?? null
        },
        synthesizedProposal: {
          affectedPaths: finalAffectedPaths,
          approvalRequiredSteps,
          openQuestions
        }
      }
    });
  }
};

const designAnalystAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "design-analyst",
    displayName: "Design Analyst",
    category: "design",
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
      domain: "design",
      supportLevel: "official",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ state, stateSlice }) {
    const designRequest = getWorkflowInput<DesignRequest>(stateSlice, "designRequest");
    const planningBrief = getWorkflowInput<PlanningArtifact>(stateSlice, "planningBrief");
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!designRequest || !planningBrief) {
      throw new Error("architecture-design-review requires validated design inputs before design analysis.");
    }

    const inventoryMetadata = isRecord(stateSlice.agentResults?.inventory?.metadata) ? stateSlice.agentResults.inventory.metadata : {};
    const impactedInterfaces = asStringArray(inventoryMetadata.impactedInterfaces);
    const schemaSurfaces = asStringArray(inventoryMetadata.schemaSurfaces);
    const policySurfaces = asStringArray(inventoryMetadata.policySurfaces);
    const optionsConsidered =
      designRequest.alternatives.length > 0
        ? designRequest.alternatives.map((option) => ({
            option,
            summary: `Evaluate ${option} against the validated planning brief and bounded repository inventory.`
          }))
        : [
            {
              option: "single-workflow-pass",
              summary: "Keep the workflow narrow by validating intake, inventory, and design analysis in one local pass."
            },
            {
              option: "split-manual-design-doc",
              summary: "Rely on ad hoc notes outside the workflow and treat design as manual-only."
            }
          ];
    const chosenApproach = optionsConsidered[0]?.option ?? "single-workflow-pass";
    const followUpWork = [
      "Translate the accepted design into bounded implementation issues before coding begins.",
      "Use the deterministic inventory to drive follow-up schema, policy, or interface validation.",
      "Keep the planning brief and design record linked when implementation and QA workflows land."
    ];
    const summary = `Design record prepared for ${designRequest.decisionTarget}.`;
    const designRecord = designArtifactSchema.parse({
      ...buildArtifactEnvelopeBase(
        state,
        summary,
        [requestFile ?? ".agentops/requests/design.yaml", designRequest.planningBriefRef],
        planningBrief.source.issueRefs,
        planningBrief.source.githubRefs
      ),
      artifactKind: "design-record",
      lifecycleDomain: "design",
      workflow: {
        name: state.workflow,
        displayName: "Architecture And Design Review"
      },
      payload: {
        decisionSummary: designRequest.decisionTarget,
        context: `Planning brief summary: ${planningBrief.summary}`,
        optionsConsidered,
        chosenApproach,
        tradeOffs: [
          "Keeping the workflow local-first limits external specification ingestion in the MVP.",
          "Deterministic inventory remains heuristic until deeper static-analysis surfaces land."
        ],
        risks: [
          ...(impactedInterfaces.length === 0 ? ["No impacted interfaces were identified from the provided path hints."] : []),
          ...(schemaSurfaces.length === 0 ? ["Schema touch points may still need manual confirmation."] : [])
        ],
        followUpWork,
        interfacesImpacted: impactedInterfaces,
        schemaChangesNeeded: schemaSurfaces,
        policyChangesNeeded: policySurfaces,
        migrationNotes: [],
        compatibilityNotes: ["Requires a valid planning-brief bundle reference from planning-discovery."]
      }
    });

    return agentOutputSchema.parse({
      summary,
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [designRecord],
      requestedTools: [],
      blockedActionFlags: [],
      confidence: 0.78,
      metadata: {
        deterministicInventory: {
          impactedInterfaces,
          schemaSurfaces,
          policySurfaces
        },
        synthesizedDecision: {
          chosenApproach,
          followUpWork
        }
      }
    });
  }
};

const codeReviewAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "code-review",
    displayName: "Code Review",
    category: "review",
    runtime: {
      minVersion: "0.1.0",
      kind: "reasoning"
    },
    permissions: {
      model: true,
      network: false,
      tools: ["filesystem.read-file"],
      readPaths: ["src/**", "packages/**", "agents/**", "adapters/**"],
      writePaths: []
    },
    inputs: ["repo", "changes", "agentResults"],
    outputs: ["findings", "proposedActions"],
    contextPolicy: {
      sections: ["repo", "changes", "agentResults"],
      minimalContext: true
    },
    catalog: {
      domain: "review",
      supportLevel: "official",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const changes = stateSlice.changes;
    const findings = [];
    const proposedActions = [];

    for (const file of changes?.fileDetails ?? []) {
      if (file.insertions >= 200 && !file.path.endsWith(".test.ts")) {
        findings.push({
          id: `review-${file.path}`,
          title: "Large change without focused validation",
          summary: `${file.path} adds ${file.insertions} lines. Split or add focused validation before merging.`,
          severity: "medium" as const,
          rationale: "Large deltas are harder to review and regress more easily without focused checks.",
          confidence: 0.74,
          location: file.path,
          tags: ["review", "change-size"]
        });
      }

      if ((file.path.startsWith("packages/runtime") || file.path.startsWith("packages/policy-engine")) && !changes?.changedFiles.some((path) => path.includes(".test."))) {
        findings.push({
          id: `review-tests-${file.path}`,
          title: "Core package changed without nearby tests",
          summary: `${file.path} changes core workflow behavior but no test file changed in the same run.`,
          severity: "medium" as const,
          rationale: "Runtime and policy changes need regression coverage because they shape guardrails for all agents.",
          confidence: 0.82,
          location: file.path,
          tags: ["review", "tests"]
        });
      }
    }

    if (findings.length > 0) {
      proposedActions.push({
        id: "review-follow-up",
        title: "Tighten test coverage for risky changes",
        summary: "Add or update focused tests around changed runtime or policy logic before merge.",
        sideEffectClass: "suggest" as const,
        targetPaths: ["tests/**"],
        approvalRequired: false
      });
    }

    return agentOutputSchema.parse({
      summary:
        findings.length > 0
          ? `Code review flagged ${findings.length} review concern(s).`
          : "Code review found no high-signal structural concerns from the current diff metadata.",
      findings,
      proposedActions,
      requestedTools: [],
      blockedActionFlags: [],
      confidence: findings.length > 0 ? 0.78 : 0.61,
      metadata: {
        changedFiles: changes?.changedFiles ?? []
      }
    });
  }
};

const highRiskMatchers = [/\.env/i, /^secrets\//i, /^infra\/prod\//i];

const securityAuditAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "security-audit",
    displayName: "Security Audit",
    category: "security",
    runtime: {
      minVersion: "0.1.0",
      kind: "reasoning"
    },
    permissions: {
      model: true,
      network: false,
      tools: ["git.diff-summary", "filesystem.read-file"],
      readPaths: ["**/*"],
      writePaths: []
    },
    inputs: ["repo", "changes", "policy"],
    outputs: ["findings", "blockedActionFlags"],
    contextPolicy: {
      sections: ["repo", "changes", "policy"],
      minimalContext: true
    },
    catalog: {
      domain: "security",
      supportLevel: "official",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const findings = [];
    const blockedActionFlags = [];
    const changedFiles = stateSlice.changes?.changedFiles ?? [];

    for (const filePath of changedFiles) {
      if (highRiskMatchers.some((matcher) => matcher.test(filePath))) {
        findings.push({
          id: `security-${filePath}`,
          title: "Blocked or high-risk path touched",
          summary: `${filePath} matches a blocked or sensitive path pattern and should not be modified without explicit approval.`,
          severity: "high" as const,
          rationale: "Secrets and production infrastructure paths are outside the default safe execution boundary.",
          confidence: 0.95,
          location: filePath,
          tags: ["security", "blocked-path"]
        });
        blockedActionFlags.push(`Sensitive path detected: ${filePath}`);
      }
    }

    return agentOutputSchema.parse({
      summary:
        findings.length > 0
          ? `Security audit raised ${findings.length} high-risk path finding(s).`
          : "Security audit found no high-signal blocked-path issues in the current change set.",
      findings,
      proposedActions: [],
      requestedTools: [],
      blockedActionFlags,
      confidence: findings.length > 0 ? 0.9 : 0.68,
      metadata: {
        changedFiles
      }
    });
  }
};

const testGenerationAgent: RuntimeAgent = {
  manifest: agentManifestSchema.parse({
    version: 1,
    name: "test-generation",
    displayName: "Test Generation",
    category: "quality",
    runtime: {
      minVersion: "0.1.0",
      kind: "reasoning"
    },
    permissions: {
      model: true,
      network: false,
      tools: [],
      readPaths: ["src/**", "packages/**", "tests/**"],
      writePaths: ["tests/**"]
    },
    inputs: ["changes"],
    outputs: ["proposedActions"],
    contextPolicy: {
      sections: ["changes"],
      minimalContext: true
    },
    catalog: {
      domain: "test",
      supportLevel: "official",
      maturity: "mvp",
      trustScope: "official-core-only"
    },
    trust: {
      tier: "core",
      source: "official",
      reviewed: true
    }
  }),
  outputSchema: agentOutputSchema,
  async execute({ stateSlice }) {
    const changedFiles = stateSlice.changes?.changedFiles ?? [];
    const srcTargets = changedFiles.filter((file) => /(^src\/|^packages\/.+\/src\/).+\.ts$/.test(file));
    const hasTests = changedFiles.some((file) => file.includes(".test.") || file.includes(".spec."));
    const proposedActions =
      srcTargets.length > 0 && !hasTests
        ? [
            {
              id: "tests-add-coverage",
              title: "Add focused tests for changed source files",
              summary: `Changed source files (${srcTargets.join(", ")}) do not have matching updated tests in this run.`,
              sideEffectClass: "suggest" as const,
              targetPaths: ["tests/**"],
              approvalRequired: false
            }
          ]
        : [];

    return agentOutputSchema.parse({
      summary:
        proposedActions.length > 0
          ? "Test generation identified missing test coverage opportunities."
          : "Test generation found no obvious test coverage gaps from the current diff metadata.",
      findings: [],
      proposedActions,
      requestedTools: [],
      blockedActionFlags: [],
      confidence: proposedActions.length > 0 ? 0.73 : 0.57,
      metadata: {
        changedFiles
      }
    });
  }
};

export function createBuiltinAgentRegistry(): Map<string, RuntimeAgent> {
  return new Map([
    ["context-collector", contextCollectorAgent],
    ["planning-intake", planningIntakeAgent],
    ["planning-analyst", planningAnalystAgent],
    ["design-intake", designIntakeAgent],
    ["design-inventory", designInventoryAgent],
    ["implementation-intake", implementationIntakeAgent],
    ["qa-intake", qaIntakeAgent],
    ["security-intake", securityIntakeAgent],
    ["incident-intake", incidentIntakeAgent],
    ["incident-evidence-normalizer", incidentEvidenceNormalizationAgent],
    ["maintenance-intake", maintenanceIntakeAgent],
    ["maintenance-analyst", maintenanceAnalystAgent],
    ["incident-analyst", incidentAnalystAgent],
    ["release-intake", releaseIntakeAgent],
    ["release-evidence-normalizer", releaseEvidenceNormalizationAgent],
    ["release-analyst", releaseAnalystAgent],
    ["security-evidence-normalizer", securityEvidenceNormalizationAgent],
    ["security-analyst", securityAnalystAgent],
    ["qa-evidence-normalizer", qaEvidenceNormalizationAgent],
    ["qa-analyst", qaAnalystAgent],
    ["implementation-inventory", implementationInventoryAgent],
    ["implementation-planner", implementationPlannerAgent],
    ["design-analyst", designAnalystAgent],
    ["code-review", codeReviewAgent],
    ["security-audit", securityAuditAgent],
    ["test-generation", testGenerationAgent]
  ]);
}
