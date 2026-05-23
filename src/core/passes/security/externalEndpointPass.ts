import { TokenLintPass } from '../../engine/pass';

const urlPattern = /(https?:\/\/[^\s"')]+)/gi;
const suspiciousWords = ['webhook', 'ngrok', 'pastebin', 'discord', 'telegram', 'requestbin'];
const dataFlowKeywords = /\b(send|post|upload|forward|exfiltrate|transmit|pipe|push|write)\b.*https?:\/\//i;
const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const safeDocsDomains = new Set([
  'github.com',
  'docs.github.com',
  'docs.microsoft.com',
  'learn.microsoft.com',
  'developer.mozilla.org',
  'npmjs.com',
  'www.npmjs.com',
  'pypi.org',
  'crates.io',
  'pkg.go.dev',
  'rubygems.org',
  'stackoverflow.com',
  'wikipedia.org',
  'en.wikipedia.org',
  'code.visualstudio.com',
  'marketplace.visualstudio.com',
  'registry.npmjs.org',
  'schemas.microsoft.com',
  'json-schema.org',
  'www.w3.org',
  'tc39.es',
  'spec.openapis.org',
  'swagger.io',
  'openai.com',
  'platform.openai.com',
  'arxiv.org',
  'semver.org',
  'creativecommons.org',
  'www.conventionalcommits.org',
  'conventionalcommits.org'
]);

/** URLs in markdown link syntax [text](url) are documentation references */
const markdownLinkPattern = /\[[^\]]*\]\(https?:\/\/[^)]+\)/gi;

function commentForReview(text: string): string {
  return text
    .split(/\r?\n/)
    .map(line => `# TOKENLINT REVIEW REQUIRED: ${line}`)
    .join('\n');
}

export const externalEndpointPass: TokenLintPass = {
  id: 'security.externalEndpoint',

  run(ir) {
    const findings = [];

    for (const node of ir.children) {
      const urls = node.raw.match(urlPattern) || [];
      const markdownLinks = new Set(
        (node.raw.match(markdownLinkPattern) || []).flatMap(m => m.match(urlPattern) || [])
      );

      for (const url of urls) {
        if (isLocalOrPrivateEndpoint(url)) continue;
        if (isSafeDocsUrl(url)) continue;
        if (markdownLinks.has(url)) continue;

        const lower = url.toLowerCase();
        const suspicious = suspiciousWords.some(w => lower.includes(w));
        const hasDataFlow = dataFlowKeywords.test(node.raw);

        // Only flag non-suspicious URLs if there's evidence of data being sent
        if (!suspicious && !hasDataFlow) continue;

        findings.push({
          ruleId: this.id,
          title: suspicious ? 'Suspicious external endpoint' : 'External endpoint detected',
          message: `External URL detected: ${url}. Review data exposure risk before enabling this skill.`,
          severity: suspicious ? 'error' as const : 'warning' as const,
          loc: node.loc,
          nodeId: node.id,
          fix: {
            title: 'Comment external endpoint for review',
            replacement: commentForReview(node.raw)
          },
          metadata: { url }
        });
      }
    }

    return findings;
  }
};

function isLocalOrPrivateEndpoint(url: string): boolean {
  // Handle template-variable ports like http://localhost:{PORT}/path
  const normalizedUrl = url.replace(/\{[^}]+\}/g, '0');
  try {
    const host = new URL(normalizedUrl).hostname.toLowerCase();

    if (localHosts.has(host) || host.endsWith('.local')) return true;

    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;

    const octets = host.split('.').map(Number);
    const [first, second] = octets;

    if (first === 10) return true;
    if (first === 127) return true;
    if (first === 192 && second === 168) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;

    return false;
  } catch {
    return false;
  }
}

function isSafeDocsUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (safeDocsDomains.has(host)) return true;
    // Allow subdomains of safe domains (e.g., raw.githubusercontent.com)
    for (const safe of safeDocsDomains) {
      if (host.endsWith('.' + safe)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
