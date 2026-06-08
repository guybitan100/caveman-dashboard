export const dashboardSelectors = {
  shell: '[data-testid="runtime-dashboard-shell"]',
  title: '[data-testid="runtime-dashboard-title"]',
  subtitle: '[data-testid="runtime-dashboard-subtitle"]',
  timeWindowSelect: '[data-testid="time-window-select"]',
  refreshButton: '[data-testid="refresh-button"]',
  customWindowControls: '[data-testid="custom-window-controls"]',
  customStartInput: '[data-testid="custom-start-input"]',
  customEndInput: '[data-testid="custom-end-input"]',
  applyCustomWindow: '[data-testid="apply-custom-window"]',
  tabLatest: '[data-testid="tab-latest"]',
  tabAll: '[data-testid="tab-all"]',
  tabAggregate: '[data-testid="tab-aggregate"]',
  emptyState: '[data-testid="empty-state"]',
  emptyStateTitle: '[data-testid="empty-state-title"]',
  emptyAnalyzeWorkspace: '[data-testid="empty-analyze-workspace"]',
  emptyImportTelemetry: '[data-testid="empty-import-telemetry"]',
  emptyOpenSettings: '[data-testid="empty-open-settings"]',
  kpiSessions: '[data-testid="kpi-sessions"]',
  kpiCost: '[data-testid="kpi-cost"]',
  kpiCredits: '[data-testid="kpi-credits"]',
  exportCsv: '[data-testid="export-csv"]',
  exportJson: '[data-testid="export-json"]',
  sectionLatest: '[data-testid="section-latest"]',
  sectionAll: '[data-testid="section-all"]',
  sectionAggregate: '[data-testid="section-aggregate"]',
  latestSessionTitle: '[data-testid="latest-session-title"]',
  latestSessionWorkspace: '[data-testid="latest-session-workspace"]',
  latestSessionRisk: '[data-testid="latest-session-risk"]',
  sessionActivityPanel: '[data-testid="session-activity-panel"]',
  workspaceFilter: '[data-testid="workspace-filter"]',
  favoritesToggle: '[data-testid="favorites-toggle"]',
  sessionsTable: '[data-testid="sessions-table"]',
  aggregateWorkspacePanel: '[data-testid="aggregate-workspace-panel"]',
  aggregateModelPanel: '[data-testid="aggregate-model-panel"]',
  aggregateHealthPanel: '[data-testid="aggregate-health-panel"]',
  aggregateRecommendationsPanel: '[data-testid="aggregate-recommendations-panel"]',
  aggregateHistoryPanel: '[data-testid="aggregate-history-panel"]',
  aggregateDrilldownPanel: '[data-testid="aggregate-drilldown-panel"]',
  historySaveSnapshot: '[data-testid="history-save-snapshot"]',
  historyDiffPrevious: '[data-testid="history-diff-previous"]',
  historyDiffBaseline: '[data-testid="history-diff-baseline"]',
  historyClearOld: '[data-testid="history-clear-old"]',
  drilldownCostAnalysis: '[data-testid="drilldown-cost-analysis"]',
  drilldownCacheEfficiency: '[data-testid="drilldown-cache-efficiency"]',
  drilldownRetrievalAmplification: '[data-testid="drilldown-retrieval-amplification"]',
  drilldownOpenSettings: '[data-testid="drilldown-open-settings"]'
} as const;

export function sessionRowSelector(sessionId: string): string {
  return `[data-testid="session-row-${sessionId}"]`;
}

export function sessionExpandSelector(sessionId: string): string {
  return `[data-testid="session-expand-${sessionId}"]`;
}

export function sessionFavoriteSelector(sessionId: string): string {
  return `[data-testid="session-favorite-${sessionId}"]`;
}

export function sessionDetailRowSelector(sessionId: string): string {
  return `[data-testid="session-detail-row-${sessionId}"]`;
}