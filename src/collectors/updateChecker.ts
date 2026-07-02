import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as https from 'https';

/** Where caveman is installed on this machine, read from the Claude plugin registry. */
export type CavemanInstallInfo = {
  /** Plugin cache dir present on disk. */
  installed: boolean;
  /** Installed commit sha (full 40 or short), or null if the registry has none. */
  sha: string | null;
  /** Source repo "owner/name" from known_marketplaces.json (falls back to the upstream default). */
  repo: string;
  /** ISO install timestamp from the registry, if recorded. */
  installedAt: string | null;
};

/** Result of comparing the installed caveman commit against the repo's latest. */
export type CavemanUpdateStatus = {
  installed: boolean;
  repo: string;
  installedSha: string | null;
  latestSha: string | null;
  updateAvailable: boolean;
  /** GitHub compare/commits URL for the changes, or null when unknown. */
  compareUrl: string | null;
  /** Set when the network check failed; the other fields still reflect the local install. */
  error?: string;
};

const DEFAULT_REPO = 'JuliusBrussee/caveman';

function claudeDir(explicit?: string): string {
  return explicit ?? process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');
}

function normalizeSha(sha: string): string { return sha.trim().toLowerCase(); }

/** Read the installed caveman commit sha + source repo from the Claude plugin registry. */
export function readInstalledCaveman(explicitDir?: string): CavemanInstallInfo {
  const dir = claudeDir(explicitDir);
  const pluginsDir = path.join(dir, 'plugins');

  let repo = DEFAULT_REPO;
  try {
    const mk = JSON.parse(fs.readFileSync(path.join(pluginsDir, 'known_marketplaces.json'), 'utf8'));
    const r = mk?.caveman?.source?.repo;
    if (typeof r === 'string' && r.includes('/')) repo = r;
  } catch { /* marketplace file absent -> upstream default */ }

  let sha: string | null = null;
  let installedAt: string | null = null;
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(pluginsDir, 'installed_plugins.json'), 'utf8'));
    const entries = reg?.plugins?.['caveman@caveman'];
    const first = Array.isArray(entries) ? entries[0] : undefined;
    if (first) {
      sha = typeof first.gitCommitSha === 'string' ? first.gitCommitSha
        : typeof first.version === 'string' ? first.version
        : null;
      installedAt = typeof first.installedAt === 'string' ? first.installedAt : null;
    }
  } catch { /* registry absent */ }

  const installed = fs.existsSync(path.join(pluginsDir, 'cache', 'caveman'));
  return { installed, sha, repo, installedAt };
}

/**
 * Read the installed caveman plugin's declared version from its package.json.
 * The plugin is unpacked at ~/.claude/plugins/cache/caveman/<marketplace>/<commit>/,
 * so walk that cache root a few levels deep and return the first package.json version.
 * Returns null when caveman is absent or its manifest carries no version field.
 */
export function readCavemanVersion(explicitDir?: string): string | null {
  const cacheRoot = path.join(claudeDir(explicitDir), 'plugins', 'cache', 'caveman');
  let level = [cacheRoot];
  for (let depth = 0; depth < 3 && level.length; depth++) {
    const next: string[] = [];
    for (const d of level) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8'));
        if (typeof j?.version === 'string' && j.version) return j.version;
      } catch { /* no manifest here — keep walking */ }
      try {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          if (e.isDirectory()) next.push(path.join(d, e.name));
        }
      } catch { /* not a directory */ }
    }
    level = next;
  }
  return null;
}

/**
 * Fetch the latest commit sha on the repo's default branch via the GitHub API.
 * Uses the `application/vnd.github.sha` media type, which returns the raw sha as the
 * body (tiny response), with a JSON fallback if the server ignores the media type.
 */
export function fetchLatestCommitSha(repo: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://api.github.com/repos/${repo}/commits/HEAD`,
      { headers: { 'User-Agent': 'caveman-dashboard-vscode', 'Accept': 'application/vnd.github.sha' } },
      res => {
        const status = res.statusCode ?? 0;
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => {
          if (status < 200 || status >= 300) {
            reject(new Error(`GitHub API ${status}: ${body.slice(0, 120)}`));
            return;
          }
          const raw = body.trim();
          if (/^[0-9a-f]{7,40}$/i.test(raw)) { resolve(raw); return; }
          try { const j = JSON.parse(body); if (j?.sha) { resolve(String(j.sha)); return; } } catch { /* not JSON */ }
          reject(new Error(`Unexpected GitHub response: ${raw.slice(0, 80)}`));
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('GitHub request timed out')));
  });
}

/** Compare the installed caveman commit against the repo HEAD; never rejects. */
export async function checkCavemanUpdate(explicitDir?: string): Promise<CavemanUpdateStatus> {
  const info = readInstalledCaveman(explicitDir);
  const base: CavemanUpdateStatus = {
    installed: info.installed, repo: info.repo, installedSha: info.sha,
    latestSha: null, updateAvailable: false, compareUrl: null,
  };
  try {
    const latest = await fetchLatestCommitSha(info.repo);
    const a = normalizeSha(latest);
    const b = info.sha ? normalizeSha(info.sha) : '';
    // sha may be full (40) or short (12); treat a prefix match as "same commit".
    const same = !!b && (a === b || a.startsWith(b) || b.startsWith(a));
    const compareUrl = info.sha
      ? `https://github.com/${info.repo}/compare/${info.sha}...${latest}`
      : `https://github.com/${info.repo}/commits`;
    return { ...base, latestSha: latest, updateAvailable: info.installed && !!info.sha && !same, compareUrl };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}
