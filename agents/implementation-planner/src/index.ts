import {
  agentManifestSchema,
  agentOutputSchema,
  implementationArtifactSchema,
  implementationInventorySchema
} from "@h9-foundry/agentforge-schemas";
import type {
  DesignArtifact,
  ImplementationInventory,
  ImplementationRequest,
  WorkflowStateEnvelope
} from "@h9-foundry/agentforge-shared-types";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getWorkflowInput<T>(stateSlice: Partial<WorkflowStateEnvelope>, key: string): T | undefined {
  if (!isRecord(stateSlice.workflowInputs)) {
    return undefined;
  }

  return stateSlice.workflowInputs[key] as T | undefined;
}

function buildArtifactEnvelopeBase(state: WorkflowStateEnvelope, summary: string, inputRefs: readonly string[], issueRefs: readonly string[]) {
  return {
    schemaVersion: state.version,
    workflow: {
      name: state.workflow,
      displayName: "Implementation Proposal"
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

export const manifest = agentManifestSchema.parse({
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
});

export const implementationPlannerAgent: RuntimeAgent = {
  manifest,
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
      lifecycleArtifacts: [implementationProposal],
      requestedTools: [],
      blockedActionFlags: [],
      confidence: 0.76,
      metadata: {
        deterministicInputs: {
          targetPaths: implementationRequest.targetPaths,
          validationCommands: implementationRequest.validationCommands,
          constraints: implementationRequest.constraints,
          designInterfaces: designRecord.payload.interfacesImpacted,
          inventory: (inventory ?? null) satisfies ImplementationInventory | null
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
