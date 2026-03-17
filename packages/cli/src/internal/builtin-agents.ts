import { existsSync } from "node:fs";
import { join } from "node:path";

import { agentManifestSchema, agentOutputSchema, designArtifactSchema, planningArtifactSchema } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";
import type { DesignRequest, PlanningArtifact, PlanningRequest, WorkflowStateEnvelope } from "@h9-foundry/agentforge-shared-types";

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
    ["design-analyst", designAnalystAgent],
    ["code-review", codeReviewAgent],
    ["security-audit", securityAuditAgent],
    ["test-generation", testGenerationAgent]
  ]);
}
