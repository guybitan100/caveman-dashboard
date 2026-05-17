import * as vscode from 'vscode';
import { analyze } from '../../core/engine/engine';
import { buildMarkdownReport } from '../../reporting/markdownReport';

export async function generateReport() {
  const files = await vscode.workspace.findFiles(
    '**/*.{md,prompt,yaml,yml,json,ts,tsx,py}',
    '**/node_modules/**'
  );

  const results = [];

  for (const file of files) {
    const document = await vscode.workspace.openTextDocument(file);
    results.push({
      fileName: vscode.workspace.asRelativePath(file),
      result: analyze(document.getText(), document.fileName)
    });
  }

  const report = buildMarkdownReport(results);

  const doc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: report
  });

  vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}
