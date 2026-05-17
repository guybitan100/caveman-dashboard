import * as vscode from 'vscode';
import { TokenLintDiagnosticProvider } from '../providers/diagnosticProvider';

export async function scanCurrentFile(provider: TokenLintDiagnosticProvider) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const result = provider.scan(editor.document);

  vscode.window.showInformationMessage(
    `TokenLint: ${result.metrics.findingCount} findings, ${result.metrics.totalTokens} tokens`
  );
}
