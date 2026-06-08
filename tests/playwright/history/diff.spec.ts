import { expect, test } from '@playwright/test';

import { RuntimeValidationHarness } from '../../mcp/runtimeHarness';

const baseTime = Date.parse('2099-06-19T07:30:00Z');

test.describe('runtime diff regression detection', () => {
  let harness: RuntimeValidationHarness;

  test.afterEach(() => {
    harness?.dispose();
  });

  test('detects regressions from the latest snapshot against the previous one', async () => {
    harness = new RuntimeValidationHarness();

    const baseline = await harness.seedSessions([
      {
        workspace: 'token-lint',
        title: 'New session - baseline',
        startedAt: baseTime,
        endedAt: baseTime,
        promptTokens: 18_000,
        completionTokens: 3_000,
        cacheCreateTokens: 10_000,
        cacheReadTokens: 7_500,
        retrievalAmplification: 2.0,
        promptStability: 72,
        cacheEfficiency: 75,
        contextPressure: 38,
        diagnosticsByFile: {
          'retrieval.yaml': 1
        }
      }
    ]);
    harness.captureLatestSnapshot({ sessionId: baseline[0].session.id, createdAt: baseTime + 60_000 });

    const regression = await harness.seedSessions([
      {
        workspace: 'token-lint',
        title: 'New session - regression',
        startedAt: baseTime + 2 * 86_400_000,
        endedAt: baseTime + 2 * 86_400_000 + 90_000,
        promptTokens: 42_000,
        completionTokens: 7_600,
        cacheCreateTokens: 24_000,
        cacheReadTokens: 4_000,
        retrievalAmplification: 5.4,
        promptStability: 44,
        cacheEfficiency: 16.7,
        contextPressure: 74,
        risk: 'critical',
        files: ['prompt.md', 'retrieval.yaml', 'agent.yaml'],
        retrievalFiles: ['retrieval.yaml', 'agent.yaml'],
        diagnosticsByFile: {
          'retrieval.yaml': 7,
          'agent.yaml': 8
        },
        highestRiskFiles: ['agent.yaml'],
        fileEstimates: [
          {
            fileName: 'prompt.md',
            tokens: 8_000,
            estimatedRetrievalTokens: 500,
            estimatedFinalContext: 10_000
          },
          {
            fileName: 'retrieval.yaml',
            tokens: 10_500,
            estimatedRetrievalTokens: 6_500,
            estimatedFinalContext: 25_000
          },
          {
            fileName: 'agent.yaml',
            tokens: 11_200,
            estimatedRetrievalTokens: 8_400,
            estimatedFinalContext: 33_000
          }
        ]
      }
    ]);
    const latestSnapshot = harness.captureLatestSnapshot({
      sessionId: regression[0].session.id,
      createdAt: baseTime + 2 * 86_400_000 + 120_000
    });

    expect(latestSnapshot).toBeDefined();

    const comparison = harness.compareLatestToPrevious('token-lint');

    expect(comparison).toBeDefined();
    expect(comparison?.summary.runtimeCost.changePercent).toBeGreaterThanOrEqual(15);
    expect(comparison?.regressions.map(signal => signal.metric)).toContain('runtimeCost');
    expect(comparison?.regressions.map(signal => signal.metric)).toContain('retrievalAmplification');
    expect(comparison?.highestRegressions[0]?.path).toBe('agent.yaml');
    expect(comparison?.recommendations.join(' ')).toContain('model mix');
  });
});