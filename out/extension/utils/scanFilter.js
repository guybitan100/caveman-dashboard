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
exports.shouldAnalyzeFile = shouldAnalyzeFile;
exports.getSkipReason = getSkipReason;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const languageDetector_1 = require("../../core/parser/languageDetector");
const ignoreFileName = '.tokenlintignore';
const ignoreFileCache = new Map();
function toPosix(value) {
    return value.replace(/\\/g, '/');
}
function escapeForRegex(value) {
    return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}
function globToRegExp(glob) {
    let pattern = '';
    for (let index = 0; index < glob.length; index += 1) {
        const char = glob[index];
        const next = glob[index + 1];
        const afterNext = glob[index + 2];
        if (char === '*') {
            if (next === '*') {
                if (afterNext === '/') {
                    pattern += '(?:.*/)?';
                    index += 2;
                }
                else {
                    pattern += '.*';
                    index += 1;
                }
            }
            else {
                pattern += '[^/]*';
            }
            continue;
        }
        if (char === '?') {
            pattern += '[^/]';
            continue;
        }
        pattern += escapeForRegex(char);
    }
    return new RegExp(`^${pattern}$`, 'i');
}
function readIgnorePatterns(rootPath) {
    const ignorePath = path.join(rootPath, ignoreFileName);
    try {
        const stats = fs.statSync(ignorePath);
        const cached = ignoreFileCache.get(ignorePath);
        if (cached && cached.modifiedMs === stats.mtimeMs) {
            return cached.patterns;
        }
        const fileText = fs.readFileSync(ignorePath, 'utf8');
        const patterns = fileText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'))
            .map(line => {
            let normalized = toPosix(line).replace(/^\.\//, '').replace(/^\//, '');
            if (normalized.endsWith('/')) {
                normalized += '**';
            }
            return {
                matchesBaseName: !normalized.includes('/'),
                regex: globToRegExp(normalized)
            };
        });
        ignoreFileCache.set(ignorePath, {
            modifiedMs: stats.mtimeMs,
            patterns
        });
        return patterns;
    }
    catch {
        ignoreFileCache.delete(ignorePath);
        return [];
    }
}
function getWorkspaceFolder(fileName) {
    return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileName));
}
function isIgnoredByWorkspace(fileName) {
    const workspaceFolder = getWorkspaceFolder(fileName);
    if (!workspaceFolder) {
        return false;
    }
    const patterns = readIgnorePatterns(workspaceFolder.uri.fsPath);
    if (patterns.length === 0) {
        return false;
    }
    const relativePath = toPosix(path.relative(workspaceFolder.uri.fsPath, fileName));
    const baseName = path.posix.basename(relativePath);
    return patterns.some(pattern => {
        if (pattern.regex.test(relativePath)) {
            return true;
        }
        return pattern.matchesBaseName && pattern.regex.test(baseName);
    });
}
function shouldAnalyzeFile(fileName) {
    if ((0, languageDetector_1.isGeneratedDependencyFile)(fileName)) {
        return false;
    }
    if ((0, languageDetector_1.detectKind)(fileName) === 'unknown') {
        return false;
    }
    return !isIgnoredByWorkspace(fileName);
}
function getSkipReason(fileName) {
    if ((0, languageDetector_1.isGeneratedDependencyFile)(fileName)) {
        return 'generated dependency lockfile';
    }
    if ((0, languageDetector_1.detectKind)(fileName) === 'unknown') {
        return 'unsupported file type';
    }
    if (isIgnoredByWorkspace(fileName)) {
        const workspaceFolder = getWorkspaceFolder(fileName);
        const relativePath = workspaceFolder
            ? toPosix(path.relative(workspaceFolder.uri.fsPath, fileName))
            : (0, languageDetector_1.normalizeFileName)(fileName);
        return `ignored by ${ignoreFileName}: ${relativePath}`;
    }
    return 'excluded file';
}
//# sourceMappingURL=scanFilter.js.map