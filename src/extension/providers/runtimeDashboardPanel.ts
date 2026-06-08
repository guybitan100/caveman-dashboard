import * as vscode from 'vscode';

import { RuntimeComparison, RuntimeSnapshot } from '../../runtime/history/runtimeComparison';
import { RuntimeDashboardState } from '../../runtime/session/sessionModels';

import { buildRuntimeDashboardHtml } from './runtimeDashboardHtml';

export type RuntimeDashboardSection = 'overview' | 'sessions' | 'models' | 'workspaces' | 'analysis' | 'history' | 'diff' | 'settings';
export type RuntimeDashboardDiffMode = 'previous' | 'sevenDays' | 'baseline' | 'snapshot';
export type RuntimeDashboardExportView = 'latest' | 'all' | 'aggregate';

export interface RuntimeDashboardFilterState {
  workspace: string;
  timeWindowDays: number;
  favoritesOnly?: boolean;
}

export interface RuntimeDashboardHistorySettings {
  enabled: boolean;
  retentionDays: number;
  maxSnapshots: number;
  snapshotOnScan: boolean;
  snapshotOnDashboardOpen: boolean;
  baseline: string;
}

export interface RuntimeDashboardHistoryState {
  snapshots: RuntimeSnapshot[];
  baselineId?: string;
  activeComparison?: RuntimeComparison;
  diffMode: RuntimeDashboardDiffMode;
  settings: RuntimeDashboardHistorySettings;
}

export interface RuntimeDashboardViewState extends RuntimeDashboardState {
  filter: RuntimeDashboardFilterState;
  activeSection: RuntimeDashboardSection;
  activeView?: RuntimeDashboardExportView;
  history: RuntimeDashboardHistoryState;
  currentWorkspace?: string;
}

export type RuntimeDashboardMessage =
  | { command: 'refreshView' }
  | { command: 'selectView'; view: RuntimeDashboardExportView }
  | { command: 'updateFilter'; workspace?: string; timeWindowDays?: number; favoritesOnly?: boolean }
  | { command: 'exportView'; format: 'csv' | 'json'; view?: RuntimeDashboardExportView }
  | { command: 'toggleFavorite'; sessionId: string }
  | { command: 'saveRuntimeSnapshot' }
  | { command: 'clearOldRuntimeHistory' }
  | { command: 'diffAgainstPrevious' }
  | { command: 'diffAgainstSevenDays' }
  | { command: 'diffAgainstBaseline' }
  | { command: 'compareSnapshot'; snapshotId: string }
  | { command: 'setHistoryBaseline'; snapshotId: string }
  | { command: 'showCostAnalysis' }
  | { command: 'analyzeCacheEfficiency' }
  | { command: 'analyzeRetrievalAmplification' }
  | { command: 'runAnalyzeWorkspace' }
  | { command: 'importTelemetry' }
  | { command: 'openSettings' };

export class RuntimeDashboardPanel {
  private panel: vscode.WebviewPanel | undefined;
  private latestState: RuntimeDashboardViewState | undefined;
  private messageHandler: ((message: RuntimeDashboardMessage) => void) | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  setMessageHandler(handler: (message: RuntimeDashboardMessage) => void): void {
    this.messageHandler = handler;
  }

  show(state: RuntimeDashboardViewState): void {
    this.latestState = state;

    if (this.panel) {
      this.panel.title = 'TokenLint Cost & Token Tracker';
      this.panel.reveal(vscode.ViewColumn.One, true);
      this.postState();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'tokenlint.runtimeDashboard',
      'TokenLint Cost & Token Tracker',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'tokenlint.svg');
    this.panel.webview.html = this.getHtml();
    this.panel.webview.onDidReceiveMessage((message: RuntimeDashboardMessage) => {
      this.messageHandler?.(message);
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    this.postState();
  }

  update(state: RuntimeDashboardViewState): void {
    this.latestState = state;
    this.postState();
  }

  private postState(): void {
    if (!this.panel || !this.latestState) {
      return;
    }

    void this.panel.webview.postMessage({
      type: 'tokenlint.runtimeDashboard',
      payload: this.latestState
    });
  }

  private getHtml(): string {
    return buildRuntimeDashboardHtml(String(Date.now()));
  }
}