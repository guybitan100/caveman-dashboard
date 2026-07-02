import * as vscode from 'vscode';
import { CavemanSavings, CombinedSavings, CopilotSavings } from '../types';
import { CavemanUpdateStatus } from '../collectors/updateChecker';
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
    this.panel.webview.html = renderHtml(this.data, this.updateStatus);
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

function renderActionGroup(title: string, actions: CavemanAction[]): string {
  return `<div class="cv-group">
    <div class="cv-group-label">${escapeHtml(title)}</div>
    <div class="cv-actions">${actions.map(renderAction).join('')}</div>
  </div>`;
}

/** Consolidated "updates & installer" panel: update check + banner + grouped CLI actions. */
function renderCavemanPanel(updateStatus: CavemanUpdateStatus | undefined): string {
  return `<div class="cv-panel cv-installer">
    <div class="cv-panel-head">
      <div class="cv-panel-title">
        <span class="cv-panel-ico">${svgIcon('rocket')}</span>
        <div>
          <h3>Updates &amp; installer</h3>
          <div class="cv-panel-sub">Manage the caveman plugin on this machine</div>
        </div>
      </div>
      <div class="cv-panel-actions">
        <button id="check-update" class="cv-ghost">${svgIcon('refresh')}<span>Check for update</span></button>
        <button class="cv-hero" data-cv="force" title="--force (reinstall latest)">${svgIcon('download')}<span>Update caveman</span></button>
      </div>
    </div>
    ${renderUpdateBanner(updateStatus)}
    ${renderActionGroup('Install', INSTALL_ACTIONS)}
    ${renderActionGroup('Inspect · read-only', INSPECT_ACTIONS)}
    ${renderActionGroup('Maintenance', MAINTAIN_ACTIONS)}
    <div class="muted cv-foot">Actions download and run the <b>latest</b> installer (<code>curl … main/install.sh | bash</code>) in a terminal; state-changing actions confirm first. Slash commands (<code>/caveman</code>, <code>/caveman-stats</code>, …) run inside Claude Code, not here. Savings are estimated (only <code>full</code> mode benchmarked, ≈65% output reduction) — output-token value, not billed.</div>
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
  return `<div class="cv-history"><h3>Monthly history</h3>
    <table class="cv-table">
      <thead><tr><th>Month</th><th class="num">Saved tokens</th>${usdHead}<th class="num">Sessions</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
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
  const history = renderMonthlyHistory(c.byMonth, c.currentMonth, cost);
  return `${renderClaudeStatus(c)}
    <div class="cards">
      ${cost ? `<div class="card accent-green"><span>Saved (USD)</span><b>${money(c.savedUsd)}</b><small>${srcLabel}</small></div>` : ''}
      <div class="card accent-purple"><span>Saved Output Tokens</span><b>${fmtTokens(c.savedTokens)}</b></div>
      <div class="card accent-blue"><span>Sessions</span><b>${c.sessions}</b></div>
    </div>
    ${chart}
    ${history}`;
}

function renderCopilot(c: CopilotSavings): string {
  const badge = (on: boolean, text: string) => `<span class="cv-badge ${on ? 'cv-on' : 'cv-off'}">${escapeHtml(text)}</span>`;
  const status = `<div class="cv-status">
    ${badge(c.configured, c.configured ? 'caveman installed' : 'caveman not installed')}
    ${badge(c.active, c.active ? `${c.sessions} chats · ${c.turns} turns` : 'No Copilot chats found')}
  </div>`;
  if (!c.active) {
    return `${status}<div class="muted cv-empty">No Copilot chat transcripts found under the VS Code User directory. Override the path with <code>cavemanDashboard.vscodeUserPath</code> if needed.</div>`;
  }
  const days = c.byDay.map(d => d.day);
  const chart = days.length >= 2
    ? `<div class="cv-chart"><h3>Daily saved tokens this month (est)</h3>${renderLineChart(days, c.byDay.map(d => d.savedTokens), fmtTokens, { color: '#b197fc', id: 'copilot' })}</div>`
    : '';
  const models = c.models.length ? `<div class="muted">Models: ${escapeHtml(c.models.join(', '))}</div>` : '';
  const history = renderMonthlyHistory(c.byMonth, c.currentMonth, false);
  return `${status}
    <div class="cards">
      <div class="card accent-purple"><span>Saved Output Tokens <em>(est)</em></span><b>${fmtTokens(c.savedTokens)}</b></div>
      <div class="card accent-blue"><span>Output Tokens</span><b>${fmtTokens(c.outputTokens)}</b></div>
      <div class="card accent-orange"><span>Chats / Turns</span><b>${c.sessions} / ${c.turns}</b></div>
    </div>
    ${models}
    ${chart}
    ${history}
    <div class="muted cv-foot">Copilot keeps no local token log — output tokens are <b>counted</b> from chat transcripts with a real o200k_base tokenizer, but saved tokens are a <b>projection</b> (assume caveman compression, ~65%, was active — Copilot leaves no per-message marker). Copilot is subscription-billed, so no USD figure is shown.</div>`;
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

function renderHtml(data: CombinedSavings, updateStatus?: CavemanUpdateStatus): string {
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
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px 20px; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; }
  h2 { font-size: 1.05rem; margin: 22px 0 8px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
  h3 { font-size: 0.95rem; margin: 12px 0 4px; }
  .muted { color: var(--vscode-descriptionForeground); font-size: 0.85rem; }
  em { font-style: normal; opacity: 0.7; font-size: 0.85em; }
  a { color: var(--vscode-textLink-foreground); }
  code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; }
  .toolbar { display: flex; gap: 8px; margin: 12px 0; }
  button { font-family: inherit; font-size: 0.85rem; padding: 5px 12px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button:hover { background: var(--vscode-button-hoverBackground); }
  .cv-status { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 12px; }
  .cv-badge { font-size: 0.78rem; padding: 3px 10px; border-radius: 999px; border: 1px solid transparent; }
  .cv-on { background: #51cf6622; border-color: #51cf6655; color: #51cf66; }
  .cv-off { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0 12px; }
  .card { flex: 1 1 160px; min-width: 150px; padding: 12px 14px; border-radius: 8px; border-left: 4px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); box-shadow: 0 1px 2px rgba(0,0,0,0.12); display: flex; flex-direction: column; gap: 3px; transition: box-shadow 0.15s ease, transform 0.15s ease; }
  .card:hover { box-shadow: 0 3px 8px rgba(0,0,0,0.2); transform: translateY(-1px); }
  .card span { font-size: 0.8rem; color: var(--vscode-descriptionForeground); }
  .card b { font-size: 1.6rem; font-variant-numeric: tabular-nums; line-height: 1.1; }
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
  .provider-grid { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; margin-top: 8px; }
  .cv-provider { padding: 4px 16px 16px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-editorWidget-background); min-width: 0; }
  .cv-provider h2 { margin-top: 12px; }
  .cv-provider .cards { flex-direction: row; flex-wrap: wrap; }
  .cv-provider .card { flex: 1 1 160px; }
  .chart { width: 100%; max-width: 640px; height: auto; }
  .axis { fill: var(--vscode-descriptionForeground); font-size: 10px; }
  .grid { stroke: var(--vscode-panel-border); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.6; }
  .cv-ico { display: block; }
  .cv-panel { margin-top: 18px; padding: 18px 20px; border: 1px solid var(--vscode-panel-border); border-radius: 12px; background: var(--vscode-editorWidget-background); }
  .cv-installer { border-left: 3px solid #4dabf7; }
  .cv-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
  .cv-panel-title { display: flex; align-items: center; gap: 12px; }
  .cv-panel-ico { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; background: #4dabf71f; color: #4dabf7; flex: none; }
  .cv-panel-ico .cv-ico { width: 20px; height: 20px; }
  .cv-panel-title h3 { margin: 0; font-size: 1.02rem; }
  .cv-panel-sub { font-size: 0.8rem; color: var(--vscode-descriptionForeground); margin-top: 2px; }
  .cv-panel-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  #check-update, .cv-hero { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; padding: 7px 14px; border-radius: 8px; }
  #check-update .cv-ico, .cv-hero .cv-ico { width: 15px; height: 15px; }
  .cv-ghost { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); }
  .cv-ghost:hover { background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.14)); border-color: var(--vscode-focusBorder, #4dabf7); }
  .cv-hero { background: #4dabf7; color: #08203a; border: 1px solid #4dabf7; box-shadow: 0 2px 10px #4dabf73d; }
  .cv-hero:hover { background: #74c0fc; }
  .cv-group { margin-top: 16px; }
  .cv-group-label { display: flex; align-items: center; gap: 10px; font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 700; color: var(--vscode-descriptionForeground); margin-bottom: 10px; }
  .cv-group-label::after { content: ''; flex: 1; height: 1px; background: var(--vscode-panel-border); }
  .cv-actions { display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 10px; }
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
  .cv-table { border-collapse: collapse; width: 100%; max-width: 520px; font-size: 0.85rem; margin-top: 4px; }
  .cv-table th, .cv-table td { padding: 5px 10px; border-bottom: 1px solid var(--vscode-panel-border); text-align: left; }
  .cv-table th { color: var(--vscode-descriptionForeground); font-weight: 600; }
  .cv-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .cv-cur-row { background: #51cf6614; }
  .cv-cur { font-size: 0.7rem; color: #51cf66; border: 1px solid #51cf6655; border-radius: 999px; padding: 1px 6px; margin-left: 6px; }
  .cv-update { margin: 4px 0 12px; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; border: 1px solid transparent; }
  .cv-update-ok { background: #51cf6614; border-color: #51cf6655; }
  .cv-update-new { background: #ffa94d1a; border-color: #ffa94d66; }
  .cv-update-warn { background: #e0384522; border-color: #e0384555; color: #ff6b6b; }
</style>
</head>
<body>
  <h1>Caveman Dashboard</h1>
  <div class="muted">Estimated savings from the <a href="https://github.com/JuliusBrussee/caveman">caveman</a> output-compression plugin, split by provider.</div>
  <div class="toolbar">
    <button id="refresh">Refresh</button>
  </div>

  ${renderCavemanPanel(updateStatus)}

  ${renderTotals(claude, copilot, cost)}

  <div class="provider-grid">
    <section class="cv-provider">
      <h2>Claude Code</h2>
      ${renderClaude(claude, cost)}
    </section>
    <section class="cv-provider">
      <h2>GitHub Copilot <em>(estimated)</em></h2>
      ${renderCopilot(copilot)}
    </section>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ command: 'refresh' }));
    document.getElementById('check-update').addEventListener('click', () => vscode.postMessage({ command: 'checkUpdate' }));
    document.querySelectorAll('[data-cv]').forEach(b =>
      b.addEventListener('click', () => vscode.postMessage({ command: 'cavemanCli', action: b.getAttribute('data-cv') })));
  </script>
</body>
</html>`;
}
