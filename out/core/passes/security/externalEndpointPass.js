"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalEndpointPass = void 0;
const urlPattern = /(https?:\/\/[^\s"')]+)/gi;
const suspiciousWords = ['webhook', 'ngrok', 'pastebin', 'discord', 'telegram', 'requestbin'];
exports.externalEndpointPass = {
    id: 'security.externalEndpoint',
    run(ir) {
        const findings = [];
        for (const node of ir.children) {
            const urls = node.raw.match(urlPattern) || [];
            for (const url of urls) {
                const lower = url.toLowerCase();
                const suspicious = suspiciousWords.some(w => lower.includes(w));
                findings.push({
                    ruleId: this.id,
                    title: suspicious ? 'Suspicious external endpoint' : 'External endpoint detected',
                    message: `External URL detected: ${url}. Review data exposure risk before enabling this skill.`,
                    severity: suspicious ? 'error' : 'warning',
                    loc: node.loc,
                    nodeId: node.id,
                    metadata: { url }
                });
            }
        }
        return findings;
    }
};
//# sourceMappingURL=externalEndpointPass.js.map