import { describe, expect, it } from 'vitest';

import { calculateCacheInsight } from './cacheEngine';

describe('runtime cache engine', () => {
  it('reports strong reuse when file overlap is high', () => {
    const insight = calculateCacheInsight({
      promptTokens: 24_000,
      currentFiles: ['a.prompt', 'skill.yaml', 'memory.md'],
      previousFiles: ['a.prompt', 'skill.yaml', 'memory.md'],
      retrievalAmplification: 1.2
    });

    expect(insight.cacheIndicator).toBe('partial');
    expect(insight.promptStability).toBeGreaterThanOrEqual(80);
    expect(insight.promptStability).toBeLessThanOrEqual(90);
    expect(insight.cacheEfficiency).toBeGreaterThanOrEqual(35);
    expect(insight.cacheEfficiency).toBeLessThanOrEqual(45);
    expect(insight.cacheReadTokens).toBeGreaterThan(9_000);
    expect(insight.cacheCreateTokens).toBeLessThan(15_000);
  });

  it('drops cache efficiency when context churn and amplification increase', () => {
    const insight = calculateCacheInsight({
      promptTokens: 24_000,
      currentFiles: ['alpha.prompt', 'beta.prompt', 'gamma.yaml'],
      previousFiles: ['legacy.prompt'],
      retrievalAmplification: 4.5
    });

    expect(insight.cacheIndicator).toBe('none');
    expect(insight.promptStability).toBeLessThanOrEqual(20);
    expect(insight.cacheEfficiency).toBeLessThan(10);
    expect(insight.cacheReadTokens).toBeLessThan(2_000);
    expect(insight.cacheCreateTokens).toBeGreaterThan(22_000);
  });
});