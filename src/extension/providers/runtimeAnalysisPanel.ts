import * as vscode from 'vscode';

import { RuntimeDashboardViewState } from './runtimeDashboardPanel';

export type RuntimeAnalysisKind = 'cost' | 'cache' | 'retrieval';

export class RuntimeAnalysisPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  show(kind: RuntimeAnalysisKind, state: RuntimeDashboardViewState): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'tokenlint.runtimeAnalysis',
        panelTitle(kind),
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );
      this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'tokenlint.svg');
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    this.panel.title = panelTitle(kind);
    this.panel.webview.html = renderAnalysisHtml(kind, state);
  }
}

function panelTitle(kind: RuntimeAnalysisKind): string {
  switch (kind) {
    case 'cost':
      return 'TokenLint Runtime Cost Analysis';
    case 'cache':
      return 'TokenLint Cache Efficiency Analysis';
    case 'retrieval':
      return 'TokenLint Retrieval Amplification Analysis';
  }
}

function renderAnalysisHtml(kind: RuntimeAnalysisKind, state: RuntimeDashboardViewState): string {
  const nonce = String(Date.now());
  const latest = state.latestSession;
  const body = latest
    ? renderAnalysisBody(kind, state)
    : '<div class="empty">Run TokenLint runtime actions to generate telemetry before opening this analysis.</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: dark;
      --bg: color-mix(in srgb, var(--vscode-editor-background) 86%, #08111f 14%);
      --panel: color-mix(in srgb, var(--vscode-sideBar-background) 62%, #0b1728 38%);
      --panel-strong: color-mix(in srgb, var(--vscode-editor-background) 56%, #10213c 44%);
      --border: color-mix(in srgb, var(--vscode-panel-border, #22324d) 72%, #304868 28%);
      --text: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --accent: #5db7ff;
      --teal: #24c8ba;
      --amber: #f3bc47;
      --rose: #ff7d77;
      --violet: #8b89ff;
      --lime: #84d25f;
      --shadow: 0 18px 42px rgba(0, 0, 0, 0.26);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 24px;
      font-family: 'Inter', 'SF Pro Text', 'SF Pro Display', 'Segoe UI', var(--vscode-font-family);
      color: var(--text);
      background:
        radial-gradient(circle at 100% 0%, rgba(93, 183, 255, 0.16), transparent 30%),
        linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg) 82%, black 18%));
    }

    .shell {
      max-width: 1160px;
      margin: 0 auto;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 30px;
      font-weight: 840;
      letter-spacing: -0.04em;
    }

    .subtitle {
      margin: 0;
      color: var(--muted);
      max-width: 720px;
      line-height: 1.55;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 18px;
    }

    .wide-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 16px;
    }

    .card {
      background: linear-gradient(180deg, var(--panel), var(--panel-strong));
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 18px;
      box-shadow: var(--shadow);
    }

    .label {
      display: block;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }

    .metric {
      display: block;
      font-size: 32px;
      font-weight: 840;
      letter-spacing: -0.04em;
      margin-bottom: 6px;
    }

    .meta {
      color: var(--muted);
      line-height: 1.5;
      font-size: 13px;
    }

    .section-title {
      margin: 0 0 12px;
      font-size: 18px;
      font-weight: 760;
      letter-spacing: -0.02em;
    }

    .chart {
      min-height: 220px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015));
      padding: 16px;
    }

    .trend-svg {
      width: 100%;
      height: 180px;
      display: block;
    }

    .axis,
    .stat-strip {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 10px;
      color: var(--muted);
      font-size: 12px;
    }

    .bar-chart {
      display: flex;
      align-items: end;
      gap: 12px;
      min-height: 180px;
    }

    .bar-item {
      flex: 1 1 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .bar-column {
      width: 100%;
      border-radius: 12px 12px 6px 6px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--amber) 62%, white 38%), var(--amber));
    }

    .legend {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .legend-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 13px;
    }

    .donut-wrap {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 16px;
      align-items: center;
    }

    .donut {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      position: relative;
      margin: 0 auto;
    }

    .donut-hole {
      position: absolute;
      inset: 28px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--panel-strong) 90%, black 10%);
      border: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 14px;
    }

    .donut-hole strong {
      font-size: 24px;
      letter-spacing: -0.03em;
      margin-bottom: 4px;
    }

    ul {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.6;
    }

    .empty {
      padding: 28px;
      border: 1px dashed var(--border);
      border-radius: 18px;
      text-align: center;
      color: var(--muted);
    }

    @media (max-width: 980px) {
      .grid,
      .wide-grid,
      .donut-wrap {
        grid-template-columns: 1fr;
      }

      .topbar {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="shell">${body}</div>
  <script nonce="${nonce}"></script>
</body>
</html>`;
}

function renderAnalysisBody(kind: RuntimeAnalysisKind, state: RuntimeDashboardViewState): string {
  switch (kind) {
    case 'cost':
      return renderCostAnalysis(state);
    case 'cache':
      return renderCacheAnalysis(state);
    case 'retrieval':
      return renderRetrievalAnalysis(state);
  }
}

function renderCostAnalysis(state: RuntimeDashboardViewState): string {
  const latest = state.latestSession!;
  const points = state.costOverTime.map(point => ({ label: formatDateLabel(point.date), value: point.cost }));

  return [
    renderTopbar(
      'Runtime Cost Analysis',
      'Understand why spend increased, which model concentration is driving runtime cost, and where savings remain available.',
      'Cost'
    ),
    '<div class="grid">',
    metricCard('Window Spend', formatCurrency(state.summary.totalCost), trendText(points, 'currency', 'vs previous period'), 'Aggregate runtime spend in the active window.'),
    metricCard('Estimated Savings', formatCurrency(state.summary.estimatedSavings), `${formatPercent(state.summary.averageCacheEfficiency)} cache efficiency`, 'Savings unlocked by reuse and prompt stability.'),
    metricCard('Model Lead', escapeHtml(state.costByModel[0]?.model ?? 'N/A'), `${state.costByModel[0]?.percent.toFixed(1) ?? '0.0'}% of spend`, 'Primary model concentration in this workload.'),
    '</div>',
    '<div class="wide-grid">',
    '<section class="card"><h2 class="section-title">Daily Spend Trend</h2>' + renderLineChart(points, 'var(--accent)', formatCurrency) + '</section>',
    '<section class="card"><h2 class="section-title">Model Usage Distribution</h2>' + renderDonut(state.costByModel, formatCurrency, 'Total Spend', formatCurrency(state.summary.totalCost)) + '</section>',
    '</div>',
    '<div class="wide-grid" style="margin-top:16px;">',
    '<section class="card"><h2 class="section-title">Runtime Story</h2><ul>'
      + `<li>Latest session: ${escapeHtml(latest.title)} using ${escapeHtml(latest.model)} cost ${formatCurrency(latest.estimatedCost)}.</li>`
      + `<li>Prompt volume reached ${formatCompact(latest.promptTokens, ' tokens')} with ${formatCompact(latest.completionTokens, ' tokens')} completion output.</li>`
      + `<li>Model concentration is ${state.costByModel[0]?.percent.toFixed(1) ?? '0.0'}% on ${escapeHtml(state.costByModel[0]?.model ?? 'N/A')}.</li>`
      + `<li>Cache reuse recovered ${formatCurrency(state.summary.estimatedSavings)} in avoided spend.</li>`
      + '</ul></section>',
    '<section class="card"><h2 class="section-title">Optimization Recommendations</h2><ul>'
      + buildCostRecommendations(state).map(item => `<li>${escapeHtml(item)}</li>`).join('')
      + '</ul></section>',
    '</div>'
  ].join('');
}

function renderCacheAnalysis(state: RuntimeDashboardViewState): string {
  const latest = state.latestSession!;
  const points = state.cacheEfficiencyTrend.map(point => ({ label: formatDateLabel(point.date), value: point.efficiency }));

  return [
    renderTopbar(
      'Cache Efficiency Analysis',
      'Explain prompt stability, cache reuse quality, and how dynamic regions are suppressing savings across the runtime window.',
      'Cache'
    ),
    '<div class="grid">',
    metricCard('Cache Efficiency', formatPercent(state.summary.averageCacheEfficiency), trendText(points, 'percent', 'this window'), 'Average prompt reuse quality.'),
    metricCard('Estimated Savings', formatCurrency(state.summary.estimatedSavings), `Prompt stability ${formatPercent(state.summary.stablePromptRegions)}`, 'Savings preserved through repeated prompt regions.'),
    metricCard('Context Health', `${formatNumber(state.summary.contextHealth)} / 100`, `${String(state.summary.reasoningRisk).toUpperCase()} reasoning risk`, 'Composite context health signature.'),
    '</div>',
    '<div class="wide-grid">',
    '<section class="card"><h2 class="section-title">Cache Efficiency Trend</h2>' + renderLineChart(points, 'var(--teal)', formatPercent) + '</section>',
    '<section class="card"><h2 class="section-title">Cache Usage Breakdown</h2>' + renderCacheDonut(state) + '</section>',
    '</div>',
    '<div class="wide-grid" style="margin-top:16px;">',
    '<section class="card"><h2 class="section-title">Runtime Story</h2><ul>'
      + `<li>Latest session reused ${formatCompact(latest.cacheReadTokens, ' tokens')} from cache and created ${formatCompact(latest.cacheCreateTokens, ' tokens')} fresh cache regions.</li>`
      + `<li>Prompt stability is ${formatPercent(latest.promptStability)}, which is ${latest.promptStability < 55 ? 'too volatile for reliable reuse.' : 'healthy enough to compound savings.'}</li>`
      + `<li>Total prompt volume in the active window is ${formatCompact(state.cacheBreakdown.totalTokens, ' tokens')}.</li>`
      + '</ul></section>',
    '<section class="card"><h2 class="section-title">Optimization Recommendations</h2><ul>'
      + buildCacheRecommendations(state).map(item => `<li>${escapeHtml(item)}</li>`).join('')
      + '</ul></section>',
    '</div>'
  ].join('');
}

function renderRetrievalAnalysis(state: RuntimeDashboardViewState): string {
  const latest = state.latestSession!;
  const points = state.retrievalAmplification.map(point => ({ label: formatDateLabel(point.date), value: point.amplification }));
  const peak = Math.max(0, ...state.retrievalAmplification.map(point => point.amplification));

  return [
    renderTopbar(
      'Retrieval Amplification Analysis',
      'Show how retrieval breadth inflates context, drives cognitive pressure, and converts context tokens into waste.',
      'Retrieval'
    ),
    '<div class="grid">',
    metricCard('Latest Amplification', formatNumber(latest.retrievalAmplification, 'x'), `${formatPercent(latest.contextPressure)} context pressure`, 'Current session retrieval expansion.'),
    metricCard('Average Amplification', formatNumber(state.summary.averageRetrievalAmplification, 'x'), `${formatPercent(state.summary.estimatedWaste)} estimated waste`, 'Average retrieval expansion inside the active window.'),
    metricCard('Peak Amplification', formatNumber(peak, 'x'), `${String(state.summary.reasoningRisk).toUpperCase()} reasoning risk`, 'Maximum retrieval breadth detected in the current window.'),
    '</div>',
    '<div class="wide-grid">',
    '<section class="card"><h2 class="section-title">Amplification Timeline</h2>' + renderBarChart(points, formatNumber) + '</section>',
    '<section class="card"><h2 class="section-title">Retrieval Story</h2><ul>'
      + `<li>Latest session touched ${latest.retrievalFiles.length} retrieval-linked files.</li>`
      + `<li>Retrieved context is inflating the runtime window by ${formatNumber(latest.retrievalAmplification, 'x')}.</li>`
      + `<li>Context pressure is ${formatPercent(latest.contextPressure)} and waste is ${formatPercent(state.summary.estimatedWaste)}.</li>`
      + `<li>Latest retrieval files: ${escapeHtml(latest.retrievalFiles.join(', ') || 'None')}.</li>`
      + '</ul></section>',
    '</div>',
    '<div class="wide-grid" style="margin-top:16px;">',
    '<section class="card"><h2 class="section-title">Why It Became Expensive</h2><ul>'
      + buildRetrievalStory(state).map(item => `<li>${escapeHtml(item)}</li>`).join('')
      + '</ul></section>',
    '<section class="card"><h2 class="section-title">Optimization Recommendations</h2><ul>'
      + buildRetrievalRecommendations(state).map(item => `<li>${escapeHtml(item)}</li>`).join('')
      + '</ul></section>',
    '</div>'
  ].join('');
}

function renderTopbar(title: string, subtitle: string, badge: string): string {
  return `<div class="topbar"><div><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p></div><div class="badge">${escapeHtml(badge)} Panel</div></div>`;
}

function metricCard(label: string, metric: string, delta: string, meta: string): string {
  return `<section class="card"><span class="label">${escapeHtml(label)}</span><strong class="metric">${metric}</strong><div class="meta">${escapeHtml(delta)}<br>${escapeHtml(meta)}</div></section>`;
}

function renderLineChart(
  points: Array<{ label: string; value: number }>,
  color: string,
  formatter: (value: number) => string
): string {
  if (points.length === 0) {
    return '<div class="chart-empty">No trend data available yet.</div>';
  }

  const width = 440;
  const height = 180;
  const padding = 18;
  const geometry = buildLineGeometry(points, width, height, padding);
  const labels = pickAxisLabels(points);
  const gradientId = `analysis-gradient-${points.length}-${Math.round(geometry.maxValue * 100)}`;

  return ''
    + '<div class="chart">'
    + '  <svg class="trend-svg" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">'
    + '    <defs>'
    + '      <linearGradient id="' + gradientId + '" x1="0" y1="0" x2="0" y2="1">'
    + '        <stop offset="0%" stop-color="' + color + '" stop-opacity="0.28"></stop>'
    + '        <stop offset="100%" stop-color="' + color + '" stop-opacity="0.02"></stop>'
    + '      </linearGradient>'
    + '    </defs>'
    + '    <path d="' + geometry.areaPath + '" fill="url(#' + gradientId + ')"></path>'
    + '    <path d="' + geometry.linePath + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>'
    + geometry.coordinates.map(point => `<circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${color}"></circle>`).join('')
    + '  </svg>'
    + '  <div class="axis">' + labels.map(point => `<span>${escapeHtml(point.label)}</span>`).join('') + '</div>'
    + '  <div class="stat-strip"><span>Min ' + escapeHtml(formatter(geometry.minValue)) + '</span><span>Max ' + escapeHtml(formatter(geometry.maxValue)) + '</span></div>'
    + '</div>';
}

function renderBarChart(
  points: Array<{ label: string; value: number }>,
  formatter: (value: number, suffix?: string) => string
): string {
  if (points.length === 0) {
    return '<div class="chart-empty">No bar data available yet.</div>';
  }

  const maxValue = Math.max(...points.map(point => point.value), 1);
  return '<div class="chart"><div class="bar-chart">'
    + points.map(point => {
      const height = Math.max(12, Math.round((point.value / maxValue) * 140));
      return `<div class="bar-item"><div class="meta">${escapeHtml(formatter(point.value, 'x'))}</div><div class="bar-column" style="height:${height}px;"></div><div class="meta">${escapeHtml(point.label)}</div></div>`;
    }).join('')
    + '</div></div>';
}

function renderDonut(
  entries: RuntimeDashboardViewState['costByModel'],
  formatter: (value: number) => string,
  centerLabel: string,
  centerValue: string
): string {
  const visibleEntries = entries.filter(entry => entry.cost > 0);
  if (visibleEntries.length === 0) {
    return '<div class="chart-empty">No model distribution data available yet.</div>';
  }

  const palette = ['var(--accent)', 'var(--teal)', 'var(--violet)', 'var(--amber)', 'var(--rose)', 'var(--lime)'];
  const total = visibleEntries.reduce((sum, entry) => sum + entry.cost, 0);
  let offset = 0;
  const gradient = visibleEntries.map((entry, index) => {
    const start = offset;
    offset += (entry.cost / total) * 100;
    return `${palette[index % palette.length]} ${start}% ${offset}%`;
  }).join(', ');

  return '<div class="chart"><div class="donut-wrap">'
    + `<div class="donut" style="background: conic-gradient(${gradient});"><div class="donut-hole"><strong>${escapeHtml(centerValue)}</strong><span>${escapeHtml(centerLabel)}</span></div></div>`
    + '<div class="legend">'
    + visibleEntries.map((entry, index) => `<div class="legend-row"><span>${escapeHtml(entry.model)} (${entry.percent.toFixed(1)}%)</span><strong>${escapeHtml(formatter(entry.cost))}</strong></div>`).join('')
    + '</div></div></div>';
}

function renderCacheDonut(state: RuntimeDashboardViewState): string {
  const segments = [
    { label: 'Cache Read', value: state.cacheBreakdown.cacheReadTokens, color: 'var(--teal)' },
    { label: 'Cache Create', value: state.cacheBreakdown.cacheCreateTokens, color: 'var(--amber)' }
  ].filter(segment => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) {
    return '<div class="chart-empty">No cache activity available yet.</div>';
  }

  let offset = 0;
  const gradient = segments.map(segment => {
    const start = offset;
    offset += (segment.value / total) * 100;
    return `${segment.color} ${start}% ${offset}%`;
  }).join(', ');

  return '<div class="chart"><div class="donut-wrap">'
    + `<div class="donut" style="background: conic-gradient(${gradient});"><div class="donut-hole"><strong>${escapeHtml(formatCompact(state.cacheBreakdown.totalTokens, ' tokens'))}</strong><span>Prompt Volume</span></div></div>`
    + '<div class="legend">'
    + segments.map(segment => `<div class="legend-row"><span>${escapeHtml(segment.label)}</span><strong>${escapeHtml(formatCompact(segment.value, ' tokens'))}</strong></div>`).join('')
    + `<div class="legend-row"><span>Saved Spend</span><strong>${escapeHtml(formatCurrency(state.summary.estimatedSavings))}</strong></div>`
    + '</div></div></div>';
}

function buildCostRecommendations(state: RuntimeDashboardViewState): string[] {
  const primaryModel = state.costByModel[0];
  const recommendations: string[] = [];

  if (primaryModel && primaryModel.model !== 'GPT-5 mini') {
    recommendations.push(`Current workload overuses ${primaryModel.model}. Test GPT-5 mini for lower-complexity runs.`);
  }

  if (state.summary.estimatedSavings > 0.1) {
    recommendations.push(`Cache reuse already recovered ${formatCurrency(state.summary.estimatedSavings)}. Stabilize prompt regions to expand those savings.`);
  }

  if (state.summary.estimatedWaste >= 35) {
    recommendations.push(`Estimated waste is ${formatPercent(state.summary.estimatedWaste)}. Retrieval scope and prompt verbosity are the first places to trim.`);
  }

  return recommendations.length > 0
    ? recommendations
    : ['Current spend profile looks healthy. Focus on retaining this model mix and cache efficiency.'];
}

function buildCacheRecommendations(state: RuntimeDashboardViewState): string[] {
  const latest = state.latestSession!;
  const recommendations: string[] = [];

  if (latest.promptStability < 55) {
    recommendations.push('Prompt stability is low. Large dynamic regions are reducing cache reuse.');
  }

  if (state.summary.averageCacheEfficiency < 40) {
    recommendations.push('Cache efficiency is below target. Extract stable prompt scaffolding from volatile user-specific regions.');
  }

  if (latest.cacheReadTokens < latest.cacheCreateTokens) {
    recommendations.push('Fresh cache creation dominates reuse. Repeated instructions and memory scaffolding should be normalized.');
  }

  return recommendations.length > 0
    ? recommendations
    : ['Cache reuse is healthy. Maintain stable prompt templates and reduce unnecessary dynamic fragments.'];
}

function buildRetrievalStory(state: RuntimeDashboardViewState): string[] {
  const latest = state.latestSession!;
  return [
    `Retrieved context expanded the latest runtime by ${formatNumber(latest.retrievalAmplification, 'x')}.`,
    `Average retrieval amplification is ${formatNumber(state.summary.averageRetrievalAmplification, 'x')} in the active window.`,
    `Context pressure reached ${formatPercent(latest.contextPressure)} and drove reasoning risk to ${String(state.summary.reasoningRisk).toUpperCase()}.`,
    `Estimated waste is ${formatPercent(state.summary.estimatedWaste)}, indicating noisy retrieval or low-quality chunk targeting.`
  ];
}

function buildRetrievalRecommendations(state: RuntimeDashboardViewState): string[] {
  const recommendations: string[] = [];

  if (state.summary.averageRetrievalAmplification >= 4) {
    recommendations.push('Retrieval amplification is excessive. Reduce breadth, improve chunk ranking, or lower top_k.');
  }

  if (state.summary.estimatedWaste >= 40) {
    recommendations.push(`Retrieved context appears noisy. Only a subset of the current window is likely useful.`);
  }

  if (state.summary.averageContextPressure >= 65) {
    recommendations.push('Context pressure is high. Remove low-signal tool output and memory payloads from the retrieval path.');
  }

  return recommendations.length > 0
    ? recommendations
    : ['Retrieval overhead is controlled. Maintain current ranking quality and keep chunk selection disciplined.'];
}

function buildLineGeometry(points: Array<{ label: string; value: number }>, width: number, height: number, padding: number) {
  const values = points.map(point => point.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const span = maxValue - minValue || 1;
  const baseline = height - padding;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const coordinates = points.map((point, index) => {
    const x = padding + (points.length === 1 ? usableWidth / 2 : (usableWidth * index) / Math.max(points.length - 1, 1));
    const normalized = (point.value - minValue) / span;
    const y = baseline - normalized * usableHeight;
    return { x, y, label: point.label, value: point.value };
  });

  return {
    coordinates,
    linePath: coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' '),
    areaPath: coordinates.length === 0
      ? ''
      : `M${coordinates[0].x} ${baseline} ${coordinates.map(point => `L${point.x} ${point.y}`).join(' ')} L${coordinates[coordinates.length - 1].x} ${baseline} Z`,
    minValue,
    maxValue
  };
}

function pickAxisLabels(points: Array<{ label: string; value: number }>) {
  if (points.length <= 3) {
    return points;
  }

  const middleIndex = Math.floor((points.length - 1) / 2);
  return [points[0], points[middleIndex], points[points.length - 1]];
}

function trendText(points: Array<{ label: string; value: number }>, format: 'currency' | 'percent', suffix: string): string {
  if (points.length < 2) {
    return `No prior comparison ${suffix}`;
  }

  const previous = points[points.length - 2].value;
  const current = points[points.length - 1].value;
  const delta = current - previous;
  const arrow = delta >= 0 ? '↑' : '↓';
  const absolute = format === 'currency' ? formatCurrency(Math.abs(delta)) : formatPercent(Math.abs(delta));
  return `${arrow} ${absolute} ${suffix}`;
}

function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function formatNumber(value: number, suffix = ''): string {
  return `${new Intl.NumberFormat('en-US').format(Math.round(value * 10) / 10)}${suffix}`;
}

function formatCompact(value: number, suffix = ''): string {
  return `${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}