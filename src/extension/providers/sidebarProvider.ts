import * as vscode from 'vscode';

import { BudgetResult, WorkspaceBudgetAnalysis } from '../../core/budget/budgetModels';

export interface TokenLintSidebarBudgetPayload {
  budget?: BudgetResult;
  workspaceAnalysis?: WorkspaceBudgetAnalysis;
}

export class TokenLintSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'tokenlint.sidebar';

  private view: vscode.WebviewView | undefined;
  private latestBudget: TokenLintSidebarBudgetPayload = {};

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);
    this.postBudgetUpdate();

    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'scanOrFix':
          await vscode.commands.executeCommand('tokenlint.scanOrFix');
          break;

        case 'scanCurrentFile':
          await vscode.commands.executeCommand('tokenlint.scanCurrentFile');
          break;

        case 'scanWorkspace':
          await vscode.commands.executeCommand('tokenlint.scanWorkspace');
          break;

        case 'showCopilotBudget':
          await vscode.commands.executeCommand('tokenlint.showCopilotBudget');
          break;

        case 'openRuntimeDashboard':
          await vscode.commands.executeCommand('tokenlint.openRuntimeDashboard', message.section ?? 'overview');
          break;

        case 'showCostAnalysis':
          await vscode.commands.executeCommand('tokenlint.showCostAnalysis');
          break;

        case 'analyzeCacheEfficiency':
          await vscode.commands.executeCommand('tokenlint.analyzeCacheEfficiency');
          break;

        case 'analyzeRetrievalAmplification':
          await vscode.commands.executeCommand('tokenlint.analyzeRetrievalAmplification');
          break;

        case 'analyzeOpenFilesBudget':
          await vscode.commands.executeCommand('tokenlint.analyzeOpenFilesBudget');
          break;

        case 'analyzeWorkspaceBudget':
          await vscode.commands.executeCommand('tokenlint.analyzeWorkspaceBudget');
          break;

        case 'setCopilotBudget':
          await vscode.commands.executeCommand('tokenlint.setCopilotBudget');
          break;

        case 'generateReport':
          await vscode.commands.executeCommand('tokenlint.generateReport');
          break;

        case 'showIR':
          await vscode.commands.executeCommand('tokenlint.showIR');
          break;

        case 'applyAllSafeFixes':
          await vscode.commands.executeCommand('tokenlint.applyAllSafeFixes');
          break;

        case 'showFixGraph':
          await vscode.commands.executeCommand('tokenlint.showFixGraph');
          break;
      }
    });
  }

  updateBudget(payload: TokenLintSidebarBudgetPayload): void {
    this.latestBudget = payload;
    this.postBudgetUpdate();
  }

  private postBudgetUpdate(): void {
    if (!this.view) {
      return;
    }

    void this.view.webview.postMessage({
      type: 'tokenlint.budget',
      payload: this.latestBudget
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = String(Date.now());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      font-family: 'Inter', 'SF Pro Text', 'SF Pro Display', 'Segoe UI', var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 14px;
      line-height: 1.45;
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--vscode-textLink-foreground, #4ea1ff) 18%, transparent), transparent 36%),
        linear-gradient(180deg, color-mix(in srgb, var(--vscode-editor-background) 88%, #08111f 12%), color-mix(in srgb, var(--vscode-sideBar-background) 84%, #08111f 16%));
    }

    .shell {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .card {
      border: 1px solid var(--vscode-panel-border, transparent);
      border-radius: 14px;
      padding: 14px;
      background: color-mix(in srgb, var(--vscode-editor-background) 82%, var(--vscode-sideBar-background) 18%);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.14);
    }

    button {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      border-radius: 10px;
      text-align: left;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .eyebrow {
      display: block;
      margin-bottom: 8px;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.12em;
    }

    .title {
      font-size: 20px;
      font-weight: 760;
      margin-bottom: 4px;
      letter-spacing: -0.02em;
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.45;
      margin: 0;
    }

    .note {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
      margin-top: 10px;
    }

    .pulse-list,
    .utility-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pulse-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background) 12%);
      border: 1px solid var(--vscode-panel-border, transparent);
      font-size: 12px;
    }

    .pulse-row strong {
      font-size: 12px;
      font-weight: 760;
    }

    .utility-list button {
      text-align: center;
    }

    .risk-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 74px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: color-mix(in srgb, var(--vscode-editor-background) 75%, transparent);
    }

    .risk-low {
      color: var(--vscode-testing-iconPassed, #2ea043);
    }

    .risk-medium {
      color: var(--vscode-charts-yellow, #bf8700);
    }

    .risk-high {
      color: var(--vscode-testing-iconQueued, #bc6f00);
    }

    .risk-critical {
      color: var(--vscode-errorForeground, #d1242f);
    }

    .mini-note {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="card">
      <span class="eyebrow">Cost Dashboard</span>
      <div class="title">TokenLint Cost Tracker</div>
      <p class="subtitle">Click below to open the full Cost Dashboard.</p>
      <div class="utility-list" style="margin-top: 12px;">
        <button data-command="openRuntimeDashboard" data-section="overview">Open Dashboard</button>
      </div>
    </section>

    <section class="card">
      <span class="eyebrow">Context Pulse</span>
      <div class="pulse-list">
        <div class="pulse-row"><span>Current File</span><strong id="budget-current-file">--</strong></div>
        <div class="pulse-row"><span>Final Context</span><strong id="budget-final-context">--</strong></div>
        <div class="pulse-row"><span>Usage</span><strong id="budget-usage">--</strong></div>
        <div class="pulse-row"><span>Risk</span><strong id="budget-risk" class="risk-pill risk-low">LOW</strong></div>
      </div>
      <div class="mini-note">Retrieval: <span id="budget-retrieval">--</span></div>
      <div class="mini-note">Highest risk: <span id="budget-highest-risk">Not analyzed yet</span></div>
      <div class="mini-note" id="budget-amplification">Runtime amplification: --</div>
    </section>

    <section class="card">
      <span class="eyebrow">Utilities</span>
      <div class="utility-list">
        <button class="secondary" data-command="scanOrFix">Scan / Fix...</button>
        <button class="secondary" data-command="generateReport">Generate Report</button>
        <button class="secondary" data-command="showCopilotBudget">Show Copilot Budget</button>
        <button class="secondary" data-command="setCopilotBudget">Set Copilot Budget</button>
        <button class="secondary" data-command="applyAllSafeFixes">Apply All Safe Fixes</button>
        <button class="secondary" data-command="showFixGraph">Show Before / After Graph</button>
      </div>
      <div class="note">Cost, cache, and retrieval drilldowns now open from the dashboard as dedicated runtime panels instead of markdown editors.</div>
    </section>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const numberFormatter = new Intl.NumberFormat('en-US');

    const budgetElements = {
      currentFile: document.getElementById('budget-current-file'),
      usage: document.getElementById('budget-usage'),
      risk: document.getElementById('budget-risk'),
      retrieval: document.getElementById('budget-retrieval'),
      finalContext: document.getElementById('budget-final-context'),
      highestRisk: document.getElementById('budget-highest-risk'),
      amplification: document.getElementById('budget-amplification')
    };

    function formatTokens(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return numberFormatter.format(Math.max(0, Math.round(value))) + ' tokens';
    }

    function formatUsage(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }

      return Math.round(value) + '%';
    }

    function renderBudget(payload) {
      const budget = payload && payload.budget ? payload.budget : undefined;
      const workspaceAnalysis = payload && payload.workspaceAnalysis ? payload.workspaceAnalysis : undefined;
      const risk = budget && budget.risk ? budget.risk : 'low';

      budgetElements.currentFile.textContent = formatTokens(budget && budget.currentFileTokens);
      budgetElements.usage.textContent = formatUsage(budget && budget.usagePercent);
      budgetElements.retrieval.textContent = formatTokens(budget && budget.estimatedRetrievalTokens);
      budgetElements.finalContext.textContent = formatTokens(budget && budget.estimatedFinalContext);
      budgetElements.risk.textContent = String(risk).toUpperCase();
      budgetElements.risk.className = 'risk-pill risk-' + risk;
      budgetElements.highestRisk.textContent = workspaceAnalysis && workspaceAnalysis.highestRiskFiles && workspaceAnalysis.highestRiskFiles.length
        ? workspaceAnalysis.highestRiskFiles.slice(0, 3).join(', ')
        : 'Not analyzed yet';
      budgetElements.amplification.textContent = workspaceAnalysis
        ? 'Runtime amplification: ' + workspaceAnalysis.estimatedRuntimeAmplification.toFixed(1) + 'x'
        : 'Runtime amplification: --';
    }

    document.querySelectorAll('button[data-command]').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ command: btn.dataset.command, section: btn.dataset.section });
      });
    });

    window.addEventListener('message', event => {
      if (event.data && event.data.type === 'tokenlint.budget') {
        renderBudget(event.data.payload || {});
      }
    });

    renderBudget({});
  </script>
</body>
</html>`;
  }
}
