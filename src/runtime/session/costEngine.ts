import { CostEstimate, ModelProfile } from './sessionModels';
import { MODEL_PRICING } from './modelPricing';

export interface RuntimeCostInput {
  model: string;
  promptTokens: number;
  completionTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
}

export const modelProfiles: readonly ModelProfile[] = MODEL_PRICING.map(entry => ({
  name: entry.model,
  contextWindow: entry.contextWindow,
  pricing: {
    input: entry.inputPerMillion / 1_000_000,
    output: entry.outputPerMillion / 1_000_000,
    cache: entry.cachePerMillion / 1_000_000,
    creditMultiplier: entry.creditMultiplier
  }
}));

export function selectModelProfile(totalContextTokens: number): ModelProfile {
  if (totalContextTokens > 400_000) {
    return modelProfiles[3];
  }

  if (totalContextTokens > 120_000) {
    return modelProfiles[2];
  }

  if (totalContextTokens > 40_000) {
    return modelProfiles[1];
  }

  return modelProfiles[0];
}

export function estimateRuntimeCost(input: RuntimeCostInput): CostEstimate {
  const profile = resolveModelProfile(input.model);
  const promptTokens = Math.max(0, Math.round(input.promptTokens));
  const completionTokens = Math.max(0, Math.round(input.completionTokens));
  const cacheReadTokens = Math.max(0, Math.round(input.cacheReadTokens));
  const nonCachedPromptTokens = Math.max(promptTokens - cacheReadTokens, 0);
  const inputCost = nonCachedPromptTokens * profile.pricing.input;
  const outputCost = completionTokens * profile.pricing.output;
  const cacheReadCost = cacheReadTokens * profile.pricing.cache;
  const cacheSavings = cacheReadTokens * Math.max(profile.pricing.input - profile.pricing.cache, 0);
  const estimatedCost = roundTo(Math.max(inputCost + outputCost + cacheReadCost, 0), 4);

  return {
    estimatedCost,
    credits: roundTo(estimatedCost * profile.pricing.creditMultiplier, 2),
    cacheSavings: roundTo(cacheSavings, 4)
  };
}

function resolveModelProfile(modelName: string): ModelProfile {
  return modelProfiles.find(profile => profile.name === modelName) ?? modelProfiles[0];
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}