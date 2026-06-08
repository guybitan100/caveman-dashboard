import * as vscode from 'vscode';
import { analyze, AnalysisResult } from '../../core/engine/engine';
import { shouldAnalyzeFile } from '../utils/scanFilter';
import { toDiagnostic } from '../utils/vscodeMapping';

const emptyResult: AnalysisResult = analyze('', 'unknown');

export class TokenLintDiagnosticProvider {
  private collection: vscode.DiagnosticCollection;
  private cache = new Map<string, AnalysisResult>();
  private findingCounts = new Map<string, number>();

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('tokenlint');
  }

  scan(document: vscode.TextDocument): AnalysisResult {
    const documentKey = getDocumentKey(document);

    if (!shouldAnalyzeFile(document.fileName)) {
      this.collection.delete(document.uri);
      this.cache.delete(document.uri.toString());
      this.findingCounts.delete(documentKey);
      return emptyResult;
    }

    const result = analyze(document.getText(), document.fileName);
    const diagnostics = result.findings.map(toDiagnostic);

    if (diagnostics.length > 0) {
      this.collection.set(document.uri, diagnostics);
    } else {
      this.collection.delete(document.uri);
    }

    this.cache.set(document.uri.toString(), result);
    this.findingCounts.set(documentKey, result.findings.length);

    return result;
  }

  getCached(document: vscode.TextDocument): AnalysisResult | undefined {
    return this.cache.get(document.uri.toString());
  }

  getFindingCounts(): Map<string, number> {
    return new Map(this.findingCounts);
  }

  dispose() {
    this.collection.dispose();
  }
}

function getDocumentKey(document: vscode.TextDocument): string {
  const relativePath = vscode.workspace.asRelativePath(document.uri, false);
  return relativePath || document.fileName;
}
