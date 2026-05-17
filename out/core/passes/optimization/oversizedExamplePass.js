"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oversizedExamplePass = void 0;
exports.oversizedExamplePass = {
    id: 'optimization.oversizedExample',
    run(ir) {
        const findings = [];
        for (const node of ir.children) {
            if (node.type !== 'example')
                continue;
            const example = node;
            if (example.tokens > 500) {
                findings.push({
                    ruleId: this.id,
                    title: 'Oversized example detected',
                    message: `This example uses ${example.tokens} tokens. Consider compressing it or replacing it with a shorter behavioral pattern.`,
                    severity: 'warning',
                    loc: example.loc,
                    nodeId: example.id,
                    metadata: { tokens: example.tokens }
                });
            }
        }
        return findings;
    }
};
//# sourceMappingURL=oversizedExamplePass.js.map