import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

export type RuntimeArtifactBucket =
  | 'analytics'
  | 'sessions'
  | 'telemetry'
  | 'cache'
  | 'exports'
  | 'charts'
  | 'runtime';

export interface RuntimeArtifactDocumentInput {
  bucket: RuntimeArtifactBucket;
  fileName: string;
  language: string;
  content: string;
  workspaceFolder?: vscode.WorkspaceFolder;
}

interface GitIgnoreSection {
  header: string;
  entries: string[];
}

interface RuntimeArtifactPaths {
  root: string;
  analytics: string;
  sessions: string;
  telemetry: string;
  cache: string;
  exports: string;
  charts: string;
  runtime: string;
  gitignore: string;
}

const artifactRootDirName = '.tokenlint';
const artifactBuckets: readonly RuntimeArtifactBucket[] = [
  'analytics',
  'sessions',
  'telemetry',
  'cache',
  'exports',
  'charts',
  'runtime'
];
const gitIgnoreSections: readonly GitIgnoreSection[] = [
  {
    header: '# TokenLint Runtime Analytics',
    entries: ['.tokenlint/']
  },
  {
    header: '# TokenLint Generated Reports',
    entries: ['tokenlint-report.json', 'tokenlint-runtime-report.json']
  }
];

export async function ensureGitIgnoreRules(
  workspaceFolder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.[0]
): Promise<string | undefined> {
  if (!workspaceFolder) {
    return undefined;
  }

  const paths = buildRuntimeArtifactPaths(workspaceFolder.uri.fsPath);
  const existing = await readFileIfPresent(paths.gitignore);
  const normalizedLines = new Set(
    existing
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
  );
  const missingBlocks: string[] = [];

  for (const section of gitIgnoreSections) {
    const missingEntries = section.entries.filter(entry => !normalizedLines.has(entry));
    if (missingEntries.length === 0) {
      continue;
    }

    const blockLines: string[] = [];
    if (!normalizedLines.has(section.header)) {
      blockLines.push(section.header);
    }

    blockLines.push(...missingEntries);
    missingBlocks.push(blockLines.join('\n'));
  }

  if (missingBlocks.length === 0) {
    return paths.gitignore;
  }

  const nextContent = [existing.trimEnd(), ...missingBlocks]
    .filter(Boolean)
    .join('\n\n') + '\n';
  await fs.writeFile(paths.gitignore, nextContent, 'utf8');
  return paths.gitignore;
}

export async function prepareRuntimeArtifactDocument(
  input: RuntimeArtifactDocumentInput
): Promise<vscode.TextDocument> {
  const artifactUri = await writeRuntimeArtifact(input);
  if (artifactUri) {
    return await vscode.workspace.openTextDocument(artifactUri);
  }

  return await vscode.workspace.openTextDocument({
    language: input.language,
    content: input.content
  });
}

export async function writeRuntimeArtifact(
  input: Omit<RuntimeArtifactDocumentInput, 'language'>
): Promise<vscode.Uri | undefined> {
  const workspaceFolder = input.workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return undefined;
  }

  try {
    const paths = await ensureRuntimeArtifactStorage(workspaceFolder);
    if (!paths) {
      return undefined;
    }

    const filePath = path.join(paths[input.bucket], sanitizeFileName(input.fileName));
    await fs.writeFile(filePath, input.content, 'utf8');
    return vscode.Uri.file(filePath);
  } catch {
    return undefined;
  }
}

async function ensureRuntimeArtifactStorage(
  workspaceFolder: vscode.WorkspaceFolder | undefined
): Promise<RuntimeArtifactPaths | undefined> {
  if (!workspaceFolder) {
    return undefined;
  }

  const paths = buildRuntimeArtifactPaths(workspaceFolder.uri.fsPath);
  await ensureGitIgnoreRules(workspaceFolder);
  await Promise.all([
    fs.mkdir(paths.root, { recursive: true }),
    ...artifactBuckets.map(bucket => fs.mkdir(paths[bucket], { recursive: true }))
  ]);
  return paths;
}

function buildRuntimeArtifactPaths(workspaceRoot: string): RuntimeArtifactPaths {
  const root = path.join(workspaceRoot, artifactRootDirName);

  return {
    root,
    analytics: path.join(root, 'analytics'),
    sessions: path.join(root, 'sessions'),
    telemetry: path.join(root, 'telemetry'),
    cache: path.join(root, 'cache'),
    exports: path.join(root, 'exports'),
    charts: path.join(root, 'charts'),
    runtime: path.join(root, 'runtime'),
    gitignore: path.join(workspaceRoot, '.gitignore')
  };
}

async function readFileIfPresent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (isNotFoundError(error)) {
      return '';
    }

    throw error;
  }
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'ENOENT';
}

function sanitizeFileName(fileName: string): string {
  const normalized = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'tokenlint-artifact.txt';
}