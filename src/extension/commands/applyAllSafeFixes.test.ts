import { beforeEach, describe, expect, it, vi } from 'vitest';

const vscodeMock = vi.hoisted(() => {
  const state = {
    activeTextEditor: undefined as { document: MockDocument } | undefined
  };

  return {
    state,
    showInformationMessage: vi.fn(),
    applyEdit: vi.fn(),
    getDiagnostics: vi.fn(),
    WorkspaceEdit: class {
      public deletes: Array<{ uri: string; range: string }> = [];

      delete(uri: string, range: string) {
        this.deletes.push({ uri, range });
      }
    }
  };
});

vi.mock('vscode', () => ({
  window: {
    get activeTextEditor() {
      return vscodeMock.state.activeTextEditor;
    },
    showInformationMessage: vscodeMock.showInformationMessage
  },
  languages: {
    getDiagnostics: vscodeMock.getDiagnostics
  },
  workspace: {
    applyEdit: vscodeMock.applyEdit
  },
  WorkspaceEdit: vscodeMock.WorkspaceEdit
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
  uri: string;
  lineAt: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};

describe('applyAllSafeFixes', () => {
  beforeEach(() => {
    vscodeMock.state.activeTextEditor = undefined;
    vscodeMock.showInformationMessage.mockReset();
    vscodeMock.applyEdit.mockReset();
    vscodeMock.getDiagnostics.mockReset();
  });

  it('rescans the active document before deciding there are no safe fixes', async () => {
    let diagnostics: MockDiagnostic[] = [];
    const document: MockDocument = {
      uri: 'file:///prompt.md',
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
      })
    };

    vscodeMock.getDiagnostics.mockImplementation(() => diagnostics);
    vscodeMock.applyEdit.mockResolvedValue(true);

    await applyAllSafeFixes(provider as never);

    expect(provider.scan).toHaveBeenCalledWith(document);
    expect(document.lineAt).toHaveBeenCalledWith(3);
    expect(vscodeMock.applyEdit).toHaveBeenCalledTimes(1);
    expect((vscodeMock.applyEdit.mock.calls[0][0] as { deletes: Array<{ uri: string; range: string }> }).deletes).toEqual([
      {
        uri: 'file:///prompt.md',
        range: 'line-range'
      }
    ]);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith('TokenLint applied 1 safe fixes.');
  });
});