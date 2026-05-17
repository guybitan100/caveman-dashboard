"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unsafePermissionPass = void 0;
const highRiskPairs = [
    ['filesystem.read', 'gmail.send'],
    ['filesystem.read', 'http.post'],
    ['memory.read', 'http.post'],
    ['browser.open', 'filesystem.read'],
    ['secrets.read', 'http.post'],
    ['calendar.read', 'gmail.send']
];
exports.unsafePermissionPass = {
    id: 'security.unsafePermissions',
    run(ir) {
        const fullText = ir.children.map(n => n.raw).join('\n').toLowerCase();
        const findings = [];
        for (const [a, b] of highRiskPairs) {
            if (fullText.includes(a) && fullText.includes(b)) {
                findings.push({
                    ruleId: this.id,
                    title: 'Unsafe permission combination',
                    message: `The combination ${a} + ${b} may enable data exfiltration or unsafe automation.`,
                    severity: 'error',
                    loc: ir.loc,
                    metadata: { permissions: [a, b] }
                });
            }
        }
        return findings;
    }
};
//# sourceMappingURL=unsafePermissionPass.js.map