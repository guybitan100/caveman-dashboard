import { describe, expect, it } from 'vitest';

import { compareSnapshots } from './diffEngine';
import { RuntimeSnapshot } from './runtimeComparison';

describe('runtime diff engine', () => {
  it('calculates summary deltas and regression signals between snapshots', () => {
    const baseline = buildSnapshot({
      id: '2026-06-07T10-17-00',
      createdAt: '2026-06-07T10:17:00Z',
      summary: {
        totalTokens: 25_263,
        promptTokens: 21_000,
        completionTokens: 4_263,
        cacheTokens: 9_120,
        cacheEfficiency: 36.1,
        retrievalAmplification: 12.5,
        contextHealth: 72,
        promptStability: 64,
        runtimeCost: 1.37,
        credits: 137,
        modelUsage: [{ model: 'GPT-5.4', cost: 1.37, percent: 100 }]
      },
      files: [
        fileMetric('src/agent.yaml', { tokens: 4_000, findings: 2, risk: 'medium', amplificationScore: 6.1 }),
        fileMetric('src/skills/support.prompt', { tokens: 3_000, findings: 1, risk: 'low', cacheEfficiency: 58, promptEntropy: 21 })
      ]
    });
    const current = buildSnapshot({
      id: '2026-06-08T10-58-56',
      createdAt: '2026-06-08T10:58:56Z',
      summary: {
        totalTokens: 31_880,
        promptTokens: 26_400,
        completionTokens: 5_480,
        cacheTokens: 12_300,
        cacheEfficiency: 52.4,
        retrievalAmplification: 9.2,
        contextHealth: 68,
        promptStability: 57,
        runtimeCost: 1.92,
        credits: 192,
        modelUsage: [{ model: 'GPT-5.4', cost: 1.92, percent: 100 }]
      },
      files: [
        fileMetric('src/agent.yaml', { tokens: 8_200, findings: 8, risk: 'high', amplificationScore: 8.4 }),
        fileMetric('src/skills/support.prompt', { tokens: 3_900, findings: 2, risk: 'high', cacheEfficiency: 40, promptEntropy: 43 })
      ]
    });

    const comparison = compareSnapshots(baseline, current);

    expect(comparison.summary.totalTokens).toMatchObject({
      before: 25_263,
      after: 31_880,
      change: 6_617,
      changePercent: 26.2
    });
    expect(comparison.summary.runtimeCost).toMatchObject({
      before: 1.37,
      after: 1.92,
      change: 0.55,
      changePercent: 40.1
    });
    expect(comparison.summary.cacheEfficiency.change).toBe(16.3);
    expect(comparison.summary.retrievalAmplification.change).toBe(-3.3);
    expect(comparison.regressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'runtimeCost' }),
        expect.objectContaining({ metric: 'contextHealth' }),
        expect.objectContaining({ metric: 'promptStability' })
      ])
    );
    expect(comparison.recommendations).toContain('Review model mix and context growth because spend increased faster than baseline.');
  });

  it('surfaces the highest file-level regressions and improvements', () => {
    const comparison = compareSnapshots(
      buildSnapshot({
        id: 'baseline',
        createdAt: '2026-06-07T10:17:00Z',
        files: [
          fileMetric('src/agent.yaml', { tokens: 4_000, findings: 2, risk: 'medium', amplificationScore: 4.2 }),
          fileMetric('src/core/passes/retrieval/retrievalRiskPass.ts', { tokens: 2_100, findings: 3, risk: 'high', amplificationScore: 7.2, cacheEfficiency: 33 }),
          fileMetric('src/skills/support.prompt', { tokens: 3_600, findings: 5, risk: 'high', amplificationScore: 5.4, cacheEfficiency: 41 })
        ]
      }),
      buildSnapshot({
        id: 'current',
        createdAt: '2026-06-08T10:58:56Z',
        files: [
          fileMetric('src/agent.yaml', { tokens: 8_200, findings: 8, risk: 'high', amplificationScore: 7.6 }),
          fileMetric('src/core/passes/retrieval/retrievalRiskPass.ts', { tokens: 2_000, findings: 1, risk: 'medium', amplificationScore: 4.1, cacheEfficiency: 48 }),
          fileMetric('src/skills/support.prompt', { tokens: 3_000, findings: 2, risk: 'medium', amplificationScore: 2.1, cacheEfficiency: 60 })
        ]
      })
    );

    expect(comparison.highestRegressions[0]).toMatchObject({
      path: 'src/agent.yaml',
      riskChanged: true,
      tokenDelta: expect.objectContaining({ change: 4_200 }),
      findingsDelta: expect.objectContaining({ change: 6 })
    });
    expect(comparison.highestImprovements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'src/core/passes/retrieval/retrievalRiskPass.ts' }),
        expect.objectContaining({ path: 'src/skills/support.prompt' })
      ])
    );
  });
});

function buildSnapshot(overrides: Partial<RuntimeSnapshot>): RuntimeSnapshot {
  return {
    id: overrides.id ?? 'snapshot',
    createdAt: overrides.createdAt ?? '2026-06-08T10:58:56Z',
    workspace: overrides.workspace ?? 'token-lint',
    summary: {
      totalTokens: 25_263,
      promptTokens: 21_000,
      completionTokens: 4_263,
      cacheTokens: 9_120,
      cacheEfficiency: 36.1,
      retrievalAmplification: 12.5,
      contextHealth: 72,
      promptStability: 64,
      runtimeCost: 1.37,
      credits: 137,
      modelUsage: [{ model: 'GPT-5.4', cost: 1.37, percent: 100 }],
      ...overrides.summary
    },
    files: overrides.files ?? []
  };
}

function fileMetric(path: string, overrides: Partial<RuntimeSnapshot['files'][number]> = {}) {
  return {
    path,
    tokens: 2_100,
    findings: 3,
    risk: 'high' as const,
    retrievalRisk: 0.72,
    promptEntropy: 31,
    cacheEfficiency: 36,
    amplificationScore: 6.8,
    ...overrides
  };
}