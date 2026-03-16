import { agentManifestSchema, agentOutputSchema } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";

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
    ["code-review", codeReviewAgent],
    ["security-audit", securityAuditAgent],
    ["test-generation", testGenerationAgent]
  ]);
}
