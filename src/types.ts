export type CavemanDayPoint = { day: string; savedTokens: number; savedUsd: number };

export type CavemanMemoryCompression = {
  count: number;
  tokensSaved: number;
};

/** One calendar month of caveman savings (YYYY-MM), for the reset-each-month history. */
export type CavemanMonthPoint = {
  month: string;
  savedTokens: number;
  savedUsd: number;
  sessions: number;
  outputTokens: number;
};

export type CavemanSavings = {
  /** True when any caveman usage was detected in history (ledger entry or transcript marker). */
  active: boolean;
  /** Current month in effect for the headline numbers (YYYY-MM). */
  currentMonth: string;
  /**
   * Headline figures below cover ONLY the current month — they reset to 0 at the start
   * of each month. Full history is preserved in byMonth.
   */
  /** Caveman sessions counted this month. */
  sessions: number;
  /** Output tokens produced in caveman sessions this month. */
  outputTokens: number;
  /** Estimated output tokens saved by compression this month. */
  savedTokens: number;
  /** Estimated USD saved this month (saved output tokens at each model's output rate). */
  savedUsd: number;
  /** Cache-read input tokens observed this month from Claude session logs. */
  cacheReadTokens: number;
  /** Per-day saved tokens / USD for the current month, ascending by day. */
  byDay: CavemanDayPoint[];
  /** Per-month history (all months, ascending), preserved across the monthly reset. */
  byMonth: CavemanMonthPoint[];
  /** Where the numbers came from: caveman's own ledger, our estimate, or both. */
  source: 'ledger' | 'estimated' | 'mixed' | 'none';
  /** caveman plugin present on this machine (plugin cache dir found). */
  installed: boolean;
  /** Current caveman mode from the .caveman-active flag (e.g. "full"), or null if off/absent. */
  activeMode: string | null;
  /** Resolved caveman default mode from env/repo/user config (e.g. "lite", "full", "off"). */
  defaultMode: string | null;
  /** Lifetime caveman sessions tracked by /caveman-stats history. */
  lifetimeSessions: number;
  /** Lifetime output tokens tracked by /caveman-stats history. */
  lifetimeOutputTokens: number;
  /** Lifetime saved output tokens tracked by /caveman-stats history. */
  lifetimeSavedTokens: number;
  /** Lifetime saved USD tracked by /caveman-stats history. */
  lifetimeSavedUsd: number;
  /** Pre-rendered caveman statusline suffix (e.g. "⛏ 12.4k"), when present. */
  statuslineSavingsText: string | null;
  /** Approximate memory compression receipts from *.original.md backups, when present. */
  memoryCompressed: CavemanMemoryCompression | null;
};

/**
 * Estimated caveman savings for GitHub Copilot. Copilot keeps no local token log,
 * so output tokens are COUNTED from chat-session transcripts with a real o200k_base BPE
 * tokenizer, and saved tokens apply the (projected) caveman compression ratio. Copilot is
 * subscription-billed, so there is no meaningful per-token USD figure — savings are tokens only.
 */
export type CopilotMonthPoint = {
  month: string;
  savedTokens: number;
  outputTokens: number;
  sessions: number;
  turns: number;
};

export type CopilotSavings = {
  /** True when any Copilot chat activity was found in history. */
  active: boolean;
  /** Current month in effect for the headline numbers (YYYY-MM). */
  currentMonth: string;
  /** Headline figures below cover ONLY the current month; history is in byMonth. */
  /** Chat sessions with at least one assistant turn this month. */
  sessions: number;
  /** Total assistant turns counted this month. */
  turns: number;
  /** Assistant output tokens this month (real o200k_base BPE count of transcript text). */
  outputTokens: number;
  /** Estimated output tokens saved by caveman compression this month. */
  savedTokens: number;
  /** Per-day estimated saved tokens for the current month (savedUsd is always 0). */
  byDay: CavemanDayPoint[];
  /** Per-month history (all months, ascending), preserved across the monthly reset. */
  byMonth: CopilotMonthPoint[];
  /** Distinct Copilot model ids seen (e.g. "copilot/gpt-5.2"). */
  models: string[];
  /** caveman plugin installed on this machine (proxy for "Copilot compression configured"). */
  configured: boolean;
  /** 'estimated' when any turns were counted, else 'none'. */
  source: 'estimated' | 'none';
};

/** Combined savings across providers, fed to the dashboard and status bar. */
export type CombinedSavings = {
  claude: CavemanSavings;
  copilot: CopilotSavings;
};
