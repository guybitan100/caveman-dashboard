import { TokenLintPass } from '../../engine/pass';

type SuspiciousPattern = {
  label: string;
  matches: (content: string) => boolean;
};

const shellBootstrapPattern =
  /\b(?:curl|wget)\b.*(?:\|\s*(?:sh|bash|zsh|pwsh|powershell|python|python3)\b|(?:&&|;)\s*(?:chmod\s+\+x|sh|bash|zsh|pwsh|powershell)\b)/;
const riskyPowerShellPattern =
  /\bpowershell\b.*(?:-enc(?:odedcommand)?\b|iex\b|invoke-expression|downloadstring|frombase64string|-nop\b|-w(?:indowstyle)?\s+hidden|-executionpolicy\s+bypass)/;
const persistencePattern = /\b(?:persist|persistence|autorun)\b/;
const negatedPersistencePattern = /\b(?:do not|don't|never|avoid|without)\b.*\b(?:persist|persistence|autorun)\b/;
const persistenceContextPattern =
  /\b(?:access|foothold|backdoor|startup|reboot|survive|launchagent|launch agent|login item|service|daemon|cron|scheduled task)\b/;

const suspiciousPatterns: SuspiciousPattern[] = [
  {
    label: 'download and execute',
    matches: content => content.includes('download and execute')
  },
  {
    label: 'remote shell bootstrap',
    matches: content => shellBootstrapPattern.test(content)
  },
  {
    label: 'powershell',
    matches: content => riskyPowerShellPattern.test(content)
  },
  {
    label: 'eval(',
    matches: content => content.includes('eval(')
  },
  {
    label: 'exec(',
    matches: content => content.includes('exec(')
  },
  {
    label: 'send all files',
    matches: content => content.includes('send all files')
  },
  {
    label: 'upload conversation',
    matches: content => content.includes('upload conversation')
  },
  {
    label: 'exfiltrate',
    matches: content => content.includes('exfiltrate')
  },
  {
    label: 'steal',
    matches: content => content.includes('steal')
  },
  {
    label: 'persistence',
    matches: content =>
      persistencePattern.test(content) &&
      !negatedPersistencePattern.test(content) &&
      persistenceContextPattern.test(content)
  }
];

export const maliciousSkillTestPass: TokenLintPass = {
  id: 'skills.maliciousSkillTest',

  run(ir) {
    const findings = [];

    for (const node of ir.children) {
      if (node.type !== 'skill_test' && node.type !== 'skill' && node.type !== 'unknown') continue;

      const content = node.raw.toLowerCase();

      for (const pattern of suspiciousPatterns) {
        if (pattern.matches(content)) {
          findings.push({
            ruleId: this.id,
            title: 'Potentially malicious skill test',
            message: `Skill/test contains suspicious behavior pattern: "${pattern.label}". Do not run untrusted skills without review.`,
            severity: 'error' as const,
            loc: node.loc,
            nodeId: node.id,
            metadata: { pattern: pattern.label }
          });
        }
      }
    }

    return findings;
  }
};
