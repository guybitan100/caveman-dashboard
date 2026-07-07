import * as vscode from 'vscode';
import { CavemanCollector } from './collectors/cavemanCollector';
import { CopilotCollector } from './collectors/copilotCollector';
import { checkCavemanUpdate, CavemanUpdateStatus } from './collectors/updateChecker';
import { CavemanPanel } from './dashboard/cavemanPanel';
import { CavemanStatusBar } from './statusbar/statusBar';
import { CavemanSavings, CombinedSavings, CopilotSavings } from './types';
import { currentMonthKey } from './analytics/cavemanEngine';
import { claudeDirOverride, showCost, shortSha } from './util';

let cavemanCollector: CavemanCollector;
let copilotCollector: CopilotCollector;
let statusBar: CavemanStatusBar;
let outputChannel: vscode.OutputChannel;
let lastData: CombinedSavings | undefined;

const EMPTY_CLAUDE: CavemanSavings = {
  active: false, currentMonth: currentMonthKey(), sessions: 0, outputTokens: 0, savedTokens: 0, savedUsd: 0,
  byDay: [], byMonth: [], source: 'none', installed: false, activeMode: null,
};
const EMPTY_COPILOT: CopilotSavings = {
  active: false, currentMonth: currentMonthKey(), sessions: 0, turns: 0, outputTokens: 0, savedTokens: 0,
  byDay: [], byMonth: [], models: [], configured: false, source: 'none',
};

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Caveman Dashboard');
  context.subscriptions.push(outputChannel);

  const config = vscode.workspace.getConfiguration('cavemanDashboard');
  const explicitDir = claudeDirOverride();
  const vscodeUserPath = config.get<string>('vscodeUserPath');
  cavemanCollector = new CavemanCollector(explicitDir);
  copilotCollector = new CopilotCollector(vscodeUserPath && vscodeUserPath.trim() ? vscodeUserPath.trim() : undefined);

  const version = (context.extension.packageJSON as { version?: string })?.version;
  statusBar = new CavemanStatusBar(version);
  statusBar.showLoading();

  context.subscriptions.push(
    vscode.commands.registerCommand('cavemanDashboard.openDashboard', () => {
      const data = refreshData();
      CavemanPanel.show(context, data);
    }),
    vscode.commands.registerCommand('cavemanDashboard.refresh', () => {
      const data = refreshData();
      if (CavemanPanel.currentPanel) CavemanPanel.currentPanel.update(data);
      vscode.window.showInformationMessage('Caveman Dashboard refreshed');
    }),
    vscode.commands.registerCommand('cavemanDashboard.checkUpdate', async () => {
      const dir = explicitDir;
      const status = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Checking for caveman update…' },
        () => checkCavemanUpdate(dir),
      );
      if (CavemanPanel.currentPanel) CavemanPanel.currentPanel.setUpdateStatus(status);
      await presentUpdateStatus(status);
    }),
    vscode.commands.registerCommand('cavemanDashboard.cavemanCli', async (action?: unknown) => {
      // Map dashboard actions to caveman installer CLI flags (bin/install.js).
      const FLAGS: Record<string, string> = {
        'install': '--non-interactive',
        'all': '--all --non-interactive',
        'minimal': '--minimal --non-interactive',
        'dry-run': '--dry-run',
        'list': '--list',
        'force': '--force --non-interactive',
        'uninstall': '--uninstall --non-interactive',
      };
      const key = String(action ?? '');
      const flag = FLAGS[key];
      if (flag === undefined) {
        vscode.window.showErrorMessage(`Caveman Dashboard: unknown caveman action "${key}".`);
        return;
      }
      // Always pull the latest installer from main and forward flags to it.
      const isWin = process.platform === 'win32';
      const SH = 'https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh';
      const PS1 = 'https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1';
      const cmd = isWin
        ? `& ([scriptblock]::Create((irm ${PS1}))) ${flag}`
        : `curl -fsSL ${SH} | bash -s -- ${flag}`;
      // dry-run / list are read-only; everything else changes the machine -> confirm.
      const readOnly = key === 'dry-run' || key === 'list';
      if (!readOnly) {
        const danger = key === 'uninstall';
        const answer = await vscode.window.showWarningMessage(
          danger ? 'Uninstall caveman from this machine?' : `Run the caveman installer (${key})?`,
          { modal: true, detail: `${cmd}\n\nDownloads and runs the latest installer from github.com/JuliusBrussee/caveman (needs network and Node ≥18).` },
          danger ? 'Uninstall' : 'Run'
        );
        if (!answer) return;
      }
      const term = vscode.window.createTerminal('Caveman');
      term.show(true);
      term.sendText(cmd, true);
    })
  );

  // Populate the status bar badge after activation returns — the collectors read
  // thousands of transcript files synchronously, so defer them off the activation path.
  setTimeout(refreshData, 0);
}

function refreshData(): CombinedSavings {
  let claude = EMPTY_CLAUDE;
  let copilot = EMPTY_COPILOT;
  let failed = false;

  try { claude = cavemanCollector.collect(); }
  catch (error) { logError('Claude caveman scan failed', error); failed = true; }

  try {
    // Estimate Copilot compression using caveman's active/benchmarked mode; gate the
    // "configured" flag on caveman being installed on this machine.
    copilot = copilotCollector.collect(claude.installed, claude.activeMode ?? 'full');
  } catch (error) { logError('Copilot estimate scan failed', error); failed = true; }

  lastData = { claude, copilot };
  if (failed && !claude.active && !copilot.active) statusBar?.showError();
  else statusBar?.update(lastData, showCost());
  return lastData;
}

export function deactivate() {
  statusBar?.dispose();
}

/** Show the update-check result as a notification with follow-up actions. */
async function presentUpdateStatus(s: CavemanUpdateStatus): Promise<void> {
  if (s.error) {
    vscode.window.showWarningMessage(`Caveman update check failed: ${s.error}`);
    return;
  }
  if (!s.installed) {
    const pick = await vscode.window.showInformationMessage('caveman is not installed on this machine.', 'Install');
    if (pick === 'Install') vscode.commands.executeCommand('cavemanDashboard.cavemanCli', 'install');
    return;
  }
  if (!s.updateAvailable) {
    vscode.window.showInformationMessage(`caveman is up to date (${shortSha(s.installedSha)}).`);
    return;
  }
  const pick = await vscode.window.showInformationMessage(
    `caveman update available: ${shortSha(s.installedSha)} → ${shortSha(s.latestSha)}.`,
    'Update', 'View changes',
  );
  if (pick === 'Update') vscode.commands.executeCommand('cavemanDashboard.cavemanCli', 'force');
  else if (pick === 'View changes' && s.compareUrl) vscode.env.openExternal(vscode.Uri.parse(s.compareUrl));
}

function logError(message: string, error: unknown): void {
  const details = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  outputChannel?.appendLine(`[${new Date().toISOString()}] ${message}: ${details}`);
}
