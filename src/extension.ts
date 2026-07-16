import * as vscode from 'vscode';
import { CavemanCollector } from './collectors/cavemanCollector';
import { CopilotCollector } from './collectors/copilotCollector';
import { checkCavemanUpdate, CavemanUpdateStatus, readInstalledCaveman } from './collectors/updateChecker';
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
      // Resolve the caveman version/update status on open so the dashboard shows the
      // current version ("up to date" / "update available") instead of "unknown" without
      // a manual click. Silent (no notification) and only when not already known, so
      // reopening a panel that already checked doesn't refetch.
      if (CavemanPanel.currentPanel && !CavemanPanel.currentPanel.updateKnown) {
        void checkCavemanUpdate(explicitDir).then(status => {
          CavemanPanel.currentPanel?.setUpdateStatus(status);
        });
      }
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
    vscode.commands.registerCommand('cavemanDashboard.updatePlugin', () => updateCavemanPlugin()),
    vscode.commands.registerCommand('cavemanDashboard.restart', () => restartClaudeCode()),
    vscode.commands.registerCommand('cavemanDashboard.cavemanCli', async (action?: unknown) => {
      // Map dashboard actions to caveman installer CLI flags (bin/install.js).
      const FLAGS: Record<string, string> = {
        // The default dashboard install should always take the full caveman install path.
        'install': '--all --non-interactive',
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
      CavemanPanel.currentPanel?.applyInstallerAction(key);
      const term = vscode.window.createTerminal('Caveman');
      term.show(true);
      term.sendText(cmd, true);
    })
  );

  // Populate the status bar badge after activation returns — the collectors read
  // thousands of transcript files synchronously, so defer them off the activation path.
  setTimeout(refreshData, 0);

  // On first activation, nudge the user to install caveman if it is absent — the
  // dashboard can only measure savings once the plugin is producing markers/ledger.
  void promptInstallOnFirstRun(context, explicitDir);
}

const FIRST_RUN_KEY = 'cavemanDashboard.installPrompted';

/**
 * Once per machine, check whether caveman is installed and offer to install it if not.
 * Guarded by globalState so we never nag on every window reload; a manual install (or
 * dashboard Install button) still works regardless.
 */
async function promptInstallOnFirstRun(context: vscode.ExtensionContext, explicitDir?: string): Promise<void> {
  if (context.globalState.get<boolean>(FIRST_RUN_KEY)) return;
  let installed = false;
  try { installed = readInstalledCaveman(explicitDir).installed; }
  catch (error) { logError('First-run caveman install check failed', error); }
  if (installed) {
    // Already installed — remember so we don't re-check on future startups.
    await context.globalState.update(FIRST_RUN_KEY, true);
    return;
  }
  await context.globalState.update(FIRST_RUN_KEY, true);
  const pick = await vscode.window.showInformationMessage(
    'Caveman Dashboard: the caveman plugin is not installed, so no savings can be measured yet.',
    'Install caveman', 'Open dashboard',
  );
  if (pick === 'Install caveman') vscode.commands.executeCommand('cavemanDashboard.cavemanCli', 'install');
  else if (pick === 'Open dashboard') vscode.commands.executeCommand('cavemanDashboard.openDashboard');
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

/**
 * Update caveman through Claude Code's native plugin manager.
 *
 * This is the ONLY update path that refreshes ~/.claude/plugins/installed_plugins.json's
 * installPath/version — the live commit the update banner compares against. The `curl | npx`
 * installer (cavemanCli 'force') reinstalls files but never rewrites that registry, so the
 * banner would stay stuck on "update available" after using it. Routing the primary "Update
 * caveman" button here keeps the button and the banner in agreement.
 */
async function updateCavemanPlugin(): Promise<void> {
  const cmd = 'claude plugin update caveman@caveman';
  const answer = await vscode.window.showWarningMessage(
    'Update caveman to the latest version?',
    { modal: true, detail: `${cmd}\n\nUpdates the caveman plugin via Claude Code's plugin manager. A Claude Code restart is required to apply, and you may need to re-run "Check for update" afterwards to refresh this banner.` },
    'Update',
  );
  if (answer !== 'Update') return;
  const term = vscode.window.createTerminal('Caveman');
  term.show(true);
  term.sendText(cmd, true);
}

/**
 * Reload the VS Code window to apply a caveman plugin update.
 *
 * A caveman plugin update only takes effect after Claude Code restarts. From an
 * extension the closest we can do is `workbench.action.reloadWindow`, which restarts
 * the extension host (and the Claude Code IDE extension with it). A Claude Code CLI
 * session running in a terminal must still be restarted manually — the modal says so.
 * Reloading closes all editors/terminals, so confirm first.
 */
async function restartClaudeCode(): Promise<void> {
  const answer = await vscode.window.showWarningMessage(
    'Reload the VS Code window now?',
    {
      modal: true,
      detail: 'Applies a caveman plugin update by reloading this window. All editors and terminals close and reopen. A Claude Code CLI session running in a terminal must be restarted manually. Run "Check for update" afterwards to refresh the banner.',
    },
    'Reload',
  );
  if (answer !== 'Reload') return;
  await vscode.commands.executeCommand('workbench.action.reloadWindow');
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
    // Report the installed commit sha, not the plugin's package.json version — the
    // version rarely bumps, so the sha is the real "which build am I on" signal.
    vscode.window.showInformationMessage(`caveman is on the latest version (${shortSha(s.installedSha)}).`);
    return;
  }
  const pick = await vscode.window.showInformationMessage(
    `caveman update available: ${shortSha(s.installedSha)} → ${shortSha(s.latestSha)}.`,
    'Update', 'View changes',
  );
  if (pick === 'Update') vscode.commands.executeCommand('cavemanDashboard.updatePlugin');
  else if (pick === 'View changes' && s.compareUrl) vscode.env.openExternal(vscode.Uri.parse(s.compareUrl));
}

function logError(message: string, error: unknown): void {
  const details = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  outputChannel?.appendLine(`[${new Date().toISOString()}] ${message}: ${details}`);
}
