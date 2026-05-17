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
exports.applyAllSafeFixes = applyAllSafeFixes;
const vscode = __importStar(require("vscode"));
async function applyAllSafeFixes() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const document = editor.document;
    const diagnostics = vscode.languages
        .getDiagnostics(document.uri)
        .filter(d => d.source === 'TokenLint');
    const safeDiagnostics = diagnostics
        .filter(d => d.code === 'optimization.duplicateInstruction')
        .sort((a, b) => b.range.start.line - a.range.start.line);
    if (!safeDiagnostics.length) {
        vscode.window.showInformationMessage('TokenLint: No safe automatic fixes available.');
        return;
    }
    const edit = new vscode.WorkspaceEdit();
    for (const diagnostic of safeDiagnostics) {
        const line = document.lineAt(diagnostic.range.start.line);
        edit.delete(document.uri, line.rangeIncludingLineBreak);
    }
    const success = await vscode.workspace.applyEdit(edit);
    if (success) {
        await document.save();
        vscode.window.showInformationMessage(`TokenLint applied ${safeDiagnostics.length} safe fixes.`);
    }
}
//# sourceMappingURL=applyAllSafeFixes.js.map