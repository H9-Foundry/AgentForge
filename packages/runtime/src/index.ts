import { buildAuditBundle, createAuditEntry } from "@h9-foundry/agentforge-audit";
import { agentOutputSchema, lifecycleArtifactSchema, toolResultSchema } from "@h9-foundry/agentforge-schemas";
import type {
  AuditComponent,
  AuditBundle,
  EffectivePolicySnapshot,
  LifecycleArtifact,
  ProviderUsageByModel,
  ProviderUsageNodeBreakdown,
  ToolRequest,
  ToolResult,
  WorkflowDefinition,
  WorkflowStateEnvelope
} from "@h9-foundry/agentforge-shared-types";
import type { ReasoningProvider, ReasoningProviderRequest, RuntimeAgent, ToolAdapter } from "@h9-foundry/agentforge-sdk";

import { buildProviderUsageAggregate, buildProviderUsageSummary, enrichProviderUsage } from "./usage.js";

export interface PolicyEngineLike {
  readonly snapshot: EffectivePolicySnapshot;
  canReadPath(pathValue: string): {
    allowed: boolean;
    effect: "allow" | "deny" | "approval_required";
    requiresApproval: boolean;
    reason?: string;
  };
  canWritePath(pathValue: string): {
    allowed: boolean;
    effect: "allow" | "deny" | "approval_required";
    requiresApproval: boolean;
    reason?: string;
  };
  evaluateToolRequest(request: ToolRequest): {
    allowed: boolean;
    effect: "allow" | "deny" | "approval_required";
    requiresApproval: boolean;
    reason?: string;
  };
  redactSecrets(value: string): string;
  sanitizeLifecycleArtifact(artifact: LifecycleArtifact): LifecycleArtifact;
}

export interface WorkflowRunDependencies {
  readonly workflow: WorkflowDefinition;
  readonly initialState: WorkflowStateEnvelope;
  readonly agents: Map<string, RuntimeAgent>;
  readonly adapters: Map<string, ToolAdapter>;
  readonly policyEngine: PolicyEngineLike;
  readonly provider?: ReasoningProvider;
  readonly artifactJsonPath: string;
  readonly artifactMarkdownPath: string;
}

function sanitizeOutput(policyEngine: PolicyEngineLike, value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (!serialized) return value;
  const redacted = policyEngine.redactSecrets(serialized);
  return JSON.parse(redacted);
}

function sanitizeText(policyEngine: PolicyEngineLike, value: string | undefined): string | undefined {
  if (!value) return value;
  return policyEngine.redactSecrets(value);
}

function collectRuntimeComponents(deps: WorkflowRunDependencies): AuditComponent[] {
  const components: AuditComponent[] = [];
  const seen = new Set<string>();

  for (const node of deps.workflow.nodes) {
    if (!node.agent) continue;
    const agent = deps.agents.get(node.agent);
    if (!agent) continue;
    const key = `agent:${agent.manifest.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    components.push({
      kind: "agent",
      name: agent.manifest.name,
      version: agent.manifest.runtime.minVersion,
      trust: agent.manifest.trust,
      permissions: [
        ...(agent.manifest.permissions.model ? ["model"] : []),
        ...(agent.manifest.permissions.network ? ["network"] : []),
        ...agent.manifest.permissions.tools
      ]
    });
  }

  for (const adapter of deps.adapters.values()) {
    const key = `adapter:${adapter.manifest.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    components.push({
      kind: "adapter",
      name: adapter.manifest.name,
      version: "workspace",
      trust: adapter.manifest.trust,
      permissions: [adapter.manifest.permission, adapter.manifest.sideEffectClass]
    });
  }

  if (deps.provider) {
    components.push({
      kind: "provider",
      name: deps.provider.name,
      version: "workspace",
      trust: {
        tier: "verified",
        source: "third-party",
        reviewed: false
      },
      permissions: ["model"]
    });
  }

  return components;
}

async function invokeTool(
  request: ToolRequest,
  adapters: Map<string, ToolAdapter>,
  policyEngine: PolicyEngineLike,
  workingDirectory: string
): Promise<ToolResult> {
  const adapter = adapters.get(request.tool);
  if (!adapter) {
    return toolResultSchema.parse({
      tool: request.tool,
      status: "blocked",
      sideEffectClass: "observe",
      durationMs: 0,
      blockedReason: `Tool adapter not registered: ${request.tool}`
    });
  }

  const decision = policyEngine.evaluateToolRequest(request);
  if (!decision.allowed) {
    return toolResultSchema.parse({
      tool: request.tool,
      status: "blocked",
      sideEffectClass: adapter.manifest.sideEffectClass,
      durationMs: 0,
      blockedReason: sanitizeText(policyEngine, decision.reason)
    });
  }

  if (decision.requiresApproval) {
    return toolResultSchema.parse({
      tool: request.tool,
      status: "blocked",
      sideEffectClass: adapter.manifest.sideEffectClass,
      durationMs: 0,
      blockedReason: sanitizeText(policyEngine, decision.reason)
    });
  }

  const startedAt = Date.now();
  try {
    const parsedInput = adapter.manifest.inputSchema.parse(request.input);
    const output = await Promise.race([
      adapter.execute(parsedInput, {
        workingDirectory,
        policy: {
          canReadPath: (pathValue) => policyEngine.canReadPath(pathValue),
          canWritePath: (pathValue) => policyEngine.canWritePath(pathValue),
          redactSecrets: (value) => policyEngine.redactSecrets(value)
        }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool timeout after ${adapter.manifest.defaultTimeoutMs}ms`)), adapter.manifest.defaultTimeoutMs)
      )
    ]);

    return toolResultSchema.parse({
      tool: request.tool,
      status: "success",
      sideEffectClass: adapter.manifest.sideEffectClass,
      durationMs: Date.now() - startedAt,
      output: sanitizeOutput(policyEngine, adapter.manifest.outputSchema.parse(output))
    });
  } catch (error) {
    return toolResultSchema.parse({
      tool: request.tool,
      status: "failed",
      sideEffectClass: adapter.manifest.sideEffectClass,
      durationMs: Date.now() - startedAt,
      error: sanitizeText(policyEngine, error instanceof Error ? error.message : String(error))
    });
  }
}

function sliceState(state: WorkflowStateEnvelope, sections: readonly string[]): Partial<WorkflowStateEnvelope> {
  if (sections.length === 0) return { repo: state.repo, changes: state.changes, context: state.context };

  const slice: Partial<WorkflowStateEnvelope> = {};
  for (const section of sections) {
    if (section in state) {
      (slice as Record<string, unknown>)[section] = (state as Record<string, unknown>)[section];
    }
  }
  return slice;
}

function linkLifecycleArtifacts(
  artifacts: readonly LifecycleArtifact[],
  context: {
    readonly runId: string;
    readonly auditEntryId: string;
    readonly bundlePath: string;
    readonly findingIds: readonly string[];
    readonly proposedActionIds: readonly string[];
  }
): LifecycleArtifact[] {
  return artifacts.map((artifact) =>
    lifecycleArtifactSchema.parse({
      ...artifact,
      source: {
        ...artifact.source,
        runId: artifact.source.sourceType === "workflow-run" ? context.runId : artifact.source.runId
      },
      auditLink: {
        ...artifact.auditLink,
        bundlePath: context.bundlePath,
        entryIds: Array.from(new Set([...artifact.auditLink.entryIds, context.auditEntryId])),
        findingIds: Array.from(new Set([...artifact.auditLink.findingIds, ...context.findingIds])),
        proposedActionIds: Array.from(new Set([...artifact.auditLink.proposedActionIds, ...context.proposedActionIds]))
      }
    })
  );
}

export async function runWorkflow(deps: WorkflowRunDependencies): Promise<{ state: WorkflowStateEnvelope; bundle: AuditBundle }> {
  const startedAt = new Date().toISOString();
  const usageByNode: ProviderUsageNodeBreakdown[] = [];
  const state: WorkflowStateEnvelope = {
    ...deps.initialState,
    findings: [...(deps.initialState.findings ?? [])],
    proposedActions: [...(deps.initialState.proposedActions ?? [])],
    lifecycleArtifacts: [...(deps.initialState.lifecycleArtifacts ?? [])],
    blockedPlugins: [...(deps.initialState.blockedPlugins ?? [])],
    agentResults: { ...(deps.initialState.agentResults ?? {}) },
    auditTrail: [...(deps.initialState.auditTrail ?? [])]
  };

  for (const node of deps.workflow.nodes) {
    state.configuration?.execution.executedNodes.push({
      nodeId: node.id,
      kind: node.kind,
      ...(node.agent ? { agent: node.agent } : {})
    });

    if (node.kind === "report") {
      state.auditTrail.push(
        createAuditEntry({
          id: `${state.runId}-${node.id}`,
          nodeId: node.id,
          nodeName: "final-report",
          kind: "report",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          status: "success",
          summary: "Generated final report artifacts.",
          toolsRequested: [],
          toolsExecuted: [],
          blockedActions: [],
          validationPassed: true
        })
      );
      continue;
    }

    const agent = deps.agents.get(node.agent ?? "");
    if (!agent) {
      throw new Error(`Agent not registered: ${node.agent ?? "unknown"}`);
    }

    const nodeStartedAt = new Date().toISOString();
    const toolsRequested: ToolRequest[] = [];
    const toolsExecuted: ToolResult[] = [];
    const nodeUsageEntries: ProviderUsageByModel[] = [];

    const trackedProvider: ReasoningProvider | undefined = deps.provider
      ? {
          name: deps.provider.name,
          runStructured: async <T>(
            request: ReasoningProviderRequest,
            outputSchema: Parameters<ReasoningProvider["runStructured"]>[1]
          ) => {
            const result = await deps.provider!.runStructured<T>(request, outputSchema);
            if (result.usage) {
              nodeUsageEntries.push(enrichProviderUsage(result.usage, deps.provider!.name));
            }

            return result;
          }
        }
      : undefined;

    const parsedOutput = agentOutputSchema.parse(
      sanitizeOutput(
        deps.policyEngine,
        await agent.execute({
          state,
          stateSlice: sliceState(state, agent.manifest.contextPolicy.sections),
          policy: deps.policyEngine.snapshot,
          provider: trackedProvider,
          invokeTool: async (request) => {
            toolsRequested.push(request);
            const result = await invokeTool(request, deps.adapters, deps.policyEngine, state.repo.root);
            toolsExecuted.push(result);
            return result;
          }
        })
      )
    );
    const nodeUsage = buildProviderUsageSummary(nodeUsageEntries);
    const output = nodeUsage
      ? agentOutputSchema.parse({
          ...parsedOutput,
          usage: nodeUsage
        })
      : parsedOutput;

    const auditEntryId = `${state.runId}-${node.id}`;
    const linkedLifecycleArtifacts = linkLifecycleArtifacts(output.lifecycleArtifacts, {
      runId: state.runId,
      auditEntryId,
      bundlePath: deps.artifactJsonPath,
      findingIds: output.findings.map((finding) => finding.id),
      proposedActionIds: output.proposedActions.map((action) => action.id)
    }).map((artifact) => deps.policyEngine.sanitizeLifecycleArtifact(artifact));

    state.agentResults[node.id] = {
      ...output,
      lifecycleArtifacts: linkedLifecycleArtifacts
    };
    state.findings.push(...output.findings);
    state.proposedActions.push(...output.proposedActions);
    state.lifecycleArtifacts.push(...linkedLifecycleArtifacts);
    if (nodeUsage) {
      usageByNode.push({
        ...nodeUsage,
        nodeId: node.id,
        nodeName: agent.manifest.name,
        kind: agent.manifest.runtime.kind
      });
    }

    state.auditTrail.push(
      createAuditEntry({
        id: auditEntryId,
        nodeId: node.id,
        nodeName: agent.manifest.name,
        kind: agent.manifest.runtime.kind,
        startedAt: nodeStartedAt,
        completedAt: new Date().toISOString(),
        status: toolsExecuted.some((tool) => tool.status === "failed") ? "failed" : "success",
        model: deps.provider?.name,
        summary: output.summary,
        toolsRequested,
        toolsExecuted,
        blockedActions: [
          ...output.blockedActionFlags,
          ...toolsExecuted.filter((tool) => tool.status === "blocked").map((tool) => tool.blockedReason ?? tool.tool)
        ],
        validationPassed: true,
        usage: nodeUsage
      })
    );
  }

  const aggregatedUsage = buildProviderUsageAggregate(usageByNode);
  if (aggregatedUsage) {
    state.usage = aggregatedUsage;
  }

  const status = state.auditTrail.some((entry) => entry.status === "failed") ? "partial" : "success";
  const bundle = buildAuditBundle(state, {
    startedAt,
    finishedAt: new Date().toISOString(),
    status,
    jsonPath: deps.artifactJsonPath,
    markdownPath: deps.artifactMarkdownPath,
    provenance: {
      generatedBy: "agentforge-runtime",
      schemaVersion: state.version,
      executionEnvironment: state.context.ciExecution ? "ci" : "local",
      repoRoot: state.repo.root
    },
    redaction: {
      applied: true,
      strategyVersion: "1.0.0",
      categories: ["github-token", "api-key", "aws-key", "bearer-token", "password", "private-key"]
    },
    components: collectRuntimeComponents(deps)
  });

  return { state, bundle };
}
