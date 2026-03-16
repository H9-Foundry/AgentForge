import type { AuditBundle, AuditEntry, WorkflowStateEnvelope } from "@h9-foundry/agentforge-shared-types";

export function createAuditEntry(entry: AuditEntry): AuditEntry {
  return entry;
}

export function buildAuditBundle(
  state: WorkflowStateEnvelope,
  options: {
    startedAt: string;
    finishedAt: string;
    status: "success" | "partial" | "failed";
    jsonPath: string;
    markdownPath: string;
    provenance: AuditBundle["provenance"];
    redaction: AuditBundle["redaction"];
    components: AuditBundle["components"];
  }
): AuditBundle {
  return {
    version: state.version,
    runId: state.runId,
    workflow: state.workflow,
    startedAt: options.startedAt,
    finishedAt: options.finishedAt,
    status: options.status,
    policy: state.policy,
    entries: state.auditTrail,
    findings: state.findings,
    proposedActions: state.proposedActions,
    blockedPlugins: state.blockedPlugins,
    artifactPaths: {
      json: options.jsonPath,
      markdown: options.markdownPath
    },
    provenance: options.provenance,
    redaction: options.redaction,
    components: options.components
  };
}

export function renderAuditBundleMarkdown(bundle: AuditBundle): string {
  const lines = [
    `# AgentForge Run ${bundle.runId}`,
    "",
    `- Workflow: ${bundle.workflow}`,
    `- Status: ${bundle.status}`,
    `- Started: ${bundle.startedAt}`,
    `- Finished: ${bundle.finishedAt}`,
    `- Findings: ${bundle.findings.length}`,
    `- Proposed actions: ${bundle.proposedActions.length}`,
    `- Blocked plugins: ${bundle.blockedPlugins.length}`,
    `- Redaction applied: ${bundle.redaction.applied ? "yes" : "no"}`,
    `- Trusted components recorded: ${bundle.components.length}`,
    ""
  ];

  if (bundle.findings.length > 0) {
    lines.push("## Findings", "");
    for (const finding of bundle.findings) {
      lines.push(`- [${finding.severity}] ${finding.title}: ${finding.summary}`);
    }
    lines.push("");
  }

  const blockedEntries = bundle.entries.filter((entry) => entry.blockedActions.length > 0);
  if (blockedEntries.length > 0) {
    lines.push("## Blocked Actions", "");
    for (const entry of blockedEntries) {
      lines.push(`- ${entry.nodeName}: ${entry.blockedActions.join(", ")}`);
    }
    lines.push("");
  }

  if (bundle.blockedPlugins.length > 0) {
    lines.push("## Blocked Plugins", "");
    for (const blockedPlugin of bundle.blockedPlugins) {
      lines.push(`- ${blockedPlugin.name} (${blockedPlugin.package}): ${blockedPlugin.reason}`);
    }
    lines.push("");
  }

  lines.push("## Audit Trail", "");
  for (const entry of bundle.entries) {
    lines.push(`- ${entry.nodeName}: ${entry.status} (${entry.summary})`);
  }

  return lines.join("\n");
}
