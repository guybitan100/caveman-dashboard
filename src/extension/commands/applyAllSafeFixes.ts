import * as vscode from 'vscode';
import { fixesFromFindings } from '../../core/fixes/fixEngine';
import { TokenLintDiagnosticProvider } from '../providers/diagnosticProvider';
import { applySafeFixPreview, showFixGraphPreview } from './showFixGraph';
import { getSkipReason, shouldAnalyzeFile } from '../utils/scanFilter';
import { resolveTargetDocument } from '../utils/targetDocument';

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

function rememberDocument(seenDocuments: Set<string>, document: vscode.TextDocument) {
  seenDocuments.add(document.fileName);

  const uriKey = getUriKey(document.uri);

  if (uriKey) {
    seenDocuments.add(uriKey);
  }
}

function getFixBuckets(result: ReturnType<TokenLintDiagnosticProvider['scan']>) {
  const fixes = fixesFromFindings(result.findings);

  return {
    fixes,
    safeFixes: fixes
      .filter(fix => fix.safety === 'safe')
      .sort((a, b) => b.loc.startLine - a.loc.startLine)
  };
}

function hasTokenLintDiagnostics(diagnostics: readonly vscode.Diagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.source === 'TokenLint');
}

async function findDiagnosticDocumentWithSafeFixes(
  provider: TokenLintDiagnosticProvider,
  seenDocuments: Set<string>
) {
  for (const [uri, entries] of vscode.languages.getDiagnostics()) {
    const uriKey = getUriKey(uri);

    if (
      uri.scheme !== 'file'
      || !hasTokenLintDiagnostics(entries)
      || !shouldAnalyzeFile(uri.fsPath)
      || seenDocuments.has(uri.fsPath)
      || (uriKey ? seenDocuments.has(uriKey) : false)
    ) {
      continue;
    }

    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const result = provider.scan(document);
      const { fixes, safeFixes } = getFixBuckets(result);

      rememberDocument(seenDocuments, document);

      if (safeFixes.length) {
        return {
          document,
          result,
          fixes,
          safeFixes
        };
      }
    } catch {
      seenDocuments.add(uri.fsPath);

      if (uriKey) {
        seenDocuments.add(uriKey);
      }
    }
  }

  return undefined;
}

export async function applyAllSafeFixes(provider: TokenLintDiagnosticProvider) {
  const hasEditorContext = Boolean(
    vscode.window.activeTextEditor
    || vscode.window.visibleTextEditors.length
  );
  let document = await resolveTargetDocument();

  if (!document) {
    vscode.window.showInformationMessage(
      'TokenLint: Open a file in the editor to apply safe fixes.'
    );
    return;
  }

  if (!shouldAnalyzeFile(document.fileName)) {
    vscode.window.showInformationMessage(
      `TokenLint skipped ${getSkipReason(document.fileName)}`
    );
    return;
  }

  let result = provider.scan(document);
  let { fixes, safeFixes } = getFixBuckets(result);

  if (!safeFixes.length && !hasEditorContext) {
    const seenDocuments = new Set<string>();
    rememberDocument(seenDocuments, document);

    const safeFixCandidate = await findDiagnosticDocumentWithSafeFixes(provider, seenDocuments);

    if (safeFixCandidate) {
      document = safeFixCandidate.document;
      result = safeFixCandidate.result;
      fixes = safeFixCandidate.fixes;
      safeFixes = safeFixCandidate.safeFixes;
    }
  }

  const originalText = document.getText();

  if (!safeFixes.length) {
    const reviewRequiredFixes = fixes
      .filter(fix => fix.safety === 'review_required');

    if (reviewRequiredFixes.length) {
      const suffix = reviewRequiredFixes.length === 1 ? '' : 'es';
      vscode.window.showInformationMessage(
        `TokenLint: No safe automatic fixes available. ${reviewRequiredFixes.length} review-required quick fix${suffix} available from Quick Fix.`
      );
      return;
    }

    vscode.window.showInformationMessage('TokenLint: No safe automatic fixes available.');
    return;
  }

  const previewText = applySafeFixPreview(originalText, safeFixes);
  const edit = new vscode.WorkspaceEdit();

  for (const fix of safeFixes) {
    const line = document.lineAt(fix.loc.startLine);
    edit.delete(document.uri, line.rangeIncludingLineBreak);
  }

  const success = await vscode.workspace.applyEdit(edit);

  if (success) {
    await document.save();
    vscode.window.showInformationMessage(
      `TokenLint applied ${safeFixes.length} safe fixes.`
    );
    showFixGraphPreview({
      fileName: document.fileName,
      beforeText: originalText,
      afterText: previewText,
      beforeResult: result,
      allFixes: fixes,
      safeFixes
    });
  }
}
