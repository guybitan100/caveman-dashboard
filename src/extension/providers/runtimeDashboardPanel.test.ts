import { beforeEach, describe, expect, it, vi } from 'vitest';

const panelMocks = vi.hoisted(() => {
  let messageHandler: ((message: unknown) => void) | undefined;
  let disposeHandler: (() => void) | undefined;

  const webview = {
    html: '',
    postMessage: vi.fn().mockResolvedValue(true),
    onDidReceiveMessage(handler: (message: unknown) => void) {
      messageHandler = handler;
      return { dispose: vi.fn() };
    }
  };

  const panel = {
    iconPath: undefined as unknown,
    webview,
    reveal: vi.fn(),
    onDidDispose(handler: () => void) {
      disposeHandler = handler;
      return { dispose: vi.fn() };
    }
  };

  return {
    getMessageHandler: () => messageHandler,
    getDisposeHandler: () => disposeHandler,
    webview,
    panel,
    createWebviewPanel: vi.fn(() => panel),
    ViewColumn: { One: 1 },
    joinPath: vi.fn((...parts: unknown[]) => parts.map(String).join('/'))
  };
});

vi.mock('vscode', () => ({
  window: {
    createWebviewPanel: panelMocks.createWebviewPanel
  },
  ViewColumn: panelMocks.ViewColumn,
  Uri: {
    joinPath: panelMocks.joinPath
  }
}));

import { RuntimeDashboardPanel } from './runtimeDashboardPanel';

describe('runtime dashboard panel', () => {
  beforeEach(() => {
    panelMocks.createWebviewPanel.mockClear();
    panelMocks.webview.postMessage.mockClear();
    panelMocks.panel.reveal.mockClear();
  });

  it('creates the dashboard panel, renders observability chrome, and posts state updates', () => {
    const provider = new RuntimeDashboardPanel('/ext' as never);
    const state = {
      generatedAt: 1_718_000_000_000,
      latestSession: {
        id: 'token-lint-1',
        workspace: 'token-lint',
        title: 'New session - runtime dashboard spec',
        startedAt: 1_718_000_000_000,
        endedAt: 1_718_000_010_000,
        model: 'Claude Sonnet 4.6',
        contextWindow: 400_000,
        promptTokens: 42_000,
        completionTokens: 4_200,
        cacheCreateTokens: 18_000,
        cacheReadTokens: 12_000,
        requests: 1,
        estimatedCost: 0.41,
        credits: 41,
        cacheSavings: 0.12,
        cacheEfficiency: 28.6,
        files: ['prompt.md'],
        retrievalFiles: ['rag.yaml'],
        promptFiles: ['prompt.md'],
        skills: ['skill.yaml'],
        mcpConfigs: ['mcp.json'],
        retrievalAmplification: 3.2,
        contextPressure: 88,
        promptStability: 61,
        latencyMs: 1210,
        risk: 'high' as const,
        source: 'simulated' as const
      },
      summary: {
        sessions: 1,
        totalCost: 0.41,
        totalCredits: 41,
        averageCacheEfficiency: 28.6,
        estimatedSavings: 0.12,
        estimatedWaste: 37.4,
        averageRetrievalAmplification: 3.2,
        averageContextPressure: 88,
        stablePromptRegions: 61,
        volatilePromptRegions: 39,
        contextHealth: 48,
        reasoningRisk: 'high' as const
      },
      sessions: [],
      costOverTime: [{ date: '2024-06-11', cost: 0.41 }],
      costByModel: [{ model: 'Claude Sonnet 4.6', cost: 0.41, percent: 100 }],
      cacheBreakdown: {
        totalTokens: 42_000,
        cacheReadTokens: 12_000,
        cacheCreateTokens: 18_000
      },
      retrievalAmplification: [{ date: '2024-06-11', amplification: 3.2 }],
      cacheEfficiencyTrend: [{ date: '2024-06-11', efficiency: 28.6 }],
      contextComposition: {
        systemPrompt: 8_000,
        memory: 6_000,
        retrieval: 12_000,
        toolOutput: 4_000,
        userInput: 12_000,
        completion: 4_200
      },
      workspaces: ['All workspaces', 'token-lint'],
      filter: {
        workspace: 'All workspaces',
        timeWindowDays: 7
      }
    };

    provider.show(state as never);

    expect(panelMocks.createWebviewPanel).toHaveBeenCalledWith(
      'tokenlint.runtimeDashboard',
      'TokenLint Runtime Dashboard',
      1,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    expect(panelMocks.webview.html).toContain('AI Runtime Observability Platform');
    expect(panelMocks.webview.html).toContain('Export CSV');
    expect(panelMocks.webview.html).toContain('Latest Session');
    expect(panelMocks.webview.html).toContain('Estimated Waste');
    expect(panelMocks.webview.html).toContain('Context Composition');
    expect(panelMocks.webview.postMessage).toHaveBeenLastCalledWith({
      type: 'tokenlint.runtimeDashboard',
      payload: state
    });

    provider.show(state as never);
    expect(panelMocks.panel.reveal).toHaveBeenCalledWith(1, true);
  });

  it('forwards webview messages to the registered handler', () => {
    const messages: unknown[] = [];
    const provider = new RuntimeDashboardPanel('/ext' as never);
    provider.setMessageHandler(message => {
      messages.push(message);
    });

    provider.show({
      generatedAt: Date.now(),
      sessions: [],
      summary: {
        sessions: 0,
        totalCost: 0,
        totalCredits: 0,
        averageCacheEfficiency: 0,
        estimatedSavings: 0,
        estimatedWaste: 0,
        averageRetrievalAmplification: 0,
        averageContextPressure: 0,
        stablePromptRegions: 0,
        volatilePromptRegions: 0,
        contextHealth: 0,
        reasoningRisk: 'low' as const
      },
      costOverTime: [],
      costByModel: [],
      cacheBreakdown: {
        totalTokens: 0,
        cacheReadTokens: 0,
        cacheCreateTokens: 0
      },
      retrievalAmplification: [],
      cacheEfficiencyTrend: [],
      contextComposition: {
        systemPrompt: 0,
        memory: 0,
        retrieval: 0,
        toolOutput: 0,
        userInput: 0,
        completion: 0
      },
      workspaces: ['All workspaces'],
      filter: {
        workspace: 'All workspaces',
        timeWindowDays: 7
      }
    } as never);

    panelMocks.getMessageHandler()?.({
      command: 'updateFilter',
      workspace: 'token-lint',
      timeWindowDays: 30
    });
    panelMocks.getMessageHandler()?.({ command: 'exportView', format: 'json' });

    expect(messages).toEqual([
      { command: 'updateFilter', workspace: 'token-lint', timeWindowDays: 30 },
      { command: 'exportView', format: 'json' }
    ]);

    panelMocks.getDisposeHandler()?.();
    provider.show({
      generatedAt: Date.now(),
      sessions: [],
      summary: {
        sessions: 0,
        totalCost: 0,
        totalCredits: 0,
        averageCacheEfficiency: 0,
        estimatedSavings: 0,
        estimatedWaste: 0,
        averageRetrievalAmplification: 0,
        averageContextPressure: 0,
        stablePromptRegions: 0,
        volatilePromptRegions: 0,
        contextHealth: 0,
        reasoningRisk: 'low' as const
      },
      costOverTime: [],
      costByModel: [],
      cacheBreakdown: {
        totalTokens: 0,
        cacheReadTokens: 0,
        cacheCreateTokens: 0
      },
      retrievalAmplification: [],
      cacheEfficiencyTrend: [],
      contextComposition: {
        systemPrompt: 0,
        memory: 0,
        retrieval: 0,
        toolOutput: 0,
        userInput: 0,
        completion: 0
      },
      workspaces: ['All workspaces'],
      filter: {
        workspace: 'All workspaces',
        timeWindowDays: 7
      }
    } as never);

    expect(panelMocks.createWebviewPanel).toHaveBeenCalledTimes(2);
  });
});