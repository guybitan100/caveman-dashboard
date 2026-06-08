import { BudgetRiskLevel } from '../../core/budget/budgetModels';

export interface RuntimeSnapshotSummary {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheTokens: number;
  cacheEfficiency: number;
  retrievalAmplification: number;
  contextHealth: number;
  promptStability: number;
  runtimeCost: number;
  credits: number;
  modelUsage: Array<{
    model: string;
    cost: number;
    percent: number;
  }>;
}

export interface RuntimeSnapshotFileMetric {
  path: string;
  tokens: number;
  findings: number;
  risk: BudgetRiskLevel;
  retrievalRisk: number;
  promptEntropy: number;
  cacheEfficiency: number;
  amplificationScore: number;
}

export interface RuntimeSnapshot {
  id: string;
  createdAt: string;
  workspace: string;
  summary: RuntimeSnapshotSummary;
  files: RuntimeSnapshotFileMetric[];
}

export interface NumericDelta {
  before: number;
  after: number;
  change: number;
  changePercent: number;
}

export interface RuntimeSummaryDiff {
  totalTokens: NumericDelta;
  runtimeCost: NumericDelta;
  cacheEfficiency: NumericDelta;
  retrievalAmplification: NumericDelta;
  contextHealth: NumericDelta;
  promptStability: NumericDelta;
  credits: NumericDelta;
}

export interface RuntimeFileDiff {
  path: string;
  before: RuntimeSnapshotFileMetric;
  after: RuntimeSnapshotFileMetric;
  tokenDelta: NumericDelta;
  findingsDelta: NumericDelta;
  cacheEfficiencyDelta: NumericDelta;
  amplificationDelta: NumericDelta;
  riskChanged: boolean;
}

export interface RuntimeRegressionSignal {
  severity: 'info' | 'warning' | 'critical';
  metric:
    | 'totalTokens'
    | 'runtimeCost'
    | 'cacheEfficiency'
    | 'retrievalAmplification'
    | 'contextHealth'
    | 'promptStability'
    | 'fileRisk';
  message: string;
}

export interface RuntimeComparison {
  before: RuntimeSnapshot;
  after: RuntimeSnapshot;
  summary: RuntimeSummaryDiff;
  highestRegressions: RuntimeFileDiff[];
  highestImprovements: RuntimeFileDiff[];
  regressions: RuntimeRegressionSignal[];
  recommendations: string[];
}
