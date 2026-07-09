import * as vscode from 'vscode';

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
