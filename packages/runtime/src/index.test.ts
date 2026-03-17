import { describe, expect, it } from "vitest";

import { agentOutputSchema, lifecycleArtifactSchema, schemaFixtures } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";
import type { Finding, LifecycleArtifact, ProposedAction, WorkflowStateEnvelope } from "@h9-foundry/agentforge-shared-types";

import { runWorkflow } from "./index.js";

const state: WorkflowStateEnvelope = {
  version: "1.0.0",
  runId: "run-1",
  workflow: "pr-review",
  mode: "inspect" as const,
  repo: {
    root: "/repo",
    name: "repo",
    branch: "main",
    packageManager: "pnpm",
    languages: ["typescript"],
    ci: false,
    detectedFiles: []
  },
  changes: {
    changedFiles: ["src/index.ts"],
    stagedFiles: [],
    untrackedFiles: [],
    impactedPaths: ["src"],
    diffStats: {
      filesChanged: 1,
      insertions: 1,
      deletions: 0
    },
    fileDetails: [{ path: "src/index.ts", status: "M", insertions: 1, deletions: 0 }]
  },
  context: {
    localExecution: true,
    ciExecution: false,
    trigger: "manual" as const,
    timestamp: new Date().toISOString()
  },
  policy: {
    version: 1,
    environment: "local" as const,
    resolvedAt: new Date().toISOString(),
    defaults: {
      executionMode: "inspect" as const,
      modelAccess: false,
      network: "deny" as const,
      writes: "approval_required" as const
    },
    paths: {
      allowedRead: ["**/*"],
      allowedWrite: [".agentops/runs/**"],
      blocked: [".env*"]
    },
    plugins: {
      allowedTiers: ["core", "verified"],
      allowedSources: ["official", "local"],
      requireReviewed: true
    },
    tools: {}
  },
  approvals: [],
  findings: [],
  proposedActions: [],
  lifecycleArtifacts: [],
  blockedPlugins: [],
  agentResults: {},
  auditTrail: []
};

const noopAgent: RuntimeAgent = {
  manifest: {
    version: 1,
    name: "noop",
    displayName: "Noop",
    category: "test",
    runtime: { minVersion: "0.1.0", kind: "deterministic" },
    permissions: { model: false, network: false, tools: [], readPaths: [], writePaths: [] },
    inputs: [],
    outputs: ["summary"],
    contextPolicy: { sections: ["repo", "changes"], minimalContext: true },
    trust: { tier: "core", source: "official", reviewed: true }
  },
  outputSchema: agentOutputSchema,
  async execute() {
    return {
      summary: "Completed",
      findings: [],
      proposedActions: [],
      lifecycleArtifacts: [],
      requestedTools: [],
      blockedActionFlags: [],
      metadata: {}
    };
  }
};

describe("runtime", () => {
  it("runs a workflow end to end", async () => {
    const result = await runWorkflow({
      workflow: {
        version: 1,
        name: "pr-review",
        trigger: "manual",
        nodes: [
          { id: "context", kind: "deterministic", agent: "noop", outputsTo: "agentResults.context", contextSections: [], tools: [] },
          { id: "report", kind: "report", outputsTo: "report.final", contextSections: [], tools: [] }
        ]
      },
      initialState: state,
      agents: new Map([["noop", noopAgent]]),
      adapters: new Map(),
      policyEngine: {
        snapshot: state.policy,
        canReadPath: () => ({ allowed: true, effect: "allow", requiresApproval: false }),
        canWritePath: () => ({ allowed: false, effect: "approval_required", requiresApproval: true, reason: "Write requires approval." }),
        evaluateToolRequest: () => ({ allowed: false, effect: "deny", requiresApproval: false }),
        redactSecrets: (value) => value
      },
      artifactJsonPath: ".agentops/runs/run-1/bundle.json",
      artifactMarkdownPath: ".agentops/runs/run-1/summary.md"
    });

    expect(result.bundle.workflow).toBe("pr-review");
    expect(result.state.auditTrail).toHaveLength(2);
    expect(result.bundle.redaction.applied).toBe(true);
    expect(result.bundle.components.some((component) => component.kind === "agent" && component.name === "noop")).toBe(true);
    expect(result.state.lifecycleArtifacts).toHaveLength(0);
  });

  it("does not execute approval-gated tools", async () => {
    let executed = false;
    const gatedAgent: RuntimeAgent = {
      ...noopAgent,
      manifest: {
        ...noopAgent.manifest,
        name: "gated-agent"
      },
      async execute({ invokeTool }) {
        await invokeTool({
          tool: "filesystem.write-file",
          input: { path: "tests/new.test.ts", contents: "export {};\n" },
          requestedBy: "gated-agent",
          requestedAt: new Date().toISOString()
        });

        return {
          summary: "Completed",
          findings: [],
          proposedActions: [],
          lifecycleArtifacts: [],
          requestedTools: [],
          blockedActionFlags: [],
          metadata: {}
        };
      }
    };

    const result = await runWorkflow({
      workflow: {
        version: 1,
        name: "pr-review",
        trigger: "manual",
        nodes: [{ id: "gated", kind: "reasoning", agent: "gated-agent", outputsTo: "agentResults.gated", contextSections: [], tools: [] }]
      },
      initialState: state,
      agents: new Map([["gated-agent", gatedAgent]]),
      adapters: new Map([
        [
          "filesystem.write-file",
          {
            manifest: {
              name: "filesystem.write-file",
              description: "test",
              inputSchema: { parse: (value: unknown) => value } as never,
              outputSchema: { parse: (value: unknown) => value } as never,
              sideEffectClass: "apply-low-risk",
              permission: "write",
              defaultTimeoutMs: 500,
              trust: { tier: "core", source: "official", reviewed: true }
            },
            async execute() {
              executed = true;
              return { ok: true };
            }
          }
        ]
      ]),
      policyEngine: {
        snapshot: state.policy,
        canReadPath: () => ({ allowed: true, effect: "allow", requiresApproval: false }),
        canWritePath: () => ({ allowed: true, effect: "approval_required", requiresApproval: true, reason: "Write requires approval." }),
        evaluateToolRequest: () => ({
          allowed: true,
          effect: "approval_required",
          requiresApproval: true,
          reason: "Tool requires approval: filesystem.write-file"
        }),
        redactSecrets: (value) => value
      },
      artifactJsonPath: ".agentops/runs/run-1/bundle.json",
      artifactMarkdownPath: ".agentops/runs/run-1/summary.md"
    });

    expect(executed).toBe(false);
    expect(result.bundle.entries[0]?.blockedActions[0]).toContain("approval");
  });

  it("records emitted lifecycle artifacts with audit linkage", async () => {
    const artifactAgent: RuntimeAgent = {
      ...noopAgent,
      manifest: {
        ...noopAgent.manifest,
        name: "artifact-agent"
      },
      async execute() {
        const finding: Finding = {
          ...schemaFixtures.finding,
          tags: [...schemaFixtures.finding.tags]
        };
        const proposedAction: ProposedAction = {
          id: "action-1",
          title: "Open follow-up issue",
          summary: "Track the next implementation slice.",
          sideEffectClass: "suggest",
          targetPaths: [],
          approvalRequired: true
        };
        const lifecycleArtifact: LifecycleArtifact = lifecycleArtifactSchema.parse(
          JSON.parse(JSON.stringify(schemaFixtures.planningArtifact))
        );

        return {
          summary: "Produced a planning artifact",
          findings: [finding],
          proposedActions: [proposedAction],
          lifecycleArtifacts: [lifecycleArtifact],
          requestedTools: [],
          blockedActionFlags: [],
          metadata: {}
        };
      }
    };

    const result = await runWorkflow({
      workflow: {
        version: 1,
        name: "planning-discovery",
        trigger: "manual",
        nodes: [{ id: "plan", kind: "deterministic", agent: "artifact-agent", outputsTo: "agentResults.plan", contextSections: [], tools: [] }]
      },
      initialState: {
        ...state,
        workflow: "planning-discovery"
      },
      agents: new Map([["artifact-agent", artifactAgent]]),
      adapters: new Map(),
      policyEngine: {
        snapshot: state.policy,
        canReadPath: () => ({ allowed: true, effect: "allow", requiresApproval: false }),
        canWritePath: () => ({ allowed: false, effect: "approval_required", requiresApproval: true, reason: "Write requires approval." }),
        evaluateToolRequest: () => ({ allowed: false, effect: "deny", requiresApproval: false }),
        redactSecrets: (value) => value
      },
      artifactJsonPath: ".agentops/runs/run-1/bundle.json",
      artifactMarkdownPath: ".agentops/runs/run-1/summary.md"
    });

    expect(result.state.lifecycleArtifacts).toHaveLength(1);
    expect(result.state.lifecycleArtifacts[0]?.source.runId).toBe("run-1");
    expect(result.state.lifecycleArtifacts[0]?.auditLink.bundlePath).toBe(".agentops/runs/run-1/bundle.json");
    expect(result.state.lifecycleArtifacts[0]?.auditLink.entryIds).toContain("run-1-plan");
    expect(result.state.lifecycleArtifacts[0]?.auditLink.findingIds).toContain("finding-1");
    expect(result.state.lifecycleArtifacts[0]?.auditLink.proposedActionIds).toContain("action-1");
    expect(result.bundle.entries[0]?.summary).toBe("Produced a planning artifact");
  });
});
