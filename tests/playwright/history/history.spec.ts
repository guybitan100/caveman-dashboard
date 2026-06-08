import * as fs from 'node:fs';

import { expect, test } from '@playwright/test';

import { RuntimeValidationHarness } from '../../mcp/runtimeHarness';
import { dashboardSelectors } from '../../utils/dashboardSelectors';
import { renderDashboardPage } from '../../utils/runtimeHelpers';

const baseTime = Date.parse('2099-06-18T08:00:00Z');

test.describe('runtime history persistence', () => {
  let harness: RuntimeValidationHarness;

  test.afterEach(() => {
    harness?.dispose();
  });

  test('persists snapshots to disk and surfaces them in the aggregate history view', async ({ page }) => {
    harness = new RuntimeValidationHarness();

    const first = await harness.seedSessions([
      {
        workspace: 'token-lint',
        title: 'New session - history baseline',
        startedAt: baseTime,
        endedAt: baseTime,
        promptTokens: 18_000,
        completionTokens: 3_000,
        cacheCreateTokens: 9_000,
        cacheReadTokens: 5_000,
        retrievalAmplification: 2.1,
        contextPressure: 42.2
      }
    ]);
    const firstSnapshot = harness.captureLatestSnapshot({
      sessionId: first[0].session.id,
      createdAt: baseTime + 60_000
    });

    const second = await harness.seedSessions([
      {
        workspace: 'token-lint',
        title: 'New session - history latest',
        startedAt: baseTime + 86_400_000,
        endedAt: baseTime + 86_460_000,
        promptTokens: 28_000,
        completionTokens: 5_000,
        cacheCreateTokens: 12_000,
        cacheReadTokens: 8_000,
        retrievalAmplification: 3.3,
        contextPressure: 56.7,
        risk: 'high'
      }
    ]);
    const secondSnapshot = harness.captureLatestSnapshot({
      sessionId: second[0].session.id,
      createdAt: baseTime + 86_400_000 + 60_000
    });

    expect(firstSnapshot).toBeDefined();
    expect(secondSnapshot).toBeDefined();

    harness.setBaseline(firstSnapshot!.id);

    const paths = harness.getHistoryPaths();
    expect(paths).toBeDefined();
    expect(fs.existsSync(paths!.history)).toBe(true);
    expect(fs.existsSync(paths!.latest)).toBe(true);
    expect(harness.listSnapshots('token-lint')).toHaveLength(2);

    const state = harness.buildViewState({ activeView: 'aggregate', activeSection: 'history' });

    await renderDashboardPage(page, state);
    await expect(page.locator(dashboardSelectors.aggregateHistoryPanel)).toContainText('Snapshots');
    await expect(page.locator(dashboardSelectors.aggregateHistoryPanel)).toContainText('2');
    await expect(page.locator(dashboardSelectors.aggregateHistoryPanel)).toContainText(firstSnapshot!.id);
  });
});