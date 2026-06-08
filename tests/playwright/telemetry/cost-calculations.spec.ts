import { expect, test } from '@playwright/test';

import { estimateRuntimeCost } from '../../../src/runtime/session/costEngine';
import { RuntimeValidationHarness } from '../../mcp/runtimeHarness';
import { expectSummaryKpis, parseCurrency, parseNumber } from '../../utils/metricAssertions';
import { dashboardSelectors } from '../../utils/dashboardSelectors';
import { renderDashboardPage } from '../../utils/runtimeHelpers';

const baseTime = Date.parse('2099-06-17T12:00:00Z');

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

test.describe('runtime cost calculations', () => {
  let harness: RuntimeValidationHarness;

  test.afterEach(() => {
    harness?.dispose();
  });

  test('keeps dashboard cost and credit totals aligned with the production cost engine', async ({ page }) => {
    harness = new RuntimeValidationHarness();

    const first = {
      model: 'GPT-5.4',
      promptTokens: 20_000,
      completionTokens: 4_000,
      cacheCreateTokens: 14_000,
      cacheReadTokens: 6_000
    } as const;
    const second = {
      model: 'Claude Sonnet 4.6',
      promptTokens: 36_000,
      completionTokens: 5_200,
      cacheCreateTokens: 22_000,
      cacheReadTokens: 10_000
    } as const;
    const firstEstimate = estimateRuntimeCost(first);
    const secondEstimate = estimateRuntimeCost(second);

    await harness.seedSessions([
      {
        workspace: 'token-lint',
        title: 'New session - gpt spend',
        startedAt: baseTime,
        endedAt: baseTime,
        ...first
      },
      {
        workspace: 'token-lint',
        title: 'New session - claude spend',
        startedAt: baseTime + 86_400_000,
        endedAt: baseTime + 86_460_000,
        ...second,
        retrievalAmplification: 3.4,
        contextPressure: 58.5,
        risk: 'high'
      }
    ]);

    const state = harness.buildViewState({ activeView: 'aggregate', activeSection: 'analysis' });
    const expectedCost = roundTo(firstEstimate.estimatedCost + secondEstimate.estimatedCost, 2);
    const expectedCredits = roundTo(firstEstimate.credits + secondEstimate.credits, 2);

    expect(state.summary.totalCost).toBe(expectedCost);
    expect(state.summary.totalCredits).toBe(expectedCredits);

    await renderDashboardPage(page, state);
    await expectSummaryKpis(page, state.summary);

    expect(parseCurrency(await page.locator(dashboardSelectors.kpiCost).innerText())).toBe(expectedCost);
    expect(parseNumber(await page.locator(dashboardSelectors.kpiCredits).innerText())).toBe(expectedCredits);
    expect(state.costByModel.map(entry => entry.model)).toEqual(['Claude Sonnet 4.6', 'GPT-5.4']);
  });
});