import * as vscode from 'vscode';
import { analyze } from '../../core/engine/engine';
import { buildMarkdownReport } from '../../reporting/markdownReport';
import { shouldAnalyzeFile, workspaceScanGlob } from '../utils/scanFilter';
import { prepareRuntimeArtifactDocument } from '../utils/runtimeArtifacts';

export async function generateReport() {
  const files = await vscode.workspace.findFiles(workspaceScanGlob, '**/node_modules/**');
  const analyzableFiles = files.filter(file => shouldAnalyzeFile(file.fsPath));

  const results = [];

  for (const file of analyzableFiles) {
    const document = await vscode.workspace.openTextDocument(file);
    results.push({
      fileName: vscode.workspace.asRelativePath(file),
      result: analyze(document.getText(), document.fileName)
    });
  }

  const report = buildMarkdownReport(results);

  const doc = await prepareRuntimeArtifactDocument({
    bucket: 'exports',
    fileName: 'tokenlint-report.md',
    language: 'markdown',
    content: report
  });

  vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}
