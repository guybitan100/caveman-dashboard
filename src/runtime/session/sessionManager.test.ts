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
      cacheEfficiency: 31.7,
      files: ['prompt.md', 'skill.yaml', 'workflow.yaml'],
      retrievalAmplification: 2.1,
      promptStability: 58.5,
      latencyMs: 920,
      risk: 'high'
    });
  });

  it('keeps separate sessions outside the merge window and filters dashboard summaries', async () => {
    await manager.recordTelemetry(buildTelemetry({ workspace: 'token-lint' }));
    await manager.recordTelemetry(buildTelemetry({
      workspace: 'api-contract-tests',
      startedAt: Date.now() - (45 * 60 * 1000),
      endedAt: Date.now() - (44 * 60 * 1000),
      promptTokens: 44_000,
      estimatedCost: 0.44,
      credits: 44,
      cacheEfficiency: 49,
      retrievalAmplification: 4.2,
      contextPressure: 68,
      promptStability: 49,
      risk: 'critical'
    }));

    const filtered = manager.getDashboardState({ workspace: 'api-contract-tests', timeWindowDays: 30 });

    expect(filtered.sessions).toHaveLength(1);
    expect(filtered.summary).toEqual({
      totalSessions: 1,
      totalCost: 0.44,
      totalCredits: 44,
      averageCacheEfficiency: 49,
      averageRetrievalAmplification: 4.2,
      averageContextPressure: 68,
      stablePromptRegions: 49,
      volatilePromptRegions: 51
    });
    expect(filtered.workspaces).toEqual(['All workspaces', 'token-lint', 'api-contract-tests']);
  });
});