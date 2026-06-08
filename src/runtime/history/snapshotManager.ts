import { BudgetRiskLevel, BudgetResult, WorkspaceBudgetAnalysis } from '../../core/budget/budgetModels';
import { AISession, CostByModelPoint, DashboardSummary } from '../session/sessionModels';

import { RuntimeBaselineManager } from './baselineManager';
import { compareSnapshots } from './diffEngine';
import { RuntimeHistoryStore } from './historyStore';
import { RuntimeComparison, RuntimeSnapshot, RuntimeSnapshotFileMetric } from './runtimeComparison';

export interface RuntimeSnapshotCaptureInput {
  workspace: string;
  createdAt: number;
  latestSession?: AISession;
  dashboardSummary: DashboardSummary;
  costByModel: CostByModelPoint[];
  budget: BudgetResult;
  workspaceAnalysis?: WorkspaceBudgetAnalysis;
  diagnosticsByFile?: Map<string, number>;
}

export interface RuntimeHistorySettings {
  retentionDays: number;
  maxSnapshots: number;
  baseline: string;
}

const dedupeWindowMs = 10 * 60 * 1000;

export class RuntimeSnapshotManager {
  private readonly baselineManager: RuntimeBaselineManager;

  constructor(private readonly store: RuntimeHistoryStore) {
    this.baselineManager = new RuntimeBaselineManager(store);
  }

  captureSnapshot(
    input: RuntimeSnapshotCaptureInput,
    settings: RuntimeHistorySettings
  ): RuntimeSnapshot | undefined {
    const snapshot = this.createSnapshot(input);
    if (!snapshot) {
      return undefined;
    }

    const latest = this.listSnapshots(input.workspace)[0];
    if (latest && shouldDedupe(latest, snapshot)) {
      return latest;
    }

    this.store.saveSnapshot(snapshot);
    this.store.prune({
      retentionDays: settings.retentionDays,
      maxSnapshots: settings.maxSnapshots,
      baselineId: this.store.getBaselineId(),
      now: input.createdAt
    }, input.workspace);
    return snapshot;
  }

  createSnapshot(input: RuntimeSnapshotCaptureInput): RuntimeSnapshot | undefined {
    if (!input.latestSession) {
      return undefined;
    }

    const latest = input.latestSession;
    return {
      id: createSnapshotId(input.createdAt),
      createdAt: new Date(input.createdAt).toISOString(),
      workspace: input.workspace,
      summary: {
        totalTokens: input.budget.usedTokens,
        promptTokens: latest.promptTokens,
        completionTokens: latest.completionTokens,
        cacheTokens: latest.cacheReadTokens + latest.cacheCreateTokens,
        cacheEfficiency: latest.cacheEfficiency,
        retrievalAmplification: latest.retrievalAmplification,
        contextHealth: input.dashboardSummary.contextHealth,
        promptStability: latest.promptStability,
        runtimeCost: latest.estimatedCost,
        credits: latest.credits,
        modelUsage: input.costByModel.map(entry => ({
          model: entry.model,
          cost: entry.cost,
          percent: entry.percent
        }))
      },
      files: buildFileMetrics(latest, input.workspaceAnalysis, input.diagnosticsByFile)
    };
  }

  listSnapshots(workspace?: string): RuntimeSnapshot[] {
    return this.store.listSnapshots(workspace);
  }

  getSnapshot(snapshotId: string): RuntimeSnapshot | undefined {
    return this.store.getSnapshot(snapshotId);
  }

  compareLatestToPrevious(workspace?: string): RuntimeComparison | undefined {
    const snapshots = this.listSnapshots(workspace);
    if (snapshots.length < 2) {
      return undefined;
    }

    return compareSnapshots(snapshots[1], snapshots[0]);
  }

  compareLatestToSevenDaysAgo(workspace?: string): RuntimeComparison | undefined {
    const snapshots = this.listSnapshots(workspace);
    const latest = snapshots[0];
    if (!latest) {
      return undefined;
    }

    const cutoff = Date.parse(latest.createdAt) - 7 * 24 * 60 * 60 * 1000;
    const target = snapshots.find(snapshot => Date.parse(snapshot.createdAt) <= cutoff) ?? snapshots[snapshots.length - 1];
    if (!target || target.id === latest.id) {
      return undefined;
    }

    return compareSnapshots(target, latest);
  }

  compareLatestToBaseline(workspace: string | undefined, configuredBaseline: string): RuntimeComparison | undefined {
    const snapshots = this.listSnapshots(workspace);
    const latest = snapshots[0];
    if (!latest) {
      return undefined;
    }

    const baseline = this.baselineManager.getBaselineSnapshot(snapshots, configuredBaseline, latest.id);
    if (!baseline) {
      return undefined;
    }

    return compareSnapshots(baseline, latest);
  }

  compareLatestToSnapshot(snapshotId: string, workspace?: string): RuntimeComparison | undefined {
    const snapshots = this.listSnapshots(workspace);
    const latest = snapshots[0];
    const target = this.getSnapshot(snapshotId);
    if (!latest || !target || latest.id === target.id) {
      return undefined;
    }

    return compareSnapshots(target, latest);
  }

  setBaseline(snapshotId: string): void {
    this.baselineManager.setBaseline(snapshotId);
  }

  getBaselineId(): string | undefined {
    return this.store.getBaselineId();
  }

  deleteSnapshot(snapshotId: string): boolean {
    return this.store.deleteSnapshot(snapshotId);
  }

  clearOldHistory(settings: RuntimeHistorySettings, workspace?: string): RuntimeSnapshot[] {
    return this.store.prune({
      retentionDays: settings.retentionDays,
      maxSnapshots: settings.maxSnapshots,
      baselineId: this.store.getBaselineId()
    }, workspace);
  }

  clearAllHistory(): number {
    return this.store.clearHistory();
  }
}

function buildFileMetrics(
  latest: AISession,
  workspaceAnalysis: WorkspaceBudgetAnalysis | undefined,
  diagnosticsByFile: Map<string, number> | undefined
): RuntimeSnapshotFileMetric[] {
  const estimates = workspaceAnalysis?.fileEstimates ?? latest.files.map(filePath => ({
    fileName: filePath,
    tokens: Math.max(256, Math.round(latest.promptTokens / Math.max(latest.files.length, 1))),
    estimatedRetrievalTokens: latest.retrievalFiles.includes(filePath) ? Math.round(latest.promptTokens * 0.22) : 0,
    estimatedFinalContext: Math.max(256, Math.round(latest.promptTokens / Math.max(latest.files.length, 1)))
  }));
  const highestRiskFiles = new Set(workspaceAnalysis?.highestRiskFiles ?? []);

  return estimates.map(estimate => {
    const findings = diagnosticsByFile?.get(estimate.fileName) ?? 0;
    const amplificationScore = roundTo(estimate.estimatedFinalContext / Math.max(estimate.tokens, 1), 1);
    const retrievalRisk = clamp(
      (estimate.estimatedRetrievalTokens / Math.max(estimate.tokens, 1)) * 100,
      0,
      100
    );
    const promptLike = /(prompt|instruction|memory|context|agent|skill|workflow)/i.test(estimate.fileName);
    const cacheEfficiency = clamp(
      (promptLike ? latest.promptStability : latest.cacheEfficiency)
        - Math.max(amplificationScore - 1, 0) * 4
        - findings * 2,
      0,
      100
    );
    const promptEntropy = clamp(
      (promptLike ? 20 : 10)
        + findings * 7
        + Math.max(amplificationScore - 1, 0) * 6
        + retrievalRisk * 0.15,
      0,
      100
    );

    return {
      path: estimate.fileName,
      tokens: Math.round(estimate.tokens),
      findings,
      risk: deriveFileRisk({
        findings,
        amplificationScore,
        retrievalRisk,
        highestRisk: highestRiskFiles.has(estimate.fileName)
      }),
      retrievalRisk: roundTo(retrievalRisk, 1),
      promptEntropy: roundTo(promptEntropy, 1),
      cacheEfficiency: roundTo(cacheEfficiency, 1),
      amplificationScore
    };
  }).sort((left, right) => right.tokens - left.tokens);
}

function deriveFileRisk(input: {
  findings: number;
  amplificationScore: number;
  retrievalRisk: number;
  highestRisk: boolean;
}): BudgetRiskLevel {
  if (input.findings >= 8 || input.retrievalRisk >= 90 || input.amplificationScore >= 8) {
    return 'critical';
  }

  if (input.highestRisk || input.findings >= 4 || input.retrievalRisk >= 60 || input.amplificationScore >= 5) {
    return 'high';
  }

  if (input.findings >= 2 || input.retrievalRisk >= 35 || input.amplificationScore >= 3) {
    return 'medium';
  }

  return 'low';
}

function createSnapshotId(timestamp: number): string {
  return new Date(timestamp).toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
}

function shouldDedupe(previous: RuntimeSnapshot, next: RuntimeSnapshot): boolean {
  return Math.abs(Date.parse(next.createdAt) - Date.parse(previous.createdAt)) <= dedupeWindowMs
    && buildSnapshotFingerprint(previous) === buildSnapshotFingerprint(next);
}

function buildSnapshotFingerprint(snapshot: RuntimeSnapshot): string {
  return JSON.stringify({
    workspace: snapshot.workspace,
    summary: snapshot.summary,
    files: snapshot.files.map(file => ({
      path: file.path,
      tokens: file.tokens,
      findings: file.findings,
      risk: file.risk,
      amplificationScore: file.amplificationScore
    }))
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
