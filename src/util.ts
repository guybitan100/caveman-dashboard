import * as vscode from 'vscode';

/** Whether to surface estimated USD cost figures (opt-in via the showCost setting). */
export function showCost(): boolean {
  return vscode.workspace.getConfiguration('cavemanDashboard').get<boolean>('showCost', false);
}

/** Short 7-char git sha for display, or 'unknown' when absent. */
export function shortSha(sha: string | null): string {
  return sha ? sha.slice(0, 7) : 'unknown';
}
