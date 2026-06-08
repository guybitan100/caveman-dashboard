import { CostEstimate, ModelProfile } from './sessionModels';

export interface RuntimeCostInput {
  model: string;
  promptTokens: number;
  completionTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
}

export const modelProfiles: readonly ModelProfile[] = [
  {
    name: 'GPT-5.4',
    contextWindow: 192_000,
    pricing: {
      input: 5 / 1_000_000,
      output: 15 / 1_000_000,
      cache: 2 / 1_000_000
    }
  },
  {
    name: 'Claude Sonnet 4.6',
    contextWindow: 400_000,
    pricing: {
      input: 3 / 1_000_000,
      output: 15 / 1_000_000,
      cache: 0.8 / 1_000_000
    }
  },
  {
    name: 'Gemini 3.1',
    contextWindow: 1_000_000,
    pricing: {
      input: 2.5 / 1_000_000,
      output: 10 / 1_000_000,
      cache: 0.5 / 1_000_000
    }
  }
] as const;

export function selectModelProfile(totalContextTokens: number): ModelProfile {
  if (totalContextTokens > 250_000) {
    return modelProfiles[2];
  }

  if (totalContextTokens > 120_000) {
    return modelProfiles[1];
  }

  return modelProfiles[0];
}

export function estimateRuntimeCost(input: RuntimeCostInput): CostEstimate {
  const profile = resolveModelProfile(input.model);
  const promptTokens = Math.max(0, Math.round(input.promptTokens));
  const completionTokens = Math.max(0, Math.round(input.completionTokens));
  const cacheCreateTokens = Math.max(0, Math.round(input.cacheCreateTokens));
  const cacheReadTokens = Math.max(0, Math.round(input.cacheReadTokens));
  const inputCost = promptTokens * profile.pricing.input;
  const outputCost = completionTokens * profile.pricing.output;
  const cacheCreateCost = cacheCreateTokens * profile.pricing.cache;
  const cacheSavings = cacheReadTokens * Math.max(profile.pricing.input - profile.pricing.cache, 0) * 0.65;
  const estimatedCost = roundTo(Math.max(inputCost + outputCost + cacheCreateCost - cacheSavings, 0), 4);

  return {
    estimatedCost,
    credits: roundTo(estimatedCost * 100, 2),
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