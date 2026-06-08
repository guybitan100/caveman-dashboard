import { BudgetRiskLevel } from '../../core/budget/budgetModels';

import {
  NumericDelta,
  RuntimeComparison,
  RuntimeFileDiff,
  RuntimeRegressionSignal,
  RuntimeSnapshot,
  RuntimeSnapshotFileMetric,
  RuntimeSummaryDiff
} from './runtimeComparison';

export function compareSnapshots(before: RuntimeSnapshot, after: RuntimeSnapshot): RuntimeComparison {
  const summary: RuntimeSummaryDiff = {
    totalTokens: buildDelta(before.summary.totalTokens, after.summary.totalTokens),
    runtimeCost: buildDelta(before.summary.runtimeCost, after.summary.runtimeCost),
    cacheEfficiency: buildDelta(before.summary.cacheEfficiency, after.summary.cacheEfficiency),
    retrievalAmplification: buildDelta(before.summary.retrievalAmplification, after.summary.retrievalAmplification),
    contextHealth: buildDelta(before.summary.contextHealth, after.summary.contextHealth),
    promptStability: buildDelta(before.summary.promptStability, after.summary.promptStability),
    credits: buildDelta(before.summary.credits, after.summary.credits)
  };

  const fileDiffs = buildFileDiffs(before.files, after.files);
  const highestRegressions = [...fileDiffs]
    .filter(diff => isRegression(diff))
    .sort((left, right) => regressionScore(right) - regressionScore(left))
    .slice(0, 5);
  const highestImprovements = [...fileDiffs]
    .filter(diff => isImprovement(diff))
    .sort((left, right) => improvementScore(right) - improvementScore(left))
    .slice(0, 5);
  const regressions = buildRegressionSignals(summary, highestRegressions);

  return {
    before,
    after,
    summary,
    highestRegressions,
    highestImprovements,
    regressions,
    recommendations: buildRecommendations(summary, highestRegressions)
  };
}

function buildFileDiffs(
  beforeFiles: RuntimeSnapshotFileMetric[],
  afterFiles: RuntimeSnapshotFileMetric[]
): RuntimeFileDiff[] {
  const beforeMap = new Map(beforeFiles.map(file => [file.path, file]));
  const afterMap = new Map(afterFiles.map(file => [file.path, file]));
  const paths = [...new Set([...beforeMap.keys(), ...afterMap.keys()])];

  return paths.map(path => {
    const before = beforeMap.get(path) ?? emptyFileMetric(path);
    const after = afterMap.get(path) ?? emptyFileMetric(path);

    return {
      path,
      before,
      after,
      tokenDelta: buildDelta(before.tokens, after.tokens),
      findingsDelta: buildDelta(before.findings, after.findings),
      cacheEfficiencyDelta: buildDelta(before.cacheEfficiency, after.cacheEfficiency),
      amplificationDelta: buildDelta(before.amplificationScore, after.amplificationScore),
      riskChanged: before.risk !== after.risk
    };
  });
}

function buildRegressionSignals(
  summary: RuntimeSummaryDiff,
  highestRegressions: RuntimeFileDiff[]
): RuntimeRegressionSignal[] {
  const signals: RuntimeRegressionSignal[] = [];

  if (summary.runtimeCost.changePercent >= 15) {
    signals.push({
      severity: summary.runtimeCost.changePercent >= 30 ? 'critical' : 'warning',
      metric: 'runtimeCost',
      message: `Runtime cost increased by ${formatSigned(summary.runtimeCost.changePercent)}%.`
    });
  }

  if (summary.retrievalAmplification.change >= 1) {
    signals.push({
      severity: summary.retrievalAmplification.change >= 2 ? 'critical' : 'warning',
      metric: 'retrievalAmplification',
      message: `Retrieval amplification increased by ${formatSigned(summary.retrievalAmplification.change)}x.`
    });
  }

  if (summary.cacheEfficiency.change <= -8) {
    signals.push({
      severity: summary.cacheEfficiency.change <= -15 ? 'critical' : 'warning',
      metric: 'cacheEfficiency',
      message: `Cache efficiency dropped by ${formatSigned(summary.cacheEfficiency.change)}%.`
    });
  }

  if (summary.promptStability.change <= -5) {
    signals.push({
      severity: summary.promptStability.change <= -12 ? 'critical' : 'warning',
      metric: 'promptStability',
      message: `Prompt stability regressed by ${formatSigned(summary.promptStability.change)}%.`
    });
  }

  if (summary.contextHealth.change <= -3) {
    signals.push({
      severity: summary.contextHealth.change <= -10 ? 'critical' : 'warning',
      metric: 'contextHealth',
      message: `Context health degraded by ${formatSigned(summary.contextHealth.change)} points.`
    });
  }

  for (const regression of highestRegressions.slice(0, 2)) {
    if (regression.riskChanged && riskRank(regression.after.risk) > riskRank(regression.before.risk)) {
      signals.push({
        severity: riskRank(regression.after.risk) >= riskRank('high') ? 'critical' : 'warning',
        metric: 'fileRisk',
        message: `${regression.path} risk changed from ${regression.before.risk} to ${regression.after.risk}.`
      });
    }
  }

  return signals;
}

function buildRecommendations(summary: RuntimeSummaryDiff, highestRegressions: RuntimeFileDiff[]): string[] {
  const recommendations: string[] = [];

  if (summary.retrievalAmplification.change >= 1) {
    recommendations.push('Reduce retrieval breadth or improve ranking quality before the next release cut.');
  }

  if (summary.cacheEfficiency.change <= -8 || summary.promptStability.change <= -8) {
    recommendations.push('Stabilize reusable prompt regions to recover cache reuse and lower cost.');
  }

  if (summary.runtimeCost.changePercent >= 15) {
    recommendations.push('Review model mix and context growth because spend increased faster than baseline.');
  }

  if (highestRegressions.some(diff => diff.tokenDelta.change >= 2_000)) {
    recommendations.push('Inspect the highest-growth files first; local token inflation is driving global runtime regressions.');
  }

  return recommendations.length > 0
    ? recommendations
    : ['Runtime is stable against the selected baseline. Maintain current cache and retrieval posture.'];
}

function buildDelta(before: number, after: number): NumericDelta {
  const change = roundTo(after - before, 2);
  const changePercent = before === 0
    ? (after === 0 ? 0 : 100)
    : roundTo((change / before) * 100, 1);

  return {
    before: roundTo(before, 2),
    after: roundTo(after, 2),
    change,
    changePercent
  };
}

function emptyFileMetric(path: string): RuntimeSnapshotFileMetric {
  return {
    path,
    tokens: 0,
    findings: 0,
    risk: 'low',
    retrievalRisk: 0,
    promptEntropy: 0,
    cacheEfficiency: 0,
    amplificationScore: 0
  };
}

function isRegression(diff: RuntimeFileDiff): boolean {
  return regressionScore(diff) > 0;
}

function isImprovement(diff: RuntimeFileDiff): boolean {
  return improvementScore(diff) > 0;
}

function regressionScore(diff: RuntimeFileDiff): number {
  return Math.max(diff.tokenDelta.change, 0) * 0.01
    + Math.max(diff.findingsDelta.change, 0) * 3
    + Math.max(diff.amplificationDelta.change, 0) * 8
    + Math.max(-diff.cacheEfficiencyDelta.change, 0);
}

function improvementScore(diff: RuntimeFileDiff): number {
  return Math.max(-diff.tokenDelta.change, 0) * 0.01
    + Math.max(-diff.findingsDelta.change, 0) * 3
    + Math.max(-diff.amplificationDelta.change, 0) * 8
    + Math.max(diff.cacheEfficiencyDelta.change, 0);
}

function riskRank(risk: BudgetRiskLevel): number {
  switch (risk) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
  }
}

function formatSigned(value: number): string {
  const rounded = roundTo(value, 1);
  if (rounded > 0) {
    return `+${rounded}`;
  }

  return String(rounded);
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
