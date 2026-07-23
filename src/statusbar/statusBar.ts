import * as vscode from 'vscode';
import { CombinedSavings } from '../types';
import { effectiveCavemanMode } from '../util';

/** Right-aligned status bar badge showing combined caveman savings; click opens the dashboard. */
export class CavemanStatusBar {
  private item: vscode.StatusBarItem;
  private readonly label: string;
  private readonly versionSuffix: string;

  constructor(version?: string) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'cavemanDashboard.openDashboard';
    this.item.tooltip = 'Open Caveman dashboard';
    this.label = 'Caveman';
    this.versionSuffix = version ? `v${version}` : '';
  }

  showLoading(): void {
    this.item.text = `$(pulse) ${this.label}`;
    this.item.tooltip = ['Refreshing Caveman dashboard data...', this.versionSuffix].filter(Boolean).join('\n');
    this.item.show();
  }

  showError(): void {
    this.item.text = `$(warning) ${this.label}`;
    this.item.tooltip = [
      'Caveman could not refresh.',
      'Run Caveman: Open Dashboard or check the Caveman Dashboard output channel.',
      this.versionSuffix,
    ].filter(Boolean).join('\n');
    this.item.show();
  }

  update(data: CombinedSavings, showCost: boolean): void {
    const { claude, copilot } = data;
    const mode = effectiveCavemanMode(claude.activeMode, claude.defaultMode);
    const totalSaved = claude.savedTokens + copilot.savedTokens;
    if (totalSaved <= 0) {
      this.item.text = claude.installed ? `$(graph) ${this.label} 0` : `$(circle-slash) ${this.label} Off`;
      this.item.tooltip = [
        claude.installed ? 'Caveman installed — no savings detected yet.' : 'Caveman not installed.',
        mode ? `Configured mode: ${mode}` : 'Configured mode: off',
        this.versionSuffix,
      ].filter(Boolean).join('\n');
      this.item.show();
      return;
    }
    this.item.text = `$(graph) ${this.label} ${formatStatusTokens(totalSaved)}`;
    this.item.tooltip = [
      `Caveman savings this month (${claude.currentMonth}) — Claude + Copilot`,
      `Total: ${formatTokens(totalSaved)}`,
      `Claude: ${formatTokens(claude.savedTokens)}${showCost ? ` ($${claude.savedUsd.toFixed(2)})` : ''} — ${claude.sessions} sessions`,
      `Copilot (est): ${formatTokens(copilot.savedTokens)} — ${copilot.sessions} chats / ${copilot.turns} turns`,
      claude.activeMode ? `Mode: active ${claude.activeMode}` : mode ? `Mode: default ${mode}` : 'Mode: off',
      'Resets on the 1st — history in the dashboard.',
      this.versionSuffix,
    ].filter(Boolean).join('\n');
    this.item.show();
  }

  dispose(): void { this.item.dispose(); }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tok`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K tok`;
  return `${n} tok`;
}

function formatStatusTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

