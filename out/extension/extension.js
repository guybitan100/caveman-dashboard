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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const diagnosticProvider_1 = require("./providers/diagnosticProvider");
const hoverProvider_1 = require("./providers/hoverProvider");
const codeActionProvider_1 = require("./providers/codeActionProvider");
const sidebarProvider_1 = require("./providers/sidebarProvider");
const scanFilter_1 = require("./utils/scanFilter");
const scanCurrentFile_1 = require("./commands/scanCurrentFile");
const scanWorkspace_1 = require("./commands/scanWorkspace");
const generateReport_1 = require("./commands/generateReport");
const showIR_1 = require("./commands/showIR");
const applyAllSafeFixes_1 = require("./commands/applyAllSafeFixes");
function activate(context) {
    const diagnostics = new diagnosticProvider_1.TokenLintDiagnosticProvider();
    const sidebarProvider = new sidebarProvider_1.TokenLintSidebarProvider(context.extensionUri);
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = 'TokenLint: Ready';
    statusBar.show();
    const supportedSelectors = [
        { scheme: 'file', language: 'markdown' },
        { scheme: 'file', language: 'yaml' },
        { scheme: 'file', language: 'json' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'python' },
        { scheme: 'file', pattern: '**/*.prompt' }
    ];
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(sidebarProvider_1.TokenLintSidebarProvider.viewType, sidebarProvider), vscode.commands.registerCommand('tokenlint.scanCurrentFile', async () => {
        await (0, scanCurrentFile_1.scanCurrentFile)(diagnostics);
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const cached = diagnostics.getCached(editor.document);
            if (cached) {
                statusBar.text = `TokenLint: ${cached.metrics.findingCount} findings | ${cached.metrics.totalTokens} tokens`;
            }
        }
    }), vscode.commands.registerCommand('tokenlint.scanWorkspace', async () => {
        await (0, scanWorkspace_1.scanWorkspace)(diagnostics);
    }), vscode.commands.registerCommand('tokenlint.generateReport', async () => {
        await (0, generateReport_1.generateReport)();
    }), vscode.commands.registerCommand('tokenlint.showIR', async () => {
        await (0, showIR_1.showIR)();
    }), vscode.commands.registerCommand('tokenlint.applyAllSafeFixes', async () => {
        await (0, applyAllSafeFixes_1.applyAllSafeFixes)();
    }), vscode.languages.registerHoverProvider(supportedSelectors, (0, hoverProvider_1.createHoverProvider)()), vscode.languages.registerCodeActionsProvider(supportedSelectors, new codeActionProvider_1.TokenLintCodeActionProvider(), {
        providedCodeActionKinds: codeActionProvider_1.TokenLintCodeActionProvider.providedCodeActionKinds
    }), diagnostics, statusBar);
    vscode.workspace.onDidSaveTextDocument(document => {
        if (!(0, scanFilter_1.shouldAnalyzeFile)(document.fileName)) {
            diagnostics.scan(document);
            return;
        }
        const result = diagnostics.scan(document);
        statusBar.text = `TokenLint: ${result.metrics.findingCount} findings | ${result.metrics.totalTokens} tokens`;
    });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map