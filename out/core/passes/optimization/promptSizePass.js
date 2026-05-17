"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptSizePass = void 0;
exports.promptSizePass = {
    id: 'optimization.promptSize',
    run(ir) {
        const findings = [];
        if (ir.tokens > 8000) {
            findings.push({
                ruleId: this.id,
                title: 'Critical prompt size',
                message: `This file contains approximately ${ir.tokens} tokens. This is likely too large for stable agent behavior.`,
                severity: 'error',
                loc: ir.loc,
                metadata: { tokens: ir.tokens }
            });
        }
        else if (ir.tokens > 4000) {
            findings.push({
                ruleId: this.id,
                title: 'Large prompt detected',
                message: `This file contains approximately ${ir.tokens} tokens. Consider splitting, deduplicating, or compacting it.`,
                severity: 'warning',
                loc: ir.loc,
                metadata: { tokens: ir.tokens }
            });
        }
        return findings;
    }
};
//# sourceMappingURL=promptSizePass.js.map