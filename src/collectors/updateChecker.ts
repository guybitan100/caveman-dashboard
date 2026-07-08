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
      // The commit currently loaded is the one in installPath's basename (== `version` for
      // git-sourced plugins). `claude plugin update` refreshes installPath/version/lastUpdated
      // but leaves gitCommitSha at its install-time value, so gitCommitSha goes stale after an
      // update and would falsely report "update available". Trust the live install dir first,
      // then version, and fall back to gitCommitSha only when neither is a usable sha.
      const isSha = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{7,40}$/i.test(s.trim());
      const installBase = typeof first.installPath === 'string' ? path.basename(first.installPath) : '';
      sha = isSha(installBase) ? installBase
        : isSha(first.version) ? first.version
        : typeof first.gitCommitSha === 'string' ? first.gitCommitSha
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

/** GET a URL as text, following up to `redirects` redirects; resolves { status, body }. */
function httpGet(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  redirects = 3,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location && redirects > 0) {
        res.resume(); // drain so the socket frees
        httpGet(new URL(location, url).toString(), headers, timeoutMs, redirects - 1).then(resolve, reject);
        return;
      }
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ status, body }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('request timed out')));
  });
}

/**
 * Fetch the latest commit sha on the repo's default branch.
 *
 * Primary: the git smart-HTTP ref advertisement (`/info/refs?service=git-upload-pack`)
 * — unauthenticated, NOT subject to the GitHub API's 60-req/hr limit, and lists HEAD's
 * sha as the first ref. This is what makes "Check for update" reliable on direct networks
 * where the API otherwise 403s once the anonymous budget is spent.
 * Fallback: the REST API (`application/vnd.github.sha`), with a JSON parse as last resort.
 */
export async function fetchLatestCommitSha(repo: string, timeoutMs = 8000): Promise<string> {
  const UA = 'caveman-dashboard-vscode';
  try {
    const { status, body } = await httpGet(
      `https://github.com/${repo}/info/refs?service=git-upload-pack`,
      { 'User-Agent': UA },
      timeoutMs,
    );
    // The advertisement lists HEAD first as `<sha> HEAD\0<caps>`. Anchor on the ` HEAD`
    // suffix so we don't false-match the pkt-line framing: the flush `0000` + length
    // prefix (e.g. `0159`) are also hex, and `0000<len>` + the first 32 sha chars form a
    // spurious 40-hex run right before the real sha. Requiring ` HEAD` pins the window to
    // the actual tip.
    if (status >= 200 && status < 300) {
      const m = /([0-9a-f]{40})\s+HEAD/i.exec(body);
      if (m) return m[1];
    }
  } catch { /* fall through to the REST API */ }

  const { status, body } = await httpGet(
    `https://api.github.com/repos/${repo}/commits/HEAD`,
    { 'User-Agent': UA, 'Accept': 'application/vnd.github.sha' },
    timeoutMs,
  );
  if (status < 200 || status >= 300) {
    throw new Error(`GitHub API ${status}: ${body.slice(0, 120)}`);
  }
  const raw = body.trim();
  if (/^[0-9a-f]{7,40}$/i.test(raw)) return raw;
  try { const j = JSON.parse(body); if (j?.sha) return String(j.sha); } catch { /* not JSON */ }
  throw new Error(`Unexpected GitHub response: ${raw.slice(0, 80)}`);
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
