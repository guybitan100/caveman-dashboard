import * as vscode from 'vscode';
import { TokenLintDiagnosticProvider } from '../providers/diagnosticProvider';

export async function scanWorkspace(provider: TokenLintDiagnosticProvider) {
  const files = await vscode.workspace.findFiles(
    '**/*.{md,prompt,yaml,yml,json,ts,tsx,py}',
    '**/node_modules/**'
  );

  let findingCount = 0;
  let tokenCount = 0;

  for (const file of files) {
    const document = await vscode.workspace.openTextDocument(file);
    const result = provider.scan(document);
    findingCount += result.metrics.findingCount;
    tokenCount += result.metrics.totalTokens;
  }

  vscode.window.showInformationMessage(
    `TokenLint workspace scan complete: ${files.length} files, ${findingCount} findings, ${tokenCount} tokens`
  );
}
