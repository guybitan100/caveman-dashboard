import { describe, expect, it } from 'vitest';

import { calculateBudget } from './budgetEngine';

describe('calculateBudget', () => {
  it('uses the dominant context estimate for budget pressure', () => {
    const result = calculateBudget(31_700, 128_000, {
      currentFileTokens: 8_420,
      openFilesTokens: 31_700,
      workspaceTokens: 112_900
    });

    expect(result.usedTokens).toBe(112_900);
    expect(result.usagePercent).toBeCloseTo(88.2, 1);
    expect(result.risk).toBe('high');
  });

  it('adds retrieval amplification and respects configurable thresholds', () => {
    const medium = calculateBudget(31_700, 80_000, {
      currentFileTokens: 8_420,
      openFilesTokens: 31_700,
      estimatedRetrievalTokens: 15_000,
      warningThresholdPercent: 60,
      criticalThresholdPercent: 80
    });

    expect(medium.usedTokens).toBe(46_700);
    expect(medium.risk).toBe('medium');

    const critical = calculateBudget(100, 100, {
      warningThresholdPercent: 60,
      criticalThresholdPercent: 80
    });

    expect(critical.risk).toBe('critical');
  });
});