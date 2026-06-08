import { expect, test } from '@playwright/test';

import { RuntimeValidationHarness } from '../../mcp/runtimeHarness';
import {
  dashboardSelectors,
  sessionDetailRowSelector,
  sessionExpandSelector,
  sessionFavoriteSelector
} from '../../utils/dashboardSelectors';
import { expectLatestSessionHeader, expectSummaryKpis } from '../../utils/metricAssertions';
import {
  clearPostedMessages,
  getActiveTab,
  getPostedMessages,
  renderDashboardPage
} from '../../utils/runtimeHelpers';

const baseTime = Date.parse('2099-06-15T12:00:00Z');

test.describe('runtime dashboard rendering', () => {
  let harness: RuntimeValidationHarness;

  test.afterEach(() => {
    harness?.dispose();
  });

  test('renders the production dashboard and routes button interactions through VS Code messages', async ({ page }) => {
    harness = new RuntimeValidationHarness();
    const seeded = await harness.seedSessions([
      {
        workspace: 'token-lint',
        title: 'New session - runtime dashboard spec',
        startedAt: baseTime,
        endedAt: baseTime,
        files: ['prompt.md', 'retrieval.yaml'],
        retrievalFiles: ['retrieval.yaml'],
        promptFiles: ['prompt.md'],
        skills: ['runtime.skill.yaml'],
        mcpConfigs: ['mcp.runtime.json']
      },
      {
        workspace: 'api-contract-tests',
        title: 'New session - aggregate mix',
        startedAt: baseTime - 86_400_000,
        endedAt: baseTime - 86_340_000,
        promptTokens: 24_000,
        completionTokens: 4_200,
        cacheCreateTokens: 11_000,
        cacheReadTokens: 7_000,
        retrievalAmplification: 3.1,
        contextPressure: 52.7,
        risk: 'high',
        favorite: true,
        files: ['workflow.prompt.md', 'workspace.rag.yaml'],
        retrievalFiles: ['workspace.rag.yaml'],
        promptFiles: ['workflow.prompt.md']
      }
    ]);
    harness.captureLatestSnapshot({ sessionId: seeded[0].session.id, createdAt: baseTime + 60_000 });

    const state = harness.buildViewState({
      activeView: 'latest',
      activeSection: 'overview'
    });

    await renderDashboardPage(page, state);
    await expect(page.locator(dashboardSelectors.title)).toHaveText('TokenLint Cost & Token Tracker');
    await expectSummaryKpis(page, state.summary);
    await expectLatestSessionHeader(page, state.latestSession!);

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.refreshButton).click();
    let messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({ command: 'refreshView' });

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.timeWindowSelect).selectOption('today');
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({
      command: 'updateFilter',
      workspace: 'All workspaces',
      timeWindowDays: 1,
      favoritesOnly: false
    });

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.timeWindowSelect).selectOption('7d');
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({
      command: 'updateFilter',
      workspace: 'All workspaces',
      timeWindowDays: 7,
      favoritesOnly: false
    });

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.timeWindowSelect).selectOption('month');
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({
      command: 'updateFilter',
      workspace: 'All workspaces',
      timeWindowDays: new Date().getUTCDate(),
      favoritesOnly: false
    });

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.timeWindowSelect).selectOption('30d');
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({
      command: 'updateFilter',
      workspace: 'All workspaces',
      timeWindowDays: 30,
      favoritesOnly: false
    });

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.timeWindowSelect).selectOption('custom');
    await expect(page.locator(dashboardSelectors.customWindowControls)).toBeVisible();
    messages = await getPostedMessages(page);
    expect(messages).toEqual([]);
    await page.locator(dashboardSelectors.customStartInput).fill('2099-06-01');
    await page.locator(dashboardSelectors.customEndInput).fill('2099-06-05');
    await page.locator(dashboardSelectors.applyCustomWindow).click();
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({
      command: 'updateFilter',
      workspace: 'All workspaces',
      timeWindowDays: 5,
      favoritesOnly: false
    });

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.tabAll).click();
    await expect.poll(async () => getActiveTab(page)).toBe('all');
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({ command: 'selectView', view: 'all' });
    await expect(page.locator(dashboardSelectors.sectionAll)).toHaveClass(/active/);
    await expect(page.locator(dashboardSelectors.sessionsTable)).toBeVisible();

    await page.locator(sessionExpandSelector(seeded[0].session.id)).click();
    await expect(page.locator(sessionDetailRowSelector(seeded[0].session.id))).not.toHaveClass(/hidden/);

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.tabLatest).click();
    await expect.poll(async () => getActiveTab(page)).toBe('latest');
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({ command: 'selectView', view: 'latest' });
    await expect(page.locator(dashboardSelectors.sectionLatest)).toHaveClass(/active/);

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.tabAll).click();
    await expect.poll(async () => getActiveTab(page)).toBe('all');
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({ command: 'selectView', view: 'all' });
    await expect(page.locator(dashboardSelectors.sectionAll)).toHaveClass(/active/);

    await clearPostedMessages(page);
    await page.locator(sessionFavoriteSelector(seeded[0].session.id)).click();
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({ command: 'toggleFavorite', sessionId: seeded[0].session.id });

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.workspaceFilter).selectOption('api-contract-tests');
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({
      command: 'updateFilter',
      workspace: 'api-contract-tests',
      timeWindowDays: 5,
      favoritesOnly: false
    });

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.favoritesToggle).click();
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({
      command: 'updateFilter',
      workspace: 'api-contract-tests',
      timeWindowDays: 5,
      favoritesOnly: true
    });

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.exportCsv).click();
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({ command: 'exportView', format: 'csv', view: 'all' });

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.tabAggregate).click();
    await expect.poll(async () => getActiveTab(page)).toBe('aggregate');
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({ command: 'selectView', view: 'aggregate' });
    await expect(page.locator(dashboardSelectors.sectionAggregate)).toHaveClass(/active/);

    await clearPostedMessages(page);
    await page.locator(dashboardSelectors.exportJson).click();
    messages = await getPostedMessages(page);
    expect(messages.at(-1)).toEqual({ command: 'exportView', format: 'json', view: 'aggregate' });

    const aggregateCommandButtons = [
      { selector: dashboardSelectors.historySaveSnapshot, command: 'saveRuntimeSnapshot' },
      { selector: dashboardSelectors.historyDiffPrevious, command: 'diffAgainstPrevious' },
      { selector: dashboardSelectors.historyDiffBaseline, command: 'diffAgainstBaseline' },
      { selector: dashboardSelectors.historyClearOld, command: 'clearOldRuntimeHistory' },
      { selector: dashboardSelectors.drilldownCostAnalysis, command: 'showCostAnalysis' },
      { selector: dashboardSelectors.drilldownCacheEfficiency, command: 'analyzeCacheEfficiency' },
      { selector: dashboardSelectors.drilldownRetrievalAmplification, command: 'analyzeRetrievalAmplification' },
      { selector: dashboardSelectors.drilldownOpenSettings, command: 'openSettings' }
    ] as const;

    for (const button of aggregateCommandButtons) {
      await clearPostedMessages(page);
      await page.locator(button.selector).click();
      messages = await getPostedMessages(page);
      expect(messages.at(-1)).toEqual({ command: button.command });
    }
  });

  test('renders the empty state and wires all empty-state actions', async ({ page }) => {
    harness = new RuntimeValidationHarness();
    const state = harness.buildViewState({ activeView: 'all', activeSection: 'overview' });

    await renderDashboardPage(page, state);
    await expect(page.locator(dashboardSelectors.emptyState)).toBeVisible();
    await expect(page.locator(dashboardSelectors.emptyStateTitle)).toHaveText('No sessions recorded yet.');

    const actions = [
      { selector: dashboardSelectors.emptyAnalyzeWorkspace, command: 'runAnalyzeWorkspace' },
      { selector: dashboardSelectors.emptyImportTelemetry, command: 'importTelemetry' },
      { selector: dashboardSelectors.emptyOpenSettings, command: 'openSettings' }
    ] as const;

    for (const action of actions) {
      await clearPostedMessages(page);
      await page.locator(action.selector).click();
      const messages = await getPostedMessages(page);
      expect(messages.at(-1)).toEqual({ command: action.command });
    }
  });
});