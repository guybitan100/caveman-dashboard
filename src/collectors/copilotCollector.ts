import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CavemanDayPoint, CopilotMonthPoint, CopilotSavings } from '../types';
import { estimateSavedTokens, currentMonthKey } from '../analytics/cavemanEngine';
import { countOutputTokens } from '../analytics/tokenizer';

/**
 * Estimates caveman savings for GitHub Copilot from VS Code chat-session transcripts.
 *
 * Copilot keeps no local token log, so this reads the chat-session JSON files VS Code
 * writes under its User dir (workspaceStorage/<hash>/chatSessions/*.json and
 * globalStorage/emptyWindowChatSessions/*.json). Assistant output tokens are counted
 * with a real o200k_base BPE tokenizer over the transcript text (a measured token count,
 * not a char heuristic), and the caveman compression ratio is applied for saved tokens.
 * There is no per-session caveman marker in Copilot output, so the saved figure assumes
 * caveman compression was active — the SAVINGS remain a projection, even though the
 * output-token count is now real. Copilot is subscription-billed, so no USD value is
 * produced.
 */
export class CopilotCollector {
  constructor(private readonly explicitUserDir?: string) {}

  /** VS Code User directory, per-OS, or an explicit override. */
  private userDir(): string {
    if (this.explicitUserDir && this.explicitUserDir.trim()) return this.explicitUserDir.trim();
    const home = os.homedir();
    if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Code', 'User');
    if (process.platform === 'win32') return path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'Code', 'User');
    return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, '.config'), 'Code', 'User');
  }

  collect(configured: boolean, ratioMode: string = 'full', currentMonth: string = currentMonthKey()): CopilotSavings {
    const files = this.findSessionFiles(this.userDir());
    const days = new Map<string, CavemanDayPoint>();       // current month only
    const months = new Map<string, CopilotMonthPoint>();    // full history
    const models = new Set<string>();
    let anyTurn = false;

    const monthBucket = (m: string): CopilotMonthPoint => {
      let b = months.get(m);
      if (!b) { b = { month: m, savedTokens: 0, outputTokens: 0, sessions: 0, turns: 0 }; months.set(m, b); }
      return b;
    };

    for (const file of files) {
      let obj: any;
      try { obj = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
      const requests: any[] = Array.isArray(obj?.requests) ? obj.requests : [];
      if (!requests.length) continue;
      const fallbackDay = isoDay(obj?.lastMessageDate ?? obj?.creationDate);
      let sessionHadTurn = false;

      for (const r of requests) {
        const text = responseText(r?.response);
        if (!text) continue;
        const outTok = countOutputTokens(text);
        if (outTok <= 0) continue;
        sessionHadTurn = true;
        anyTurn = true;
        const saved = estimateSavedTokens(outTok, ratioMode);
        if (r?.modelId) models.add(String(r.modelId));

        const day = isoDay(r?.timestamp) ?? fallbackDay ?? today();
        const mb = monthBucket(day.slice(0, 7));
        mb.turns += 1;
        mb.outputTokens += outTok;
        mb.savedTokens += saved;

        if (day.slice(0, 7) === currentMonth) {
          const d = days.get(day) ?? { day, savedTokens: 0, savedUsd: 0 };
          d.savedTokens += saved;
          days.set(day, d);
        }
      }
      // A session is attributed to the month of its last-message/creation date.
      if (sessionHadTurn) monthBucket((fallbackDay ?? today()).slice(0, 7)).sessions += 1;
    }

    const cur = months.get(currentMonth);
    return {
      active: anyTurn,
      currentMonth,
      sessions: cur?.sessions ?? 0,
      turns: cur?.turns ?? 0,
      outputTokens: cur?.outputTokens ?? 0,
      savedTokens: cur?.savedTokens ?? 0,
      byDay: Array.from(days.values()).sort((a, b) => a.day.localeCompare(b.day)),
      byMonth: Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)),
      models: Array.from(models).sort(),
      configured,
      source: anyTurn ? 'estimated' : 'none',
    };
  }

  /** Collect chat-session JSON files from workspace and empty-window storage. */
  private findSessionFiles(userDir: string, maxFiles = 1500): string[] {
    const out: string[] = [];
    const roots = [path.join(userDir, 'workspaceStorage'), path.join(userDir, 'globalStorage', 'emptyWindowChatSessions')];
    for (const root of roots) {
      if (out.length >= maxFiles) break;
      this.collectJson(root, out, maxFiles);
    }
    return out;
  }

  /** Find chatSessions/*.json under a root (one level of workspace hashes for workspaceStorage). */
  private collectJson(root: string, out: string[], maxFiles: number): void {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
    // Case 1: root already is a chatSessions dir with *.json.
    for (const e of entries) {
      if (out.length >= maxFiles) return;
      if (e.isFile() && e.name.endsWith('.json')) out.push(path.join(root, e.name));
    }
    // Case 2: workspaceStorage/<hash>/chatSessions/*.json.
    for (const e of entries) {
      if (out.length >= maxFiles) return;
      if (!e.isDirectory()) continue;
      const chatDir = path.join(root, e.name, 'chatSessions');
      let files: string[] = [];
      try { files = fs.readdirSync(chatDir).filter(f => f.endsWith('.json')); } catch { continue; }
      for (const f of files) {
        if (out.length >= maxFiles) return;
        out.push(path.join(chatDir, f));
      }
    }
  }
}

/** Concatenate the text content of a Copilot chat response (array of typed parts). */
function responseText(response: unknown): string {
  if (typeof response === 'string') return response;
  if (!Array.isArray(response)) return '';
  let s = '';
  for (const p of response) {
    if (typeof p === 'string') { s += p; continue; }
    if (!p || typeof p !== 'object') continue;
    const part: any = p;
    if (typeof part.value === 'string') s += part.value;
    else if (typeof part.value?.value === 'string') s += part.value.value;
    else if (typeof part.content?.value === 'string') s += part.content.value;
    else if (part.kind === 'markdownContent' && typeof part.content === 'string') s += part.content;
  }
  return s;
}

function isoDay(ts: unknown): string | undefined {
  if (ts == null) return undefined;
  const n = typeof ts === 'number' ? ts : Date.parse(String(ts));
  if (!Number.isFinite(n)) return undefined;
  return new Date(n).toISOString().slice(0, 10);
}

function today(): string { return new Date().toISOString().slice(0, 10); }
