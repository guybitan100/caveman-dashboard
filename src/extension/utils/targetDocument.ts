import * as vscode from 'vscode';
import { shouldAnalyzeFile } from './scanFilter';

function hasTokenLintDiagnostics(diagnostics: readonly vscode.Diagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.source === 'TokenLint');
}

function getUriKey(uri: vscode.Uri | { fsPath?: string } | string | undefined): string | undefined {
  if (!uri) {
    return undefined;
  }

  if (typeof uri === 'string') {
    return uri;
  }

  if (typeof uri === 'object' && 'fsPath' in uri && typeof uri.fsPath === 'string') {
    return uri.fsPath;
  }

  return typeof uri.toString === 'function' ? uri.toString() : undefined;
}

function hasVisibleTokenLintDiagnostics(
  document: vscode.TextDocument,
  diagnostics: ReadonlyArray<[vscode.Uri, readonly vscode.Diagnostic[]]>
): boolean {
  const documentUriKey = getUriKey(document.uri);

  return diagnostics.some(([uri, entries]) => (
    uri.scheme === 'file'
    && hasTokenLintDiagnostics(entries)
    && (uri.fsPath === document.fileName || getUriKey(uri) === documentUriKey)
  ));
}

function resolveVisibleDocument(): vscode.TextDocument | undefined {
  const activeEditor = vscode.window.activeTextEditor;

  if (activeEditor && shouldAnalyzeFile(activeEditor.document.fileName)) {
    return activeEditor.document;
  }

  const visibleDocuments = vscode.window.visibleTextEditors.map(editor => editor.document);

  if (!visibleDocuments.length) {
    // No other editors open. Return the active document (even if unsupported) so callers
    // that have their own fallback logic (e.g. resolveApplicableDocument) can handle it.
    return activeEditor?.document;
  }

  const diagnostics = vscode.languages.getDiagnostics();

  return visibleDocuments.find(document => (
    shouldAnalyzeFile(document.fileName)
    && hasVisibleTokenLintDiagnostics(document, diagnostics)
  ))
    ?? visibleDocuments.find(document => shouldAnalyzeFile(document.fileName))
    ?? visibleDocuments.find(document => hasVisibleTokenLintDiagnostics(document, diagnostics))
    ?? activeEditor?.document
    ?? visibleDocuments[0];
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