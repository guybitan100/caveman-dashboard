"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeInstruction = normalizeInstruction;
exports.looksLikeInstruction = looksLikeInstruction;
function normalizeInstruction(text) {
    return text
        .toLowerCase()
        .replace(/[`"'*_#>-]/g, '')
        .replace(/[.,;:!?]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function looksLikeInstruction(line) {
    const l = line.trim().toLowerCase();
    if (l.length < 8)
        return false;
    return (l.startsWith('- ') ||
        l.startsWith('* ') ||
        l.startsWith('always ') ||
        l.startsWith('never ') ||
        l.startsWith('do not ') ||
        l.startsWith('dont ') ||
        l.startsWith('you must ') ||
        l.startsWith('you are ') ||
        l.includes('instruction') ||
        l.includes('system prompt'));
}
//# sourceMappingURL=normalizer.js.map