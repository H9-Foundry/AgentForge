import { providerUsageAggregateSchema, providerUsageAggregateSummarySchema, providerUsageByModelSchema } from "@h9-foundry/agentforge-schemas";
import type {
  ProviderUsageAggregate,
  ProviderUsageAggregateSummary,
  ProviderUsageByModel,
  ProviderUsageNodeBreakdown,
  ProviderUsagePricing
} from "@h9-foundry/agentforge-shared-types";

interface LocalPricingEntry {
  readonly provider: string;
  readonly model: string;
  readonly metadata: ProviderUsagePricing;
}

interface RawProviderUsageInput {
  readonly provider?: string;
  readonly model?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly requestCount?: number;
  readonly raw?: unknown;
}

const localPricingRegistry = new Map<string, LocalPricingEntry>([
  [
    "openai:gpt-5.4",
    {
      provider: "openai",
      model: "gpt-5.4",
      metadata: {
        source: "local_registry",
        version: "openai-api-pricing-2026-03-24",
        effectiveDate: "2026-03-24",
        currency: "USD",
        inputCostPerMillionTokensUsd: 2.5,
        outputCostPerMillionTokensUsd: 15
      }
    }
  ]
]);

function pricingKey(provider: string, model: string): string {
  return `${provider.toLowerCase()}:${model.toLowerCase()}`;
}

function lookupPricing(provider: string, model: string): ProviderUsagePricing | undefined {
  return localPricingRegistry.get(pricingKey(provider, model))?.metadata;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function deriveCostStatus(entries: readonly { totalTokens: number; estimatedCostUsd?: number }[]): "estimated" | "partial" | "unavailable" {
  const measuredEntries = entries.filter((entry) => entry.totalTokens > 0);
  if (measuredEntries.length === 0) {
    return "unavailable";
  }

  const pricedEntries = measuredEntries.filter((entry) => typeof entry.estimatedCostUsd === "number");
  if (pricedEntries.length === 0) {
    return "unavailable";
  }

  return pricedEntries.length === measuredEntries.length ? "estimated" : "partial";
}

export function enrichProviderUsage(input: RawProviderUsageInput, fallbackProvider: string): ProviderUsageByModel {
  const provider = typeof input.provider === "string" && input.provider.trim().length > 0 ? input.provider.trim() : fallbackProvider;
  const model = typeof input.model === "string" && input.model.trim().length > 0 ? input.model.trim() : "unknown";
  const inputTokens = Math.max(0, Math.trunc(input.inputTokens ?? 0));
  const outputTokens = Math.max(0, Math.trunc(input.outputTokens ?? 0));
  const totalTokens = Math.max(0, Math.trunc(input.totalTokens ?? inputTokens + outputTokens));
  const requestCount = Math.max(0, Math.trunc(input.requestCount ?? 1));
  const pricing = lookupPricing(provider, model);
  const estimatedCostUsd =
    pricing
      ? roundUsd((inputTokens / 1_000_000) * pricing.inputCostPerMillionTokensUsd + (outputTokens / 1_000_000) * pricing.outputCostPerMillionTokensUsd)
      : undefined;

  return providerUsageByModelSchema.parse({
    provider,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    requestCount,
    estimatedCostUsd,
    costStatus: pricing ? "estimated" : "unavailable",
    pricing,
    raw: input.raw
  });
}

function mergeUsageByModel(entries: readonly ProviderUsageByModel[]): ProviderUsageByModel[] {
  const merged = new Map<string, ProviderUsageByModel>();

  for (const entry of entries) {
    const key = pricingKey(entry.provider, entry.model);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, providerUsageByModelSchema.parse(entry));
      continue;
    }

    merged.set(
      key,
      providerUsageByModelSchema.parse({
        provider: existing.provider,
        model: existing.model,
        inputTokens: existing.inputTokens + entry.inputTokens,
        outputTokens: existing.outputTokens + entry.outputTokens,
        totalTokens: existing.totalTokens + entry.totalTokens,
        requestCount: existing.requestCount + entry.requestCount,
        estimatedCostUsd:
          typeof existing.estimatedCostUsd === "number" || typeof entry.estimatedCostUsd === "number"
            ? roundUsd((existing.estimatedCostUsd ?? 0) + (entry.estimatedCostUsd ?? 0))
            : undefined,
        costStatus: deriveCostStatus([existing, entry]),
        pricing: existing.pricing ?? entry.pricing,
        raw: undefined
      })
    );
  }

  return [...merged.values()].sort(
    (left, right) => left.provider.localeCompare(right.provider) || left.model.localeCompare(right.model)
  );
}

export function buildProviderUsageSummary(entries: readonly ProviderUsageByModel[]): ProviderUsageAggregateSummary | undefined {
  if (entries.length === 0) {
    return undefined;
  }

  const byModel = mergeUsageByModel(entries);
  const totalEstimatedCostUsd = byModel.some((entry) => typeof entry.estimatedCostUsd === "number")
    ? roundUsd(byModel.reduce((total, entry) => total + (entry.estimatedCostUsd ?? 0), 0))
    : undefined;

  return providerUsageAggregateSummarySchema.parse({
    totalInputTokens: byModel.reduce((total, entry) => total + entry.inputTokens, 0),
    totalOutputTokens: byModel.reduce((total, entry) => total + entry.outputTokens, 0),
    totalTokens: byModel.reduce((total, entry) => total + entry.totalTokens, 0),
    totalRequests: byModel.reduce((total, entry) => total + entry.requestCount, 0),
    totalEstimatedCostUsd,
    costStatus: deriveCostStatus(byModel),
    byModel
  });
}

export function buildProviderUsageAggregate(byNode: readonly ProviderUsageNodeBreakdown[]): ProviderUsageAggregate | undefined {
  if (byNode.length === 0) {
    return undefined;
  }

  const summary = buildProviderUsageSummary(byNode.flatMap((entry) => entry.byModel));
  if (!summary) {
    return undefined;
  }

  return providerUsageAggregateSchema.parse({
    ...summary,
    byNode
  });
}
