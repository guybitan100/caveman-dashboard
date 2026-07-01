export type ClaudePricing = {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheReadPerMillion: number;
};

export type CostBreakdown = {
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  totalCost: number;
};

// Anthropic list prices per 1M tokens (current generation). Cache write (5m) is
// 1.25x input and cache read is 0.1x input per the prompt-caching pricing model.
const pricingByModel: Record<string, ClaudePricing> = {
  'opus': { inputPerMillion: 5, outputPerMillion: 25, cacheWritePerMillion: 6.25, cacheReadPerMillion: 0.5 },
  'sonnet': { inputPerMillion: 3, outputPerMillion: 15, cacheWritePerMillion: 3.75, cacheReadPerMillion: 0.3 },
  'haiku': { inputPerMillion: 1, outputPerMillion: 5, cacheWritePerMillion: 1.25, cacheReadPerMillion: 0.1 },
  'unknown': { inputPerMillion: 3, outputPerMillion: 15, cacheWritePerMillion: 3.75, cacheReadPerMillion: 0.3 }
};

function pricingFor(model: string): ClaudePricing {
  const key = Object.keys(pricingByModel).find(k => model.toLowerCase().includes(k)) ?? 'unknown';
  return pricingByModel[key];
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Estimated local cost broken down by token category. */
export function calculateCostBreakdown(model: string, input: number, output: number, cacheRead: number, cacheWrite: number): CostBreakdown {
  const p = pricingFor(model);
  const inputCost = (input / 1_000_000) * p.inputPerMillion;
  const outputCost = (output / 1_000_000) * p.outputPerMillion;
  const cacheReadCost = (cacheRead / 1_000_000) * p.cacheReadPerMillion;
  const cacheWriteCost = (cacheWrite / 1_000_000) * p.cacheWritePerMillion;
  return {
    inputCost: round4(inputCost),
    outputCost: round4(outputCost),
    cacheReadCost: round4(cacheReadCost),
    cacheWriteCost: round4(cacheWriteCost),
    totalCost: round4(inputCost + outputCost + cacheReadCost + cacheWriteCost),
  };
}
