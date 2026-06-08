import * as vscode from 'vscode';

import { BudgetResult, WorkspaceBudgetAnalysis } from '../../core/budget/budgetModels';
import { RuntimeSessionManager } from '../../runtime/session/sessionManager';
import { RuntimeSessionStore } from '../../runtime/session/sessionStore';
import { collectRuntimeTelemetry } from '../../runtime/session/telemetryCollector';

import {
  RuntimeDashboardFilterState,
  RuntimeDashboardMessage,
  RuntimeDashboardPanel,
  RuntimeDashboardViewState
} from '../providers/runtimeDashboardPanel';

const defaultFilter: RuntimeDashboardFilterState = {
  workspace: 'All workspaces',
  timeWindowDays: 7
};

type RuntimeBudgetSnapshot = {
  budget: BudgetResult;
  workspaceAnalysis?: WorkspaceBudgetAnalysis;
};

export class RuntimeObservabilityController {
  private readonly panel: RuntimeDashboardPanel;
  private readonly sessionManager: RuntimeSessionManager;
  private readonly statusBar: vscode.StatusBarItem;
  private filter = { ...defaultFilter };

  constructor(
    context: vscode.ExtensionContext,
    panel = new RuntimeDashboardPanel(context.extensionUri),
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  ) {
    this.panel = panel;
    this.statusBar = statusBar;
    this.sessionManager = new RuntimeSessionManager(
      new RuntimeSessionStore(context.globalState)
    );
    this.statusBar.command = 'tokenlint.openRuntimeDashboard';
    this.statusBar.show();
    context.subscriptions.push(this.statusBar);
    this.panel.setMessageHandler(message => {
      void this.handlePanelMessage(message);
    });
    this.updateStatusBar(this.buildViewState());
  }

  async captureBudgetSnapshot(snapshot: RuntimeBudgetSnapshot): Promise<void> {
    const visibleFiles = getVisibleWorkspaceFiles();
    const telemetry = collectRuntimeTelemetry({
      workspace: resolveWorkspaceName(),
      budget: snapshot.budget,
      workspaceAnalysis: snapshot.workspaceAnalysis,
      visibleFiles,
      previousSession: this.sessionManager.getDashboardState({
        workspace: resolveWorkspaceName(),
        timeWindowDays: 30
      }).latestSession
    });

    await this.sessionManager.recordTelemetry(telemetry);
    this.syncView(this.buildViewState());
  }

  async openRuntimeDashboard(): Promise<void> {
    const viewState = this.buildViewState();
    this.updateStatusBar(viewState);
    this.panel.show(viewState);
  }

  async showCostAnalysis(): Promise<void> {
    const viewState = this.buildViewState();
    const latest = viewState.latestSession;

    if (!latest) {
      vscode.window.showInformationMessage('TokenLint: No runtime sessions available yet.');
      return;
    }

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        '# Runtime Cost Analysis',
        '',
        `- Workspace: ${latest.workspace}`,
        `- Session Title: ${latest.title}`,
        `- Model: ${latest.model}`,
        `- Prompt Tokens: ${latest.promptTokens}`,
        `- Completion Tokens: ${latest.completionTokens}`,
        `- Estimated Cost: $${latest.estimatedCost.toFixed(4)}`,
        `- Credits: ${latest.credits.toFixed(2)}`,
        `- Estimated Savings: $${latest.cacheSavings.toFixed(4)}`,
        `- Cache Efficiency: ${latest.cacheEfficiency.toFixed(1)}%`,
        '',
        `Aggregate cost in the selected window: $${viewState.summary.totalCost.toFixed(2)}`,
        `Aggregate savings in the selected window: $${viewState.summary.estimatedSavings.toFixed(2)}`,
        `Highest-cost model in the selected window: ${viewState.costByModel[0]?.model ?? 'N/A'}`
      ].join('\n')
    });

    await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
  }

  async analyzeCacheEfficiency(): Promise<void> {
    const viewState = this.buildViewState();
    const latest = viewState.latestSession;

    if (!latest) {
      vscode.window.showInformationMessage('TokenLint: No runtime sessions available yet.');
      return;
    }

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        '# Cache Efficiency Analysis',
        '',
        `- Average Cache Efficiency: ${viewState.summary.averageCacheEfficiency.toFixed(1)}%`,
        `- Estimated Savings: $${viewState.summary.estimatedSavings.toFixed(2)}`,
        `- Total Prompt Tokens: ${viewState.cacheBreakdown.totalTokens}`,
        `- Latest Session Cache Read Tokens: ${latest.cacheReadTokens}`,
        `- Latest Session Cache Create Tokens: ${latest.cacheCreateTokens}`,
        `- Prompt Stability: ${latest.promptStability.toFixed(1)}%`,
        '',
        latest.promptStability < 55
          ? 'High context mutation detected. Prompt regions are volatile and cache reuse is being eroded.'
          : 'Prompt stability is healthy enough to sustain useful cache reuse across repeated runtime sessions.'
      ].join('\n')
    });

    await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
  }

  async analyzeRetrievalAmplification(): Promise<void> {
    const viewState = this.buildViewState();
    const latest = viewState.latestSession;

    if (!latest) {
      vscode.window.showInformationMessage('TokenLint: No runtime sessions available yet.');
      return;
    }

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        '# Retrieval Amplification Analysis',
        '',
        `- Latest Retrieval Amplification: ${latest.retrievalAmplification.toFixed(2)}x`,
        `- Average Retrieval Amplification: ${viewState.summary.averageRetrievalAmplification.toFixed(2)}x`,
        `- Peak Retrieval Amplification: ${Math.max(0, ...viewState.retrievalAmplification.map(point => point.amplification)).toFixed(2)}x`,
        `- Context Pressure: ${latest.contextPressure.toFixed(1)}%`,
        `- Retrieval Files: ${latest.retrievalFiles.join(', ') || 'None'}`,
        '',
        latest.retrievalAmplification >= 4
          ? 'Cognitive overload risk detected: retrieval breadth is dominating the final context window.'
          : 'Retrieval overhead is present but still within a moderate runtime profile.'
      ].join('\n')
    });

    await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
  }

  private async handlePanelMessage(message: RuntimeDashboardMessage): Promise<void> {
    switch (message.command) {
      case 'refreshView':
        this.syncView(this.buildViewState());
        return;

      case 'updateFilter':
        this.filter = {
          workspace: message.workspace?.trim() || defaultFilter.workspace,
          timeWindowDays: normalizeTimeWindow(message.timeWindowDays)
        };
        this.syncView(this.buildViewState());
        return;

      case 'exportView':
        await this.exportView(message.format);
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
    }
  }

  private buildViewState(): RuntimeDashboardViewState {
    return {
      ...this.sessionManager.getDashboardState(this.filter),
      filter: { ...this.filter }
    };
  }

  private syncView(viewState: RuntimeDashboardViewState): void {
    this.updateStatusBar(viewState);
    this.panel.update(viewState);
  }

  private updateStatusBar(viewState: RuntimeDashboardViewState): void {
    const latest = viewState.latestSession;

    if (!latest) {
      this.statusBar.text = 'TokenLint Runtime: awaiting telemetry';
      this.statusBar.tooltip = 'Open the TokenLint Runtime Dashboard to inspect runtime observability once telemetry is available.';
      return;
    }

    const contextTokens = latest.promptTokens + latest.completionTokens;
    this.statusBar.text = [
      'TokenLint Runtime',
      `Context: ${formatCompactNumber(contextTokens)}`,
      `Cache: ${latest.cacheEfficiency.toFixed(0)}%`,
      `Cost: $${latest.estimatedCost.toFixed(2)}`
    ].join('  ');
    this.statusBar.tooltip = [
      `Title: ${latest.title}`,
      `Workspace: ${latest.workspace}`,
      `Model: ${latest.model}`,
      `Reasoning risk: ${viewState.summary.reasoningRisk.toUpperCase()}`,
      `Context health: ${viewState.summary.contextHealth}/100`,
      'Open the TokenLint Runtime Dashboard for full analytics.'
    ].join('\n');
  }

  private async exportView(format: 'csv' | 'json'): Promise<void> {
    const viewState = this.buildViewState();
    const content = format === 'json'
      ? JSON.stringify(viewState, null, 2)
      : toCsv(viewState.sessions);
    const language = format === 'json' ? 'json' : 'csv';
    const document = await vscode.workspace.openTextDocument({ language, content });
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

function normalizeTimeWindow(value: number | undefined): number {
  const rounded = Math.round(value ?? defaultFilter.timeWindowDays);
  if (rounded <= 1) {
    return 1;
  }

  if (rounded >= 30) {
    return 30;
  }

  return 7;
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

function toCsv(sessions: RuntimeDashboardViewState['sessions']): string {
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
      String(session.completionTokens),
    ].join(','));
  }

  return lines.join('\n');
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}