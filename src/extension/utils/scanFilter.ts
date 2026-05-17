import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  detectKind,
  isGeneratedDependencyFile,
  normalizeFileName
} from '../../core/parser/languageDetector';

type IgnorePattern = {
  matchesBaseName: boolean;
  regex: RegExp;
};

type CachedIgnoreFile = {
  modifiedMs: number;
  patterns: IgnorePattern[];
};

const ignoreFileName = '.tokenlintignore';
const ignoreFileCache = new Map<string, CachedIgnoreFile>();

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

function escapeForRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(glob: string): RegExp {
  let pattern = '';

  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];
    const afterNext = glob[index + 2];

    if (char === '*') {
      if (next === '*') {
        if (afterNext === '/') {
          pattern += '(?:.*/)?';
          index += 2;
        } else {
          pattern += '.*';
          index += 1;
        }
      } else {
        pattern += '[^/]*';
      }

      continue;
    }

    if (char === '?') {
      pattern += '[^/]';
      continue;
    }

    pattern += escapeForRegex(char);
  }

  return new RegExp(`^${pattern}$`, 'i');
}

function readIgnorePatterns(rootPath: string): IgnorePattern[] {
  const ignorePath = path.join(rootPath, ignoreFileName);

  try {
    const stats = fs.statSync(ignorePath);
    const cached = ignoreFileCache.get(ignorePath);

    if (cached && cached.modifiedMs === stats.mtimeMs) {
      return cached.patterns;
    }

    const fileText = fs.readFileSync(ignorePath, 'utf8');
    const patterns = fileText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .map(line => {
        let normalized = toPosix(line).replace(/^\.\//, '').replace(/^\//, '');

        if (normalized.endsWith('/')) {
          normalized += '**';
        }

        return {
          matchesBaseName: !normalized.includes('/'),
          regex: globToRegExp(normalized)
        };
      });

    ignoreFileCache.set(ignorePath, {
      modifiedMs: stats.mtimeMs,
      patterns
    });

    return patterns;
  } catch {
    ignoreFileCache.delete(ignorePath);
    return [];
  }
}

function getWorkspaceFolder(fileName: string): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileName));
}

function isIgnoredByWorkspace(fileName: string): boolean {
  const workspaceFolder = getWorkspaceFolder(fileName);

  if (!workspaceFolder) {
    return false;
  }

  const patterns = readIgnorePatterns(workspaceFolder.uri.fsPath);
  if (patterns.length === 0) {
    return false;
  }

  const relativePath = toPosix(path.relative(workspaceFolder.uri.fsPath, fileName));
  const baseName = path.posix.basename(relativePath);

  return patterns.some(pattern => {
    if (pattern.regex.test(relativePath)) {
      return true;
    }

    return pattern.matchesBaseName && pattern.regex.test(baseName);
  });
}

export function shouldAnalyzeFile(fileName: string): boolean {
  if (isGeneratedDependencyFile(fileName)) {
    return false;
  }

  if (detectKind(fileName) === 'unknown') {
    return false;
  }

  return !isIgnoredByWorkspace(fileName);
}

export function getSkipReason(fileName: string): string {
  if (isGeneratedDependencyFile(fileName)) {
    return 'generated dependency lockfile';
  }

  if (detectKind(fileName) === 'unknown') {
    return 'unsupported file type';
  }

  if (isIgnoredByWorkspace(fileName)) {
    const workspaceFolder = getWorkspaceFolder(fileName);
    const relativePath = workspaceFolder
      ? toPosix(path.relative(workspaceFolder.uri.fsPath, fileName))
      : normalizeFileName(fileName);

    return `ignored by ${ignoreFileName}: ${relativePath}`;
  }

  return 'excluded file';
}