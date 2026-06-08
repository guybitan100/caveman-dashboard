import { beforeEach, describe, expect, it, vi } from 'vitest';

const analysisPanelMocks = vi.hoisted(() => {
  let disposeHandler: (() => void) | undefined;

  const webview = {
    html: ''
  };

  const panel = {
    title: 'TokenLint Runtime Cost Analysis',
    iconPath: undefined as unknown,
    webview,
    reveal: vi.fn(),
    onDidDispose(handler: () => void) {
      disposeHandler = handler;
      return { dispose: vi.fn() };
    }
  };

  return {
    panel,
    webview,
    createWebviewPanel: vi.fn(() => panel),
    ViewColumn: { Beside: 2 },
    joinPath: vi.fn((...parts: unknown[]) => parts.map(String).join('/')),
    getDisposeHandler: () => disposeHandler
  };
});

vi.mock('vscode', () => ({
  window: {
    createWebviewPanel: analysisPanelMocks.createWebviewPanel
  },
  ViewColumn: analysisPanelMocks.ViewColumn,
  Uri: {
    joinPath: analysisPanelMocks.joinPath
  }
}));

import { RuntimeAnalysisPanel } from './runtimeAnalysisPanel';

describe('runtime analysis panel', () => {
  beforeEach(() => {
    analysisPanelMocks.createWebviewPanel.mockClear();
    analysisPanelMocks.panel.reveal.mockClear();
    analysisPanelMocks.webview.html = '';
  });

  it('renders a cost analysis webview with enterprise analysis content', () => {
    const provider = new RuntimeAnalysisPanel('/ext' as never);
    provider.show('cost', buildState() as never);

    expect(analysisPanelMocks.createWebviewPanel).toHaveBeenCalledWith(
      'tokenlint.runtimeAnalysis',
      'TokenLint Runtime Cost Analysis',
      2,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    expect(analysisPanelMocks.webview.html).toContain('Runtime Cost Analysis');
    expect(analysisPanelMocks.webview.html).toContain('Model Usage Distribution');
    expect(analysisPanelMocks.webview.html).toContain('Optimization Recommendations');
  });

  it('reuses the same panel and updates the title when switching analysis kinds', () => {
    const provider = new RuntimeAnalysisPanel('/ext' as never);
    provider.show('cost', buildState() as never);
    provider.show('retrieval', buildState() as never);

    expect(analysisPanelMocks.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(analysisPanelMocks.panel.reveal).toHaveBeenCalledWith(2, true);
    expect(analysisPanelMocks.panel.title).toBe('TokenLint Retrieval Amplification Analysis');
    expect(analysisPanelMocks.webview.html).toContain('Retrieval Amplification Analysis');

    analysisPanelMocks.getDisposeHandler()?.();
    provider.show('cache', buildState() as never);
    expect(analysisPanelMocks.createWebviewPanel).toHaveBeenCalledTimes(2);
  });
});

function buildState() {
  return {
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
    costOverTime: [{ date: '2024-06-11', cost: 0.41 }, { date: '2024-06-12', cost: 0.67 }],
    costByModel: [{ model: 'Claude Sonnet 4.6', cost: 0.41, percent: 100 }],
    cacheBreakdown: {
      totalTokens: 42_000,
      cacheReadTokens: 12_000,
      cacheCreateTokens: 18_000
    },
    retrievalAmplification: [{ date: '2024-06-11', amplification: 3.2 }, { date: '2024-06-12', amplification: 4.4 }],
    cacheEfficiencyTrend: [{ date: '2024-06-11', efficiency: 28.6 }, { date: '2024-06-12', efficiency: 36.2 }],
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
    },
    activeSection: 'analysis' as const
  };
}