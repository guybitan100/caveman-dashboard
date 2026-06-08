import { beforeEach, describe, expect, it } from 'vitest';

import { RuntimeSessionManager } from './sessionManager';
import { SessionTelemetry } from './sessionModels';
import { RuntimeSessionStore } from './sessionStore';

function createMemoryStore() {
  const state = new Map<string, unknown>();

  return {
    get<T>(key: string, defaultValue: T): T {
      return (state.get(key) as T | undefined) ?? defaultValue;
    },
    async update(key: string, value: unknown): Promise<void> {
      state.set(key, value);
    }
  };
}

function buildTelemetry(overrides: Partial<SessionTelemetry> = {}): SessionTelemetry {
  const baseTime = Date.now();

  return {
    workspace: 'token-lint',
    title: 'New session - prompt',
    startedAt: baseTime - 120_000,
    endedAt: baseTime - 60_000,
    model: 'GPT-5.4',
    contextWindow: 192_000,
    promptTokens: 18_000,
    completionTokens: 3_600,
    cacheCreateTokens: 9_000,
    cacheReadTokens: 4_500,
    requests: 1,
    estimatedCost: 0.14,
    credits: 14,
    cacheSavings: 0.03,
    cacheEfficiency: 25,
    files: ['prompt.md', 'skill.yaml'],
    retrievalFiles: ['rag-config.yaml'],
    promptFiles: ['prompt.md'],
    skills: ['skill.yaml'],
    mcpConfigs: ['mcp.json'],
    retrievalAmplification: 2.4,
    contextPressure: 41.7,
    promptStability: 54,
    latencyMs: 980,
    risk: 'medium',
    source: 'simulated',
    ...overrides
  };
}

describe('runtime session manager', () => {
  let manager: RuntimeSessionManager;

  beforeEach(() => {
    manager = new RuntimeSessionManager(new RuntimeSessionStore(createMemoryStore()), 15 * 60 * 1000);
  });

  it('merges nearby telemetry into one session and accumulates runtime totals', async () => {
    await manager.recordTelemetry(buildTelemetry());
    await manager.recordTelemetry(buildTelemetry({
      startedAt: Date.now() - 30_000,
      endedAt: Date.now() - 10_000,
      promptTokens: 12_000,
      completionTokens: 2_000,
      cacheCreateTokens: 4_000,
      cacheReadTokens: 5_000,
      estimatedCost: 0.08,
      credits: 8,
      cacheSavings: 0.01,
      cacheEfficiency: 41.7,
      files: ['prompt.md', 'workflow.yaml'],
      promptFiles: ['prompt.md', 'workflow.yaml'],
      retrievalAmplification: 1.8,
      contextPressure: 52.4,
      promptStability: 63,
      latencyMs: 860,
      risk: 'high'
    }));

    const state = manager.getDashboardState();

    expect(state.sessions).toHaveLength(1);
    expect(state.latestSession).toMatchObject({
      requests: 2,
      promptTokens: 30_000,
      completionTokens: 5_600,
      cacheCreateTokens: 13_000,
      cacheReadTokens: 9_500,
      estimatedCost: 0.22,
      credits: 22,
      cacheSavings: 0.04,
      cacheEfficiency: 73.1,
      files: ['prompt.md', 'skill.yaml', 'workflow.yaml'],
      retrievalAmplification: 2.1,
      promptStability: 58.5,
      latencyMs: 920,
      risk: 'high'
    });
    expect(state.summary).toMatchObject({
      sessions: 1,
      totalCost: 0.22,
      totalCredits: 22,
      averageCacheEfficiency: 73.1,
      estimatedSavings: 0.04,
      reasoningRisk: 'medium'
    });
    expect(state.summary.contextHealth).toBeGreaterThan(0);
    expect(state.summary.estimatedWaste).toBeGreaterThan(0);
    expect(state.cacheEfficiencyTrend).toHaveLength(1);
    expect(state.contextComposition.completion).toBe(5_600);
  });

  it('keeps separate sessions outside the merge window and filters dashboard summaries', async () => {
    await manager.recordTelemetry(buildTelemetry({ workspace: 'token-lint' }));
    await manager.recordTelemetry(buildTelemetry({
      workspace: 'api-contract-tests',
      title: 'New session - coverage suite',
      startedAt: Date.now() - (45 * 60 * 1000),
      endedAt: Date.now() - (44 * 60 * 1000),
      promptTokens: 44_000,
      estimatedCost: 0.44,
      credits: 44,
      cacheSavings: 0.08,
      cacheEfficiency: 49,
      retrievalAmplification: 4.2,
      contextPressure: 68,
      promptStability: 49,
      risk: 'critical'
    }));

    const filtered = manager.getDashboardState({ workspace: 'api-contract-tests', timeWindowDays: 30 });

    expect(filtered.sessions).toHaveLength(1);
    expect(filtered.summary).toMatchObject({
      sessions: 1,
      totalCost: 0.44,
      totalCredits: 44,
      averageCacheEfficiency: 49,
      estimatedSavings: 0.08,
      estimatedWaste: 67.4,
      averageRetrievalAmplification: 4.2,
      averageContextPressure: 68,
      stablePromptRegions: 49,
      volatilePromptRegions: 51,
      reasoningRisk: 'high'
    });
    expect(filtered.summary.contextHealth).toBeGreaterThanOrEqual(40);
    expect(filtered.summary.contextHealth).toBeLessThanOrEqual(45);
    expect(filtered.costOverTime).toHaveLength(1);
    expect(filtered.costByModel).toEqual([
      {
        model: 'GPT-5.4',
        cost: 0.44,
        percent: 100
      }
    ]);
    expect(filtered.cacheBreakdown).toEqual({
      totalTokens: 44_000,
      cacheReadTokens: 4_500,
      cacheCreateTokens: 9_000
    });
    expect(filtered.retrievalAmplification).toEqual([
      {
        date: new Date(filtered.sessions[0].endedAt ?? filtered.sessions[0].startedAt).toISOString().slice(0, 10),
        amplification: 4.2
      }
    ]);
    expect(filtered.cacheEfficiencyTrend).toEqual([
      {
        date: new Date(filtered.sessions[0].endedAt ?? filtered.sessions[0].startedAt).toISOString().slice(0, 10),
        efficiency: 49
      }
    ]);
    expect(filtered.contextComposition).toMatchObject({
      completion: 3_600
    });
    expect(filtered.contextComposition.retrieval).toBeGreaterThan(filtered.contextComposition.memory);
    expect(
      filtered.contextComposition.systemPrompt
        + filtered.contextComposition.memory
        + filtered.contextComposition.retrieval
        + filtered.contextComposition.toolOutput
        + filtered.contextComposition.userInput
    ).toBe(44_000);
    expect(filtered.workspaces).toEqual(['All workspaces', 'token-lint', 'api-contract-tests']);
  });

  it('toggles favorites and filters to favorites only', async () => {
    const first = await manager.recordTelemetry(buildTelemetry({ workspace: 'token-lint' }));
    await manager.recordTelemetry(buildTelemetry({
      workspace: 'api-contract-tests',
      title: 'New session - favorite candidate',
      startedAt: Date.now() - (50 * 60 * 1000),
      endedAt: Date.now() - (49 * 60 * 1000)
    }));

    const toggled = await manager.toggleFavorite(first.id);
    const filtered = manager.getDashboardState({ favoritesOnly: true, timeWindowDays: 30 });

    expect(toggled).toMatchObject({
      id: first.id,
      favorite: true
    });
    expect(filtered.sessions).toHaveLength(1);
    expect(filtered.sessions[0]).toMatchObject({
      id: first.id,
      favorite: true
    });

    const untoggled = await manager.toggleFavorite(first.id);
    const afterClear = manager.getDashboardState({ favoritesOnly: true, timeWindowDays: 30 });

    expect(untoggled).toMatchObject({
      id: first.id,
      favorite: false
    });
    expect(afterClear.sessions).toEqual([]);
  });
});