import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import yaml from "js-yaml";
import picomatch from "picomatch";

import { lifecycleArtifactSchema, policyDocumentSchema } from "@h9-foundry/agentforge-schemas";
import type {
  EffectivePolicySnapshot,
  ExecutionEnvironment,
  LifecycleArtifact,
  PolicyDocument,
  TrustMetadata,
  ToolRequest
} from "@h9-foundry/agentforge-shared-types";

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly effect: "allow" | "deny" | "approval_required";
  readonly requiresApproval: boolean;
  readonly reason?: string;
}

export interface PluginActivationDecisionOptions {
  readonly distributionChannel?: "manual" | "npm";
  readonly activationSupport: "not-supported" | "approval-required";
  readonly verificationMode?: "none" | "checksum" | "attestation";
  readonly verificationEvidenceRefs?: readonly string[];
  readonly compatibilityIssues?: readonly { readonly message: string }[];
  readonly approvalGranted?: boolean;
}

function normalizeToolConfig(toolConfig: unknown): unknown {
  if (!toolConfig || typeof toolConfig !== "object") return toolConfig;
  const record = toolConfig as Record<string, unknown>;
  return {
    effect: record.effect,
    allowedCommands: record.allowed_commands ?? record.allowedCommands,
    allowedPaths: record.allowed_paths ?? record.allowedPaths,
    allowedHosts: record.allowed_hosts ?? record.allowedHosts
  };
}

function normalizePolicyInput(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const overlays = record.overlays as Record<string, unknown> | undefined;
  const normalizeOverlay = (overlay: unknown): unknown => {
    if (!overlay || typeof overlay !== "object") return overlay;
    const overlayRecord = overlay as Record<string, unknown>;
    return {
      defaults: overlayRecord.defaults
        ? {
            executionMode:
              (overlayRecord.defaults as Record<string, unknown>).execution_mode ??
              (overlayRecord.defaults as Record<string, unknown>).executionMode,
            modelAccess:
              (overlayRecord.defaults as Record<string, unknown>).model_access ??
              (overlayRecord.defaults as Record<string, unknown>).modelAccess,
            network: (overlayRecord.defaults as Record<string, unknown>).network,
            writes: (overlayRecord.defaults as Record<string, unknown>).writes
          }
        : undefined,
      paths: overlayRecord.paths
        ? {
            allowedRead:
              (overlayRecord.paths as Record<string, unknown>).allowed_read ??
              (overlayRecord.paths as Record<string, unknown>).allowedRead,
            allowedWrite:
              (overlayRecord.paths as Record<string, unknown>).allowed_write ??
              (overlayRecord.paths as Record<string, unknown>).allowedWrite,
            blocked: (overlayRecord.paths as Record<string, unknown>).blocked
          }
        : undefined,
      plugins: overlayRecord.plugins
        ? {
            allowedTiers:
              (overlayRecord.plugins as Record<string, unknown>).allowed_tiers ??
              (overlayRecord.plugins as Record<string, unknown>).allowedTiers,
            allowedSources:
              (overlayRecord.plugins as Record<string, unknown>).allowed_sources ??
              (overlayRecord.plugins as Record<string, unknown>).allowedSources,
            requireReviewed:
              (overlayRecord.plugins as Record<string, unknown>).require_reviewed ??
              (overlayRecord.plugins as Record<string, unknown>).requireReviewed
          }
        : undefined,
      tools: overlayRecord.tools
        ? Object.fromEntries(
            Object.entries(overlayRecord.tools as Record<string, unknown>).map(([name, config]) => [
              name,
              normalizeToolConfig(config)
            ])
          )
        : undefined
    };
  };

  return {
    version: record.version,
    defaults: {
      executionMode: (record.defaults as Record<string, unknown>)?.execution_mode ?? (record.defaults as Record<string, unknown>)?.executionMode,
      modelAccess: (record.defaults as Record<string, unknown>)?.model_access ?? (record.defaults as Record<string, unknown>)?.modelAccess,
      network: (record.defaults as Record<string, unknown>)?.network,
      writes: (record.defaults as Record<string, unknown>)?.writes
    },
    paths: {
      allowedRead: (record.paths as Record<string, unknown>)?.allowed_read ?? (record.paths as Record<string, unknown>)?.allowedRead,
      allowedWrite: (record.paths as Record<string, unknown>)?.allowed_write ?? (record.paths as Record<string, unknown>)?.allowedWrite,
      blocked: (record.paths as Record<string, unknown>)?.blocked
    },
    plugins: {
      allowedTiers: (record.plugins as Record<string, unknown>)?.allowed_tiers ?? (record.plugins as Record<string, unknown>)?.allowedTiers,
      allowedSources:
        (record.plugins as Record<string, unknown>)?.allowed_sources ?? (record.plugins as Record<string, unknown>)?.allowedSources,
      requireReviewed:
        (record.plugins as Record<string, unknown>)?.require_reviewed ?? (record.plugins as Record<string, unknown>)?.requireReviewed
    },
    tools: record.tools
      ? Object.fromEntries(
          Object.entries(record.tools as Record<string, unknown>).map(([name, config]) => [name, normalizeToolConfig(config)])
        )
      : {},
    overlays: {
      local: normalizeOverlay(overlays?.local),
      ci: normalizeOverlay(overlays?.ci)
    }
  };
}

function mergePolicy(base: PolicyDocument, environment: ExecutionEnvironment): EffectivePolicySnapshot {
  const overlay = base.overlays?.[environment];
  return {
    version: base.version,
    environment,
    resolvedAt: new Date().toISOString(),
    defaults: {
      executionMode: overlay?.defaults?.executionMode ?? base.defaults.executionMode,
      modelAccess: overlay?.defaults?.modelAccess ?? base.defaults.modelAccess,
      network: overlay?.defaults?.network ?? base.defaults.network,
      writes: overlay?.defaults?.writes ?? base.defaults.writes
    },
    paths: {
      allowedRead: overlay?.paths?.allowedRead ?? base.paths.allowedRead,
      allowedWrite: overlay?.paths?.allowedWrite ?? base.paths.allowedWrite,
      blocked: overlay?.paths?.blocked ?? base.paths.blocked
    },
    plugins: {
      allowedTiers: overlay?.plugins?.allowedTiers ?? base.plugins.allowedTiers,
      allowedSources: overlay?.plugins?.allowedSources ?? base.plugins.allowedSources,
      requireReviewed: overlay?.plugins?.requireReviewed ?? base.plugins.requireReviewed
    },
    tools: {
      ...base.tools,
      ...(overlay?.tools ?? {})
    }
  };
}

function normalizePath(inputPath: string): string {
  return inputPath.replaceAll("\\", "/");
}

function resolveRepoPath(repoRoot: string, pathValue: string): { relativePath: string; insideRepo: boolean } {
  const absolutePath = isAbsolute(pathValue) ? resolve(pathValue) : resolve(repoRoot, pathValue);
  const relativePath = normalizePath(relative(repoRoot, absolutePath));
  const insideRepo = relativePath === "" || (!relativePath.startsWith("..") && relativePath !== "..");
  return {
    relativePath: relativePath || ".",
    insideRepo
  };
}

function matchesAny(pathValue: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    const matcher = picomatch(pattern);
    return matcher(pathValue) || (pathValue.startsWith(".") && pattern.startsWith("**") ? matcher(pathValue.slice(1)) : false);
  });
}

function sanitizeUnknown(value: unknown, redactSecrets: (value: string) => string): unknown {
  if (typeof value === "string") {
    return redactSecrets(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeUnknown(entry, redactSecrets));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeUnknown(entry, redactSecrets)])
    );
  }

  return value;
}

export function loadPolicyDocument(policyPath: string): PolicyDocument {
  const fileContents = readFileSync(policyPath, "utf8");
  const parsed = yaml.load(fileContents);
  return policyDocumentSchema.parse(normalizePolicyInput(parsed));
}

export function resolvePolicy(policy: PolicyDocument, environment: ExecutionEnvironment): EffectivePolicySnapshot {
  return mergePolicy(policy, environment);
}

export function createPolicyEngine(policy: EffectivePolicySnapshot, repoRoot: string) {
  function evaluatePath(pathValue: string, effect: "read" | "write"): PolicyDecision {
    const { relativePath, insideRepo } = resolveRepoPath(repoRoot, pathValue);

    if (!insideRepo) {
      return { allowed: false, effect: "deny", requiresApproval: false, reason: `Path escapes repository root: ${pathValue}` };
    }

    const blocked = matchesAny(relativePath, policy.paths.blocked);

    if (blocked) {
      return { allowed: false, effect: "deny", requiresApproval: false, reason: `Blocked path: ${relativePath}` };
    }

    const allowedPatterns = effect === "read" ? policy.paths.allowedRead : policy.paths.allowedWrite;
    const allowed = matchesAny(relativePath, allowedPatterns);
    if (!allowed) {
      return { allowed: false, effect: "deny", requiresApproval: false, reason: `Path not allowed: ${relativePath}` };
    }

    if (effect === "write" && policy.defaults.writes === "approval_required") {
      return { allowed: true, effect: "approval_required", requiresApproval: true, reason: "Write requires approval." };
    }

    return { allowed: true, effect: "allow", requiresApproval: false };
  }

  function evaluateToolRequest(request: ToolRequest): PolicyDecision {
    const toolPolicy = policy.tools[request.tool];

    if (!toolPolicy) {
      return { allowed: false, effect: "deny", requiresApproval: false, reason: `Tool not permitted: ${request.tool}` };
    }

    if (toolPolicy.effect === "deny") {
      return { allowed: false, effect: "deny", requiresApproval: false, reason: `Tool denied by policy: ${request.tool}` };
    }

    return {
      allowed: true,
      effect: toolPolicy.effect,
      requiresApproval: toolPolicy.effect === "approval_required",
      reason: toolPolicy.effect === "approval_required" ? `Tool requires approval: ${request.tool}` : undefined
    };
  }

  function evaluatePluginTrust(name: string, trust: TrustMetadata): PolicyDecision {
    if (!policy.plugins.allowedTiers.includes(trust.tier)) {
      return {
        allowed: false,
        effect: "deny",
        requiresApproval: false,
        reason: `Plugin trust tier denied for ${name}: ${trust.tier}`
      };
    }

    if (!policy.plugins.allowedSources.includes(trust.source)) {
      return {
        allowed: false,
        effect: "deny",
        requiresApproval: false,
        reason: `Plugin trust source denied for ${name}: ${trust.source}`
      };
    }

    if (policy.plugins.requireReviewed && !trust.reviewed) {
      return {
        allowed: false,
        effect: "deny",
        requiresApproval: false,
        reason: `Plugin review required for ${name}`
      };
    }

    return { allowed: true, effect: "allow", requiresApproval: false };
  }

  function evaluatePluginActivation(name: string, trust: TrustMetadata, options: PluginActivationDecisionOptions): PolicyDecision {
    const trustDecision = evaluatePluginTrust(name, trust);
    if (!trustDecision.allowed) {
      return trustDecision;
    }

    if ((options.compatibilityIssues?.length ?? 0) > 0) {
      return {
        allowed: false,
        effect: "deny",
        requiresApproval: false,
        reason: `Plugin compatibility check failed for ${name}: ${options.compatibilityIssues?.[0]?.message ?? "Unknown incompatibility"}`
      };
    }

    if (
      options.distributionChannel &&
      options.distributionChannel !== "manual" &&
      (options.verificationMode === "none" || (options.verificationEvidenceRefs?.length ?? 0) === 0)
    ) {
      return {
        allowed: false,
        effect: "deny",
        requiresApproval: false,
        reason: `Plugin distribution verification is required for ${name} before non-manual activation`
      };
    }

    if (options.activationSupport === "not-supported") {
      return {
        allowed: false,
        effect: "deny",
        requiresApproval: false,
        reason: `Plugin activation is not supported for ${name}`
      };
    }

    if (!options.approvalGranted) {
      return {
        allowed: true,
        effect: "approval_required",
        requiresApproval: true,
        reason: `Plugin activation requires approval for ${name}`
      };
    }

    return { allowed: true, effect: "allow", requiresApproval: false };
  }

  function redactSecrets(value: string): string {
    return value
      .replaceAll(/github_pat_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]")
      .replaceAll(/gh[pousr]_[A-Za-z0-9]{12,}/g, "[REDACTED_GITHUB_TOKEN]")
      .replaceAll(/sk-[A-Za-z0-9]{12,}/g, "[REDACTED_API_KEY]")
      .replaceAll(/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_KEY]")
      .replaceAll(/Bearer\s+[A-Za-z0-9._-]{12,}/gi, "Bearer [REDACTED_TOKEN]")
      .replaceAll(/(?<=password[:=])[^\s&]+/gi, "[REDACTED_PASSWORD]")
      .replaceAll(/(?<=token[:=])[^\s&]+/gi, "[REDACTED_TOKEN]")
      .replaceAll(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]");
  }

  function sanitizeLifecycleArtifact(artifact: LifecycleArtifact): LifecycleArtifact {
    const sanitized = lifecycleArtifactSchema.parse(sanitizeUnknown(artifact, redactSecrets));
    const additionalCategories =
      sanitized.artifactKind === "security-report"
        ? ["security-sensitive"]
        : sanitized.artifactKind === "incident-brief"
          ? ["operational-sensitive"]
          : [];

    if (additionalCategories.length === 0) {
      return sanitized;
    }

    return lifecycleArtifactSchema.parse({
      ...sanitized,
      redaction: {
        ...sanitized.redaction,
        categories: Array.from(new Set([...sanitized.redaction.categories, ...additionalCategories]))
      }
    });
  }

  return {
    snapshot: policy,
    canReadPath(pathValue: string): PolicyDecision {
      return evaluatePath(pathValue, "read");
    },
    canWritePath(pathValue: string): PolicyDecision {
      return evaluatePath(pathValue, "write");
    },
    evaluatePluginTrust,
    evaluatePluginActivation,
    evaluateToolRequest,
    filterBlockedPaths(paths: readonly string[]): string[] {
      return paths.filter((pathValue) => evaluatePath(pathValue, "read").allowed);
    },
    redactSecrets,
    sanitizeLifecycleArtifact
  };
}
