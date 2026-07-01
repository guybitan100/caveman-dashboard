import * as vscode from 'vscode';
import { CavemanSavings, CombinedSavings, CopilotSavings } from '../types';

/**
 * Standalone webview for caveman savings, split by provider (Claude Code + Copilot).
 * Renders per-provider savings cards, Claude status + daily USD chart, a Copilot
 * estimate section, and installer/CLI action buttons.
 */
export class CavemanPanel {
  static currentPanel: CavemanPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

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
    this.panel.webview.onDidReceiveMessage(message => {
      if (message?.command === 'refresh') vscode.commands.executeCommand('cavemanDashboard.refresh');
      if (message?.command === 'cavemanCli') vscode.commands.executeCommand('cavemanDashboard.cavemanCli', message.action);
    }, undefined, context.subscriptions);
    this.update(data);
  }

  update(data: CombinedSavings) {
    this.panel.webview.html = renderHtml(data);
  }
}

function showCost(): boolean {
  return vscode.workspace.getConfiguration('cavemanDashboard').get<boolean>('showCost', false);
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
function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}
function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}

// Installer CLI actions exposed as buttons. data-cv maps to cavemanDashboard.cavemanCli.
const CAVEMAN_ACTIONS = `
  <div class="cv-actions">
    <button class="cv-btn" data-cv="install" title="--non-interactive">Install</button>
    <button class="cv-btn" data-cv="all" title="--all (hooks + per-repo init)">Install + hooks/init</button>
    <button class="cv-btn" data-cv="minimal" title="--minimal (plugin only)">Install minimal</button>
    <button class="cv-btn cv-safe" data-cv="dry-run" title="--dry-run (no changes)">Dry run</button>
    <button class="cv-btn cv-safe" data-cv="list" title="--list (provider matrix)">List providers</button>
    <button class="cv-btn" data-cv="force" title="--force (reinstall)">Force reinstall</button>
    <button class="cv-btn cv-danger" data-cv="uninstall" title="--uninstall">Uninstall</button>
  </div>`;

/** Minimal inline SVG line chart for a single daily series. */
function renderLineChart(days: string[], values: number[], fmt: (n: number) => string): string {
  const w = 640, h = 200, padL = 48, padR = 16, padT = 16, padB = 28;
  const max = Math.max(...values, 0) || 1;
  const n = values.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (w - padL - padR));
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `M ${x(0).toFixed(1)},${(h - padB).toFixed(1)} L ${values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L ')} L ${x(n - 1).toFixed(1)},${(h - padB).toFixed(1)} Z`;
  const dots = values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="#51cf66"><title>${escapeHtml(days[i])}: ${escapeHtml(fmt(v))}</title></circle>`).join('');
  const xLabels = days.map((d, i) => `<text x="${x(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" class="axis">${escapeHtml(d.slice(5))}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Daily savings chart">
    <text x="4" y="${padT + 4}" class="axis">${escapeHtml(fmt(max))}</text>
    <text x="4" y="${h - padB}" class="axis">0</text>
    <path d="${area}" fill="#51cf6622" stroke="none" />
    <polyline points="${pts}" fill="none" stroke="#51cf66" stroke-width="2" />
    ${dots}${xLabels}
  </svg>`;
}

/** Top row: per-provider saved totals for the current month. */
function renderTotals(claude: CavemanSavings, copilot: CopilotSavings, cost: boolean): string {
  const total = claude.savedTokens + copilot.savedTokens;
  const claudeUsd = cost ? `<small>${money(claude.savedUsd)} saved</small>` : '';
  const label = fmtMonth(claude.currentMonth);
  return `<div class="muted cv-month">This month · <b>${escapeHtml(label)}</b> <span class="cv-reset">(resets on the 1st — history kept below)</span></div>
  <div class="cards">
    <div class="card accent-green"><span>Total Saved Tokens</span><b>${fmtTokens(total)}</b><small>Claude + Copilot</small></div>
    <div class="card accent-orange"><span>Claude Saved</span><b>${fmtTokens(claude.savedTokens)}</b>${claudeUsd}</div>
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
      ? `<div class="cv-chart"><h3>Daily savings this month (USD)</h3><div class="muted">Estimated output-token value saved per day.</div>${renderLineChart(days, c.byDay.map(d => d.savedUsd), money)}</div>`
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
    ? `<div class="cv-chart"><h3>Daily saved tokens this month (est)</h3>${renderLineChart(days, c.byDay.map(d => d.savedTokens), fmtTokens)}</div>`
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

function renderHtml(data: CombinedSavings): string {
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
  .card { flex: 1 1 160px; min-width: 150px; padding: 12px 14px; border-radius: 8px; border-left: 4px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); display: flex; flex-direction: column; gap: 2px; }
  .card span { font-size: 0.8rem; color: var(--vscode-descriptionForeground); }
  .card b { font-size: 1.5rem; }
  .card small { font-size: 0.72rem; color: var(--vscode-descriptionForeground); }
  .accent-green { border-left-color: #51cf66; }
  .accent-purple { border-left-color: #b197fc; }
  .accent-blue { border-left-color: #4dabf7; }
  .accent-orange { border-left-color: #ffa94d; }
  .cv-note, .cv-empty { padding: 12px 14px; background: var(--vscode-editorWidget-background); border-radius: 8px; }
  .provider-grid { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; margin-top: 8px; }
  .cv-provider { padding: 4px 16px 16px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-editorWidget-background); min-width: 0; }
  .cv-provider h2 { margin-top: 12px; }
  .cv-provider .cards { flex-direction: row; flex-wrap: wrap; }
  .cv-provider .card { flex: 1 1 160px; }
  .chart { width: 100%; max-width: 640px; height: auto; }
  .axis { fill: var(--vscode-descriptionForeground); font-size: 10px; }
  .cv-panel { margin-top: 16px; padding: 14px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; }
  .cv-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
  .cv-safe { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .cv-danger { background: #e0384522; color: #ff6b6b; border-color: #e0384555; }
  .cv-foot { margin-top: 8px; }
  .cv-month { margin: 12px 0 6px; }
  .cv-reset { opacity: 0.7; }
  .cv-history { margin-top: 14px; }
  .cv-table { border-collapse: collapse; width: 100%; max-width: 520px; font-size: 0.85rem; margin-top: 4px; }
  .cv-table th, .cv-table td { padding: 5px 10px; border-bottom: 1px solid var(--vscode-panel-border); text-align: left; }
  .cv-table th { color: var(--vscode-descriptionForeground); font-weight: 600; }
  .cv-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .cv-cur-row { background: #51cf6614; }
  .cv-cur { font-size: 0.7rem; color: #51cf66; border: 1px solid #51cf6655; border-radius: 999px; padding: 1px 6px; margin-left: 6px; }
</style>
</head>
<body>
  <h1>Caveman Dashboard</h1>
  <div class="muted">Estimated savings from the <a href="https://github.com/JuliusBrussee/caveman">caveman</a> output-compression plugin, split by provider.</div>
  <div class="toolbar">
    <button id="refresh">Refresh</button>
  </div>

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

  <div class="cv-panel">
    <h3>Installer &amp; CLI actions</h3>
    ${CAVEMAN_ACTIONS}
    <div class="muted cv-foot">Installer actions download and run the <b>latest</b> installer (<code>curl … main/install.sh | bash</code>) in a terminal (state-changing actions confirm first). Slash commands (<code>/caveman</code>, <code>/caveman-stats</code>, …) run inside Claude Code, not here. Savings are estimated (only <code>full</code> mode benchmarked, ≈65% output reduction) — output-token value, not billed.</div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ command: 'refresh' }));
    document.querySelectorAll('.cv-btn').forEach(b =>
      b.addEventListener('click', () => vscode.postMessage({ command: 'cavemanCli', action: b.getAttribute('data-cv') })));
  </script>
</body>
</html>`;
}
