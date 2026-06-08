import * as vscode from 'vscode';

import { TokenLintDiagnosticProvider } from './providers/diagnosticProvider';
import { createHoverProvider } from './providers/hoverProvider';
import { TokenLintCodeActionProvider } from './providers/codeActionProvider';
import { TokenLintSidebarProvider } from './providers/sidebarProvider';
import { CopilotBudgetController, shouldIncludeBudgetFile } from './utils/copilotBudget';
import { RuntimeObservabilityController } from './utils/runtimeObservability';

import { scanCurrentFile } from './commands/scanCurrentFile';
import { scanWorkspace } from './commands/scanWorkspace';
import { generateReport } from './commands/generateReport';
import { showIR } from './commands/showIR';
import { applyAllSafeFixes } from './commands/applyAllSafeFixes';
import { showFixGraph } from './commands/showFixGraph';
import { scanOrFix } from './commands/scanOrFix';

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = new TokenLintDiagnosticProvider();
  const sidebarProvider = new TokenLintSidebarProvider(context.extensionUri);
  const runtimeObservability = new RuntimeObservabilityController(context);

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const budgetController = new CopilotBudgetController(
    statusBar,
    sidebarProvider,
    runtimeObservability
  );

  const supportedSelectors: vscode.DocumentSelector = [
    { scheme: 'file', language: 'markdown' },
    { scheme: 'file', language: 'yaml' },
    { scheme: 'file', language: 'json' },
    { scheme: 'file', language: 'typescript' },
    { scheme: 'file', language: 'typescriptreact' },
    { scheme: 'file', language: 'python' },
    { scheme: 'file', pattern: '**/*.prompt' }
  ];

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TokenLintSidebarProvider.viewType,
      sidebarProvider
    ),
    vscode.commands.registerCommand('tokenlint.scanCurrentFile', async () => {
      await scanCurrentFile(diagnostics);
      await budgetController.refresh();
    }),

    vscode.commands.registerCommand('tokenlint.scanWorkspace', async () => {
      await scanWorkspace(diagnostics);
      await budgetController.refresh({ forceWorkspaceRefresh: true });
    }),

    vscode.commands.registerCommand('tokenlint.scanOrFix', async () => {
      await scanOrFix();
    }),

    vscode.commands.registerCommand('tokenlint.setCopilotBudget', async () => {
      await budgetController.setCopilotBudget();
    }),

    vscode.commands.registerCommand('tokenlint.analyzeOpenFilesBudget', async () => {
      await budgetController.analyzeOpenFilesBudget();
    }),

    vscode.commands.registerCommand('tokenlint.showCopilotBudget', async () => {
      await budgetController.showCopilotBudget();
    }),

    vscode.commands.registerCommand('tokenlint.openRuntimeDashboard', async () => {
      await runtimeObservability.openRuntimeDashboard();
    }),

    vscode.commands.registerCommand('tokenlint.showCostAnalysis', async () => {
      await runtimeObservability.showCostAnalysis();
    }),

    vscode.commands.registerCommand('tokenlint.analyzeCacheEfficiency', async () => {
      await runtimeObservability.analyzeCacheEfficiency();
    }),

    vscode.commands.registerCommand('tokenlint.analyzeRetrievalAmplification', async () => {
      await runtimeObservability.analyzeRetrievalAmplification();
    }),

    vscode.commands.registerCommand('tokenlint.analyzeWorkspaceBudget', async () => {
      await budgetController.analyzeWorkspaceBudget();
    }),

    vscode.commands.registerCommand('tokenlint.generateReport', async () => {
      await generateReport();
    }),

    vscode.commands.registerCommand('tokenlint.showIR', async () => {
      await showIR();
    }),

    vscode.commands.registerCommand('tokenlint.applyAllSafeFixes', async () => {
      await applyAllSafeFixes(diagnostics);
    }),

    vscode.commands.registerCommand('tokenlint.showFixGraph', async () => {
      await showFixGraph();
    }),

    vscode.languages.registerHoverProvider(supportedSelectors, createHoverProvider()),

    vscode.languages.registerCodeActionsProvider(
      supportedSelectors,
      new TokenLintCodeActionProvider(diagnostics),
      {
        providedCodeActionKinds: TokenLintCodeActionProvider.providedCodeActionKinds
      }
    ),

    diagnostics,
    statusBar,
    vscode.workspace.onDidSaveTextDocument(document => {
      diagnostics.scan(document);

      if (shouldIncludeBudgetFile(document.fileName)) {
        budgetController.invalidateWorkspaceEstimate();
        void budgetController.refresh({ forceWorkspaceRefresh: true });
        return;
      }

      void budgetController.refresh();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      void budgetController.refresh();
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => {
      void budgetController.refresh();
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration('tokenlint.copilotBudget')
        || event.affectsConfiguration('tokenlint.warningThresholdPercent')
        || event.affectsConfiguration('tokenlint.criticalThresholdPercent')
        || event.affectsConfiguration('tokenlint.includeWorkspaceEstimate')
        || event.affectsConfiguration('tokenlint.includeRetrievalAmplification')
      ) {
        void budgetController.refresh({ forceWorkspaceRefresh: true });
      }
    })
  );

  void budgetController.refresh({ forceWorkspaceRefresh: true });
}

export function deactivate() {}
