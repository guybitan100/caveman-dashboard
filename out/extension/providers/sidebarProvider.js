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
exports.TokenLintSidebarProvider = void 0;
const vscode = __importStar(require("vscode"));
class TokenLintSidebarProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView) {
        webviewView.webview.options = {
            enableScripts: true
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'scanCurrentFile':
                    await vscode.commands.executeCommand('tokenlint.scanCurrentFile');
                    break;
                case 'scanWorkspace':
                    await vscode.commands.executeCommand('tokenlint.scanWorkspace');
                    break;
                case 'generateReport':
                    await vscode.commands.executeCommand('tokenlint.generateReport');
                    break;
                case 'showIR':
                    await vscode.commands.executeCommand('tokenlint.showIR');
                    break;
                case 'applyAllSafeFixes':
                    await vscode.commands.executeCommand('tokenlint.applyAllSafeFixes');
                    break;
            }
        });
    }
    getHtml(webview) {
        const nonce = String(Date.now());
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 14px;
    }

    .title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      margin-bottom: 16px;
      line-height: 1.4;
    }

    button {
      width: 100%;
      margin-bottom: 8px;
      padding: 8px 10px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      border-radius: 4px;
      text-align: left;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .section {
      margin-top: 18px;
      margin-bottom: 8px;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.08em;
    }

    .note {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="title">TokenLint</div>
  <div class="subtitle">
    Compiler-style diagnostics for prompts, skills, MCP workflows, and cognitive security.
  </div>

  <div class="section">Scan</div>
  <button onclick="send('scanCurrentFile')">Scan Current File</button>
  <button onclick="send('scanWorkspace')">Scan Workspace</button>

  <div class="section">Reports</div>
  <button class="secondary" onclick="send('generateReport')">Generate Report</button>
  <button class="secondary" onclick="send('showIR')">Show IR</button>

  <div class="section">Fixes</div>
  <button onclick="send('applyAllSafeFixes')">Apply All Safe Fixes</button>

  <div class="note">
    Safe automatic fixes currently remove exact duplicate instructions.
    Security-related fixes require review.
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function send(command) {
      vscode.postMessage({ command });
    }
  </script>
</body>
</html>`;
    }
}
exports.TokenLintSidebarProvider = TokenLintSidebarProvider;
TokenLintSidebarProvider.viewType = 'tokenlint.sidebar';
//# sourceMappingURL=sidebarProvider.js.map