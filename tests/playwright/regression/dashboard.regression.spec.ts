import { expect, test } from '@playwright/test';

import { RuntimeValidationHarness } from '../../mcp/runtimeHarness';
import { dashboardSelectors } from '../../utils/dashboardSelectors';
import { renderDashboardPage } from '../../utils/runtimeHelpers';

const baseTime = Date.parse('2099-06-20T10:00:00Z');

test.describe('runtime dashboard visual regression', () => {
  let harness: RuntimeValidationHarness;

  test.afterEach(() => {
    harness?.dispose();
  });

  test('matches the aggregate dashboard screenshot baseline', async ({ page }) => {
    harness = new RuntimeValidationHarness();

    const seeded = await harness.seedSessions([
      {
        workspace: 'token-lint',
        title: 'New session - aggregate snapshot',
        startedAt: baseTime,
        endedAt: baseTime,
        promptTokens: 26_000,
        completionTokens: 4_400,
        cacheCreateTokens: 12_000,
        cacheReadTokens: 8_000,
        retrievalAmplification: 3.2,
        contextPressure: 55.1,
        risk: 'high',
        files: ['prompt.md', 'retrieval.yaml'],
        retrievalFiles: ['retrieval.yaml']
      },
      {
        workspace: 'sdk-lab',
        title: 'New session - model spread',
        startedAt: baseTime - 86_400_000,
        endedAt: baseTime - 86_340_000,
        model: 'Claude Sonnet 4.6',
        promptTokens: 34_000,
        completionTokens: 5_200,
        cacheCreateTokens: 18_000,
        cacheReadTokens: 9_000,
        retrievalAmplification: 4.1,
        contextPressure: 62.5,
        risk: 'critical',
        files: ['sdk.prompt.md', 'sdk.rag.yaml'],
        retrievalFiles: ['sdk.rag.yaml'],
        promptFiles: ['sdk.prompt.md']
      }
    ]);

    harness.captureLatestSnapshot({ sessionId: seeded[0].session.id, createdAt: baseTime + 60_000 });

    const state = harness.buildViewState({ activeView: 'aggregate', activeSection: 'analysis' });

    await renderDashboardPage(page, state);
    await expect(page.locator(dashboardSelectors.sectionAggregate)).toHaveClass(/active/);
    await expect(page).toHaveScreenshot('runtime-dashboard-aggregate.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css'
    });
  });
});