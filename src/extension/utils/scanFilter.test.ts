import { beforeEach, describe, expect, it, vi } from 'vitest';

const scanFilterMocks = vi.hoisted(() => ({
  statSync: vi.fn(),
  readFileSync: vi.fn(),
  getWorkspaceFolder: vi.fn(),
  uriFile: vi.fn((fileName: string) => ({ fsPath: fileName })),
  detectKind: vi.fn(),
  isGeneratedDependencyFile: vi.fn(),
  normalizeFileName: vi.fn((fileName: string) => fileName.replace(/^.*\//, ''))
}));

vi.mock('fs', () => ({
  statSync: scanFilterMocks.statSync,
  readFileSync: scanFilterMocks.readFileSync
}));

vi.mock('vscode', () => ({
  workspace: {
    getWorkspaceFolder: scanFilterMocks.getWorkspaceFolder
  },
  Uri: {
    file: scanFilterMocks.uriFile
  }
}));

vi.mock('../../core/parser/languageDetector', () => ({
  detectKind: scanFilterMocks.detectKind,
  isGeneratedDependencyFile: scanFilterMocks.isGeneratedDependencyFile,
  normalizeFileName: scanFilterMocks.normalizeFileName
}));

describe('scanFilter', () => {
  beforeEach(() => {
    vi.resetModules();
    scanFilterMocks.statSync.mockReset();
    scanFilterMocks.readFileSync.mockReset();
    scanFilterMocks.getWorkspaceFolder.mockReset();
    scanFilterMocks.uriFile.mockClear();
    scanFilterMocks.detectKind.mockReset();
    scanFilterMocks.isGeneratedDependencyFile.mockReset();
    scanFilterMocks.normalizeFileName.mockReset();
    scanFilterMocks.normalizeFileName.mockImplementation((fileName: string) => fileName.replace(/^.*\//, ''));
  });

  it('skips generated dependency files and unsupported files', async () => {
    const { getSkipReason, shouldAnalyzeFile } = await import('./scanFilter');
    scanFilterMocks.isGeneratedDependencyFile.mockReturnValue(true);

    expect(shouldAnalyzeFile('/workspace/package-lock.json')).toBe(false);
    expect(getSkipReason('/workspace/package-lock.json')).toBe('generated dependency lockfile');

    scanFilterMocks.isGeneratedDependencyFile.mockReturnValue(false);
    scanFilterMocks.detectKind.mockReturnValue('unknown');
    expect(shouldAnalyzeFile('/workspace/file.exe')).toBe(false);
    expect(getSkipReason('/workspace/file.exe')).toBe('unsupported file type');
  });

  it('applies ignore patterns from the workspace root and reuses the cached ignore file', async () => {
    const { shouldAnalyzeFile } = await import('./scanFilter');
    scanFilterMocks.isGeneratedDependencyFile.mockReturnValue(false);
    scanFilterMocks.detectKind.mockReturnValue('markdown');
    scanFilterMocks.getWorkspaceFolder.mockReturnValue({
      uri: { fsPath: '/workspace' }
    });
    scanFilterMocks.statSync.mockReturnValue({ mtimeMs: 1000 });
    scanFilterMocks.readFileSync.mockReturnValue('ignored.md\nlogs/\n');

    expect(shouldAnalyzeFile('/workspace/ignored.md')).toBe(false);
    expect(shouldAnalyzeFile('/workspace/logs/nested/file.md')).toBe(false);
    expect(shouldAnalyzeFile('/workspace/kept.md')).toBe(true);
    expect(scanFilterMocks.readFileSync).toHaveBeenCalledTimes(1);
  });

  it('describes ignored and otherwise excluded files', async () => {
    const { getSkipReason, shouldAnalyzeFile } = await import('./scanFilter');
    scanFilterMocks.isGeneratedDependencyFile.mockReturnValue(false);
    scanFilterMocks.detectKind.mockReturnValue('markdown');
    scanFilterMocks.getWorkspaceFolder.mockReturnValue({
      uri: { fsPath: '/workspace' }
    });
    scanFilterMocks.statSync.mockReturnValue({ mtimeMs: 1 });
    scanFilterMocks.readFileSync.mockReturnValue('notes/*.md\n');

    expect(shouldAnalyzeFile('/workspace/notes/todo.md')).toBe(false);
    expect(getSkipReason('/workspace/notes/todo.md')).toBe('ignored by .tokenlintignore: notes/todo.md');

    scanFilterMocks.getWorkspaceFolder.mockReturnValue(undefined);
    scanFilterMocks.statSync.mockImplementation(() => {
      throw new Error('missing');
    });
    expect(shouldAnalyzeFile('/other/place/prompt.md')).toBe(true);
    expect(getSkipReason('/other/place/prompt.md')).toBe('excluded file');
  });
});