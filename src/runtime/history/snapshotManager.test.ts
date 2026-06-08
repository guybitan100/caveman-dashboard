import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RuntimeHistoryStore } from './historyStore';
import { RuntimeSnapshotCaptureInput, RuntimeSnapshotManager } from './snapshotManager';

type RuntimeSnapshotInputOverrides = Omit<
  Partial<RuntimeSnapshotCaptureInput>,
  'latestSession' | 'dashboardSummary' | 'budget' | 'workspaceAnalysis'
> & {
  latestSession?: Partial<NonNullable<RuntimeSnapshotCaptureInput['latestSession']>>;
  dashboardSummary?: Partial<RuntimeSnapshotCaptureInput['dashboardSummary']>;
  budget?: Partial<RuntimeSnapshotCaptureInput['budget']>;
  workspaceAnalysis?: Partial<NonNullable<RuntimeSnapshotCaptureInput['workspaceAnalysis']>>;
};

describe('runtime snapshot manager', () => {
  let tempDir: string;
  let manager: RuntimeSnapshotManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenlint-snapshot-'));
    manager = new RuntimeSnapshotManager(new RuntimeHistoryStore(tempDir));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('captures snapshots, dedupes identical payloads, and compares against the previous snapshot', () => {
    const first = manager.captureSnapshot(buildInput({ createdAt: Date.parse('2026-06-01T10:00:00Z') }), defaultSettings());
    const duplicate = manager.captureSnapshot(buildInput({ createdAt: Date.parse('2026-06-01T10:05:00Z') }), defaultSettings());
    const second = manager.captureSnapshot(buildInput({
      createdAt: Date.parse('2026-06-08T10:00:00Z'),
      latestSession: {
        promptTokens: 31_880,
        completionTokens: 5_480,
        cacheCreateTokens: 11_000,
        cacheReadTokens: 6_000,
        estimatedCost: 1.92,
        credits: 192,
        cacheEfficiency: 52.4,
        retrievalAmplification: 9.2,
        promptStability: 57
      },
      dashboardSummary: {
        contextHealth: 68
      },
      budget: {
        usedTokens: 31_880
      },
      workspaceAnalysis: {
        highestRiskFiles: ['src/agent.yaml'],
        fileEstimates: [
          {
            fileName: 'src/agent.yaml',
            tokens: 8_200,
            estimatedRetrievalTokens: 2_400,
            estimatedFinalContext: 24_000
          }
        ]
      },
      diagnosticsByFile: new Map([['src/agent.yaml', 8]])
    }), defaultSettings());

    expect(first?.id).toBe(duplicate?.id);
    expect(manager.listSnapshots()).toHaveLength(2);

    const comparison = manager.compareLatestToPrevious('token-lint');

    expect(second).toBeDefined();
    expect(comparison?.summary.totalTokens.change).toBe(6_617);
    expect(comparison?.highestRegressions[0]).toMatchObject({
      path: 'src/agent.yaml',
      findingsDelta: expect.objectContaining({ change: 6 })
    });
  });

  it('resolves baseline and seven-day comparisons from stored snapshots', () => {
    const baseline = manager.captureSnapshot(buildInput({ createdAt: Date.parse('2026-05-28T10:00:00Z') }), defaultSettings());
    manager.captureSnapshot(buildInput({ createdAt: Date.parse('2026-06-01T10:00:00Z') }), defaultSettings());
    const latest = manager.captureSnapshot(buildInput({ createdAt: Date.parse('2026-06-08T10:00:00Z') }), defaultSettings());

    manager.setBaseline(baseline!.id);

    const baselineDiff = manager.compareLatestToBaseline('token-lint', 'latest');
    const sevenDayDiff = manager.compareLatestToSevenDaysAgo('token-lint');

    expect(latest).toBeDefined();
    expect(baselineDiff?.before.id).toBe(baseline?.id);
    expect(sevenDayDiff?.before.id).toBe('2026-06-01T10-00-00');
  });
});

function defaultSettings() {
  return {
    retentionDays: 30,
    maxSnapshots: 500,
    baseline: 'latest'
  };
}

function buildInput(overrides: RuntimeSnapshotInputOverrides = {}): RuntimeSnapshotCaptureInput {
  const createdAt = overrides.createdAt ?? Date.parse('2026-06-01T10:00:00Z');
  const {
    latestSession: _latestSession,
    dashboardSummary: _dashboardSummary,
    budget: _budget,
    workspaceAnalysis: _workspaceAnalysis,
    ...restOverrides
  } = overrides;
  const latestSession: NonNullable<RuntimeSnapshotCaptureInput['latestSession']> = {
    id: `token-lint-${createdAt}`,
    workspace: 'token-lint',
    title: 'New session - runtime',
    startedAt: createdAt,
    endedAt: createdAt,
    model: 'GPT-5.4',
    contextWindow: 192_000,
    promptTokens: 25_263,
    completionTokens: 0,
    cacheCreateTokens: 6_000,
    cacheReadTokens: 5_000,
    requests: 1,
    estimatedCost: 1.37,
    credits: 137,
    cacheSavings: 0.18,
    cacheEfficiency: 36.1,
    files: ['src/agent.yaml'],
    retrievalFiles: ['src/agent.yaml'],
    promptFiles: ['src/agent.yaml'],
    skills: [],
    mcpConfigs: [],
    retrievalAmplification: 12.5,
    contextPressure: 62,
    promptStability: 64,
    latencyMs: 920,
    risk: 'medium',
    source: 'simulated',
    ...(overrides.latestSession ?? {})
  };
  const dashboardSummary: RuntimeSnapshotCaptureInput['dashboardSummary'] = {
    sessions: 1,
    totalCost: 1.37,
    totalCredits: 137,
    averageCacheEfficiency: 36.1,
    estimatedSavings: 0.18,
    estimatedWaste: 36,
    averageRetrievalAmplification: 12.5,
    averageContextPressure: 62,
    stablePromptRegions: 64,
    volatilePromptRegions: 36,
    contextHealth: 72,
    reasoningRisk: 'medium',
    ...(overrides.dashboardSummary ?? {})
  };
  const budget: RuntimeSnapshotCaptureInput['budget'] = {
    budgetTokens: 128_000,
    usedTokens: 25_263,
    usagePercent: 19.7,
    currentFileTokens: 12_000,
    openFilesTokens: 13_263,
    workspaceTokens: 25_263,
    estimatedRetrievalTokens: 8_400,
    estimatedFinalContext: 25_263,
    risk: 'medium',
    ...(overrides.budget ?? {})
  };
  const workspaceAnalysis: NonNullable<RuntimeSnapshotCaptureInput['workspaceAnalysis']> = {
    filesScanned: 1,
    estimatedTokens: 25_263,
    estimatedRetrievalTokens: 8_400,
    estimatedFinalContext: 25_263,
    estimatedRuntimeAmplification: 12.5,
    highestRiskFiles: ['src/agent.yaml'],
    fileEstimates: [
      {
        fileName: 'src/agent.yaml',
        tokens: 4_000,
        estimatedRetrievalTokens: 1_200,
        estimatedFinalContext: 12_000
      }
    ],
    ...(overrides.workspaceAnalysis ?? {})
  };

  return {
    workspace: 'token-lint',
    createdAt,
    latestSession,
    dashboardSummary,
    costByModel: [{ model: 'GPT-5.4', cost: 1.37, percent: 100 }],
    budget,
    workspaceAnalysis,
    diagnosticsByFile: new Map([['src/agent.yaml', 2]]),
    ...restOverrides
  };
}