import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisResult } from '../../core/engine/engine';

const fsPromisesMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}));

const vscodeMock = vi.hoisted(() => {
  const state = {
    activeTextEditor: undefined as { document: MockDocument } | undefined,
    visibleTextEditors: [] as Array<{ document: MockDocument }>
  };

  return {
    state,
    showInformationMessage: vi.fn(),
    applyEdit: vi.fn(),
    openTextDocument: vi.fn(),
    getDiagnostics: vi.fn(),
    getWorkspaceFolder: vi.fn(),
    uriFile: vi.fn((fileName: string) => ({ fsPath: fileName, scheme: 'file' })),
    Range: class {
      constructor(
        public start: unknown,
        public end: unknown
      ) {}
    },
    WorkspaceEdit: class {
      public deletes: Array<{ uri: string; range: string }> = [];
      public replaces: Array<{ uri: string; range: string; newText: string }> = [];
      public inserts: Array<{ uri: string; position: unknown; newText: string }> = [];

      delete(uri: string, range: string) {
        this.deletes.push({ uri, range });
      }

      replace(uri: string, range: string, newText: string) {
        this.replaces.push({ uri, range, newText });
      }

      insert(uri: string, position: unknown, newText: string) {
        this.inserts.push({ uri, position, newText });
      }
    }
  };
});

const scanFilterMock = vi.hoisted(() => ({
  shouldAnalyzeFile: vi.fn(),
  getSkipReason: vi.fn()
}));

const showFixGraphMock = vi.hoisted(() => ({
  applySafeFixPreview: vi.fn(),
  showFixGraphPreview: vi.fn()
}));

vi.mock('vscode', () => ({
  window: {
    get activeTextEditor() {
      return vscodeMock.state.activeTextEditor;
    },
    get visibleTextEditors() {
      return vscodeMock.state.visibleTextEditors;
    },
    showInformationMessage: vscodeMock.showInformationMessage
  },
  languages: {
    getDiagnostics: vscodeMock.getDiagnostics
  },
  workspace: {
    applyEdit: vscodeMock.applyEdit,
    openTextDocument: vscodeMock.openTextDocument,
    getWorkspaceFolder: vscodeMock.getWorkspaceFolder
  },
  Range: vscodeMock.Range,
  WorkspaceEdit: vscodeMock.WorkspaceEdit,
  Uri: {
    file: vscodeMock.uriFile
  }
}));

vi.mock('fs/promises', () => fsPromisesMock);

vi.mock('../utils/scanFilter', () => ({
  shouldAnalyzeFile: scanFilterMock.shouldAnalyzeFile,
  getSkipReason: scanFilterMock.getSkipReason
}));

vi.mock('./showFixGraph', () => ({
  applySafeFixPreview: showFixGraphMock.applySafeFixPreview,
  showFixGraphPreview: showFixGraphMock.showFixGraphPreview
}));

import { applyAllSafeFixes } from './applyAllSafeFixes';

type MockDiagnostic = {
  source?: string;
  code?: string | number | { value: string | number };
  message?: string;
  range: {
    start: {
      line: number;
      character?: number;
    };
    end?: {
      line: number;
      character?: number;
    };
  };
};

type MockDocument = {
  fileName: string;
  uri: string;
  getText?: ReturnType<typeof vi.fn>;
  lineAt: ReturnType<typeof vi.fn>;
  lineCount?: number;
  save: ReturnType<typeof vi.fn>;
};

describe('applyAllSafeFixes', () => {
  const emptyResult: AnalysisResult = {
    ir: {} as AnalysisResult['ir'],
    findings: [],
    metrics: {
      totalTokens: 0,
      findingCount: 0,
      errorCount: 0,
      warningCount: 0
    }
  };

  beforeEach(() => {
    vscodeMock.state.activeTextEditor = undefined;
    vscodeMock.state.visibleTextEditors = [];
    vscodeMock.showInformationMessage.mockReset();
    vscodeMock.applyEdit.mockReset();
    vscodeMock.openTextDocument.mockReset();
    vscodeMock.getDiagnostics.mockReset();
    vscodeMock.getWorkspaceFolder.mockReset();
    vscodeMock.uriFile.mockClear();
    scanFilterMock.shouldAnalyzeFile.mockReset();
    scanFilterMock.getSkipReason.mockReset();
    showFixGraphMock.applySafeFixPreview.mockReset();
    showFixGraphMock.showFixGraphPreview.mockReset();
    fsPromisesMock.readFile.mockReset();
    fsPromisesMock.writeFile.mockReset();
    scanFilterMock.shouldAnalyzeFile.mockReturnValue(true);
    vscodeMock.getDiagnostics.mockReturnValue([]);
    vscodeMock.getWorkspaceFolder.mockReturnValue({
      uri: { fsPath: '/workspace' }
    });
    fsPromisesMock.readFile.mockRejectedValue(new Error('missing'));
    fsPromisesMock.writeFile.mockResolvedValue(undefined);
    showFixGraphMock.applySafeFixPreview.mockImplementation((text: string) => text);
  });

  it('shows a message when no editor is open', async () => {
    await applyAllSafeFixes({ scan: vi.fn() } as never);

    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint: Open a file in the editor to apply safe fixes.'
    );
  });

  it('uses a visible editor when the sidebar command runs without an active text editor', async () => {
    const document: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'before text'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.visibleTextEditors = [{ document }];

    const provider = {
      scan: vi.fn(() => ({
        ...emptyResult,
        findings: [
          {
            ruleId: 'optimization.duplicateInstruction',
            title: 'Duplicate instruction',
            message: 'Duplicate instruction',
            severity: 'info' as const,
            loc: {
              startLine: 2,
              startColumn: 0,
              endLine: 2,
              endColumn: 10
            },
            fix: {
              title: 'Remove duplicate instruction'
            }
          }
        ]
      }))
    };

    vscodeMock.applyEdit.mockResolvedValue(true);
    showFixGraphMock.applySafeFixPreview.mockReturnValue('after text');

    await applyAllSafeFixes(provider as never);

    expect(provider.scan).toHaveBeenCalledWith(document);
    expect(document.lineAt).toHaveBeenCalledWith(2);
    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 1 fixes.'
    );
  });

  it('prefers the visible document with TokenLint diagnostics when multiple supported editors are visible', async () => {
    const wrongDocument: MockDocument = {
      fileName: '/workspace/other.md',
      uri: 'file:///other.md',
      getText: vi.fn(() => 'other text'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'other-line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };
    const targetDocument: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'before text'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'target-line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.visibleTextEditors = [
      { document: wrongDocument },
      { document: targetDocument }
    ];
    vscodeMock.getDiagnostics.mockReturnValue([
      [{ scheme: 'file', fsPath: '/workspace/prompt.md' }, [{ source: 'TokenLint' }]]
    ]);

    const provider = {
      scan: vi.fn((document: MockDocument) => {
        if (document === wrongDocument) {
          return emptyResult;
        }

        return {
          ...emptyResult,
          findings: [
            {
              ruleId: 'optimization.duplicateInstruction',
              title: 'Duplicate instruction',
              message: 'Duplicate instruction',
              severity: 'info' as const,
              loc: {
                startLine: 2,
                startColumn: 0,
                endLine: 2,
                endColumn: 10
              },
              fix: {
                title: 'Remove duplicate instruction'
              }
            }
          ]
        };
      })
    };

    vscodeMock.applyEdit.mockResolvedValue(true);
    showFixGraphMock.applySafeFixPreview.mockReturnValue('after text');

    await applyAllSafeFixes(provider as never);

    expect(provider.scan).toHaveBeenCalledWith(targetDocument);
    expect(targetDocument.lineAt).toHaveBeenCalledWith(2);
    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    expect(targetDocument.save).toHaveBeenCalledTimes(1);
    expect(wrongDocument.save).not.toHaveBeenCalled();
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 1 fixes.'
    );
  });

  it('opens a TokenLint diagnostic file when the sidebar runs without any visible editor', async () => {
    const diagnosticUri = {
      scheme: 'file',
      fsPath: '/workspace/prompt.md'
    };
    const document: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'before text'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.getDiagnostics.mockReturnValue([
      [diagnosticUri, [{ source: 'TokenLint' }]]
    ]);
    vscodeMock.openTextDocument.mockResolvedValue(document);

    const provider = {
      scan: vi.fn(() => ({
        ...emptyResult,
        findings: [
          {
            ruleId: 'optimization.duplicateInstruction',
            title: 'Duplicate instruction',
            message: 'Duplicate instruction',
            severity: 'info' as const,
            loc: {
              startLine: 1,
              startColumn: 0,
              endLine: 1,
              endColumn: 10
            },
            fix: {
              title: 'Remove duplicate instruction'
            }
          }
        ]
      }))
    };

    vscodeMock.applyEdit.mockResolvedValue(true);
    showFixGraphMock.applySafeFixPreview.mockReturnValue('after text');

    await applyAllSafeFixes(provider as never);

    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(diagnosticUri);
    expect(provider.scan).toHaveBeenCalledWith(document);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 1 fixes.'
    );
  });

  it('applies fixes from both review-required and safe diagnostic files', async () => {
    const reviewUri = {
      scheme: 'file',
      fsPath: '/workspace/review.md'
    };
    const safeUri = {
      scheme: 'file',
      fsPath: '/workspace/safe.md'
    };
    const reviewDocument: MockDocument = {
      fileName: '/workspace/review.md',
      uri: 'file:///review.md',
      getText: vi.fn(() => 'review text'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'review-line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };
    const safeDocument: MockDocument = {
      fileName: '/workspace/safe.md',
      uri: 'file:///safe.md',
      getText: vi.fn(() => 'before text'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.getDiagnostics.mockReturnValue([
      [reviewUri, [{ source: 'TokenLint' }]],
      [safeUri, [{ source: 'TokenLint' }]]
    ]);
    vscodeMock.openTextDocument.mockImplementation(async (uri: { fsPath: string }) => {
      if (uri.fsPath === reviewUri.fsPath) {
        return reviewDocument;
      }

      return safeDocument;
    });

    const provider = {
      scan: vi.fn((document: MockDocument) => {
        if (document === reviewDocument) {
          return {
            ...emptyResult,
            findings: [
              {
                ruleId: 'security.promptInjection',
                title: 'Suspicious override',
                message: 'Suspicious override',
                severity: 'warning' as const,
                loc: {
                  startLine: 1,
                  startColumn: 0,
                  endLine: 1,
                  endColumn: 10
                },
                fix: {
                  title: 'Neutralize suspicious instruction',
                  replacement: '[REMOVED]'
                }
              }
            ]
          };
        }

        return {
          ...emptyResult,
          findings: [
            {
              ruleId: 'optimization.duplicateInstruction',
              title: 'Duplicate instruction',
              message: 'Duplicate instruction',
              severity: 'info' as const,
              loc: {
                startLine: 2,
                startColumn: 0,
                endLine: 2,
                endColumn: 10
              },
              fix: {
                title: 'Remove duplicate instruction'
              }
            }
          ]
        };
      })
    };

    vscodeMock.applyEdit.mockResolvedValue(true);
    showFixGraphMock.applySafeFixPreview.mockReturnValue('after text');

    await applyAllSafeFixes(provider as never);

    expect(vscodeMock.openTextDocument).toHaveBeenNthCalledWith(1, reviewUri);
    expect(vscodeMock.openTextDocument).toHaveBeenNthCalledWith(2, safeUri);
    expect(provider.scan).toHaveBeenNthCalledWith(1, reviewDocument);
    expect(provider.scan).toHaveBeenNthCalledWith(2, safeDocument);
    expect(reviewDocument.lineAt).toHaveBeenCalledWith(1);
    expect(safeDocument.lineAt).toHaveBeenCalledWith(2);
    expect(reviewDocument.save).toHaveBeenCalledTimes(1);
    expect(safeDocument.save).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 2 fixes across 2 files.'
    );
  });

  it('falls through to diagnostic files when the active editor has no safe fixes', async () => {
    const activeDocument: MockDocument = {
      fileName: '/workspace/stream.py',
      uri: 'file:///stream.py',
      getText: vi.fn(() => 'stream body'),
      lineAt: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined)
    };
    const safeUri = {
      scheme: 'file',
      fsPath: '/workspace/prompt.md'
    };
    const safeDocument: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'before text'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document: activeDocument };
    vscodeMock.getDiagnostics.mockReturnValue([
      [safeUri, [{ source: 'TokenLint' }]]
    ]);
    vscodeMock.openTextDocument.mockResolvedValue(safeDocument);

    const provider = {
      scan: vi.fn((document: MockDocument) => {
        if (document === activeDocument) {
          return emptyResult;
        }

        return {
          ...emptyResult,
          findings: [
            {
              ruleId: 'optimization.duplicateInstruction',
              title: 'Duplicate instruction',
              message: 'Duplicate instruction',
              severity: 'info' as const,
              loc: {
                startLine: 2,
                startColumn: 0,
                endLine: 2,
                endColumn: 10
              },
              fix: {
                title: 'Remove duplicate instruction'
              }
            }
          ]
        };
      })
    };

    vscodeMock.applyEdit.mockResolvedValue(true);
    showFixGraphMock.applySafeFixPreview.mockReturnValue('after text');

    await applyAllSafeFixes(provider as never);

    expect(provider.scan).toHaveBeenNthCalledWith(1, activeDocument);
    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(safeUri);
    expect(provider.scan).toHaveBeenNthCalledWith(2, safeDocument);
    expect(safeDocument.save).toHaveBeenCalledTimes(1);
    expect(activeDocument.save).not.toHaveBeenCalled();
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 1 fixes.'
    );
  });

  it('applies safe fixes across every TokenLint diagnostic file', async () => {
    const firstDocument: MockDocument = {
      fileName: '/workspace/first.md',
      uri: 'file:///first.md',
      getText: vi.fn(() => 'first before'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'first-line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };
    const secondUri = {
      scheme: 'file',
      fsPath: '/workspace/second.md'
    };
    const secondDocument: MockDocument = {
      fileName: '/workspace/second.md',
      uri: 'file:///second.md',
      getText: vi.fn(() => 'second before'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'second-line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document: firstDocument };
    vscodeMock.getDiagnostics.mockReturnValue([
      [{ scheme: 'file', fsPath: '/workspace/first.md' }, [{ source: 'TokenLint' }]],
      [secondUri, [{ source: 'TokenLint' }]]
    ]);
    vscodeMock.openTextDocument.mockResolvedValue(secondDocument);

    const provider = {
      scan: vi.fn((document: MockDocument) => {
        if (document === secondDocument) {
          return {
            ...emptyResult,
            findings: [
              {
                ruleId: 'optimization.duplicateInstruction',
                title: 'Duplicate instruction',
                message: 'Duplicate instruction',
                severity: 'info' as const,
                loc: {
                  startLine: 5,
                  startColumn: 0,
                  endLine: 5,
                  endColumn: 10
                },
                fix: {
                  title: 'Remove second duplicate instruction'
                }
              }
            ]
          };
        }

        return {
          ...emptyResult,
          findings: [
            {
              ruleId: 'optimization.duplicateInstruction',
              title: 'Duplicate instruction',
              message: 'Duplicate instruction',
              severity: 'info' as const,
              loc: {
                startLine: 2,
                startColumn: 0,
                endLine: 2,
                endColumn: 10
              },
              fix: {
                title: 'Remove first duplicate instruction'
              }
            }
          ]
        };
      })
    };

    vscodeMock.applyEdit.mockResolvedValue(true);
    showFixGraphMock.applySafeFixPreview
      .mockReturnValueOnce('first after')
      .mockReturnValueOnce('second after');

    await applyAllSafeFixes(provider as never);

    expect(provider.scan).toHaveBeenNthCalledWith(1, firstDocument);
    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(secondUri);
    expect(provider.scan).toHaveBeenNthCalledWith(2, secondDocument);
    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    expect((vscodeMock.applyEdit.mock.calls[0][0] as { deletes: Array<{ uri: string; range: string }> }).deletes).toEqual([
      {
        uri: 'file:///first.md',
        range: 'first-line-range'
      },
      {
        uri: 'file:///second.md',
        range: 'second-line-range'
      }
    ]);
    expect(firstDocument.save).toHaveBeenCalledTimes(1);
    expect(secondDocument.save).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 2 fixes across 2 files.'
    );
    expect(showFixGraphMock.showFixGraphPreview).toHaveBeenCalledTimes(1);
    expect(showFixGraphMock.showFixGraphPreview).toHaveBeenCalledWith({
      fileName: '/workspace/first.md',
      beforeText: 'first before',
      afterText: 'first after',
      beforeResult: expect.objectContaining({
        findings: expect.any(Array)
      }),
      allFixes: [
        expect.objectContaining({
          id: 'optimization.duplicateInstruction:2',
          title: 'Remove first duplicate instruction',
          safety: 'safe'
        })
      ],
      safeFixes: [
        expect.objectContaining({
          id: 'optimization.duplicateInstruction:2',
          title: 'Remove first duplicate instruction',
          safety: 'safe'
        })
      ]
    });
  });

  it('applies review-required fixes', async () => {
    const document: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'prompt body'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };
    const provider = {
      scan: vi.fn(() => ({
        ...emptyResult,
        findings: [
          {
            ruleId: 'security.promptInjection',
            title: 'Suspicious override',
            message: 'Suspicious override',
            severity: 'warning' as const,
            loc: {
              startLine: 1,
              startColumn: 0,
              endLine: 1,
              endColumn: 10
            },
            fix: {
              title: 'Neutralize suspicious instruction',
              replacement: '[REMOVED]'
            }
          }
        ]
      }))
    };
    vscodeMock.getDiagnostics.mockReturnValue([
      {
        source: 'TokenLint',
        code: 'security.promptInjection',
        range: { start: { line: 1 } }
      }
    ]);
    vscodeMock.applyEdit.mockResolvedValue(true);
    showFixGraphMock.applySafeFixPreview.mockReturnValue('after text');

    await applyAllSafeFixes(provider as never);

    expect(provider.scan).toHaveBeenCalledWith(document);
    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 1 fixes.'
    );
  });

  it('reports remaining TokenLint findings that were not automatically fixable', async () => {
    const document: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'prompt body'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };

    const provider = {
      scan: vi.fn(() => ({
        ...emptyResult,
        findings: [
          {
            ruleId: 'optimization.duplicateInstruction',
            title: 'Duplicate instruction',
            message: 'Duplicate instruction',
            severity: 'info' as const,
            loc: {
              startLine: 1,
              startColumn: 0,
              endLine: 1,
              endColumn: 10
            },
            fix: {
              title: 'Remove duplicate instruction'
            }
          },
          {
            ruleId: 'retrieval.contextAmplification',
            title: 'Context amplification risk',
            message: 'Retrieved context is too large',
            severity: 'warning' as const,
            loc: {
              startLine: 3,
              startColumn: 0,
              endLine: 3,
              endColumn: 10
            }
          }
        ]
      }))
    };

    vscodeMock.applyEdit.mockResolvedValue(true);
    showFixGraphMock.applySafeFixPreview.mockReturnValue('after text');

    await applyAllSafeFixes(provider as never);

    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 1 fixes. Remaining TokenLint findings without automatic fixes: retrieval.contextAmplification (1).'
    );
  });

  it('reports non-fixable TokenLint findings and other diagnostic sources when no automatic fixes exist', async () => {
    const document: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'prompt body'),
      lineAt: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };

    const provider = {
      scan: vi.fn(() => ({
        ...emptyResult,
        findings: [
          {
            ruleId: 'retrieval.contextAmplification',
            title: 'Context amplification risk',
            message: 'Retrieved context is too large',
            severity: 'warning' as const,
            loc: {
              startLine: 0,
              startColumn: 0,
              endLine: 10,
              endColumn: 0
            }
          }
        ]
      }))
    };

    vscodeMock.getDiagnostics.mockReturnValue([
      [{ scheme: 'file', fsPath: '/workspace/prompt.md' }, [
        { source: 'TokenLint' },
        { source: 'markdownlint' },
        { source: 'markdownlint' }
      ]]
    ]);

    await applyAllSafeFixes(provider as never);

    expect(vscodeMock.applyEdit).not.toHaveBeenCalled();
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint: No automatic fixes available. Remaining TokenLint findings without automatic fixes: retrieval.contextAmplification (1). Other diagnostics are still present: markdownlint (2).'
    );
  });

  it('adds oversized files to .tokenlintignore when prompt size is the only TokenLint issue', async () => {
    const document: MockDocument = {
      fileName: '/workspace/oversized.md',
      uri: 'file:///oversized.md',
      getText: vi.fn(() => 'very large prompt body'),
      lineAt: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };

    const provider = {
      scan: vi.fn(() => ({
        ...emptyResult,
        findings: [
          {
            ruleId: 'optimization.promptSize',
            title: 'Large prompt',
            message: 'Prompt is large',
            severity: 'warning' as const,
            loc: {
              startLine: 0,
              startColumn: 0,
              endLine: 10,
              endColumn: 0
            }
          }
        ]
      }))
    };

    await applyAllSafeFixes(provider as never);

    expect(vscodeMock.applyEdit).not.toHaveBeenCalled();
    expect(fsPromisesMock.writeFile).toHaveBeenCalledWith(
      '/workspace/.tokenlintignore',
      'oversized.md\n',
      'utf8'
    );
    expect(provider.scan).toHaveBeenCalledTimes(2);
    expect(provider.scan).toHaveBeenNthCalledWith(1, document);
    expect(provider.scan).toHaveBeenNthCalledWith(2, document);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 1 fixes. Included 1 oversized-file ignores.'
    );
  });

  it('respects existing .tokenlintignore content: skips comment lines and appends without double newline', async () => {
    const document: MockDocument = {
      fileName: '/workspace/new-large.md',
      uri: 'file:///new-large.md',
      getText: vi.fn(() => 'very large prompt body'),
      lineAt: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };
    // Existing .tokenlintignore has a comment line and an existing entry without trailing newline
    fsPromisesMock.readFile.mockResolvedValue('# ignore list\nold-large.md');

    const provider = {
      scan: vi.fn(() => ({
        ...emptyResult,
        findings: [
          {
            ruleId: 'optimization.promptSize',
            title: 'Large prompt',
            message: 'Prompt is large',
            severity: 'warning' as const,
            loc: { startLine: 0, startColumn: 0, endLine: 10, endColumn: 0 }
          }
        ]
      }))
    };

    await applyAllSafeFixes(provider as never);

    expect(fsPromisesMock.writeFile).toHaveBeenCalledWith(
      '/workspace/.tokenlintignore',
      '# ignore list\nold-large.md\nnew-large.md\n',
      'utf8'
    );
  });

  it('resolves a markdownlint-only diagnostic file when the active editor is unsupported', async () => {
    const unsupportedDocument: MockDocument = {
      fileName: '/workspace/config.json',
      uri: { scheme: 'file', fsPath: '/workspace/config.json' } as never,
      getText: vi.fn(() => '{}'),
      lineAt: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined)
    };
    const markdownUri = { scheme: 'file', fsPath: '/workspace/docs/prompt.md' };
    const markdownDocument: MockDocument = {
      fileName: '/workspace/docs/prompt.md',
      uri: 'file:///docs/prompt.md' as never,
      lineCount: 3,
      getText: vi.fn(() => 'Overview\n## Repeated\n## Repeated'),
      lineAt: vi.fn((line: number) => {
        const text = ['Overview', '## Repeated', '## Repeated'][line];
        return {
          text,
          range: { start: { line, character: 0 }, end: { line, character: text.length } },
          rangeIncludingLineBreak: `line-${line}`
        };
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document: unsupportedDocument };
    // Active editor is not supported; only the markdown doc has markdownlint diagnostics
    scanFilterMock.shouldAnalyzeFile.mockImplementation((fileName: string) =>
      fileName !== '/workspace/config.json'
    );
    vscodeMock.getDiagnostics.mockReturnValue([
      [markdownUri, [
        {
          source: 'markdownlint',
          code: { value: 'MD024' },
          message: 'Duplicate headings',
          range: { start: { line: 2, character: 0 } }
        }
      ]]
    ]);
    vscodeMock.openTextDocument.mockResolvedValue(markdownDocument);
    vscodeMock.applyEdit.mockResolvedValue(true);

    const provider = { scan: vi.fn(() => emptyResult) };

    await applyAllSafeFixes(provider as never);

    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(markdownUri);
    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('markdownlint')
    );
  });

  it('applies supported markdownlint fixes when no TokenLint edit exists', async () => {
    const lines = [
      'Overview',
      '## Repeated',
      '## Repeated',
      '| Name | Value | Notes |',
      '| --- | --- | --- |',
      '| only |'
    ];
    const document: MockDocument = {
      fileName: '/workspace/docs/prompt.md',
      uri: 'file:///prompt.md',
      lineCount: lines.length,
      getText: vi.fn(() => lines.join('\n')),
      lineAt: vi.fn((line: number) => ({
        text: lines[line],
        range: {
          start: { line, character: 0 },
          end: { line, character: lines[line].length }
        },
        rangeIncludingLineBreak: `line-${line}`
      })),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };
    vscodeMock.getDiagnostics.mockReturnValue([
      [{ scheme: 'file', fsPath: '/workspace/docs/prompt.md' }, [
        {
          source: 'markdownlint',
          code: { value: 'MD041' },
          message: 'First line in a file should be a top-level heading',
          range: { start: { line: 0, character: 0 } }
        },
        {
          source: 'markdownlint',
          code: { value: 'MD024' },
          message: 'Multiple headings with the same content',
          range: { start: { line: 2, character: 0 } }
        },
        {
          source: 'markdownlint',
          code: { value: 'MD056' },
          message: 'Table column count [Expected: 3; Actual: 1; Too few cells, row will be missing data]',
          range: { start: { line: 5, character: 0 } }
        }
      ]]
    ]);

    const provider = {
      scan: vi.fn(() => emptyResult)
    };

    vscodeMock.applyEdit.mockResolvedValue(true);

    await applyAllSafeFixes(provider as never);

    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    const edit = vscodeMock.applyEdit.mock.calls[0][0] as {
      replaces: Array<{ uri: string; range: unknown; newText: string }>;
      inserts: Array<{ uri: string; position: unknown; newText: string }>;
    };
    expect(edit.inserts).toEqual([
      {
        uri: 'file:///prompt.md',
        position: { line: 0, character: 0 },
        newText: '# Prompt\n\n'
      }
    ]);
    expect(edit.replaces).toEqual([
      {
        uri: 'file:///prompt.md',
        range: {
          start: { line: 5, character: 0 },
          end: { line: 5, character: 8 }
        },
        newText: '| only |  |  |'
      },
      {
        uri: 'file:///prompt.md',
        range: {
          start: { line: 2, character: 0 },
          end: { line: 2, character: 11 }
        },
        newText: '## Repeated (2)'
      }
    ]);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(provider.scan).toHaveBeenCalledTimes(2);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 3 fixes. Included 3 markdownlint fixes.'
    );
  });

  it('reports when the refreshed diagnostics contain no automatic fixes at all', async () => {
    const document: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'prompt body'),
      lineAt: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };
    const provider = { scan: vi.fn(() => emptyResult) };
    vscodeMock.getDiagnostics.mockReturnValue([]);

    await applyAllSafeFixes(provider as never);

    expect(provider.scan).toHaveBeenCalledWith(document);
    expect(vscodeMock.applyEdit).not.toHaveBeenCalled();
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint: No automatic fixes available.'
    );
  });

  it('rescans the active document before deciding there are no safe fixes', async () => {
    let diagnostics: MockDiagnostic[] = [];
    const document: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'before text'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };

    const provider = {
      scan: vi.fn(() => {
        diagnostics = [{
          source: 'TokenLint',
          code: 'optimization.duplicateInstruction',
          range: {
            start: {
              line: 3
            }
          }
        }];

        return {
          ...emptyResult,
          findings: [
            {
              ruleId: 'optimization.duplicateInstruction',
              title: 'Duplicate instruction',
              message: 'Duplicate instruction',
              severity: 'info' as const,
              loc: {
                startLine: 3,
                startColumn: 0,
                endLine: 3,
                endColumn: 10
              },
              fix: {
                title: 'Remove duplicate instruction'
              }
            }
          ]
        };
      })
    };

    vscodeMock.getDiagnostics.mockImplementation(() => diagnostics);
    vscodeMock.applyEdit.mockResolvedValue(true);
    showFixGraphMock.applySafeFixPreview.mockReturnValue('after text');

    await applyAllSafeFixes(provider as never);

    expect(provider.scan).toHaveBeenCalledWith(document);
    expect(showFixGraphMock.applySafeFixPreview).toHaveBeenCalledWith('before text', [
      expect.objectContaining({
        id: 'optimization.duplicateInstruction:3',
        title: 'Remove duplicate instruction',
        safety: 'safe'
      })
    ]);
    expect(document.lineAt).toHaveBeenCalledWith(3);
    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    expect((vscodeMock.applyEdit.mock.calls[0][0] as { deletes: Array<{ uri: string; range: string }> }).deletes).toEqual([
      {
        uri: 'file:///prompt.md',
        range: 'line-range'
      }
    ]);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith('TokenLint applied 1 fixes.');
    expect(showFixGraphMock.showFixGraphPreview).toHaveBeenCalledWith({
      fileName: '/workspace/prompt.md',
      beforeText: 'before text',
      afterText: 'after text',
      beforeResult: expect.objectContaining({
        findings: expect.any(Array)
      }),
      allFixes: [
        expect.objectContaining({
          id: 'optimization.duplicateInstruction:3',
          title: 'Remove duplicate instruction',
          safety: 'safe'
        })
      ],
      safeFixes: [
        expect.objectContaining({
          id: 'optimization.duplicateInstruction:3',
          title: 'Remove duplicate instruction',
          safety: 'safe'
        })
      ]
    });
  });

  it('rescans fixed documents after applying safe edits so diagnostics clear immediately', async () => {
    const document: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'before text'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };

    const provider = {
      scan: vi
        .fn()
        .mockReturnValueOnce({
          ...emptyResult,
          findings: [
            {
              ruleId: 'optimization.duplicateInstruction',
              title: 'Duplicate instruction',
              message: 'Duplicate instruction',
              severity: 'info' as const,
              loc: {
                startLine: 3,
                startColumn: 0,
                endLine: 3,
                endColumn: 10
              },
              fix: {
                title: 'Remove duplicate instruction'
              }
            }
          ]
        })
        .mockReturnValueOnce(emptyResult)
    };

    vscodeMock.applyEdit.mockResolvedValue(true);
    showFixGraphMock.applySafeFixPreview.mockReturnValue('after text');

    await applyAllSafeFixes(provider as never);

    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(provider.scan).toHaveBeenCalledTimes(2);
    expect(provider.scan).toHaveBeenNthCalledWith(1, document);
    expect(provider.scan).toHaveBeenNthCalledWith(2, document);
  });

  it('does not save or report success when the workspace edit fails', async () => {
    const document: MockDocument = {
      fileName: '/workspace/prompt.md',
      uri: 'file:///prompt.md',
      getText: vi.fn(() => 'before text'),
      lineAt: vi.fn().mockReturnValue({
        rangeIncludingLineBreak: 'line-range'
      }),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };
    const provider = {
      scan: vi.fn(() => ({
        ...emptyResult,
        findings: [
          {
            ruleId: 'optimization.duplicateInstruction',
            title: 'Duplicate instruction',
            message: 'Duplicate instruction',
            severity: 'info' as const,
            loc: {
              startLine: 4,
              startColumn: 0,
              endLine: 4,
              endColumn: 10
            },
            fix: {
              title: 'Remove duplicate instruction'
            }
          }
        ]
      }))
    };
    vscodeMock.getDiagnostics.mockReturnValue([
      {
        source: 'TokenLint',
        code: 'optimization.duplicateInstruction',
        range: { start: { line: 4 } }
      }
    ]);
    vscodeMock.applyEdit.mockResolvedValue(false);

    await applyAllSafeFixes(provider as never);

    expect(document.save).not.toHaveBeenCalled();
    expect(showFixGraphMock.showFixGraphPreview).not.toHaveBeenCalled();
    expect(vscodeMock.showInformationMessage).not.toHaveBeenCalledWith(
      'TokenLint applied 1 fixes.'
    );
  });

  it('falls through from an unsupported active editor to a fixable diagnostic file', async () => {
    const unsupportedDocument: MockDocument = {
      fileName: '/workspace/rewrite.txt',
      uri: 'file:///rewrite.txt',
      getText: vi.fn(() => 'ignored text'),
      lineAt: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined)
    };
    const targetUri = {
      scheme: 'file',
      fsPath: '/workspace/dashboard.json'
    };
    const targetDocument: MockDocument = {
      fileName: '/workspace/dashboard.json',
      uri: 'file:///dashboard.json',
      getText: vi.fn(() => 'large dashboard body'),
      lineAt: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document: unsupportedDocument };
    scanFilterMock.shouldAnalyzeFile.mockImplementation((fileName: string) => fileName !== '/workspace/rewrite.txt');
    vscodeMock.getDiagnostics.mockReturnValue([
      [targetUri, [{
        source: 'TokenLint',
        code: 'optimization.promptSize',
        range: { start: { line: 0 } }
      }]]
    ]);
    vscodeMock.openTextDocument.mockResolvedValue(targetDocument);

    const provider = {
      scan: vi
        .fn()
        .mockReturnValueOnce({
          ...emptyResult,
          findings: [
            {
              ruleId: 'optimization.promptSize',
              title: 'Large prompt',
              message: 'Prompt is large',
              severity: 'warning' as const,
              loc: {
                startLine: 0,
                startColumn: 0,
                endLine: 20,
                endColumn: 0
              }
            }
          ]
        })
        .mockReturnValueOnce(emptyResult)
    };

    await applyAllSafeFixes(provider as never);

    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(targetUri);
    expect(provider.scan).toHaveBeenCalledTimes(2);
    expect(provider.scan).toHaveBeenNthCalledWith(1, targetDocument);
    expect(provider.scan).toHaveBeenNthCalledWith(2, targetDocument);
    expect(fsPromisesMock.writeFile).toHaveBeenCalledWith(
      '/workspace/.tokenlintignore',
      'dashboard.json\n',
      'utf8'
    );
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 1 fixes. Included 1 oversized-file ignores.'
    );
  });

  it('repairs malformed dashboard json syntax and ignores prompt-size-only files', async () => {
    const malformedLines = [
      '{',
      '  "title": "Dashboard",',
      '  "widgets": [',
      '    {',
      '      "id": 1,',
      '        "title": "Group",',
      '        "type": "group",',
      '        "widgets": [',
      '          {',
      '            "id": 2,',
      '              "type": "note",',
      '              "content": "hello",',
      '              "tick_pos": "50%",',
      '            }',
      '          },',
      '          {',
      '            "id": 3,',
      '              "title": "Metric",',
      '              "type": "query_value",',
      '              "requests": [',
      '                {',
      '                  "queries": [',
      '                    {',
      '                      "name": "a",',
      '                      "query": "sum:test",',
      '                    }',
      '                  ],',
      '                  "formulas": [',
      '                    {',
      '                    }',
      '                  ],',
      '                    {',
      '                      "comparator": ">",',
      '                      "value": 0,',
      '                    }',
      '                  ]',
      '                }',
      '              ],',
      '              "precision": 0',
      '            }',
      '          }',
      '        ]',
      '      }',
      '    }',
      '  ]',
      '}'
    ];
    const malformedText = malformedLines.join('\n');
    const document: MockDocument = {
      fileName: '/workspace/dashboard.json',
      uri: 'file:///dashboard.json',
      lineCount: malformedLines.length,
      getText: vi.fn(() => malformedText),
      lineAt: vi.fn((line: number) => ({
        text: malformedLines[line],
        range: {
          start: { line, character: 0 },
          end: { line, character: malformedLines[line].length }
        },
        rangeIncludingLineBreak: `line-${line}`
      })),
      save: vi.fn().mockResolvedValue(undefined)
    };

    vscodeMock.state.activeTextEditor = { document };
    vscodeMock.getDiagnostics.mockReturnValue([
      [{ scheme: 'file', fsPath: '/workspace/dashboard.json' }, [
        {
          source: 'TokenLint',
          code: 'optimization.promptSize',
          range: { start: { line: 0 } }
        },
        {
          source: 'json',
          code: '519',
          message: 'Trailing comma',
          range: { start: { line: 12, character: 32 } }
        },
        {
          source: 'json',
          code: '514',
          message: 'Expected comma',
          range: { start: { line: 17, character: 11 } }
        },
        {
          source: 'json',
          code: '513',
          message: 'Property expected',
          range: { start: { line: 31, character: 20 } }
        },
        {
          source: 'json',
          message: 'End of file expected.',
          range: { start: { line: 41, character: 6 } }
        }
      ]]
    ]);

    const provider = {
      scan: vi
        .fn()
        .mockReturnValueOnce({
          ...emptyResult,
          findings: [
            {
              ruleId: 'optimization.promptSize',
              title: 'Large prompt',
              message: 'Prompt is large',
              severity: 'warning' as const,
              loc: {
                startLine: 0,
                startColumn: 0,
                endLine: malformedLines.length - 1,
                endColumn: 1
              }
            }
          ]
        })
        .mockReturnValueOnce(emptyResult)
    };

    vscodeMock.applyEdit.mockResolvedValue(true);

    await applyAllSafeFixes(provider as never);

    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    const workspaceEdit = vscodeMock.applyEdit.mock.calls[0][0] as {
      replaces: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>;
    };
    expect(workspaceEdit.replaces).toHaveLength(1);
    expect(workspaceEdit.replaces[0].uri).toBe('file:///dashboard.json');
    expect(workspaceEdit.replaces[0].newText).toContain('"definition": {');
    expect(workspaceEdit.replaces[0].newText).toContain('"conditional_formats": [');
    expect(() => JSON.parse(workspaceEdit.replaces[0].newText)).not.toThrow();
    expect(fsPromisesMock.writeFile).toHaveBeenCalledWith(
      '/workspace/.tokenlintignore',
      'dashboard.json\n',
      'utf8'
    );
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(provider.scan).toHaveBeenCalledTimes(2);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint applied 2 fixes. Included 1 JSON syntax repairs and 1 oversized-file ignores.'
    );
  });

  it('skips unsupported files before scanning for fixes', async () => {
    const document: MockDocument = {
      fileName: '/workspace/rewrite.txt',
      uri: 'file:///rewrite.txt',
      getText: vi.fn(() => 'ignored text'),
      lineAt: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined)
    };
    const provider = { scan: vi.fn(() => emptyResult) };

    vscodeMock.state.activeTextEditor = { document };
    scanFilterMock.shouldAnalyzeFile.mockReturnValue(false);
    scanFilterMock.getSkipReason.mockReturnValue('unsupported file type');

    await applyAllSafeFixes(provider as never);

    expect(provider.scan).not.toHaveBeenCalled();
    expect(vscodeMock.applyEdit).not.toHaveBeenCalled();
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith(
      'TokenLint skipped unsupported file type'
    );
  });
});