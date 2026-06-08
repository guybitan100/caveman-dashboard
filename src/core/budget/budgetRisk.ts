import { BudgetRiskLevel, BudgetThresholds } from './budgetModels';

export const DEFAULT_MEDIUM_THRESHOLD_PERCENT = 50;
export const DEFAULT_WARNING_THRESHOLD_PERCENT = 70;
export const DEFAULT_CRITICAL_THRESHOLD_PERCENT = 90;

export interface NormalizedBudgetThresholds {
  mediumThresholdPercent: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
}

export function normalizeBudgetThresholds(
  thresholds: BudgetThresholds = {}
): NormalizedBudgetThresholds {
  const warningThresholdPercent = asFiniteThreshold(
    thresholds.warningThresholdPercent,
    DEFAULT_WARNING_THRESHOLD_PERCENT
  );
  const criticalThresholdPercent = Math.max(
    warningThresholdPercent,
    asFiniteThreshold(
      thresholds.criticalThresholdPercent,
      DEFAULT_CRITICAL_THRESHOLD_PERCENT
    )
  );
  const mediumThresholdPercent = Math.min(
    warningThresholdPercent,
    asFiniteThreshold(
      thresholds.mediumThresholdPercent,
      DEFAULT_MEDIUM_THRESHOLD_PERCENT
    )
  );

  return {
    mediumThresholdPercent,
    warningThresholdPercent,
    criticalThresholdPercent
  };
}

export function calculateUsagePercent(usedTokens: number, budgetTokens: number): number {
  if (budgetTokens <= 0) {
    return 0;
  }

  return (usedTokens / budgetTokens) * 100;
}

export function resolveBudgetRisk(
  usagePercent: number,
  thresholds: BudgetThresholds = {}
): BudgetRiskLevel {
  const normalized = normalizeBudgetThresholds(thresholds);

  if (usagePercent >= normalized.criticalThresholdPercent) {
    return 'critical';
  }

  if (usagePercent >= normalized.warningThresholdPercent) {
    return 'high';
  }

  if (usagePercent >= normalized.mediumThresholdPercent) {
    return 'medium';
  }

  return 'low';
}

function asFiniteThreshold(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}