import * as vscode from 'vscode';
import { CavemanSavings, CombinedSavings, CopilotSavings } from '../types';
import { CavemanUpdateStatus, readCavemanVersion } from '../collectors/updateChecker';
import { showCost, shortSha } from '../util';

/**
 * Standalone webview for caveman savings, split by provider (Claude Code + Copilot).
 * Renders per-provider savings cards, Claude status + daily USD chart, a Copilot
 * estimate section, and installer/CLI action buttons.
 */
export class CavemanPanel {
  static currentPanel: CavemanPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private data: CombinedSavings;
  private updateStatus: CavemanUpdateStatus | undefined;
  private readonly version: string;
  private readonly cavemanVersion: string | null;

  static show(context: vscode.ExtensionContext, data: CombinedSavings) {
    if (CavemanPanel.currentPanel) {
      CavemanPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      CavemanPanel.currentPanel.update(data);
      return;
    }
    const panel = vscode.window.createWebviewPanel('cavemanDashboard', 'Caveman Dashboard', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    CavemanPanel.currentPanel = new CavemanPanel(panel, context, data);
    panel.onDidDispose(() => CavemanPanel.currentPanel = undefined, null, context.subscriptions);
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, data: CombinedSavings) {
    this.panel = panel;
    this.data = data;
    this.version = (context.extension.packageJSON as { version?: string })?.version ?? '';
    this.cavemanVersion = readCavemanVersion();
    this.panel.webview.onDidReceiveMessage(message => {
      if (message?.command === 'refresh') vscode.commands.executeCommand('cavemanDashboard.refresh');
      if (message?.command === 'checkUpdate') vscode.commands.executeCommand('cavemanDashboard.checkUpdate');
      if (message?.command === 'cavemanCli') vscode.commands.executeCommand('cavemanDashboard.cavemanCli', message.action);
    }, undefined, context.subscriptions);
    this.render();
  }

  update(data: CombinedSavings) {
    this.data = data;
    this.render();
  }

  /** Reflect the latest caveman update-check result in the dashboard banner. */
  setUpdateStatus(status: CavemanUpdateStatus) {
    this.updateStatus = status;
    this.render();
  }

  private render() {
    this.panel.webview.html = renderHtml(this.data, this.updateStatus, this.version, this.cavemanVersion);
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
};
function svgIcon(name: string): string {
  return `<svg class="cv-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
}

// Installer CLI actions, grouped by intent. data-cv maps to cavemanDashboard.cavemanCli.
// icon/accent drive the tile glyph + its color; caption makes each effect clear without hovering.
type CavemanAction = { cv: string; label: string; caption: string; icon: string; accent: string; cls?: string; flag: string };
const INSTALL_ACTIONS: CavemanAction[] = [
  { cv: 'install', label: 'Install', caption: 'Plugin + defaults', icon: 'download', accent: '#4dabf7', flag: '--non-interactive' },
  { cv: 'all', label: 'Install + hooks/init', caption: 'Hooks + per-repo init', icon: 'layers', accent: '#4dabf7', flag: '--all' },
  { cv: 'minimal', label: 'Install minimal', caption: 'Plugin only', icon: 'package', accent: '#4dabf7', flag: '--minimal' },
];
const INSPECT_ACTIONS: CavemanAction[] = [
  { cv: 'dry-run', label: 'Dry run', caption: 'Preview — no changes', icon: 'eye', accent: '#8b98a5', flag: '--dry-run' },
  { cv: 'list', label: 'List providers', caption: 'Provider matrix', icon: 'list', accent: '#8b98a5', flag: '--list' },
];
const MAINTAIN_ACTIONS: CavemanAction[] = [
  { cv: 'force', label: 'Force reinstall', caption: 'Overwrite latest', icon: 'refresh', accent: '#ffa94d', flag: '--force' },
  { cv: 'uninstall', label: 'Uninstall', caption: 'Remove from machine', icon: 'trash', accent: '#ff6b6b', cls: 'cv-danger', flag: '--uninstall' },
];

function renderAction(a: CavemanAction): string {
  return `<button class="cv-btn ${a.cls ?? ''}" data-cv="${a.cv}" title="${escapeHtml(a.flag)}" style="--cv-accent:${a.accent};--cv-accent-soft:${a.accent}22">
    <span class="cv-btn-ico">${svgIcon(a.icon)}</span>
    <span class="cv-btn-text">
      <span class="cv-btn-label">${escapeHtml(a.label)}</span>
      <span class="cv-btn-cap">${escapeHtml(a.caption)}</span>
    </span>
  </button>`;
}

function bestMonth(rows: { month: string; savedTokens: number }[]): { month: string; savedTokens: number } | null {
  if (!rows.length) return null;
  return rows.reduce((best, row) => row.savedTokens > best.savedTokens ? row : best, rows[0]);
}

function trackedMonthCount(rows: { month: string; savedTokens: number }[]): number {
  return rows.filter(r => r.savedTokens > 0).length;
}

function latestTrackedMonth<T extends { month: string; savedTokens: number }>(rows: T[]): T | null {
  const activeRows = rows.filter(r => r.savedTokens > 0);
  if (!activeRows.length) return null;
  return [...activeRows].sort((a, b) => b.month.localeCompare(a.month))[0];
}

function shortModelName(model: string): string {
  return model.replace(/^copilot\//, '');
}

function renderModelCloud(models: string[], maxVisible = 4): string {
  if (!models.length) return '<div class="muted">No model metadata yet.</div>';
  const visible = models.slice(0, maxVisible);
  const hiddenCount = models.length - visible.length;
  return `<div class="cv-model-cloud">${visible.map(model => `<span class="cv-model-pill">${escapeHtml(shortModelName(model))}</span>`).join('')}${hiddenCount > 0 ? `<span class="cv-model-pill cv-model-pill-muted">+${hiddenCount} more</span>` : ''}</div>`;
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

function sharePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function renderOverviewLead(claude: CavemanSavings, copilot: CopilotSavings, cost: boolean): string {
  const leader = claude.savedTokens >= copilot.savedTokens ? 'Claude Code is leading savings this month.' : 'GitHub Copilot is leading savings this month.';
  const confidence = claude.source === 'ledger'
    ? 'Claude is ledger-backed.'
    : claude.source === 'mixed'
      ? 'Claude blends ledger and estimate data.'
      : 'Claude is estimate-only right now.';
  const costView = cost ? 'USD projection is enabled for Claude.' : 'USD projection is currently hidden.';
  return `<div class="cv-page-intro">
    <div>
      <div class="cv-page-eyebrow">Executive summary</div>
      <h2 class="cv-page-title">Current month performance</h2>
      <div class="cv-page-copy">A high-signal snapshot of provider savings, usage coverage, and whether the current month is trending above the last one.</div>
    </div>
    <div class="cv-inline-facts">
      <span class="cv-inline-pill">${escapeHtml(leader)}</span>
      <span class="cv-inline-pill">${escapeHtml(confidence)}</span>
      <span class="cv-inline-pill">${escapeHtml(costView)}</span>
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

function renderOverviewHighlights(claude: CavemanSavings, copilot: CopilotSavings): string {
  const totalCurrent = claude.savedTokens + copilot.savedTokens;
  const prev = prevMonthKey(claude.currentMonth);
  const totalPrevious = savedInMonth(claude.byMonth, prev) + savedInMonth(copilot.byMonth, prev);
  const claudeShare = sharePct(claude.savedTokens, totalCurrent);
  const copilotShare = sharePct(copilot.savedTokens, totalCurrent);
  const bestClaudeDay = bestDay(claude.byDay);
  const bestCopilotDay = bestDay(copilot.byDay);
  const strongestDay = !bestCopilotDay || (bestClaudeDay && bestClaudeDay.savedTokens >= bestCopilotDay.savedTokens)
    ? (bestClaudeDay ? `Claude · ${fmtTokens(bestClaudeDay.savedTokens)} on ${bestClaudeDay.day.slice(5)}` : 'No active day yet')
    : `Copilot · ${fmtTokens(bestCopilotDay.savedTokens)} on ${bestCopilotDay.day.slice(5)}`;
  const streak = Math.max(activeStreak(claude.byDay), activeStreak(copilot.byDay));
  const trend = totalPrevious > 0
    ? `${Math.abs(Math.round(((totalCurrent - totalPrevious) / totalPrevious) * 100))}% ${totalCurrent >= totalPrevious ? 'above' : 'below'} last month`
    : 'No previous-month baseline yet';
  const recommendation = !claude.installed
    ? 'Install caveman first so savings can be measured from real usage.'
    : !claude.active
      ? 'Run a Claude session with caveman enabled, then refresh this dashboard.'
      : !copilot.active
        ? 'Copilot has no transcript signal yet; use it for a few turns to estimate impact.'
        : 'Review provider split and compare it with the monthly history tab.';
  return `<div class="cv-insight-grid">
    <div class="cv-mini-card">
      <span class="cv-mini-label">Momentum</span>
      <strong class="cv-mini-value">${escapeHtml(trend)}</strong>
      <small class="cv-mini-copy">Based on combined current-month savings across both providers.</small>
    </div>
    <div class="cv-mini-card">
      <span class="cv-mini-label">Provider share</span>
      <strong class="cv-mini-value">Claude ${claudeShare}% · Copilot ${copilotShare}%</strong>
      <small class="cv-mini-copy">Current-month saved-token contribution split across providers.</small>
      <div class="cv-share-bar" aria-hidden="true"><span style="width:${claudeShare}%"></span></div>
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

function renderActionGroup(title: string, copy: string, actions: CavemanAction[]): string {
  return `<section class="cv-action-group">
    <div class="cv-action-head">
      <div>
        <h4>${escapeHtml(title)}</h4>
        <div class="muted cv-action-copy">${escapeHtml(copy)}</div>
      </div>
    </div>
    <div class="cv-actions cv-actions-group">${actions.map(renderAction).join('')}</div>
  </section>`;
}

/** Consolidated "updates & installer" panel: update check + banner + CLI action tiles (2 rows). */
function renderCavemanPanel(updateStatus: CavemanUpdateStatus | undefined): string {
  return `<div class="cv-panel cv-installer">
    <div class="cv-panel-head">
      <div class="cv-panel-hero">
        <div class="cv-panel-title">
          <span class="cv-panel-ico">${svgIcon('rocket')}</span>
          <div>
            <div class="cv-page-eyebrow">Operations</div>
            <h3>Updates &amp; installer</h3>
            <div class="cv-panel-sub">Install, inspect, update, or repair caveman from one place.</div>
          </div>
        </div>
        <div class="cv-panel-facts">
          <span class="cv-inline-pill">Machine-level setup</span>
          <span class="cv-inline-pill">Safe checks first</span>
          <span class="cv-inline-pill">Repair path included</span>
        </div>
      </div>
      <div class="cv-panel-actions cv-panel-actions-hero">
        <button id="check-update" class="cv-ghost cv-cta">${svgIcon('refresh')}<span>Check for update</span></button>
        <button class="cv-hero cv-cta" data-cv="force" title="--force (reinstall latest)">${svgIcon('download')}<span>Update caveman</span></button>
      </div>
    </div>
    ${renderUpdateBanner(updateStatus)}
    <div class="cv-page-intro cv-page-intro-tight">
      <div>
        <h2 class="cv-page-title">Choose the job, then run the smallest action that fits</h2>
        <div class="cv-page-copy">The page is grouped by the real workflow: install for first-time setup, inspect before changing anything, and maintain when an existing install needs attention.</div>
      </div>
    </div>
    <div class="cv-action-layout">
      ${renderActionGroup('Install', 'Start here for a first install, standard setup, or repo hook initialization.', INSTALL_ACTIONS)}
      ${renderActionGroup('Inspect', 'Preview or audit the current setup before you make changes.', INSPECT_ACTIONS)}
      ${renderActionGroup('Maintain', 'Reinstall the latest build or remove caveman cleanly from this machine.', MAINTAIN_ACTIONS)}
    </div>
    <div class="muted cv-foot">These actions download and run the latest caveman installer in a terminal. Read-only actions preview state; state-changing actions ask for confirmation first. Slash commands such as <code>/caveman</code> and <code>/caveman-stats</code> still run inside Claude Code, not from this dashboard.</div>
  </div>`;
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
function renderTotals(claude: CavemanSavings, copilot: CopilotSavings, cost: boolean): string {
  const total = claude.savedTokens + copilot.savedTokens;
  const claudeUsd = cost ? `<small>${money(claude.savedUsd)} saved</small>` : '';
  const label = fmtMonth(claude.currentMonth);
  const prev = prevMonthKey(claude.currentMonth);
  const prevTotal = savedInMonth(claude.byMonth, prev) + savedInMonth(copilot.byMonth, prev);
  const trend = deltaChip(total, prevTotal);
  return `<div class="muted cv-month">This month · <b>${escapeHtml(label)}</b> <span class="cv-reset">(resets on the 1st — history kept below)</span></div>
  <div class="cards">
    <div class="card accent-green"><span>Total Saved Tokens</span><b>${fmtTokens(total)}</b>${trend || '<small>Claude + Copilot</small>'}</div>
    <div class="card accent-orange"><span>Claude Saved</span><b>${fmtTokens(claude.savedTokens)}</b>${claudeUsd || '<small>Claude Code</small>'}</div>
    <div class="card accent-purple"><span>Copilot Saved <em>(est)</em></span><b>${fmtTokens(copilot.savedTokens)}</b><small>subscription — no USD</small></div>
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
        <span class="cv-inline-pill">${totalTrackedMonths} tracked months</span>
        <span class="cv-inline-pill">${escapeHtml(leader)}</span>
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
  const badge = (on: boolean, text: string) => `<span class="cv-badge ${on ? 'cv-on' : 'cv-off'}">${escapeHtml(text)}</span>`;
  return `<div class="cv-status">
    ${badge(c.installed, c.installed ? 'Installed' : 'Not installed')}
    ${badge(!!c.activeMode, c.activeMode ? `Active: ${c.activeMode}` : 'Mode off')}
    ${badge(c.active, c.active ? `${c.sessions} session${c.sessions === 1 ? '' : 's'} detected` : 'No usage detected')}
  </div>`;
}

function renderClaude(c: CavemanSavings, cost: boolean): string {
  if (!c.active) {
    return `${renderClaudeStatus(c)}<div class="muted cv-empty">No caveman compression detected in Claude Code yet. Install it, run a session with caveman on, then Refresh.</div>`;
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

function renderCopilot(c: CopilotSavings): string {
  const badge = (on: boolean, text: string) => `<span class="cv-badge ${on ? 'cv-on' : 'cv-off'}">${escapeHtml(text)}</span>`;
  const lastMonth = latestTrackedMonth(c.byMonth);
  const noCurrentMonthActivity = c.active && c.turns === 0;
  const status = `<div class="cv-status">
    ${badge(c.configured, c.configured ? 'caveman installed' : 'caveman not installed')}
    ${badge(c.active, c.active ? `${c.sessions} chats · ${c.turns} turns this month` : 'No Copilot chats found')}
    ${noCurrentMonthActivity && lastMonth ? badge(true, `History seen in ${fmtMonth(lastMonth.month)}`) : ''}
  </div>`;
  if (!c.active) {
    return `${status}<div class="muted cv-empty">No Copilot chat transcripts found under the VS Code User directory. Override the path with <code>cavemanDashboard.vscodeUserPath</code> if needed.</div>`;
  }
  const days = c.byDay.map(d => d.day);
  const chart = days.length >= 2
    ? `<div class="cv-chart"><h3>Daily saved tokens this month (est)</h3>${renderLineChart(days, c.byDay.map(d => d.savedTokens), fmtTokens, { color: '#b197fc', id: 'copilot' })}</div>`
    : '';
  const models = c.models.length
    ? `<div class="cv-models-block"><div class="cv-models-label">Models seen in history</div>${renderModelCloud(c.models, 5)}</div>`
    : '';
  return `${status}
    ${noCurrentMonthActivity && lastMonth ? `<div class="muted cv-note">Current month has no Copilot transcript activity yet. The model list and monthly history below come from earlier sessions, most recently <b>${escapeHtml(fmtMonth(lastMonth.month))}</b>.</div>` : ''}
    <div class="cards">
      <div class="card accent-purple"><span>Saved Output Tokens <em>(est)</em></span><b>${fmtTokens(c.savedTokens)}</b></div>
      <div class="card accent-blue"><span>Output Tokens</span><b>${fmtTokens(c.outputTokens)}</b></div>
      <div class="card accent-orange"><span>Chats / Turns</span><b>${c.sessions} / ${c.turns}</b></div>
    </div>
    ${models}
    ${chart}
    <div class="muted cv-foot">Copilot keeps no local token log — output tokens are <b>counted</b> from chat transcripts with a real o200k_base tokenizer, but saved tokens are a <b>projection</b> (assume caveman compression, ~65%, was active — Copilot leaves no per-message marker). Copilot is subscription-billed, so no USD figure is shown.</div>`;
}

function renderCopilotCredits(copilot: CopilotSavings): string {
  const lastMonth = latestTrackedMonth(copilot.byMonth);
  const usageLabel = copilot.active
    ? 'Check the Copilot account menu in VS Code for your live credit balance and reset date.'
    : 'Extensions can detect local transcript activity, but not your account credit balance.';
  return `<section class="cv-credit-card">
    <div class="cv-credit-head">
      <div>
        <div class="cv-credit-title">GitHub Copilot account status</div>
        <div class="cv-credit-sub">This dashboard can read local transcript activity, but GitHub does not expose live credit percentage or reset timing to local extensions.</div>
      </div>
      <span class="cv-credit-badge">Account data stays in Copilot</span>
    </div>
    <div class="cv-credit-body">
      <div class="cv-credit-value">Live credits unavailable here</div>
      <div class="cv-credit-summary">Use the Copilot account menu in VS Code for the real percentage, plan usage, and reset date.</div>
      <div class="cv-credit-meter" aria-hidden="true"><span></span></div>
      <div class="cv-credit-grid">
        <div class="cv-credit-stat">
          <span class="cv-credit-label">Account view</span>
          <strong class="cv-credit-strong">Open Copilot menu</strong>
        </div>
        <div class="cv-credit-stat">
          <span class="cv-credit-label">Extension state</span>
          <strong class="cv-credit-strong">${escapeHtml(copilot.configured ? 'Copilot installed' : 'Copilot not installed')}</strong>
        </div>
      </div>
      <div class="cv-credit-meta">
        <span>${escapeHtml(lastMonth ? `Last transcript activity ${fmtMonth(lastMonth.month)}` : 'No tracked activity month yet')}</span>
        <span>Reset date is not exposed locally</span>
      </div>
      <div class="muted cv-credit-note">${escapeHtml(usageLabel)}</div>
    </div>
  </section>`;
}

/** Banner reflecting the last caveman update check (empty until the user checks). */
function renderUpdateBanner(status: CavemanUpdateStatus | undefined): string {
  if (!status) return '';
  if (status.error) {
    return `<div class="cv-update cv-update-warn">Update check failed: ${escapeHtml(status.error)}</div>`;
  }
  if (!status.installed) {
    return `<div class="cv-update cv-update-warn">caveman is not installed on this machine.</div>`;
  }
  if (!status.updateAvailable) {
    return `<div class="cv-update cv-update-ok">caveman is up to date <code>${escapeHtml(shortSha(status.installedSha))}</code>.</div>`;
  }
  const link = status.compareUrl
    ? ` — <a href="${escapeHtml(status.compareUrl)}">view changes</a>`
    : '';
  return `<div class="cv-update cv-update-new">Update available: <code>${escapeHtml(shortSha(status.installedSha))}</code> → <code>${escapeHtml(shortSha(status.latestSha))}</code>${link}. Use <b>Update caveman</b> to install the latest.</div>`;
}

function renderHeaderHero(data: CombinedSavings, updateStatus: CavemanUpdateStatus | undefined): string {
  const { claude, copilot } = data;
  const totalSessions = claude.sessions + copilot.sessions;
  const month = fmtMonth(claude.currentMonth);
  const updateLabel = !updateStatus
    ? 'Update status unknown'
    : updateStatus.error
      ? 'Update check failed'
      : !updateStatus.installed
        ? 'caveman not installed'
        : updateStatus.updateAvailable
          ? 'Update available'
          : 'Up to date';
  const modeLabel = claude.activeMode ? `Claude mode: ${claude.activeMode}` : 'Claude mode inactive';
  return `<section class="cv-hero-shell">
    <div class="cv-hero-main">
      <div class="cv-kicker">Developer telemetry for caveman compression</div>
      <h1>Caveman Dashboard</h1>
      <div class="cv-hero-copy">Track real Claude savings, compare them with estimated Copilot impact, and keep the caveman install path close to the data.</div>
      <div class="cv-hero-chips">
        <span class="cv-chip cv-chip-good">${escapeHtml(month)}</span>
        <span class="cv-chip">${escapeHtml(modeLabel)}</span>
        <span class="cv-chip">${totalSessions} total sessions observed</span>
        <span class="cv-chip">${escapeHtml(updateLabel)}</span>
      </div>
    </div>
    <div class="cv-hero-actions">
      <button class="cv-ghost cv-cta" data-command="checkUpdate">${svgIcon('refresh')}<span>Check update</span></button>
      <button class="cv-hero cv-cta" data-command="refresh">${svgIcon('download')}<span>Refresh dashboard</span></button>
    </div>
  </section>`;
}

function renderSignalRail(claude: CavemanSavings, copilot: CopilotSavings, cost: boolean): string {
  const claudeConfidence = claude.source === 'ledger'
    ? 'High confidence · ledger-backed'
    : claude.source === 'mixed'
      ? 'Mixed confidence · ledger + estimate'
      : 'Estimated only';
  const costLine = cost ? 'USD estimate is enabled for Claude.' : 'USD estimate is off for cleaner token-only review.';
  const copilotLine = copilot.active
    ? `Copilot savings are projected from ${copilot.turns} turns.`
    : 'Copilot has no local chats in scope yet.';
  return `<aside class="cv-signal-rail">
    <div class="cv-rail-card">
      <div class="cv-rail-eyebrow">Read this first</div>
      <h3>Signal quality</h3>
      <div class="cv-rail-line"><span>Claude</span><strong>${escapeHtml(claudeConfidence)}</strong></div>
      <div class="cv-rail-line"><span>Copilot</span><strong>${escapeHtml(copilotLine)}</strong></div>
      <div class="cv-rail-line"><span>Cost view</span><strong>${escapeHtml(costLine)}</strong></div>
    </div>
    <div class="cv-rail-card">
      <div class="cv-rail-eyebrow">Workflow</div>
      <h3>Recommended loop</h3>
      <div class="cv-step">1. Run Claude or Copilot with caveman enabled.</div>
      <div class="cv-step">2. Refresh to re-read local logs and transcripts.</div>
      <div class="cv-step">3. Use monthly history to compare adoption over time.</div>
    </div>
  </aside>`;
}

function renderClaudeRail(claude: CavemanSavings, cost: boolean): string {
  const costLine = cost ? `${money(claude.savedUsd)} estimated saved this month.` : 'Cost view is hidden for this session.';
  return `<aside class="cv-signal-rail">
    <div class="cv-rail-card">
      <div class="cv-rail-eyebrow">Signal quality</div>
      <h3>Claude readout</h3>
      <div class="cv-rail-line"><span>Source</span><strong>${escapeHtml(claude.source)}</strong></div>
      <div class="cv-rail-line"><span>Mode</span><strong>${escapeHtml(claude.activeMode ?? 'off')}</strong></div>
      <div class="cv-rail-line"><span>Cost lens</span><strong>${escapeHtml(costLine)}</strong></div>
    </div>
  </aside>`;
}

function renderClaudeTab(claude: CavemanSavings, cost: boolean): string {
  const confidence = claude.source === 'ledger'
    ? 'Ledger-backed'
    : claude.source === 'mixed'
      ? 'Ledger + estimate'
      : claude.source === 'estimated'
        ? 'Estimate-only'
        : 'No signal yet';
  const usdState = cost ? 'USD view on' : 'USD view off';
  const mode = claude.activeMode ? `Mode ${claude.activeMode}` : 'Mode inactive';
  return `<div class="cv-overview">
    <div>
    <div class="cv-page-intro">
      <div>
        <div class="cv-page-eyebrow">Claude Code</div>
        <h2 class="cv-page-title">Measured caveman savings</h2>
        <div class="cv-page-copy">This view is dedicated to Claude Code usage, with caveman session detection, measured saved tokens, and optional USD estimates from the local ledger.</div>
      </div>
      <div class="cv-inline-facts">
        <span class="cv-inline-pill">${escapeHtml(confidence)}</span>
        <span class="cv-inline-pill">${escapeHtml(mode)}</span>
        <span class="cv-inline-pill">${escapeHtml(usdState)}</span>
      </div>
    </div>
    <section class="cv-provider">
      ${renderProviderHeader('Claude Code', 'Measured from caveman activity and local ledger history.', 'layers')}
      ${renderClaude(claude, cost)}
    </section>
    </div>
    ${renderClaudeRail(claude, cost)}
  </div>`;
}

function renderCopilotTab(copilot: CopilotSavings): string {
  const modelLabel = copilot.models.length ? `${copilot.models.length} model${copilot.models.length === 1 ? '' : 's'}` : 'No models yet';
  const lastMonth = latestTrackedMonth(copilot.byMonth);
  const activity = copilot.active ? `${copilot.sessions} chats · ${copilot.turns} turns this month` : 'No activity yet';
  const config = copilot.configured ? 'Installed' : 'Not installed';
  return `<div>
    <div class="cv-page-intro">
      <div>
        <div class="cv-page-eyebrow">GitHub Copilot</div>
        <h2 class="cv-page-title">Projected transcript-based savings</h2>
        <div class="cv-page-copy">This view isolates GitHub Copilot activity using local chat transcripts, real tokenizer counts for output tokens, and a projected caveman compression impact.</div>
        <div class="cv-inline-facts cv-inline-facts-start cv-inline-facts-soft">
          <span class="cv-inline-pill">${escapeHtml(modelLabel)}</span>
          <span class="cv-inline-pill">${escapeHtml(activity)}</span>
          <span class="cv-inline-pill">${escapeHtml(lastMonth ? `Last active ${fmtMonth(lastMonth.month)}` : 'No tracked month yet')}</span>
          <span class="cv-inline-pill">${escapeHtml(config)}</span>
        </div>
      </div>
    </div>
    ${renderCopilotCredits(copilot)}
    <section class="cv-provider">
      ${renderProviderHeader('GitHub Copilot', 'Estimated from local chat transcripts and tokenizer counts.', 'package')}
      ${renderCopilot(copilot)}
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

/** Bottom badge (ClaudeLens-style): gradient extension version + pill link to the original caveman repo (with its version). */
function renderVersionFooter(version: string, cavemanVersion: string | null): string {
  const ver = version ? ` v${escapeHtml(version)}` : '';
  const cav = cavemanVersion ? `caveman v${escapeHtml(cavemanVersion)} ↗` : 'caveman original repo ↗';
  return `<footer class="cv-version">
    <span class="cv-version-brand">Caveman Dashboard${ver}</span>
    <span class="cv-version-sep">·</span>
    <a class="cv-version-pill" href="${CAVEMAN_REPO}">${cav}</a>
    <span class="cv-version-sep">·</span>
    <span class="cv-version-beta">BETA</span>
  </footer>`;
}

function renderHtml(data: CombinedSavings, updateStatus: CavemanUpdateStatus | undefined, version: string, cavemanVersion: string | null): string {
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
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 18px 20px 28px; background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--vscode-button-background) 16%, transparent), transparent 34%),
    linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 88%, transparent), transparent 240px); }
  .cv-shell { opacity: 0; transform: translateY(8px); transition: opacity 220ms ease, transform 260ms cubic-bezier(.2,.8,.2,1); }
  body.cv-ready .cv-shell { opacity: 1; transform: translateY(0); }
  h1 { font-size: 1.75rem; margin: 0 0 8px; line-height: 1.08; letter-spacing: -0.02em; }
  h2 { font-size: 1.05rem; margin: 22px 0 8px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
  h3 { font-size: 0.95rem; margin: 12px 0 4px; }
  .muted { color: var(--vscode-descriptionForeground); font-size: 0.85rem; }
  em { font-style: normal; opacity: 0.7; font-size: 0.85em; }
  a { color: var(--vscode-textLink-foreground); }
  code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; }
  .cv-shell { max-width: 1240px; margin: 0 auto; }
  .cv-page-intro { display: flex; justify-content: space-between; gap: 18px; align-items: end; margin: 6px 0 14px; }
  .cv-page-intro-tight { margin-top: 4px; }
  .cv-page-eyebrow { color: #8ecae6; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.72rem; font-weight: 700; margin-bottom: 6px; }
  .cv-page-title { margin: 0; font-size: 1.15rem; border-bottom: none; padding-bottom: 0; }
  .cv-page-copy { margin-top: 5px; max-width: 72ch; color: var(--vscode-descriptionForeground); line-height: 1.55; font-size: 0.9rem; }
  .cv-inline-facts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
  .cv-inline-facts-start { justify-content: flex-start; }
  .cv-inline-facts-soft { margin-top: 12px; }
  .cv-inline-pill { display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border-radius: 999px; background: rgba(128,128,128,0.08); border: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size: 0.76rem; font-weight: 600; }
  .cv-credit-card { margin: 0 0 16px; padding: 16px 18px; border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 84%, transparent); border-radius: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 96%, transparent), color-mix(in srgb, var(--vscode-editorWidget-background) 100%, black 4%)); box-shadow: 0 10px 24px rgba(0,0,0,0.12); }
  .cv-credit-head { display: flex; justify-content: space-between; align-items: start; gap: 12px; margin-bottom: 14px; }
  .cv-credit-title { font-size: 1.02rem; font-weight: 700; }
  .cv-credit-sub { margin-top: 4px; max-width: 64ch; color: var(--vscode-descriptionForeground); font-size: 0.82rem; line-height: 1.45; }
  .cv-credit-badge { display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border-radius: 999px; background: rgba(128,128,128,0.08); border: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size: 0.76rem; font-weight: 700; white-space: nowrap; }
  .cv-credit-body { display: grid; gap: 10px; }
  .cv-credit-value { font-size: 1.65rem; line-height: 1.05; letter-spacing: -0.02em; font-weight: 700; }
  .cv-credit-summary { color: var(--vscode-descriptionForeground); font-size: 0.86rem; line-height: 1.5; max-width: 62ch; }
  .cv-credit-meter { height: 8px; border-radius: 999px; background: rgba(128,128,128,0.12); overflow: hidden; }
  .cv-credit-meter span { display: block; width: 0%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #4dabf7, #74c0fc); }
  .cv-credit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .cv-credit-stat { padding: 12px 13px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 76%, transparent); background: rgba(128,128,128,0.04); display: grid; gap: 4px; }
  .cv-credit-label { color: var(--vscode-descriptionForeground); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
  .cv-credit-strong { color: var(--vscode-foreground); font-size: 0.9rem; }
  .cv-credit-meta { display: flex; justify-content: space-between; gap: 12px; color: var(--vscode-descriptionForeground); font-size: 0.8rem; }
  .cv-credit-note { line-height: 1.5; }
  .cv-insight-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin: 0 0 16px; }
  .cv-mini-card { grid-column: span 2; padding: 14px 15px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 82%, transparent); background: linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 95%, transparent), color-mix(in srgb, var(--vscode-editorWidget-background) 100%, black 4%)); box-shadow: 0 6px 18px rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 6px; }
  .cv-mini-card-wide { grid-column: span 2; }
  .cv-mini-label { color: #8ecae6; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.71rem; font-weight: 700; }
  .cv-mini-value { font-size: 0.95rem; line-height: 1.45; }
  .cv-mini-copy { color: var(--vscode-descriptionForeground); font-size: 0.75rem; line-height: 1.45; }
  .cv-share-bar { width: 100%; height: 8px; border-radius: 999px; background: rgba(128,128,128,0.14); overflow: hidden; margin-top: 2px; }
  .cv-share-bar span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #51cf66, #4dabf7); }
  .toolbar { display: flex; gap: 8px; margin: 0; }
  .cv-hero-shell { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: end; padding: 22px 22px 18px; border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 88%, transparent); border-radius: 18px; background: linear-gradient(135deg, color-mix(in srgb, var(--vscode-editorWidget-background) 94%, transparent), color-mix(in srgb, var(--vscode-editorWidget-background) 100%, black 4%)); box-shadow: 0 14px 40px rgba(0,0,0,0.16); }
  .cv-kicker { color: #ffa94d; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.72rem; font-weight: 700; margin-bottom: 8px; }
  .cv-hero-copy { max-width: 68ch; color: var(--vscode-descriptionForeground); line-height: 1.55; font-size: 0.95rem; }
  .cv-hero-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .cv-chip { display: inline-flex; align-items: center; min-height: 30px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--vscode-panel-border); background: color-mix(in srgb, var(--vscode-editor-background) 55%, transparent); color: var(--vscode-descriptionForeground); font-size: 0.77rem; font-weight: 600; }
  .cv-chip-good { color: #9ae6b4; border-color: #51cf6655; background: #51cf6616; }
  .cv-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; align-items: center; }
  .cv-cta { min-height: 38px; display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 10px; font-weight: 700; }
  .cv-cta .cv-ico { width: 15px; height: 15px; }
  .cv-tabs { display: inline-flex; gap: 6px; margin: 18px 0 10px; padding: 6px; border: 1px solid var(--vscode-panel-border); border-radius: 14px; background: color-mix(in srgb, var(--vscode-editorWidget-background) 88%, transparent); }
  .cv-tab { background: transparent; color: var(--vscode-descriptionForeground); border: none; border-radius: 10px; padding: 8px 14px; font-weight: 700; }
  .cv-tab:hover { background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.12)); color: var(--vscode-foreground); }
  .cv-tab-active { color: #081b2c; background: linear-gradient(135deg, #7dd3fc, #4dabf7); box-shadow: 0 6px 18px #4dabf733; }
  .cv-tabpanel.cv-panel-live { animation: cv-fade-up 220ms cubic-bezier(.2,.8,.2,1); }
  .cv-hidden { display: none; }
  button { font-family: inherit; font-size: 0.85rem; padding: 5px 12px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button:active { transform: translateY(1px) scale(0.995); }
  .cv-status { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 12px; }
  .cv-badge { font-size: 0.78rem; padding: 3px 10px; border-radius: 999px; border: 1px solid transparent; }
  .cv-on { background: #51cf6622; border-color: #51cf6655; color: #51cf66; }
  .cv-off { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .cv-overview { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 18px; align-items: start; margin-top: 8px; }
  .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 8px 0 12px; }
  .cv-summary-cards { margin-top: 0; margin-bottom: 16px; }
  .card { min-width: 0; padding: 14px 15px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 82%, transparent); border-left: 4px solid var(--vscode-panel-border); background: linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent), color-mix(in srgb, var(--vscode-editorWidget-background) 100%, black 4%)); box-shadow: 0 6px 18px rgba(0,0,0,0.12); display: flex; flex-direction: column; gap: 4px; transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease; }
  .card:hover { box-shadow: 0 10px 26px rgba(0,0,0,0.18); transform: translateY(-2px); border-color: color-mix(in srgb, var(--vscode-focusBorder) 55%, var(--vscode-panel-border)); }
  .card span { font-size: 0.8rem; color: var(--vscode-descriptionForeground); }
  .card b { font-size: 1.7rem; font-variant-numeric: tabular-nums; line-height: 1.05; letter-spacing: -0.02em; }
  .card small { font-size: 0.72rem; color: var(--vscode-descriptionForeground); }
  .accent-green { border-left-color: #51cf66; }
  .accent-purple { border-left-color: #b197fc; }
  .accent-blue { border-left-color: #4dabf7; }
  .accent-orange { border-left-color: #ffa94d; }
  .cv-delta { font-weight: 600; }
  .cv-up { color: #51cf66; }
  .cv-down { color: #ffa94d; }
  .cv-flat { color: var(--vscode-descriptionForeground); }
  .cv-note, .cv-empty { padding: 12px 14px; background: var(--vscode-editorWidget-background); border-radius: 8px; }
  .provider-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; margin-top: 8px; }
  .cv-provider { padding: 16px 16px 18px; border: 1px solid var(--vscode-panel-border); border-radius: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 94%, transparent), color-mix(in srgb, var(--vscode-editorWidget-background) 100%, black 3%)); min-width: 0; box-shadow: 0 10px 24px rgba(0,0,0,0.12); }
  .cv-provider h2 { margin: 0; border-bottom: none; padding-bottom: 0; }
  .cv-provider-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .cv-provider-mark { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; background: color-mix(in srgb, var(--vscode-button-background) 18%, transparent); color: var(--vscode-textLink-foreground); }
  .cv-provider-mark .cv-ico { width: 18px; height: 18px; }
  .cv-provider-sub { margin-top: 2px; }
  .cv-provider .cards { flex-direction: row; flex-wrap: wrap; }
  .cv-provider .card { flex: 1 1 160px; }
  .cv-models-block { margin: 4px 0 12px; }
  .cv-models-label { margin-bottom: 8px; color: var(--vscode-descriptionForeground); font-size: 0.78rem; font-weight: 600; }
  .cv-model-cloud { display: flex; flex-wrap: wrap; gap: 8px; }
  .cv-model-pill { display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border-radius: 999px; background: color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent); border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 78%, transparent); color: var(--vscode-foreground); font-size: 0.77rem; font-weight: 600; }
  .cv-model-pill-muted { color: var(--vscode-descriptionForeground); }
  .chart { width: 100%; max-width: 640px; height: auto; }
  .axis { fill: var(--vscode-descriptionForeground); font-size: 10px; }
  .grid { stroke: var(--vscode-panel-border); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.6; }
  .cv-ico { display: block; }
  .cv-signal-rail { display: grid; gap: 14px; }
  .cv-rail-card { padding: 16px; border: 1px solid var(--vscode-panel-border); border-radius: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 95%, transparent), color-mix(in srgb, var(--vscode-editorWidget-background) 100%, black 4%)); box-shadow: 0 10px 24px rgba(0,0,0,0.12); }
  .cv-rail-eyebrow { text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.69rem; font-weight: 700; color: #8ecae6; margin-bottom: 8px; }
  .cv-rail-card h3 { margin: 0 0 10px; font-size: 0.98rem; }
  .cv-rail-line, .cv-step { display: flex; justify-content: space-between; gap: 10px; padding: 9px 0; border-top: 1px solid color-mix(in srgb, var(--vscode-panel-border) 75%, transparent); font-size: 0.83rem; line-height: 1.45; }
  .cv-rail-line:first-of-type, .cv-step:first-of-type { border-top: none; padding-top: 0; }
  .cv-rail-stack { padding: 0 0 12px; margin-bottom: 4px; border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 75%, transparent); }
  .cv-rail-stack-label { display: block; margin-bottom: 8px; color: var(--vscode-descriptionForeground); font-size: 0.83rem; }
  .cv-rail-line span { color: var(--vscode-descriptionForeground); }
  .cv-rail-line strong { text-align: right; font-size: 0.81rem; }
  .cv-step { display: block; color: var(--vscode-descriptionForeground); }
  .cv-panel { margin-top: 18px; padding: 18px 20px; border: 1px solid var(--vscode-panel-border); border-radius: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 94%, transparent), color-mix(in srgb, var(--vscode-editorWidget-background) 100%, black 4%)); box-shadow: 0 10px 24px rgba(0,0,0,0.12); }
  .cv-installer { border-left: 3px solid #4dabf7; }
  .cv-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
  .cv-panel-hero { display: grid; gap: 10px; min-width: min(720px, 100%); }
  .cv-panel-title { display: flex; align-items: center; gap: 12px; }
  .cv-panel-ico { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; background: #4dabf71f; color: #4dabf7; flex: none; }
  .cv-panel-ico .cv-ico { width: 20px; height: 20px; }
  .cv-panel-title h3 { margin: 0; font-size: 1.02rem; }
  .cv-panel-sub { font-size: 0.8rem; color: var(--vscode-descriptionForeground); margin-top: 2px; }
  .cv-panel-facts { display: flex; flex-wrap: wrap; gap: 8px; }
  .cv-panel-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .cv-panel-actions-hero { align-items: stretch; }
  .cv-ghost { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); }
  .cv-ghost:hover { background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.14)); border-color: var(--vscode-focusBorder, #4dabf7); }
  .cv-hero { background: #4dabf7; color: #08203a; border: 1px solid #4dabf7; box-shadow: 0 2px 10px #4dabf73d; }
  .cv-hero:hover { background: #74c0fc; }
  .cv-action-layout { display: grid; gap: 16px; margin-top: 8px; }
  .cv-action-group { padding: 14px; border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 84%, transparent); border-radius: 14px; background: rgba(128,128,128,0.03); }
  .cv-action-head { display: flex; justify-content: flex-start; gap: 16px; align-items: start; margin-bottom: 12px; }
  .cv-action-head h4 { margin: 0; font-size: 0.95rem; }
  .cv-action-copy { margin-top: 5px; max-width: 70ch; }
  .cv-actions { display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 10px; }
  .cv-actions-group { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
  .cv-btn { display: flex; align-items: flex-start; gap: 11px; text-align: left; line-height: 1.3; padding: 12px 13px; border-radius: 10px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-panel-border); color: var(--vscode-foreground); transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; }
  .cv-btn:hover { border-color: var(--cv-accent, #4dabf7); transform: translateY(-1px); box-shadow: 0 5px 14px rgba(0,0,0,0.2); }
  .cv-btn-ico { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; flex: none; background: var(--cv-accent-soft, #4dabf722); color: var(--cv-accent, #4dabf7); }
  .cv-btn-ico .cv-ico { width: 18px; height: 18px; }
  .cv-btn-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .cv-btn-label { font-weight: 600; font-size: 0.88rem; }
  .cv-btn-cap { font-size: 0.73rem; color: var(--vscode-descriptionForeground); }
  .cv-btn.cv-danger { background: #e0384510; border-color: #e0384533; }
  .cv-foot { margin-top: 16px; padding: 10px 13px; border-radius: 8px; background: rgba(128,128,128,0.08); border-left: 2px solid var(--vscode-panel-border); line-height: 1.5; }
  .cv-month { margin: 12px 0 6px; }
  .cv-reset { opacity: 0.7; }
  .cv-history { margin-top: 14px; }
  .cv-table { border-collapse: collapse; width: 100%; max-width: 100%; font-size: 0.85rem; margin-top: 6px; overflow: hidden; border-radius: 12px; }
  .cv-table th, .cv-table td { padding: 5px 10px; border-bottom: 1px solid var(--vscode-panel-border); text-align: left; }
  .cv-table th { color: var(--vscode-descriptionForeground); font-weight: 600; }
  .cv-table tbody tr:hover { background: rgba(128,128,128,0.08); }
  .cv-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .cv-cur-row { background: #51cf6614; }
  .cv-cur { font-size: 0.7rem; color: #51cf66; border: 1px solid #51cf6655; border-radius: 999px; padding: 1px 6px; margin-left: 6px; }
  .cv-update { margin: 4px 0 12px; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; border: 1px solid transparent; }
  .cv-update-ok { background: #51cf6614; border-color: #51cf6655; }
  .cv-update-new { background: #ffa94d1a; border-color: #ffa94d66; }
  .cv-update-warn { background: #e0384522; border-color: #e0384555; color: #ff6b6b; }
  .cv-version { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--vscode-panel-border); display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; font-size: 0.82rem; }
  .cv-version-brand { font-weight: 700; letter-spacing: 0.2px; background: linear-gradient(90deg, #ff8c42, #c77dff); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
  .cv-version-sep { opacity: 0.45; color: var(--vscode-descriptionForeground); }
  .cv-version-pill { text-decoration: none; text-transform: uppercase; letter-spacing: 0.6px; font-size: 0.72rem; font-weight: 600; color: var(--vscode-descriptionForeground); padding: 3px 11px; border: 1px solid var(--vscode-panel-border); border-radius: 999px; transition: border-color 0.15s ease, color 0.15s ease; }
  .cv-version-pill:hover { border-color: #c77dff; color: var(--vscode-foreground); }
  .cv-version-beta { text-transform: uppercase; letter-spacing: 0.6px; font-size: 0.72rem; font-weight: 700; color: #1a1205; background: #ffa94d; padding: 3px 11px; border-radius: 999px; }
  @keyframes cv-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cv-shell, .card, .cv-btn, .cv-tabpanel, button { animation: none !important; transition: none !important; transform: none !important; }
  }
  @media (max-width: 980px) {
    .cv-overview, .provider-grid, .cv-hero-shell { grid-template-columns: 1fr; }
    .cv-hero-actions { justify-content: flex-start; }
    .cv-page-intro, .cv-action-head { align-items: start; }
    .cv-page-intro, .cv-action-head { flex-direction: column; }
    .cv-inline-facts { justify-content: flex-start; }
    .cv-panel-actions-hero { width: 100%; }
    .cv-credit-head, .cv-credit-meta { flex-direction: column; align-items: start; }
    .cv-credit-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 760px) {
    body { padding: 14px; }
    .cards { grid-template-columns: 1fr; }
    .cv-insight-grid { grid-template-columns: 1fr; }
    .cv-mini-card, .cv-mini-card-wide { grid-column: auto; }
    .cv-shell { max-width: none; }
  }
</style>
</head>
<body>
  <div class="cv-shell">
  ${renderHeaderHero(data, updateStatus)}

  <div class="cv-tabs" role="tablist">
    <button class="cv-tab" data-tab="copilot" role="tab">GitHub Copilot</button>
    <button class="cv-tab" data-tab="claude" role="tab">Claude Code</button>
    <button class="cv-tab" data-tab="history" role="tab">Monthly history</button>
    <button class="cv-tab" data-tab="updates" role="tab">Updates &amp; installer</button>
  </div>

  <section class="cv-tabpanel cv-hidden" data-panel="claude" role="tabpanel">
    ${renderClaudeTab(claude, cost)}
  </section>

  <section class="cv-tabpanel cv-hidden" data-panel="copilot" role="tabpanel">
    ${renderCopilotTab(copilot)}
  </section>

  <section class="cv-tabpanel" data-panel="history" role="tabpanel">
    ${renderHistoryTab(claude, copilot, cost)}
  </section>

  <section class="cv-tabpanel" data-panel="updates" role="tabpanel">
    ${renderCavemanPanel(updateStatus)}
  </section>

  ${renderVersionFooter(version, cavemanVersion)}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const tabs = document.querySelectorAll('.cv-tab');
    const panels = document.querySelectorAll('.cv-tabpanel');
    const validTabs = new Set(Array.from(tabs, t => t.getAttribute('data-tab')));
    requestAnimationFrame(() => document.body.classList.add('cv-ready'));
    function activateTab(tab) {
      tabs.forEach(t => t.classList.toggle('cv-tab-active', t.getAttribute('data-tab') === tab));
      panels.forEach(p => {
        const isActive = p.getAttribute('data-panel') === tab;
        p.classList.toggle('cv-hidden', !isActive);
        p.classList.remove('cv-panel-live');
        if (isActive) {
          void p.offsetWidth;
          p.classList.add('cv-panel-live');
        }
      });
      vscode.setState({ ...(vscode.getState() || {}), activeTab: tab });
    }
    tabs.forEach(t => t.addEventListener('click', () => activateTab(t.getAttribute('data-tab'))));
    // Restore the last-viewed tab so re-renders (Refresh, update check) keep the user in place.
    const savedTab = (vscode.getState() || {}).activeTab;
    activateTab(validTabs.has(savedTab) ? savedTab : 'copilot');

    document.querySelectorAll('[data-command="refresh"]').forEach(b =>
      b.addEventListener('click', () => vscode.postMessage({ command: 'refresh' })));
    document.querySelectorAll('[data-command="checkUpdate"]').forEach(b =>
      b.addEventListener('click', () => vscode.postMessage({ command: 'checkUpdate' })));
    document.querySelectorAll('[data-cv]').forEach(b =>
      b.addEventListener('click', () => vscode.postMessage({ command: 'cavemanCli', action: b.getAttribute('data-cv') })));
  </script>
</body>
</html>`;
}
