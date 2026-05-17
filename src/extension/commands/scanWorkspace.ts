import * as vscode from 'vscode';
import { shouldAnalyzeFile } from '../../core/parser/languageDetector';
import { TokenLintDiagnosticProvider } from '../providers/diagnosticProvider';

export async function scanWorkspace(provider: TokenLintDiagnosticProvider) {
  const files = await vscode.workspace.findFiles(
    '**/*.{md,prompt,yaml,yml,json,ts,tsx,py}',
    '**/node_modules/**'
  );
  const analyzableFiles = files.filter(file => shouldAnalyzeFile(file.fsPath));
  const skippedCount = files.length - analyzableFiles.length;

  let findingCount = 0;
  let tokenCount = 0;

  for (const file of analyzableFiles) {
    const document = await vscode.workspace.openTextDocument(file);
    const result = provider.scan(document);
    findingCount += result.metrics.findingCount;
    tokenCount += result.metrics.totalTokens;
  }

  vscode.window.showInformationMessage(
    `TokenLint workspace scan complete: ${analyzableFiles.length} files, ${findingCount} findings, ${tokenCount} tokens${
      skippedCount > 0 ? `, ${skippedCount} generated lockfiles skipped` : ''
    }`
  );
}
