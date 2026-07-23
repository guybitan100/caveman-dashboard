import { CavemanDayPoint, CavemanMonthPoint, CavemanSavings } from '../types';
import { calculateCostBreakdown, round2 } from './costEngine';

/** Current calendar month as YYYY-MM. */
export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Today's date as YYYY-MM-DD (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const CAVEMAN_COMPRESSING_MODES = new Set([
  'lite',
  'full',
  'ultra',
  'wenyan',
  'wenyan-ultra',
  'commit',
  'review',
  'compress',
]);

/**
 * Upstream caveman now states one flat headline savings number: 65% output-token
 * reduction across caveman brevity modes. Apply that ratio to recognized caveman
 * modes so local estimates do not silently drop to zero for non-full sessions.
 */
export const CAVEMAN_COMPRESSION = 0.65;

/** Estimated output tokens saved by caveman for one session, mirroring caveman-stats.js. */
export function estimateSavedTokens(outputTokens: number, mode: string | undefined): number {
  const normalizedMode = mode?.trim().toLowerCase();
  if (!normalizedMode || outputTokens <= 0 || !CAVEMAN_COMPRESSING_MODES.has(normalizedMode)) return 0;
  return Math.round(outputTokens / (1 - CAVEMAN_COMPRESSION)) - outputTokens;
}

/** USD value of saved output tokens at the given model's output rate. */
export function savedUsd(model: string, savedTokens: number): number {
  if (savedTokens <= 0) return 0;
  // outputCost of N output tokens == N * outputRate / 1e6 — reuses per-model pricing.
  return calculateCostBreakdown(model, 0, savedTokens, 0, 0).outputCost;
}

/** One caveman session's contribution before aggregation. */
export type CavemanSessionInput = {
  day: string;
  model: string;
  outputTokens: number;
  cacheReadTokens?: number;
  /** Detected caveman mode for the session, or undefined if unknown. */
  mode?: string;
  /** Pre-computed values from caveman's own ledger; preferred when present. */
  ledgerSavedTokens?: number;
  ledgerSavedUsd?: number;
  fromLedger?: boolean;
};

/**
 * Aggregate per-session caveman inputs into the dashboard's CavemanSavings shape.
 * Headline figures cover only `currentMonth` (they reset at the start of each month);
 * full per-month history is preserved in `byMonth`.
 */
export function aggregateCaveman(
  sessions: CavemanSessionInput[],
  status?: { installed?: boolean; activeMode?: string | null; defaultMode?: string | null },
  currentMonth: string = currentMonthKey(),
): CavemanSavings {
  const days = new Map<string, CavemanDayPoint>();          // current month only
  const months = new Map<string, CavemanMonthPoint>();       // full history
  let currentMonthCacheReadTokens = 0;
  let counted = 0;
  let anyLedger = false;
  let anyEstimated = false;

  for (const s of sessions) {
    const sTokens = s.fromLedger && s.ledgerSavedTokens != null
      ? s.ledgerSavedTokens
      : estimateSavedTokens(s.outputTokens, s.mode);
    const sUsd = s.fromLedger && s.ledgerSavedUsd != null
      ? s.ledgerSavedUsd
      : savedUsd(s.model, sTokens);

    // A session counts if caveman touched it, even when the mode has no benchmark
    // (saved = 0) — it still represents caveman usage.
    if (!s.fromLedger && !s.mode) continue;
    counted += 1;
    if (s.fromLedger) anyLedger = true; else anyEstimated = true;

    const month = s.day.slice(0, 7);
    const m = months.get(month) ?? { month, savedTokens: 0, savedUsd: 0, sessions: 0, outputTokens: 0 };
    m.savedTokens += sTokens;
    m.savedUsd = round2(m.savedUsd + sUsd);
    m.sessions += 1;
    m.outputTokens += s.outputTokens;
    months.set(month, m);

    // Per-day series only needs the current month (that is all the chart shows).
    if (month === currentMonth) {
      const d = days.get(s.day) ?? { day: s.day, savedTokens: 0, savedUsd: 0 };
      d.savedTokens += sTokens;
      d.savedUsd = round2(d.savedUsd + sUsd);
      days.set(s.day, d);
      currentMonthCacheReadTokens += s.cacheReadTokens ?? 0;
    }
  }

  const source: CavemanSavings['source'] = counted === 0
    ? 'none'
    : anyLedger && anyEstimated ? 'mixed' : anyLedger ? 'ledger' : 'estimated';
  const cur = months.get(currentMonth);

  return {
    active: counted > 0,
    currentMonth,
    sessions: cur?.sessions ?? 0,
    outputTokens: cur?.outputTokens ?? 0,
    savedTokens: cur?.savedTokens ?? 0,
    savedUsd: cur?.savedUsd ?? 0,
    cacheReadTokens: currentMonthCacheReadTokens,
    byDay: Array.from(days.values()).sort((a, b) => a.day.localeCompare(b.day)),
    byMonth: Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)),
    source,
    installed: status?.installed ?? false,
    activeMode: status?.activeMode ?? null,
    defaultMode: status?.defaultMode ?? null,
    lifetimeSessions: 0,
    lifetimeOutputTokens: 0,
    lifetimeSavedTokens: 0,
    lifetimeSavedUsd: 0,
    statuslineSavingsText: null,
    memoryCompressed: null,
  };
}

/**
 * Extract the caveman mode from a transcript line carrying the activation marker.
 * caveman writes two marker shapes and modes can be hyphenated (e.g. wenyan-ultra):
 *   - UserPromptSubmit tracker: `CAVEMAN MODE ACTIVE (full)`
 *   - SessionStart hook:        `CAVEMAN MODE ACTIVE — level: full`
 * Match both so em-dash-only sessions are not misread as "No usage detected".
 */
export function detectCavemanMode(text: string): string | undefined {
  const m = /CAVEMAN MODE ACTIVE\s*(?:\(([\w-]+)\)|(?:—|–|-)\s*level:\s*([\w-]+))/i.exec(text);
  const mode = m?.[1] ?? m?.[2];
  return mode ? mode.toLowerCase() : undefined;
}
