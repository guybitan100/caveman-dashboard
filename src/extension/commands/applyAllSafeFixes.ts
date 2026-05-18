import * as vscode from 'vscode';
import { TokenLintDiagnosticProvider } from '../providers/diagnosticProvider';

export async function applyAllSafeFixes(provider: TokenLintDiagnosticProvider) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(
      'TokenLint: Open a file in the editor to apply safe fixes.'
    );
    return;
  }

  const document = editor.document;
  provider.scan(document);

  const diagnostics = vscode.languages.getDiagnostics(document.uri).filter(d => d.source === 'TokenLint');

  const safeDiagnostics = diagnostics
    .filter(d => d.code === 'optimization.duplicateInstruction')
    .sort((a, b) => b.range.start.line - a.range.start.line);

  if (!safeDiagnostics.length) {
    vscode.window.showInformationMessage('TokenLint: No safe automatic fixes available.');
    return;
  }

  const edit = new vscode.WorkspaceEdit();

  for (const diagnostic of safeDiagnostics) {
    const line = document.lineAt(diagnostic.range.start.line);
    edit.delete(document.uri, line.rangeIncludingLineBreak);
  }

  const success = await vscode.workspace.applyEdit(edit);

  if (success) {
    await document.save();
    vscode.window.showInformationMessage(
      `TokenLint applied ${safeDiagnostics.length} safe fixes.`
    );
  }
}
