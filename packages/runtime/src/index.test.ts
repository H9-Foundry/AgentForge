import { describe, expect, it } from "vitest";

import { agentOutputSchema, lifecycleArtifactSchema, schemaFixtures } from "@h9-foundry/agentforge-schemas";
import type { ReasoningProvider, RuntimeAgent } from "@h9-foundry/agentforge-sdk";
import type { Finding, ProposedAction, WorkflowStateEnvelope } from "@h9-foundry/agentforge-shared-types";

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
  workflowInputs: {},
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
        redactSecrets: (value) => value,
        sanitizeLifecycleArtifact: (artifact) => artifact
      },
      artifactJsonPath: ".agentops/runs/run-1/bundle.json",
      artifactMarkdownPath: ".agentops/runs/run-1/summary.md"
    });

    expect(result.bundle.workflow).toBe("pr-review");
    expect(result.state.auditTrail).toHaveLength(2);
    expect(result.bundle.redaction.applied).toBe(true);
    expect(result.bundle.components.some((component) => component.kind === "agent" && component.name === "noop")).toBe(true);
    expect(result.state.lifecycleArtifacts).toHaveLength(0);
    expect(result.bundle.lifecycleArtifacts).toHaveLength(0);
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
        redactSecrets: (value) => value,
        sanitizeLifecycleArtifact: (artifact) => artifact
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
        const lifecycleArtifact = lifecycleArtifactSchema.parse(
          JSON.parse(JSON.stringify(schemaFixtures.planningArtifact))
        );
        expect(lifecycleArtifact.artifactKind).toBe("planning-brief");
        if (lifecycleArtifact.artifactKind !== "planning-brief") {
          throw new Error("Expected planning artifact fixture");
        }

        return {
          summary: "Produced a planning artifact token=ghp_1234567890ABCDE",
          findings: [finding],
          proposedActions: [proposedAction],
          lifecycleArtifacts: [
            {
              ...lifecycleArtifact,
              summary: "Artifact password=hunter2",
              payload: {
                ...lifecycleArtifact.payload,
                assumptions: ["Bearer sk-abcdef123456"]
              }
            }
          ],
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
        redactSecrets: (value) =>
          value
            .replaceAll("ghp_1234567890ABCDE", "[REDACTED_GITHUB_TOKEN]")
            .replaceAll("hunter2", "[REDACTED_PASSWORD]")
            .replaceAll("sk-abcdef123456", "[REDACTED_API_KEY]"),
        sanitizeLifecycleArtifact: (artifact) =>
          artifact.artifactKind === "planning-brief"
            ? lifecycleArtifactSchema.parse({
                ...artifact,
                summary: artifact.summary.replaceAll("password=hunter2", "password=[REDACTED_PASSWORD]"),
                payload: {
                  ...artifact.payload,
                  assumptions: artifact.payload.assumptions.map((value: string) =>
                    value.replaceAll("Bearer sk-abcdef123456", "Bearer [REDACTED_API_KEY]")
                  )
                }
              })
            : artifact
      },
      artifactJsonPath: ".agentops/runs/run-1/bundle.json",
      artifactMarkdownPath: ".agentops/runs/run-1/summary.md"
    });

    expect(result.state.lifecycleArtifacts).toHaveLength(1);
    expect(result.bundle.lifecycleArtifacts).toHaveLength(1);
    expect(result.state.lifecycleArtifacts[0]?.source.runId).toBe("run-1");
    expect(result.state.lifecycleArtifacts[0]?.auditLink.bundlePath).toBe(".agentops/runs/run-1/bundle.json");
    expect(result.state.lifecycleArtifacts[0]?.auditLink.entryIds).toContain("run-1-plan");
    expect(result.state.lifecycleArtifacts[0]?.auditLink.findingIds).toContain("finding-1");
    expect(result.state.lifecycleArtifacts[0]?.auditLink.proposedActionIds).toContain("action-1");
    expect(result.state.lifecycleArtifacts[0]?.summary).toContain("[REDACTED_PASSWORD]");
    const emittedArtifact = result.state.lifecycleArtifacts[0];
    expect(emittedArtifact?.artifactKind).toBe("planning-brief");
    if (!emittedArtifact || emittedArtifact.artifactKind !== "planning-brief") {
      throw new Error("Expected emitted planning artifact");
    }
    expect(emittedArtifact.payload.assumptions[0]).toContain("[REDACTED_API_KEY]");
    expect(result.bundle.entries[0]?.summary).toContain("[REDACTED_GITHUB_TOKEN]");
  });

  it("captures provider usage per node and aggregates it into the run bundle", async () => {
    const usageAgent: RuntimeAgent = {
      ...noopAgent,
      manifest: {
        ...noopAgent.manifest,
        name: "usage-agent",
        runtime: {
          ...noopAgent.manifest.runtime,
          kind: "reasoning"
        },
        permissions: {
          ...noopAgent.manifest.permissions,
          model: true
        }
      },
      async execute({ provider }) {
        const response = await provider?.runStructured<{ summary: string }>(
          {
            agent: "usage-agent",
            prompt: "Summarize the release candidate.",
            input: { release: "v1.2.3" }
          },
          { parse: (value: unknown) => value } as never
        );

        return {
          summary: response?.output.summary ?? "No provider result.",
          findings: [],
          proposedActions: [],
          lifecycleArtifacts: [],
          requestedTools: [],
          blockedActionFlags: [],
          metadata: {}
        };
      }
    };

    const provider: ReasoningProvider = {
      name: "openai",
      async runStructured<T>() {
        return {
          output: {
            summary: "Release candidate looks healthy."
          } as T,
          usage: {
            provider: "openai",
            model: "gpt-5.4",
            inputTokens: 1200,
            outputTokens: 400,
            totalTokens: 1600,
            requestCount: 2,
            raw: {
              prompt_tokens: 1200,
              completion_tokens: 400
            }
          }
        };
      }
    };

    const result = await runWorkflow({
      workflow: {
        version: 1,
        name: "release-readiness",
        trigger: "manual",
        nodes: [{ id: "release", kind: "reasoning", agent: "usage-agent", outputsTo: "agentResults.release", contextSections: [], tools: [] }]
      },
      initialState: {
        ...state,
        workflow: "release-readiness"
      },
      agents: new Map([["usage-agent", usageAgent]]),
      adapters: new Map(),
      policyEngine: {
        snapshot: state.policy,
        canReadPath: () => ({ allowed: true, effect: "allow", requiresApproval: false }),
        canWritePath: () => ({ allowed: false, effect: "approval_required", requiresApproval: true, reason: "Write requires approval." }),
        evaluateToolRequest: () => ({ allowed: false, effect: "deny", requiresApproval: false }),
        redactSecrets: (value) => value,
        sanitizeLifecycleArtifact: (artifact) => artifact
      },
      provider,
      artifactJsonPath: ".agentops/runs/run-1/bundle.json",
      artifactMarkdownPath: ".agentops/runs/run-1/summary.md"
    });

    expect(result.state.agentResults.release?.usage?.totalTokens).toBe(1600);
    expect(result.state.agentResults.release?.usage?.byModel[0]?.model).toBe("gpt-5.4");
    expect(result.bundle.entries[0]?.usage?.totalRequests).toBe(2);
    expect(result.bundle.usage?.totalTokens).toBe(1600);
    expect(result.bundle.usage?.totalEstimatedCostUsd).toBeGreaterThan(0);
    expect(result.bundle.usage?.costStatus).toBe("estimated");
    expect(result.bundle.usage?.byNode[0]?.nodeId).toBe("release");
  });
});
