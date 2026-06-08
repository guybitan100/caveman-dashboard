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
          await vscode.commands.executeCommand('tokenlint.openRuntimeDashboard');
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
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 14px;
      line-height: 1.45;
    }

    .title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      margin-bottom: 16px;
      line-height: 1.4;
    }

    button {
      width: 100%;
      margin-bottom: 8px;
      padding: 8px 10px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      border-radius: 4px;
      text-align: left;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .section {
      margin-top: 18px;
      margin-bottom: 8px;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.08em;
    }

    .note {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
      margin-top: 12px;
    }

    .card {
      border: 1px solid var(--vscode-panel-border, transparent);
      border-radius: 8px;
      padding: 12px;
      background: color-mix(in srgb, var(--vscode-editor-background) 82%, var(--vscode-sideBar-background) 18%);
      margin-bottom: 16px;
    }

    .card-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 10px;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }

    .metric {
      padding: 8px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background) 12%);
      border: 1px solid var(--vscode-panel-border, transparent);
    }

    .metric span {
      display: block;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 4px;
    }

    .metric strong {
      display: block;
      font-size: 13px;
      font-weight: 700;
    }

    .metric-wide {
      grid-column: 1 / -1;
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
      margin-top: 8px;
    }

    .budget-actions {
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="title">TokenLint</div>
  <div class="subtitle">
    Compiler-style diagnostics for prompts, skills, MCP workflows, and cognitive security.
  </div>

  <div class="card">
    <div class="card-title">Copilot Context Budget</div>
    <div class="metric-grid">
      <div class="metric">
        <span>Current File</span>
        <strong id="budget-current-file">--</strong>
      </div>
      <div class="metric">
        <span>Open Files</span>
        <strong id="budget-open-files">--</strong>
      </div>
      <div class="metric">
        <span>Workspace Estimate</span>
        <strong id="budget-workspace">--</strong>
      </div>
      <div class="metric">
        <span>Configured Budget</span>
        <strong id="budget-configured">--</strong>
      </div>
      <div class="metric">
        <span>Usage</span>
        <strong id="budget-usage">--</strong>
      </div>
      <div class="metric">
        <span>Risk</span>
        <strong id="budget-risk" class="risk-pill risk-low">LOW</strong>
      </div>
      <div class="metric metric-wide">
        <span>Estimated Retrieval Tokens</span>
        <strong id="budget-retrieval">--</strong>
      </div>
      <div class="metric metric-wide">
        <span>Estimated Final Context</span>
        <strong id="budget-final-context">--</strong>
      </div>
      <div class="metric metric-wide">
        <span>Highest Risk Files</span>
        <strong id="budget-highest-risk">--</strong>
      </div>
    </div>

    <div class="budget-actions">
      <button class="secondary" data-command="showCopilotBudget">Show Copilot Budget</button>
      <button data-command="analyzeOpenFilesBudget">Analyze Open Files Budget</button>
      <button data-command="analyzeWorkspaceBudget">Analyze Workspace Budget</button>
      <button class="secondary" data-command="setCopilotBudget">Set Copilot Budget</button>
    </div>

    <div class="mini-note" id="budget-amplification">Runtime amplification: --</div>
  </div>

  <div class="section">Runtime</div>
  <button class="secondary" data-command="openRuntimeDashboard">Open Runtime Dashboard</button>
  <button data-command="showCostAnalysis">Show Cost Analysis</button>
  <button data-command="analyzeCacheEfficiency">Analyze Cache Efficiency</button>
  <button data-command="analyzeRetrievalAmplification">Analyze Retrieval Amplification</button>

  <div class="section">Scan</div>
  <button class="secondary" data-command="scanOrFix">Scan / Fix...</button>
  <button data-command="scanCurrentFile">Scan Current File</button>
  <button data-command="scanWorkspace">Scan Workspace</button>

  <div class="section">Reports</div>
  <button class="secondary" data-command="generateReport">Generate Report</button>
  <button class="secondary" data-command="showIR">Show IR</button>

  <div class="section">Fixes</div>
  <button data-command="applyAllSafeFixes">Apply All Safe Fixes</button>
  <button class="secondary" data-command="showFixGraph">Show Before / After Graph</button>

  <div class="note">
    Safe automatic fixes currently remove exact duplicate instructions.
    Use the graph preview to compare the current file against the projected safe-fix result.
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const numberFormatter = new Intl.NumberFormat('en-US');

    const budgetElements = {
      currentFile: document.getElementById('budget-current-file'),
      openFiles: document.getElementById('budget-open-files'),
      workspace: document.getElementById('budget-workspace'),
      configured: document.getElementById('budget-configured'),
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
      budgetElements.openFiles.textContent = formatTokens(budget && budget.openFilesTokens);
      budgetElements.workspace.textContent = formatTokens(budget && budget.workspaceTokens);
      budgetElements.configured.textContent = formatTokens(budget && budget.budgetTokens);
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
        vscode.postMessage({ command: btn.dataset.command });
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
