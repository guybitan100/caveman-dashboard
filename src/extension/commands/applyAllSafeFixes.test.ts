import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisResult } from '../../core/engine/engine';

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
    WorkspaceEdit: class {
      public deletes: Array<{ uri: string; range: string }> = [];
      public replaces: Array<{ uri: string; range: string; newText: string }> = [];

      delete(uri: string, range: string) {
        this.deletes.push({ uri, range });
      }

      replace(uri: string, range: string, newText: string) {
        this.replaces.push({ uri, range, newText });
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
    openTextDocument: vscodeMock.openTextDocument
  },
  WorkspaceEdit: vscodeMock.WorkspaceEdit
}));

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
  code?: string | number;
  range: {
    start: {
      line: number;
    };
  };
};

type MockDocument = {
  fileName: string;
  uri: string;
  getText?: ReturnType<typeof vi.fn>;
  lineAt: ReturnType<typeof vi.fn>;
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
    scanFilterMock.shouldAnalyzeFile.mockReset();
    scanFilterMock.getSkipReason.mockReset();
    showFixGraphMock.applySafeFixPreview.mockReset();
    showFixGraphMock.showFixGraphPreview.mockReset();
    scanFilterMock.shouldAnalyzeFile.mockReturnValue(true);
    vscodeMock.getDiagnostics.mockReturnValue([]);
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
            ruleId: 'optimization.promptSize',
            title: 'Large prompt',
            message: 'Prompt is large',
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
      'TokenLint applied 1 fixes. 1 TokenLint finding remains for manual review or has no automatic fix.'
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