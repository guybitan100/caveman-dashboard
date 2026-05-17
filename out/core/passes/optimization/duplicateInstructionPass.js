"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateInstructionPass = void 0;
exports.duplicateInstructionPass = {
    id: 'optimization.duplicateInstruction',
    run(ir) {
        const findings = [];
        const seen = new Map();
        for (const node of ir.children) {
            if (node.type !== 'instruction')
                continue;
            const current = node;
            if (current.normalized.length < 12)
                continue;
            const existing = seen.get(current.normalized);
            if (existing) {
                findings.push({
                    ruleId: this.id,
                    title: 'Duplicate instruction detected',
                    message: `This instruction duplicates an earlier instruction. Estimated waste: ${current.tokens} tokens.`,
                    severity: 'warning',
                    loc: current.loc,
                    nodeId: current.id,
                    fix: {
                        title: 'Remove duplicate instruction',
                        replacement: ''
                    },
                    metadata: {
                        duplicateOf: existing.id,
                        wastedTokens: current.tokens
                    }
                });
            }
            else {
                seen.set(current.normalized, current);
            }
        }
        return findings;
    }
};
//# sourceMappingURL=duplicateInstructionPass.js.map