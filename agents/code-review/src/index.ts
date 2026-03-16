import { agentManifestSchema, agentOutputSchema } from "@agentops/schemas";
import type { RuntimeAgent } from "@agentops/sdk";

export const manifest = agentManifestSchema.parse({
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
  trust: {
    tier: "core",
    source: "official",
    reviewed: true
  }
});

export const codeReviewAgent: RuntimeAgent = {
  manifest,
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
