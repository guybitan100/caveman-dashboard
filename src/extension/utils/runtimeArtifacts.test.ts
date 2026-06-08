import { beforeEach, describe, expect, it, vi } from 'vitest';

const artifactMocks = vi.hoisted(() => {
  const state = {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }] as Array<{ uri: { fsPath: string } }> | undefined
  };

  return {
    state,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    openTextDocument: vi.fn(),
    uriFile: vi.fn((filePath: string) => ({ fsPath: filePath }))
  };
});

vi.mock('node:fs/promises', () => ({
  readFile: artifactMocks.readFile,
  writeFile: artifactMocks.writeFile,
  mkdir: artifactMocks.mkdir
}));

vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return artifactMocks.state.workspaceFolders;
    },
    openTextDocument: artifactMocks.openTextDocument
  },
  Uri: {
    file: artifactMocks.uriFile
  }
}));

import {
  ensureGitIgnoreRules,
  prepareRuntimeArtifactDocument,
  writeRuntimeArtifact
} from './runtimeArtifacts';

describe('runtime artifacts utility', () => {
  beforeEach(() => {
    artifactMocks.state.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    artifactMocks.readFile.mockReset();
    artifactMocks.writeFile.mockReset();
    artifactMocks.mkdir.mockReset();
    artifactMocks.openTextDocument.mockReset();
    artifactMocks.uriFile.mockClear();
  });

  it('appends tokenlint ignore rules when they are missing', async () => {
    artifactMocks.readFile.mockResolvedValue('# Existing\nnode_modules\n');

    await ensureGitIgnoreRules();

    expect(artifactMocks.writeFile).toHaveBeenCalledWith(
      '/workspace/.gitignore',
      '# Existing\nnode_modules\n\n# TokenLint Runtime Analytics\n.tokenlint/\n\n# TokenLint Generated Reports\ntokenlint-report.json\ntokenlint-runtime-report.json\n',
      'utf8'
    );
  });

  it('does not rewrite gitignore when tokenlint rules already exist', async () => {
    artifactMocks.readFile.mockResolvedValue([
      '# TokenLint Runtime Analytics',
      '.tokenlint/',
      '',
      '# TokenLint Generated Reports',
      'tokenlint-report.json',
      'tokenlint-runtime-report.json',
      ''
    ].join('\n'));

    await ensureGitIgnoreRules();

    expect(artifactMocks.writeFile).not.toHaveBeenCalled();
  });

  it('writes runtime artifacts under the .tokenlint workspace tree', async () => {
    artifactMocks.readFile.mockResolvedValue([
      '# TokenLint Runtime Analytics',
      '.tokenlint/',
      '',
      '# TokenLint Generated Reports',
      'tokenlint-report.json',
      'tokenlint-runtime-report.json',
      ''
    ].join('\n'));

    const uri = await writeRuntimeArtifact({
      bucket: 'analytics',
      fileName: 'Runtime Cost Analysis.md',
      content: '# Runtime Cost Analysis'
    });

    expect(artifactMocks.mkdir).toHaveBeenCalledWith('/workspace/.tokenlint', { recursive: true });
    expect(artifactMocks.writeFile).toHaveBeenLastCalledWith(
      '/workspace/.tokenlint/analytics/runtime-cost-analysis.md',
      '# Runtime Cost Analysis',
      'utf8'
    );
    expect(artifactMocks.uriFile).toHaveBeenCalledWith('/workspace/.tokenlint/analytics/runtime-cost-analysis.md');
    expect(uri).toEqual({ fsPath: '/workspace/.tokenlint/analytics/runtime-cost-analysis.md' });
  });

  it('falls back to an untitled document when no workspace folder exists', async () => {
    const untitledDocument = { uri: 'untitled:runtime-cost-analysis.md' };
    artifactMocks.state.workspaceFolders = undefined;
    artifactMocks.openTextDocument.mockResolvedValue(untitledDocument);

    const document = await prepareRuntimeArtifactDocument({
      bucket: 'analytics',
      fileName: 'runtime-cost-analysis.md',
      language: 'markdown',
      content: '# Runtime Cost Analysis'
    });

    expect(artifactMocks.openTextDocument).toHaveBeenCalledWith({
      language: 'markdown',
      content: '# Runtime Cost Analysis'
    });
    expect(document).toBe(untitledDocument);
  });
});