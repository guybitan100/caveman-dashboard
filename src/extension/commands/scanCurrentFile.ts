import * as vscode from 'vscode';
import { isGeneratedDependencyFile, shouldAnalyzeFile } from '../../core/parser/languageDetector';
import { TokenLintDiagnosticProvider } from '../providers/diagnosticProvider';

export async function scanCurrentFile(provider: TokenLintDiagnosticProvider) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (!shouldAnalyzeFile(editor.document.fileName)) {
    const fileName = editor.document.fileName.split(/[\\/]/).pop() ?? editor.document.fileName;
    const reason = isGeneratedDependencyFile(editor.document.fileName)
      ? 'generated dependency lockfile'
      : 'unsupported file type';

    vscode.window.showInformationMessage(`TokenLint skipped ${reason}: ${fileName}`);
    return;
  }

  const result = provider.scan(editor.document);

  vscode.window.showInformationMessage(
    `TokenLint: ${result.metrics.findingCount} findings, ${result.metrics.totalTokens} tokens`
  );
}
