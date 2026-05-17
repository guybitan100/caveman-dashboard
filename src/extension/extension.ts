import * as vscode from 'vscode';

import { TokenLintDiagnosticProvider } from './providers/diagnosticProvider';
import { createHoverProvider } from './providers/hoverProvider';
import { TokenLintCodeActionProvider } from './providers/codeActionProvider';

import { scanCurrentFile } from './commands/scanCurrentFile';
import { scanWorkspace } from './commands/scanWorkspace';
import { generateReport } from './commands/generateReport';
import { showIR } from './commands/showIR';

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = new TokenLintDiagnosticProvider();

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = 'TokenLint: Ready';
  statusBar.show();

  const supportedSelectors: vscode.DocumentSelector = [
    { scheme: 'file', language: 'markdown' },
    { scheme: 'file', language: 'yaml' },
    { scheme: 'file', language: 'json' },
    { scheme: 'file', language: 'typescript' },
    { scheme: 'file', language: 'python' },
    { scheme: 'file', pattern: '**/*.prompt' }
  ];

  context.subscriptions.push(
    vscode.commands.registerCommand('tokenlint.scanCurrentFile', async () => {
      await scanCurrentFile(diagnostics);
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const cached = diagnostics.getCached(editor.document);
        if (cached) {
          statusBar.text = `TokenLint: ${cached.metrics.findingCount} findings | ${cached.metrics.totalTokens} tokens`;
        }
      }
    }),

    vscode.commands.registerCommand('tokenlint.scanWorkspace', async () => {
      await scanWorkspace(diagnostics);
    }),

    vscode.commands.registerCommand('tokenlint.generateReport', async () => {
      await generateReport();
    }),

    vscode.commands.registerCommand('tokenlint.showIR', async () => {
      await showIR();
    }),

    vscode.languages.registerHoverProvider(supportedSelectors, createHoverProvider()),

    vscode.languages.registerCodeActionsProvider(
      supportedSelectors,
      new TokenLintCodeActionProvider(),
      {
        providedCodeActionKinds: TokenLintCodeActionProvider.providedCodeActionKinds
      }
    ),

    diagnostics,
    statusBar
  );

  vscode.workspace.onDidSaveTextDocument(document => {
    const file = document.fileName.toLowerCase();
    if (file.endsWith('.md') || file.endsWith('.prompt') || file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')) {
      const result = diagnostics.scan(document);
      statusBar.text = `TokenLint: ${result.metrics.findingCount} findings | ${result.metrics.totalTokens} tokens`;
    }
  });
}

export function deactivate() {}
