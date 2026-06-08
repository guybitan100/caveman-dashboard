import * as vscode from 'vscode';

import { RuntimeComparison, RuntimeSnapshot } from '../../runtime/history/runtimeComparison';
import { RuntimeDashboardState } from '../../runtime/session/sessionModels';

export type RuntimeDashboardSection = 'overview' | 'sessions' | 'models' | 'workspaces' | 'analysis' | 'history' | 'diff' | 'settings';
export type RuntimeDashboardDiffMode = 'previous' | 'sevenDays' | 'baseline' | 'snapshot';

export interface RuntimeDashboardFilterState {
  workspace: string;
  timeWindowDays: number;
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
}

export type RuntimeDashboardMessage =
  | { command: 'refreshView' }
  | { command: 'updateFilter'; workspace?: string; timeWindowDays?: number }
  | { command: 'exportView'; format: 'csv' | 'json' }
  | { command: 'saveRuntimeSnapshot' }
  | { command: 'clearOldRuntimeHistory' }
  | { command: 'diffAgainstPrevious' }
  | { command: 'diffAgainstSevenDays' }
  | { command: 'diffAgainstBaseline' }
  | { command: 'compareSnapshot'; snapshotId: string }
  | { command: 'setHistoryBaseline'; snapshotId: string }
  | { command: 'showCostAnalysis' }
  | { command: 'analyzeCacheEfficiency' }
  | { command: 'analyzeRetrievalAmplification' };

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
      this.panel.reveal(vscode.ViewColumn.One, true);
      this.postState();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'tokenlint.runtimeDashboard',
      'TokenLint Runtime Dashboard',
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

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: dark;
      --bg: color-mix(in srgb, var(--vscode-editor-background) 86%, #07111f 14%);
      --panel: color-mix(in srgb, var(--vscode-sideBar-background) 62%, #0b1728 38%);
      --panel-strong: color-mix(in srgb, var(--vscode-editor-background) 56%, #10213c 44%);
      --panel-soft: rgba(255, 255, 255, 0.03);
      --border: color-mix(in srgb, var(--vscode-panel-border, #22324d) 72%, #304868 28%);
      --text: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --accent: #5db7ff;
      --teal: #24c8ba;
      --lime: #84d25f;
      --amber: #f3bc47;
      --rose: #ff7d77;
      --violet: #8b89ff;
      --shadow: 0 18px 42px rgba(0, 0, 0, 0.26);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 24px;
      font-family: 'Inter', 'SF Pro Text', 'SF Pro Display', 'Segoe UI', var(--vscode-font-family);
      color: var(--text);
      background:
        radial-gradient(circle at 100% 0%, rgba(93, 183, 255, 0.16), transparent 28%),
        radial-gradient(circle at 0% 20%, rgba(36, 200, 186, 0.12), transparent 24%),
        linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg) 84%, black 16%));
    }

    .shell {
      max-width: 1380px;
      margin: 0 auto;
    }

    .app-shell {
      display: grid;
      grid-template-columns: 232px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .nav-rail {
      position: sticky;
      top: 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .nav-card {
      background: linear-gradient(180deg, var(--panel), var(--panel-strong));
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 16px;
      box-shadow: var(--shadow);
    }

    .nav-eyebrow {
      display: block;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }

    .nav-title {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 760;
      letter-spacing: -0.02em;
    }

    .nav-copy {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.55;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .nav-button {
      width: 100%;
      text-align: left;
      border-radius: 14px;
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      color: var(--text);
      cursor: pointer;
    }

    .nav-button.active {
      background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 24%, var(--panel) 76%), color-mix(in srgb, var(--accent) 10%, var(--panel-strong) 90%));
      border-color: color-mix(in srgb, var(--accent) 40%, var(--border) 60%);
      transform: none;
    }

    .nav-button strong {
      display: block;
      font-size: 13px;
      font-weight: 760;
      letter-spacing: -0.01em;
      margin-bottom: 4px;
    }

    .nav-button span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .nav-pulse {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .nav-pulse-item {
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .nav-pulse-item strong {
      display: block;
      margin-top: 4px;
      font-size: 16px;
      font-weight: 760;
    }

    .nav-pulse-item span {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .content-shell {
      min-width: 0;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      padding-bottom: 18px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .title-wrap h1 {
      margin: 0 0 8px;
      font-size: 32px;
      font-weight: 850;
      letter-spacing: -0.04em;
    }

    .title-wrap p {
      margin: 0;
      max-width: 760px;
      color: var(--muted);
      line-height: 1.55;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      min-width: 340px;
    }

    .toolbar-label {
      display: inline-flex;
      align-items: center;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      padding: 0 2px;
    }

    select,
    button {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 12px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
      color: var(--text);
      font: inherit;
    }

    button {
      cursor: pointer;
      transition: transform 140ms ease, border-color 140ms ease;
    }

    button:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--accent) 52%, var(--border) 48%);
    }

    button.primary {
      background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 28%, var(--panel) 72%), color-mix(in srgb, var(--accent) 12%, var(--panel-strong) 88%));
    }

    button.secondary {
      background: var(--panel-soft);
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }

    .card {
      background: linear-gradient(180deg, var(--panel), var(--panel-strong));
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 18px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .section-label,
    .kpi-label {
      display: block;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }

    .summary-card strong {
      display: block;
      font-size: 30px;
      font-weight: 850;
      letter-spacing: -0.04em;
      margin-bottom: 6px;
    }

    .summary-card small {
      display: block;
      color: var(--muted);
      line-height: 1.5;
    }

    .risk-low-text { color: var(--lime); }
    .risk-medium-text { color: var(--accent); }
    .risk-high-text { color: var(--amber); }
    .risk-critical-text { color: var(--rose); }

    .chart-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 18px;
    }

    .chart-grid--wide {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .chart-card header,
    .spotlight-head,
    .table-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .section-title {
      margin: 0;
      font-size: 18px;
      font-weight: 760;
      letter-spacing: -0.02em;
    }

    .section-copy {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .chart-surface {
      min-height: 220px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015)),
        radial-gradient(circle at top, rgba(93, 183, 255, 0.08), transparent 48%);
      padding: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chart-empty {
      text-align: center;
      color: var(--muted);
      line-height: 1.5;
    }

    .trend-wrap,
    .bar-chart,
    .stacked-wrap,
    .donut-layout {
      width: 100%;
    }

    .trend-svg {
      width: 100%;
      height: 180px;
      display: block;
    }

    .axis-row,
    .stat-strip {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 10px;
      color: var(--muted);
      font-size: 12px;
    }

    .bar-chart {
      display: flex;
      align-items: end;
      gap: 12px;
      height: 180px;
    }

    .bar-item {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: end;
      align-items: center;
      gap: 8px;
    }

    .bar-column {
      width: 100%;
      border-radius: 12px 12px 6px 6px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--rose) 68%, white 32%), var(--rose));
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    }

    .bar-value,
    .bar-label {
      font-size: 12px;
      color: var(--muted);
      text-align: center;
    }

    .donut-layout {
      display: grid;
      grid-template-columns: minmax(180px, 220px) 1fr;
      gap: 18px;
      align-items: center;
    }

    .donut {
      width: 180px;
      height: 180px;
      margin: 0 auto;
      border-radius: 50%;
      position: relative;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    }

    .donut-hole {
      position: absolute;
      inset: 28px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--panel-strong) 90%, black 10%);
      border: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 14px;
    }

    .donut-hole strong {
      font-size: 24px;
      letter-spacing: -0.03em;
      margin-bottom: 4px;
    }

    .donut-hole span,
    .donut-hole small {
      color: var(--muted);
      line-height: 1.4;
    }

    .legend {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .legend-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 13px;
    }

    .legend-key {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      flex: 0 0 auto;
    }

    .stacked-bar {
      display: flex;
      height: 44px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.05);
      margin-bottom: 14px;
    }

    .stacked-segment {
      height: 100%;
      min-width: 8px;
    }

    .spotlight-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 16px;
      margin-bottom: 18px;
    }

    .spotlight-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    .workspace-pill,
    .source-pill,
    .cache-pill,
    .risk-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .workspace-pill,
    .source-pill {
      background: rgba(93, 183, 255, 0.12);
      color: var(--accent);
    }

    .risk-low { color: var(--lime); }
    .risk-medium { color: var(--accent); }
    .risk-high { color: var(--amber); }
    .risk-critical { color: var(--rose); }

    .cache-high { color: var(--lime); }
    .cache-partial { color: var(--amber); }
    .cache-none { color: var(--rose); }

    .stat-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .stat-box {
      padding: 14px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .stat-box strong {
      display: block;
      margin-top: 4px;
      font-size: 22px;
      letter-spacing: -0.03em;
    }

    .health-bars {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .bar-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .bar-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: var(--muted);
      font-size: 12px;
    }

    .bar-track {
      width: 100%;
      height: 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.07);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--accent), #89e4ff);
    }

    .actions-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 18px;
    }

    .button-stack {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .insight-list,
    .detail-list {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.6;
    }

    .empty-state {
      padding: 32px;
      border-radius: 18px;
      border: 1px dashed var(--border);
      color: var(--muted);
      text-align: center;
      background: rgba(255, 255, 255, 0.02);
      margin-bottom: 18px;
    }

    .table-card {
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    thead th {
      text-align: left;
      padding: 11px 12px;
      border-bottom: 1px solid var(--border);
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    tbody td {
      padding: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: top;
    }

    tbody tr:hover {
      background: rgba(255, 255, 255, 0.025);
    }

    .title-cell strong {
      display: block;
      margin-bottom: 4px;
      font-size: 14px;
    }

    .session-toggle {
      border: none;
      background: transparent;
      color: var(--accent);
      padding: 0;
      margin-right: 8px;
      font: inherit;
      cursor: pointer;
    }

    .detail-row {
      background: rgba(255, 255, 255, 0.02);
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .detail-card {
      padding: 14px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .detail-card h4 {
      margin: 0 0 10px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
    }

    .dashboard-section {
      display: none;
      margin-bottom: 18px;
    }

    .dashboard-section.active {
      display: block;
    }

    .workspace-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .workspace-card {
      padding: 16px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .workspace-card strong {
      display: block;
      margin-bottom: 8px;
      font-size: 18px;
      letter-spacing: -0.03em;
    }

    .settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .table-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .mini-button {
      width: auto;
      padding: 7px 10px;
      text-align: center;
      font-size: 12px;
    }

    .comparison-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .comparison-item {
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .comparison-item strong {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      letter-spacing: -0.01em;
    }

    .comparison-item span,
    .comparison-item small {
      display: block;
      color: var(--muted);
      line-height: 1.45;
    }

    .signal-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 74px;
      margin-bottom: 8px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.06);
    }

    .signal-info {
      color: var(--accent);
    }

    .signal-warning {
      color: var(--amber);
    }

    .signal-critical {
      color: var(--rose);
    }

    .muted { color: var(--muted); }
    .hidden { display: none; }

    @media (max-width: 1200px) {
      .app-shell,
      .chart-grid,
      .chart-grid--wide,
      .spotlight-grid,
      .actions-layout,
      .detail-grid,
      .donut-layout,
      .workspace-grid,
      .settings-grid {
        grid-template-columns: 1fr;
      }

      .nav-rail {
        position: static;
      }
    }

    @media (max-width: 1024px) {
      .topbar {
        flex-direction: column;
      }

      .toolbar {
        justify-content: flex-start;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="app-shell">
      <aside class="nav-rail">
        <section class="nav-card">
          <span class="nav-eyebrow">Runtime Views</span>
          <h2 class="nav-title">Observability</h2>
          <p class="nav-copy">Move through the runtime like an intelligence console instead of a report page.</p>
        </section>
        <section class="nav-card nav-list">
          <button class="nav-button active" data-section-nav="overview"><strong>Overview</strong><span>KPI cards, latest runtime pulse, and top operational signals.</span></button>
          <button class="nav-button" data-section-nav="sessions"><strong>Sessions</strong><span>Activity stream with expandable runtime drilldowns.</span></button>
          <button class="nav-button" data-section-nav="models"><strong>Models</strong><span>Model mix, cost distribution, and optimization story.</span></button>
          <button class="nav-button" data-section-nav="workspaces"><strong>Workspaces</strong><span>Cross-workspace concentration, cost, and cache behavior.</span></button>
          <button class="nav-button" data-section-nav="analysis"><strong>Analysis</strong><span>Trend views for spend, cache, retrieval, and context composition.</span></button>
          <button class="nav-button" data-section-nav="history"><strong>History</strong><span>Local runtime snapshots, baselines, and retention controls.</span></button>
          <button class="nav-button" data-section-nav="diff"><strong>Diff</strong><span>Regression deltas for cost, retrieval, cache, and context health.</span></button>
          <button class="nav-button" data-section-nav="settings"><strong>Settings</strong><span>Filters, artifact policy, and export behavior.</span></button>
        </section>
        <section class="nav-card">
          <span class="nav-eyebrow">Live Pulse</span>
          <div class="nav-pulse">
            <div class="nav-pulse-item"><span>Health</span><strong id="nav-health">0 / 100</strong></div>
            <div class="nav-pulse-item"><span>Risk</span><strong id="nav-risk">LOW</strong></div>
            <div class="nav-pulse-item"><span>Waste</span><strong id="nav-waste">0%</strong></div>
            <div class="nav-pulse-item"><span>Cache</span><strong id="nav-cache">0%</strong></div>
          </div>
        </section>
      </aside>

      <main class="content-shell">
    <div class="topbar">
      <div class="title-wrap">
        <h1>AI Runtime Observability Platform</h1>
        <p>Compiler + runtime observability + AI FinOps infrastructure for cognitive systems. Track sessions, spend, cache reuse, retrieval amplification, cognitive pressure, prompt stability, and optimization opportunities across TokenLint runtime telemetry.</p>
      </div>
      <div class="toolbar">
        <span class="toolbar-label">Workspace</span>
        <select id="workspace-filter"></select>
        <span class="toolbar-label">Time Window</span>
        <select id="time-window">
          <option value="1">24 hours</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
        </select>
        <button id="refresh-view" class="primary">Refresh</button>
        <button id="export-csv" class="secondary">Export CSV</button>
        <button id="export-json" class="secondary">Export JSON</button>
      </div>
    </div>

    <section id="section-overview" class="dashboard-section active">
      <div class="summary-grid">
        <div class="card summary-card">
          <span class="kpi-label">Sessions</span>
          <strong id="summary-sessions">0</strong>
          <small id="summary-workspaces">No recorded workspaces yet</small>
        </div>
        <div class="card summary-card">
          <span class="kpi-label">Cost</span>
          <strong id="summary-cost">$0.00</strong>
          <small>Estimated runtime spend</small>
        </div>
        <div class="card summary-card">
          <span class="kpi-label">Credits</span>
          <strong id="summary-credits">0</strong>
          <small>Provider consumption projection</small>
        </div>
        <div class="card summary-card">
          <span class="kpi-label">Cache Efficiency</span>
          <strong id="summary-cache">0%</strong>
          <small id="summary-cache-detail">Prompt reuse quality</small>
        </div>
        <div class="card summary-card">
          <span class="kpi-label">Estimated Savings</span>
          <strong id="summary-savings">$0.00</strong>
          <small>Cache-driven spend reduction</small>
        </div>
        <div class="card summary-card">
          <span class="kpi-label">Estimated Waste</span>
          <strong id="summary-waste">0%</strong>
          <small>Noisy retrieval and prompt bloat</small>
        </div>
        <div class="card summary-card">
          <span class="kpi-label">Context Health</span>
          <strong id="summary-health">0 / 100</strong>
          <small id="summary-generated">Updated just now</small>
        </div>
        <div class="card summary-card">
          <span class="kpi-label">Cognitive Pressure</span>
          <strong id="summary-risk" class="risk-low-text">LOW</strong>
          <small id="summary-pressure-detail">Reasoning risk posture</small>
        </div>
      </div>

      <div id="latest-empty" class="empty-state hidden">Run TokenLint scan or budget actions to generate a simulated runtime session.</div>

      <div id="latest-shell">
        <div class="spotlight-grid">
          <section class="card">
            <div class="spotlight-head">
              <div>
                <span class="section-label">Latest Session</span>
                <h2 id="latest-title" class="section-title">No session recorded</h2>
              </div>
              <span id="latest-last-active" class="section-copy">Waiting for telemetry</span>
            </div>
            <div class="spotlight-meta">
              <span id="latest-source" class="source-pill">SIMULATED</span>
              <span id="latest-workspace" class="workspace-pill">All workspaces</span>
              <span id="latest-risk" class="risk-pill risk-low">LOW</span>
            </div>
            <div class="stat-grid">
              <div class="stat-box"><span class="section-label">Model</span><strong id="latest-model">--</strong><div id="latest-window" class="muted">--</div></div>
              <div class="stat-box"><span class="section-label">Runtime Cost</span><strong id="latest-cost">--</strong><div id="latest-credits" class="muted">--</div></div>
              <div class="stat-box"><span class="section-label">Prompt / Completion</span><strong id="latest-tokens">--</strong><div id="latest-cache" class="muted">--</div></div>
              <div class="stat-box"><span class="section-label">Throughput</span><strong id="latest-requests">--</strong><div id="latest-latency" class="muted">--</div></div>
            </div>
          </section>
          <section class="card">
            <div class="spotlight-head">
              <div>
                <span class="section-label">Health</span>
                <h2 class="section-title">Runtime Health Metrics</h2>
              </div>
              <span class="section-copy">Cache reuse, retrieval sprawl, saturation, and stability.</span>
            </div>
            <div class="health-bars">
              <div class="bar-row">
                <div class="bar-head"><span>Cache Efficiency</span><span id="latest-cache-efficiency">--</span></div>
                <div class="bar-track"><div id="latest-cache-bar" class="bar-fill"></div></div>
              </div>
              <div class="bar-row">
                <div class="bar-head"><span>Retrieval Amplification</span><span id="latest-amplification">--</span></div>
                <div class="bar-track"><div id="latest-amplification-bar" class="bar-fill"></div></div>
              </div>
              <div class="bar-row">
                <div class="bar-head"><span>Context Pressure</span><span id="latest-pressure">--</span></div>
                <div class="bar-track"><div id="latest-pressure-bar" class="bar-fill"></div></div>
              </div>
              <div class="bar-row">
                <div class="bar-head"><span>Prompt Stability</span><span id="latest-stability">--</span></div>
                <div class="bar-track"><div id="latest-stability-bar" class="bar-fill"></div></div>
              </div>
            </div>
          </section>
        </div>

        <div class="actions-layout">
          <section class="card">
            <div class="spotlight-head">
              <div>
                <span class="section-label">Deep Analysis</span>
                <h2 class="section-title">Drilldowns</h2>
              </div>
              <span class="section-copy">Open dedicated runtime analysis panels for cost, cache, and retrieval investigations.</span>
            </div>
            <div class="button-stack">
              <button class="secondary" data-command="showCostAnalysis">Show Cost Analysis</button>
              <button class="secondary" data-command="analyzeCacheEfficiency">Analyze Cache Efficiency</button>
              <button class="secondary" data-command="analyzeRetrievalAmplification">Analyze Retrieval Amplification</button>
            </div>
          </section>
          <section class="card">
            <div class="spotlight-head">
              <div>
                <span class="section-label">Live Intelligence</span>
                <h2 class="section-title">Runtime Highlights</h2>
              </div>
              <span class="section-copy">The highest-signal insights in the current runtime window.</span>
            </div>
            <ul id="runtime-highlights" class="insight-list"></ul>
          </section>
        </div>
      </div>
    </section>

    <section id="section-analysis" class="dashboard-section">
      <div class="chart-grid">
        <section class="card chart-card">
          <header>
            <div>
              <span class="section-label">Spend</span>
              <h2 class="section-title">Cost Over Time</h2>
            </div>
            <span class="section-copy">Daily AI runtime spend across the active filter.</span>
          </header>
          <div id="cost-over-time" class="chart-surface"></div>
        </section>
        <section class="card chart-card">
          <header>
            <div>
              <span class="section-label">Cache</span>
              <h2 class="section-title">Cache Efficiency Trend</h2>
            </div>
            <span class="section-copy">How stable prompts stay over repeated runtime sessions.</span>
          </header>
          <div id="cache-efficiency-trend" class="chart-surface"></div>
        </section>
        <section class="card chart-card">
          <header>
            <div>
              <span class="section-label">Retrieval</span>
              <h2 class="section-title">Retrieval Amplification</h2>
            </div>
            <span class="section-copy">How much retrieval inflates the active context window.</span>
          </header>
          <div id="retrieval-amplification" class="chart-surface"></div>
        </section>
        <section class="card chart-card">
          <header>
            <div>
              <span class="section-label">Composition</span>
              <h2 class="section-title">Context Composition</h2>
            </div>
            <span class="section-copy">System prompt, memory, retrieval, tool output, user input, and completion mix.</span>
          </header>
          <div id="context-composition" class="chart-surface"></div>
        </section>
      </div>
    </section>

    <section id="section-models" class="dashboard-section">
      <div class="chart-grid chart-grid--wide">
        <section class="card chart-card">
          <header>
            <div>
              <span class="section-label">Model Mix</span>
              <h2 class="section-title">Cost by Model</h2>
            </div>
            <span class="section-copy">Where runtime spend concentrates across model families.</span>
          </header>
          <div id="cost-by-model" class="chart-surface"></div>
        </section>
        <section class="card chart-card">
          <header>
            <div>
              <span class="section-label">Runtime Health</span>
              <h2 class="section-title">Optimization Recommendations</h2>
            </div>
            <span class="section-copy">Enterprise heuristics for savings, waste reduction, and reasoning stability.</span>
          </header>
          <div id="optimization-recommendations" class="chart-surface"></div>
        </section>
        <section class="card chart-card">
          <header>
            <div>
              <span class="section-label">Cache</span>
              <h2 class="section-title">Cache Usage Breakdown</h2>
            </div>
            <span class="section-copy">Prompt volume versus cache read and cache creation activity.</span>
          </header>
          <div id="cache-breakdown" class="chart-surface"></div>
        </section>
      </div>
    </section>

    <section id="section-workspaces" class="dashboard-section">
      <div class="card">
        <div class="spotlight-head">
          <div>
            <span class="section-label">Workspaces</span>
            <h2 class="section-title">Workspace Runtime Overview</h2>
          </div>
          <span class="section-copy">Cross-workspace runtime concentration, spend, and cache behavior.</span>
        </div>
        <div id="workspace-summary" class="workspace-grid"></div>
      </div>
    </section>

    <section id="section-sessions" class="dashboard-section">
      <section class="card table-card">
        <div class="table-header">
          <div>
            <span class="section-label">Activity Stream</span>
            <h2 class="section-title">Session Activity Table</h2>
          </div>
          <span class="section-copy">Expandable runtime events for AI sessions, prompts, and agent runs.</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Last Active</th>
              <th>Source</th>
              <th>Workspace</th>
              <th>Title</th>
              <th>Model</th>
              <th>Cost</th>
              <th>Credits</th>
              <th>Cache</th>
              <th>Latency</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody id="session-rows"></tbody>
        </table>
      </section>
    </section>

    <section id="section-history" class="dashboard-section">
      <div class="actions-layout">
        <section class="card">
          <div class="spotlight-head">
            <div>
              <span class="section-label">Runtime History</span>
              <h2 class="section-title">Snapshot Store</h2>
            </div>
            <span class="section-copy">Local JSON snapshots under <strong>.tokenlint/history/</strong> and <strong>.tokenlint/snapshots/</strong>.</span>
          </div>
          <div class="stat-grid">
            <div class="stat-box"><span class="section-label">Snapshots</span><strong id="history-snapshot-count">0</strong><div class="muted">Saved runtime checkpoints</div></div>
            <div class="stat-box"><span class="section-label">Baseline</span><strong id="history-baseline">Latest snapshot</strong><div class="muted">Comparison anchor</div></div>
            <div class="stat-box"><span class="section-label">Latest</span><strong id="history-latest">--</strong><div class="muted">Newest snapshot time</div></div>
            <div class="stat-box"><span class="section-label">Retention</span><strong id="history-retention">30d / 500 max</strong><div class="muted">Automatic pruning policy</div></div>
          </div>
          <div class="button-stack">
            <button class="primary" data-command="saveRuntimeSnapshot">Save Runtime Snapshot</button>
            <button class="secondary" data-command="clearOldRuntimeHistory">Clear Old History</button>
          </div>
        </section>
        <section class="card">
          <div class="spotlight-head">
            <div>
              <span class="section-label">Diff Launchers</span>
              <h2 class="section-title">Comparison Modes</h2>
            </div>
            <span class="section-copy">Compare the newest runtime snapshot against the previous run, a 7-day checkpoint, or a configured baseline.</span>
          </div>
          <div class="button-stack">
            <button class="secondary" data-command="diffAgainstPrevious">Diff Against Previous Snapshot</button>
            <button class="secondary" data-command="diffAgainstSevenDays">Diff Against 7 Days Ago</button>
            <button class="secondary" data-command="diffAgainstBaseline">Diff Against Baseline</button>
          </div>
        </section>
      </div>
      <section class="card table-card">
        <div class="table-header">
          <div>
            <span class="section-label">Snapshot Timeline</span>
            <h2 class="section-title">Saved Runtime Sessions</h2>
          </div>
          <span class="section-copy">Compare any saved checkpoint to the latest session or promote it to the runtime baseline.</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>Workspace</th>
              <th>Total Tokens</th>
              <th>Cost</th>
              <th>Cache</th>
              <th>Retrieval</th>
              <th>Health</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="history-rows"></tbody>
        </table>
      </section>
    </section>

    <section id="section-diff" class="dashboard-section">
      <div id="diff-empty" class="empty-state">Save at least two runtime snapshots to compare cost, retrieval amplification, cache efficiency, and context health over time.</div>
      <div id="diff-shell" class="hidden">
        <section class="card">
          <div class="spotlight-head">
            <div>
              <span class="section-label">Runtime Diff</span>
              <h2 id="diff-title" class="section-title">Latest vs Previous Snapshot</h2>
            </div>
            <span id="diff-meta" class="section-copy">No comparison selected yet.</span>
          </div>
          <div class="summary-grid">
            <div class="card summary-card"><span class="kpi-label">Tokens</span><strong id="diff-tokens">0</strong><small id="diff-tokens-detail">--</small></div>
            <div class="card summary-card"><span class="kpi-label">Cost</span><strong id="diff-cost">$0.00</strong><small id="diff-cost-detail">--</small></div>
            <div class="card summary-card"><span class="kpi-label">Cache</span><strong id="diff-cache">0%</strong><small id="diff-cache-detail">--</small></div>
            <div class="card summary-card"><span class="kpi-label">Retrieval</span><strong id="diff-retrieval">0x</strong><small id="diff-retrieval-detail">--</small></div>
            <div class="card summary-card"><span class="kpi-label">Health</span><strong id="diff-health">0</strong><small id="diff-health-detail">--</small></div>
            <div class="card summary-card"><span class="kpi-label">Stability</span><strong id="diff-stability">0%</strong><small id="diff-stability-detail">--</small></div>
          </div>
        </section>
        <div class="actions-layout">
          <section class="card">
            <div class="spotlight-head">
              <div>
                <span class="section-label">Compare</span>
                <h2 class="section-title">Quick Diff Actions</h2>
              </div>
              <span class="section-copy">Recompute the active diff mode without leaving the dashboard.</span>
            </div>
            <div class="button-stack">
              <button class="secondary" data-command="diffAgainstPrevious">Diff Against Previous Snapshot</button>
              <button class="secondary" data-command="diffAgainstSevenDays">Diff Against 7 Days Ago</button>
              <button class="secondary" data-command="diffAgainstBaseline">Diff Against Baseline</button>
            </div>
          </section>
          <section class="card">
            <div class="spotlight-head">
              <div>
                <span class="section-label">Signals</span>
                <h2 class="section-title">Regression Signals</h2>
              </div>
              <span class="section-copy">High-signal regressions surfaced by the runtime diff engine.</span>
            </div>
            <div id="diff-signals" class="comparison-list"></div>
          </section>
          <section class="card">
            <div class="spotlight-head">
              <div>
                <span class="section-label">Recommendations</span>
                <h2 class="section-title">Operator Guidance</h2>
              </div>
              <span class="section-copy">Practical next steps from the current comparison.</span>
            </div>
            <div id="diff-recommendations" class="comparison-list"></div>
          </section>
        </div>
        <div class="chart-grid chart-grid--wide">
          <section class="card">
            <div class="spotlight-head">
              <div>
                <span class="section-label">Regressions</span>
                <h2 class="section-title">Highest File-Level Regressions</h2>
              </div>
              <span class="section-copy">Files whose findings, amplification, or cache behavior worsened the most.</span>
            </div>
            <div id="diff-regressions" class="comparison-list"></div>
          </section>
          <section class="card">
            <div class="spotlight-head">
              <div>
                <span class="section-label">Improvements</span>
                <h2 class="section-title">Highest File-Level Improvements</h2>
              </div>
              <span class="section-copy">Files that improved after a refactor, prompt cleanup, or retrieval tuning change.</span>
            </div>
            <div id="diff-improvements" class="comparison-list"></div>
          </section>
        </div>
      </div>
    </section>

    <section id="section-settings" class="dashboard-section">
      <div class="settings-grid">
        <section class="card">
          <span class="section-label">Filters</span>
          <h2 class="section-title">Runtime Defaults</h2>
          <ul class="insight-list">
            <li>Workspace filter: <span id="settings-workspace">All workspaces</span></li>
            <li>Time window: <span id="settings-window">7 days</span></li>
            <li>Exports: CSV and JSON snapshots written to <strong>.tokenlint/exports/</strong></li>
            <li>History enabled: <span id="settings-history-enabled">Yes</span></li>
            <li>History retention: <span id="settings-history-retention">30 days / 500 snapshots</span></li>
            <li>History baseline: <span id="settings-history-baseline">Latest snapshot</span></li>
          </ul>
        </section>
        <section class="card">
          <span class="section-label">Storage</span>
          <h2 class="section-title">Artifact Policy</h2>
          <ul class="insight-list">
            <li>Runtime analytics are stored under <strong>.tokenlint/</strong> and ignored by Git.</li>
            <li>History snapshots live under <strong>.tokenlint/history/</strong> with a rolling latest pointer in <strong>.tokenlint/snapshots/latest.json</strong>.</li>
            <li>Deep cost, cache, and retrieval analysis opens in dedicated webview panels.</li>
            <li>Markdown-style runtime diagnostics are no longer the default runtime UX.</li>
          </ul>
        </section>
      </div>
    </section>
      </main>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const numberFormatter = new Intl.NumberFormat('en-US');
    const compactNumberFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
    const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC'
    });
    const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const palette = ['var(--accent)', 'var(--teal)', 'var(--violet)', 'var(--amber)', 'var(--rose)', 'var(--lime)'];
    let currentState = null;
    let activeSection = 'overview';
    const dashboardSections = ['overview', 'analysis', 'models', 'workspaces', 'sessions', 'settings'];

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatNumber(value, suffix) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return numberFormatter.format(Math.round(value * 10) / 10) + (suffix || '');
    }

    function formatCompact(value, suffix) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return compactNumberFormatter.format(value) + (suffix || '');
    }

    function formatPercent(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return (Math.round(value * 10) / 10) + '%';
    }

    function formatCurrency(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return currencyFormatter.format(value);
    }

    function formatDate(timestamp) {
      if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
        return '--';
      }

      return dateFormatter.format(new Date(timestamp)) + ' UTC';
    }

    function formatDateLabel(value) {
      if (!value) {
        return '--';
      }

      return shortDateFormatter.format(new Date(value + 'T00:00:00.000Z'));
    }

    function cacheIndicatorClass(value) {
      if (value > 70) {
        return 'high';
      }

      if (value > 30) {
        return 'partial';
      }

      return 'none';
    }

    function setBar(id, value, maxValue) {
      const element = document.getElementById(id);
      if (!element) {
        return;
      }

      const percent = Math.max(0, Math.min((value / Math.max(maxValue, 1)) * 100, 100));
      element.style.width = percent + '%';
    }

    function renderSummary(state) {
      document.getElementById('summary-sessions').textContent = formatNumber(state.summary.sessions);
      document.getElementById('summary-cost').textContent = formatCurrency(state.summary.totalCost);
      document.getElementById('summary-credits').textContent = formatNumber(state.summary.totalCredits);
      document.getElementById('summary-cache').textContent = formatPercent(state.summary.averageCacheEfficiency);
      document.getElementById('summary-savings').textContent = formatCurrency(state.summary.estimatedSavings);
      document.getElementById('summary-waste').textContent = formatPercent(state.summary.estimatedWaste);
      document.getElementById('summary-health').textContent = formatNumber(state.summary.contextHealth) + ' / 100';
      document.getElementById('summary-risk').textContent = String(state.summary.reasoningRisk).toUpperCase();
      document.getElementById('summary-risk').className = 'risk-' + state.summary.reasoningRisk + '-text';
      document.getElementById('summary-workspaces').textContent = state.workspaces.length > 1
        ? String(state.workspaces.length - 1) + ' workspaces loaded'
        : 'No recorded workspaces yet';
      document.getElementById('summary-cache-detail').textContent = 'Stable prompt region ' + formatPercent(state.summary.stablePromptRegions);
      document.getElementById('summary-generated').textContent = 'Updated ' + formatDate(state.generatedAt);
      document.getElementById('summary-pressure-detail').textContent = 'Context pressure ' + formatPercent(state.summary.averageContextPressure);
      document.getElementById('nav-health').textContent = formatNumber(state.summary.contextHealth) + ' / 100';
      document.getElementById('nav-risk').textContent = String(state.summary.reasoningRisk).toUpperCase();
      document.getElementById('nav-waste').textContent = formatPercent(state.summary.estimatedWaste);
      document.getElementById('nav-cache').textContent = formatPercent(state.summary.averageCacheEfficiency);
    }

    function renderFilters(state) {
      const workspaceSelect = document.getElementById('workspace-filter');
      const timeWindowSelect = document.getElementById('time-window');
      workspaceSelect.innerHTML = state.workspaces.map(function (workspace) {
        const selected = workspace === state.filter.workspace ? ' selected' : '';
        return '<option value="' + escapeHtml(workspace) + '"' + selected + '>' + escapeHtml(workspace) + '</option>';
      }).join('');
      timeWindowSelect.value = String(state.filter.timeWindowDays);
    }

    function buildLineGeometry(points, width, height, padding) {
      const values = points.map(function (point) { return Number(point.value) || 0; });
      const maxValue = Math.max.apply(Math, values.concat([1]));
      const minValue = Math.min.apply(Math, values.concat([0]));
      const span = maxValue - minValue || 1;
      const baseline = height - padding;
      const usableWidth = width - padding * 2;
      const usableHeight = height - padding * 2;
      const coordinates = points.map(function (point, index) {
        const x = padding + (points.length === 1 ? usableWidth / 2 : (usableWidth * index) / Math.max(points.length - 1, 1));
        const normalized = (point.value - minValue) / span;
        const y = baseline - normalized * usableHeight;
        return { x: x, y: y, label: point.label, value: point.value };
      });

      return {
        coordinates: coordinates,
        linePath: coordinates.map(function (point, index) {
          return (index === 0 ? 'M' : 'L') + point.x + ' ' + point.y;
        }).join(' '),
        areaPath: coordinates.length === 0
          ? ''
          : 'M' + coordinates[0].x + ' ' + baseline + ' '
            + coordinates.map(function (point) {
              return 'L' + point.x + ' ' + point.y;
            }).join(' ')
            + ' L' + coordinates[coordinates.length - 1].x + ' ' + baseline + ' Z',
        minValue: minValue,
        maxValue: maxValue
      };
    }

    function pickAxisLabels(points) {
      if (points.length <= 3) {
        return points;
      }

      const middleIndex = Math.floor((points.length - 1) / 2);
      return [points[0], points[middleIndex], points[points.length - 1]];
    }

    function renderLineChart(containerId, points, options) {
      const container = document.getElementById(containerId);
      if (!container) {
        return;
      }

      if (!Array.isArray(points) || points.length === 0) {
        container.innerHTML = '<div class="chart-empty">' + escapeHtml(options.emptyLabel) + '</div>';
        return;
      }

      const width = 440;
      const height = 180;
      const padding = 18;
      const geometry = buildLineGeometry(points, width, height, padding);
      const gradientId = containerId + '-gradient';
      const axisLabels = pickAxisLabels(points);

      container.innerHTML = ''
        + '<div class="trend-wrap">'
        + '  <svg class="trend-svg" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">'
        + '    <defs>'
        + '      <linearGradient id="' + gradientId + '" x1="0" y1="0" x2="0" y2="1">'
        + '        <stop offset="0%" stop-color="' + options.color + '" stop-opacity="0.28"></stop>'
        + '        <stop offset="100%" stop-color="' + options.color + '" stop-opacity="0.02"></stop>'
        + '      </linearGradient>'
        + '    </defs>'
        + '    <path d="' + geometry.areaPath + '" fill="url(#' + gradientId + ')"></path>'
        + '    <path d="' + geometry.linePath + '" fill="none" stroke="' + options.color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>'
        + geometry.coordinates.map(function (point) {
          return '<circle cx="' + point.x + '" cy="' + point.y + '" r="4.5" fill="' + options.color + '"></circle>';
        }).join('')
        + '  </svg>'
        + '  <div class="axis-row">'
        + axisLabels.map(function (point) { return '<span>' + escapeHtml(point.label) + '</span>'; }).join('')
        + '  </div>'
        + '  <div class="stat-strip">'
        + '    <span>Min ' + escapeHtml(options.valueFormatter(geometry.minValue)) + '</span>'
        + '    <span>Max ' + escapeHtml(options.valueFormatter(geometry.maxValue)) + '</span>'
        + '  </div>'
        + '</div>';
    }

    function renderBarChart(containerId, points, options) {
      const container = document.getElementById(containerId);
      if (!container) {
        return;
      }

      if (!Array.isArray(points) || points.length === 0) {
        container.innerHTML = '<div class="chart-empty">' + escapeHtml(options.emptyLabel) + '</div>';
        return;
      }

      const maxValue = Math.max.apply(Math, points.map(function (point) { return Number(point.value) || 0; }).concat([1]));
      container.innerHTML = ''
        + '<div class="bar-chart">'
        + points.map(function (point) {
          const height = Math.max(12, Math.round((point.value / maxValue) * 140));
          return ''
            + '<div class="bar-item">'
            + '  <div class="bar-value">' + escapeHtml(options.valueFormatter(point.value)) + '</div>'
            + '  <div class="bar-column" style="height:' + height + 'px;"></div>'
            + '  <div class="bar-label">' + escapeHtml(point.label) + '</div>'
            + '</div>';
        }).join('')
        + '</div>';
    }

    function renderDonutChart(containerId, segments, options) {
      const container = document.getElementById(containerId);
      if (!container) {
        return;
      }

      const visibleSegments = (segments || []).filter(function (segment) { return Number(segment.value) > 0; });
      if (visibleSegments.length === 0) {
        container.innerHTML = '<div class="chart-empty">' + escapeHtml(options.emptyLabel) + '</div>';
        return;
      }

      const total = visibleSegments.reduce(function (sum, segment) { return sum + Number(segment.value); }, 0);
      let offset = 0;
      const gradient = visibleSegments.map(function (segment) {
        const start = offset;
        offset += (Number(segment.value) / total) * 100;
        return segment.color + ' ' + start + '% ' + offset + '%';
      }).join(', ');

      container.innerHTML = ''
        + '<div class="donut-layout">'
        + '  <div class="donut" style="background: conic-gradient(' + gradient + ');">'
        + '    <div class="donut-hole">'
        + '      <strong>' + escapeHtml(options.centerValue) + '</strong>'
        + '      <span>' + escapeHtml(options.centerLabel) + '</span>'
        + (options.centerCaption ? '<small>' + escapeHtml(options.centerCaption) + '</small>' : '')
        + '    </div>'
        + '  </div>'
        + '  <div class="legend">'
        + visibleSegments.map(function (segment) {
          return ''
            + '<div class="legend-row">'
            + '  <span class="legend-key"><span class="legend-swatch" style="background:' + segment.color + ';"></span>' + escapeHtml(segment.label) + '</span>'
            + '  <strong>' + escapeHtml(segment.displayValue) + '</strong>'
            + '</div>';
        }).join('')
        + (options.extraLegend ? '<div class="legend-row"><span>' + escapeHtml(options.extraLegend.label) + '</span><strong>' + escapeHtml(options.extraLegend.value) + '</strong></div>' : '')
        + '  </div>'
        + '</div>';
    }

    function renderStackedComposition(containerId, composition) {
      const container = document.getElementById(containerId);
      if (!container) {
        return;
      }

      const segments = [
        { key: 'systemPrompt', label: 'System Prompt', color: 'var(--accent)', value: composition.systemPrompt },
        { key: 'memory', label: 'Memory', color: 'var(--teal)', value: composition.memory },
        { key: 'retrieval', label: 'Retrieval', color: 'var(--rose)', value: composition.retrieval },
        { key: 'toolOutput', label: 'Tool Output', color: 'var(--amber)', value: composition.toolOutput },
        { key: 'userInput', label: 'User Input', color: 'var(--violet)', value: composition.userInput },
        { key: 'completion', label: 'Completion', color: 'var(--lime)', value: composition.completion }
      ].filter(function (segment) { return Number(segment.value) > 0; });
      const total = segments.reduce(function (sum, segment) { return sum + segment.value; }, 0);

      if (total === 0) {
        container.innerHTML = '<div class="chart-empty">No context composition data is available yet.</div>';
        return;
      }

      container.innerHTML = ''
        + '<div class="stacked-wrap">'
        + '  <div class="stacked-bar">'
        + segments.map(function (segment) {
          const width = Math.max(2, (segment.value / total) * 100);
          return '<div class="stacked-segment" style="width:' + width + '%; background:' + segment.color + ';"></div>';
        }).join('')
        + '  </div>'
        + '  <div class="legend">'
        + segments.map(function (segment) {
          return ''
            + '<div class="legend-row">'
            + '  <span class="legend-key"><span class="legend-swatch" style="background:' + segment.color + ';"></span>' + escapeHtml(segment.label) + '</span>'
            + '  <strong>' + escapeHtml(formatCompact(segment.value, ' tokens')) + '</strong>'
            + '</div>';
        }).join('')
        + '  </div>'
        + '</div>';
    }

    function renderRecommendationCard(containerId, state) {
      const container = document.getElementById(containerId);
      if (!container) {
        return;
      }

      const primaryModel = state.costByModel[0];
      const suggestion = primaryModel && primaryModel.model !== 'GPT-5 mini'
        ? 'Current workload overuses ' + primaryModel.model + '. Suggest testing GPT-5 mini for lower-complexity runs.'
        : 'Current routing already leans toward cheaper profiles. Focus on retrieval waste and prompt stability next.';
      const estimatedModelSavings = primaryModel && primaryModel.model !== 'GPT-5 mini'
        ? Math.min(68, Math.max(18, Math.round(state.summary.estimatedWaste * 0.8)))
        : Math.max(12, Math.round(state.summary.estimatedSavings * 100));
      const lines = [
        'Context Health: ' + formatNumber(state.summary.contextHealth) + ' / 100',
        'Reasoning Risk: ' + String(state.summary.reasoningRisk).toUpperCase(),
        'Prompt Stability: ' + formatPercent(state.summary.stablePromptRegions),
        'Estimated Waste: ' + formatPercent(state.summary.estimatedWaste),
        'Optimization Opportunity: ' + estimatedModelSavings + '% potential savings'
      ];

      container.innerHTML = ''
        + '<div class="legend">'
        + lines.map(function (line) {
          return '<div class="legend-row"><span>' + escapeHtml(line) + '</span></div>';
        }).join('')
        + '<div class="legend-row"><span>' + escapeHtml(suggestion) + '</span></div>'
        + '</div>';
    }

    function renderCharts(state) {
      renderLineChart(
        'cost-over-time',
        state.costOverTime.map(function (point) { return { label: formatDateLabel(point.date), value: point.cost }; }),
        {
          color: 'var(--accent)',
          emptyLabel: 'No cost telemetry inside the selected window.',
          valueFormatter: function (value) { return formatCurrency(value); }
        }
      );

      renderLineChart(
        'cache-efficiency-trend',
        state.cacheEfficiencyTrend.map(function (point) { return { label: formatDateLabel(point.date), value: point.efficiency }; }),
        {
          color: 'var(--teal)',
          emptyLabel: 'No cache efficiency trend is available yet.',
          valueFormatter: function (value) { return formatPercent(value); }
        }
      );

      renderBarChart(
        'retrieval-amplification',
        state.retrievalAmplification.map(function (point) { return { label: formatDateLabel(point.date), value: point.amplification }; }),
        {
          emptyLabel: 'No retrieval amplification telemetry inside the selected window.',
          valueFormatter: function (value) { return formatNumber(value, 'x'); }
        }
      );

      renderStackedComposition('context-composition', state.contextComposition);

      renderDonutChart(
        'cost-by-model',
        state.costByModel.map(function (entry, index) {
          return {
            label: entry.model + ' (' + entry.percent.toFixed(1) + '%)',
            value: entry.cost,
            displayValue: formatCurrency(entry.cost),
            color: palette[index % palette.length]
          };
        }),
        {
          emptyLabel: 'No model-cost distribution is available yet.',
          centerLabel: 'Total Spend',
          centerValue: formatCurrency(state.summary.totalCost),
          centerCaption: state.costByModel[0] ? 'Lead model: ' + state.costByModel[0].model : ''
        }
      );

      renderRecommendationCard('optimization-recommendations', state);

      renderDonutChart(
        'cache-breakdown',
        [
          {
            label: 'Cache Read Tokens',
            value: state.cacheBreakdown.cacheReadTokens,
            displayValue: formatCompact(state.cacheBreakdown.cacheReadTokens, ' tokens'),
            color: 'var(--teal)'
          },
          {
            label: 'Cache Create Tokens',
            value: state.cacheBreakdown.cacheCreateTokens,
            displayValue: formatCompact(state.cacheBreakdown.cacheCreateTokens, ' tokens'),
            color: 'var(--amber)'
          }
        ],
        {
          emptyLabel: 'No cache activity is available yet.',
          centerLabel: 'Prompt Volume',
          centerValue: formatCompact(state.cacheBreakdown.totalTokens, ' tokens'),
          centerCaption: 'Saved ' + formatCurrency(state.summary.estimatedSavings),
          extraLegend: {
            label: 'Total Prompt Tokens',
            value: formatCompact(state.cacheBreakdown.totalTokens, ' tokens')
          }
        }
      );
    }

    function renderLatest(state) {
      const session = state.latestSession;
      const empty = document.getElementById('latest-empty');
      const shell = document.getElementById('latest-shell');

      empty.classList.toggle('hidden', Boolean(session));
      shell.classList.toggle('hidden', !session);

      if (!session) {
        return;
      }

      document.getElementById('latest-title').textContent = session.title;
      document.getElementById('latest-last-active').textContent = 'Last active ' + formatDate(session.endedAt || session.startedAt);
      document.getElementById('latest-source').textContent = String(session.source).toUpperCase();
      document.getElementById('latest-workspace').textContent = session.workspace;
      document.getElementById('latest-risk').textContent = String(session.risk).toUpperCase();
      document.getElementById('latest-risk').className = 'risk-pill risk-' + session.risk;
      document.getElementById('latest-model').textContent = session.model;
      document.getElementById('latest-window').textContent = 'Context window ' + formatCompact(session.contextWindow, ' tokens');
      document.getElementById('latest-cost').textContent = formatCurrency(session.estimatedCost);
      document.getElementById('latest-credits').textContent = formatNumber(session.credits) + ' credits · saved ' + formatCurrency(session.cacheSavings);
      document.getElementById('latest-tokens').textContent = formatCompact(session.promptTokens, ' tokens') + ' / ' + formatCompact(session.completionTokens, ' tokens');
      document.getElementById('latest-cache').textContent = 'Cache read ' + formatCompact(session.cacheReadTokens, ' tokens') + ' · create ' + formatCompact(session.cacheCreateTokens, ' tokens');
      document.getElementById('latest-requests').textContent = formatNumber(session.requests) + ' requests';
      document.getElementById('latest-latency').textContent = 'Latency ' + formatNumber(session.latencyMs, ' ms');
      document.getElementById('latest-cache-efficiency').textContent = formatPercent(session.cacheEfficiency);
      document.getElementById('latest-amplification').textContent = formatNumber(session.retrievalAmplification, 'x');
      document.getElementById('latest-pressure').textContent = formatPercent(session.contextPressure);
      document.getElementById('latest-stability').textContent = formatPercent(session.promptStability);
      setBar('latest-cache-bar', session.cacheEfficiency, 100);
      setBar('latest-amplification-bar', session.retrievalAmplification, 8);
      setBar('latest-pressure-bar', session.contextPressure, 100);
      setBar('latest-stability-bar', session.promptStability, 100);
    }

    function renderHighlights(state) {
      const primaryModel = state.costByModel[0];
      document.getElementById('runtime-highlights').innerHTML = [
        'Estimated savings in view: ' + formatCurrency(state.summary.estimatedSavings) + '.',
        'Estimated waste in view: ' + formatPercent(state.summary.estimatedWaste) + '.',
        'Context health score: ' + formatNumber(state.summary.contextHealth) + ' / 100.',
        'Primary spend concentration: ' + (primaryModel ? primaryModel.model + ' at ' + primaryModel.percent.toFixed(1) + '% of runtime cost.' : 'No model concentration yet.'),
        'Average retrieval amplification: ' + formatNumber(state.summary.averageRetrievalAmplification, 'x') + '.',
        'Stable prompt region: ' + formatPercent(state.summary.stablePromptRegions) + '.'
      ].map(function (line) {
        return '<li>' + escapeHtml(line) + '</li>';
      }).join('');
    }

    function renderWorkspaces(state) {
      const container = document.getElementById('workspace-summary');
      if (!container) {
        return;
      }

      const aggregates = new Map();
      state.sessions.forEach(function (session) {
        const current = aggregates.get(session.workspace) || {
          workspace: session.workspace,
          sessions: 0,
          cost: 0,
          cacheEfficiency: 0,
          retrievalAmplification: 0
        };
        current.sessions += 1;
        current.cost += session.estimatedCost;
        current.cacheEfficiency += session.cacheEfficiency;
        current.retrievalAmplification += session.retrievalAmplification;
        aggregates.set(session.workspace, current);
      });

      const entries = Array.from(aggregates.values())
        .sort(function (left, right) {
          return right.cost - left.cost;
        });

      container.innerHTML = entries.length === 0
        ? '<div class="empty-state">No workspace runtime activity is available in the selected time window.</div>'
        : entries.map(function (entry) {
          const averageCache = entry.sessions === 0 ? 0 : entry.cacheEfficiency / entry.sessions;
          const averageAmplification = entry.sessions === 0 ? 0 : entry.retrievalAmplification / entry.sessions;
          return ''
            + '<div class="workspace-card">'
            + '  <span class="section-label">Workspace</span>'
            + '  <strong>' + escapeHtml(entry.workspace) + '</strong>'
            + '  <div class="muted">' + escapeHtml(String(entry.sessions)) + ' sessions · ' + escapeHtml(formatCurrency(entry.cost)) + '</div>'
            + '  <div class="muted">Cache ' + escapeHtml(formatPercent(averageCache)) + ' · Retrieval ' + escapeHtml(formatNumber(averageAmplification, 'x')) + '</div>'
            + '</div>';
        }).join('');
    }

    function renderSettings(state) {
      const workspace = document.getElementById('settings-workspace');
      const windowLabel = document.getElementById('settings-window');
      if (workspace) {
        workspace.textContent = state.filter.workspace;
      }
      if (windowLabel) {
        windowLabel.textContent = state.filter.timeWindowDays === 1
          ? '24 hours'
          : String(state.filter.timeWindowDays) + ' days';
      }
    }

    function setSection(section) {
      const nextSection = dashboardSections.includes(section) ? section : 'overview';
      activeSection = nextSection;
      dashboardSections.forEach(function (name) {
        const sectionElement = document.getElementById('section-' + name);
        if (sectionElement) {
          sectionElement.classList.toggle('active', name === nextSection);
        }
      });
      Array.from(document.querySelectorAll('[data-section-nav]')).forEach(function (button) {
        button.classList.toggle('active', button.dataset.sectionNav === nextSection);
      });
    }

    function buildCacheTooltip(session) {
      const cacheIndicator = cacheIndicatorClass(session.cacheEfficiency);
      const guidance = cacheIndicator === 'high'
        ? 'High cache reuse. Prompt stability is strong.'
        : cacheIndicator === 'partial'
          ? 'Moderate cache reuse. Some prompt churn is reducing savings.'
          : 'High context mutation detected. Prompt stability is poor.';
      return 'Cache Efficiency: ' + formatPercent(session.cacheEfficiency) + '\n' + guidance;
    }

    function deriveSessionComposition(session) {
      const promptTokens = Math.max(Number(session.promptTokens) || 0, 0);
      if (promptTokens === 0) {
        return {
          systemPrompt: 0,
          memory: 0,
          retrieval: 0,
          toolOutput: 0,
          userInput: 0,
          completion: Math.max(Number(session.completionTokens) || 0, 0)
        };
      }

      const weights = {
        systemPrompt: 1.4,
        memory: Math.min(Math.max((session.cacheReadTokens / Math.max(promptTokens, 1)) * 2.2, 0.7), 1.8),
        retrieval: Math.min(Math.max((Math.max(session.retrievalAmplification - 1, 0)) * 0.9, 0.3), 2.8),
        toolOutput: Math.min(Math.max((session.mcpConfigs || []).length * 0.6, 0.2), 1.2),
        userInput: Math.min(Math.max((session.promptFiles || []).length * 0.85, 0.8), 1.6)
      };
      const totalWeight = weights.systemPrompt + weights.memory + weights.retrieval + weights.toolOutput + weights.userInput;
      const systemPrompt = Math.round(promptTokens * (weights.systemPrompt / totalWeight));
      const memory = Math.round(promptTokens * (weights.memory / totalWeight));
      const retrieval = Math.round(promptTokens * (weights.retrieval / totalWeight));
      const toolOutput = Math.round(promptTokens * (weights.toolOutput / totalWeight));
      const userInput = Math.max(promptTokens - systemPrompt - memory - retrieval - toolOutput, 0);

      return {
        systemPrompt: systemPrompt,
        memory: memory,
        retrieval: retrieval,
        toolOutput: toolOutput,
        userInput: userInput,
        completion: Math.max(Number(session.completionTokens) || 0, 0)
      };
    }

    function buildSessionOptimizations(session) {
      const suggestions = [];
      if (session.retrievalAmplification >= 4) {
        suggestions.push('Reduce retrieval breadth or tighten chunk selection to cut amplification.');
      }
      if (session.cacheEfficiency <= 30) {
        suggestions.push('Stabilize prompt regions to improve cache reuse and lower runtime cost.');
      }
      if (session.contextPressure >= 70) {
        suggestions.push('Trim context breadth or tool noise to reduce reasoning risk.');
      }
      if (session.model !== 'GPT-5 mini' && session.contextPressure < 55) {
        suggestions.push('Evaluate GPT-5 mini for this workload to improve model efficiency.');
      }
      return suggestions.length > 0 ? suggestions : ['Current session is within a healthy operating envelope.'];
    }

    function renderSessionDetail(session) {
      const composition = deriveSessionComposition(session);
      const suggestions = buildSessionOptimizations(session);
      return ''
        + '<div class="detail-grid">'
        + '  <div class="detail-card">'
        + '    <h4>Prompt Breakdown</h4>'
        + '    <ul class="detail-list">'
        + '      <li>Prompt Tokens: ' + escapeHtml(formatCompact(session.promptTokens, ' tokens')) + '</li>'
        + '      <li>Completion Tokens: ' + escapeHtml(formatCompact(session.completionTokens, ' tokens')) + '</li>'
        + '      <li>Prompt Files: ' + escapeHtml((session.promptFiles || []).join(', ') || 'None') + '</li>'
        + '      <li>Stable Region: ' + escapeHtml(formatPercent(session.promptStability)) + '</li>'
        + '    </ul>'
        + '  </div>'
        + '  <div class="detail-card">'
        + '    <h4>Retrieval & Tools</h4>'
        + '    <ul class="detail-list">'
        + '      <li>Retrieval Chunks: ' + escapeHtml((session.retrievalFiles || []).join(', ') || 'None') + '</li>'
        + '      <li>Tool Calls / MCP: ' + escapeHtml((session.mcpConfigs || []).join(', ') || 'None') + '</li>'
        + '      <li>Amplification: ' + escapeHtml(formatNumber(session.retrievalAmplification, 'x')) + '</li>'
        + '      <li>Cache Regions: read ' + escapeHtml(formatCompact(session.cacheReadTokens, ' tokens')) + ', create ' + escapeHtml(formatCompact(session.cacheCreateTokens, ' tokens')) + '</li>'
        + '    </ul>'
        + '  </div>'
        + '  <div class="detail-card">'
        + '    <h4>Context Composition</h4>'
        + '    <ul class="detail-list">'
        + '      <li>System Prompt: ' + escapeHtml(formatCompact(composition.systemPrompt, ' tokens')) + '</li>'
        + '      <li>Memory: ' + escapeHtml(formatCompact(composition.memory, ' tokens')) + '</li>'
        + '      <li>Retrieval: ' + escapeHtml(formatCompact(composition.retrieval, ' tokens')) + '</li>'
        + '      <li>Tool Output: ' + escapeHtml(formatCompact(composition.toolOutput, ' tokens')) + '</li>'
        + '      <li>User Input: ' + escapeHtml(formatCompact(composition.userInput, ' tokens')) + '</li>'
        + '      <li>Completion: ' + escapeHtml(formatCompact(composition.completion, ' tokens')) + '</li>'
        + '    </ul>'
        + '  </div>'
        + '  <div class="detail-card">'
        + '    <h4>Optimization Suggestions</h4>'
        + '    <ul class="detail-list">'
        + suggestions.map(function (suggestion) {
          return '<li>' + escapeHtml(suggestion) + '</li>';
        }).join('')
        + '    </ul>'
        + '  </div>'
        + '  <div class="detail-card">'
        + '    <h4>Runtime Health</h4>'
        + '    <ul class="detail-list">'
        + '      <li>Latency: ' + escapeHtml(formatNumber(session.latencyMs, ' ms')) + '</li>'
        + '      <li>Context Pressure: ' + escapeHtml(formatPercent(session.contextPressure)) + '</li>'
        + '      <li>Risk: ' + escapeHtml(String(session.risk).toUpperCase()) + '</li>'
        + '      <li>Cache Savings: ' + escapeHtml(formatCurrency(session.cacheSavings)) + '</li>'
        + '    </ul>'
        + '  </div>'
        + '  <div class="detail-card">'
        + '    <h4>Model Switching</h4>'
        + '    <ul class="detail-list">'
        + '      <li>Current Model: ' + escapeHtml(session.model) + '</li>'
        + '      <li>Recommended Alt: ' + escapeHtml(session.model === 'GPT-5 mini' ? 'Current model already optimized' : 'GPT-5 mini for lower-pressure runs') + '</li>'
        + '      <li>Estimated Opportunity: ' + escapeHtml(formatPercent(Math.min(68, Math.max(12, Math.round(session.cacheSavings * 1000) / 10)))) + '</li>'
        + '    </ul>'
        + '  </div>'
        + '</div>';
    }

    function renderSessions(state) {
      const rows = document.getElementById('session-rows');
      if (!rows) {
        return;
      }

      rows.innerHTML = state.sessions.map(function (session, index) {
        const cacheIndicator = cacheIndicatorClass(session.cacheEfficiency);
        const detailId = 'detail-' + escapeHtml(session.id || String(index));
        return ''
          + '<tr data-session-id="' + escapeHtml(session.id || String(index)) + '">'
          + '  <td>' + escapeHtml(formatDate(session.endedAt || session.startedAt)) + '</td>'
          + '  <td><span class="source-pill">' + escapeHtml(String(session.source).toUpperCase()) + '</span></td>'
          + '  <td><span class="workspace-pill">' + escapeHtml(session.workspace) + '</span></td>'
          + '  <td class="title-cell"><button class="session-toggle" data-session-id="' + escapeHtml(session.id || String(index)) + '">▶</button><strong>' + escapeHtml(session.title) + '</strong><div class="muted">' + escapeHtml((session.files || []).length + ' files · ' + formatNumber(session.retrievalAmplification, 'x') + ' amplification') + '</div></td>'
          + '  <td>' + escapeHtml(session.model) + '</td>'
          + '  <td>' + escapeHtml(formatCurrency(session.estimatedCost)) + '</td>'
          + '  <td>' + escapeHtml(formatNumber(session.credits)) + '</td>'
          + '  <td><span class="cache-pill cache-' + cacheIndicator + '" title="' + escapeHtml(buildCacheTooltip(session)).replace(/\n/g, '&#10;') + '">' + escapeHtml(formatPercent(session.cacheEfficiency)) + '</span></td>'
          + '  <td>' + escapeHtml(formatNumber(session.latencyMs, ' ms')) + '</td>'
          + '  <td><span class="risk-pill risk-' + session.risk + '">' + escapeHtml(String(session.risk).toUpperCase()) + '</span></td>'
          + '</tr>'
          + '<tr id="' + detailId + '" class="detail-row hidden"><td colspan="10">' + renderSessionDetail(session) + '</td></tr>';
      }).join('') || '<tr><td colspan="10" class="muted">No sessions in the selected time window.</td></tr>';
    }

    function render(state) {
      currentState = state;
      renderSummary(state);
      renderFilters(state);
      renderCharts(state);
      renderLatest(state);
      renderHighlights(state);
      renderWorkspaces(state);
      renderSettings(state);
      renderSessions(state);
      setSection(activeSection);
    }

    document.getElementById('refresh-view').addEventListener('click', function () {
      vscode.postMessage({ command: 'refreshView' });
    });

    document.getElementById('export-csv').addEventListener('click', function () {
      vscode.postMessage({ command: 'exportView', format: 'csv' });
    });

    document.getElementById('export-json').addEventListener('click', function () {
      vscode.postMessage({ command: 'exportView', format: 'json' });
    });

    document.getElementById('workspace-filter').addEventListener('change', function (event) {
      const target = event.target;
      vscode.postMessage({
        command: 'updateFilter',
        workspace: target.value,
        timeWindowDays: Number(document.getElementById('time-window').value)
      });
    });

    document.getElementById('time-window').addEventListener('change', function (event) {
      const target = event.target;
      vscode.postMessage({
        command: 'updateFilter',
        workspace: document.getElementById('workspace-filter').value,
        timeWindowDays: Number(target.value)
      });
    });

    document.addEventListener('click', function (event) {
      const target = event.target;
      const button = target && target.closest ? target.closest('button[data-command], .session-toggle') : null;
      if (!button) {
        return;
      }

      if (button.classList.contains('session-toggle')) {
        const sessionId = button.dataset.sessionId;
        const detailRow = document.querySelector('tr#detail-' + CSS.escape(sessionId));
        if (!detailRow) {
          return;
        }

        const isHidden = detailRow.classList.contains('hidden');
        detailRow.classList.toggle('hidden', !isHidden);
        button.textContent = isHidden ? '▼' : '▶';
        return;
      }

      if (button.dataset.command) {
        vscode.postMessage({ command: button.dataset.command });
      }
    });

    Array.from(document.querySelectorAll('[data-section-nav]')).forEach(function (button) {
      button.addEventListener('click', function () {
        setSection(button.dataset.sectionNav || 'overview');
      });
    });

    window.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'tokenlint.runtimeDashboard') {
        if (event.data.payload && event.data.payload.activeSection) {
          activeSection = event.data.payload.activeSection;
        }
        render(event.data.payload);
      }
    });

    render({
      generatedAt: Date.now(),
      latestSession: undefined,
      sessions: [],
      summary: {
        sessions: 0,
        totalCost: 0,
        totalCredits: 0,
        averageCacheEfficiency: 0,
        estimatedSavings: 0,
        estimatedWaste: 0,
        averageRetrievalAmplification: 0,
        averageContextPressure: 0,
        stablePromptRegions: 0,
        volatilePromptRegions: 0,
        contextHealth: 0,
        reasoningRisk: 'low'
      },
      costOverTime: [],
      costByModel: [],
      cacheBreakdown: {
        totalTokens: 0,
        cacheReadTokens: 0,
        cacheCreateTokens: 0
      },
      retrievalAmplification: [],
      cacheEfficiencyTrend: [],
      contextComposition: {
        systemPrompt: 0,
        memory: 0,
        retrieval: 0,
        toolOutput: 0,
        userInput: 0,
        completion: 0
      },
      workspaces: ['All workspaces'],
      filter: {
        workspace: 'All workspaces',
        timeWindowDays: 7
      },
      activeSection: 'overview'
    });
  </script>
</body>
</html>`;
  }
}