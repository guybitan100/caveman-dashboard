import * as vscode from 'vscode';
import { TokenLintDiagnosticProvider } from '../providers/diagnosticProvider';
import { shouldAnalyzeFile, workspaceScanGlob } from '../utils/scanFilter';

export async function scanWorkspace(provider: TokenLintDiagnosticProvider) {
  const files = await vscode.workspace.findFiles(workspaceScanGlob, '**/node_modules/**');
  let analyzableFileCount = 0;
  let skippedFiles = 0;

  let findingCount = 0;
  let tokenCount = 0;

  for (const file of files) {
    const analyzable = shouldAnalyzeFile(file.fsPath);
    const document = await vscode.workspace.openTextDocument(file);
    const result = provider.scan(document);

    if (!analyzable) {
      skippedFiles += 1;
      continue;
    }

    analyzableFileCount += 1;
    findingCount += result.metrics.findingCount;
    tokenCount += result.metrics.totalTokens;
  }

  vscode.window.showInformationMessage(
    `TokenLint workspace scan complete: ${analyzableFileCount} files, ${findingCount} findings, ${tokenCount} tokens${
      skippedFiles > 0 ? `, ${skippedFiles} ignored` : ''
    }`
  );
}
