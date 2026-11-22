import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const CONFIGURED_CAVEMAN_MODES = new Set([
  'off',
  'lite',
  'full',
  'ultra',
  'wenyan-lite',
  'wenyan',
  'wenyan-full',
  'wenyan-ultra',
  'commit',
  'review',
  'compress',
]);

/** Whether to surface estimated USD cost figures (on by default via the showCost setting). */
export function showCost(): boolean {
  return vscode.workspace.getConfiguration('cavemanDashboard').get<boolean>('showCost', true);
}

/** Trimmed `claudeProjectsPath` override, or undefined when unset/blank. */
export function claudeDirOverride(): string | undefined {
  const value = vscode.workspace.getConfiguration('cavemanDashboard').get<string>('claudeProjectsPath');
  return value && value.trim() ? value.trim() : undefined;
}

/** Short 7-char git sha for display, or 'unknown' when absent. */
export function shortSha(sha: string | null): string {
  return sha ? sha.slice(0, 7) : 'unknown';
}

export function effectiveCavemanMode(activeMode: string | null | undefined, defaultMode: string | null | undefined): string | null {
  if (activeMode && activeMode !== 'off') return activeMode;
  if (defaultMode && defaultMode !== 'off') return defaultMode;
  return null;
}

export function resolveCavemanDefaultMode(): string {
  const envMode = normalizeConfiguredCavemanMode(process.env.CAVEMAN_DEFAULT_MODE);
  if (envMode) return envMode;

  for (const root of workspaceRoots()) {
    const repoMode = readConfiguredMode(path.join(root, '.caveman', 'config.json'))
      ?? readConfiguredMode(path.join(root, '.caveman.json'));
    if (repoMode) return repoMode;
  }

  const xdgHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return readConfiguredMode(path.join(xdgHome, 'caveman', 'config.json')) ?? 'full';
}

function normalizeConfiguredCavemanMode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const mode = value.trim().toLowerCase();
  return CONFIGURED_CAVEMAN_MODES.has(mode) ? mode : null;
}

function readConfiguredMode(filePath: string): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return normalizeConfiguredCavemanMode(raw?.defaultMode);
  } catch {
    return null;
  }
}

function workspaceRoots(): string[] {
  const roots = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [];
  const activeEditor = vscode.window.activeTextEditor;
  const activeRoot = activeEditor ? vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)?.uri.fsPath : undefined;
  if (!activeRoot) return roots;
  return [activeRoot, ...roots.filter(root => root !== activeRoot)];
}
