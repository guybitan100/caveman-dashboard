"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenCount = tokenCount;
exports.loc = loc;
exports.instruction = instruction;
exports.policy = policy;
exports.example = example;
exports.retrieval = retrieval;
exports.memory = memory;
exports.tool = tool;
exports.skill = skill;
exports.skillTest = skillTest;
exports.unknown = unknown;
const gpt_tokenizer_1 = require("gpt-tokenizer");
const normalizer_1 = require("../parser/normalizer");
let counter = 0;
function nextId(prefix) {
    counter += 1;
    return `${prefix}_${counter}`;
}
function tokenCount(text) {
    return (0, gpt_tokenizer_1.encode)(text || '').length;
}
function loc(line, text) {
    return {
        startLine: line,
        startColumn: 0,
        endLine: line,
        endColumn: Math.max(text.length, 1)
    };
}
function instruction(content, line) {
    return {
        id: nextId('instruction'),
        type: 'instruction',
        raw: content,
        content,
        normalized: (0, normalizer_1.normalizeInstruction)(content),
        tokens: tokenCount(content),
        loc: loc(line, content)
    };
}
function policy(content, line) {
    return {
        id: nextId('policy'),
        type: 'policy',
        raw: content,
        content,
        tokens: tokenCount(content),
        loc: loc(line, content)
    };
}
function example(content, line) {
    return {
        id: nextId('example'),
        type: 'example',
        raw: content,
        content,
        tokens: tokenCount(content),
        loc: loc(line, content)
    };
}
function retrieval(raw, line, topK, source) {
    return {
        id: nextId('retrieval'),
        type: 'retrieval',
        raw,
        topK,
        source,
        tokens: tokenCount(raw),
        loc: loc(line, raw)
    };
}
function memory(content, line) {
    return {
        id: nextId('memory'),
        type: 'memory',
        raw: content,
        content,
        tokens: tokenCount(content),
        loc: loc(line, content)
    };
}
function tool(raw, line, name, permissions = []) {
    return {
        id: nextId('tool'),
        type: 'tool',
        raw,
        name,
        permissions,
        tokens: tokenCount(raw),
        loc: loc(line, raw)
    };
}
function skill(raw, line, name) {
    return {
        id: nextId('skill'),
        type: 'skill',
        raw,
        name,
        tools: [],
        instructions: [],
        tests: [],
        tokens: tokenCount(raw),
        loc: loc(line, raw)
    };
}
function skillTest(raw, line, name) {
    return {
        id: nextId('skilltest'),
        type: 'skill_test',
        raw,
        name,
        content: raw,
        tokens: tokenCount(raw),
        loc: loc(line, raw)
    };
}
function unknown(content, line) {
    return {
        id: nextId('unknown'),
        type: 'unknown',
        raw: content,
        content,
        tokens: tokenCount(content),
        loc: loc(line, content)
    };
}
//# sourceMappingURL=factory.js.map