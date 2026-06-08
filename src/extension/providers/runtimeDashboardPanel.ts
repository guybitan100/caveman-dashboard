import * as vscode from 'vscode';

import { RuntimeDashboardState } from '../../runtime/session/sessionModels';

export interface RuntimeDashboardFilterState {
  workspace: string;
  timeWindowDays: number;
}

export interface RuntimeDashboardViewState extends RuntimeDashboardState {
  filter: RuntimeDashboardFilterState;
}

export type RuntimeDashboardMessage =
  | { command: 'refreshView' }
  | { command: 'updateFilter'; workspace?: string; timeWindowDays?: number }
  | { command: 'exportView'; format: 'csv' | 'json' }
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
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: dark;
      --bg: color-mix(in srgb, var(--vscode-editor-background) 84%, #07111f 16%);
      --panel: color-mix(in srgb, var(--vscode-sideBar-background) 68%, #0f1726 32%);
      --panel-strong: color-mix(in srgb, var(--vscode-sideBar-background) 54%, #111c2e 46%);
      --border: color-mix(in srgb, var(--vscode-panel-border, #22324d) 70%, #2c3d59 30%);
      --muted: var(--vscode-descriptionForeground);
      --accent: #4da3ff;
      --accent-soft: rgba(77, 163, 255, 0.14);
      --success: #3fb950;
      --warning: #d29922;
      --danger: #f85149;
      --text: var(--vscode-foreground);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 22px;
      font-family: var(--vscode-font-family);
      color: var(--text);
      background:
        radial-gradient(circle at top right, rgba(77, 163, 255, 0.12), transparent 30%),
        linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg) 82%, black 18%));
    }

    .shell {
      max-width: 1240px;
      margin: 0 auto;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }

    .title-wrap h1 {
      margin: 0 0 6px;
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .title-wrap p {
      margin: 0;
      color: var(--muted);
      max-width: 720px;
      line-height: 1.5;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    select,
    button {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 9px 12px;
      background: var(--panel);
      color: var(--text);
      font: inherit;
    }

    button {
      cursor: pointer;
      background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 24%, var(--panel) 76%), var(--panel));
    }

    button.secondary {
      background: var(--panel);
    }

    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 18px;
    }

    .tab {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      padding: 10px 4px;
      color: var(--muted);
    }

    .tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }

    .card {
      background: linear-gradient(180deg, var(--panel), var(--panel-strong));
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
    }

    .summary-card span,
    .section-label {
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .summary-card strong {
      display: block;
      font-size: 34px;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin-bottom: 4px;
    }

    .summary-card small {
      color: var(--muted);
    }

    .panel-grid {
      display: grid;
      grid-template-columns: 1.55fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .metric-box {
      padding: 14px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
    }

    .metric-box strong {
      display: block;
      font-size: 24px;
      margin-top: 4px;
    }

    .bar-row { margin-bottom: 14px; }

    .bar-head {
      display: flex;
      justify-content: space-between;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 6px;
    }

    .bar-track {
      width: 100%;
      height: 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--accent), #6ee7f9);
    }

    .table-card { overflow: hidden; }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    thead th {
      text-align: left;
      padding: 10px 12px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      border-bottom: 1px solid var(--border);
    }

    tbody td {
      padding: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      vertical-align: top;
    }

    tbody tr:hover { background: rgba(255, 255, 255, 0.025); }

    .workspace-pill,
    .risk-pill,
    .cache-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .workspace-pill {
      background: var(--accent-soft);
      color: var(--accent);
    }

    .risk-low { color: var(--success); }
    .risk-medium { color: #80c2ff; }
    .risk-high { color: var(--warning); }
    .risk-critical { color: var(--danger); }

    .cache-high { color: var(--success); }
    .cache-partial { color: var(--warning); }
    .cache-none { color: var(--danger); }

    .muted { color: var(--muted); }
    .hidden { display: none; }

    .latest-layout {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 16px;
    }

    .list {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.6;
    }

    .empty {
      padding: 28px;
      border: 1px dashed var(--border);
      border-radius: 16px;
      text-align: center;
      color: var(--muted);
    }

    @media (max-width: 1024px) {
      .summary-grid,
      .panel-grid,
      .latest-layout {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <div class="title-wrap">
        <h1>AI Runtime Observability Platform</h1>
        <p>Simulated telemetry for TokenLint sessions: runtime cost, cache efficiency, retrieval amplification, context pressure, and cognitive runtime health.</p>
      </div>
      <div class="toolbar">
        <label class="muted" for="workspace-filter">Workspace</label>
        <select id="workspace-filter"></select>
        <label class="muted" for="time-window">Time window</label>
        <select id="time-window">
          <option value="1">24 hours</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
        </select>
        <button id="refresh-view">Refresh</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="latest">Latest Session</button>
      <button class="tab" data-tab="sessions">All Sessions</button>
      <button class="tab" data-tab="aggregate">Aggregate</button>
    </div>

    <div class="summary-grid">
      <div class="card summary-card">
        <span>Sessions</span>
        <strong id="summary-sessions">0</strong>
        <small id="summary-workspaces">No recorded workspaces yet</small>
      </div>
      <div class="card summary-card">
        <span>Cost</span>
        <strong id="summary-cost">$0.00</strong>
        <small>Estimated runtime spend</small>
      </div>
      <div class="card summary-card">
        <span>Credits</span>
        <strong id="summary-credits">0.00</strong>
        <small>1 credit = $0.01 USD</small>
      </div>
      <div class="card summary-card">
        <span>Cache Efficiency</span>
        <strong id="summary-cache">0%</strong>
        <small id="summary-generated">No telemetry yet</small>
      </div>
    </div>

    <section id="tab-latest">
      <div id="latest-empty" class="empty hidden">Run TokenLint scan or budget actions to generate a simulated runtime session.</div>
      <div id="latest-content" class="latest-layout hidden">
        <div class="card">
          <span class="section-label">Latest Session</span>
          <div class="metrics-grid">
            <div class="metric-box"><span class="section-label">Model</span><strong id="latest-model">--</strong><div class="muted" id="latest-window">--</div></div>
            <div class="metric-box"><span class="section-label">Runtime Cost</span><strong id="latest-cost">--</strong><div class="muted" id="latest-credits">--</div></div>
            <div class="metric-box"><span class="section-label">Prompt / Completion</span><strong id="latest-tokens">--</strong><div class="muted" id="latest-cache">--</div></div>
            <div class="metric-box"><span class="section-label">Health</span><strong id="latest-risk">--</strong><div class="muted" id="latest-latency">--</div></div>
          </div>
        </div>
        <div class="card">
          <span class="section-label">Cognitive Runtime Health</span>
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
      </div>
      <div class="panel-grid hidden" id="latest-detail-grid">
        <div class="card">
          <span class="section-label">Participating Files</span>
          <ul class="list" id="latest-files"></ul>
        </div>
        <div class="card">
          <span class="section-label">Telemetry Breakdown</span>
          <ul class="list" id="latest-breakdown"></ul>
        </div>
      </div>
    </section>

    <section id="tab-sessions" class="hidden">
      <div class="card table-card">
        <div class="table-header">
          <span class="section-label">Session Activity</span>
          <div class="toolbar">
            <button class="secondary" data-command="exportView" data-format="csv">Export CSV</button>
            <button class="secondary" data-command="exportView" data-format="json">Export JSON</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Model</th>
              <th>Workspace</th>
              <th>Cost</th>
              <th>Tokens</th>
              <th>Cache</th>
              <th>Risk</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody id="session-rows"></tbody>
        </table>
      </div>
    </section>

    <section id="tab-aggregate" class="hidden">
      <div class="panel-grid">
        <div class="card">
          <span class="section-label">Aggregate Runtime Analytics</span>
          <div class="bar-row">
            <div class="bar-head"><span>Cache Efficiency</span><span id="aggregate-cache">--</span></div>
            <div class="bar-track"><div id="aggregate-cache-bar" class="bar-fill"></div></div>
          </div>
          <div class="bar-row">
            <div class="bar-head"><span>Retrieval Amplification</span><span id="aggregate-amplification">--</span></div>
            <div class="bar-track"><div id="aggregate-amplification-bar" class="bar-fill"></div></div>
          </div>
          <div class="bar-row">
            <div class="bar-head"><span>Context Pressure</span><span id="aggregate-pressure">--</span></div>
            <div class="bar-track"><div id="aggregate-pressure-bar" class="bar-fill"></div></div>
          </div>
          <div class="bar-row">
            <div class="bar-head"><span>Prompt Stability</span><span id="aggregate-stability">--</span></div>
            <div class="bar-track"><div id="aggregate-stability-bar" class="bar-fill"></div></div>
          </div>
        </div>
        <div class="card">
          <span class="section-label">Analysis Commands</span>
          <div class="toolbar">
            <button class="secondary" data-command="showCostAnalysis">Show Cost Analysis</button>
            <button class="secondary" data-command="analyzeCacheEfficiency">Analyze Cache Efficiency</button>
            <button class="secondary" data-command="analyzeRetrievalAmplification">Analyze Retrieval Amplification</button>
          </div>
          <ul class="list" id="aggregate-highlights"></ul>
        </div>
      </div>
    </section>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const numberFormatter = new Intl.NumberFormat('en-US');
    const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    const tabs = Array.from(document.querySelectorAll('.tab'));
    let activeTab = 'latest';

    const tabSections = {
      latest: document.getElementById('tab-latest'),
      sessions: document.getElementById('tab-sessions'),
      aggregate: document.getElementById('tab-aggregate')
    };

    function formatNumber(value, suffix) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return numberFormatter.format(Math.round(value * 10) / 10) + (suffix || '');
    }

    function formatTokens(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return numberFormatter.format(Math.round(value)) + ' tokens';
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

      return new Date(timestamp).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
    }

    function setBar(id, value, maxValue) {
      const element = document.getElementById(id);
      if (!element) {
        return;
      }

      const percent = Math.max(0, Math.min((value / maxValue) * 100, 100));
      element.style.width = percent + '%';
    }

    function setTab(tabName) {
      activeTab = tabName;
      tabs.forEach(function (tab) {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
      });
      Object.keys(tabSections).forEach(function (name) {
        tabSections[name].classList.toggle('hidden', name !== tabName);
      });
    }

    function renderSummary(state) {
      document.getElementById('summary-sessions').textContent = formatNumber(state.summary.totalSessions);
      document.getElementById('summary-cost').textContent = formatCurrency(state.summary.totalCost);
      document.getElementById('summary-credits').textContent = formatNumber(state.summary.totalCredits);
      document.getElementById('summary-cache').textContent = formatPercent(state.summary.averageCacheEfficiency);
      document.getElementById('summary-workspaces').textContent = state.workspaces.length > 1
        ? String(state.workspaces.length - 1) + ' workspaces loaded'
        : 'No recorded workspaces yet';
      document.getElementById('summary-generated').textContent = 'Updated ' + formatDate(state.generatedAt);
    }

    function renderLatest(state) {
      const session = state.latestSession;
      const empty = document.getElementById('latest-empty');
      const content = document.getElementById('latest-content');
      const detailGrid = document.getElementById('latest-detail-grid');

      empty.classList.toggle('hidden', Boolean(session));
      content.classList.toggle('hidden', !session);
      detailGrid.classList.toggle('hidden', !session);

      if (!session) {
        return;
      }

      document.getElementById('latest-model').textContent = session.model;
      document.getElementById('latest-window').textContent = 'Context window: ' + formatNumber(session.contextWindow) + ' tokens';
      document.getElementById('latest-cost').textContent = formatCurrency(session.estimatedCost);
      document.getElementById('latest-credits').textContent = formatNumber(session.credits) + ' credits';
      document.getElementById('latest-tokens').textContent = formatTokens(session.promptTokens) + ' / ' + formatTokens(session.completionTokens);
      document.getElementById('latest-cache').textContent = 'Cache read ' + formatTokens(session.cacheReadTokens);
      document.getElementById('latest-risk').innerHTML = '<span class="risk-pill risk-' + session.risk + '">' + session.risk.toUpperCase() + '</span>';
      document.getElementById('latest-latency').textContent = 'Latency ' + formatNumber(session.latencyMs, ' ms');
      document.getElementById('latest-amplification').textContent = formatNumber(session.retrievalAmplification, 'x');
      document.getElementById('latest-pressure').textContent = formatPercent(session.contextPressure);
      document.getElementById('latest-stability').textContent = formatPercent(session.promptStability);
      setBar('latest-amplification-bar', session.retrievalAmplification, 8);
      setBar('latest-pressure-bar', session.contextPressure, 100);
      setBar('latest-stability-bar', session.promptStability, 100);
      document.getElementById('latest-files').innerHTML = session.files.map(function (file) {
        return '<li>' + file + '</li>';
      }).join('');
      document.getElementById('latest-breakdown').innerHTML = [
        'Workspace: ' + session.workspace,
        'Requests: ' + formatNumber(session.requests),
        'Prompt files: ' + (session.promptFiles.join(', ') || 'None'),
        'Retrieval files: ' + (session.retrievalFiles.join(', ') || 'None'),
        'Skills: ' + (session.skills.join(', ') || 'None'),
        'MCP configs: ' + (session.mcpConfigs.join(', ') || 'None'),
        'Session ended: ' + formatDate(session.endedAt || session.startedAt)
      ].map(function (line) {
        return '<li>' + line + '</li>';
      }).join('');
    }

    function renderSessions(state) {
      const rows = document.getElementById('session-rows');
      rows.innerHTML = state.sessions.map(function (session) {
        const cacheIndicator = session.cacheEfficiency >= 55 ? 'high' : session.cacheEfficiency >= 25 ? 'partial' : 'none';
        return '<tr>'
          + '<td>' + formatDate(session.endedAt || session.startedAt) + '</td>'
          + '<td>' + session.model + '</td>'
          + '<td><span class="workspace-pill">' + session.workspace + '</span></td>'
          + '<td>' + formatCurrency(session.estimatedCost) + '<div class="muted">' + formatNumber(session.credits) + ' cr</div></td>'
          + '<td>' + formatTokens(session.promptTokens + session.completionTokens) + '<div class="muted">Prompt ' + formatTokens(session.promptTokens) + '</div></td>'
          + '<td><span class="cache-pill cache-' + cacheIndicator + '">' + cacheIndicator.toUpperCase() + '</span><div class="muted">' + formatPercent(session.cacheEfficiency) + '</div></td>'
          + '<td><span class="risk-pill risk-' + session.risk + '">' + session.risk.toUpperCase() + '</span><div class="muted">' + formatNumber(session.retrievalAmplification, 'x') + ' amp</div></td>'
          + '<td>' + formatNumber(session.latencyMs, ' ms') + '<div class="muted">' + formatPercent(session.contextPressure) + ' pressure</div></td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="8" class="muted">No sessions in the selected time window.</td></tr>';
    }

    function renderAggregate(state) {
      document.getElementById('aggregate-cache').textContent = formatPercent(state.summary.averageCacheEfficiency);
      document.getElementById('aggregate-amplification').textContent = formatNumber(state.summary.averageRetrievalAmplification, 'x');
      document.getElementById('aggregate-pressure').textContent = formatPercent(state.summary.averageContextPressure);
      document.getElementById('aggregate-stability').textContent = formatPercent(state.summary.stablePromptRegions);
      setBar('aggregate-cache-bar', state.summary.averageCacheEfficiency, 100);
      setBar('aggregate-amplification-bar', state.summary.averageRetrievalAmplification, 8);
      setBar('aggregate-pressure-bar', state.summary.averageContextPressure, 100);
      setBar('aggregate-stability-bar', state.summary.stablePromptRegions, 100);
      document.getElementById('aggregate-highlights').innerHTML = [
        'Volatile prompt regions: ' + formatPercent(state.summary.volatilePromptRegions),
        'Context pressure trend: ' + formatPercent(state.summary.averageContextPressure),
        'Retrieval amplification trend: ' + formatNumber(state.summary.averageRetrievalAmplification, 'x'),
        'Workspace coverage: ' + Math.max(state.workspaces.length - 1, 0) + ' workspaces'
      ].map(function (line) {
        return '<li>' + line + '</li>';
      }).join('');
    }

    function renderFilters(state) {
      const workspaceSelect = document.getElementById('workspace-filter');
      const timeWindowSelect = document.getElementById('time-window');
      workspaceSelect.innerHTML = state.workspaces.map(function (workspace) {
        const selected = workspace === state.filter.workspace ? ' selected' : '';
        return '<option value="' + workspace + '"' + selected + '>' + workspace + '</option>';
      }).join('');
      timeWindowSelect.value = String(state.filter.timeWindowDays);
    }

    function render(state) {
      renderSummary(state);
      renderFilters(state);
      renderLatest(state);
      renderSessions(state);
      renderAggregate(state);
      setTab(activeTab);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        setTab(tab.dataset.tab);
      });
    });

    document.getElementById('refresh-view').addEventListener('click', function () {
      vscode.postMessage({ command: 'refreshView' });
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

    Array.from(document.querySelectorAll('button[data-command="exportView"]')).forEach(function (button) {
      button.addEventListener('click', function () {
        vscode.postMessage({ command: 'exportView', format: button.dataset.format });
      });
    });

    Array.from(document.querySelectorAll('button[data-command="showCostAnalysis"], button[data-command="analyzeCacheEfficiency"], button[data-command="analyzeRetrievalAmplification"]')).forEach(function (button) {
      button.addEventListener('click', function () {
        vscode.postMessage({ command: button.dataset.command });
      });
    });

    window.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'tokenlint.runtimeDashboard') {
        render(event.data.payload);
      }
    });

    render({
      generatedAt: Date.now(),
      sessions: [],
      summary: {
        totalSessions: 0,
        totalCost: 0,
        totalCredits: 0,
        averageCacheEfficiency: 0,
        averageRetrievalAmplification: 0,
        averageContextPressure: 0,
        stablePromptRegions: 0,
        volatilePromptRegions: 0
      },
      workspaces: ['All workspaces'],
      filter: {
        workspace: 'All workspaces',
        timeWindowDays: 7
      }
    });
  </script>
</body>
</html>`;
  }
}