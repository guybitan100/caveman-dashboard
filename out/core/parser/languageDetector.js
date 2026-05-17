"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFileName = normalizeFileName;
exports.isGeneratedDependencyFile = isGeneratedDependencyFile;
exports.detectKind = detectKind;
const generatedDependencyFiles = new Set([
    'bun.lockb',
    'package-lock.json',
    'pnpm-lock.yaml',
    'pnpm-lock.yml',
    'yarn.lock'
]);
function normalizeFileName(fileName) {
    return fileName.replace(/\\/g, '/').toLowerCase();
}
function isGeneratedDependencyFile(fileName) {
    const normalized = normalizeFileName(fileName);
    const baseName = normalized.split('/').pop() ?? normalized;
    return generatedDependencyFiles.has(baseName);
}
function detectKind(fileName) {
    const lower = normalizeFileName(fileName);
    if (lower.endsWith('.md'))
        return 'markdown';
    if (lower.endsWith('.prompt'))
        return 'prompt';
    if (lower.endsWith('.yaml') || lower.endsWith('.yml'))
        return 'yaml';
    if (lower.endsWith('.json'))
        return 'json';
    if (lower.endsWith('.ts') || lower.endsWith('.tsx'))
        return 'typescript';
    if (lower.endsWith('.py'))
        return 'python';
    return 'unknown';
}
//# sourceMappingURL=languageDetector.js.map