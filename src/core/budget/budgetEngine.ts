import { BudgetResult, BudgetThresholds } from './budgetModels';
import { calculateUsagePercent, resolveBudgetRisk } from './budgetRisk';

export interface BudgetCalculationInput extends BudgetThresholds {
  currentFileTokens?: number;
  openFilesTokens?: number;
  workspaceTokens?: number;
  estimatedRetrievalTokens?: number;
  estimatedFinalContext?: number;
}

export function calculateBudget(
  usedTokens: number,
  budgetTokens: number,
  input: BudgetCalculationInput = {}
): BudgetResult {
  const currentFileTokens = input.currentFileTokens ?? 0;
  const openFilesTokens = input.openFilesTokens ?? 0;
  const workspaceTokens = input.workspaceTokens ?? 0;
  const estimatedRetrievalTokens = input.estimatedRetrievalTokens ?? 0;
  const safeBudgetTokens = Number.isFinite(budgetTokens) && budgetTokens > 0 ? budgetTokens : 1;
  const estimatedFinalContext = input.estimatedFinalContext
    ?? Math.max(currentFileTokens, openFilesTokens, workspaceTokens, usedTokens) + estimatedRetrievalTokens;
  const normalizedUsedTokens = Math.max(usedTokens, estimatedFinalContext);
  const usagePercent = calculateUsagePercent(normalizedUsedTokens, safeBudgetTokens);

  return {
    budgetTokens: safeBudgetTokens,
    usedTokens: normalizedUsedTokens,
    usagePercent,
    currentFileTokens,
    openFilesTokens,
    workspaceTokens,
    estimatedRetrievalTokens,
    estimatedFinalContext,
    risk: resolveBudgetRisk(usagePercent, input)
  };
}