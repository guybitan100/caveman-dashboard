import { expect, test } from '@playwright/test';

import { RuntimeValidationHarness } from '../../mcp/runtimeHarness';
import { dashboardSelectors, sessionRowSelector } from '../../utils/dashboardSelectors';
import { expectSummaryKpis } from '../../utils/metricAssertions';
import { dispatchDashboardState, renderDashboardPage } from '../../utils/runtimeHelpers';

const baseTime = Date.parse('2099-06-16T09:00:00Z');

test.describe('runtime telemetry synchronization', () => {
  let harness: RuntimeValidationHarness;

  test.afterEach(() => {
    harness?.dispose();
  });

  test('merges nearby telemetry, updates the dashboard live, and filters to favorites', async ({ page }) => {
    harness = new RuntimeValidationHarness();

    await harness.seedSessions([
      {
        workspace: 'token-lint',
        title: 'New session - merged telemetry',
        startedAt: baseTime,
        endedAt: baseTime + 60_000,
        files: ['prompt.md', 'memory.md'],
        promptFiles: ['prompt.md', 'memory.md'],
        retrievalFiles: ['memory.md']
      },
      {
        workspace: 'token-lint',
        title: 'New session - merged telemetry',
        startedAt: baseTime + 5 * 60_000,
        endedAt: baseTime + 6 * 60_000,
        promptTokens: 10_000,
        completionTokens: 2_000,
        cacheCreateTokens: 4_000,
        cacheReadTokens: 5_000,
        retrievalAmplification: 1.8,
        contextPressure: 49.3,
        risk: 'high',
        files: ['prompt.md', 'workflow.yaml'],
        promptFiles: ['prompt.md', 'workflow.yaml'],
        retrievalFiles: ['workflow.yaml']
      }
    ]);

    let state = harness.buildViewState({ activeView: 'all', activeSection: 'sessions' });
    expect(state.summary.sessions).toBe(1);
    expect(state.latestSession?.requests).toBe(2);

    await renderDashboardPage(page, state);
    await expectSummaryKpis(page, state.summary);

    const mergedSessionId = state.latestSession?.id;
    expect(mergedSessionId).toBeDefined();

    await harness.seedSessions([
      {
        workspace: 'sdk-lab',
        title: 'New session - separate workspace',
        startedAt: baseTime + 2 * 86_400_000,
        endedAt: baseTime + 2 * 86_400_000 + 90_000,
        promptTokens: 30_000,
        completionTokens: 5_000,
        cacheCreateTokens: 12_000,
        cacheReadTokens: 9_000,
        retrievalAmplification: 3.6,
        contextPressure: 61.4,
        risk: 'critical',
        files: ['sdk.prompt.md', 'sdk.rag.yaml'],
        retrievalFiles: ['sdk.rag.yaml'],
        promptFiles: ['sdk.prompt.md']
      }
    ]);

    state = harness.buildViewState({ activeView: 'all', activeSection: 'sessions' });
    expect(state.summary.sessions).toBe(2);

    await dispatchDashboardState(page, state);
    await expectSummaryKpis(page, state.summary);
    await expect(page.locator(sessionRowSelector(mergedSessionId!))).toBeVisible();
    await expect(page.locator(sessionRowSelector(state.sessions[0].id))).toBeVisible();

    await harness.toggleFavorite(mergedSessionId!);
    const favoriteState = harness.buildViewState({
      activeView: 'all',
      activeSection: 'sessions',
      filter: {
        workspace: 'All workspaces',
        timeWindowDays: 30,
        favoritesOnly: true
      }
    });

    await dispatchDashboardState(page, favoriteState);
    await expectSummaryKpis(page, favoriteState.summary);
    await expect(page.locator(sessionRowSelector(mergedSessionId!))).toBeVisible();
    await expect(page.locator(dashboardSelectors.favoritesToggle)).toHaveClass(/active/);
    expect(favoriteState.sessions).toHaveLength(1);
  });
});