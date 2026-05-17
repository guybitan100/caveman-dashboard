"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenLintCodeActionProvider = void 0;
const vscode = __importStar(require("vscode"));
class TokenLintCodeActionProvider {
    provideCodeActions(document, range, context) {
        const actions = [];
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'TokenLint')
                continue;
            if (diagnostic.code === 'optimization.duplicateInstruction') {
                const action = new vscode.CodeAction('TokenLint: Remove duplicate instruction', vscode.CodeActionKind.QuickFix);
                const line = document.lineAt(diagnostic.range.start.line);
                const deleteRange = line.rangeIncludingLineBreak;
                action.diagnostics = [diagnostic];
                action.edit = new vscode.WorkspaceEdit();
                action.edit.delete(document.uri, deleteRange);
                action.isPreferred = true;
                actions.push(action);
            }
            if (diagnostic.code === 'retrieval.topKRisk') {
                const action = new vscode.CodeAction('TokenLint: Reduce top_k to 6', vscode.CodeActionKind.QuickFix);
                const line = document.lineAt(diagnostic.range.start.line);
                const replaced = line.text.replace(/top_k\s*[:=]\s*\d+/i, 'top_k: 6');
                action.diagnostics = [diagnostic];
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, line.range, replaced);
                actions.push(action);
            }
            if (diagnostic.code === 'security.promptInjection') {
                const action = new vscode.CodeAction('TokenLint: Neutralize suspicious instruction', vscode.CodeActionKind.QuickFix);
                const line = document.lineAt(diagnostic.range.start.line);
                const replaced = line.text
                    .replace(/ignore previous instructions/ig, '[REMOVED: suspicious instruction override]')
                    .replace(/ignore all previous instructions/ig, '[REMOVED: suspicious instruction override]')
                    .replace(/override system prompt/ig, '[REMOVED: suspicious system override]')
                    .replace(/reveal hidden prompt/ig, '[REMOVED: suspicious prompt disclosure]')
                    .replace(/print the system prompt/ig, '[REMOVED: suspicious prompt disclosure]')
                    .replace(/disable safety/ig, '[REMOVED: suspicious safety override]')
                    .replace(/bypass policy/ig, '[REMOVED: suspicious policy bypass]')
                    .replace(/act as developer mode/ig, '[REMOVED: suspicious role override]');
                action.diagnostics = [diagnostic];
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, line.range, replaced);
                actions.push(action);
            }
            if (diagnostic.code === 'security.externalEndpoint') {
                const action = new vscode.CodeAction('TokenLint: Comment external endpoint for review', vscode.CodeActionKind.QuickFix);
                const line = document.lineAt(diagnostic.range.start.line);
                const replaced = `# TOKENLINT REVIEW REQUIRED: ${line.text}`;
                action.diagnostics = [diagnostic];
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, line.range, replaced);
                actions.push(action);
            }
            if (diagnostic.code === 'security.encodedPayload') {
                const action = new vscode.CodeAction('TokenLint: Replace encoded payload with review marker', vscode.CodeActionKind.QuickFix);
                const line = document.lineAt(diagnostic.range.start.line);
                const replaced = '[TOKENLINT REMOVED: suspicious encoded payload requires review]';
                action.diagnostics = [diagnostic];
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, line.range, replaced);
                actions.push(action);
            }
            if (diagnostic.code === 'skills.maliciousSkillTest') {
                const action = new vscode.CodeAction('TokenLint: Disable suspicious skill test', vscode.CodeActionKind.QuickFix);
                const line = document.lineAt(diagnostic.range.start.line);
                const replaced = `# TOKENLINT DISABLED SUSPICIOUS TEST: ${line.text}`;
                action.diagnostics = [diagnostic];
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, line.range, replaced);
                actions.push(action);
            }
        }
        return actions;
    }
}
exports.TokenLintCodeActionProvider = TokenLintCodeActionProvider;
TokenLintCodeActionProvider.providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
];
//# sourceMappingURL=codeActionProvider.js.map