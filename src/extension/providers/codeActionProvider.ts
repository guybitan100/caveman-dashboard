import * as vscode from 'vscode';
import { TokenLintFinding } from '../../core/engine/finding';
import { fixesFromFindings } from '../../core/fixes/fixEngine';

type FindingResult = {
  findings: TokenLintFinding[];
};

type FindingSource = {
  getCached(document: vscode.TextDocument): FindingResult | undefined;
  scan(document: vscode.TextDocument): FindingResult;
};

type FindingWithFix = TokenLintFinding & {
  fix: NonNullable<TokenLintFinding['fix']>;
};

function hasFix(finding: TokenLintFinding): finding is FindingWithFix {
  return typeof finding.fix === 'object' && finding.fix !== null && typeof finding.fix.title === 'string';
}

function getDiagnosticCode(diagnostic: vscode.Diagnostic): string | undefined {
  return typeof diagnostic.code === 'string' ? diagnostic.code : undefined;
}

function getReplacementRange(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.Range {
  const range = diagnostic.range as Partial<vscode.Range>;

  if (
    range.start
    && range.end
    && typeof range.start.line === 'number'
    && typeof range.start.character === 'number'
    && typeof range.end.line === 'number'
    && typeof range.end.character === 'number'
  ) {
    return diagnostic.range;
  }

  return document.lineAt(diagnostic.range.start.line).range;
}

function resolveFix(findings: TokenLintFinding[], diagnostic: vscode.Diagnostic) {
  const code = getDiagnosticCode(diagnostic);

  if (!code) {
    return undefined;
  }

  const finding = findings.find(candidate => (
    hasFix(candidate)
    && candidate.ruleId === code
    && candidate.loc.startLine === diagnostic.range.start.line
  ));

  if (!finding) {
    return undefined;
  }

  return fixesFromFindings([finding])[0];
}

export class TokenLintCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  constructor(
    private readonly diagnostics: FindingSource
  ) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    void range;

    const actions: vscode.CodeAction[] = [];
    const result = this.diagnostics.getCached(document) ?? this.diagnostics.scan(document);

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'TokenLint') continue;

      const fix = resolveFix(result.findings, diagnostic);

      if (!fix) {
        continue;
      }

      const action = new vscode.CodeAction(
        `TokenLint: ${fix.title}`,
        vscode.CodeActionKind.QuickFix
      );

      action.diagnostics = [diagnostic];
      action.edit = new vscode.WorkspaceEdit();

      if (fix.replacement === '') {
        const line = document.lineAt(diagnostic.range.start.line);
        action.edit.delete(document.uri, line.rangeIncludingLineBreak);
      } else {
        action.edit.replace(document.uri, getReplacementRange(document, diagnostic), fix.replacement);
      }

      action.isPreferred = fix.safety === 'safe';
      actions.push(action);
    }

    return actions;
  }
}
