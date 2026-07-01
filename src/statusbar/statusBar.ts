import * as vscode from 'vscode';
import { CombinedSavings } from '../types';

/** Right-aligned status bar badge showing combined caveman savings; click opens the dashboard. */
export class CavemanStatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'cavemanDashboard.openDashboard';
    this.item.tooltip = 'Open Caveman dashboard';
  }

  showLoading(): void {
    this.item.text = '$(pulse) Caveman';
    this.item.show();
  }

  showError(): void {
    this.item.text = '$(warning) Caveman';
    this.item.tooltip = 'Caveman could not refresh. Run Caveman: Open Dashboard or check the Caveman Dashboard output channel.';
    this.item.show();
  }

  update(data: CombinedSavings, showCost: boolean): void {
    const { claude, copilot } = data;
    const totalSaved = claude.savedTokens + copilot.savedTokens;
    if (totalSaved <= 0) {
      this.item.text = '$(graph) Caveman';
      this.item.tooltip = claude.installed ? 'Caveman installed — no savings detected yet' : 'Caveman not installed';
      this.item.show();
      return;
    }
    // One badge, both providers: "Caveman  Claude 1.5M · Copilot 1.4M" (cost prefix optional).
    const cost = showCost && claude.savedUsd > 0 ? `$${claude.savedUsd.toFixed(2)} · ` : '';
    this.item.text = `$(graph) Caveman ${cost}Claude ${compact(claude.savedTokens)} · Copilot ${compact(copilot.savedTokens)}`;
    this.item.tooltip = [
      `Caveman savings this month (${claude.currentMonth}) — Claude + Copilot`,
      `Claude: ${formatTokens(claude.savedTokens)}${showCost ? ` ($${claude.savedUsd.toFixed(2)})` : ''} — ${claude.sessions} sessions`,
      `Copilot (est): ${formatTokens(copilot.savedTokens)} — ${copilot.sessions} chats / ${copilot.turns} turns`,
      claude.activeMode ? `Mode: ${claude.activeMode}` : 'Mode: off',
      'Resets on the 1st — history in the dashboard.',
    ].join('\n');
    this.item.show();
  }

  dispose(): void { this.item.dispose(); }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tok`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K tok`;
  return `${n} tok`;
}

/** Tight token label for the status bar badge (no "tok" suffix): 1.5M / 140K / 12. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}
