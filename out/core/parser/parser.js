"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseToIR = parseToIR;
const factory_1 = require("../ir/factory");
const languageDetector_1 = require("./languageDetector");
const normalizer_1 = require("./normalizer");
function parseToIR(text, fileName = 'unknown') {
    const kind = (0, languageDetector_1.detectKind)(fileName);
    const children = [];
    const lines = text.split(/\r?\n/);
    let currentSkill = null;
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();
        if (!trimmed)
            return;
        const skillMatch = trimmed.match(/(?:name|skill)\s*[:=]\s*["']?([a-zA-Z0-9_-]+)/) ||
            trimmed.match(/skill\s+([a-zA-Z0-9_-]+)/i);
        if (skillMatch && lower.includes('skill')) {
            currentSkill = (0, factory_1.skill)(trimmed, index, skillMatch[1]);
            children.push(currentSkill);
            return;
        }
        if (lower.includes('test') && (lower.includes('skill') || lower.includes('prompt'))) {
            const test = (0, factory_1.skillTest)(trimmed, index, extractName(trimmed, 'skill_test'));
            if (currentSkill)
                currentSkill.tests.push(test);
            children.push(test);
            return;
        }
        if (lower.includes('top_k')) {
            const topK = extractNumber(trimmed, /top_k\s*[:=]\s*(\d+)/i);
            children.push((0, factory_1.retrieval)(trimmed, index, topK));
            return;
        }
        if (lower.includes('retrieval') || lower.includes('vector') || lower.includes('rag')) {
            children.push((0, factory_1.retrieval)(trimmed, index));
            return;
        }
        if (lower.includes('memory') || lower.includes('conversation history')) {
            children.push((0, factory_1.memory)(trimmed, index));
            return;
        }
        if (lower.includes('policy') || lower.includes('constraint') || lower.includes('rule')) {
            children.push((0, factory_1.policy)(trimmed, index));
            return;
        }
        if (lower.includes('example') || lower.startsWith('user:') || lower.startsWith('assistant:')) {
            children.push((0, factory_1.example)(trimmed, index));
            return;
        }
        if (lower.includes('tool') || lower.includes('permission') || /[a-z]+\.[a-z]+/.test(lower)) {
            const permissions = extractPermissions(trimmed);
            const toolName = permissions[0] || extractName(trimmed, 'tool');
            const t = (0, factory_1.tool)(trimmed, index, toolName, permissions);
            if (currentSkill)
                currentSkill.tools.push(t);
            children.push(t);
            return;
        }
        if ((0, normalizer_1.looksLikeInstruction)(trimmed)) {
            const node = (0, factory_1.instruction)(trimmed, index);
            if (currentSkill)
                currentSkill.instructions.push(node);
            children.push(node);
            return;
        }
        if (kind === 'json' || kind === 'yaml') {
            children.push((0, factory_1.instruction)(trimmed, index));
            return;
        }
        children.push((0, factory_1.unknown)(trimmed, index));
    });
    return {
        id: 'root',
        type: 'prompt',
        raw: text,
        tokens: (0, factory_1.tokenCount)(text),
        loc: {
            startLine: 0,
            startColumn: 0,
            endLine: Math.max(lines.length - 1, 0),
            endColumn: lines[lines.length - 1]?.length || 1
        },
        children
    };
}
function extractNumber(text, regex) {
    const match = text.match(regex);
    return match ? Number(match[1]) : undefined;
}
function extractName(text, fallback) {
    const match = text.match(/["']?([a-zA-Z0-9_-]{3,})["']?/);
    return match ? match[1] : fallback;
}
function extractPermissions(text) {
    const matches = text.match(/[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g);
    return matches || [];
}
//# sourceMappingURL=parser.js.map