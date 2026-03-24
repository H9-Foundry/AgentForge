# @h9-foundry/agentforge-runtime

Deterministic workflow orchestration and tool mediation for AgentForge.

This package runs ordered workflow nodes, enforces policy decisions around tool use, records audit entries, links lifecycle artifacts, and returns a final audit bundle for the run.

## Install

```bash
npm install @h9-foundry/agentforge-runtime
```

## What It Does

- Executes workflow nodes in order.
- Invokes registered agents with minimal state slices.
- Mediates tool requests through registered adapters and a policy engine.
- Blocks denied or approval-gated tool calls before execution.
- Redacts sensitive values before audit output is persisted.
- Returns the updated workflow state and the generated audit bundle.

## Usage

```ts
import { runWorkflow } from "@h9-foundry/agentforge-runtime";
import { agentOutputSchema } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";
import type { WorkflowStateEnvelope } from "@h9-foundry/agentforge-shared-types";

const initialState: WorkflowStateEnvelope = {
  version: "1.0.0",
  runId: "run-1",
  workflow: "pr-review",
  mode: "inspect",
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
    changedFiles: [],
    stagedFiles: [],
    untrackedFiles: [],
    impactedPaths: [],
    diffStats: { filesChanged: 0, insertions: 0, deletions: 0 },
    fileDetails: []
  },
  context: {
    localExecution: true,
    ciExecution: false,
    trigger: "manual",
    timestamp: new Date().toISOString()
  },
  policy: {
    version: 1,
    environment: "local",
    resolvedAt: new Date().toISOString(),
    defaults: {
      executionMode: "inspect",
      modelAccess: false,
      network: "deny",
      writes: "approval_required"
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
  initialState,
  agents: new Map([["noop", noopAgent]]),
  adapters: new Map(),
  policyEngine: {
    snapshot: initialState.policy,
    canReadPath: () => ({ allowed: true, effect: "allow", requiresApproval: false }),
    canWritePath: () => ({ allowed: false, effect: "approval_required", requiresApproval: true, reason: "Write requires approval." }),
    evaluateToolRequest: () => ({ allowed: false, effect: "deny", requiresApproval: false }),
    redactSecrets: (value) => value,
    sanitizeLifecycleArtifact: (artifact) => artifact
  },
  artifactJsonPath: ".agentops/runs/run-1/bundle.json",
  artifactMarkdownPath: ".agentops/runs/run-1/summary.md"
});

console.log(result.bundle.workflow);
console.log(result.state.auditTrail.length);
```

## API

### `runWorkflow(deps)`

Runs a workflow and returns:

- `state`: the updated `WorkflowStateEnvelope`
- `bundle`: the generated audit bundle

`deps` includes:

- `workflow`: workflow definition to execute
- `initialState`: normalized workflow state envelope
- `agents`: registered runtime agents by name
- `adapters`: registered tool adapters by name
- `policyEngine`: policy mediation and redaction hooks
- `provider`: optional reasoning provider for bounded reasoning nodes
- `artifactJsonPath`: output path recorded in the audit bundle for JSON artifacts
- `artifactMarkdownPath`: output path recorded in the audit bundle for Markdown artifacts

## Related Packages

- [`@h9-foundry/agentforge-cli`](https://www.npmjs.com/package/@h9-foundry/agentforge-cli)
- [`@h9-foundry/agentforge-sdk`](https://www.npmjs.com/package/@h9-foundry/agentforge-sdk)
- [`@h9-foundry/agentforge-schemas`](https://www.npmjs.com/package/@h9-foundry/agentforge-schemas)
- [`@h9-foundry/agentforge-policy-engine`](https://www.npmjs.com/package/@h9-foundry/agentforge-policy-engine)
- [`@h9-foundry/agentforge-audit`](https://www.npmjs.com/package/@h9-foundry/agentforge-audit)

## Source

- Repository: [github.com/H9-Foundry/AgentForge](https://github.com/H9-Foundry/AgentForge)
- Package directory: [packages/runtime](https://github.com/H9-Foundry/AgentForge/tree/main/packages/runtime)
- Runtime model: [docs/runtime-model.md](https://github.com/H9-Foundry/AgentForge/blob/main/docs/runtime-model.md)
