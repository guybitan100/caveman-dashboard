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

type DocumentFixPlan = {
  document: vscode.TextDocument;
  result: ReturnType<TokenLintDiagnosticProvider['scan']>;
  fixes: ReturnType<typeof fixesFromFindings>;
  safeFixes: ReturnType<typeof fixesFromFindings>;
};

function hasTokenLintDiagnostics(diagnostics: readonly vscode.Diagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.source === 'TokenLint');
}

function getDiagnosticEntries(): ReadonlyArray<[vscode.Uri, readonly vscode.Diagnostic[]]> {
  const diagnostics = vscode.languages.getDiagnostics();

  if (!Array.isArray(diagnostics)) {
    return [];
  }

  const entries: Array<[vscode.Uri, readonly vscode.Diagnostic[]]> = [];

  for (const entry of diagnostics) {
    if (
      Array.isArray(entry)
      && entry.length === 2
      && typeof entry[0] === 'object'
      && entry[0] !== null
      && 'scheme' in entry[0]
      && Array.isArray(entry[1])
    ) {
      entries.push([entry[0], entry[1]]);
    }
  }

  return entries;
}

function getReviewRequiredFixes(plans: DocumentFixPlan[]) {
  return plans.flatMap(plan => plan.fixes.filter(fix => fix.safety === 'review_required'));
}

async function scanDocumentForFixes(
  provider: TokenLintDiagnosticProvider,
  document: vscode.TextDocument,
  seenDocuments: Set<string>
): Promise<DocumentFixPlan> {
  rememberDocument(seenDocuments, document);

  const result = provider.scan(document);
  const { fixes, safeFixes } = getFixBuckets(result);

  return {
    document,
    result,
    fixes,
    safeFixes
  };
}

async function collectDiagnosticFixPlans(
  provider: TokenLintDiagnosticProvider,
  initialDocument: vscode.TextDocument
): Promise<DocumentFixPlan[]> {
  const seenDocuments = new Set<string>();
  const plans = [await scanDocumentForFixes(provider, initialDocument, seenDocuments)];

  for (const [uri, entries] of getDiagnosticEntries()) {
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
      plans.push(await scanDocumentForFixes(provider, document, seenDocuments));
    } catch {
      seenDocuments.add(uri.fsPath);

      if (uriKey) {
        seenDocuments.add(uriKey);
      }
    }
  }

  return plans;
}

export async function applyAllSafeFixes(provider: TokenLintDiagnosticProvider) {
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

  const plans = await collectDiagnosticFixPlans(provider, document);
  const safePlans = plans.filter(plan => plan.safeFixes.length > 0);

  if (!safePlans.length) {
    const reviewRequiredFixes = getReviewRequiredFixes(plans);

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

  const previewPlan = safePlans[0];
  const originalText = previewPlan.document.getText();
  const previewText = applySafeFixPreview(originalText, previewPlan.safeFixes);
  const edit = new vscode.WorkspaceEdit();
  const totalSafeFixes = safePlans.reduce((total, plan) => total + plan.safeFixes.length, 0);

  for (const plan of safePlans) {
    for (const fix of plan.safeFixes) {
      const line = plan.document.lineAt(fix.loc.startLine);
      edit.delete(plan.document.uri, line.rangeIncludingLineBreak);
    }
  }

  const success = await vscode.workspace.applyEdit(edit);

  if (success) {
    for (const plan of safePlans) {
      await plan.document.save();
    }

    if (safePlans.length === 1) {
      vscode.window.showInformationMessage(
        `TokenLint applied ${totalSafeFixes} safe fixes.`
      );
    } else {
      vscode.window.showInformationMessage(
        `TokenLint applied ${totalSafeFixes} safe fixes across ${safePlans.length} files.`
      );
    }

    showFixGraphPreview({
      fileName: previewPlan.document.fileName,
      beforeText: originalText,
      afterText: previewText,
      beforeResult: previewPlan.result,
      allFixes: previewPlan.fixes,
      safeFixes: previewPlan.safeFixes
    });
  }
}
