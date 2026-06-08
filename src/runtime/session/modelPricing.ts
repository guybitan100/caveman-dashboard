export interface ModelPricingEntry {
  model: string;
  contextWindow: number;
  inputPerMillion: number;
  outputPerMillion: number;
  cachePerMillion: number;
  creditMultiplier: number;
}

export const MODEL_PRICING: readonly ModelPricingEntry[] = [
  {
    model: 'GPT-5 mini',
    contextWindow: 128_000,
    inputPerMillion: 0.25,
    outputPerMillion: 2,
    cachePerMillion: 0.07,
    creditMultiplier: 100
  },
  {
    model: 'GPT-5.4',
    contextWindow: 192_000,
    inputPerMillion: 2.5,
    outputPerMillion: 15,
    cachePerMillion: 0.25,
    creditMultiplier: 100
  },
  {
    model: 'Claude Sonnet 4.6',
    contextWindow: 400_000,
    inputPerMillion: 3,
    outputPerMillion: 15,
    cachePerMillion: 0.3,
    creditMultiplier: 100
  },
  {
    model: 'Gemini 3.1 Pro',
    contextWindow: 1_000_000,
    inputPerMillion: 1.25,
    outputPerMillion: 10,
    cachePerMillion: 0.2,
    creditMultiplier: 100
  }
] as const;