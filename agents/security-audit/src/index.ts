import { agentManifestSchema, agentOutputSchema } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";

const highRiskMatchers = [/\.env/i, /^secrets\//i, /^infra\/prod\//i];

export const manifest = agentManifestSchema.parse({
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
});

export const securityAuditAgent: RuntimeAgent = {
  manifest,
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
