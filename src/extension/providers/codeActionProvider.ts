import * as vscode from 'vscode';

export class TokenLintCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {

    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'TokenLint') continue;

      if (diagnostic.code === 'optimization.duplicateInstruction') {
        const action = new vscode.CodeAction(
          'Remove duplicate instruction',
          vscode.CodeActionKind.QuickFix
        );

        action.diagnostics = [diagnostic];
        action.edit = new vscode.WorkspaceEdit();
        action.edit.delete(document.uri, diagnostic.range);
        actions.push(action);
      }

      if (diagnostic.code === 'retrieval.topKRisk') {
        const action = new vscode.CodeAction(
          'Reduce top_k to 6',
          vscode.CodeActionKind.QuickFix
        );

        const line = document.lineAt(diagnostic.range.start.line);
        const replaced = line.text.replace(/top_k\s*[:=]\s*\d+/i, 'top_k: 6');

        action.diagnostics = [diagnostic];
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, line.range, replaced);
        actions.push(action);
      }
    }

    return actions;
  }
}
