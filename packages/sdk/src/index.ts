import type { ZodTypeAny } from "zod/v3";

import type {
  AgentManifest,
  AgentOutput,
  EffectivePolicySnapshot,
  TrustMetadata,
  ToolRequest,
  ToolResult,
  WorkflowStateEnvelope
} from "@h9-foundry/agentforge-shared-types";

export interface AgentExecutionContext {
  readonly state: WorkflowStateEnvelope;
  readonly stateSlice: Partial<WorkflowStateEnvelope>;
  readonly policy: EffectivePolicySnapshot;
  readonly provider?: ReasoningProvider;
  readonly invokeTool: (request: ToolRequest) => Promise<ToolResult>;
}

export interface ReasoningProviderRequest {
  readonly agent: string;
  readonly prompt: string;
  readonly input: unknown;
}

export interface ReasoningProvider {
  readonly name: string;
  runStructured<T>(request: ReasoningProviderRequest, outputSchema: ZodTypeAny): Promise<T>;
}

export interface RuntimeAgent {
  readonly manifest: AgentManifest;
  readonly outputSchema: ZodTypeAny;
  execute(context: AgentExecutionContext): Promise<AgentOutput>;
}

export interface ToolExecutionContext {
  readonly workingDirectory: string;
  readonly policy: {
    canReadPath(path: string): {
      allowed: boolean;
      effect: "allow" | "deny" | "approval_required";
      requiresApproval: boolean;
      reason?: string;
    };
    canWritePath(path: string): {
      allowed: boolean;
      effect: "allow" | "deny" | "approval_required";
      requiresApproval: boolean;
      reason?: string;
    };
    redactSecrets(value: string): string;
  };
}

export interface ToolAdapterManifest {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodTypeAny;
  readonly outputSchema: ZodTypeAny;
  readonly sideEffectClass: "observe" | "suggest" | "apply-low-risk" | "apply-high-risk";
  readonly permission: "read" | "write" | "network";
  readonly defaultTimeoutMs: number;
  readonly trust: TrustMetadata;
}

export interface ToolAdapter {
  readonly manifest: ToolAdapterManifest;
  execute(input: unknown, context: ToolExecutionContext): Promise<unknown>;
}
