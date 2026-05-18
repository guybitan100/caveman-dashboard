import { beforeEach, describe, expect, it, vi } from 'vitest';

const commandMocks = vi.hoisted(() => {
  const state = {
    activeTextEditor: undefined as
      | {
          document: {
            fileName: string;
            getText: () => string;
          };
        }
      | undefined
  };

  return {
    state,
    showInformationMessage: vi.fn(),
    showQuickPick: vi.fn(),
    showTextDocument: vi.fn(),
    findFiles: vi.fn(),
    openTextDocument: vi.fn(),
    asRelativePath: vi.fn((file: { fsPath: string }) => file.fsPath),
    executeCommand: vi.fn(),
    analyze: vi.fn(),
    buildMarkdownReport: vi.fn(),
    shouldAnalyzeFile: vi.fn(),
    getSkipReason: vi.fn(),
    parseToIR: vi.fn()
  };
});

vi.mock('vscode', () => ({
  window: {
    get activeTextEditor() {
      return commandMocks.state.activeTextEditor;
    },
    showInformationMessage: commandMocks.showInformationMessage,
    showQuickPick: commandMocks.showQuickPick,
    showTextDocument: commandMocks.showTextDocument
  },
  workspace: {
    findFiles: commandMocks.findFiles,
    openTextDocument: commandMocks.openTextDocument,
    asRelativePath: commandMocks.asRelativePath
  },
  commands: {
    executeCommand: commandMocks.executeCommand
  },
  ViewColumn: {
    Beside: 'beside'
  }
}));

vi.mock('../utils/scanFilter', () => ({
  shouldAnalyzeFile: commandMocks.shouldAnalyzeFile,
  getSkipReason: commandMocks.getSkipReason
}));

vi.mock('../../core/engine/engine', () => ({
  analyze: commandMocks.analyze
}));

vi.mock('../../reporting/markdownReport', () => ({
  buildMarkdownReport: commandMocks.buildMarkdownReport
}));

vi.mock('../../core/parser/parser', () => ({
  parseToIR: commandMocks.parseToIR
}));

import { generateReport } from './generateReport';
import { scanCurrentFile } from './scanCurrentFile';
import { scanOrFix } from './scanOrFix';
import { scanWorkspace } from './scanWorkspace';
import { showIR } from './showIR';

describe('extension commands', () => {
  beforeEach(() => {
    commandMocks.state.activeTextEditor = undefined;
    commandMocks.showInformationMessage.mockReset();
    commandMocks.showQuickPick.mockReset();
    commandMocks.showTextDocument.mockReset();
    commandMocks.findFiles.mockReset();
    commandMocks.openTextDocument.mockReset();
    commandMocks.asRelativePath.mockClear();
    commandMocks.executeCommand.mockReset();
    commandMocks.analyze.mockReset();
    commandMocks.buildMarkdownReport.mockReset();
    commandMocks.shouldAnalyzeFile.mockReset();
    commandMocks.getSkipReason.mockReset();
    commandMocks.parseToIR.mockReset();
  });

  it('scanCurrentFile handles no editor, skipped files, and successful scans', async () => {
    const provider = { scan: vi.fn().mockReturnValue({ metrics: { findingCount: 2, totalTokens: 40 } }) };

    await scanCurrentFile(provider as never);
    expect(commandMocks.showInformationMessage).toHaveBeenLastCalledWith(
      'TokenLint: Open a file in the editor to scan it.'
    );

    const document = { fileName: 'ignored.md', getText: () => '' };
    commandMocks.state.activeTextEditor = { document };
    commandMocks.shouldAnalyzeFile.mockReturnValue(false);
    commandMocks.getSkipReason.mockReturnValue('unsupported file type');

    await scanCurrentFile(provider as never);
    expect(commandMocks.showInformationMessage).toHaveBeenLastCalledWith(
      'TokenLint skipped unsupported file type'
    );

    commandMocks.shouldAnalyzeFile.mockReturnValue(true);
    await scanCurrentFile(provider as never);
    expect(provider.scan).toHaveBeenCalledWith(document);
    expect(commandMocks.showInformationMessage).toHaveBeenLastCalledWith(
      'TokenLint: 2 findings, 40 tokens'
    );
  });

  it('scanWorkspace summarizes scans with and without ignored files', async () => {
    const firstFile = { fsPath: '/workspace/first.md' };
    const secondFile = { fsPath: '/workspace/second.md' };
    const firstDoc = { fileName: firstFile.fsPath, getText: () => 'a' };
    const secondDoc = { fileName: secondFile.fsPath, getText: () => 'b' };
    const firstProvider = {
      scan: vi
        .fn()
        .mockReturnValueOnce({ metrics: { findingCount: 1, totalTokens: 10 } })
    };
    const secondProvider = {
      scan: vi
        .fn()
        .mockReturnValueOnce({ metrics: { findingCount: 1, totalTokens: 10 } })
        .mockReturnValueOnce({ metrics: { findingCount: 2, totalTokens: 20 } })
    };

    commandMocks.findFiles.mockResolvedValue([firstFile, secondFile]);
    commandMocks.openTextDocument
      .mockResolvedValueOnce(firstDoc)
      .mockResolvedValueOnce(secondDoc)
      .mockResolvedValueOnce(firstDoc)
      .mockResolvedValueOnce(secondDoc);
    commandMocks.shouldAnalyzeFile.mockImplementation((fileName: string) => fileName !== secondFile.fsPath);

    await scanWorkspace(firstProvider as never);
    expect(commandMocks.showInformationMessage).toHaveBeenLastCalledWith(
      'TokenLint workspace scan complete: 1 files, 1 findings, 10 tokens, 1 ignored'
    );

    commandMocks.showInformationMessage.mockReset();
    commandMocks.shouldAnalyzeFile.mockReturnValue(true);
    await scanWorkspace(secondProvider as never);
    expect(commandMocks.showInformationMessage).toHaveBeenLastCalledWith(
      'TokenLint workspace scan complete: 2 files, 3 findings, 30 tokens'
    );
  });

  it('generateReport analyzes supported files and opens a markdown report', async () => {
    const firstFile = { fsPath: '/workspace/first.md' };
    const secondFile = { fsPath: '/workspace/second.md' };
    const firstDoc = { fileName: firstFile.fsPath, getText: () => 'first' };
    const reportDoc = { uri: 'report-doc' };

    commandMocks.findFiles.mockResolvedValue([firstFile, secondFile]);
    commandMocks.shouldAnalyzeFile.mockImplementation((fileName: string) => fileName === firstFile.fsPath);
    commandMocks.openTextDocument
      .mockResolvedValueOnce(firstDoc)
      .mockResolvedValueOnce(reportDoc);
    commandMocks.analyze.mockReturnValue({ metrics: { findingCount: 1, totalTokens: 12 } });
    commandMocks.buildMarkdownReport.mockReturnValue('# report');

    await generateReport();

    expect(commandMocks.analyze).toHaveBeenCalledWith('first', firstFile.fsPath);
    expect(commandMocks.buildMarkdownReport).toHaveBeenCalledWith([
      {
        fileName: firstFile.fsPath,
        result: { metrics: { findingCount: 1, totalTokens: 12 } }
      }
    ]);
    expect(commandMocks.openTextDocument).toHaveBeenLastCalledWith({
      language: 'markdown',
      content: '# report'
    });
    expect(commandMocks.showTextDocument).toHaveBeenCalledWith(reportDoc, 'beside');
  });

  it('scanOrFix handles cancel, missing editor requirements, and command execution', async () => {
    commandMocks.showQuickPick.mockResolvedValue(undefined);
    await scanOrFix();
    expect(commandMocks.executeCommand).not.toHaveBeenCalled();

    commandMocks.showQuickPick.mockResolvedValue({
      label: 'Scan Current File',
      command: 'tokenlint.scanCurrentFile',
      requiresActiveEditor: true
    });
    await scanOrFix();
    expect(commandMocks.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint: Open a file in the editor to run that action.'
    );

    commandMocks.state.activeTextEditor = {
      document: {
        fileName: 'prompt.md',
        getText: () => ''
      }
    };
    commandMocks.showQuickPick.mockResolvedValue({
      label: 'Scan Workspace',
      command: 'tokenlint.scanWorkspace'
    });
    await scanOrFix();
    expect(commandMocks.executeCommand).toHaveBeenCalledWith('tokenlint.scanWorkspace');
  });

  it('showIR exits without an editor and opens rendered IR beside the editor when present', async () => {
    await showIR();
    expect(commandMocks.openTextDocument).not.toHaveBeenCalled();

    const editorDoc = {
      fileName: 'prompt.yaml',
      getText: () => 'skill: planner'
    };
    const jsonDoc = { uri: 'json-doc' };
    commandMocks.state.activeTextEditor = { document: editorDoc };
    commandMocks.parseToIR.mockReturnValue({ type: 'prompt', children: ['node'] });
    commandMocks.openTextDocument.mockResolvedValue(jsonDoc);

    await showIR();

    expect(commandMocks.parseToIR).toHaveBeenCalledWith('skill: planner', 'prompt.yaml');
    expect(commandMocks.openTextDocument).toHaveBeenCalledWith({
      language: 'json',
      content: JSON.stringify({ type: 'prompt', children: ['node'] }, null, 2)
    });
    expect(commandMocks.showTextDocument).toHaveBeenCalledWith(jsonDoc, 'beside');
  });
});