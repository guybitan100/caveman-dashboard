"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyze = analyze;
const parser_1 = require("../parser/parser");
const duplicateInstructionPass_1 = require("../passes/optimization/duplicateInstructionPass");
const promptSizePass_1 = require("../passes/optimization/promptSizePass");
const oversizedExamplePass_1 = require("../passes/optimization/oversizedExamplePass");
const retrievalRiskPass_1 = require("../passes/retrieval/retrievalRiskPass");
const contextAmplificationPass_1 = require("../passes/retrieval/contextAmplificationPass");
const promptInjectionPass_1 = require("../passes/security/promptInjectionPass");
const encodedPayloadPass_1 = require("../passes/security/encodedPayloadPass");
const externalEndpointPass_1 = require("../passes/security/externalEndpointPass");
const unsafePermissionPass_1 = require("../passes/security/unsafePermissionPass");
const maliciousSkillTestPass_1 = require("../passes/skills/maliciousSkillTestPass");
function analyze(text, fileName) {
    const ir = (0, parser_1.parseToIR)(text, fileName);
    const passes = [
        duplicateInstructionPass_1.duplicateInstructionPass,
        promptSizePass_1.promptSizePass,
        oversizedExamplePass_1.oversizedExamplePass,
        retrievalRiskPass_1.retrievalRiskPass,
        contextAmplificationPass_1.contextAmplificationPass,
        promptInjectionPass_1.promptInjectionPass,
        encodedPayloadPass_1.encodedPayloadPass,
        externalEndpointPass_1.externalEndpointPass,
        unsafePermissionPass_1.unsafePermissionPass,
        maliciousSkillTestPass_1.maliciousSkillTestPass
    ];
    const findings = [];
    for (const pass of passes) {
        findings.push(...pass.run(ir));
    }
    return {
        ir,
        findings,
        metrics: {
            totalTokens: ir.tokens,
            findingCount: findings.length,
            errorCount: findings.filter(f => f.severity === 'error').length,
            warningCount: findings.filter(f => f.severity === 'warning').length
        }
    };
}
//# sourceMappingURL=engine.js.map