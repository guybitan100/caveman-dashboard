import * as vscode from 'vscode';

import { RuntimeComparison, RuntimeSnapshot } from '../../runtime/history/runtimeComparison';
import { MODEL_PRICING } from '../../runtime/session/modelPricing';
import { RuntimeDashboardState } from '../../runtime/session/sessionModels';

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
  history: RuntimeDashboardHistoryState;
  currentWorkspace?: string;
}

export type RuntimeDashboardMessage =
  | { command: 'refreshView' }
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
    const nonce = String(Date.now());
    const pricingPayload = JSON.stringify(MODEL_PRICING);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0f16;
      --panel: #151a23;
      --panel-strong: #1a202c;
      --panel-soft: #10151e;
      --border: #2a303a;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --accent: #3b82f6;
      --accent-soft: rgba(59, 130, 246, 0.18);
      --amber: #fbbf24;
      --red: #ef4444;
      --green: #22c55e;
      --yellow: #f59e0b;
      --shadow: 0 18px 36px rgba(0, 0, 0, 0.26);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 24%),
        radial-gradient(circle at top left, rgba(34, 197, 94, 0.08), transparent 24%),
        linear-gradient(180deg, #0b0f16, #0a0e15);
      color: var(--text);
      font-family: 'SF Pro Text', 'Segoe UI', var(--vscode-font-family);
    }

    button,
    select,
    input {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    .shell {
      max-width: 1280px;
      margin: 0 auto;
      padding: 18px 22px 26px;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 18px 0 16px;
      border-bottom: 1px solid rgba(42, 48, 58, 0.76);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .brand-mark {
      width: 18px;
      height: 18px;
      border-radius: 6px;
      background:
        linear-gradient(180deg, rgba(34, 197, 94, 0.95), rgba(59, 130, 246, 0.95));
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04);
      position: relative;
      overflow: hidden;
      flex: 0 0 auto;
    }

    .brand-mark::before,
    .brand-mark::after {
      content: '';
      position: absolute;
      bottom: 3px;
      width: 3px;
      border-radius: 999px;
      background: rgba(11, 15, 22, 0.85);
    }

    .brand-mark::before {
      left: 5px;
      height: 6px;
      box-shadow: 5px -3px 0 0 rgba(11, 15, 22, 0.85), 10px -7px 0 0 rgba(11, 15, 22, 0.85);
    }

    .brand-text {
      min-width: 0;
    }

    .brand-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .brand-copy {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .topbar-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .control-label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
    }

    .control-input,
    .control-button,
    .ghost-button,
    .chip-button,
    .table-select,
    .cta-button,
    .mini-button {
      height: 36px;
      border-radius: 10px;
      border: 1px solid rgba(42, 48, 58, 0.92);
      background: rgba(21, 26, 35, 0.92);
      color: var(--text);
      padding: 0 12px;
    }

    .control-input,
    .table-select {
      min-width: 160px;
    }

    .control-button,
    .cta-button {
      background: linear-gradient(180deg, rgba(59, 130, 246, 0.24), rgba(59, 130, 246, 0.14));
      border-color: rgba(59, 130, 246, 0.5);
      color: #dbeafe;
      font-weight: 600;
    }

    .ghost-button,
    .mini-button {
      background: rgba(255, 255, 255, 0.02);
      color: var(--text);
    }

    .tabs {
      display: flex;
      gap: 10px;
      padding: 18px 0 10px;
      border-bottom: 1px solid rgba(42, 48, 58, 0.76);
      margin-bottom: 16px;
      overflow-x: auto;
    }

    .tab-button {
      border: none;
      background: transparent;
      color: rgba(156, 163, 175, 0.92);
      padding: 12px 16px 14px;
      border-bottom: 2px solid transparent;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }

    .tab-button.active {
      color: #dbeafe;
      border-bottom-color: var(--accent);
    }

    .hidden {
      display: none !important;
    }

    .panel {
      border: 1px solid rgba(42, 48, 58, 0.92);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(21, 26, 35, 0.96), rgba(17, 22, 30, 0.96));
      box-shadow: var(--shadow);
    }

    .kpi-bar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: stretch;
      padding: 16px 18px;
      margin-bottom: 14px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .kpi-card {
      padding-right: 14px;
      border-right: 1px solid rgba(42, 48, 58, 0.92);
    }

    .kpi-card:last-child {
      border-right: none;
      padding-right: 0;
    }

    .eyebrow {
      display: block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .kpi-value {
      margin: 0;
      font-size: 30px;
      line-height: 1;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .kpi-value.amber {
      color: var(--amber);
    }

    .kpi-copy {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .export-panel {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-end;
      gap: 12px;
      min-width: 220px;
    }

    .export-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .section-panel {
      display: none;
      gap: 14px;
    }

    .section-panel.active {
      display: grid;
    }

    .empty-state {
      padding: 34px 28px;
      text-align: left;
      margin-bottom: 14px;
    }

    .empty-title {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .empty-copy {
      margin: 0;
      max-width: 620px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.7;
    }

    .empty-actions {
      display: flex;
      gap: 10px;
      margin-top: 18px;
      flex-wrap: wrap;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 16px 18px 0;
    }

    .section-title {
      margin: 2px 0 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .section-copy {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .latest-shell {
      display: grid;
      gap: 14px;
    }

    .latest-hero {
      padding: 18px;
    }

    .hero-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 16px;
    }

    .hero-title {
      margin: 2px 0 6px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .hero-subtitle {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .hero-badges,
    .table-toolbar-left,
    .table-toolbar-right,
    .action-row,
    .pill-list {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .pill,
    .workspace-pill,
    .source-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    .source-pill,
    .workspace-pill,
    .pill-blue {
      background: rgba(59, 130, 246, 0.18);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.28);
    }

    .pill-muted {
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
      border: 1px solid rgba(42, 48, 58, 0.92);
    }

    .risk-text {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .risk-low { color: var(--green); }
    .risk-medium { color: var(--yellow); }
    .risk-high,
    .risk-critical { color: var(--red); }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .detail-card {
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid rgba(42, 48, 58, 0.92);
      background: rgba(16, 21, 30, 0.88);
    }

    .detail-card h3,
    .detail-card h4 {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .detail-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .detail-item strong {
      color: var(--text);
      font-weight: 600;
      text-align: right;
    }

    .detail-copy {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .detail-copy-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .table-panel {
      overflow: hidden;
    }

    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      padding: 16px 18px;
      border-bottom: 1px solid rgba(42, 48, 58, 0.88);
      flex-wrap: wrap;
    }

    .table-toolbar-left {
      gap: 12px;
    }

    .table-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .divider {
      width: 1px;
      height: 20px;
      background: rgba(42, 48, 58, 0.88);
    }

    .favorites-toggle.active {
      background: rgba(251, 191, 36, 0.16);
      color: #fde68a;
      border-color: rgba(251, 191, 36, 0.35);
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th,
    td {
      text-align: left;
      padding: 0 14px;
      font-size: 13px;
      vertical-align: middle;
      border-bottom: 1px solid rgba(42, 48, 58, 0.88);
    }

    thead th {
      height: 38px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.01);
    }

    tbody tr.session-row {
      height: 46px;
      cursor: pointer;
    }

    tbody tr.session-row:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    tbody tr.detail-row td {
      padding: 14px;
      background: rgba(11, 15, 22, 0.68);
    }

    .expand-button,
    .favorite-button {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 1px solid rgba(42, 48, 58, 0.88);
      background: rgba(255, 255, 255, 0.02);
      color: var(--muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .expand-button.expanded {
      color: var(--text);
      transform: rotate(90deg);
    }

    .favorite-button.active {
      color: var(--amber);
      border-color: rgba(251, 191, 36, 0.42);
    }

    .title-cell {
      min-width: 0;
    }

    .title-text {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    .muted-row {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
      margin-top: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .amber-text {
      color: var(--amber);
      font-weight: 700;
    }

    .cache-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cache-dot {
      width: 11px;
      height: 11px;
      border-radius: 3px;
      display: inline-block;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
    }

    .cache-dot.good { background: var(--green); }
    .cache-dot.partial { background: var(--yellow); }
    .cache-dot.poor { background: var(--red); }

    .aggregate-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .aggregate-panel {
      padding: 16px 18px;
    }

    .summary-list,
    .aggregate-table,
    .history-actions {
      display: grid;
      gap: 10px;
    }

    .aggregate-table-row {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) repeat(4, minmax(0, 0.8fr));
      gap: 10px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid rgba(42, 48, 58, 0.88);
      font-size: 12px;
    }

    .aggregate-table-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .aggregate-table-row.header {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding-top: 0;
    }

    .recommendation-card {
      padding: 12px 14px;
      border: 1px solid rgba(42, 48, 58, 0.88);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.02);
      display: grid;
      gap: 6px;
    }

    .recommendation-card strong {
      font-size: 12px;
      font-weight: 700;
    }

    .recommendation-card span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .history-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 12px;
    }

    .cta-button.secondary,
    .mini-button.secondary {
      background: rgba(255, 255, 255, 0.02);
      color: var(--text);
      border-color: rgba(42, 48, 58, 0.88);
    }

    .footer-note {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
      margin-top: 10px;
    }

    @media (max-width: 1120px) {
      .kpi-bar,
      .aggregate-grid {
        grid-template-columns: 1fr;
      }

      .export-panel {
        align-items: flex-start;
      }
    }

    @media (max-width: 900px) {
      .topbar,
      .table-toolbar,
      .section-header,
      .hero-meta {
        flex-direction: column;
        align-items: flex-start;
      }

      .kpi-grid,
      .detail-grid,
      .history-actions {
        grid-template-columns: 1fr;
      }

      .kpi-card {
        border-right: none;
        padding-right: 0;
        border-bottom: 1px solid rgba(42, 48, 58, 0.88);
        padding-bottom: 12px;
      }

      .kpi-card:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .aggregate-table-row {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 720px) {
      .shell {
        padding: 16px;
      }

      .control-input,
      .table-select {
        min-width: 0;
        width: 100%;
      }

      .topbar-controls,
      .table-toolbar-left,
      .table-toolbar-right,
      .empty-actions,
      .export-buttons {
        width: 100%;
      }

      .control-button,
      .ghost-button,
      .chip-button,
      .cta-button {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"></div>
        <div class="brand-text">
          <h1 class="brand-title">TokenLint Cost & Token Tracker</h1>
          <p class="brand-copy">AI Runtime Cost Observability for sessions, cache reuse, credits, and workspace-level spend inside VS Code.</p>
        </div>
      </div>
      <div class="topbar-controls">
        <span class="control-label">Time window:</span>
        <select id="time-window" class="control-input">
          <option value="today">Today</option>
          <option value="7d">7 days</option>
          <option value="month">This month</option>
          <option value="30d">30 days</option>
          <option value="custom">Custom</option>
        </select>
        <button id="refresh-button" class="control-button">Refresh</button>
      </div>
    </header>

    <div id="custom-window-controls" class="topbar-controls hidden" style="padding-top: 12px; justify-content: flex-end;">
      <span class="control-label">Custom range:</span>
      <input id="custom-start" class="control-input" type="date" />
      <input id="custom-end" class="control-input" type="date" />
      <button id="apply-custom-window" class="ghost-button">Apply</button>
    </div>

    <nav class="tabs" aria-label="Dashboard tabs">
      <button class="tab-button" data-tab="latest">Latest Session</button>
      <button class="tab-button" data-tab="all">All Sessions</button>
      <button class="tab-button" data-tab="aggregate">Aggregate</button>
    </nav>

    <section id="empty-state" class="panel empty-state hidden"></section>

    <section id="kpi-shell" class="panel kpi-bar">
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="eyebrow">Sessions</span>
          <p id="kpi-sessions" class="kpi-value">0</p>
          <div id="kpi-sessions-copy" class="kpi-copy">All workspaces · 0 sessions</div>
        </div>
        <div class="kpi-card">
          <span class="eyebrow">Cost</span>
          <p id="kpi-cost" class="kpi-value amber">$0.00</p>
          <div id="kpi-cost-copy" class="kpi-copy">All workspaces · fully loaded</div>
        </div>
        <div class="kpi-card">
          <span class="eyebrow">Credits</span>
          <p id="kpi-credits" class="kpi-value amber">0.00</p>
          <div class="kpi-copy">1 credit = $0.01 USD</div>
        </div>
      </div>
      <div class="export-panel">
        <span class="eyebrow">Export Selected View</span>
        <div class="export-buttons">
          <button id="export-csv" class="ghost-button">CSV</button>
          <button id="export-json" class="ghost-button">JSON</button>
        </div>
      </div>
    </section>

    <section id="section-latest" class="section-panel"></section>
    <section id="section-all" class="section-panel"></section>
    <section id="section-aggregate" class="section-panel"></section>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const MODEL_PRICING = ${pricingPayload};
    const persisted = vscode.getState() || {};
    const numberFormatter = new Intl.NumberFormat('en-US');
    const creditFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 });

    let currentState = null;
    let activeTab = typeof persisted.activeTab === 'string' ? persisted.activeTab : 'all';
    let lastSectionFromState = typeof persisted.lastSectionFromState === 'string' ? persisted.lastSectionFromState : '';
    let timeWindowKey = typeof persisted.timeWindowKey === 'string' ? persisted.timeWindowKey : '';
    let customStart = typeof persisted.customStart === 'string' ? persisted.customStart : '';
    let customEnd = typeof persisted.customEnd === 'string' ? persisted.customEnd : '';
    let expandedSessionIds = new Set(Array.isArray(persisted.expandedSessionIds) ? persisted.expandedSessionIds : []);

    function persistState() {
      vscode.setState({
        activeTab,
        lastSectionFromState,
        timeWindowKey,
        customStart,
        customEnd,
        expandedSessionIds: Array.from(expandedSessionIds)
      });
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatNumber(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return numberFormatter.format(Math.round(value * 100) / 100);
    }

    function formatCredits(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return creditFormatter.format(value);
    }

    function formatCurrency(value, precise) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return (precise ? preciseCurrencyFormatter : currencyFormatter).format(value);
    }

    function formatPercent(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '') + '%';
    }

    function formatTokenCount(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return numberFormatter.format(Math.max(0, Math.round(value)));
    }

    function formatCompactTokens(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      const absolute = Math.abs(value);
      if (absolute >= 1000000) {
        return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      }

      if (absolute >= 1000) {
        return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
      }

      return String(Math.round(value));
    }

    function pad(value) {
      return String(value).padStart(2, '0');
    }

    function formatUtcTimestamp(timestamp) {
      if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
        return '--';
      }

      const date = new Date(timestamp);
      return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) + ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ' UTC';
    }

    function formatIsoTimestamp(value) {
      if (!value) {
        return '--';
      }

      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? '--' : formatUtcTimestamp(parsed);
    }

    function toDateInputValue(date) {
      return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
    }

    function currentWorkspaceName(state) {
      if (state && state.currentWorkspace) {
        return state.currentWorkspace;
      }

      if (state && state.latestSession && state.latestSession.workspace) {
        return state.latestSession.workspace;
      }

      if (state && Array.isArray(state.workspaces)) {
        const specific = state.workspaces.find(function (workspace) { return workspace !== 'All workspaces'; });
        if (specific) {
          return specific;
        }
      }

      return 'Current workspace';
    }

    function mapSectionToTab(section) {
      switch (section) {
        case 'models':
        case 'workspaces':
        case 'analysis':
        case 'history':
        case 'diff':
        case 'settings':
          return 'aggregate';
        case 'sessions':
        case 'overview':
        default:
          return 'all';
      }
    }

    function inferTimeWindowKey(days) {
      if (days <= 1) {
        return 'today';
      }

      if (days <= 7) {
        return '7d';
      }

      return 'month';
    }

    function monthWindowDays() {
      const now = new Date();
      return Math.max(1, now.getUTCDate());
    }

    function customWindowDays() {
      const start = Date.parse(customStart + 'T00:00:00.000Z');
      const end = Date.parse(customEnd + 'T00:00:00.000Z');

      if (Number.isNaN(start) || Number.isNaN(end)) {
        return 7;
      }

      const diff = Math.floor((Math.max(end, start) - Math.min(end, start)) / 86400000) + 1;
      return Math.max(1, diff);
    }

    function selectedTimeWindowDays() {
      switch (timeWindowKey) {
        case 'today':
          return 1;
        case '7d':
          return 7;
        case '30d':
          return 30;
        case 'custom':
          return customWindowDays();
        case 'month':
        default:
          return monthWindowDays();
      }
    }

    function workspaceLabel(state) {
      const workspace = state && state.filter && state.filter.workspace ? state.filter.workspace : 'All workspaces';
      const suffix = state && state.filter && state.filter.favoritesOnly ? ' · favorites' : '';
      return workspace + suffix;
    }

    function cacheStatus(efficiency) {
      if (efficiency > 70) {
        return {
          tone: 'good',
          label: 'Strong cache reuse',
          copy: 'Strong cache reuse. Prompt regions are stable and runtime recomputation is low.'
        };
      }

      if (efficiency >= 30) {
        return {
          tone: 'partial',
          label: 'Partial cache reuse',
          copy: 'Partial cache reuse. Some prompt regions are stable but mutation is still driving spend.'
        };
      }

      return {
        tone: 'poor',
        label: 'Poor cache reuse',
        copy: 'Low cache reuse. Context churn is causing expensive prompt recomputation.'
      };
    }

    function resolveModelPricing(modelName) {
      return MODEL_PRICING.find(function (entry) { return entry.model === modelName; }) || MODEL_PRICING[0];
    }

    function costBreakdown(session) {
      const pricing = resolveModelPricing(session.model);
      const promptTokens = Math.max(Number(session.promptTokens) || 0, 0);
      const completionTokens = Math.max(Number(session.completionTokens) || 0, 0);
      const cacheReadTokens = Math.max(Number(session.cacheReadTokens) || 0, 0);
      const nonCachedPromptTokens = Math.max(promptTokens - cacheReadTokens, 0);
      const inputCost = (nonCachedPromptTokens / 1000000) * pricing.inputPerMillion;
      const outputCost = (completionTokens / 1000000) * pricing.outputPerMillion;
      const cacheCost = (cacheReadTokens / 1000000) * pricing.cachePerMillion;

      return {
        model: pricing.model,
        nonCachedPromptTokens,
        inputCost,
        outputCost,
        cacheCost,
        totalCost: session.estimatedCost,
        inputPricePer1m: pricing.inputPerMillion,
        outputPricePer1m: pricing.outputPerMillion,
        cachePricePer1m: pricing.cachePerMillion
      };
    }

    function buildSuggestions(session, state) {
      const suggestions = [];

      if (session.cacheEfficiency < 30) {
        suggestions.push('Stabilize prompt regions and retrieval ordering to improve cache reuse.');
      }

      if (session.retrievalAmplification > 8) {
        suggestions.push('Reduce retrieval breadth or tighten chunk selection to control amplification.');
      }

      if (session.contextPressure > 75) {
        suggestions.push('Trim tool output or prompt breadth before switching to a larger model.');
      }

      if (state && state.costByModel && state.costByModel[0] && state.costByModel[0].percent > 65) {
        suggestions.push('Review model routing. A single model is dominating the current runtime spend.');
      }

      if (session.model !== 'GPT-5 mini' && session.contextPressure < 55) {
        suggestions.push('Evaluate GPT-5 mini for lower-pressure runs to improve cost efficiency.');
      }

      if (suggestions.length === 0) {
        suggestions.push('Current session is within a healthy operating envelope. No immediate optimization is required.');
      }

      return suggestions;
    }

    function sessionFiles(session) {
      const values = [];

      (session.files || []).forEach(function (file) {
        if (file && !values.includes(file)) {
          values.push(file);
        }
      });
      (session.promptFiles || []).forEach(function (file) {
        if (file && !values.includes(file)) {
          values.push(file);
        }
      });
      (session.retrievalFiles || []).forEach(function (file) {
        if (file && !values.includes(file)) {
          values.push(file);
        }
      });

      return values;
    }

    function detailCards(session, state) {
      const pricing = costBreakdown(session);
      const cache = cacheStatus(session.cacheEfficiency);
      const files = sessionFiles(session);
      const suggestions = buildSuggestions(session, state);

      return ''
        + '<div class="detail-grid">'
        + '  <section class="detail-card">'
        + '    <h3>Token Breakdown</h3>'
        + '    <div class="detail-list">'
        + '      <div class="detail-item"><span>Prompt Tokens</span><strong>' + escapeHtml(formatTokenCount(session.promptTokens)) + '</strong></div>'
        + '      <div class="detail-item"><span>Completion Tokens</span><strong>' + escapeHtml(formatTokenCount(session.completionTokens)) + '</strong></div>'
        + '      <div class="detail-item"><span>Cache Creation Tokens</span><strong>' + escapeHtml(formatTokenCount(session.cacheCreateTokens)) + '</strong></div>'
        + '      <div class="detail-item"><span>Cache Read Tokens</span><strong>' + escapeHtml(formatTokenCount(session.cacheReadTokens)) + '</strong></div>'
        + '    </div>'
        + '  </section>'
        + '  <section class="detail-card">'
        + '    <h3>Cost Breakdown</h3>'
        + '    <div class="detail-list">'
        + '      <div class="detail-item"><span>Non-cached Prompt Tokens</span><strong>' + escapeHtml(formatTokenCount(pricing.nonCachedPromptTokens)) + '</strong></div>'
        + '      <div class="detail-item"><span>Input Cost</span><strong>' + escapeHtml(formatCurrency(pricing.inputCost, true)) + '</strong></div>'
        + '      <div class="detail-item"><span>Output Cost</span><strong>' + escapeHtml(formatCurrency(pricing.outputCost, true)) + '</strong></div>'
        + '      <div class="detail-item"><span>Cache Cost</span><strong>' + escapeHtml(formatCurrency(pricing.cacheCost, true)) + '</strong></div>'
        + '      <div class="detail-item"><span>Estimated Cost</span><strong>' + escapeHtml(formatCurrency(pricing.totalCost, true)) + '</strong></div>'
        + '      <div class="detail-item"><span>Credits</span><strong>' + escapeHtml(formatCredits(session.credits)) + '</strong></div>'
        + '    </div>'
        + '  </section>'
        + '  <section class="detail-card">'
        + '    <h3>Cache Breakdown</h3>'
        + '    <div class="detail-list">'
        + '      <div class="detail-item"><span>Cache Efficiency</span><strong>' + escapeHtml(formatPercent(session.cacheEfficiency)) + '</strong></div>'
        + '      <div class="detail-item"><span>Status</span><strong>' + escapeHtml(cache.label) + '</strong></div>'
        + '      <div class="detail-item"><span>Prompt Stability</span><strong>' + escapeHtml(formatPercent(session.promptStability)) + '</strong></div>'
        + '      <div class="detail-item"><span>Cache Savings</span><strong>' + escapeHtml(formatCurrency(session.cacheSavings, true)) + '</strong></div>'
        + '    </div>'
        + '    <div class="footer-note">' + escapeHtml(cache.copy) + '</div>'
        + '  </section>'
        + '  <section class="detail-card">'
        + '    <h3>Model Details</h3>'
        + '    <div class="detail-list">'
        + '      <div class="detail-item"><span>Model</span><strong>' + escapeHtml(session.model) + '</strong></div>'
        + '      <div class="detail-item"><span>Source</span><strong>' + escapeHtml(String(session.source)) + '</strong></div>'
        + '      <div class="detail-item"><span>Context Window</span><strong>' + escapeHtml(formatTokenCount(session.contextWindow)) + '</strong></div>'
        + '      <div class="detail-item"><span>Latency</span><strong>' + escapeHtml(formatNumber(session.latencyMs)) + ' ms</strong></div>'
        + '    </div>'
        + '  </section>'
        + '  <section class="detail-card">'
        + '    <h3>Files Included</h3>'
        + (files.length === 0
          ? '<div class="detail-copy">No prompt, retrieval, or runtime files were attached to this session.</div>'
          : '<div class="pill-list">' + files.map(function (file) { return '<span class="pill pill-muted">' + escapeHtml(file) + '</span>'; }).join('') + '</div>')
        + '  </section>'
        + '  <section class="detail-card">'
        + '    <h3>Retrieval Amplification</h3>'
        + '    <div class="detail-list">'
        + '      <div class="detail-item"><span>Amplification</span><strong>' + escapeHtml(formatNumber(session.retrievalAmplification)) + 'x</strong></div>'
        + '      <div class="detail-item"><span>Retrieval Files</span><strong>' + escapeHtml(String((session.retrievalFiles || []).length)) + '</strong></div>'
        + '      <div class="detail-item"><span>Requests</span><strong>' + escapeHtml(String(session.requests)) + '</strong></div>'
        + '      <div class="detail-item"><span>Workspace</span><strong>' + escapeHtml(session.workspace) + '</strong></div>'
        + '    </div>'
        + '  </section>'
        + '  <section class="detail-card">'
        + '    <h3>Context Health</h3>'
        + '    <div class="detail-list">'
        + '      <div class="detail-item"><span>Context Pressure</span><strong>' + escapeHtml(formatPercent(session.contextPressure)) + '</strong></div>'
        + '      <div class="detail-item"><span>Risk</span><strong class="risk-text risk-' + escapeHtml(String(session.risk)) + '">' + escapeHtml(String(session.risk).toUpperCase()) + '</strong></div>'
        + '      <div class="detail-item"><span>Prompt Stability</span><strong>' + escapeHtml(formatPercent(session.promptStability)) + '</strong></div>'
        + '      <div class="detail-item"><span>Cache Reuse</span><strong>' + escapeHtml(formatPercent(session.cacheEfficiency)) + '</strong></div>'
        + '    </div>'
        + '  </section>'
        + '  <section class="detail-card">'
        + '    <h3>Optimization Suggestions</h3>'
        + '    <ul class="detail-copy-list">'
        + suggestions.map(function (suggestion) { return '<li>' + escapeHtml(suggestion) + '</li>'; }).join('')
        + '    </ul>'
        + '  </section>'
        + '</div>';
    }

    function workspaceAggregates(sessions) {
      const aggregates = new Map();
      (sessions || []).forEach(function (session) {
        const current = aggregates.get(session.workspace) || {
          workspace: session.workspace,
          sessions: 0,
          cost: 0,
          credits: 0,
          cacheEfficiency: 0
        };
        current.sessions += 1;
        current.cost += Number(session.estimatedCost) || 0;
        current.credits += Number(session.credits) || 0;
        current.cacheEfficiency += Number(session.cacheEfficiency) || 0;
        aggregates.set(session.workspace, current);
      });

      return Array.from(aggregates.values())
        .map(function (entry) {
          return {
            workspace: entry.workspace,
            sessions: entry.sessions,
            cost: entry.cost,
            credits: entry.credits,
            cacheEfficiency: entry.sessions ? entry.cacheEfficiency / entry.sessions : 0
          };
        })
        .sort(function (left, right) { return right.cost - left.cost; });
    }

    function modelAggregates(state) {
      const counts = new Map();
      (state.sessions || []).forEach(function (session) {
        counts.set(session.model, (counts.get(session.model) || 0) + 1);
      });

      return (state.costByModel || []).map(function (entry) {
        return {
          model: entry.model,
          sessions: counts.get(entry.model) || 0,
          cost: entry.cost,
          percent: entry.percent
        };
      });
    }

    function aggregateRecommendations(state) {
      const suggestions = [];

      if (state.summary.averageCacheEfficiency < 30) {
        suggestions.push({
          title: 'Cache reuse is poor',
          copy: 'Average cache efficiency is below 30%. Focus on prompt stability and repeated context regions first.'
        });
      }

      if (state.summary.averageRetrievalAmplification > 6) {
        suggestions.push({
          title: 'Retrieval amplification is expensive',
          copy: 'Retrieval breadth is inflating prompt cost. Tighten chunking, ranking, and top-k defaults.'
        });
      }

      if (state.summary.contextHealth < 55) {
        suggestions.push({
          title: 'Context health needs intervention',
          copy: 'Low context health indicates saturation, instability, or retrieval waste across the active window.'
        });
      }

      if (state.costByModel && state.costByModel[0] && state.costByModel[0].percent > 70) {
        suggestions.push({
          title: 'Spend is concentrated in one model',
          copy: state.costByModel[0].model + ' is carrying most of the runtime cost. Review model-routing thresholds.'
        });
      }

      if (suggestions.length === 0) {
        suggestions.push({
          title: 'Runtime is operating efficiently',
          copy: 'No dominant cost regression is visible in the current window. Keep monitoring for model skew and cache drift.'
        });
      }

      return suggestions;
    }

    function emptyStateMarkup(state) {
      const hasHistory = state && state.history && Array.isArray(state.history.snapshots) && state.history.snapshots.length > 0;
      const title = hasHistory ? 'No sessions match the current filters.' : 'No sessions recorded yet.';
      const copy = hasHistory
        ? 'Adjust the workspace or time-window filters to bring matching runtime sessions back into view.'
        : 'Run an AI session or import telemetry to populate this dashboard.';

      return ''
        + '<h2 class="empty-title">' + escapeHtml(title) + '</h2>'
        + '<p class="empty-copy">' + escapeHtml(copy) + '</p>'
        + '<div class="empty-actions">'
        + '  <button class="cta-button" data-command="runAnalyzeWorkspace">Analyze Workspace</button>'
        + '  <button class="cta-button secondary" data-command="importTelemetry">Import Telemetry</button>'
        + '  <button class="cta-button secondary" data-command="openSettings">Open Settings</button>'
        + '</div>';
    }

    function latestMarkup(state) {
      const session = state.latestSession;
      if (!session) {
        return ''
          + '<div class="panel latest-hero">'
          + '  <div class="section-header">'
          + '    <div><span class="eyebrow">Latest Session</span><h2 class="section-title">No runtime session is available in this window.</h2></div>'
          + '  </div>'
          + '</div>';
      }

      const pricing = costBreakdown(session);
      return ''
        + '<div class="latest-shell">'
        + '  <section class="panel latest-hero">'
        + '    <div class="hero-meta">'
        + '      <div>'
        + '        <span class="eyebrow">Latest Session</span>'
        + '        <h2 class="hero-title">' + escapeHtml(session.title) + '</h2>'
        + '        <div class="hero-subtitle">' + escapeHtml(formatUtcTimestamp(session.endedAt || session.startedAt)) + ' · ' + escapeHtml(session.workspace) + '</div>'
        + '      </div>'
        + '      <div class="hero-badges">'
        + '        <span class="source-pill">' + escapeHtml(String(session.source)) + '</span>'
        + '        <span class="workspace-pill">' + escapeHtml(session.workspace) + '</span>'
        + '        <span class="risk-text risk-' + escapeHtml(String(session.risk)) + '">' + escapeHtml(String(session.risk).toUpperCase()) + '</span>'
        + '      </div>'
        + '    </div>'
        + '    <div class="detail-grid">'
        + '      <section class="detail-card">'
        + '        <h3>Session Summary</h3>'
        + '        <div class="detail-list">'
        + '          <div class="detail-item"><span>Model</span><strong>' + escapeHtml(session.model) + '</strong></div>'
        + '          <div class="detail-item"><span>Estimated Cost</span><strong class="amber-text">' + escapeHtml(formatCurrency(session.estimatedCost, true)) + '</strong></div>'
        + '          <div class="detail-item"><span>Credits</span><strong class="amber-text">' + escapeHtml(formatCredits(session.credits)) + '</strong></div>'
        + '          <div class="detail-item"><span>Cache Efficiency</span><strong>' + escapeHtml(formatPercent(session.cacheEfficiency)) + '</strong></div>'
        + '          <div class="detail-item"><span>Retrieval Amplification</span><strong>' + escapeHtml(formatNumber(session.retrievalAmplification)) + 'x</strong></div>'
        + '        </div>'
        + '      </section>'
        + '      <section class="detail-card">'
        + '        <h3>Pricing Reference</h3>'
        + '        <div class="detail-list">'
        + '          <div class="detail-item"><span>Input / 1M</span><strong>' + escapeHtml(formatCurrency(pricing.inputPricePer1m, true)) + '</strong></div>'
        + '          <div class="detail-item"><span>Output / 1M</span><strong>' + escapeHtml(formatCurrency(pricing.outputPricePer1m, true)) + '</strong></div>'
        + '          <div class="detail-item"><span>Cache / 1M</span><strong>' + escapeHtml(formatCurrency(pricing.cachePricePer1m, true)) + '</strong></div>'
        + '          <div class="detail-item"><span>Prompt Tokens</span><strong>' + escapeHtml(formatCompactTokens(session.promptTokens)) + '</strong></div>'
        + '          <div class="detail-item"><span>Completion Tokens</span><strong>' + escapeHtml(formatCompactTokens(session.completionTokens)) + '</strong></div>'
        + '        </div>'
        + '      </section>'
        + '    </div>'
        + '  </section>'
        + '  <section class="panel aggregate-panel">'
        + '    <div class="section-header" style="padding:0 0 16px;">'
        + '      <div><span class="eyebrow">Session Details</span><h2 class="section-title">Expanded session breakdown</h2></div>'
        + '      <span class="section-copy">Token, cost, cache, retrieval, and optimization detail for the latest runtime activity.</span>'
        + '    </div>'
        + detailCards(session, state)
        + '  </section>'
        + '</div>';
    }

    function sessionTableMarkup(state) {
      const sessions = state.sessions || [];
      const workspace = currentWorkspaceName(state);
      const activeWorkspace = state.filter && state.filter.workspace === workspace ? '__current__' : (state.filter && state.filter.workspace ? state.filter.workspace : 'All workspaces');
      const workspaceOptions = ['<option value="All workspaces"' + (activeWorkspace === 'All workspaces' ? ' selected' : '') + '>All workspaces</option>'];

      if (workspace) {
        workspaceOptions.push('<option value="__current__"' + (activeWorkspace === '__current__' ? ' selected' : '') + '>Current workspace</option>');
      }

      (state.workspaces || []).forEach(function (entry) {
        if (entry === 'All workspaces') {
          return;
        }

        workspaceOptions.push('<option value="' + escapeHtml(entry) + '"' + (activeWorkspace === entry ? ' selected' : '') + '>' + escapeHtml(entry) + '</option>');
      });

      const rows = sessions.length === 0
        ? '<tr><td colspan="9" style="padding:18px 14px; color: var(--muted);">No sessions in the selected view.</td></tr>'
        : sessions.map(function (session, index) {
            const expanded = expandedSessionIds.has(session.id || String(index));
            const cache = cacheStatus(session.cacheEfficiency);
            const title = session.title || 'Untitled session';
            const sessionId = session.id || String(index);
            return ''
              + '<tr class="session-row" data-session-row="' + escapeHtml(sessionId) + '">'
              + '  <td><button class="expand-button' + (expanded ? ' expanded' : '') + '" data-expand-session="' + escapeHtml(sessionId) + '" aria-label="Toggle session details">▶</button></td>'
              + '  <td>' + escapeHtml(formatUtcTimestamp(session.endedAt || session.startedAt)) + '</td>'
              + '  <td><span class="source-pill">' + escapeHtml(String(session.source)) + '</span></td>'
              + '  <td><span class="workspace-pill">' + escapeHtml(session.workspace) + '</span></td>'
              + '  <td class="title-cell"><span class="title-text">' + escapeHtml(title) + '</span><div class="muted-row">' + escapeHtml(session.model) + ' · ' + escapeHtml(formatTokenCount(session.promptTokens)) + ' prompt tokens</div></td>'
              + '  <td><button class="favorite-button' + (session.favorite ? ' active' : '') + '" data-favorite-session="' + escapeHtml(sessionId) + '" aria-label="Toggle session favorite">' + (session.favorite ? '★' : '☆') + '</button></td>'
              + '  <td class="amber-text">' + escapeHtml(formatCurrency(session.estimatedCost)) + '</td>'
              + '  <td class="amber-text">' + escapeHtml(formatCredits(session.credits)) + '</td>'
              + '  <td><span class="cache-cell"><span class="cache-dot ' + escapeHtml(cache.tone) + '" title="' + escapeHtml(cache.copy) + '"></span></span></td>'
              + '</tr>'
              + '<tr class="detail-row' + (expanded ? '' : ' hidden') + '"><td colspan="9">' + detailCards(session, state) + '</td></tr>';
          }).join('');

      return ''
        + '<section class="panel table-panel">'
        + '  <div class="table-toolbar">'
        + '    <div class="table-toolbar-left">'
        + '      <h2 class="table-title">Session Activity</h2>'
        + '      <span class="divider"></span>'
        + '      <span class="control-label">Workspace</span>'
        + '      <select id="workspace-filter" class="table-select">' + workspaceOptions.join('') + '</select>'
        + '      <button id="favorites-toggle" class="chip-button favorites-toggle' + ((state.filter && state.filter.favoritesOnly) ? ' active' : '') + '">★ Favorites</button>'
        + '    </div>'
        + '    <div class="table-toolbar-right"><span class="section-copy">Click a row to expand</span></div>'
        + '  </div>'
        + '  <div class="table-wrap">'
        + '    <table>'
        + '      <thead>'
        + '        <tr>'
        + '          <th style="width:48px;">Expand</th>'
        + '          <th style="width:214px;">Last Active</th>'
        + '          <th style="width:104px;">Source</th>'
        + '          <th style="width:160px;">Workspace</th>'
        + '          <th>Title</th>'
        + '          <th style="width:90px;">Favorite</th>'
        + '          <th style="width:90px;">Cost</th>'
        + '          <th style="width:100px;">Credits</th>'
        + '          <th style="width:84px;">Cache</th>'
        + '        </tr>'
        + '      </thead>'
        + '      <tbody>' + rows + '</tbody>'
        + '    </table>'
        + '  </div>'
        + '</section>';
    }

    function aggregateMarkup(state) {
      const workspaces = workspaceAggregates(state.sessions || []);
      const models = modelAggregates(state);
      const recommendations = aggregateRecommendations(state);
      const history = state.history || {
        snapshots: [],
        baselineId: undefined,
        activeComparison: undefined,
        diffMode: 'previous',
        settings: {
          enabled: false,
          retentionDays: 30,
          maxSnapshots: 500,
          snapshotOnScan: true,
          snapshotOnDashboardOpen: true,
          baseline: 'latest'
        }
      };
      const latestSnapshot = history.snapshots && history.snapshots.length ? history.snapshots[0] : undefined;

      const workspaceRows = workspaces.length === 0
        ? '<div class="detail-copy">No workspace aggregates are available in the selected time window.</div>'
        : '<div class="aggregate-table">'
          + '<div class="aggregate-table-row header"><span>Workspace</span><span>Sessions</span><span>Cost</span><span>Credits</span><span>Cache</span></div>'
          + workspaces.map(function (entry) {
              return '<div class="aggregate-table-row"><strong>' + escapeHtml(entry.workspace) + '</strong><span>' + escapeHtml(String(entry.sessions)) + '</span><span class="amber-text">' + escapeHtml(formatCurrency(entry.cost)) + '</span><span class="amber-text">' + escapeHtml(formatCredits(entry.credits)) + '</span><span>' + escapeHtml(formatPercent(entry.cacheEfficiency)) + '</span></div>';
            }).join('')
          + '</div>';

      const modelRows = models.length === 0
        ? '<div class="detail-copy">No model spend has been recorded yet.</div>'
        : '<div class="aggregate-table">'
          + '<div class="aggregate-table-row header"><span>Model</span><span>Sessions</span><span>Cost</span><span>Share</span><span>Context</span></div>'
          + models.map(function (entry) {
              const pricing = resolveModelPricing(entry.model);
              return '<div class="aggregate-table-row"><strong>' + escapeHtml(entry.model) + '</strong><span>' + escapeHtml(String(entry.sessions)) + '</span><span class="amber-text">' + escapeHtml(formatCurrency(entry.cost)) + '</span><span>' + escapeHtml(formatPercent(entry.percent)) + '</span><span>' + escapeHtml(formatCompactTokens(pricing.contextWindow)) + '</span></div>';
            }).join('')
          + '</div>';

      return ''
        + '<div class="aggregate-grid">'
        + '  <section class="panel aggregate-panel">'
        + '    <span class="eyebrow">Workspace</span>'
        + '    <h2 class="section-title">Workspace Spend</h2>'
        + '    <div class="footer-note">Aggregated analytics across workspaces in the active filter.</div>'
        + workspaceRows
        + '  </section>'
        + '  <section class="panel aggregate-panel">'
        + '    <span class="eyebrow">Models</span>'
        + '    <h2 class="section-title">Model Cost Mix</h2>'
        + '    <div class="footer-note">Which model families dominate runtime spend in the selected window.</div>'
        + modelRows
        + '  </section>'
        + '  <section class="panel aggregate-panel">'
        + '    <span class="eyebrow">Runtime Health</span>'
        + '    <h2 class="section-title">Cache, Retrieval, and Context</h2>'
        + '    <div class="summary-list">'
        + '      <div class="detail-item"><span>Average Cache Efficiency</span><strong>' + escapeHtml(formatPercent(state.summary.averageCacheEfficiency)) + '</strong></div>'
        + '      <div class="detail-item"><span>Average Retrieval Amplification</span><strong>' + escapeHtml(formatNumber(state.summary.averageRetrievalAmplification)) + 'x</strong></div>'
        + '      <div class="detail-item"><span>Context Health</span><strong>' + escapeHtml(formatNumber(state.summary.contextHealth)) + ' / 100</strong></div>'
        + '      <div class="detail-item"><span>Estimated Waste</span><strong>' + escapeHtml(formatPercent(state.summary.estimatedWaste)) + '</strong></div>'
        + '      <div class="detail-item"><span>Estimated Savings</span><strong class="amber-text">' + escapeHtml(formatCurrency(state.summary.estimatedSavings)) + '</strong></div>'
        + '      <div class="detail-item"><span>Reasoning Risk</span><strong class="risk-text risk-' + escapeHtml(String(state.summary.reasoningRisk)) + '">' + escapeHtml(String(state.summary.reasoningRisk).toUpperCase()) + '</strong></div>'
        + '    </div>'
        + '  </section>'
        + '  <section class="panel aggregate-panel">'
        + '    <span class="eyebrow">Recommendations</span>'
        + '    <h2 class="section-title">Optimization Suggestions</h2>'
        + '    <div class="summary-list">'
        + recommendations.map(function (entry) {
            return '<div class="recommendation-card"><strong>' + escapeHtml(entry.title) + '</strong><span>' + escapeHtml(entry.copy) + '</span></div>';
          }).join('')
        + '    </div>'
        + '  </section>'
        + '  <section class="panel aggregate-panel">'
        + '    <span class="eyebrow">History</span>'
        + '    <h2 class="section-title">Runtime History</h2>'
        + '    <div class="summary-list">'
        + '      <div class="detail-item"><span>Snapshots</span><strong>' + escapeHtml(formatNumber(history.snapshots.length || 0)) + '</strong></div>'
        + '      <div class="detail-item"><span>Baseline</span><strong>' + escapeHtml(history.baselineId || history.settings.baseline || 'latest') + '</strong></div>'
        + '      <div class="detail-item"><span>Latest Snapshot</span><strong>' + escapeHtml(latestSnapshot ? formatIsoTimestamp(latestSnapshot.createdAt) : '--') + '</strong></div>'
        + '      <div class="detail-item"><span>Diff Mode</span><strong>' + escapeHtml(String(history.diffMode || 'previous')) + '</strong></div>'
        + '    </div>'
        + '    <div class="history-actions">'
        + '      <button class="mini-button secondary" data-command="saveRuntimeSnapshot">Save Snapshot</button>'
        + '      <button class="mini-button secondary" data-command="diffAgainstPrevious">Diff vs Previous</button>'
        + '      <button class="mini-button secondary" data-command="diffAgainstBaseline">Diff vs Baseline</button>'
        + '      <button class="mini-button secondary" data-command="clearOldRuntimeHistory">Clear Old History</button>'
        + '    </div>'
        + '  </section>'
        + '  <section class="panel aggregate-panel">'
        + '    <span class="eyebrow">Deep Analysis</span>'
        + '    <h2 class="section-title">Dedicated Drilldowns</h2>'
        + '    <div class="history-actions">'
        + '      <button class="mini-button secondary" data-command="showCostAnalysis">Cost Analysis</button>'
        + '      <button class="mini-button secondary" data-command="analyzeCacheEfficiency">Cache Efficiency</button>'
        + '      <button class="mini-button secondary" data-command="analyzeRetrievalAmplification">Retrieval Amplification</button>'
        + '      <button class="mini-button secondary" data-command="openSettings">Open Settings</button>'
        + '    </div>'
        + '    <div class="footer-note">Aggregate analytics stay inside the same runtime snapshot so exports, history, and dashboard views share one source of truth.</div>'
        + '  </section>'
        + '</div>';
    }

    function renderKpis(state) {
      document.getElementById('kpi-sessions').textContent = formatNumber(state.summary.sessions);
      document.getElementById('kpi-cost').textContent = formatCurrency(state.summary.totalCost);
      document.getElementById('kpi-credits').textContent = formatCredits(state.summary.totalCredits);
      document.getElementById('kpi-sessions-copy').textContent = workspaceLabel(state) + ' · ' + formatNumber(state.summary.sessions) + ' sessions';
      document.getElementById('kpi-cost-copy').textContent = workspaceLabel(state) + ' · fully loaded';
    }

    function renderEmptyState(state) {
      const empty = document.getElementById('empty-state');
      const kpiShell = document.getElementById('kpi-shell');
      const hasSessions = Boolean(state.summary && state.summary.sessions);

      empty.classList.toggle('hidden', hasSessions);
      kpiShell.classList.toggle('hidden', !hasSessions);
      if (!hasSessions) {
        empty.innerHTML = emptyStateMarkup(state);
      }
    }

    function renderPanels(state) {
      document.getElementById('section-latest').innerHTML = latestMarkup(state);
      document.getElementById('section-all').innerHTML = sessionTableMarkup(state);
      document.getElementById('section-aggregate').innerHTML = aggregateMarkup(state);

      ['latest', 'all', 'aggregate'].forEach(function (tab) {
        const panel = document.getElementById('section-' + tab);
        const button = document.querySelector('[data-tab="' + tab + '"]');
        if (panel) {
          panel.classList.toggle('active', tab === activeTab && Boolean(state.summary.sessions));
        }
        if (button) {
          button.classList.toggle('active', tab === activeTab);
        }
      });
    }

    function syncControls(state) {
      const timeWindow = document.getElementById('time-window');
      const customControls = document.getElementById('custom-window-controls');
      const startInput = document.getElementById('custom-start');
      const endInput = document.getElementById('custom-end');

      if (!timeWindowKey) {
        timeWindowKey = inferTimeWindowKey(state.filter && state.filter.timeWindowDays ? state.filter.timeWindowDays : 30);
      }

      if (!customStart || !customEnd) {
        const end = new Date();
        const start = new Date(Date.now() - 6 * 86400000);
        customStart = toDateInputValue(start);
        customEnd = toDateInputValue(end);
      }

      timeWindow.value = timeWindowKey;
      customControls.classList.toggle('hidden', timeWindowKey !== 'custom');
      startInput.value = customStart;
      endInput.value = customEnd;
    }

    function render(state) {
      currentState = state;

      if (state.activeSection && state.activeSection !== lastSectionFromState) {
        activeTab = mapSectionToTab(state.activeSection);
        lastSectionFromState = state.activeSection;
      }

      syncControls(state);
      renderEmptyState(state);
      if (state.summary && state.summary.sessions) {
        renderKpis(state);
      }
      renderPanels(state);
      persistState();
    }

    function postFilterUpdate(favoritesOnlyOverride) {
      if (!currentState) {
        return;
      }

      const workspaceSelect = document.getElementById('workspace-filter');
      const selectedWorkspace = workspaceSelect
        ? (workspaceSelect.value === '__current__' ? currentWorkspaceName(currentState) : workspaceSelect.value)
        : (currentState.filter && currentState.filter.workspace ? currentState.filter.workspace : 'All workspaces');

      vscode.postMessage({
        command: 'updateFilter',
        workspace: selectedWorkspace,
        timeWindowDays: selectedTimeWindowDays(),
        favoritesOnly: typeof favoritesOnlyOverride === 'boolean'
          ? favoritesOnlyOverride
          : Boolean(currentState.filter && currentState.filter.favoritesOnly)
      });
    }

    document.getElementById('refresh-button').addEventListener('click', function () {
      vscode.postMessage({ command: 'refreshView' });
    });

    document.getElementById('export-csv').addEventListener('click', function () {
      vscode.postMessage({ command: 'exportView', format: 'csv', view: activeTab });
    });

    document.getElementById('export-json').addEventListener('click', function () {
      vscode.postMessage({ command: 'exportView', format: 'json', view: activeTab });
    });

    document.getElementById('time-window').addEventListener('change', function (event) {
      timeWindowKey = event.target.value;
      syncControls(currentState || { filter: { timeWindowDays: 30 } });
      persistState();
      if (timeWindowKey !== 'custom') {
        postFilterUpdate();
      }
    });

    document.getElementById('custom-start').addEventListener('change', function (event) {
      customStart = event.target.value;
      persistState();
    });

    document.getElementById('custom-end').addEventListener('change', function (event) {
      customEnd = event.target.value;
      persistState();
    });

    document.getElementById('apply-custom-window').addEventListener('click', function () {
      postFilterUpdate();
    });

    document.addEventListener('change', function (event) {
      if (event.target && event.target.id === 'workspace-filter') {
        postFilterUpdate();
      }
    });

    document.addEventListener('click', function (event) {
      const favoriteButton = event.target.closest('[data-favorite-session]');
      if (favoriteButton) {
        vscode.postMessage({ command: 'toggleFavorite', sessionId: favoriteButton.dataset.favoriteSession });
        return;
      }

      const expandButton = event.target.closest('[data-expand-session]');
      if (expandButton) {
        const sessionId = expandButton.dataset.expandSession;
        if (expandedSessionIds.has(sessionId)) {
          expandedSessionIds.delete(sessionId);
        } else {
          expandedSessionIds.add(sessionId);
        }
        render(currentState);
        return;
      }

      const tabButton = event.target.closest('[data-tab]');
      if (tabButton) {
        activeTab = tabButton.dataset.tab;
        render(currentState);
        return;
      }

      const favoritesToggle = event.target.closest('#favorites-toggle');
      if (favoritesToggle) {
        const nextValue = !(currentState && currentState.filter && currentState.filter.favoritesOnly);
        postFilterUpdate(nextValue);
        return;
      }

      const commandButton = event.target.closest('[data-command]');
      if (commandButton) {
        const command = commandButton.dataset.command;
        if (command) {
          vscode.postMessage({ command: command });
        }
        return;
      }

      const sessionRow = event.target.closest('[data-session-row]');
      if (sessionRow) {
        const sessionId = sessionRow.dataset.sessionRow;
        if (expandedSessionIds.has(sessionId)) {
          expandedSessionIds.delete(sessionId);
        } else {
          expandedSessionIds.add(sessionId);
        }
        render(currentState);
      }
    });

    window.addEventListener('message', function (event) {
      if (!event.data || event.data.type !== 'tokenlint.runtimeDashboard') {
        return;
      }

      render(event.data.payload);
    });
  </script>
</body>
</html>`;
  }
}
import * as vscode from 'vscode';

import { RuntimeComparison, RuntimeSnapshot } from '../../runtime/history/runtimeComparison';
import { MODEL_PRICING } from '../../runtime/session/modelPricing';
import { RuntimeDashboardState } from '../../runtime/session/sessionModels';

export type RuntimeDashboardSection =
  | 'overview'
  | 'sessions'
  | 'models'
  | 'workspaces'
  | 'analysis'
  | 'history'
  | 'diff'
  | 'settings';
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
  history: RuntimeDashboardHistoryState;
  currentWorkspace?: string;
}

export type RuntimeDashboardMessage =
  | { command: 'refreshView' }
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
    const nonce = String(Date.now());
    return buildRuntimeDashboardHtml(nonce);
  }
}

function buildRuntimeDashboardHtml(nonce: string): string {
  const pricingPayload = JSON.stringify(MODEL_PRICING);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0f16;
      --panel: #151a23;
      --panel-soft: #10151d;
      --border: #2a303a;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --accent: #3b82f6;
      --accent-soft: rgba(59, 130, 246, 0.18);
      --amber: #fbbf24;
      --red: #ef4444;
      --green: #22c55e;
      --yellow: #f59e0b;
      --shadow: 0 18px 36px rgba(0, 0, 0, 0.26);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 24%),
        radial-gradient(circle at top left, rgba(34, 197, 94, 0.08), transparent 24%),
        linear-gradient(180deg, #0b0f16, #090d14);
      color: var(--text);
      font-family: 'SF Pro Text', 'Segoe UI', var(--vscode-font-family);
    }

    button,
    select,
    input {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    .shell {
      max-width: 1280px;
      margin: 0 auto;
      padding: 18px 22px 26px;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 18px 0 16px;
      border-bottom: 1px solid rgba(42, 48, 58, 0.76);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .brand-mark {
      width: 18px;
      height: 18px;
      border-radius: 6px;
      background: linear-gradient(180deg, rgba(34, 197, 94, 0.95), rgba(59, 130, 246, 0.95));
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04);
      flex: 0 0 auto;
    }

    .brand-mark::before,
    .brand-mark::after {
      content: '';
      position: absolute;
      bottom: 3px;
      width: 3px;
      border-radius: 999px;
      background: rgba(11, 15, 22, 0.86);
    }

    .brand-mark::before {
      left: 5px;
      height: 6px;
      box-shadow: 5px -3px 0 0 rgba(11, 15, 22, 0.86), 10px -7px 0 0 rgba(11, 15, 22, 0.86);
    }

    .brand-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .brand-copy {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .control-label,
    .eyebrow {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .control-input,
    .control-button,
    .ghost-button,
    .chip-button,
    .select,
    .action-button {
      height: 36px;
      border-radius: 10px;
      border: 1px solid rgba(42, 48, 58, 0.92);
      background: rgba(21, 26, 35, 0.92);
      color: var(--text);
      padding: 0 12px;
    }

    .control-input,
    .select {
      min-width: 160px;
    }

    .control-button,
    .action-button {
      background: linear-gradient(180deg, rgba(59, 130, 246, 0.22), rgba(59, 130, 246, 0.12));
      border-color: rgba(59, 130, 246, 0.48);
      color: #dbeafe;
      font-weight: 600;
    }

    .ghost-button {
      background: rgba(255, 255, 255, 0.02);
    }

    .tabs {
      display: flex;
      gap: 10px;
      padding: 18px 0 10px;
      border-bottom: 1px solid rgba(42, 48, 58, 0.76);
      margin-bottom: 16px;
      overflow-x: auto;
    }

    .tab-button {
      border: none;
      background: transparent;
      color: rgba(156, 163, 175, 0.92);
      padding: 12px 16px 14px;
      border-bottom: 2px solid transparent;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }

    .tab-button.active {
      color: #dbeafe;
      border-bottom-color: var(--accent);
    }

    .hidden { display: none !important; }

    .panel {
      border: 1px solid rgba(42, 48, 58, 0.92);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(21, 26, 35, 0.96), rgba(17, 22, 30, 0.96));
      box-shadow: var(--shadow);
    }

    .kpi-bar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: stretch;
      padding: 16px 18px;
      margin-bottom: 14px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .kpi-card {
      padding-right: 14px;
      border-right: 1px solid rgba(42, 48, 58, 0.92);
    }

    .kpi-card:last-child {
      border-right: none;
      padding-right: 0;
    }

    .kpi-value {
      margin: 8px 0 0;
      font-size: 30px;
      line-height: 1;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .kpi-value.amber {
      color: var(--amber);
    }

    .kpi-copy {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .export-box {
      min-width: 220px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      gap: 12px;
    }

    .export-actions,
    .toolbar-row,
    .pill-row,
    .empty-actions,
    .history-actions,
    .table-toolbar-left,
    .table-toolbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .section-panel {
      display: none;
      gap: 14px;
    }

    .section-panel.active {
      display: grid;
    }

    .empty-state {
      padding: 34px 28px;
      margin-bottom: 14px;
    }

    .empty-title {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .empty-copy {
      margin: 0;
      max-width: 620px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.7;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 16px 18px 0;
      flex-wrap: wrap;
    }

    .section-title {
      margin: 2px 0 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .section-copy {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .pill,
    .source-pill,
    .workspace-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      background: rgba(59, 130, 246, 0.18);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.28);
    }

    .pill-muted {
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
      border: 1px solid rgba(42, 48, 58, 0.92);
    }

    .risk-low { color: var(--green); }
    .risk-medium { color: var(--yellow); }
    .risk-high,
    .risk-critical { color: var(--red); }

    .latest-shell {
      display: grid;
      gap: 14px;
    }

    .latest-hero,
    .aggregate-panel,
    .table-panel {
      padding: 16px 18px;
    }

    .hero-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .hero-title {
      margin: 2px 0 6px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .hero-copy {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .detail-grid,
    .aggregate-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .detail-card,
    .recommendation-card {
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid rgba(42, 48, 58, 0.92);
      background: rgba(16, 21, 29, 0.92);
    }

    .detail-card h3 {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 700;
    }

    .detail-list {
      display: grid;
      gap: 8px;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .detail-item strong {
      color: var(--text);
      font-weight: 600;
      text-align: right;
    }

    .detail-copy,
    .recommendation-card span,
    .footer-note,
    .muted-row {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .detail-copy-list {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .amber-text {
      color: var(--amber);
      font-weight: 700;
    }

    .table-panel {
      overflow: hidden;
      padding: 0;
    }

    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      padding: 16px 18px;
      border-bottom: 1px solid rgba(42, 48, 58, 0.88);
      flex-wrap: wrap;
    }

    .table-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
    }

    .divider {
      width: 1px;
      height: 20px;
      background: rgba(42, 48, 58, 0.88);
    }

    .favorites-toggle.active {
      background: rgba(251, 191, 36, 0.16);
      color: #fde68a;
      border-color: rgba(251, 191, 36, 0.35);
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th,
    td {
      text-align: left;
      padding: 0 14px;
      font-size: 13px;
      vertical-align: middle;
      border-bottom: 1px solid rgba(42, 48, 58, 0.88);
    }

    thead th {
      height: 38px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.01);
      white-space: nowrap;
    }

    tbody tr.session-row {
      height: 46px;
      cursor: pointer;
    }

    tbody tr.session-row:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    tbody tr.detail-row td {
      padding: 14px;
      background: rgba(11, 15, 22, 0.68);
    }

    .expand-button,
    .favorite-button {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 1px solid rgba(42, 48, 58, 0.88);
      background: rgba(255, 255, 255, 0.02);
      color: var(--muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .expand-button.expanded {
      color: var(--text);
      transform: rotate(90deg);
    }

    .favorite-button.active {
      color: var(--amber);
      border-color: rgba(251, 191, 36, 0.42);
    }

    .title-cell {
      min-width: 0;
    }

    .title-text {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    .cache-dot {
      width: 11px;
      height: 11px;
      border-radius: 3px;
      display: inline-block;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
    }

    .cache-dot.good { background: var(--green); }
    .cache-dot.partial { background: var(--yellow); }
    .cache-dot.poor { background: var(--red); }

    .aggregate-grid {
      gap: 14px;
    }

    .aggregate-table {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }

    .aggregate-row {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) repeat(4, minmax(0, 0.8fr));
      gap: 10px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid rgba(42, 48, 58, 0.88);
      font-size: 12px;
    }

    .aggregate-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .aggregate-row.header {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding-top: 0;
    }

    .recommendation-card {
      display: grid;
      gap: 6px;
    }

    .recommendation-card strong {
      font-size: 12px;
      font-weight: 700;
    }

    @media (max-width: 1120px) {
      .kpi-bar,
      .aggregate-grid {
        grid-template-columns: 1fr;
      }

      .export-box {
        align-items: flex-start;
      }
    }

    @media (max-width: 920px) {
      .topbar,
      .table-toolbar,
      .section-header,
      .hero-meta {
        flex-direction: column;
        align-items: flex-start;
      }

      .kpi-grid,
      .detail-grid,
      .aggregate-grid {
        grid-template-columns: 1fr;
      }

      .kpi-card {
        border-right: none;
        padding-right: 0;
        border-bottom: 1px solid rgba(42, 48, 58, 0.88);
        padding-bottom: 12px;
      }

      .kpi-card:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .aggregate-row {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 720px) {
      .shell {
        padding: 16px;
      }

      .control-input,
      .select,
      .control-button,
      .ghost-button,
      .chip-button,
      .action-button {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"></div>
        <div>
          <h1 class="brand-title">TokenLint Cost & Token Tracker</h1>
          <p class="brand-copy">AI Runtime Cost Observability for sessions, cache reuse, credits, and workspace-level spend inside VS Code.</p>
        </div>
      </div>
      <div class="toolbar">
        <span class="control-label">Time window:</span>
        <select id="time-window" class="control-input">
          <option value="today">Today</option>
          <option value="7d">7 days</option>
          <option value="month">This month</option>
          <option value="30d">30 days</option>
          <option value="custom">Custom</option>
        </select>
        <button id="refresh-button" class="control-button">Refresh</button>
      </div>
    </header>

    <div id="custom-controls" class="toolbar hidden" style="justify-content:flex-end; padding-top: 12px;">
      <span class="control-label">Custom range:</span>
      <input id="custom-start" class="control-input" type="date" />
      <input id="custom-end" class="control-input" type="date" />
      <button id="apply-custom-range" class="ghost-button">Apply</button>
    </div>

    <nav class="tabs" aria-label="Dashboard tabs">
      <button class="tab-button" data-tab="latest">Latest Session</button>
      <button class="tab-button" data-tab="all">All Sessions</button>
      <button class="tab-button" data-tab="aggregate">Aggregate</button>
    </nav>

    <section id="empty-state" class="panel empty-state hidden"></section>

    <section id="kpi-shell" class="panel kpi-bar">
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="eyebrow">Sessions</span>
          <p id="kpi-sessions" class="kpi-value">0</p>
          <div id="kpi-sessions-copy" class="kpi-copy">All workspaces · 0 sessions</div>
        </div>
        <div class="kpi-card">
          <span class="eyebrow">Cost</span>
          <p id="kpi-cost" class="kpi-value amber">$0.00</p>
          <div id="kpi-cost-copy" class="kpi-copy">All workspaces · fully loaded</div>
        </div>
        <div class="kpi-card">
          <span class="eyebrow">Credits</span>
          <p id="kpi-credits" class="kpi-value amber">0.00</p>
          <div class="kpi-copy">1 credit = $0.01 USD</div>
        </div>
      </div>
      <div class="export-box">
        <span class="eyebrow">Export Selected View</span>
        <div class="export-actions">
          <button id="export-csv" class="ghost-button">CSV</button>
          <button id="export-json" class="ghost-button">JSON</button>
        </div>
      </div>
    </section>

    <section id="tab-latest" class="section-panel"></section>
    <section id="tab-all" class="section-panel"></section>
    <section id="tab-aggregate" class="section-panel"></section>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const MODEL_PRICING = ${pricingPayload};
    const persisted = vscode.getState() || {};
    const numberFormatter = new Intl.NumberFormat('en-US');
    const creditFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 });

    let currentState = null;
    let activeTab = typeof persisted.activeTab === 'string' ? persisted.activeTab : 'all';
    let lastSection = typeof persisted.lastSection === 'string' ? persisted.lastSection : '';
    let timeWindowKey = typeof persisted.timeWindowKey === 'string' ? persisted.timeWindowKey : '';
    let customStart = typeof persisted.customStart === 'string' ? persisted.customStart : '';
    let customEnd = typeof persisted.customEnd === 'string' ? persisted.customEnd : '';
    let expandedSessionIds = new Set(Array.isArray(persisted.expandedSessionIds) ? persisted.expandedSessionIds : []);

    function persistState() {
      vscode.setState({
        activeTab,
        lastSection,
        timeWindowKey,
        customStart,
        customEnd,
        expandedSessionIds: Array.from(expandedSessionIds)
      });
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatNumber(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '--';
      return numberFormatter.format(Math.round(value * 100) / 100);
    }

    function formatCredits(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '--';
      return creditFormatter.format(value);
    }

    function formatCurrency(value, precise) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '--';
      return (precise ? preciseCurrencyFormatter : currencyFormatter).format(value);
    }

    function formatPercent(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '--';
      return (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '') + '%';
    }

    function formatTokens(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '--';
      return numberFormatter.format(Math.max(0, Math.round(value)));
    }

    function compactTokens(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '--';
      const absolute = Math.abs(value);
      if (absolute >= 1000000) return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (absolute >= 1000) return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(Math.round(value));
    }

    function pad(value) {
      return String(value).padStart(2, '0');
    }

    function formatUtcTimestamp(timestamp) {
      if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) return '--';
      const date = new Date(timestamp);
      return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) + ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ' UTC';
    }

    function formatIsoTimestamp(value) {
      const parsed = Date.parse(value || '');
      return Number.isNaN(parsed) ? '--' : formatUtcTimestamp(parsed);
    }

    function dateInputValue(date) {
      return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
    }

    function workspaceName(state) {
      if (state && state.currentWorkspace) return state.currentWorkspace;
      if (state && state.latestSession && state.latestSession.workspace) return state.latestSession.workspace;
      if (state && Array.isArray(state.workspaces)) {
        const specific = state.workspaces.find(function (entry) { return entry !== 'All workspaces'; });
        if (specific) return specific;
      }
      return 'Current workspace';
    }

    function sectionToTab(section) {
      switch (section) {
        case 'models':
        case 'workspaces':
        case 'analysis':
        case 'history':
        case 'diff':
        case 'settings':
          return 'aggregate';
        case 'sessions':
        case 'overview':
        default:
          return 'all';
      }
    }

    function inferTimeWindowKey(days) {
      if (days <= 1) return 'today';
      if (days <= 7) return '7d';
      return 'month';
    }

    function currentMonthDays() {
      return Math.max(1, new Date().getUTCDate());
    }

    function customWindowDays() {
      const start = Date.parse(customStart + 'T00:00:00.000Z');
      const end = Date.parse(customEnd + 'T00:00:00.000Z');
      if (Number.isNaN(start) || Number.isNaN(end)) return 7;
      return Math.max(1, Math.floor((Math.max(end, start) - Math.min(end, start)) / 86400000) + 1);
    }

    function selectedTimeWindowDays() {
      switch (timeWindowKey) {
        case 'today': return 1;
        case '7d': return 7;
        case '30d': return 30;
        case 'custom': return customWindowDays();
        case 'month':
        default: return currentMonthDays();
      }
    }

    function cacheState(efficiency) {
      if (efficiency > 70) {
        return { tone: 'good', label: 'Strong cache reuse', copy: 'Strong cache reuse. Prompt regions are stable and recomputation is low.' };
      }
      if (efficiency >= 30) {
        return { tone: 'partial', label: 'Partial cache reuse', copy: 'Partial cache reuse. Some prompt regions are stable but mutation is still driving spend.' };
      }
      return { tone: 'poor', label: 'Poor cache reuse', copy: 'Low cache reuse. High context mutation is driving expensive prompt recomputation.' };
    }

    function pricingFor(model) {
      return MODEL_PRICING.find(function (entry) { return entry.model === model; }) || MODEL_PRICING[0];
    }

    function buildCostBreakdown(session) {
      const pricing = pricingFor(session.model);
      const promptTokens = Math.max(Number(session.promptTokens) || 0, 0);
      const completionTokens = Math.max(Number(session.completionTokens) || 0, 0);
      const cacheReadTokens = Math.max(Number(session.cacheReadTokens) || 0, 0);
      const nonCachedPromptTokens = Math.max(promptTokens - cacheReadTokens, 0);
      return {
        nonCachedPromptTokens,
        inputCost: (nonCachedPromptTokens / 1000000) * pricing.inputPerMillion,
        outputCost: (completionTokens / 1000000) * pricing.outputPerMillion,
        cacheCost: (cacheReadTokens / 1000000) * pricing.cachePerMillion,
        totalCost: session.estimatedCost,
        pricing
      };
    }

    function suggestions(session, state) {
      const items = [];
      if (session.cacheEfficiency < 30) items.push('Stabilize prompt regions to improve cache reuse and lower spend.');
      if (session.retrievalAmplification > 8) items.push('Reduce retrieval breadth or tighten chunk selection to cut amplification.');
      if (session.contextPressure > 75) items.push('Trim tool output or prompt breadth to reduce reasoning pressure.');
      if (session.model !== 'GPT-5 mini' && session.contextPressure < 55) items.push('Evaluate GPT-5 mini for this workload to improve cost efficiency.');
      if (state && state.costByModel && state.costByModel[0] && state.costByModel[0].percent > 65) {
        items.push('Model spend is concentrated. Review routing thresholds for lower-complexity sessions.');
      }
      if (items.length === 0) items.push('Current session is operating within a healthy runtime envelope.');
      return items;
    }

    function uniqueFiles(session) {
      const values = [];
      ['files', 'promptFiles', 'retrievalFiles'].forEach(function (key) {
        (session[key] || []).forEach(function (entry) {
          if (entry && !values.includes(entry)) values.push(entry);
        });
      });
      return values;
    }

    function detailMarkup(session, state) {
      const breakdown = buildCostBreakdown(session);
      const cache = cacheState(session.cacheEfficiency);
      const files = uniqueFiles(session);
      return ''
        + '<div class="detail-grid">'
        + '  <section class="detail-card"><h3>Token Breakdown</h3><div class="detail-list">'
        + '    <div class="detail-item"><span>Prompt Tokens</span><strong>' + escapeHtml(formatTokens(session.promptTokens)) + '</strong></div>'
        + '    <div class="detail-item"><span>Completion Tokens</span><strong>' + escapeHtml(formatTokens(session.completionTokens)) + '</strong></div>'
        + '    <div class="detail-item"><span>Cache Creation Tokens</span><strong>' + escapeHtml(formatTokens(session.cacheCreateTokens)) + '</strong></div>'
        + '    <div class="detail-item"><span>Cache Read Tokens</span><strong>' + escapeHtml(formatTokens(session.cacheReadTokens)) + '</strong></div>'
        + '  </div></section>'
        + '  <section class="detail-card"><h3>Cost Breakdown</h3><div class="detail-list">'
        + '    <div class="detail-item"><span>Non-cached Prompt Tokens</span><strong>' + escapeHtml(formatTokens(breakdown.nonCachedPromptTokens)) + '</strong></div>'
        + '    <div class="detail-item"><span>Input Cost</span><strong>' + escapeHtml(formatCurrency(breakdown.inputCost, true)) + '</strong></div>'
        + '    <div class="detail-item"><span>Output Cost</span><strong>' + escapeHtml(formatCurrency(breakdown.outputCost, true)) + '</strong></div>'
        + '    <div class="detail-item"><span>Cache Cost</span><strong>' + escapeHtml(formatCurrency(breakdown.cacheCost, true)) + '</strong></div>'
        + '    <div class="detail-item"><span>Estimated Cost</span><strong class="amber-text">' + escapeHtml(formatCurrency(breakdown.totalCost, true)) + '</strong></div>'
        + '    <div class="detail-item"><span>Credits</span><strong class="amber-text">' + escapeHtml(formatCredits(session.credits)) + '</strong></div>'
        + '  </div></section>'
        + '  <section class="detail-card"><h3>Cache Breakdown</h3><div class="detail-list">'
        + '    <div class="detail-item"><span>Cache Efficiency</span><strong>' + escapeHtml(formatPercent(session.cacheEfficiency)) + '</strong></div>'
        + '    <div class="detail-item"><span>Status</span><strong>' + escapeHtml(cache.label) + '</strong></div>'
        + '    <div class="detail-item"><span>Prompt Stability</span><strong>' + escapeHtml(formatPercent(session.promptStability)) + '</strong></div>'
        + '    <div class="detail-item"><span>Cache Savings</span><strong>' + escapeHtml(formatCurrency(session.cacheSavings, true)) + '</strong></div>'
        + '  </div><div class="footer-note">' + escapeHtml(cache.copy) + '</div></section>'
        + '  <section class="detail-card"><h3>Model Details</h3><div class="detail-list">'
        + '    <div class="detail-item"><span>Model</span><strong>' + escapeHtml(session.model) + '</strong></div>'
        + '    <div class="detail-item"><span>Source</span><strong>' + escapeHtml(String(session.source)) + '</strong></div>'
        + '    <div class="detail-item"><span>Context Window</span><strong>' + escapeHtml(formatTokens(session.contextWindow)) + '</strong></div>'
        + '    <div class="detail-item"><span>Latency</span><strong>' + escapeHtml(formatNumber(session.latencyMs)) + ' ms</strong></div>'
        + '  </div></section>'
        + '  <section class="detail-card"><h3>Files Included</h3>'
        + (files.length === 0 ? '<div class="detail-copy">No workspace files were attached to this session.</div>' : '<div class="pill-row">' + files.map(function (file) { return '<span class="pill pill-muted">' + escapeHtml(file) + '</span>'; }).join('') + '</div>')
        + '  </section>'
        + '  <section class="detail-card"><h3>Retrieval Amplification</h3><div class="detail-list">'
        + '    <div class="detail-item"><span>Amplification</span><strong>' + escapeHtml(formatNumber(session.retrievalAmplification)) + 'x</strong></div>'
        + '    <div class="detail-item"><span>Retrieval Files</span><strong>' + escapeHtml(String((session.retrievalFiles || []).length)) + '</strong></div>'
        + '    <div class="detail-item"><span>Requests</span><strong>' + escapeHtml(String(session.requests)) + '</strong></div>'
        + '    <div class="detail-item"><span>Workspace</span><strong>' + escapeHtml(session.workspace) + '</strong></div>'
        + '  </div></section>'
        + '  <section class="detail-card"><h3>Context Health</h3><div class="detail-list">'
        + '    <div class="detail-item"><span>Context Pressure</span><strong>' + escapeHtml(formatPercent(session.contextPressure)) + '</strong></div>'
        + '    <div class="detail-item"><span>Risk</span><strong class="risk-' + escapeHtml(String(session.risk)) + '">' + escapeHtml(String(session.risk).toUpperCase()) + '</strong></div>'
        + '    <div class="detail-item"><span>Prompt Stability</span><strong>' + escapeHtml(formatPercent(session.promptStability)) + '</strong></div>'
        + '    <div class="detail-item"><span>Cache Reuse</span><strong>' + escapeHtml(formatPercent(session.cacheEfficiency)) + '</strong></div>'
        + '  </div></section>'
        + '  <section class="detail-card"><h3>Optimization Suggestions</h3><ul class="detail-copy-list">'
        + suggestions(session, state).map(function (entry) { return '<li>' + escapeHtml(entry) + '</li>'; }).join('')
        + '  </ul></section>'
        + '</div>';
    }

    function workspaceAggregates(sessions) {
      const map = new Map();
      (sessions || []).forEach(function (session) {
        const current = map.get(session.workspace) || { workspace: session.workspace, sessions: 0, cost: 0, credits: 0, cacheEfficiency: 0 };
        current.sessions += 1;
        current.cost += Number(session.estimatedCost) || 0;
        current.credits += Number(session.credits) || 0;
        current.cacheEfficiency += Number(session.cacheEfficiency) || 0;
        map.set(session.workspace, current);
      });
      return Array.from(map.values()).map(function (entry) {
        return {
          workspace: entry.workspace,
          sessions: entry.sessions,
          cost: entry.cost,
          credits: entry.credits,
          cacheEfficiency: entry.sessions ? entry.cacheEfficiency / entry.sessions : 0
        };
      }).sort(function (left, right) { return right.cost - left.cost; });
    }

    function modelAggregates(state) {
      const counts = new Map();
      (state.sessions || []).forEach(function (session) {
        counts.set(session.model, (counts.get(session.model) || 0) + 1);
      });
      return (state.costByModel || []).map(function (entry) {
        return {
          model: entry.model,
          sessions: counts.get(entry.model) || 0,
          cost: entry.cost,
          percent: entry.percent,
          contextWindow: pricingFor(entry.model).contextWindow
        };
      });
    }

    function aggregateSuggestions(state) {
      const items = [];
      if (state.summary.averageCacheEfficiency < 30) items.push({ title: 'Cache reuse is poor', copy: 'Average cache efficiency is below 30%. Focus on prompt stability and repeated context regions.' });
      if (state.summary.averageRetrievalAmplification > 6) items.push({ title: 'Retrieval amplification is expensive', copy: 'Tighten top-k defaults and retrieval ranking to reduce prompt inflation.' });
      if (state.summary.contextHealth < 55) items.push({ title: 'Context health needs intervention', copy: 'Low context health indicates saturation, instability, or retrieval waste across the active window.' });
      if (state.costByModel && state.costByModel[0] && state.costByModel[0].percent > 70) items.push({ title: 'Spend is concentrated in one model', copy: state.costByModel[0].model + ' is carrying most of the runtime cost. Review routing thresholds.' });
      if (items.length === 0) items.push({ title: 'Runtime is operating efficiently', copy: 'No dominant cost regression is visible in the current window. Keep monitoring for model skew and cache drift.' });
      return items;
    }

    function emptyMarkup(state) {
      const hasHistory = state && state.history && Array.isArray(state.history.snapshots) && state.history.snapshots.length > 0;
      const title = hasHistory ? 'No sessions match the current filters.' : 'No sessions recorded yet.';
      const copy = hasHistory
        ? 'Adjust the workspace or time-window filters to bring matching runtime sessions back into view.'
        : 'Run an AI session or import telemetry to populate this dashboard.';
      return ''
        + '<h2 class="empty-title">' + escapeHtml(title) + '</h2>'
        + '<p class="empty-copy">' + escapeHtml(copy) + '</p>'
        + '<div class="empty-actions">'
        + '  <button class="action-button" data-command="runAnalyzeWorkspace">Analyze Workspace</button>'
        + '  <button class="ghost-button" data-command="importTelemetry">Import Telemetry</button>'
        + '  <button class="ghost-button" data-command="openSettings">Open Settings</button>'
        + '</div>';
    }

    function latestMarkup(state) {
      const session = state.latestSession;
      if (!session) {
        return ''
          + '<section class="panel latest-hero">'
          + '  <div class="section-header">'
          + '    <div><span class="eyebrow">Latest Session</span><h2 class="section-title">No runtime session is available in this window.</h2></div>'
          + '  </div>'
          + '</section>';
      }
      const breakdown = buildCostBreakdown(session);
      return ''
        + '<div class="latest-shell">'
        + '  <section class="panel latest-hero">'
        + '    <div class="hero-meta">'
        + '      <div>'
        + '        <span class="eyebrow">Latest Session</span>'
        + '        <h2 class="hero-title">' + escapeHtml(session.title) + '</h2>'
        + '        <div class="hero-copy">' + escapeHtml(formatUtcTimestamp(session.endedAt || session.startedAt)) + ' · ' + escapeHtml(session.workspace) + '</div>'
        + '      </div>'
        + '      <div class="pill-row">'
        + '        <span class="source-pill">' + escapeHtml(String(session.source)) + '</span>'
        + '        <span class="workspace-pill">' + escapeHtml(session.workspace) + '</span>'
        + '        <span class="eyebrow">' + escapeHtml(String(session.risk).toUpperCase()) + '</span>'
        + '      </div>'
        + '    </div>'
        + '    <div class="detail-grid">'
        + '      <section class="detail-card"><h3>Session Overview</h3><div class="detail-list">'
        + '        <div class="detail-item"><span>Model</span><strong>' + escapeHtml(session.model) + '</strong></div>'
        + '        <div class="detail-item"><span>Estimated Cost</span><strong class="amber-text">' + escapeHtml(formatCurrency(session.estimatedCost, true)) + '</strong></div>'
        + '        <div class="detail-item"><span>Credits</span><strong class="amber-text">' + escapeHtml(formatCredits(session.credits)) + '</strong></div>'
        + '        <div class="detail-item"><span>Cache Efficiency</span><strong>' + escapeHtml(formatPercent(session.cacheEfficiency)) + '</strong></div>'
        + '        <div class="detail-item"><span>Retrieval Amplification</span><strong>' + escapeHtml(formatNumber(session.retrievalAmplification)) + 'x</strong></div>'
        + '      </div></section>'
        + '      <section class="detail-card"><h3>Pricing Reference</h3><div class="detail-list">'
        + '        <div class="detail-item"><span>Input / 1M</span><strong>' + escapeHtml(formatCurrency(breakdown.pricing.inputPerMillion, true)) + '</strong></div>'
        + '        <div class="detail-item"><span>Output / 1M</span><strong>' + escapeHtml(formatCurrency(breakdown.pricing.outputPerMillion, true)) + '</strong></div>'
        + '        <div class="detail-item"><span>Cache / 1M</span><strong>' + escapeHtml(formatCurrency(breakdown.pricing.cachePerMillion, true)) + '</strong></div>'
        + '        <div class="detail-item"><span>Prompt Tokens</span><strong>' + escapeHtml(compactTokens(session.promptTokens)) + '</strong></div>'
        + '        <div class="detail-item"><span>Completion Tokens</span><strong>' + escapeHtml(compactTokens(session.completionTokens)) + '</strong></div>'
        + '      </div></section>'
        + '    </div>'
        + '  </section>'
        + '  <section class="panel aggregate-panel">'
        + '    <div class="section-header" style="padding:0 0 16px;">'
        + '      <div><span class="eyebrow">Session Details</span><h2 class="section-title">Expanded session breakdown</h2></div>'
        + '      <span class="section-copy">Token, cost, cache, retrieval, and optimization detail for the latest runtime activity.</span>'
        + '    </div>'
        + detailMarkup(session, state)
        + '  </section>'
        + '</div>';
    }

    function sessionTableMarkup(state) {
      const workspace = workspaceName(state);
      const selectedWorkspace = state.filter && state.filter.workspace === workspace ? '__current__' : (state.filter && state.filter.workspace ? state.filter.workspace : 'All workspaces');
      const options = ['<option value="All workspaces"' + (selectedWorkspace === 'All workspaces' ? ' selected' : '') + '>All workspaces</option>'];
      if (workspace) options.push('<option value="__current__"' + (selectedWorkspace === '__current__' ? ' selected' : '') + '>Current workspace</option>');
      (state.workspaces || []).forEach(function (entry) {
        if (entry === 'All workspaces') return;
        options.push('<option value="' + escapeHtml(entry) + '"' + (selectedWorkspace === entry ? ' selected' : '') + '>' + escapeHtml(entry) + '</option>');
      });

      const rows = (state.sessions || []).map(function (session, index) {
        const expanded = expandedSessionIds.has(session.id || String(index));
        const cache = cacheState(session.cacheEfficiency);
        const sessionId = session.id || String(index);
        return ''
          + '<tr class="session-row" data-session-row="' + escapeHtml(sessionId) + '">'
          + '  <td><button class="expand-button' + (expanded ? ' expanded' : '') + '" data-expand-session="' + escapeHtml(sessionId) + '" aria-label="Toggle session details">▶</button></td>'
          + '  <td>' + escapeHtml(formatUtcTimestamp(session.endedAt || session.startedAt)) + '</td>'
          + '  <td><span class="source-pill">' + escapeHtml(String(session.source)) + '</span></td>'
          + '  <td><span class="workspace-pill">' + escapeHtml(session.workspace) + '</span></td>'
          + '  <td class="title-cell"><span class="title-text">' + escapeHtml(session.title) + '</span><div class="muted-row">' + escapeHtml(session.model) + ' · ' + escapeHtml(formatTokens(session.promptTokens)) + ' prompt tokens</div></td>'
          + '  <td><button class="favorite-button' + (session.favorite ? ' active' : '') + '" data-favorite-session="' + escapeHtml(sessionId) + '" aria-label="Toggle session favorite">' + (session.favorite ? '★' : '☆') + '</button></td>'
          + '  <td class="amber-text">' + escapeHtml(formatCurrency(session.estimatedCost)) + '</td>'
          + '  <td class="amber-text">' + escapeHtml(formatCredits(session.credits)) + '</td>'
          + '  <td><span class="cache-dot ' + escapeHtml(cache.tone) + '" title="' + escapeHtml(cache.copy) + '"></span></td>'
          + '</tr>'
          + '<tr class="detail-row' + (expanded ? '' : ' hidden') + '"><td colspan="9">' + detailMarkup(session, state) + '</td></tr>';
      }).join('') || '<tr><td colspan="9" style="padding:18px 14px; color: var(--muted);">No sessions in the selected view.</td></tr>';

      return ''
        + '<section class="panel table-panel">'
        + '  <div class="table-toolbar">'
        + '    <div class="table-toolbar-left">'
        + '      <h2 class="table-title">Session Activity</h2>'
        + '      <span class="divider"></span>'
        + '      <span class="control-label">Workspace</span>'
        + '      <select id="workspace-filter" class="select">' + options.join('') + '</select>'
        + '      <button id="favorites-toggle" class="chip-button favorites-toggle' + ((state.filter && state.filter.favoritesOnly) ? ' active' : '') + '">★ Favorites</button>'
        + '    </div>'
        + '    <div class="table-toolbar-right"><span class="section-copy">Click a row to expand</span></div>'
        + '  </div>'
        + '  <div class="table-wrap">'
        + '    <table>'
        + '      <thead>'
        + '        <tr>'
        + '          <th style="width:48px;">Expand</th>'
        + '          <th style="width:214px;">Last Active</th>'
        + '          <th style="width:104px;">Source</th>'
        + '          <th style="width:160px;">Workspace</th>'
        + '          <th>Title</th>'
        + '          <th style="width:90px;">Favorite</th>'
        + '          <th style="width:90px;">Cost</th>'
        + '          <th style="width:100px;">Credits</th>'
        + '          <th style="width:84px;">Cache</th>'
        + '        </tr>'
        + '      </thead>'
        + '      <tbody>' + rows + '</tbody>'
        + '    </table>'
        + '  </div>'
        + '</section>';
    }

    function aggregateMarkup(state) {
      const workspaceRows = workspaceAggregates(state.sessions || []);
      const modelRows = modelAggregates(state);
      const history = state.history || { snapshots: [], baselineId: undefined, activeComparison: undefined, diffMode: 'previous', settings: { enabled: false, retentionDays: 30, maxSnapshots: 500, snapshotOnScan: true, snapshotOnDashboardOpen: true, baseline: 'latest' } };
      const latestSnapshot = history.snapshots && history.snapshots.length ? history.snapshots[0] : undefined;
      const recommendations = aggregateSuggestions(state);

      const workspaceTable = workspaceRows.length === 0
        ? '<div class="detail-copy">No workspace aggregates are available in the selected time window.</div>'
        : '<div class="aggregate-table">'
          + '<div class="aggregate-row header"><span>Workspace</span><span>Sessions</span><span>Cost</span><span>Credits</span><span>Cache</span></div>'
          + workspaceRows.map(function (entry) {
            return '<div class="aggregate-row"><strong>' + escapeHtml(entry.workspace) + '</strong><span>' + escapeHtml(String(entry.sessions)) + '</span><span class="amber-text">' + escapeHtml(formatCurrency(entry.cost)) + '</span><span class="amber-text">' + escapeHtml(formatCredits(entry.credits)) + '</span><span>' + escapeHtml(formatPercent(entry.cacheEfficiency)) + '</span></div>';
          }).join('')
          + '</div>';

      const modelTable = modelRows.length === 0
        ? '<div class="detail-copy">No model spend has been recorded yet.</div>'
        : '<div class="aggregate-table">'
          + '<div class="aggregate-row header"><span>Model</span><span>Sessions</span><span>Cost</span><span>Share</span><span>Context</span></div>'
          + modelRows.map(function (entry) {
            return '<div class="aggregate-row"><strong>' + escapeHtml(entry.model) + '</strong><span>' + escapeHtml(String(entry.sessions)) + '</span><span class="amber-text">' + escapeHtml(formatCurrency(entry.cost)) + '</span><span>' + escapeHtml(formatPercent(entry.percent)) + '</span><span>' + escapeHtml(compactTokens(entry.contextWindow)) + '</span></div>';
          }).join('')
          + '</div>';

      return ''
        + '<div class="aggregate-grid">'
        + '  <section class="panel aggregate-panel"><span class="eyebrow">Workspace</span><h2 class="section-title">Workspace Spend</h2><div class="footer-note">Aggregated analytics across workspaces in the active filter.</div>' + workspaceTable + '</section>'
        + '  <section class="panel aggregate-panel"><span class="eyebrow">Models</span><h2 class="section-title">Model Cost Mix</h2><div class="footer-note">Which model families dominate runtime spend in the selected window.</div>' + modelTable + '</section>'
        + '  <section class="panel aggregate-panel"><span class="eyebrow">Runtime Health</span><h2 class="section-title">Cache, Retrieval, and Context</h2><div class="detail-list">'
        + '    <div class="detail-item"><span>Average Cache Efficiency</span><strong>' + escapeHtml(formatPercent(state.summary.averageCacheEfficiency)) + '</strong></div>'
        + '    <div class="detail-item"><span>Average Retrieval Amplification</span><strong>' + escapeHtml(formatNumber(state.summary.averageRetrievalAmplification)) + 'x</strong></div>'
        + '    <div class="detail-item"><span>Context Health</span><strong>' + escapeHtml(formatNumber(state.summary.contextHealth)) + ' / 100</strong></div>'
        + '    <div class="detail-item"><span>Estimated Waste</span><strong>' + escapeHtml(formatPercent(state.summary.estimatedWaste)) + '</strong></div>'
        + '    <div class="detail-item"><span>Estimated Savings</span><strong class="amber-text">' + escapeHtml(formatCurrency(state.summary.estimatedSavings)) + '</strong></div>'
        + '    <div class="detail-item"><span>Reasoning Risk</span><strong class="risk-' + escapeHtml(String(state.summary.reasoningRisk)) + '">' + escapeHtml(String(state.summary.reasoningRisk).toUpperCase()) + '</strong></div>'
        + '  </div></section>'
        + '  <section class="panel aggregate-panel"><span class="eyebrow">Recommendations</span><h2 class="section-title">Optimization Suggestions</h2>'
        + recommendations.map(function (entry) { return '<div class="recommendation-card"><strong>' + escapeHtml(entry.title) + '</strong><span>' + escapeHtml(entry.copy) + '</span></div>'; }).join('')
        + '  </section>'
        + '  <section class="panel aggregate-panel"><span class="eyebrow">History</span><h2 class="section-title">Runtime History</h2><div class="detail-list">'
        + '    <div class="detail-item"><span>Snapshots</span><strong>' + escapeHtml(formatNumber(history.snapshots.length || 0)) + '</strong></div>'
        + '    <div class="detail-item"><span>Baseline</span><strong>' + escapeHtml(history.baselineId || history.settings.baseline || 'latest') + '</strong></div>'
        + '    <div class="detail-item"><span>Latest Snapshot</span><strong>' + escapeHtml(latestSnapshot ? formatIsoTimestamp(latestSnapshot.createdAt) : '--') + '</strong></div>'
        + '    <div class="detail-item"><span>Diff Mode</span><strong>' + escapeHtml(String(history.diffMode || 'previous')) + '</strong></div>'
        + '  </div><div class="history-actions">'
        + '    <button class="ghost-button" data-command="saveRuntimeSnapshot">Save Snapshot</button>'
        + '    <button class="ghost-button" data-command="diffAgainstPrevious">Diff vs Previous</button>'
        + '    <button class="ghost-button" data-command="diffAgainstBaseline">Diff vs Baseline</button>'
        + '    <button class="ghost-button" data-command="clearOldRuntimeHistory">Clear Old History</button>'
        + '  </div></section>'
        + '  <section class="panel aggregate-panel"><span class="eyebrow">Deep Analysis</span><h2 class="section-title">Dedicated Drilldowns</h2><div class="history-actions">'
        + '    <button class="ghost-button" data-command="showCostAnalysis">Cost Analysis</button>'
        + '    <button class="ghost-button" data-command="analyzeCacheEfficiency">Cache Efficiency</button>'
        + '    <button class="ghost-button" data-command="analyzeRetrievalAmplification">Retrieval Amplification</button>'
        + '    <button class="ghost-button" data-command="openSettings">Open Settings</button>'
        + '  </div><div class="footer-note">Aggregate analytics stay inside the same runtime snapshot so exports, history, and dashboard views share one source of truth.</div></section>'
        + '</div>';
    }

    function renderKpis(state) {
      document.getElementById('kpi-sessions').textContent = formatNumber(state.summary.sessions);
      document.getElementById('kpi-cost').textContent = formatCurrency(state.summary.totalCost);
      document.getElementById('kpi-credits').textContent = formatCredits(state.summary.totalCredits);
      document.getElementById('kpi-sessions-copy').textContent = (state.filter && state.filter.workspace ? state.filter.workspace : 'All workspaces') + ' · ' + formatNumber(state.summary.sessions) + ' sessions' + (state.filter && state.filter.favoritesOnly ? ' · favorites' : '');
      document.getElementById('kpi-cost-copy').textContent = (state.filter && state.filter.workspace ? state.filter.workspace : 'All workspaces') + ' · fully loaded';
    }

    function syncToolbar(state) {
      if (!timeWindowKey) {
        timeWindowKey = inferTimeWindowKey(state.filter && state.filter.timeWindowDays ? state.filter.timeWindowDays : 30);
      }
      if (!customStart || !customEnd) {
        customStart = dateInputValue(new Date(Date.now() - 6 * 86400000));
        customEnd = dateInputValue(new Date());
      }
      document.getElementById('time-window').value = timeWindowKey;
      document.getElementById('custom-controls').classList.toggle('hidden', timeWindowKey !== 'custom');
      document.getElementById('custom-start').value = customStart;
      document.getElementById('custom-end').value = customEnd;
    }

    function renderPanels(state) {
      document.getElementById('tab-latest').innerHTML = latestMarkup(state);
      document.getElementById('tab-all').innerHTML = sessionTableMarkup(state);
      document.getElementById('tab-aggregate').innerHTML = aggregateMarkup(state);
      ['latest', 'all', 'aggregate'].forEach(function (tab) {
        const panel = document.getElementById('tab-' + tab);
        const button = document.querySelector('[data-tab="' + tab + '"]');
        if (panel) panel.classList.toggle('active', tab === activeTab && Boolean(state.summary.sessions));
        if (button) button.classList.toggle('active', tab === activeTab);
      });
    }

    function renderEmptyState(state) {
      const empty = document.getElementById('empty-state');
      const kpiShell = document.getElementById('kpi-shell');
      const hasSessions = Boolean(state.summary && state.summary.sessions);
      empty.classList.toggle('hidden', hasSessions);
      kpiShell.classList.toggle('hidden', !hasSessions);
      if (!hasSessions) {
        empty.innerHTML = emptyMarkup(state);
      }
    }

    function render(state) {
      currentState = state;
      if (state.activeSection && state.activeSection !== lastSection) {
        activeTab = sectionToTab(state.activeSection);
        lastSection = state.activeSection;
      }
      syncToolbar(state);
      renderEmptyState(state);
      if (state.summary && state.summary.sessions) {
        renderKpis(state);
      }
      renderPanels(state);
      persistState();
    }

    function postFilterUpdate(favoritesOnlyOverride) {
      if (!currentState) return;
      const workspaceSelect = document.getElementById('workspace-filter');
      const workspace = workspaceSelect
        ? (workspaceSelect.value === '__current__' ? workspaceName(currentState) : workspaceSelect.value)
        : (currentState.filter && currentState.filter.workspace ? currentState.filter.workspace : 'All workspaces');
      vscode.postMessage({
        command: 'updateFilter',
        workspace,
        timeWindowDays: selectedTimeWindowDays(),
        favoritesOnly: typeof favoritesOnlyOverride === 'boolean' ? favoritesOnlyOverride : Boolean(currentState.filter && currentState.filter.favoritesOnly)
      });
    }

    document.getElementById('refresh-button').addEventListener('click', function () {
      vscode.postMessage({ command: 'refreshView' });
    });

    document.getElementById('export-csv').addEventListener('click', function () {
      vscode.postMessage({ command: 'exportView', format: 'csv', view: activeTab });
    });

    document.getElementById('export-json').addEventListener('click', function () {
      vscode.postMessage({ command: 'exportView', format: 'json', view: activeTab });
    });

    document.getElementById('time-window').addEventListener('change', function (event) {
      timeWindowKey = event.target.value;
      syncToolbar(currentState || { filter: { timeWindowDays: 30 } });
      persistState();
      if (timeWindowKey !== 'custom') {
        postFilterUpdate();
      }
    });

    document.getElementById('custom-start').addEventListener('change', function (event) {
      customStart = event.target.value;
      persistState();
    });

    document.getElementById('custom-end').addEventListener('change', function (event) {
      customEnd = event.target.value;
      persistState();
    });

    document.getElementById('apply-custom-range').addEventListener('click', function () {
      postFilterUpdate();
    });

    document.addEventListener('change', function (event) {
      if (event.target && event.target.id === 'workspace-filter') {
        postFilterUpdate();
      }
    });

    document.addEventListener('click', function (event) {
      const tabButton = event.target.closest('[data-tab]');
      if (tabButton) {
        activeTab = tabButton.dataset.tab;
        render(currentState);
        return;
      }

      const favoriteButton = event.target.closest('[data-favorite-session]');
      if (favoriteButton) {
        vscode.postMessage({ command: 'toggleFavorite', sessionId: favoriteButton.dataset.favoriteSession });
        return;
      }

      const expandButton = event.target.closest('[data-expand-session]');
      if (expandButton) {
        const sessionId = expandButton.dataset.expandSession;
        if (expandedSessionIds.has(sessionId)) {
          expandedSessionIds.delete(sessionId);
        } else {
          expandedSessionIds.add(sessionId);
        }
        render(currentState);
        return;
      }

      const favoritesToggle = event.target.closest('#favorites-toggle');
      if (favoritesToggle) {
        const nextValue = !(currentState && currentState.filter && currentState.filter.favoritesOnly);
        postFilterUpdate(nextValue);
        return;
      }

      const commandButton = event.target.closest('[data-command]');
      if (commandButton) {
        const command = commandButton.dataset.command;
        if (command) {
          vscode.postMessage({ command });
        }
        return;
      }

      const sessionRow = event.target.closest('[data-session-row]');
      if (sessionRow) {
        const sessionId = sessionRow.dataset.sessionRow;
        if (expandedSessionIds.has(sessionId)) {
          expandedSessionIds.delete(sessionId);
        } else {
          expandedSessionIds.add(sessionId);
        }
        render(currentState);
      }
    });

    window.addEventListener('message', function (event) {
      if (!event.data || event.data.type !== 'tokenlint.runtimeDashboard') {
        return;
      }
      render(event.data.payload);
    });
  </script>
</body>
</html>`;
}
