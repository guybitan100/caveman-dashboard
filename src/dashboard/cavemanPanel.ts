import * as vscode from 'vscode';
import { CavemanSavings, CombinedSavings, CopilotSavings } from '../types';
import { CavemanInstallInfo, CavemanUpdateStatus, readCavemanVersion, readInstalledCaveman } from '../collectors/updateChecker';
import { claudeDirOverride, showCost, shortSha } from '../util';

type InstallerAction = 'install' | 'uninstall';
type InstallerStatusTone = 'success' | 'warning' | 'error';

/**
 * Standalone webview for caveman savings, split by provider (Claude Code + Copilot).
 * Renders per-provider savings cards, Claude status + daily USD chart, a Copilot
 * estimate section, and installer/CLI action buttons.
 */
export class CavemanPanel {
  static currentPanel: CavemanPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly readLatestData: () => CombinedSavings;
  private data: CombinedSavings;
  private updateStatus: CavemanUpdateStatus | undefined;
  private updateStatusPending: boolean;
  private readonly version: string;
  private cavemanInstalled: boolean;
  private cavemanInstallKind: CavemanInstallInfo['installKind'];
  private cavemanVersion: string | null;
  private cavemanSha: string | null;
  private installerActionPending: InstallerAction | undefined;
  private installerStatusMessage: string | undefined;
  private installerStatusTone: InstallerStatusTone | undefined;

  static show(context: vscode.ExtensionContext, data: CombinedSavings, readLatestData: () => CombinedSavings) {
    if (CavemanPanel.currentPanel) {
      CavemanPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      CavemanPanel.currentPanel.update(data);
      return;
    }
    const panel = vscode.window.createWebviewPanel('cavemanDashboard', 'Caveman Dashboard', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    CavemanPanel.currentPanel = new CavemanPanel(panel, context, data, readLatestData);
    panel.onDidDispose(() => CavemanPanel.currentPanel = undefined, null, context.subscriptions);
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, data: CombinedSavings, readLatestData: () => CombinedSavings) {
    this.panel = panel;
    this.readLatestData = readLatestData;
    this.data = data;
    this.updateStatusPending = false;
    this.version = (context.extension.packageJSON as { version?: string })?.version ?? '';
    this.cavemanInstalled = false;
    this.cavemanInstallKind = 'none';
    this.cavemanVersion = null;
    this.cavemanSha = null;
    this.installerActionPending = undefined;
    this.installerStatusMessage = undefined;
    this.installerStatusTone = undefined;
    this.refreshInstallMetadata();
    this.panel.webview.onDidReceiveMessage(message => {
      if (message?.command === 'refresh') vscode.commands.executeCommand('cavemanDashboard.refresh');
      if (message?.command === 'checkUpdate') vscode.commands.executeCommand('cavemanDashboard.checkUpdate');
      if (message?.command === 'updatePlugin') vscode.commands.executeCommand('cavemanDashboard.updatePlugin');
      if (message?.command === 'restart') vscode.commands.executeCommand('cavemanDashboard.restart');
      if (message?.command === 'cavemanCli') vscode.commands.executeCommand('cavemanDashboard.cavemanCli', message.action);
    }, undefined, context.subscriptions);
    this.panel.onDidChangeViewState(event => {
      if (!event.webviewPanel.visible) return;
      this.update(this.readLatestData());
    }, undefined, context.subscriptions);
    this.syncInstallSnapshot();
    this.ensureUpdateStatus();
    this.render();
  }

  update(data: CombinedSavings) {
    this.data = data;
    this.refreshInstallMetadata();
    this.syncInstallSnapshot();
    this.syncUpdateStatus(this.data.claude.installed);
    this.ensureUpdateStatus();
    this.render();
  }

  setInstallerActionPending(action: InstallerAction | undefined) {
    this.installerActionPending = action;
    if (action) {
      this.installerStatusMessage = undefined;
      this.installerStatusTone = undefined;
    }
    this.render();
  }

  setInstallerStatusMessage(message: string | undefined, tone?: InstallerStatusTone) {
    this.installerStatusMessage = message;
    this.installerStatusTone = message ? (tone ?? 'success') : undefined;
    this.render();
  }

  /** True once an update check has populated the version/update status. */
  get updateKnown(): boolean {
    return this.updateStatus !== undefined;
  }

  /** Reflect the latest caveman update-check result in the dashboard banner. */
  setUpdateStatus(status: CavemanUpdateStatus) {
    this.updateStatus = status;
    this.updateStatusPending = false;
    this.render();
  }

  private refreshInstallMetadata() {
    const info = readInstalledCaveman(claudeDirOverride());
    this.cavemanInstalled = info.installed;
    this.cavemanInstallKind = info.installKind;
    this.cavemanSha = info.sha;
    this.cavemanVersion = this.cavemanInstalled ? readCavemanVersion(claudeDirOverride()) : null;
  }

  private syncInstallSnapshot() {
    if (this.data.claude.installed === this.cavemanInstalled && this.data.copilot.configured === this.cavemanInstalled) {
      return;
    }
    this.data = {
      claude: {
        ...this.data.claude,
        installed: this.cavemanInstalled,
      },
      copilot: {
        ...this.data.copilot,
        configured: this.cavemanInstalled,
      },
    };
  }

  private syncUpdateStatus(installed: boolean) {
    if (!this.updateStatus) return;
    const knownSha = this.updateStatus.installedSha ?? null;
    if (this.updateStatus.installed !== installed || knownSha !== this.cavemanSha) {
      this.updateStatus = undefined;
    }
  }

  private ensureUpdateStatus() {
    if (!this.data.claude.installed) {
      this.updateStatusPending = false;
      return;
    }
    if (this.updateStatus || this.updateStatusPending) return;
    this.updateStatusPending = true;
    void vscode.commands.executeCommand('cavemanDashboard.checkUpdateSilent').then(
      () => undefined,
      () => {
        this.updateStatusPending = false;
        this.render();
      },
    );
  }

  private render() {
    this.panel.webview.html = renderHtml(this.data, this.updateStatus, this.updateStatusPending, this.installerActionPending, this.installerStatusMessage, this.installerStatusTone, this.cavemanInstallKind, this.version, this.cavemanVersion, this.cavemanSha);
  }
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}
function money(n: number): string { return `$${Number(n || 0).toFixed(2)}`; }
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-07" -> "Jul 2026". Falls back to the raw key if it is not YYYY-MM. */
function fmtMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  return `${MONTH_NAMES[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}
/** Previous calendar month key for a "YYYY-MM" value, or '' if unparseable. */
function prevMonthKey(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return '';
  let year = Number(m[1]);
  let mo = Number(m[2]) - 1;
  if (mo < 1) { mo = 12; year -= 1; }
  return `${year}-${String(mo).padStart(2, '0')}`;
}

/** Saved tokens recorded for a given month in a per-month history series. */
function savedInMonth(rows: { month: string; savedTokens: number }[], month: string): number {
  return rows.find(r => r.month === month)?.savedTokens ?? 0;
}

/** A ▲/▼ percent chip comparing this month's savings to last month (empty when no baseline). */
function deltaChip(current: number, previous: number): string {
  if (previous <= 0) return '';
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return '<small class="cv-delta cv-flat">▬ same as last month</small>';
  const up = pct > 0;
  return `<small class="cv-delta ${up ? 'cv-up' : 'cv-down'}">${up ? '▲' : '▼'} ${Math.abs(pct)}% vs last month</small>`;
}

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}

function renderInlinePills(items: string[]): string {
  return items.map(item => `<span class="cv-inline-pill">${escapeHtml(item)}</span>`).join('');
}

function renderStatusBadge(on: boolean, text: string): string {
  return `<span class="cv-badge ${on ? 'cv-on' : 'cv-off'}">${escapeHtml(text)}</span>`;
}

function renderInstallerActionButton(installed: boolean, pendingAction: InstallerAction | undefined): string {
  const action: InstallerAction = installed ? 'uninstall' : 'install';
  const busy = pendingAction === action;
  const disabled = pendingAction !== undefined;
  const label = action === 'install'
    ? (busy ? 'Installing...' : 'Install caveman')
    : (busy ? 'Removing caveman...' : 'Remove caveman');
  const title = action === 'install'
    ? (busy ? 'Installing caveman on this machine' : 'Install caveman on this machine')
    : (busy ? 'Removing caveman integration from Claude Code on this machine' : 'Remove caveman integration from Claude Code on this machine');
  const attrs = disabled ? ' disabled aria-disabled="true" aria-busy="true"' : '';
  const classes = action === 'install' ? 'cv-chip-action cv-chip-action-primary' : 'cv-chip-action';
  const icon = action === 'install' ? 'download' : 'trash';
  return `<button class="${classes}" data-cv="${action}" title="${escapeHtml(title)}"${attrs}>${svgIcon(icon)}<span>${escapeHtml(label)}</span></button>`;
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}

// Minimal inline SVG glyphs (stroke = currentColor). CSP forbids external icon fonts.
const ICONS: Record<string, string> = {
  download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  package: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-2.8 0zM12 15l-3-3a22 22 0 0 1 8-10c3 0 5 2 5 5a22 22 0 0 1-10 8zM9 12H4l3-3h3M12 15v5l3-3v-3"/>',
  power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
};
function svgIcon(name: string): string {
  return `<svg class="cv-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
}

function bestMonth(rows: { month: string; savedTokens: number }[]): { month: string; savedTokens: number } | null {
  if (!rows.length) return null;
  return rows.reduce((best, row) => row.savedTokens > best.savedTokens ? row : best, rows[0]);
}

function trackedMonthCount(rows: { month: string; savedTokens: number }[]): number {
  return rows.filter(r => r.savedTokens > 0).length;
}

function bestDay(rows: { day: string; savedTokens: number; savedUsd: number }[]): { day: string; savedTokens: number; savedUsd: number } | null {
  if (!rows.length) return null;
  return rows.reduce((best, row) => row.savedTokens > best.savedTokens ? row : best, rows[0]);
}

function dayDiff(prev: string, next: string): number {
  const prevTime = new Date(`${prev}T00:00:00Z`).getTime();
  const nextTime = new Date(`${next}T00:00:00Z`).getTime();
  return Math.round((nextTime - prevTime) / 86_400_000);
}

function activeStreak(rows: { day: string; savedTokens: number }[]): number {
  let streak = 0;
  let expectedDay: string | null = null;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row.savedTokens <= 0) break;
    if (expectedDay && dayDiff(row.day, expectedDay) !== 1) break;
    streak += 1;
    expectedDay = row.day;
  }
  return streak;
}

/** Human label for the Claude data-source confidence, shared across views. */
function claudeConfidenceLabel(source: CavemanSavings['source']): string {
  return source === 'ledger'
    ? 'Ledger-backed'
    : source === 'mixed'
      ? 'Ledger + estimate'
      : source === 'estimated'
        ? 'Estimate-only'
        : 'No signal yet';
}

function renderOverviewLead(claude: CavemanSavings, cost: boolean): string {
  const savings = `${fmtTokens(claude.savedTokens)} saved this month.`;
  const confidence = !claude.installed
    ? 'Caveman is not installed right now.'
    : claude.source === 'ledger'
      ? 'Claude is ledger-backed.'
      : claude.source === 'mixed'
        ? 'Claude blends ledger and estimate data.'
        : claude.source === 'estimated'
          ? 'Claude is estimate-only right now.'
          : 'Claude is waiting for the first measurable signal.';
  const costView = cost ? 'USD projection is enabled for Claude.' : 'USD projection is currently hidden.';
  return `<div class="cv-page-intro">
    <div>
      <div class="cv-page-eyebrow">Executive summary</div>
      <h2 class="cv-page-title">Current month performance</h2>
      <div class="cv-page-copy">A concise read on current-month savings, signal quality, and whether Claude usage is sustaining momentum.</div>
    </div>
    <div class="cv-inline-facts">
      ${renderInlinePills([savings, confidence, costView])}
    </div>
  </div>`;
}

function renderClaudeInsights(claude: CavemanSavings, cost: boolean): string {
  const best = bestMonth(claude.byMonth);
  const day = bestDay(claude.byDay);
  const streak = activeStreak(claude.byDay);
  const confidence = claude.source === 'ledger'
    ? 'Highest confidence'
    : claude.source === 'mixed'
      ? 'Good confidence'
      : claude.source === 'estimated'
        ? 'Estimated only'
        : 'Waiting for signal';
  return `<div class="cv-insight-grid">
    <div class="cv-mini-card">
      <span class="cv-mini-label">Best month</span>
      <strong class="cv-mini-value">${best ? fmtTokens(best.savedTokens) : '—'}</strong>
      <small class="cv-mini-copy">${best ? escapeHtml(fmtMonth(best.month)) : 'No monthly history yet.'}</small>
    </div>
    <div class="cv-mini-card">
      <span class="cv-mini-label">Best day</span>
      <strong class="cv-mini-value">${day ? fmtTokens(day.savedTokens) : '—'}</strong>
      <small class="cv-mini-copy">${day ? escapeHtml(day.day) : 'No daily activity yet.'}</small>
    </div>
    <div class="cv-mini-card">
      <span class="cv-mini-label">Current streak</span>
      <strong class="cv-mini-value">${streak > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : 'No streak yet'}</strong>
      <small class="cv-mini-copy">${escapeHtml(confidence)} from the current Claude signal.</small>
    </div>
  </div>`;
}

function renderCopilotInsights(copilot: CopilotSavings): string {
  const best = bestMonth(copilot.byMonth);
  const day = bestDay(copilot.byDay);
  const streak = activeStreak(copilot.byDay);
  const avgPerTurn = copilot.turns > 0 ? Math.round(copilot.savedTokens / copilot.turns) : 0;
  return `<div class="cv-insight-grid">
    <div class="cv-mini-card">
      <span class="cv-mini-label">Best month</span>
      <strong class="cv-mini-value">${best ? fmtTokens(best.savedTokens) : '—'}</strong>
      <small class="cv-mini-copy">${best ? escapeHtml(fmtMonth(best.month)) : 'No monthly history yet.'}</small>
    </div>
    <div class="cv-mini-card">
      <span class="cv-mini-label">Best day</span>
      <strong class="cv-mini-value">${day ? fmtTokens(day.savedTokens) : '—'}</strong>
      <small class="cv-mini-copy">${day ? escapeHtml(day.day) : 'No daily activity yet.'}</small>
    </div>
    <div class="cv-mini-card">
      <span class="cv-mini-label">Saved per turn</span>
      <strong class="cv-mini-value">${copilot.turns > 0 ? fmtTokens(avgPerTurn) : '—'}</strong>
      <small class="cv-mini-copy">${streak > 0 ? `${streak} active day${streak === 1 ? '' : 's'} in the current streak.` : 'No active streak yet.'}</small>
    </div>
  </div>`;
}

function renderOverviewHighlights(claude: CavemanSavings): string {
  const totalCurrent = claude.savedTokens;
  const prev = prevMonthKey(claude.currentMonth);
  const totalPrevious = savedInMonth(claude.byMonth, prev);
  const bestClaudeDay = bestDay(claude.byDay);
  const strongestDay = bestClaudeDay ? `${fmtTokens(bestClaudeDay.savedTokens)} on ${bestClaudeDay.day.slice(5)}` : 'No active day yet';
  const streak = activeStreak(claude.byDay);
  const trend = totalPrevious > 0
    ? `${Math.abs(Math.round(((totalCurrent - totalPrevious) / totalPrevious) * 100))}% ${totalCurrent >= totalPrevious ? 'above' : 'below'} last month`
    : 'No previous-month baseline yet';
  const recommendation = !claude.installed
    ? 'Install caveman first so savings can be measured from real usage.'
    : !claude.active
      ? 'Run a Claude session with caveman enabled, then refresh this dashboard.'
      : 'Review the monthly history tab to confirm momentum is sustaining.';
  return `<div class="cv-insight-grid">
    <div class="cv-mini-card">
      <span class="cv-mini-label">Momentum</span>
      <strong class="cv-mini-value">${escapeHtml(trend)}</strong>
      <small class="cv-mini-copy">Based on current-month Claude savings.</small>
    </div>
    <div class="cv-mini-card">
      <span class="cv-mini-label">Best day</span>
      <strong class="cv-mini-value">${escapeHtml(strongestDay)}</strong>
      <small class="cv-mini-copy">Highest single-day saved-token spike across the current month.</small>
    </div>
    <div class="cv-mini-card">
      <span class="cv-mini-label">Active streak</span>
      <strong class="cv-mini-value">${streak > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : 'No streak yet'}</strong>
      <small class="cv-mini-copy">Consecutive active days ending on the latest recorded day with savings.</small>
    </div>
    <div class="cv-mini-card cv-mini-card-wide">
      <span class="cv-mini-label">Recommended next move</span>
      <strong class="cv-mini-value">${escapeHtml(recommendation)}</strong>
      <small class="cv-mini-copy">The dashboard should tell developers what to do next, not only what happened.</small>
    </div>
  </div>`;
}

function renderOverviewRail(claude: CavemanSavings, cost: boolean): string {
  const totalSaved = claude.savedTokens;
  const totalSessions = claude.sessions;
  const claudeConfidence = claudeConfidenceLabel(claude.source);
  return `<aside class="cv-signal-rail">
    <section class="cv-rail-card">
      <div class="cv-rail-eyebrow">At a glance</div>
      <h3>Signal health</h3>
      <div class="cv-rail-line"><span>Total saved this month</span><strong>${fmtTokens(totalSaved)}</strong></div>
      <div class="cv-rail-line"><span>Observed sessions</span><strong>${totalSessions}</strong></div>
      <div class="cv-rail-line"><span>Claude confidence</span><strong>${escapeHtml(claudeConfidence)}</strong></div>
      <div class="cv-rail-line"><span>USD projection</span><strong>${cost ? 'Enabled for Claude' : 'Hidden'}</strong></div>
    </section>
  </aside>`;
}

function renderOverviewTab(claude: CavemanSavings, cost: boolean): string {
  return `<div>
    ${renderOverviewLead(claude, cost)}
    ${renderTotals(claude, cost)}
    <div class="cv-overview">
      <div>
        ${renderOverviewHighlights(claude)}
      </div>
      ${renderOverviewRail(claude, cost)}
    </div>
  </div>`;
}

function renderUnifiedDashboard(claude: CavemanSavings, copilot: CopilotSavings, cost: boolean, pendingAction: InstallerAction | undefined): string {
  return `<main class="cv-story">
    <section class="cv-story-section cv-story-section-hero" id="sec-overview" aria-label="Overview">
      ${renderOverviewTab(claude, cost)}
    </section>

    <section class="cv-story-section" id="sec-claude" aria-label="Claude Code details">
      ${renderClaudeTab(claude, cost, pendingAction)}
    </section>

    <section class="cv-story-section" id="sec-history" aria-label="Monthly history details">
      ${renderHistoryTab(claude, copilot, cost)}
    </section>
  </main>`;
}

/** Minimal inline SVG line chart for a single daily series. */
function renderLineChart(
  days: string[],
  values: number[],
  fmt: (n: number) => string,
  opts: { color: string; id: string } = { color: '#51cf66', id: 'chart' },
): string {
  const w = 640, h = 200, padL = 52, padR = 16, padT = 16, padB = 28;
  const { color, id } = opts;
  const max = Math.max(...values, 0) || 1;
  const n = values.length;
  const x = (i: number) => padL + (n <= 1 ? (w - padL - padR) / 2 : (i / (n - 1)) * (w - padL - padR));
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  const base = (h - padB).toFixed(1);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `M ${x(0).toFixed(1)},${base} L ${pts.replace(/ /g, ' L ')} L ${x(n - 1).toFixed(1)},${base} Z`;
  const dots = values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="${color}" stroke="var(--vscode-editorWidget-background)" stroke-width="1.5"><title>${escapeHtml(days[i])}: ${escapeHtml(fmt(v))}</title></circle>`).join('');
  // Thin out x labels so they never overlap on dense months.
  const step = Math.ceil(n / 12);
  const xLabels = days.map((d, i) =>
    i % step === 0 || i === n - 1
      ? `<text x="${x(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" class="axis">${escapeHtml(d.slice(5))}</text>`
      : '').join('');
  const gy = y(max / 2).toFixed(1);
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Daily savings chart" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="grad-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="${color}" stop-opacity="0.02" />
    </linearGradient></defs>
    <line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" class="grid" />
    <line x1="${padL}" y1="${base}" x2="${w - padR}" y2="${base}" class="grid" />
    <text x="6" y="${padT + 4}" class="axis">${escapeHtml(fmt(max))}</text>
    <text x="6" y="${Number(gy) + 3}" class="axis">${escapeHtml(fmt(max / 2))}</text>
    <text x="6" y="${base}" class="axis">0</text>
    <path d="${area}" fill="url(#grad-${id})" stroke="none" />
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    ${dots}${xLabels}
  </svg>`;
}

/** Top row: per-provider saved totals for the current month. */
function renderTotals(claude: CavemanSavings, cost: boolean): string {
  const total = claude.savedTokens;
  const claudeUsd = cost ? `<small>${money(claude.savedUsd)} saved</small>` : '';
  const label = fmtMonth(claude.currentMonth);
  const prev = prevMonthKey(claude.currentMonth);
  const prevTotal = savedInMonth(claude.byMonth, prev);
  const trend = deltaChip(total, prevTotal);
  return `<div class="muted cv-month">This month · <b>${escapeHtml(label)}</b> <span class="cv-reset">(resets on the 1st — history kept below)</span></div>
  <div class="cards cv-totals-grid">
    <div class="card card-primary accent-green"><span>Total Saved Tokens</span><b>${fmtTokens(total)}</b>${trend || '<small>Claude Code</small>'}</div>
    <div class="card card-secondary accent-orange"><span>Claude Saved</span><b>${fmtTokens(claude.savedTokens)}</b>${claudeUsd || '<small>Claude Code</small>'}</div>
  </div>`;
}

/** Monthly history table, newest month first. Current month is tagged and dimmed-in. */
function renderMonthlyHistory(
  rows: { month: string; savedTokens: number; savedUsd?: number; sessions: number }[],
  currentMonth: string,
  cost: boolean,
): string {
  if (rows.length <= 1) return '';
  const usdHead = cost ? '<th class="num">Saved (USD)</th>' : '';
  const body = [...rows]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map(r => {
      const usd = cost ? `<td class="num">${r.savedUsd != null ? money(r.savedUsd) : '—'}</td>` : '';
      const cur = r.month === currentMonth ? ' <span class="cv-cur">current</span>' : '';
      return `<tr${r.month === currentMonth ? ' class="cv-cur-row"' : ''}>
        <td>${escapeHtml(fmtMonth(r.month))}${cur}</td>
        <td class="num">${fmtTokens(r.savedTokens)}</td>${usd}
        <td class="num">${r.sessions}</td>
      </tr>`;
    })
    .join('');
  return `<div class="cv-history">
    <table class="cv-table">
      <thead><tr><th>Month</th><th class="num">Saved tokens</th>${usdHead}<th class="num">Sessions</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

/** Monthly history tab: each provider's month-by-month table, side by side. */
function renderHistoryTab(claude: CavemanSavings, copilot: CopilotSavings, cost: boolean): string {
  const claudeHistory = renderMonthlyHistory(claude.byMonth, claude.currentMonth, cost);
  const copilotHistory = renderMonthlyHistory(copilot.byMonth, copilot.currentMonth, false);
  const claudeBest = bestMonth(claude.byMonth);
  const copilotBest = bestMonth(copilot.byMonth);
  const claudeBestDay = bestDay(claude.byDay);
  const copilotBestDay = bestDay(copilot.byDay);
  const totalTrackedMonths = Math.max(trackedMonthCount(claude.byMonth), trackedMonthCount(copilot.byMonth));
  const leader = (claudeBest?.savedTokens ?? 0) >= (copilotBest?.savedTokens ?? 0)
    ? `Claude peak: ${claudeBest ? `${fmtTokens(claudeBest.savedTokens)} in ${fmtMonth(claudeBest.month)}` : 'No peak yet'}`
    : `Copilot peak: ${copilotBest ? `${fmtTokens(copilotBest.savedTokens)} in ${fmtMonth(copilotBest.month)}` : 'No peak yet'}`;
  if (!claudeHistory && !copilotHistory) {
    return `<div class="cv-panel"><div class="muted cv-empty">No monthly history yet — a month-by-month breakdown appears once caveman has usage spanning more than one calendar month.</div></div>`;
  }
  const block = (header: string, insights: string, table: string) =>
    table ? `<section class="cv-provider">${header}${insights}${table}</section>` : '';
  return `<div>
    <div class="cv-page-intro">
      <div>
        <div class="cv-page-eyebrow">History</div>
        <h2 class="cv-page-title">Monthly adoption and savings</h2>
        <div class="cv-page-copy">Use the long view to see whether caveman usage is growing, flattening, or shifting between Claude and Copilot workflows.</div>
      </div>
      <div class="cv-inline-facts">
        ${renderInlinePills([`${totalTrackedMonths} tracked months`, leader])}
      </div>
    </div>
    <div class="cards cv-summary-cards">
      <div class="card accent-green"><span>Claude best month</span><b>${claudeBest ? fmtTokens(claudeBest.savedTokens) : '—'}</b><small>${claudeBest ? escapeHtml(fmtMonth(claudeBest.month)) : 'No historical data yet'}</small></div>
      <div class="card accent-purple"><span>Copilot best month</span><b>${copilotBest ? fmtTokens(copilotBest.savedTokens) : '—'}</b><small>${copilotBest ? escapeHtml(fmtMonth(copilotBest.month)) : 'No historical data yet'}</small></div>
      <div class="card accent-blue"><span>Tracked calendar months</span><b>${totalTrackedMonths}</b><small>Months with non-zero recorded savings</small></div>
      <div class="card accent-orange"><span>Claude best day</span><b>${claudeBestDay ? fmtTokens(claudeBestDay.savedTokens) : '—'}</b><small>${claudeBestDay ? escapeHtml(claudeBestDay.day) : 'No daily history yet'}</small></div>
      <div class="card accent-purple"><span>Copilot best day</span><b>${copilotBestDay ? fmtTokens(copilotBestDay.savedTokens) : '—'}</b><small>${copilotBestDay ? escapeHtml(copilotBestDay.day) : 'No daily history yet'}</small></div>
      <div class="card accent-green"><span>Longest active streak</span><b>${Math.max(activeStreak(claude.byDay), activeStreak(copilot.byDay))}</b><small>Current consecutive active days across both providers</small></div>
    </div>
    <div class="provider-grid">
    ${block(renderProviderHeader('Claude Code', 'Saved output tokens by month.', 'layers'), renderClaudeInsights(claude, cost), claudeHistory)}
    ${block(renderProviderHeader('GitHub Copilot', 'Estimated saved tokens by month.', 'package'), renderCopilotInsights(copilot), copilotHistory)}
    </div>
  </div>`;
}

function renderClaudeStatus(c: CavemanSavings): string {
  const modeLabel = !c.installed
    ? 'Mode unavailable'
    : c.activeMode
      ? `Active: ${c.activeMode}`
      : 'Mode not enabled';
  return `<div class="cv-status">
    ${renderStatusBadge(c.installed, c.installed ? 'Installed' : 'Not installed')}
    ${renderStatusBadge(!!c.activeMode, modeLabel)}
    ${renderStatusBadge(c.active, c.active ? `${c.sessions} session${c.sessions === 1 ? '' : 's'} detected` : 'No usage detected')}
  </div>`;
}

function renderClaude(c: CavemanSavings, cost: boolean, pendingAction: InstallerAction | undefined): string {
  if (!c.active) {
    const installBtn = !c.installed
      ? renderInstallerActionButton(false, pendingAction)
      : '';
    const hint = pendingAction === 'install'
      ? 'Installing caveman. Status changes after the installer command completes successfully.'
      : pendingAction === 'uninstall'
        ? 'Removing caveman from Claude Code. Status changes after the uninstall command completes.'
        : !c.installed
          ? 'caveman is not installed. Install it, then run a Claude session with caveman on and Refresh.'
          : !c.activeMode
            ? 'caveman is installed but the mode flag is off. Run <code>/caveman full</code> in a Claude session, then Refresh.'
            : 'caveman is active but no session usage detected yet. Run a Claude session, then Refresh.';
    return `${renderClaudeStatus(c)}
      <div class="cv-empty-cta">
        <div class="muted cv-empty">${hint}</div>
        ${installBtn ? `<div class="cv-panel-actions">${installBtn}</div>` : ''}
      </div>`;
  }
  const srcLabel = c.source === 'ledger' ? 'from caveman ledger' : c.source === 'mixed' ? 'ledger + estimate' : 'estimated';
  const days = c.byDay.map(d => d.day);
  const chart = !cost
    ? ''
    : days.length >= 2
      ? `<div class="cv-chart"><h3>Daily savings this month (USD)</h3><div class="muted">Estimated output-token value saved per day.</div>${renderLineChart(days, c.byDay.map(d => d.savedUsd), money, { color: '#51cf66', id: 'claude' })}</div>`
      : days.length === 1
        ? `<div class="muted cv-note">Daily savings trend appears after 2+ days — <b>${money(c.byDay[0].savedUsd)}</b> saved so far on ${escapeHtml(c.byDay[0].day.slice(5))}.</div>`
        : '';
  return `${renderClaudeStatus(c)}
    <div class="cards">
      ${cost ? `<div class="card accent-green"><span>Saved (USD)</span><b>${money(c.savedUsd)}</b><small>${srcLabel}</small></div>` : ''}
      <div class="card accent-purple"><span>Saved Output Tokens</span><b>${fmtTokens(c.savedTokens)}</b></div>
      <div class="card accent-blue"><span>Sessions</span><b>${c.sessions}</b></div>
    </div>
    ${chart}`;
}

function renderHeaderHero(data: CombinedSavings, updateStatus: CavemanUpdateStatus | undefined, updateStatusPending: boolean, pendingAction: InstallerAction | undefined, installerStatusMessage: string | undefined, installerStatusTone: InstallerStatusTone | undefined, installKind: CavemanInstallInfo['installKind']): string {
  const { claude, copilot } = data;
  const totalSessions = claude.sessions + copilot.sessions;
  const month = fmtMonth(claude.currentMonth);
  const totalSaved = fmtTokens(claude.savedTokens + copilot.savedTokens);
  const confidence = claudeConfidenceLabel(claude.source);
  const updateLabel = pendingAction === 'install'
    ? 'Installing caveman...'
    : pendingAction === 'uninstall'
      ? 'Removing caveman...'
      : !updateStatus
        ? (!claude.installed ? 'caveman not installed' : updateStatusPending ? 'Checking updates...' : 'Update status unknown')
        : updateStatus.error
          ? 'Update check failed'
          : !updateStatus.installed
            ? 'caveman not installed'
            : !updateStatus.installedSha
              ? 'Hooks active'
            : updateStatus.updateAvailable
              ? 'Update available'
              : 'Up to date';
  const modeLabel = claude.activeMode ? `Claude mode: ${claude.activeMode}` : 'Claude mode inactive';
  const installLabel = installKind === 'hooks'
    ? 'Hooks active'
    : installKind === 'mixed'
      ? 'Plugin + hooks active'
      : claude.installed
        ? 'Installed locally'
        : 'Needs install';
  const installStateCopy = installKind === 'hooks'
    ? 'caveman is installed through Claude hooks and is ready to track sessions.'
    : installKind === 'mixed'
      ? 'Claude plugin and standalone hooks are both present.'
      : claude.installed
        ? 'Plugin footprint detected in Claude.'
        : 'Install caveman to begin measuring real sessions.';
  const primaryAction = renderInstallerActionButton(claude.installed, pendingAction);
  const alertTone = installerStatusTone ?? 'success';
  return `<section class="cv-hero-shell">
    <div class="cv-hero-topline">
      <div class="cv-kicker">Developer telemetry for caveman compression</div>
    </div>
    <div class="cv-hero-main">
      <div class="cv-hero-grid">
        <div class="cv-hero-copy-block">
          <h1>Caveman Dashboard</h1>
          <div class="cv-hero-copy">Track measured Claude savings, compare them with projected Copilot impact, and keep install, mode, and update actions directly in the operating path.</div>
          <div class="cv-hero-stat-row" role="list" aria-label="Hero status">
            <span class="cv-chip cv-chip-good" role="listitem">${escapeHtml(month)}</span>
            <span class="cv-chip" role="listitem">${totalSaved} saved tokens this month</span>
            <span class="cv-chip" role="listitem">${escapeHtml(modeLabel)}</span>
            <span class="cv-chip" role="listitem">${totalSessions} total sessions observed</span>
            <span class="cv-chip" role="listitem">${escapeHtml(installLabel)}</span>
            <span class="cv-chip" role="listitem">${escapeHtml(updateLabel)}</span>
          </div>
        </div>
        <div class="cv-hero-actions-card" aria-label="Hero actions">
          <span class="cv-hero-actions-kicker">Operate</span>
          <strong class="cv-hero-actions-title">Machine control</strong>
          <span class="cv-hero-actions-copy">Update checks and dashboard refresh stay close to the live status.</span>
          <div class="cv-hero-actions">
            ${primaryAction}
            <button class="cv-chip-action" data-command="checkUpdate">${svgIcon('refresh')}<span>Check update</span></button>
            <button class="cv-chip-action" data-command="refresh">${svgIcon('download')}<span>Refresh dashboard</span></button>
          </div>
        </div>
      </div>
      ${installerStatusMessage ? `<div class="cv-hero-alert cv-hero-alert-${alertTone}" role="status">${escapeHtml(installerStatusMessage)}</div>` : ''}
      <div class="cv-hero-summary" aria-label="Hero summary metrics">
        <div class="cv-hero-summary-head">
          <span class="cv-hero-summary-kicker">Operational summary</span>
          <strong class="cv-hero-summary-title">${escapeHtml(installLabel)} · ${escapeHtml(confidence)} · ${totalSessions} observed session${totalSessions === 1 ? '' : 's'}</strong>
        </div>
        <div class="cv-hero-summary-grid" role="list">
          <div class="cv-hero-summary-item" role="listitem">
            <span class="cv-hero-summary-label">Install state</span>
            <span class="cv-hero-summary-copy">${escapeHtml(installStateCopy)}</span>
          </div>
          <div class="cv-hero-summary-item" role="listitem">
            <span class="cv-hero-summary-label">Claude confidence</span>
            <span class="cv-hero-summary-copy">${claude.source === 'ledger' ? 'Numbers are ledger-backed.' : claude.source === 'mixed' ? 'Live view blends ledger and estimation.' : claude.source === 'estimated' ? 'Current results are estimate-only.' : 'Waiting for the first measurable signal.'}</span>
          </div>
          <div class="cv-hero-summary-item" role="listitem">
            <span class="cv-hero-summary-label">Observed sessions</span>
            <span class="cv-hero-summary-copy">${claude.sessions} Claude sessions and ${copilot.sessions} Copilot sessions in the current month.</span>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderClaudeTab(claude: CavemanSavings, cost: boolean, pendingAction: InstallerAction | undefined): string {
  const confidence = claudeConfidenceLabel(claude.source);
  const usdState = cost ? 'USD view on' : 'USD view off';
  const mode = claude.activeMode ? `Mode ${claude.activeMode}` : 'Mode inactive';
  return `<div>
    <div class="cv-page-intro">
      <div>
        <div class="cv-page-eyebrow">Claude Code</div>
        <h2 class="cv-page-title">Measured caveman savings</h2>
        <div class="cv-page-copy">This view is dedicated to Claude Code usage, with caveman session detection, measured saved tokens, and optional USD estimates from the local ledger.</div>
      </div>
      <div class="cv-inline-facts">
        ${renderInlinePills([confidence, mode, usdState])}
      </div>
    </div>
    <section class="cv-provider">
      ${renderProviderHeader('Claude Code', 'Measured from caveman activity and local ledger history.', 'layers')}
      ${renderClaude(claude, cost, pendingAction)}
    </section>
  </div>`;
}

function renderProviderHeader(title: string, subtitle: string, icon: string): string {
  return `<div class="cv-provider-head">
    <div class="cv-provider-mark">${svgIcon(icon)}</div>
    <div>
      <h2>${escapeHtml(title)}</h2>
      <div class="muted cv-provider-sub">${escapeHtml(subtitle)}</div>
    </div>
  </div>`;
}

// Upstream caveman plugin — linked from the footer badge.
const CAVEMAN_REPO = 'https://github.com/JuliusBrussee/caveman';

/** Bottom badge (ClaudeLens-style): gradient extension version + pill link to the original caveman repo (with its version + installed commit). */
function renderVersionFooter(version: string, cavemanVersion: string | null, cavemanSha: string | null): string {
  const ver = version ? ` v${escapeHtml(version)}` : '';
  const cav = cavemanVersion ? `caveman v${escapeHtml(cavemanVersion)} ↗` : 'caveman original repo ↗';
  // Commit sha is the real "version" signal — the plugin's package.json version rarely bumps,
  // so surface the installed commit here to make updates visible at a glance.
  const sha = cavemanSha
    ? `<span class="cv-version-sep">·</span><code class="cv-version-sha" title="installed caveman commit">${escapeHtml(shortSha(cavemanSha))}</code>`
    : '';
  return `<footer class="cv-version">
    <span class="cv-version-brand">Caveman Dashboard${ver}</span>
    <span class="cv-version-sep">·</span>
    <a class="cv-version-pill" href="${CAVEMAN_REPO}">${cav}</a>
    ${sha}
    <span class="cv-version-sep">·</span>
    <span class="cv-version-beta">BETA</span>
  </footer>`;
}

function renderHtml(data: CombinedSavings, updateStatus: CavemanUpdateStatus | undefined, updateStatusPending: boolean, pendingAction: InstallerAction | undefined, installerStatusMessage: string | undefined, installerStatusTone: InstallerStatusTone | undefined, installKind: CavemanInstallInfo['installKind'], version: string, cavemanVersion: string | null, cavemanSha: string | null): string {
  const nonce = getNonce();
  const cost = showCost();
  const { claude, copilot } = data;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Caveman Dashboard</title>
<style>
  :root {
    color-scheme: light dark;
    --cv-surface-1: color-mix(in srgb, var(--vscode-editorWidget-background) 94%, transparent);
    --cv-surface-2: color-mix(in srgb, var(--vscode-editorWidget-background) 100%, black 4%);
    --cv-surface-3: color-mix(in srgb, var(--vscode-editor-background) 60%, transparent);
    --cv-border-soft: color-mix(in srgb, var(--vscode-panel-border) 82%, transparent);
    --cv-border-strong: color-mix(in srgb, var(--vscode-focusBorder) 45%, var(--vscode-panel-border));
    --cv-shadow-lg: 0 20px 48px rgba(0,0,0,0.18);
    --cv-shadow-md: 0 12px 28px rgba(0,0,0,0.14);
    --cv-shadow-sm: 0 8px 18px rgba(0,0,0,0.1);
    --cv-accent-cyan: #8ecae6;
    --cv-accent-blue: #4dabf7;
    --cv-accent-green: #51cf66;
    --cv-accent-amber: #ffa94d;
    --cv-accent-red: #ff6b6b;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    position: relative;
    overflow-x: hidden;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    padding: 18px 20px 32px;
    background:
      radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--cv-accent-blue) 18%, transparent), transparent 28%),
      radial-gradient(circle at 100% 10%, color-mix(in srgb, var(--cv-accent-amber) 14%, transparent), transparent 24%),
      linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent), transparent 260px),
      var(--vscode-editor-background);
  }
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(transparent 31px, color-mix(in srgb, var(--vscode-panel-border) 18%, transparent) 32px),
      linear-gradient(90deg, transparent 31px, color-mix(in srgb, var(--vscode-panel-border) 14%, transparent) 32px);
    background-size: 32px 32px;
    mask-image: linear-gradient(180deg, rgba(0,0,0,0.18), transparent 75%);
    opacity: 0.18;
  }
  .cv-shell { position: relative; max-width: 1260px; margin: 0 auto; opacity: 0; transform: translateY(8px); transition: opacity 220ms ease, transform 260ms cubic-bezier(.2,.8,.2,1); }
  body.cv-ready .cv-shell { opacity: 1; transform: translateY(0); }
  h1 { font-family: "SF Pro Display", "Segoe UI Variable Display", var(--vscode-font-family); font-size: clamp(2rem, 4vw, 2.8rem); margin: 0 0 10px; line-height: 0.98; letter-spacing: -0.035em; max-width: 12ch; }
  h2 { font-size: 1.08rem; margin: 22px 0 8px; border-bottom: 1px solid var(--cv-border-soft); padding-bottom: 4px; }
  h3 { font-size: 0.95rem; margin: 12px 0 4px; }
  .muted { color: var(--vscode-descriptionForeground); font-size: 0.85rem; }
  em { font-style: normal; opacity: 0.7; font-size: 0.85em; }
  a { color: var(--vscode-textLink-foreground); }
  code { background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 6px; }
  .cv-page-intro { display: flex; justify-content: space-between; gap: 22px; align-items: end; margin: 6px 0 20px; }
  .cv-page-intro-tight { margin-top: 4px; }
  .cv-page-eyebrow { color: var(--cv-accent-cyan); text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.72rem; font-weight: 800; margin-bottom: 8px; }
  .cv-page-title { margin: 0; font-size: 1.22rem; border-bottom: none; padding-bottom: 0; letter-spacing: -0.02em; }
  .cv-page-copy { margin-top: 7px; max-width: 72ch; color: var(--vscode-descriptionForeground); line-height: 1.6; font-size: 0.92rem; }
  .cv-inline-facts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
  .cv-inline-facts-start { justify-content: flex-start; }
  .cv-inline-facts-soft { margin-top: 12px; }
  .cv-inline-pill, .cv-credit-badge, .cv-model-pill { display: inline-flex; align-items: center; min-height: 30px; padding: 4px 11px; border-radius: 999px; background: color-mix(in srgb, var(--cv-surface-3) 92%, transparent); border: 1px solid var(--cv-border-soft); color: var(--vscode-descriptionForeground); font-size: 0.77rem; font-weight: 700; }
  .cv-credit-card { margin: 0 0 16px; padding: 18px 20px; border: 1px solid var(--cv-border-soft); border-radius: 18px; background: linear-gradient(180deg, color-mix(in srgb, var(--cv-surface-1) 96%, transparent), var(--cv-surface-2)); box-shadow: var(--cv-shadow-sm); }
  .cv-credit-head { display: flex; justify-content: space-between; align-items: start; gap: 12px; margin-bottom: 14px; }
  .cv-credit-title { font-size: 1.02rem; font-weight: 700; }
  .cv-credit-sub { margin-top: 4px; max-width: 64ch; color: var(--vscode-descriptionForeground); font-size: 0.82rem; line-height: 1.45; }
  .cv-credit-body { display: grid; gap: 10px; }
  .cv-credit-value { font-size: 1.7rem; line-height: 1.04; letter-spacing: -0.03em; font-weight: 700; }
  .cv-credit-summary { color: var(--vscode-descriptionForeground); font-size: 0.86rem; line-height: 1.55; max-width: 62ch; }
  .cv-credit-meter { height: 8px; border-radius: 999px; background: rgba(128,128,128,0.12); overflow: hidden; }
  .cv-credit-meter span { display: block; width: 0%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--cv-accent-blue), #74c0fc); }
  .cv-credit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .cv-credit-stat { padding: 12px 13px; border-radius: 14px; border: 1px solid var(--cv-border-soft); background: rgba(128,128,128,0.04); display: grid; gap: 4px; }
  .cv-credit-label { color: var(--vscode-descriptionForeground); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
  .cv-credit-strong { color: var(--vscode-foreground); font-size: 0.9rem; }
  .cv-credit-meta { display: flex; justify-content: space-between; gap: 12px; color: var(--vscode-descriptionForeground); font-size: 0.8rem; }
  .cv-credit-note { line-height: 1.5; }
  .cv-insight-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin: 0 0 18px; }
  .cv-mini-card { position: relative; overflow: hidden; grid-column: span 2; padding: 16px 16px 15px; border-radius: 16px; border: 1px solid var(--cv-border-soft); background: linear-gradient(180deg, var(--cv-surface-1), var(--cv-surface-2)); box-shadow: var(--cv-shadow-sm); display: flex; flex-direction: column; gap: 7px; }
  .cv-mini-card::after { content: ''; position: absolute; inset: auto 0 0 0; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--cv-accent-blue) 55%, transparent), transparent); }
  .cv-mini-card-wide { grid-column: 1 / -1; padding: 18px 18px 17px; background: linear-gradient(135deg, color-mix(in srgb, var(--cv-surface-3) 96%, transparent), var(--cv-surface-2)); }
  .cv-mini-label { color: var(--cv-accent-cyan); text-transform: uppercase; letter-spacing: 0.09em; font-size: 0.71rem; font-weight: 800; }
  .cv-mini-value { font-size: 1rem; line-height: 1.35; letter-spacing: -0.01em; }
  .cv-mini-copy { color: var(--vscode-descriptionForeground); font-size: 0.76rem; line-height: 1.5; }
  .cv-mini-card-wide .cv-mini-value { font-size: 1.12rem; max-width: 34ch; }
  .cv-mini-card-wide .cv-mini-copy { max-width: 56ch; }
  .cv-share-bar { width: 100%; height: 8px; border-radius: 999px; background: rgba(128,128,128,0.14); overflow: hidden; margin-top: 2px; }
  .cv-share-bar span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--cv-accent-green), var(--cv-accent-blue)); }
  .toolbar { display: flex; gap: 8px; margin: 0; }
  .cv-hero-shell { position: relative; display: grid; gap: 20px; align-items: start; padding: 28px 28px 24px; border: 1px solid var(--cv-border-soft); border-radius: 24px; background: linear-gradient(135deg, var(--cv-surface-1), var(--cv-surface-2)); box-shadow: var(--cv-shadow-lg); overflow: hidden; }
  .cv-hero-shell::before { content: ''; position: absolute; inset: -10% auto auto 55%; width: 380px; height: 380px; border-radius: 999px; background: radial-gradient(circle, color-mix(in srgb, var(--cv-accent-blue) 18%, transparent), transparent 68%); pointer-events: none; }
  .cv-hero-shell::after { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit; border: 1px solid color-mix(in srgb, white 5%, transparent); mask-image: linear-gradient(160deg, rgba(0,0,0,0.7), transparent 55%); }
  .cv-kicker { color: var(--cv-accent-amber); text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.72rem; font-weight: 800; margin-bottom: 10px; }
  .cv-hero-topline { position: relative; z-index: 1; display: flex; justify-content: flex-start; align-items: flex-start; gap: 16px; }
  .cv-hero-main { position: relative; z-index: 1; display: grid; gap: 18px; }
  .cv-hero-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(300px, 0.95fr); gap: 18px; align-items: stretch; }
  .cv-hero-copy-block { display: grid; gap: 18px; align-content: end; }
  .cv-hero-copy { max-width: 60ch; color: var(--vscode-descriptionForeground); line-height: 1.68; font-size: 0.97rem; }
  .cv-hero-stat-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; max-width: 100%; }
  .cv-hero-actions-card { display: grid; gap: 10px; align-content: start; padding: 18px; border-radius: 20px; border: 1px solid color-mix(in srgb, var(--cv-accent-blue) 18%, var(--cv-border-soft)); background: linear-gradient(180deg, color-mix(in srgb, var(--cv-surface-3) 90%, transparent), color-mix(in srgb, var(--cv-surface-2) 96%, transparent)); box-shadow: inset 0 1px 0 color-mix(in srgb, white 8%, transparent); }
  .cv-hero-actions-kicker { color: var(--cv-accent-cyan); text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.68rem; font-weight: 800; }
  .cv-hero-actions-title { font-size: 1rem; line-height: 1.2; letter-spacing: -0.015em; }
  .cv-hero-actions-copy { color: var(--vscode-descriptionForeground); font-size: 0.8rem; line-height: 1.55; }
  .cv-hero-alert { margin-top: 2px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--cv-border-soft); font-size: 0.83rem; line-height: 1.55; }
  .cv-hero-alert-success { background: color-mix(in srgb, var(--cv-accent-green) 16%, transparent); border-color: color-mix(in srgb, var(--cv-accent-green) 42%, transparent); color: #b2f2bb; }
  .cv-hero-alert-warning { background: color-mix(in srgb, var(--cv-accent-amber) 16%, transparent); border-color: color-mix(in srgb, var(--cv-accent-amber) 42%, transparent); color: #ffd8a8; }
  .cv-hero-alert-error { background: color-mix(in srgb, var(--cv-accent-red) 14%, transparent); border-color: color-mix(in srgb, var(--cv-accent-red) 40%, transparent); color: #ffc9c9; }
  .cv-hero-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .cv-chip { display: inline-flex; align-items: center; min-height: 34px; padding: 6px 12px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--cv-border-soft) 92%, transparent); background: color-mix(in srgb, var(--vscode-editor-background) 52%, transparent); color: var(--vscode-descriptionForeground); font-size: 0.77rem; font-weight: 700; backdrop-filter: blur(10px); }
  .cv-chip-good { color: #b2f2bb; border-color: #51cf6655; background: #51cf6618; }
  .cv-chip-action { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--cv-border-soft); background: color-mix(in srgb, var(--vscode-editor-background) 48%, transparent); color: var(--vscode-foreground); font-size: 0.77rem; font-weight: 800; line-height: 1; box-shadow: none; }
  .cv-chip-action .cv-ico { width: 14px; height: 14px; }
  .cv-chip-action:hover { border-color: var(--cv-border-strong); background: color-mix(in srgb, var(--cv-surface-3) 96%, transparent); transform: translateY(-1px); }
  .cv-chip-action:disabled, .cv-chip-action:disabled:hover { cursor: not-allowed; opacity: 0.62; transform: none; box-shadow: none; border-color: var(--cv-border-soft); background: color-mix(in srgb, var(--vscode-editor-background) 58%, transparent); }
  .cv-chip-action-primary { background: linear-gradient(135deg, #79c9ff, #4dabf7); border-color: #8dd3ff; color: #08203a; box-shadow: 0 14px 28px rgba(77,171,247,0.22); }
  .cv-chip-action-primary:hover { background: linear-gradient(135deg, #7cc7ff, #5eb6ff); border-color: #a5d8ff; }
  .cv-chip-action-primary:disabled, .cv-chip-action-primary:disabled:hover { background: linear-gradient(135deg, #5eb6ff, #4dabf7); border-color: #74c0fc; color: #08203a; opacity: 0.9; }
  .cv-hero-summary { margin-top: 20px; padding: 17px 18px; border-radius: 18px; border: 1px solid color-mix(in srgb, var(--cv-accent-blue) 18%, var(--cv-border-soft)); background: linear-gradient(180deg, color-mix(in srgb, var(--cv-surface-3) 94%, transparent), transparent); box-shadow: inset 0 1px 0 color-mix(in srgb, white 8%, transparent); }
  .cv-hero-summary-head { display: grid; gap: 6px; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent); }
  .cv-hero-summary-kicker { color: var(--cv-accent-cyan); text-transform: uppercase; letter-spacing: 0.09em; font-size: 0.69rem; font-weight: 800; }
  .cv-hero-summary-title { font-size: 1.02rem; line-height: 1.35; letter-spacing: -0.015em; }
  .cv-hero-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .cv-hero-summary-item { display: grid; gap: 6px; }
  .cv-hero-summary-label { color: var(--cv-accent-cyan); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.68rem; font-weight: 800; }
  .cv-hero-summary-copy { color: var(--vscode-descriptionForeground); font-size: 0.78rem; line-height: 1.5; }
  .cv-hero-actions { position: relative; z-index: 1; display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-start; align-items: center; margin-top: 2px; }
  .cv-cta { min-height: 42px; display: inline-flex; align-items: center; gap: 8px; padding: 9px 15px; border-radius: 12px; font-weight: 800; }
  .cv-cta .cv-ico { width: 15px; height: 15px; }
  .cv-cta-danger { border-color: #e0384555; color: var(--cv-accent-red); }
  .cv-cta-danger:hover { background: #e0384518; border-color: var(--cv-accent-red); color: var(--cv-accent-red); }
  .cv-story { display: grid; gap: 26px; margin-top: 24px; }
  .cv-story-section { position: relative; padding: 26px; border: 1px solid var(--cv-border-soft); border-radius: 22px; background: linear-gradient(180deg, var(--cv-surface-1), var(--cv-surface-2)); box-shadow: var(--cv-shadow-md); }
  .cv-story-section::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--vscode-focusBorder) 55%, transparent), transparent); }
  .cv-story-section-hero { padding-top: 26px; }
  .cv-hidden { display: none; }
  button { font-family: inherit; font-size: 0.85rem; padding: 5px 12px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 6px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button:active { transform: translateY(1px) scale(0.995); }
  button:focus-visible, a:focus-visible { outline: 2px solid var(--cv-accent-blue); outline-offset: 2px; }
  .cv-status { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 14px; }
  .cv-badge { font-size: 0.78rem; padding: 5px 10px; border-radius: 999px; border: 1px solid transparent; font-weight: 700; }
  .cv-on { background: #51cf6622; border-color: #51cf6655; color: var(--cv-accent-green); }
  .cv-off { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .cv-overview { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 24px; align-items: start; margin-top: 10px; }
  .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 12px 0 16px; }
  .cv-summary-cards { margin-top: 0; margin-bottom: 16px; }
  .card { min-width: 0; padding: 16px 16px 15px; border-radius: 16px; border: 1px solid var(--cv-border-soft); border-left: 4px solid var(--vscode-panel-border); background: linear-gradient(180deg, color-mix(in srgb, var(--cv-surface-1) 96%, transparent), var(--cv-surface-2)); box-shadow: var(--cv-shadow-sm); display: flex; flex-direction: column; gap: 6px; transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease; }
  .card:hover { box-shadow: var(--cv-shadow-md); transform: translateY(-3px); border-color: var(--cv-border-strong); }
  .card span { font-size: 0.77rem; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
  .card b { font-size: clamp(1.6rem, 3vw, 2rem); font-variant-numeric: tabular-nums; line-height: 1.02; letter-spacing: -0.03em; }
  .card small { font-size: 0.73rem; color: var(--vscode-descriptionForeground); line-height: 1.45; }
  .cv-totals-grid { grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.8fr); }
  .card-primary { padding: 18px 18px 17px; }
  .card-primary b { font-size: clamp(2.2rem, 5vw, 3rem); }
  .card-secondary { justify-content: center; }
  .accent-green { border-left-color: var(--cv-accent-green); }
  .accent-purple { border-left-color: #b197fc; }
  .accent-blue { border-left-color: var(--cv-accent-blue); }
  .accent-orange { border-left-color: var(--cv-accent-amber); }
  .cv-delta { font-weight: 600; }
  .cv-up { color: var(--cv-accent-green); }
  .cv-down { color: var(--cv-accent-amber); }
  .cv-flat { color: var(--vscode-descriptionForeground); }
  .cv-note, .cv-empty { padding: 14px 15px; background: color-mix(in srgb, var(--cv-surface-3) 95%, transparent); border: 1px solid var(--cv-border-soft); border-radius: 12px; }
  .cv-empty-cta { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .cv-empty-cta .cv-panel-actions { margin-top: 2px; }
  .provider-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; margin-top: 10px; }
  .cv-provider { padding: 20px 20px 22px; border: 1px solid var(--cv-border-soft); border-radius: 20px; background: linear-gradient(180deg, color-mix(in srgb, var(--cv-surface-1) 96%, transparent), var(--cv-surface-2)); min-width: 0; box-shadow: var(--cv-shadow-sm); }
  .cv-provider h2 { margin: 0; border-bottom: none; padding-bottom: 0; }
  .cv-provider-head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
  .cv-provider-mark { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 14px; background: color-mix(in srgb, var(--cv-accent-blue) 18%, transparent); color: var(--vscode-textLink-foreground); box-shadow: inset 0 1px 0 color-mix(in srgb, white 8%, transparent); }
  .cv-provider-mark .cv-ico { width: 20px; height: 20px; }
  .cv-provider-sub { margin-top: 3px; line-height: 1.5; }
  .cv-provider .cards { flex-direction: row; flex-wrap: wrap; }
  .cv-provider .card { flex: 1 1 160px; }
  .cv-models-block { margin: 4px 0 12px; }
  .cv-models-label { margin-bottom: 8px; color: var(--vscode-descriptionForeground); font-size: 0.78rem; font-weight: 600; }
  .cv-model-cloud { display: flex; flex-wrap: wrap; gap: 8px; }
  .cv-model-pill-muted { color: var(--vscode-descriptionForeground); }
  .chart { width: 100%; max-width: 640px; height: auto; }
  .axis { fill: var(--vscode-descriptionForeground); font-size: 10px; }
  .grid { stroke: var(--vscode-panel-border); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.6; }
  .cv-ico { display: block; }
  .cv-signal-rail { position: sticky; top: 18px; display: grid; gap: 14px; }
  .cv-rail-card { padding: 18px; border: 1px solid var(--cv-border-soft); border-radius: 18px; background: linear-gradient(180deg, color-mix(in srgb, var(--cv-surface-1) 96%, transparent), var(--cv-surface-2)); box-shadow: var(--cv-shadow-sm); }
  .cv-rail-eyebrow { text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.69rem; font-weight: 800; color: var(--cv-accent-cyan); margin-bottom: 8px; }
  .cv-rail-card h3 { margin: 0 0 12px; font-size: 1rem; }
  .cv-rail-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 14px; padding: 11px 0; border-top: 1px solid color-mix(in srgb, var(--vscode-panel-border) 75%, transparent); font-size: 0.83rem; line-height: 1.5; }
  .cv-rail-line:first-of-type { border-top: none; padding-top: 0; }
  .cv-rail-line span { color: var(--vscode-descriptionForeground); }
  .cv-rail-line strong { text-align: right; font-size: 0.86rem; letter-spacing: -0.01em; }
  .cv-panel { margin-top: 18px; padding: 20px; border: 1px solid var(--cv-border-soft); border-radius: 18px; background: linear-gradient(180deg, color-mix(in srgb, var(--cv-surface-1) 96%, transparent), var(--cv-surface-2)); box-shadow: var(--cv-shadow-sm); }
  .cv-installer { border-left: 3px solid var(--cv-accent-blue); }
  .cv-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
  .cv-panel-hero { display: grid; gap: 10px; min-width: min(720px, 100%); }
  .cv-panel-title { display: flex; align-items: center; gap: 12px; }
  .cv-panel-ico { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; background: #4dabf71f; color: var(--cv-accent-blue); flex: none; }
  .cv-panel-ico .cv-ico { width: 20px; height: 20px; }
  .cv-panel-title h3 { margin: 0; font-size: 1.02rem; }
  .cv-panel-sub { font-size: 0.8rem; color: var(--vscode-descriptionForeground); margin-top: 2px; }
  .cv-panel-facts { display: flex; flex-wrap: wrap; gap: 8px; }
  .cv-panel-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .cv-ghost { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--cv-border-soft); }
  .cv-ghost:hover { background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.14)); border-color: var(--cv-accent-blue); }
  .cv-foot { margin-top: 16px; padding: 12px 14px; border-radius: 12px; background: rgba(128,128,128,0.08); border-left: 2px solid var(--vscode-panel-border); line-height: 1.55; }
  .cv-chart { margin-top: 18px; padding-top: 16px; border-top: 1px solid color-mix(in srgb, var(--vscode-panel-border) 72%, transparent); }
  .cv-chart h3 { margin: 0 0 4px; }
  .cv-chart .muted { margin-bottom: 10px; display: block; }
  .cv-month { margin: 12px 0 6px; }
  .cv-reset { opacity: 0.7; }
  .cv-history { margin-top: 14px; }
  .cv-table { border-collapse: separate; border-spacing: 0; width: 100%; max-width: 100%; font-size: 0.85rem; margin-top: 6px; overflow: hidden; border-radius: 14px; border: 1px solid var(--cv-border-soft); }
  .cv-table th, .cv-table td { padding: 9px 12px; border-bottom: 1px solid var(--cv-border-soft); text-align: left; }
  .cv-table th { color: var(--vscode-descriptionForeground); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.73rem; background: color-mix(in srgb, var(--cv-surface-3) 90%, transparent); }
  .cv-table tbody tr:hover { background: rgba(128,128,128,0.08); }
  .cv-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .cv-cur-row { background: #51cf6614; }
  .cv-cur { font-size: 0.7rem; color: var(--cv-accent-green); border: 1px solid #51cf6655; border-radius: 999px; padding: 1px 6px; margin-left: 6px; }
  .cv-update { margin: 4px 0 12px; padding: 10px 12px; border-radius: 10px; font-size: 0.85rem; border: 1px solid transparent; }
  .cv-update-ok { background: #51cf6614; border-color: #51cf6655; }
  .cv-update-new { background: #ffa94d1a; border-color: #ffa94d66; }
  .cv-update-warn { background: #e0384522; border-color: #e0384555; color: var(--cv-accent-red); }
  .cv-version { margin-top: 34px; padding-top: 18px; border-top: 1px solid var(--cv-border-soft); display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; font-size: 0.82rem; }
  .cv-version-brand { font-weight: 700; letter-spacing: 0.2px; background: linear-gradient(90deg, #ff8c42, #c77dff); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
  .cv-version-sep { opacity: 0.45; color: var(--vscode-descriptionForeground); }
  .cv-version-pill { text-decoration: none; text-transform: uppercase; letter-spacing: 0.6px; font-size: 0.72rem; font-weight: 600; color: var(--vscode-descriptionForeground); padding: 3px 11px; border: 1px solid var(--cv-border-soft); border-radius: 999px; transition: border-color 0.15s ease, color 0.15s ease; }
  .cv-version-pill:hover { border-color: #c77dff; color: var(--vscode-foreground); }
  .cv-version-beta { text-transform: uppercase; letter-spacing: 0.6px; font-size: 0.72rem; font-weight: 700; color: #1a1205; background: var(--cv-accent-amber); padding: 3px 11px; border-radius: 999px; }
  .cv-version-sha { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.72rem; color: var(--vscode-descriptionForeground); background: color-mix(in srgb, var(--vscode-foreground) 8%, transparent); padding: 3px 8px; border-radius: 6px; }
  @keyframes cv-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .cv-story-section:nth-of-type(1) { animation: cv-fade-up 260ms ease both; }
  .cv-story-section:nth-of-type(2) { animation: cv-fade-up 300ms ease both; }
  .cv-story-section:nth-of-type(3) { animation: cv-fade-up 340ms ease both; }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    .cv-shell, .card, .cv-tabpanel, button, .cv-story-section { animation: none !important; transition: none !important; transform: none !important; }
  }
  @media (max-width: 980px) {
    .cv-overview, .provider-grid, .cv-hero-grid, .cv-hero-summary-grid, .cv-totals-grid { grid-template-columns: 1fr; }
    .cv-hero-topline { flex-direction: column; }
    .cv-hero-stat-row { align-items: stretch; }
    .cv-page-intro { align-items: start; }
    .cv-page-intro { flex-direction: column; }
    .cv-inline-facts { justify-content: flex-start; }
    .cv-signal-rail { position: static; }
  }
  @media (max-width: 760px) {
    body { padding: 14px; }
    .cards { grid-template-columns: 1fr; }
    .cv-insight-grid { grid-template-columns: 1fr; }
    .cv-mini-card, .cv-mini-card-wide { grid-column: auto; }
    .cv-shell { max-width: none; }
    .cv-hero-shell, .cv-story-section, .cv-panel, .cv-provider, .cv-rail-card { padding-left: 16px; padding-right: 16px; }
  }
</style>
</head>
<body>
  <div class="cv-shell">
  ${renderHeaderHero(data, updateStatus, updateStatusPending, pendingAction, installerStatusMessage, installerStatusTone, installKind)}

  ${renderUnifiedDashboard(claude, copilot, cost, pendingAction)}

  ${renderVersionFooter(version, cavemanVersion, cavemanSha)}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    requestAnimationFrame(() => document.body.classList.add('cv-ready'));

    document.querySelectorAll('[data-command="refresh"]').forEach(b =>
      b.addEventListener('click', () => vscode.postMessage({ command: 'refresh' })));
    document.querySelectorAll('[data-command="checkUpdate"]').forEach(b =>
      b.addEventListener('click', () => vscode.postMessage({ command: 'checkUpdate' })));
    document.querySelectorAll('[data-command="updatePlugin"]').forEach(b =>
      b.addEventListener('click', () => vscode.postMessage({ command: 'updatePlugin' })));
    document.querySelectorAll('[data-command="restart"]').forEach(b =>
      b.addEventListener('click', () => vscode.postMessage({ command: 'restart' })));
    document.querySelectorAll('[data-cv]').forEach(b =>
      b.addEventListener('click', () => vscode.postMessage({ command: 'cavemanCli', action: b.getAttribute('data-cv') })));
  </script>
</body>
</html>`;
}
