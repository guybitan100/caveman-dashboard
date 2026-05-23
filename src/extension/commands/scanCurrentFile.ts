import * as vscode from 'vscode';
import { TokenLintDiagnosticProvider } from '../providers/diagnosticProvider';
import { getSkipReason, shouldAnalyzeFile } from '../utils/scanFilter';
import { resolveTargetDocument } from '../utils/targetDocument';

export async function scanCurrentFile(provider: TokenLintDiagnosticProvider) {
  const document = await resolveTargetDocument();

  if (!document) {
    vscode.window.showInformationMessage(
      'TokenLint: Open a file in the editor to scan it.'
    );
    return;
  }

  if (!shouldAnalyzeFile(document.fileName)) {
    vscode.window.showInformationMessage(
      `TokenLint skipped ${getSkipReason(document.fileName)}`
    );
    return;
  }

  const result = provider.scan(document);

  vscode.window.showInformationMessage(
    `TokenLint: ${result.metrics.findingCount} findings, ${result.metrics.totalTokens} tokens`
  );
}
