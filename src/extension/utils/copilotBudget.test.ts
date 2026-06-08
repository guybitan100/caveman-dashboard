import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  ThemeColor: class ThemeColor {
    constructor(public id: string) {}
  },
  ConfigurationTarget: {
    Workspace: 2
  },
  ViewColumn: {
    Beside: 'beside'
  },
  window: {
    visibleTextEditors: [],
    showInformationMessage: vi.fn(),
    showTextDocument: vi.fn(),
    showInputBox: vi.fn()
  },
  workspace: {
    workspaceFolders: [],
    findFiles: vi.fn(),
    openTextDocument: vi.fn(),
    asRelativePath: vi.fn((value: { fsPath: string } | string) => {
      return typeof value === 'string' ? value : value.fsPath;
    }),
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn()
    }))
  }
}));

vi.mock('./scanFilter', () => ({
  shouldAnalyzeFile: vi.fn((fileName: string) => fileName.endsWith('prompt.md')),
  workspaceScanGlob: '**/*.{md,prompt,yaml,yml,json,ts,tsx,py}'
}));

vi.mock('./targetDocument', () => ({
  resolveTargetDocument: vi.fn()
}));

import {
  formatStatusBarText,
  renderWorkspaceBudgetReport,
  shouldIncludeBudgetFile
} from './copilotBudget';

describe('copilotBudget helpers', () => {
  it('formats status bar text for low, high, and critical states', () => {
    expect(formatStatusBarText({
      budgetTokens: 128000,
      usedTokens: 42300,
      usagePercent: 33,
      currentFileTokens: 8420,
      openFilesTokens: 31700,
      workspaceTokens: 0,
      estimatedRetrievalTokens: 0,
      estimatedFinalContext: 42300,
      risk: 'low'
    })).toBe('TokenLint: 42.3k / 128k - 33%');

    expect(formatStatusBarText({
      budgetTokens: 128000,
      usedTokens: 91000,
      usagePercent: 71,
      currentFileTokens: 8420,
      openFilesTokens: 31700,
      workspaceTokens: 0,
      estimatedRetrievalTokens: 0,
      estimatedFinalContext: 91000,
      risk: 'high'
    })).toBe('TokenLint: 91k / 128k - HIGH');

    expect(formatStatusBarText({
      budgetTokens: 128000,
      usedTokens: 122000,
      usagePercent: 95,
      currentFileTokens: 8420,
      openFilesTokens: 31700,
      workspaceTokens: 0,
      estimatedRetrievalTokens: 0,
      estimatedFinalContext: 122000,
      risk: 'critical'
    })).toBe('TokenLint: 122k / 128k - CRITICAL');
  });

  it('renders the workspace report summary and highest-risk files', () => {
    const report = renderWorkspaceBudgetReport(
      {
        filesScanned: 84,
        estimatedTokens: 418000,
        estimatedRetrievalTokens: 124000,
        estimatedFinalContext: 542000,
        estimatedRuntimeAmplification: 12.4,
        highestRiskFiles: ['agent.yaml', 'support_skill.prompt', 'rag_config.yaml'],
        fileEstimates: []
      },
      {
        budgetTokens: 128000,
        usedTokens: 112900,
        usagePercent: 88,
        currentFileTokens: 8420,
        openFilesTokens: 31700,
        workspaceTokens: 112900,
        estimatedRetrievalTokens: 15000,
        estimatedFinalContext: 112900,
        risk: 'high'
      }
    );

    expect(report).toContain('# Workspace Context Analysis');
    expect(report).toContain('Estimated Runtime Amplification: 12.4x');
    expect(report).toContain('- agent.yaml');
    expect(report).toContain('- rag_config.yaml');
  });

  it('includes workflow, memory, and retrieval-style files in workspace budget scans', () => {
    expect(shouldIncludeBudgetFile('/workspace/.github/workflows/copilot-agent.yaml')).toBe(true);
    expect(shouldIncludeBudgetFile('/workspace/config/rag_config.yaml')).toBe(true);
    expect(shouldIncludeBudgetFile('/workspace/memory/settings.json')).toBe(true);
    expect(shouldIncludeBudgetFile('/workspace/package-lock.json')).toBe(false);
    expect(shouldIncludeBudgetFile('/workspace/docs/notes.md')).toBe(false);
  });
});