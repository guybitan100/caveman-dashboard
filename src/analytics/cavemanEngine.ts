import { CavemanDayPoint, CavemanMonthPoint, CavemanSavings } from '../types';
import { calculateCostBreakdown } from './costEngine';

/** Current calendar month as YYYY-MM. */
export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Mean per-task output compression by caveman mode, taken from the plugin's own
 * benchmarks (caveman-stats.js: only 'full' has measured data — others get no
 * estimate). Saved output tokens for a session: round(output / (1 - ratio)) - output.
 */
export const CAVEMAN_COMPRESSION: Record<string, number> = { full: 0.65 };

/** Estimated output tokens saved by caveman for one session, mirroring caveman-stats.js. */
export function estimateSavedTokens(outputTokens: number, mode: string | undefined): number {
  const ratio = mode ? CAVEMAN_COMPRESSION[mode] : undefined;
  if (!ratio || outputTokens <= 0) return 0;
  return Math.round(outputTokens / (1 - ratio)) - outputTokens;
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
  status?: { installed?: boolean; activeMode?: string | null },
  currentMonth: string = currentMonthKey(),
): CavemanSavings {
  const days = new Map<string, CavemanDayPoint>();          // current month only
  const months = new Map<string, CavemanMonthPoint>();       // full history
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
    m.savedUsd = Math.round((m.savedUsd + sUsd) * 100) / 100;
    m.sessions += 1;
    m.outputTokens += s.outputTokens;
    months.set(month, m);

    // Per-day series only needs the current month (that is all the chart shows).
    if (month === currentMonth) {
      const d = days.get(s.day) ?? { day: s.day, savedTokens: 0, savedUsd: 0 };
      d.savedTokens += sTokens;
      d.savedUsd = Math.round((d.savedUsd + sUsd) * 100) / 100;
      days.set(s.day, d);
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
    byDay: Array.from(days.values()).sort((a, b) => a.day.localeCompare(b.day)),
    byMonth: Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)),
    source,
    installed: status?.installed ?? false,
    activeMode: status?.activeMode ?? null,
  };
}

/** Extract the caveman mode from a transcript line carrying the activation marker. */
export function detectCavemanMode(text: string): string | undefined {
  const m = /CAVEMAN MODE ACTIVE \((\w+)\)/.exec(text);
  return m ? m[1].toLowerCase() : undefined;
}
