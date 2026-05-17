"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptInjectionPass = void 0;
const injectionPatterns = [
    'ignore previous instructions',
    'ignore all previous instructions',
    'override system prompt',
    'reveal hidden prompt',
    'print the system prompt',
    'disable safety',
    'bypass policy',
    'act as developer mode'
];
exports.promptInjectionPass = {
    id: 'security.promptInjection',
    run(ir) {
        const findings = [];
        for (const node of ir.children) {
            if (node.type !== 'instruction' && node.type !== 'unknown' && node.type !== 'skill_test')
                continue;
            const content = node.type === 'instruction'
                ? node.content.toLowerCase()
                : node.raw.toLowerCase();
            for (const pattern of injectionPatterns) {
                if (content.includes(pattern)) {
                    findings.push({
                        ruleId: this.id,
                        title: 'Potential prompt injection',
                        message: `Suspicious instruction pattern detected: "${pattern}".`,
                        severity: 'error',
                        loc: node.loc,
                        nodeId: node.id,
                        fix: {
                            title: 'Neutralize suspicious instruction',
                            replacement: node.raw.replace(new RegExp(pattern, 'i'), '[REMOVED: suspicious instruction override]')
                        },
                        metadata: { pattern }
                    });
                }
            }
        }
        return findings;
    }
};
//# sourceMappingURL=promptInjectionPass.js.map