import { describe, expect, it } from 'vitest';

import { buildHistoryRetentionPlan } from './historyRetention';
import { RuntimeSnapshot } from './runtimeComparison';

describe('history retention', () => {
  it('drops snapshots that exceed age or count limits', () => {
    const now = Date.UTC(2026, 5, 8, 12, 0, 0);
    const snapshots = [
      snapshot('current', '2026-06-08T11:00:00Z'),
      snapshot('recent', '2026-06-07T11:00:00Z'),
      snapshot('old', '2026-05-01T10:00:00Z')
    ];

    const plan = buildHistoryRetentionPlan(snapshots, 7, 2, now);

    expect(plan.retained.map(item => item.id)).toEqual(['current', 'recent']);
    expect(plan.expiredIds).toEqual(['old']);
  });
});

function snapshot(id: string, createdAt: string): RuntimeSnapshot {
  return {
    id,
    createdAt,
    workspace: 'token-lint',
    summary: {
      totalTokens: 1,
      promptTokens: 1,
      completionTokens: 0,
      cacheTokens: 0,
      cacheEfficiency: 0,
      retrievalAmplification: 1,
      contextHealth: 100,
      promptStability: 100,
      runtimeCost: 0,
      credits: 0,
      modelUsage: []
    },
    files: []
  };
}
