import { beforeEach, describe, expect, it, vi } from 'vitest';

const extensionMocks = vi.hoisted(() => {
  const commandHandlers = new Map<string, () => Promise<void>>();
  const state = {
    activeTextEditor: undefined as
      | {
          document: {
            fileName: string;
          };
        }
      | undefined,
    saveHandler: undefined as ((document: { fileName: string }) => void) | undefined,
    activeEditorHandler: undefined as (() => void) | undefined,
    visibleEditorsHandler: undefined as (() => void) | undefined,
    configurationHandler: undefined as ((event: { affectsConfiguration: (section: string) => boolean }) => void) | undefined
  };

  const diagnosticsInstance = {
    scan: vi.fn(),
    getCached: vi.fn(),
    getFindingCounts: vi.fn(),
    dispose: vi.fn()
  };
  const statusBar = {
    text: '',
    show: vi.fn(),
    command: undefined as string | undefined,
    tooltip: undefined as string | undefined,
    backgroundColor: undefined as unknown
  };
  const budgetController = {
    refresh: vi.fn().mockResolvedValue(undefined),
    invalidateWorkspaceEstimate: vi.fn(),
    showCopilotBudget: vi.fn().mockResolvedValue(undefined),
    analyzeOpenFilesBudget: vi.fn().mockResolvedValue(undefined),
    analyzeWorkspaceBudget: vi.fn().mockResolvedValue(undefined),
    setCopilotBudget: vi.fn().mockResolvedValue(undefined)
  };
  const runtimeController = {
    openRuntimeDashboard: vi.fn().mockResolvedValue(undefined),
    showLatestSession: vi.fn().mockResolvedValue(undefined),
    showAggregateView: vi.fn().mockResolvedValue(undefined),
    exportCostViewAsCsv: vi.fn().mockResolvedValue(undefined),
    exportCostViewAsJson: vi.fn().mockResolvedValue(undefined),
    saveRuntimeSnapshot: vi.fn().mockResolvedValue(undefined),
    showRuntimeHistory: vi.fn().mockResolvedValue(undefined),
    diffRuntimeAgainstPrevious: vi.fn().mockResolvedValue(undefined),
    diffRuntimeAgainst7Days: vi.fn().mockResolvedValue(undefined),
    diffRuntimeAgainstBaseline: vi.fn().mockResolvedValue(undefined),
    clearOldRuntimeHistory: vi.fn().mockResolvedValue(undefined),
    showCostAnalysis: vi.fn().mockResolvedValue(undefined),
    analyzeCacheEfficiency: vi.fn().mockResolvedValue(undefined),
    analyzeRetrievalAmplification: vi.fn().mockResolvedValue(undefined),
    refreshView: vi.fn()
  };

  class MockTokenLintDiagnosticProvider {
    scan = diagnosticsInstance.scan;
    getCached = diagnosticsInstance.getCached;
    getFindingCounts = diagnosticsInstance.getFindingCounts;
    dispose = diagnosticsInstance.dispose;
  }

  class MockTokenLintSidebarProvider {
    static readonly viewType = 'tokenlint.sidebar';

    constructor(public extensionUri: unknown) {}
  }

  class MockTokenLintCodeActionProvider {
    static readonly providedCodeActionKinds = ['quickfix'];
  }

  class MockCopilotBudgetController {
    constructor(statusBarItem: typeof statusBar) {
      statusBarItem.text = 'TokenLint: Budget meter';
      statusBarItem.command = 'tokenlint.showCopilotBudget';
      statusBarItem.show();
    }

    refresh = budgetController.refresh;
    invalidateWorkspaceEstimate = budgetController.invalidateWorkspaceEstimate;
    showCopilotBudget = budgetController.showCopilotBudget;
    analyzeOpenFilesBudget = budgetController.analyzeOpenFilesBudget;
    analyzeWorkspaceBudget = budgetController.analyzeWorkspaceBudget;
    setCopilotBudget = budgetController.setCopilotBudget;
  }

  class MockRuntimeObservabilityController {
    openRuntimeDashboard = runtimeController.openRuntimeDashboard;
    showLatestSession = runtimeController.showLatestSession;
    showAggregateView = runtimeController.showAggregateView;
    exportCostViewAsCsv = runtimeController.exportCostViewAsCsv;
    exportCostViewAsJson = runtimeController.exportCostViewAsJson;
    saveRuntimeSnapshot = runtimeController.saveRuntimeSnapshot;
    showRuntimeHistory = runtimeController.showRuntimeHistory;
    diffRuntimeAgainstPrevious = runtimeController.diffRuntimeAgainstPrevious;
    diffRuntimeAgainst7Days = runtimeController.diffRuntimeAgainst7Days;
    diffRuntimeAgainstBaseline = runtimeController.diffRuntimeAgainstBaseline;
    clearOldRuntimeHistory = runtimeController.clearOldRuntimeHistory;
    showCostAnalysis = runtimeController.showCostAnalysis;
    analyzeCacheEfficiency = runtimeController.analyzeCacheEfficiency;
    analyzeRetrievalAmplification = runtimeController.analyzeRetrievalAmplification;
    refreshView = runtimeController.refreshView;
  }

  return {
    state,
    commandHandlers,
    diagnosticsInstance,
    statusBar,
    budgetController,
    runtimeController,
    registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerCommand: vi.fn((command: string, handler: () => Promise<void>) => {
      commandHandlers.set(command, handler);
      return { dispose: vi.fn() };
    }),
    registerHoverProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerCodeActionsProvider: vi.fn(() => ({ dispose: vi.fn() })),
    onDidSaveTextDocument: vi.fn((handler: (document: { fileName: string }) => void) => {
      state.saveHandler = handler;
      return { dispose: vi.fn() };
    }),
    onDidChangeActiveTextEditor: vi.fn((handler: () => void) => {
      state.activeEditorHandler = handler;
      return { dispose: vi.fn() };
    }),
    onDidChangeVisibleTextEditors: vi.fn((handler: () => void) => {
      state.visibleEditorsHandler = handler;
      return { dispose: vi.fn() };
    }),
    onDidChangeConfiguration: vi.fn((handler: (event: { affectsConfiguration: (section: string) => boolean }) => void) => {
      state.configurationHandler = handler;
      return { dispose: vi.fn() };
    }),
    createStatusBarItem: vi.fn(() => statusBar),
    scanCurrentFile: vi.fn(),
    scanWorkspace: vi.fn(),
    generateReport: vi.fn(),
    showIR: vi.fn(),
    applyAllSafeFixes: vi.fn(),
    showFixGraph: vi.fn(),
    scanOrFix: vi.fn(),
    createHoverProvider: vi.fn(() => 'hover-provider'),
    shouldAnalyzeFile: vi.fn(),
    MockTokenLintDiagnosticProvider,
    MockTokenLintSidebarProvider,
    MockTokenLintCodeActionProvider,
    MockCopilotBudgetController,
    MockRuntimeObservabilityController,
    StatusBarAlignment: { Left: 1 }
  };
});

vi.mock('vscode', () => ({
  window: {
    get activeTextEditor() {
      return extensionMocks.state.activeTextEditor;
    },
    createStatusBarItem: extensionMocks.createStatusBarItem,
    registerWebviewViewProvider: extensionMocks.registerWebviewViewProvider,
    onDidChangeActiveTextEditor: extensionMocks.onDidChangeActiveTextEditor,
    onDidChangeVisibleTextEditors: extensionMocks.onDidChangeVisibleTextEditors
  },
  commands: {
    registerCommand: extensionMocks.registerCommand
  },
  languages: {
    registerHoverProvider: extensionMocks.registerHoverProvider,
    registerCodeActionsProvider: extensionMocks.registerCodeActionsProvider
  },
  workspace: {
    onDidSaveTextDocument: extensionMocks.onDidSaveTextDocument,
    onDidChangeConfiguration: extensionMocks.onDidChangeConfiguration
  },
  StatusBarAlignment: extensionMocks.StatusBarAlignment
}));

vi.mock('./providers/diagnosticProvider', () => ({
  TokenLintDiagnosticProvider: extensionMocks.MockTokenLintDiagnosticProvider
}));

vi.mock('./providers/hoverProvider', () => ({
  createHoverProvider: extensionMocks.createHoverProvider
}));

vi.mock('./providers/codeActionProvider', () => ({
  TokenLintCodeActionProvider: extensionMocks.MockTokenLintCodeActionProvider
}));

vi.mock('./providers/sidebarProvider', () => ({
  TokenLintSidebarProvider: extensionMocks.MockTokenLintSidebarProvider
}));

vi.mock('./utils/scanFilter', () => ({
  shouldAnalyzeFile: extensionMocks.shouldAnalyzeFile
}));

vi.mock('./utils/copilotBudget', () => ({
  CopilotBudgetController: extensionMocks.MockCopilotBudgetController,
  shouldIncludeBudgetFile: extensionMocks.shouldAnalyzeFile
}));

vi.mock('./utils/runtimeObservability', () => ({
  RuntimeObservabilityController: extensionMocks.MockRuntimeObservabilityController
}));

vi.mock('./commands/scanCurrentFile', () => ({
  scanCurrentFile: extensionMocks.scanCurrentFile
}));

vi.mock('./commands/scanWorkspace', () => ({
  scanWorkspace: extensionMocks.scanWorkspace
}));

vi.mock('./commands/generateReport', () => ({
  generateReport: extensionMocks.generateReport
}));

vi.mock('./commands/showIR', () => ({
  showIR: extensionMocks.showIR
}));

vi.mock('./commands/applyAllSafeFixes', () => ({
  applyAllSafeFixes: extensionMocks.applyAllSafeFixes
}));

vi.mock('./commands/showFixGraph', () => ({
  showFixGraph: extensionMocks.showFixGraph
}));

vi.mock('./commands/scanOrFix', () => ({
  scanOrFix: extensionMocks.scanOrFix
}));

import { activate, deactivate } from './extension';

describe('extension activation', () => {
  beforeEach(() => {
    extensionMocks.commandHandlers.clear();
    extensionMocks.state.activeTextEditor = undefined;
    extensionMocks.state.saveHandler = undefined;
    extensionMocks.state.activeEditorHandler = undefined;
    extensionMocks.state.visibleEditorsHandler = undefined;
    extensionMocks.state.configurationHandler = undefined;
    extensionMocks.statusBar.text = '';
    extensionMocks.statusBar.show.mockReset();
    extensionMocks.registerWebviewViewProvider.mockClear();
    extensionMocks.registerCommand.mockClear();
    extensionMocks.registerHoverProvider.mockClear();
    extensionMocks.registerCodeActionsProvider.mockClear();
    extensionMocks.onDidSaveTextDocument.mockClear();
    extensionMocks.onDidChangeActiveTextEditor.mockClear();
    extensionMocks.onDidChangeVisibleTextEditors.mockClear();
    extensionMocks.onDidChangeConfiguration.mockClear();
    extensionMocks.createStatusBarItem.mockClear();
    extensionMocks.scanCurrentFile.mockReset();
    extensionMocks.scanWorkspace.mockReset();
    extensionMocks.generateReport.mockReset();
    extensionMocks.showIR.mockReset();
    extensionMocks.applyAllSafeFixes.mockReset();
    extensionMocks.showFixGraph.mockReset();
    extensionMocks.scanOrFix.mockReset();
    extensionMocks.createHoverProvider.mockClear();
    extensionMocks.shouldAnalyzeFile.mockReset();
    extensionMocks.diagnosticsInstance.scan.mockReset();
    extensionMocks.diagnosticsInstance.getCached.mockReset();
    extensionMocks.diagnosticsInstance.getFindingCounts.mockReset();
    extensionMocks.diagnosticsInstance.dispose.mockReset();
    extensionMocks.budgetController.refresh.mockReset();
    extensionMocks.budgetController.refresh.mockResolvedValue(undefined);
    extensionMocks.budgetController.invalidateWorkspaceEstimate.mockReset();
    extensionMocks.budgetController.showCopilotBudget.mockReset();
    extensionMocks.budgetController.showCopilotBudget.mockResolvedValue(undefined);
    extensionMocks.budgetController.analyzeOpenFilesBudget.mockReset();
    extensionMocks.budgetController.analyzeOpenFilesBudget.mockResolvedValue(undefined);
    extensionMocks.budgetController.analyzeWorkspaceBudget.mockReset();
    extensionMocks.budgetController.analyzeWorkspaceBudget.mockResolvedValue(undefined);
    extensionMocks.budgetController.setCopilotBudget.mockReset();
    extensionMocks.budgetController.setCopilotBudget.mockResolvedValue(undefined);
    extensionMocks.runtimeController.openRuntimeDashboard.mockReset();
    extensionMocks.runtimeController.openRuntimeDashboard.mockResolvedValue(undefined);
    extensionMocks.runtimeController.showLatestSession.mockReset();
    extensionMocks.runtimeController.showLatestSession.mockResolvedValue(undefined);
    extensionMocks.runtimeController.showAggregateView.mockReset();
    extensionMocks.runtimeController.showAggregateView.mockResolvedValue(undefined);
    extensionMocks.runtimeController.exportCostViewAsCsv.mockReset();
    extensionMocks.runtimeController.exportCostViewAsCsv.mockResolvedValue(undefined);
    extensionMocks.runtimeController.exportCostViewAsJson.mockReset();
    extensionMocks.runtimeController.exportCostViewAsJson.mockResolvedValue(undefined);
    extensionMocks.runtimeController.saveRuntimeSnapshot.mockReset();
    extensionMocks.runtimeController.saveRuntimeSnapshot.mockResolvedValue(undefined);
    extensionMocks.runtimeController.showRuntimeHistory.mockReset();
    extensionMocks.runtimeController.showRuntimeHistory.mockResolvedValue(undefined);
    extensionMocks.runtimeController.diffRuntimeAgainstPrevious.mockReset();
    extensionMocks.runtimeController.diffRuntimeAgainstPrevious.mockResolvedValue(undefined);
    extensionMocks.runtimeController.diffRuntimeAgainst7Days.mockReset();
    extensionMocks.runtimeController.diffRuntimeAgainst7Days.mockResolvedValue(undefined);
    extensionMocks.runtimeController.diffRuntimeAgainstBaseline.mockReset();
    extensionMocks.runtimeController.diffRuntimeAgainstBaseline.mockResolvedValue(undefined);
    extensionMocks.runtimeController.clearOldRuntimeHistory.mockReset();
    extensionMocks.runtimeController.clearOldRuntimeHistory.mockResolvedValue(undefined);
    extensionMocks.runtimeController.showCostAnalysis.mockReset();
    extensionMocks.runtimeController.showCostAnalysis.mockResolvedValue(undefined);
    extensionMocks.runtimeController.analyzeCacheEfficiency.mockReset();
    extensionMocks.runtimeController.analyzeCacheEfficiency.mockResolvedValue(undefined);
    extensionMocks.runtimeController.analyzeRetrievalAmplification.mockReset();
    extensionMocks.runtimeController.analyzeRetrievalAmplification.mockResolvedValue(undefined);
    extensionMocks.runtimeController.refreshView.mockReset();
  });

  it('registers providers, commands, and status bar wiring', async () => {
    const context = { extensionUri: 'ext-uri', subscriptions: [] as unknown[] };
    extensionMocks.state.activeTextEditor = {
      document: {
        fileName: 'prompt.md'
      }
    };

    activate(context as never);

    expect(extensionMocks.statusBar.text).toBe('TokenLint: Budget meter');
    expect(extensionMocks.statusBar.show).toHaveBeenCalled();
    expect(extensionMocks.registerWebviewViewProvider).toHaveBeenCalledWith(
      'tokenlint.sidebar',
      expect.any(extensionMocks.MockTokenLintSidebarProvider)
    );
    expect(extensionMocks.registerCommand).toHaveBeenCalledTimes(25);
    expect(extensionMocks.registerHoverProvider).toHaveBeenCalledWith(
      expect.arrayContaining([
        { scheme: 'file', language: 'markdown' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'python' },
        { scheme: 'file', pattern: '**/*.prompt' }
      ]),
      'hover-provider'
    );
    expect(extensionMocks.registerCodeActionsProvider).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(extensionMocks.MockTokenLintCodeActionProvider),
      { providedCodeActionKinds: ['quickfix'] }
    );
    expect(extensionMocks.budgetController.refresh).toHaveBeenCalledWith({ forceWorkspaceRefresh: true, reason: 'configuration' });

    await extensionMocks.commandHandlers.get('tokenlint.scanCurrentFile')?.();
    expect(extensionMocks.scanCurrentFile).toHaveBeenCalledWith(extensionMocks.diagnosticsInstance);
    expect(extensionMocks.budgetController.refresh).toHaveBeenLastCalledWith({ reason: 'scan' });

    await extensionMocks.commandHandlers.get('tokenlint.scanWorkspace')?.();
    expect(extensionMocks.scanWorkspace).toHaveBeenCalledWith(extensionMocks.diagnosticsInstance);
    expect(extensionMocks.budgetController.refresh).toHaveBeenLastCalledWith({ forceWorkspaceRefresh: true, reason: 'scan' });

    await extensionMocks.commandHandlers.get('tokenlint.scanCurrentFile')?.();

    await extensionMocks.commandHandlers.get('tokenlint.scanOrFix')?.();
    expect(extensionMocks.scanOrFix).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.setCopilotBudget')?.();
    expect(extensionMocks.budgetController.setCopilotBudget).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.analyzeOpenFilesBudget')?.();
    expect(extensionMocks.budgetController.analyzeOpenFilesBudget).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.showCopilotBudget')?.();
    expect(extensionMocks.budgetController.showCopilotBudget).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.openRuntimeDashboard')?.();
    expect(extensionMocks.runtimeController.openRuntimeDashboard).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.showLatestSession')?.();
    expect(extensionMocks.runtimeController.showLatestSession).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.showAggregateView')?.();
    expect(extensionMocks.runtimeController.showAggregateView).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.exportCostViewCsv')?.();
    expect(extensionMocks.runtimeController.exportCostViewAsCsv).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.exportCostViewJson')?.();
    expect(extensionMocks.runtimeController.exportCostViewAsJson).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.saveRuntimeSnapshot')?.();
    expect(extensionMocks.runtimeController.saveRuntimeSnapshot).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.showRuntimeHistory')?.();
    expect(extensionMocks.runtimeController.showRuntimeHistory).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.diffRuntimeAgainstPrevious')?.();
    expect(extensionMocks.runtimeController.diffRuntimeAgainstPrevious).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.diffRuntimeAgainst7Days')?.();
    expect(extensionMocks.runtimeController.diffRuntimeAgainst7Days).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.diffRuntimeAgainstBaseline')?.();
    expect(extensionMocks.runtimeController.diffRuntimeAgainstBaseline).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.clearOldRuntimeHistory')?.();
    expect(extensionMocks.runtimeController.clearOldRuntimeHistory).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.showCostAnalysis')?.();
    expect(extensionMocks.runtimeController.showCostAnalysis).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.analyzeCacheEfficiency')?.();
    expect(extensionMocks.runtimeController.analyzeCacheEfficiency).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.analyzeRetrievalAmplification')?.();
    expect(extensionMocks.runtimeController.analyzeRetrievalAmplification).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.analyzeWorkspaceBudget')?.();
    expect(extensionMocks.budgetController.analyzeWorkspaceBudget).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.generateReport')?.();
    expect(extensionMocks.generateReport).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.showIR')?.();
    expect(extensionMocks.showIR).toHaveBeenCalled();

    await extensionMocks.commandHandlers.get('tokenlint.applyAllSafeFixes')?.();
    expect(extensionMocks.applyAllSafeFixes).toHaveBeenCalledWith(extensionMocks.diagnosticsInstance);

    await extensionMocks.commandHandlers.get('tokenlint.showFixGraph')?.();
    expect(extensionMocks.showFixGraph).toHaveBeenCalled();

    expect(context.subscriptions.length).toBe(34);
  });

  it('updates diagnostics on save for both ignored and analyzable files', () => {
    const context = { extensionUri: 'ext-uri', subscriptions: [] as unknown[] };
    const ignoredDocument = { fileName: 'ignored.tmp' };
    const analyzedDocument = { fileName: 'prompt.md' };

    activate(context as never);

    extensionMocks.shouldAnalyzeFile.mockReturnValue(false);
    extensionMocks.state.saveHandler?.(ignoredDocument);
    expect(extensionMocks.diagnosticsInstance.scan).toHaveBeenCalledWith(ignoredDocument);
    expect(extensionMocks.budgetController.invalidateWorkspaceEstimate).not.toHaveBeenCalled();
    expect(extensionMocks.budgetController.refresh).toHaveBeenLastCalledWith({ reason: 'scan' });

    extensionMocks.shouldAnalyzeFile.mockReturnValue(true);
    extensionMocks.diagnosticsInstance.scan.mockReturnValue({
      metrics: { findingCount: 4, totalTokens: 44 }
    });
    extensionMocks.state.saveHandler?.(analyzedDocument);

    expect(extensionMocks.diagnosticsInstance.scan).toHaveBeenCalledWith(analyzedDocument);
    expect(extensionMocks.budgetController.invalidateWorkspaceEstimate).toHaveBeenCalledTimes(1);
    expect(extensionMocks.budgetController.refresh).toHaveBeenLastCalledWith({ forceWorkspaceRefresh: true, reason: 'scan' });
  });

  it('refreshes the budget meter on editor and configuration changes', () => {
    const context = { extensionUri: 'ext-uri', subscriptions: [] as unknown[] };

    activate(context as never);
    extensionMocks.budgetController.refresh.mockClear();

    extensionMocks.state.activeEditorHandler?.();
    expect(extensionMocks.budgetController.refresh).toHaveBeenLastCalledWith({ reason: 'focus' });

    extensionMocks.state.visibleEditorsHandler?.();
    expect(extensionMocks.budgetController.refresh).toHaveBeenLastCalledWith({ reason: 'focus' });

    extensionMocks.state.configurationHandler?.({
      affectsConfiguration: (section: string) => section === 'tokenlint.copilotBudget'
    });
    expect(extensionMocks.budgetController.refresh).toHaveBeenLastCalledWith({ forceWorkspaceRefresh: true, reason: 'configuration' });

    extensionMocks.state.configurationHandler?.({
      affectsConfiguration: (section: string) => section === 'tokenlint.history.enabled'
    });
    expect(extensionMocks.runtimeController.refreshView).toHaveBeenCalled();
  });

  it('deactivate is a no-op', () => {
    expect(deactivate()).toBeUndefined();
  });
});