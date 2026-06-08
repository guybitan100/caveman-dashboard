import { describe, expect, it } from 'vitest';

import { estimateRuntimeCost, selectModelProfile } from './costEngine';

describe('runtime cost engine', () => {
  it('selects model profiles by context size', () => {
    expect(selectModelProfile(82_000).name).toBe('GPT-5.4');
    expect(selectModelProfile(180_000).name).toBe('Claude Sonnet 4.6');
    expect(selectModelProfile(420_000).name).toBe('Gemini 3.1');
  });

  it('estimates cost, credits, and cache savings', () => {
    expect(estimateRuntimeCost({
      model: 'GPT-5.4',
      promptTokens: 48_000,
      completionTokens: 6_400,
      cacheCreateTokens: 14_000,
      cacheReadTokens: 18_000
    })).toEqual({
      estimatedCost: 0.3289,
      credits: 32.89,
      cacheSavings: 0.0351
    });
  });
});