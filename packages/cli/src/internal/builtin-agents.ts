import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  agentManifestSchema,
  agentOutputSchema,
  designArtifactSchema,
  implementationArtifactSchema,
  implementationInventorySchema,
  qaArtifactSchema,
  qaRequestSchema,
  planningArtifactSchema
} from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";
import type {
  DesignArtifact,
  DesignRequest,
  ImplementationArtifact,
  ImplementationInventory,
  ImplementationRequest,
  NormalizedValidationCommand,
  PlanningArtifact,
  PlanningRequest,
  QaArtifact,
  QaRequest,
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

function buildArtifactEnvelopeBase(
  state: WorkflowStateEnvelope,
  summary: string,
  inputRefs: readonly string[],
  issueRefs: readonly string[]
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
      issueRefs: [...issueRefs]
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
      ...buildArtifactEnvelopeBase(state, summary, [requestFile ?? ".agentops/requests/planning.yaml"], planningRequest.issueRefs),
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
    const requestFile = getWorkflowInput<string>(stateSlice, "requestFile");
    if (!qaRequest) {
      throw new Error("qa-review requires validated QA inputs before QA analysis.");
    }

    const intakeMetadata = isRecord(stateSlice.agentResults?.intake?.metadata) ? stateSlice.agentResults.intake.metadata : {};
    const normalizedEvidenceSources = asStringArray(intakeMetadata.evidenceSources);
    const normalizedExecutedChecks = asStringArray(intakeMetadata.executedChecks);
    const normalizedFocusAreas = asStringArray(intakeMetadata.focusAreas);
    const normalizedConstraints = asStringArray(intakeMetadata.constraints);
    const targetType = typeof intakeMetadata.targetType === "string" ? intakeMetadata.targetType : "local-reference";
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
      ...(focusAreas.includes("coverage") ? ["Coverage evidence still needs deterministic normalization before it can be promoted to an official QA signal."] : []),
      ...(executedChecks.length === 0 ? ["No executed validation checks were recorded in the request."] : [])
    ];
    const recommendedNextChecks = [
      ...executedChecks.map((command) => `Review the recorded output for \`${command}\` before promotion.`),
      ...focusAreas.map((focusArea) => `Confirm whether ${focusArea} needs additional deterministic QA evidence.`),
      ...(normalizedConstraints.length > 0 ? [`Keep QA follow-up bounded by: ${normalizedConstraints.join("; ")}.`] : [])
    ];
    const summary = `QA report prepared for ${qaRequest.targetRef}.`;
    const qaReport = qaArtifactSchema.parse({
      ...buildArtifactEnvelopeBase(
        state,
        summary,
        [requestFile ?? ".agentops/requests/qa.yaml", qaRequest.targetRef, ...qaRequest.evidenceSources],
        []
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
            : "Command is not in the bounded allowlist for implementation validation."
        });
      }
    };

    if (repoRoot) {
      registerScripts(join(repoRoot, "package.json"), "package-script");
      for (const packageScope of affectedPackages) {
        const packageJsonPath = join(repoRoot, packageScope, "package.json");
        if (!existsSync(packageJsonPath)) {
          continue;
        }

        const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
        const packageName = isRecord(parsed) && typeof parsed.name === "string" ? parsed.name : packageScope;
        registerScripts(packageJsonPath, "workspace-script", packageName);
      }
    }

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
        designRecord.source.issueRefs
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
        planningBrief.source.issueRefs
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
    ["qa-analyst", qaAnalystAgent],
    ["implementation-inventory", implementationInventoryAgent],
    ["implementation-planner", implementationPlannerAgent],
    ["design-analyst", designAnalystAgent],
    ["code-review", codeReviewAgent],
    ["security-audit", securityAuditAgent],
    ["test-generation", testGenerationAgent]
  ]);
}
