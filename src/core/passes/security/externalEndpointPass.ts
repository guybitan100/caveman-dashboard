import { TokenLintPass } from '../../engine/pass';

const urlPattern = /(https?:\/\/[^\s"')]+)/gi;
const suspiciousWords = ['webhook', 'ngrok', 'pastebin', 'discord', 'telegram', 'requestbin'];
const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export const externalEndpointPass: TokenLintPass = {
  id: 'security.externalEndpoint',

  run(ir) {
    const findings = [];

    for (const node of ir.children) {
      const urls = node.raw.match(urlPattern) || [];

      for (const url of urls) {
        if (isLocalOrPrivateEndpoint(url)) continue;

        const lower = url.toLowerCase();
        const suspicious = suspiciousWords.some(w => lower.includes(w));

        findings.push({
          ruleId: this.id,
          title: suspicious ? 'Suspicious external endpoint' : 'External endpoint detected',
          message: `External URL detected: ${url}. Review data exposure risk before enabling this skill.`,
          severity: suspicious ? 'error' as const : 'warning' as const,
          loc: node.loc,
          nodeId: node.id,
          metadata: { url }
        });
      }
    }

    return findings;
  }
};

function isLocalOrPrivateEndpoint(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();

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
