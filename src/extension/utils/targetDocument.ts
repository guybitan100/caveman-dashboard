import * as vscode from 'vscode';
import { shouldAnalyzeFile } from './scanFilter';

function hasTokenLintDiagnostics(diagnostics: readonly vscode.Diagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.source === 'TokenLint');
}

function resolveVisibleDocument(): vscode.TextDocument | undefined {
  const activeEditor = vscode.window.activeTextEditor;

  if (activeEditor) {
    return activeEditor.document;
  }

  return vscode.window.visibleTextEditors.find(editor => shouldAnalyzeFile(editor.document.fileName))?.document
    ?? vscode.window.visibleTextEditors[0]?.document;
}

async function resolveDiagnosticDocument(): Promise<vscode.TextDocument | undefined> {
  const diagnostics = vscode.languages.getDiagnostics();
  const target = diagnostics.find(([uri, entries]) => (
    uri.scheme === 'file'
    && hasTokenLintDiagnostics(entries)
    && shouldAnalyzeFile(uri.fsPath)
  )) ?? diagnostics.find(([uri, entries]) => (
    uri.scheme === 'file'
    && hasTokenLintDiagnostics(entries)
  ));

  if (!target) {
    return undefined;
  }

  try {
    return await vscode.workspace.openTextDocument(target[0]);
  } catch {
    return undefined;
  }
}

export async function resolveTargetDocument(): Promise<vscode.TextDocument | undefined> {
  return resolveVisibleDocument() ?? resolveDiagnosticDocument();
}