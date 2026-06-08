import * as vscode from 'vscode';

import { BudgetResult, WorkspaceBudgetAnalysis } from '../../core/budget/budgetModels';
import { RuntimeHistoryStore } from '../../runtime/history/historyStore';
import { RuntimeSnapshotManager } from '../../runtime/history/snapshotManager';
import { AISession, allWorkspacesLabel } from '../../runtime/session/sessionModels';
import { RuntimeSessionManager } from '../../runtime/session/sessionManager';
import { RuntimeSessionStore } from '../../runtime/session/sessionStore';
import { collectRuntimeTelemetry } from '../../runtime/session/telemetryCollector';
import { TokenLintDiagnosticProvider } from '../providers/diagnosticProvider';

import {
  RuntimeDashboardDiffMode,
  RuntimeDashboardExportView,
  RuntimeDashboardFilterState,
  RuntimeDashboardHistorySettings,
  RuntimeDashboardMessage,
  RuntimeDashboardPanel,
  RuntimeDashboardSection,
  RuntimeDashboardViewState
} from '../providers/runtimeDashboardPanel';
import { RuntimeAnalysisPanel } from '../providers/runtimeAnalysisPanel';
import { RuntimeBudgetCapturePayload } from './copilotBudget';
import { prepareRuntimeArtifactDocument } from './runtimeArtifacts';

type RuntimeBudgetSnapshot = RuntimeBudgetCapturePayload & {
  budget: BudgetResult;
  workspaceAnalysis?: WorkspaceBudgetAnalysis;
};

export class RuntimeObservabilityController {
  private readonly panel: RuntimeDashboardPanel;
  private readonly analysisPanel: RuntimeAnalysisPanel;
  private readonly sessionManager: RuntimeSessionManager;
  private readonly historyStore: RuntimeHistoryStore;
  private readonly snapshotManager: RuntimeSnapshotManager;
  private readonly diagnosticsProvider: TokenLintDiagnosticProvider | undefined;
  private readonly statusBar: vscode.StatusBarItem;
  private filter = createDefaultFilter();
  private activeSection: RuntimeDashboardSection = 'overview';
  private activeView: RuntimeDashboardExportView = 'all';
  private activeDiffMode: RuntimeDashboardDiffMode = 'previous';
  private selectedSnapshotId: string | undefined;
  private latestBudgetSnapshot: RuntimeBudgetSnapshot | undefined;

  constructor(
    context: vscode.ExtensionContext,
    diagnosticsProvider?: TokenLintDiagnosticProvider,
    panel = new RuntimeDashboardPanel(context.extensionUri),
    analysisPanel = new RuntimeAnalysisPanel(context.extensionUri),
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  ) {
    this.panel = panel;
    this.analysisPanel = analysisPanel;
    this.diagnosticsProvider = diagnosticsProvider;
    this.statusBar = statusBar;
    this.sessionManager = new RuntimeSessionManager(
      new RuntimeSessionStore(context.globalState)
    );
    this.historyStore = new RuntimeHistoryStore(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
    this.snapshotManager = new RuntimeSnapshotManager(this.historyStore);
    this.statusBar.command = 'tokenlint.openRuntimeDashboard';
    this.statusBar.show();
    context.subscriptions.push(this.statusBar);
    this.panel.setMessageHandler(message => {
      void this.handlePanelMessage(message);
    });
    this.updateStatusBar(this.buildViewState());
  }

  async captureBudgetSnapshot(snapshot: RuntimeBudgetSnapshot): Promise<void> {
    this.latestBudgetSnapshot = snapshot;

    const workspace = resolveWorkspaceName();
    const visibleFiles = getVisibleWorkspaceFiles();
    const telemetry = collectRuntimeTelemetry({
      workspace,
      budget: snapshot.budget,
      workspaceAnalysis: snapshot.workspaceAnalysis,
      visibleFiles,
      previousSession: this.sessionManager.getDashboardState({
        workspace,
        timeWindowDays: 30
      }).latestSession
    });

    await this.sessionManager.recordTelemetry(telemetry);
    if (snapshot.reason === 'scan') {
      this.captureHistorySnapshot('scan');
    }
    this.syncView(this.buildViewState());
  }

  async openRuntimeDashboard(
    section: RuntimeDashboardSection = this.activeSection,
    view: RuntimeDashboardExportView = this.activeView
  ): Promise<void> {
    this.activeSection = section;
    this.activeView = view;
    this.captureHistorySnapshot('dashboard');
    const viewState = this.buildViewState();
    this.updateStatusBar(viewState);
    this.panel.show(viewState);
  }

  async showLatestSession(): Promise<void> {
    await this.openRuntimeDashboard('overview', 'latest');
  }

  async showAggregateView(): Promise<void> {
    await this.openRuntimeDashboard('analysis', 'aggregate');
  }

  async exportCostViewAsCsv(): Promise<void> {
    await this.exportView('csv', this.activeView);
  }

  async exportCostViewAsJson(): Promise<void> {
    await this.exportView('json', this.activeView);
  }

  async showRuntimeHistory(): Promise<void> {
    this.activeSection = 'history';
    this.activeView = 'aggregate';
    const viewState = this.buildViewState();
    this.updateStatusBar(viewState);
    this.panel.show(viewState);
  }

  async diffRuntimeAgainstPrevious(): Promise<void> {
    await this.openDiffSection('previous');
  }

  async diffRuntimeAgainst7Days(): Promise<void> {
    await this.openDiffSection('sevenDays');
  }

  async diffRuntimeAgainstBaseline(): Promise<void> {
    await this.openDiffSection('baseline');
  }

  async saveRuntimeSnapshot(): Promise<void> {
    const snapshot = this.captureHistorySnapshot('manual');
    if (!snapshot) {
      vscode.window.showInformationMessage('TokenLint: No runtime session is available to snapshot yet.');
      return;
    }

    this.syncView(this.buildViewState());
    vscode.window.showInformationMessage(`TokenLint: Runtime snapshot ready: ${snapshot.id}`);
  }

  async clearOldRuntimeHistory(): Promise<void> {
    const settings = this.getHistorySettings();
    const removed = this.snapshotManager.clearOldHistory(settings, resolveWorkspaceFilter(this.filter.workspace));
    this.syncView(this.buildViewState());
    vscode.window.showInformationMessage(
      removed.length === 0
        ? 'TokenLint: No runtime snapshots were pruned.'
        : `TokenLint: Removed ${removed.length} runtime snapshots.`
    );
  }

  async showCostAnalysis(): Promise<void> {
    this.activeSection = 'analysis';
    const viewState = this.buildViewState();
    const latest = viewState.latestSession;

    if (!latest) {
      vscode.window.showInformationMessage('TokenLint: No runtime sessions available yet.');
      return;
    }
    this.analysisPanel.show('cost', viewState);
  }

  async analyzeCacheEfficiency(): Promise<void> {
    this.activeSection = 'analysis';
    const viewState = this.buildViewState();
    const latest = viewState.latestSession;

    if (!latest) {
      vscode.window.showInformationMessage('TokenLint: No runtime sessions available yet.');
      return;
    }
    this.analysisPanel.show('cache', viewState);
  }

  async analyzeRetrievalAmplification(): Promise<void> {
    this.activeSection = 'analysis';
    const viewState = this.buildViewState();
    const latest = viewState.latestSession;

    if (!latest) {
      vscode.window.showInformationMessage('TokenLint: No runtime sessions available yet.');
      return;
    }
    this.analysisPanel.show('retrieval', viewState);
  }

  refreshView(): void {
    this.syncView(this.buildViewState());
  }

  private async handlePanelMessage(message: RuntimeDashboardMessage): Promise<void> {
    switch (message.command) {
      case 'refreshView':
        this.syncView(this.buildViewState());
        return;

      case 'selectView':
        this.activeView = message.view;
        return;

      case 'updateFilter':
        this.filter = {
          workspace: message.workspace?.trim() || allWorkspacesLabel,
          timeWindowDays: normalizeTimeWindow(message.timeWindowDays),
          favoritesOnly: Boolean(message.favoritesOnly)
        };
        this.syncView(this.buildViewState());
        return;

      case 'exportView':
        await this.exportView(message.format, message.view);
        return;

      case 'toggleFavorite':
        await this.toggleFavorite(message.sessionId);
        return;

      case 'saveRuntimeSnapshot':
        await this.saveRuntimeSnapshot();
        return;

      case 'clearOldRuntimeHistory':
        await this.clearOldRuntimeHistory();
        return;

      case 'diffAgainstPrevious':
        await this.diffRuntimeAgainstPrevious();
        return;

      case 'diffAgainstSevenDays':
        await this.diffRuntimeAgainst7Days();
        return;

      case 'diffAgainstBaseline':
        await this.diffRuntimeAgainstBaseline();
        return;

      case 'compareSnapshot':
        await this.openDiffSection('snapshot', message.snapshotId);
        return;

      case 'setHistoryBaseline':
        this.snapshotManager.setBaseline(message.snapshotId);
        this.syncView(this.buildViewState());
        return;

      case 'showCostAnalysis':
        await this.showCostAnalysis();
        return;

      case 'analyzeCacheEfficiency':
        await this.analyzeCacheEfficiency();
        return;

      case 'analyzeRetrievalAmplification':
        await this.analyzeRetrievalAmplification();
        return;

      case 'runAnalyzeWorkspace':
        await vscode.commands.executeCommand('tokenlint.analyzeWorkspaceBudget');
        return;

      case 'importTelemetry':
        vscode.window.showInformationMessage('TokenLint: Telemetry import is not available yet.');
        return;

      case 'openSettings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'tokenlint');
        return;
    }
  }

  private async toggleFavorite(sessionId: string): Promise<void> {
    const session = await this.sessionManager.toggleFavorite(sessionId);
    if (!session) {
      vscode.window.showInformationMessage('TokenLint: The selected session is no longer available.');
      return;
    }

    this.syncView(this.buildViewState());
  }

  private buildViewState(): RuntimeDashboardViewState {
    return {
      ...this.sessionManager.getDashboardState(this.filter),
      filter: { ...this.filter },
      activeSection: this.activeSection,
      activeView: this.activeView,
      history: this.buildHistoryState(),
      currentWorkspace: resolveWorkspaceName()
    };
  }

  private buildHistoryState(): RuntimeDashboardViewState['history'] {
    const settings = this.getHistorySettings();
    const workspace = resolveWorkspaceFilter(this.filter.workspace);

    if (!settings.enabled) {
      return {
        snapshots: [],
        baselineId: this.snapshotManager.getBaselineId(),
        activeComparison: undefined,
        diffMode: this.activeDiffMode,
        settings
      };
    }

    return {
      snapshots: this.snapshotManager.listSnapshots(workspace),
      baselineId: this.snapshotManager.getBaselineId(),
      activeComparison: this.buildActiveComparison(workspace, settings),
      diffMode: this.activeDiffMode,
      settings
    };
  }

  private buildActiveComparison(
    workspace: string | undefined,
    settings: RuntimeDashboardHistorySettings
  ) {
    switch (this.activeDiffMode) {
      case 'baseline':
        return this.snapshotManager.compareLatestToBaseline(workspace, settings.baseline);

      case 'sevenDays':
        return this.snapshotManager.compareLatestToSevenDaysAgo(workspace);

      case 'snapshot':
        return this.selectedSnapshotId
          ? this.snapshotManager.compareLatestToSnapshot(this.selectedSnapshotId, workspace)
          : undefined;

      case 'previous':
      default:
        return this.snapshotManager.compareLatestToPrevious(workspace);
    }
  }

  private captureHistorySnapshot(trigger: 'scan' | 'dashboard' | 'manual') {
    const settings = this.getHistorySettings();
    if (!settings.enabled) {
      return undefined;
    }

    if (trigger === 'scan' && !settings.snapshotOnScan) {
      return undefined;
    }

    if (trigger === 'dashboard' && !settings.snapshotOnDashboardOpen) {
      return undefined;
    }

    const workspace = resolveWorkspaceName();
    const state = this.sessionManager.getDashboardState({
      workspace,
      timeWindowDays: 30
    });
    const latestSession = state.latestSession;
    if (!latestSession) {
      return undefined;
    }

    return this.snapshotManager.captureSnapshot(
      {
        workspace,
        createdAt: Date.now(),
        latestSession,
        dashboardSummary: state.summary,
        costByModel: state.costByModel,
        budget: this.latestBudgetSnapshot?.budget ?? buildFallbackBudget(latestSession),
        workspaceAnalysis: this.latestBudgetSnapshot?.workspaceAnalysis,
        diagnosticsByFile: this.diagnosticsProvider?.getFindingCounts()
      },
      settings
    );
  }

  private getHistorySettings(): RuntimeDashboardHistorySettings {
    const configuration = vscode.workspace.getConfiguration('tokenlint');
    return {
      enabled: configuration.get<boolean>('history.enabled', true) && this.historyStore.isAvailable(),
      retentionDays: Math.max(1, Math.round(configuration.get<number>('history.retentionDays', 30))),
      maxSnapshots: Math.max(1, Math.round(configuration.get<number>('history.maxSnapshots', 500))),
      snapshotOnScan: configuration.get<boolean>('history.snapshotOnScan', true),
      snapshotOnDashboardOpen: configuration.get<boolean>('history.snapshotOnDashboardOpen', true),
      baseline: (configuration.get<string>('history.baseline', 'latest') || 'latest').trim() || 'latest'
    };
  }

  private async openDiffSection(mode: RuntimeDashboardDiffMode, snapshotId?: string): Promise<void> {
    this.activeDiffMode = mode;
    this.selectedSnapshotId = snapshotId;
    this.activeSection = 'diff';
    this.activeView = 'aggregate';

    const viewState = this.buildViewState();
    this.updateStatusBar(viewState);
    this.panel.show(viewState);

    if (!viewState.history.activeComparison) {
      vscode.window.showInformationMessage('TokenLint: Not enough runtime history is available for that comparison yet.');
    }
  }

  private async prepareArtifactDocument(input: {
    bucket: 'analytics' | 'exports';
    fileName: string;
    language: string;
    content: string;
  }): Promise<vscode.TextDocument> {
    return await prepareRuntimeArtifactDocument(input);
  }

  private syncView(viewState: RuntimeDashboardViewState): void {
    this.updateStatusBar(viewState);
    this.panel.update(viewState);
  }

  private updateStatusBar(viewState: RuntimeDashboardViewState): void {
    const latest = viewState.latestSession;

    if (!latest) {
      this.statusBar.text = 'TokenLint Cost: awaiting telemetry';
      this.statusBar.tooltip = 'Open the TokenLint Cost Dashboard to inspect runtime cost, credits, and cache efficiency once telemetry is available.';
      return;
    }

    const contextTokens = latest.promptTokens + latest.completionTokens;
    this.statusBar.text = [
      'TokenLint Cost',
      `Context: ${formatCompactNumber(contextTokens)}`,
      `Cache: ${latest.cacheEfficiency.toFixed(0)}%`,
      `Cost: $${latest.estimatedCost.toFixed(2)}`,
      `Health: ${Math.round(viewState.summary.contextHealth)}`
    ].join('  ');
    this.statusBar.tooltip = [
      `Title: ${latest.title}`,
      `Workspace: ${latest.workspace}`,
      `Model: ${latest.model}`,
      `Reasoning risk: ${viewState.summary.reasoningRisk.toUpperCase()}`,
      `Context health: ${viewState.summary.contextHealth}/100`,
      'Open the TokenLint Cost Dashboard for full analytics.'
    ].join('\n');
  }

  private async exportView(format: 'csv' | 'json', view: RuntimeDashboardExportView = 'all'): Promise<void> {
    const viewState = this.buildViewState();
    const content = format === 'json'
      ? JSON.stringify(buildExportPayload(viewState, view), null, 2)
      : toCsvForView(viewState, view);
    const language = format === 'json' ? 'json' : 'csv';
    const fileName = format === 'json'
      ? `tokenlint-runtime-${view}.json`
      : `tokenlint-runtime-${view}.csv`;
    const document = await this.prepareArtifactDocument({
      bucket: 'exports',
      fileName,
      language,
      content
    });
    await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
  }
}

function getVisibleWorkspaceFiles(): string[] {
  return [...new Set(vscode.window.visibleTextEditors.map(editor => {
    return vscode.workspace.asRelativePath(editor.document.uri, false);
  }).filter(Boolean))];
}

function resolveWorkspaceName(): string {
  return vscode.workspace.name?.trim() || vscode.workspace.workspaceFolders?.[0]?.name || 'Current workspace';
}

function resolveWorkspaceFilter(workspace: string): string | undefined {
  return workspace === allWorkspacesLabel ? undefined : workspace;
}

function createDefaultFilter(): RuntimeDashboardFilterState {
  return {
    workspace: allWorkspacesLabel,
    timeWindowDays: normalizeTimeWindow(vscode.workspace.getConfiguration('tokenlint').get<number>('runtimeTimeWindowDays'))
  };
}

function normalizeTimeWindow(value: number | undefined): number {
  return Math.min(365, Math.max(1, Math.round(value ?? 7)));
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return String(Math.round(value));
}

function buildFallbackBudget(session: AISession): BudgetResult {
  const usedTokens = session.promptTokens + session.completionTokens;
  const budgetTokens = Math.max(session.contextWindow, usedTokens, 1);

  return {
    budgetTokens,
    usedTokens,
    usagePercent: (usedTokens / budgetTokens) * 100,
    currentFileTokens: 0,
    openFilesTokens: session.promptTokens,
    workspaceTokens: session.promptTokens,
    estimatedRetrievalTokens: Math.round(Math.max(session.retrievalAmplification - 1, 0) * session.promptTokens),
    estimatedFinalContext: usedTokens,
    risk: session.risk
  };
}

function buildExportPayload(viewState: RuntimeDashboardViewState, view: RuntimeDashboardExportView) {
  switch (view) {
    case 'latest':
      return {
        view,
        generatedAt: viewState.generatedAt,
        currentWorkspace: viewState.currentWorkspace,
        filter: viewState.filter,
        summary: viewState.summary,
        latestSession: viewState.latestSession
      };

    case 'aggregate':
      return {
        view,
        generatedAt: viewState.generatedAt,
        currentWorkspace: viewState.currentWorkspace,
        filter: viewState.filter,
        summary: viewState.summary,
        costByModel: viewState.costByModel,
        workspaces: buildWorkspaceExportRows(viewState.sessions),
        cacheBreakdown: viewState.cacheBreakdown,
        retrievalAmplification: viewState.retrievalAmplification,
        cacheEfficiencyTrend: viewState.cacheEfficiencyTrend
      };

    case 'all':
    default:
      return {
        view,
        generatedAt: viewState.generatedAt,
        currentWorkspace: viewState.currentWorkspace,
        filter: viewState.filter,
        summary: viewState.summary,
        sessions: viewState.sessions
      };
  }
}

function toCsvForView(viewState: RuntimeDashboardViewState, view: RuntimeDashboardExportView): string {
  switch (view) {
    case 'latest':
      return toSessionCsv(viewState.latestSession ? [viewState.latestSession] : []);

    case 'aggregate':
      return toAggregateCsv(viewState);

    case 'all':
    default:
      return toSessionCsv(viewState.sessions);
  }
}

function toSessionCsv(sessions: RuntimeDashboardViewState['sessions']): string {
  const lines = [
    ['lastActive', 'source', 'workspace', 'title', 'model', 'cost', 'credits', 'cacheEfficiency', 'cacheSavings', 'promptTokens', 'completionTokens'].join(',')
  ];

  for (const session of sessions) {
    lines.push([
      new Date(session.endedAt ?? session.startedAt).toISOString(),
      escapeCsv(session.source),
      escapeCsv(session.workspace),
      escapeCsv(session.title),
      escapeCsv(session.model),
      session.estimatedCost.toFixed(4),
      session.credits.toFixed(2),
      session.cacheEfficiency.toFixed(1),
      session.cacheSavings.toFixed(4),
      String(session.promptTokens),
      String(session.completionTokens)
    ].join(','));
  }

  return lines.join('\n');
}

function toAggregateCsv(viewState: RuntimeDashboardViewState): string {
  const workspaceRows = buildWorkspaceExportRows(viewState.sessions);
  const lines = [
    ['section', 'key', 'value1', 'value2', 'value3', 'value4'].join(','),
    ['summary', 'sessions', String(viewState.summary.sessions), '', '', ''].join(','),
    ['summary', 'totalCost', viewState.summary.totalCost.toFixed(4), '', '', ''].join(','),
    ['summary', 'totalCredits', viewState.summary.totalCredits.toFixed(2), '', '', ''].join(','),
    ['summary', 'averageCacheEfficiency', viewState.summary.averageCacheEfficiency.toFixed(1), '', '', ''].join(','),
    ['summary', 'averageRetrievalAmplification', viewState.summary.averageRetrievalAmplification.toFixed(2), '', '', ''].join(','),
    ['summary', 'contextHealth', viewState.summary.contextHealth.toFixed(1), '', '', ''].join(',')
  ];

  for (const workspace of workspaceRows) {
    lines.push([
      'workspace',
      escapeCsv(workspace.workspace),
      String(workspace.sessions),
      workspace.cost.toFixed(4),
      workspace.credits.toFixed(2),
      workspace.cacheEfficiency.toFixed(1)
    ].join(','));
  }

  for (const model of viewState.costByModel) {
    lines.push([
      'model',
      escapeCsv(model.model),
      model.cost.toFixed(4),
      model.percent.toFixed(1),
      '',
      ''
    ].join(','));
  }

  return lines.join('\n');
}

function buildWorkspaceExportRows(sessions: AISession[]) {
  const rows = new Map<string, {
    workspace: string;
    sessions: number;
    cost: number;
    credits: number;
    cacheEfficiency: number;
  }>();

  for (const session of sessions) {
    const row = rows.get(session.workspace) ?? {
      workspace: session.workspace,
      sessions: 0,
      cost: 0,
      credits: 0,
      cacheEfficiency: 0
    };
    row.sessions += 1;
    row.cost += session.estimatedCost;
    row.credits += session.credits;
    row.cacheEfficiency += session.cacheEfficiency;
    rows.set(session.workspace, row);
  }

  return [...rows.values()]
    .map(row => ({
      ...row,
      cacheEfficiency: row.sessions === 0 ? 0 : row.cacheEfficiency / row.sessions
    }))
    .sort((left, right) => right.cost - left.cost);
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
