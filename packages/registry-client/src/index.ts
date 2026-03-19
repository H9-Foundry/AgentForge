import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { agentManifestSchema, registryPluginCatalogSchema } from "@h9-foundry/agentforge-schemas";
import type { RuntimeAgent } from "@h9-foundry/agentforge-sdk";
import type { AuditEntry, RegistryPluginCatalog, RegistryPluginCatalogEntry, TrustMetadata } from "@h9-foundry/agentforge-shared-types";

const CURRENT_AGENT_MANIFEST_VERSION = 1;

export interface RegistryDiscoveryOptions {
  readonly agentforgeVersion?: string;
  readonly manifestVersion?: number;
  readonly workflowDomain?: RegistryPluginCatalogEntry["catalog"]["domain"];
  readonly pluginType?: RegistryPluginCatalogEntry["pluginType"];
  readonly includeIncompatible?: boolean;
}

export interface RegistryCompatibilityIssue {
  readonly code:
    | "agentforge_version_range_unsupported"
    | "agentforge_version_incompatible"
    | "manifest_version_incompatible"
    | "workflow_domain_not_supported"
    | "plugin_type_mismatch";
  readonly message: string;
}

export interface RegistryDiscoveryResult {
  readonly entry: RegistryPluginCatalogEntry;
  readonly compatible: boolean;
  readonly issues: RegistryCompatibilityIssue[];
}

export interface RegistryActivationPolicyDecision {
  readonly allowed: boolean;
  readonly effect: "allow" | "deny" | "approval_required";
  readonly requiresApproval: boolean;
  readonly reason?: string;
}

export interface RegistryActivationPolicyEvaluator {
  evaluatePluginActivation(
    name: string,
    trust: TrustMetadata,
    options: {
      activationSupport: RegistryPluginCatalogEntry["distribution"]["activationSupport"];
      compatibilityIssues?: readonly RegistryCompatibilityIssue[];
      approvalGranted?: boolean;
    }
  ): RegistryActivationPolicyDecision;
}

export interface RegistryActivationOptions {
  readonly approvalGranted?: boolean;
  readonly agentforgeVersion?: string;
  readonly manifestVersion?: number;
  readonly workflowDomain?: RegistryPluginCatalogEntry["catalog"]["domain"];
}

export interface RegistryActivationDecision {
  readonly entry: RegistryPluginCatalogEntry;
  readonly compatibility: RegistryDiscoveryResult;
  readonly policyDecision: RegistryActivationPolicyDecision;
  readonly activated: boolean;
  readonly auditEntry: AuditEntry;
}

interface WorkspacePackageRecord {
  readonly name: string;
  readonly root: string;
  readonly manifest: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function parseVersion(value: string): [number, number, number] | undefined {
  const match = /^v?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/.exec(value.trim());
  if (!match?.groups) {
    return undefined;
  }

  return [Number(match.groups.major), Number(match.groups.minor), Number(match.groups.patch)];
}

function compareVersions(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] > right[index]) {
      return 1;
    }

    if (left[index] < right[index]) {
      return -1;
    }
  }

  return 0;
}

function matchesVersionRange(version: string, range: string): { supported: boolean; matches: boolean } {
  const normalizedRange = range.trim();
  if (normalizedRange === "*" || normalizedRange === "") {
    return { supported: true, matches: true };
  }

  if (normalizedRange.includes(" ") || normalizedRange.includes("||")) {
    return { supported: false, matches: false };
  }

  const versionParts = parseVersion(version);
  if (!versionParts) {
    return { supported: false, matches: false };
  }

  const operatorMatch = /^(?<operator>\^|~|>=|<=|>|<)?(?<target>v?\d+\.\d+\.\d+)$/.exec(normalizedRange);
  if (!operatorMatch?.groups) {
    return { supported: false, matches: false };
  }

  const targetParts = parseVersion(operatorMatch.groups.target);
  if (!targetParts) {
    return { supported: false, matches: false };
  }

  const comparison = compareVersions(versionParts, targetParts);
  switch (operatorMatch.groups.operator ?? "=") {
    case "=":
      return { supported: true, matches: comparison === 0 };
    case ">":
      return { supported: true, matches: comparison > 0 };
    case ">=":
      return { supported: true, matches: comparison >= 0 };
    case "<":
      return { supported: true, matches: comparison < 0 };
    case "<=":
      return { supported: true, matches: comparison <= 0 };
    case "^":
      return { supported: true, matches: versionParts[0] === targetParts[0] && comparison >= 0 };
    case "~":
      return {
        supported: true,
        matches: versionParts[0] === targetParts[0] && versionParts[1] === targetParts[1] && comparison >= 0
      };
    default:
      return { supported: false, matches: false };
  }
}

function findWorkspacePackages(repoRoot: string): WorkspacePackageRecord[] {
  const workspaces = ["packages", "agents", "adapters"];
  const found: WorkspacePackageRecord[] = [];

  for (const workspace of workspaces) {
    const workspaceRoot = join(repoRoot, workspace);
    if (!existsSync(workspaceRoot)) {
      continue;
    }

    for (const entry of readdirSync(workspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageRoot = join(workspaceRoot, entry.name);
      const manifestPath = join(packageRoot, "package.json");
      if (!existsSync(manifestPath)) {
        continue;
      }

      const manifest = readJson(manifestPath);
      if (typeof manifest.name !== "string" || manifest.name.length === 0) {
        continue;
      }

      found.push({
        name: manifest.name,
        root: packageRoot,
        manifest
      });
    }
  }

  return found;
}

function resolveModuleEntrypoint(workspacePackage: WorkspacePackageRecord): string {
  const exportsRecord =
    isRecord(workspacePackage.manifest.exports) && isRecord(workspacePackage.manifest.exports["."])
      ? (workspacePackage.manifest.exports["."] as Record<string, unknown>)
      : undefined;
  const candidateEntries = [
    typeof exportsRecord?.default === "string" ? exportsRecord.default : undefined,
    typeof workspacePackage.manifest.module === "string" ? workspacePackage.manifest.module : undefined,
    typeof workspacePackage.manifest.main === "string" ? workspacePackage.manifest.main : undefined,
    "dist/index.js",
    "src/index.ts"
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidateEntries) {
    const resolvedPath = resolve(workspacePackage.root, candidate);
    if (existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  throw new Error(`No loadable entrypoint found for ${workspacePackage.name}`);
}

function readAgentForgeVersion(repoRoot: string): string {
  const cliManifestPath = join(repoRoot, "packages", "cli", "package.json");
  if (existsSync(cliManifestPath)) {
    const cliManifest = readJson(cliManifestPath);
    if (typeof cliManifest.version === "string" && cliManifest.version.length > 0) {
      return cliManifest.version;
    }
  }

  const rootManifestPath = join(repoRoot, "package.json");
  const rootManifest = readJson(rootManifestPath);
  if (typeof rootManifest.version === "string" && rootManifest.version.length > 0) {
    return rootManifest.version;
  }

  throw new Error(`Unable to resolve the local AgentForge version from ${repoRoot}`);
}

function evaluateCatalogEntryCompatibility(
  entry: RegistryPluginCatalogEntry,
  options: Required<Pick<RegistryDiscoveryOptions, "agentforgeVersion" | "manifestVersion">> &
    Pick<RegistryDiscoveryOptions, "workflowDomain" | "pluginType">
): RegistryDiscoveryResult {
  const issues: RegistryCompatibilityIssue[] = [];
  const versionCheck = matchesVersionRange(options.agentforgeVersion, entry.compatibility.agentforgeVersionRange);

  if (!versionCheck.supported) {
    issues.push({
      code: "agentforge_version_range_unsupported",
      message: `Unsupported AgentForge version range syntax: ${entry.compatibility.agentforgeVersionRange}`
    });
  } else if (!versionCheck.matches) {
    issues.push({
      code: "agentforge_version_incompatible",
      message: `AgentForge ${options.agentforgeVersion} does not satisfy ${entry.compatibility.agentforgeVersionRange}`
    });
  }

  if (entry.compatibility.manifestVersion !== options.manifestVersion) {
    issues.push({
      code: "manifest_version_incompatible",
      message: `Manifest version ${entry.compatibility.manifestVersion} does not match expected ${options.manifestVersion}`
    });
  }

  if (options.workflowDomain && !entry.compatibility.supportedWorkflowDomains.includes(options.workflowDomain)) {
    issues.push({
      code: "workflow_domain_not_supported",
      message: `Plugin does not declare support for the ${options.workflowDomain} workflow domain`
    });
  }

  if (options.pluginType && entry.pluginType !== options.pluginType) {
    issues.push({
      code: "plugin_type_mismatch",
      message: `Plugin type ${entry.pluginType} does not match requested ${options.pluginType}`
    });
  }

  return {
    entry,
    compatible: issues.length === 0,
    issues
  };
}

function createActivationAuditEntry(
  decision: Pick<RegistryActivationDecision, "entry" | "policyDecision" | "activated">
): AuditEntry {
  const timestamp = new Date().toISOString();
  const blockedReason = decision.policyDecision.reason ? [decision.policyDecision.reason] : [];

  return {
    id: `plugin-activation-${decision.entry.id}`,
    nodeId: `plugin-activation:${decision.entry.id}`,
    nodeName: decision.entry.displayName,
    kind: "deterministic",
    startedAt: timestamp,
    completedAt: timestamp,
    status: decision.activated ? "success" : "blocked",
    summary: decision.activated
      ? `Activated catalog plugin ${decision.entry.displayName}`
      : `Did not activate catalog plugin ${decision.entry.displayName}`,
    toolsRequested: [],
    toolsExecuted: [],
    blockedActions: blockedReason,
    validationPassed: decision.activated
  };
}

function isRuntimeAgent(value: unknown): value is RuntimeAgent {
  if (!isRecord(value)) {
    return false;
  }

  return isRecord(value.manifest) && typeof value.execute === "function" && "outputSchema" in value;
}

function pickRuntimeAgent(moduleValue: unknown): RuntimeAgent | undefined {
  if (isRuntimeAgent(moduleValue)) {
    return moduleValue;
  }

  if (!isRecord(moduleValue)) {
    return undefined;
  }

  if (isRuntimeAgent(moduleValue.default)) {
    return moduleValue.default;
  }

  if (isRuntimeAgent(moduleValue.agent)) {
    return moduleValue.agent;
  }

  return Object.values(moduleValue).find((candidate): candidate is RuntimeAgent => isRuntimeAgent(candidate));
}

export class RegistryClient {
  constructor(private readonly repoRoot: string) {}

  async listOfficialAgents(): Promise<string[]> {
    return ["context-collector", "code-review", "security-audit", "test-generation"];
  }

  validateCatalog(catalog: unknown): RegistryPluginCatalog {
    return registryPluginCatalogSchema.parse(catalog);
  }

  loadCatalogFromFile(catalogPath: string): RegistryPluginCatalog {
    return this.validateCatalog(readJson(resolve(this.repoRoot, catalogPath)));
  }

  discoverCatalogEntries(catalog: unknown, options: RegistryDiscoveryOptions = {}): RegistryDiscoveryResult[] {
    const parsedCatalog = this.validateCatalog(catalog);
    const resolvedOptions = {
      agentforgeVersion: options.agentforgeVersion ?? readAgentForgeVersion(this.repoRoot),
      manifestVersion: options.manifestVersion ?? CURRENT_AGENT_MANIFEST_VERSION,
      workflowDomain: options.workflowDomain,
      pluginType: options.pluginType
    };
    const results = parsedCatalog.entries.map((entry) => evaluateCatalogEntryCompatibility(entry, resolvedOptions));

    if (options.includeIncompatible) {
      return results;
    }

    return results.filter((entry) => entry.compatible);
  }

  discoverCatalogEntriesFromFile(catalogPath: string, options: RegistryDiscoveryOptions = {}): RegistryDiscoveryResult[] {
    return this.discoverCatalogEntries(this.loadCatalogFromFile(catalogPath), options);
  }

  prepareCatalogAgentActivation(
    entry: RegistryPluginCatalogEntry,
    policy: RegistryActivationPolicyEvaluator,
    options: RegistryActivationOptions = {}
  ): RegistryActivationDecision {
    const compatibility = evaluateCatalogEntryCompatibility(entry, {
      agentforgeVersion: options.agentforgeVersion ?? readAgentForgeVersion(this.repoRoot),
      manifestVersion: options.manifestVersion ?? CURRENT_AGENT_MANIFEST_VERSION,
      workflowDomain: options.workflowDomain,
      pluginType: "agent"
    });
    const policyDecision = policy.evaluatePluginActivation(entry.displayName, entry.trust, {
      activationSupport: entry.distribution.activationSupport,
      compatibilityIssues: compatibility.issues,
      approvalGranted: options.approvalGranted
    });
    const activated = policyDecision.allowed && !policyDecision.requiresApproval;
    const decision = {
      entry,
      compatibility,
      policyDecision,
      activated
    };

    return {
      ...decision,
      auditEntry: createActivationAuditEntry(decision)
    };
  }

  async activateCatalogAgentPlugin(
    entry: RegistryPluginCatalogEntry,
    policy: RegistryActivationPolicyEvaluator,
    options: RegistryActivationOptions = {}
  ): Promise<{ decision: RegistryActivationDecision; agent?: RuntimeAgent }> {
    const decision = this.prepareCatalogAgentActivation(entry, policy, options);
    if (!decision.activated) {
      return { decision };
    }

    const agent = await this.loadLocalAgentPlugin(entry.distribution.packageName);
    return { decision, agent };
  }

  listWorkspacePackages(): WorkspacePackageRecord[] {
    return findWorkspacePackages(this.repoRoot);
  }

  async loadLocalAgentPlugin(packageName: string): Promise<RuntimeAgent> {
    const workspacePackage = this.listWorkspacePackages().find((candidate) => candidate.name === packageName);

    if (!workspacePackage) {
      throw new Error(`Plugin package is not a local workspace package: ${packageName}`);
    }

    const entrypoint = resolveModuleEntrypoint(workspacePackage);
    const imported = await import(pathToFileURL(entrypoint).href);
    const agent = pickRuntimeAgent(imported);

    if (!agent) {
      throw new Error(`Plugin package does not export a RuntimeAgent: ${packageName}`);
    }

    return {
      ...agent,
      manifest: agentManifestSchema.parse(agent.manifest)
    };
  }
}
