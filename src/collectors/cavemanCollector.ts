import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CavemanMemoryCompression, CavemanSavings } from '../types';
import { CavemanSessionInput, aggregateCaveman, detectCavemanMode, todayIso } from '../analytics/cavemanEngine';
import { isCavemanInstalled } from './updateChecker';

type LedgerEntry = {
  ts?: number;
  session_id?: string;
  mode?: string | null;
  model?: string | null;
  output_tokens?: number;
  est_saved_tokens?: number;
  est_saved_usd?: number;
};

type TranscriptInfo = { model: string; outputTokens: number; cacheReadTokens: number; day: string; mode?: string };
type LifetimeHistory = { sessions: number; outputTokens: number; savedTokens: number; savedUsd: number };

const SKIP_DIRS = new Set(['subagents', 'memory']);

/**
 * Estimates savings from the caveman output-compression plugin by combining caveman's
 * own ledger (~/.claude/.caveman-history.jsonl, written by /caveman-stats) with a scan
 * of session transcripts for the "CAVEMAN MODE ACTIVE (mode)" marker. Ledger values are
 * preferred per session; marker-only sessions are estimated with caveman's own formula.
 */
export class CavemanCollector {
  constructor(private readonly explicitClaudeDir?: string, private readonly workspaceRoot?: string) {}

  private claudeDir(): string {
    return this.explicitClaudeDir ?? process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');
  }

  collect(): CavemanSavings {
    const dir = this.claudeDir();
    const ledger = this.readLedger(path.join(dir, '.caveman-history.jsonl'));
    const transcripts = this.scanTranscripts(path.join(dir, 'projects'));
    const lifetime = this.aggregateLifetimeHistory(ledger);
    const statuslineSavingsText = this.readStatuslineSuffix(path.join(dir, '.caveman-statusline-suffix'));
    const memoryCompressed = this.findCompressedMemory([dir, this.workspaceRoot].filter((value): value is string => !!value));

    const sessionIds = new Set<string>([...transcripts.keys(), ...ledger.keys()]);
    const today = todayIso();
    const inputs: CavemanSessionInput[] = [];

    for (const sid of sessionIds) {
      const t = transcripts.get(sid);
      const l = ledger.get(sid);
      if (l) {
        const day = l.ts ? new Date(l.ts).toISOString().slice(0, 10) : (t?.day ?? today);
        inputs.push({
          day,
          model: l.model || t?.model || 'unknown',
          outputTokens: t?.outputTokens ?? l.output_tokens ?? 0,
          cacheReadTokens: t?.cacheReadTokens ?? 0,
          mode: (l.mode || t?.mode) ?? undefined,
          ledgerSavedTokens: l.est_saved_tokens,
          ledgerSavedUsd: l.est_saved_usd,
          fromLedger: true,
        });
      } else if (t?.mode) {
        inputs.push({ day: t.day, model: t.model, outputTokens: t.outputTokens, cacheReadTokens: t.cacheReadTokens, mode: t.mode });
      }
    }

    const base = aggregateCaveman(inputs, this.readStatus(dir));
    return {
      ...base,
      lifetimeSessions: lifetime.sessions,
      lifetimeOutputTokens: lifetime.outputTokens,
      lifetimeSavedTokens: lifetime.savedTokens,
      lifetimeSavedUsd: lifetime.savedUsd,
      statuslineSavingsText,
      memoryCompressed,
    };
  }

  /** Detect whether caveman is installed and which mode the activation flag holds. */
  private readStatus(dir: string): { installed: boolean; activeMode: string | null } {
    const installed = isCavemanInstalled(dir);
    let activeMode: string | null = null;
    try {
      const raw = fs.readFileSync(path.join(dir, '.caveman-active'), 'utf8').trim();
      activeMode = raw && raw !== 'off' ? raw : null;
    } catch { /* flag absent -> off */ }
    return { installed, activeMode };
  }

  private readLedger(file: string): Map<string, LedgerEntry> {
    const latest = new Map<string, LedgerEntry>();
    let raw = '';
    try { raw = fs.readFileSync(file, 'utf8'); } catch { return latest; }
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let e: LedgerEntry;
      try { e = JSON.parse(line); } catch { continue; }
      const id = e.session_id;
      if (!id) continue;
      const prev = latest.get(id);
      if (!prev || (e.ts ?? 0) >= (prev.ts ?? 0)) latest.set(id, e);
    }
    return latest;
  }

  private scanTranscripts(projectsDir: string, maxFiles = 3000): Map<string, TranscriptInfo> {
    const out = new Map<string, TranscriptInfo>();
    if (!fs.existsSync(projectsDir)) return out;
    const files: string[] = [];
    const stack = [projectsDir];
    while (stack.length && files.length < maxFiles) {
      const current = stack.pop()!;
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        const full = path.join(current, e.name);
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) stack.push(full); }
        else if (e.isFile() && e.name.endsWith('.jsonl')) files.push(full);
      }
    }

    for (const file of files) {
      let raw = '';
      try { raw = fs.readFileSync(file, 'utf8'); } catch { continue; }
      let outputTokens = 0;
      let cacheReadTokens = 0;
      let model = 'unknown';
      let day = '';
      let mode: string | undefined;
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        if (!mode && line.includes('CAVEMAN MODE ACTIVE')) {
          const detected = detectCavemanMode(line);
          if (detected) mode = detected;
        }
        let obj: any;
        try { obj = JSON.parse(line); } catch { continue; }
        const usage = obj.message?.usage ?? obj.usage;
        const ts = obj.timestamp ?? obj.created_at;
        if (ts) { const d = String(ts).slice(0, 10); if (d > day) day = d; }
        if (!usage) continue;
        outputTokens += Number(usage.output_tokens ?? usage.outputTokens ?? 0);
        cacheReadTokens += Number(usage.cache_read_input_tokens ?? usage.cacheReadInputTokens ?? 0);
        const m = obj.message?.model ?? obj.model;
        if (m && model === 'unknown') model = String(m);
      }
      out.set(path.basename(file, '.jsonl'), {
        model,
        outputTokens,
        cacheReadTokens,
        day: day || todayIso(),
        mode,
      });
    }
    return out;
  }

  private aggregateLifetimeHistory(ledger: Map<string, LedgerEntry>): LifetimeHistory {
    let sessions = 0;
    let outputTokens = 0;
    let savedTokens = 0;
    let savedUsd = 0;
    for (const entry of ledger.values()) {
      sessions += 1;
      outputTokens += Number(entry.output_tokens ?? 0);
      savedTokens += Number(entry.est_saved_tokens ?? 0);
      savedUsd += Number(entry.est_saved_usd ?? 0);
    }
    return { sessions, outputTokens, savedTokens, savedUsd };
  }

  private readStatuslineSuffix(filePath: string): string | null {
    try {
      const stat = fs.lstatSync(filePath);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 64) return null;
      const text = fs.readFileSync(filePath, 'utf8').replace(/[\x00-\x1f]/g, '').trim();
      return text || null;
    } catch {
      return null;
    }
  }

  private findCompressedMemory(dirs: string[]): CavemanMemoryCompression | null {
    let count = 0;
    let bytesSaved = 0;
    for (const dir of dirs) {
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.original.md')) continue;
        const base = entry.name.slice(0, -'.original.md'.length);
        const originalPath = path.join(dir, entry.name);
        const compressedPath = path.join(dir, `${base}.md`);
        let originalSize = 0;
        let compressedSize = 0;
        try {
          originalSize = fs.statSync(originalPath).size;
          compressedSize = fs.statSync(compressedPath).size;
        } catch {
          continue;
        }
        if (originalSize <= compressedSize) continue;
        count += 1;
        bytesSaved += originalSize - compressedSize;
      }
    }
    if (count === 0 || bytesSaved <= 0) return null;
    return { count, tokensSaved: Math.round(bytesSaved / 4) };
  }
}
