export interface BudgetResult {
  budgetTokens: number;
  usedTokens: number;
  usagePercent: number;
  currentFileTokens: number;
  openFilesTokens: number;
  workspaceTokens: number;
  estimatedRetrievalTokens: number;
  estimatedFinalContext: number;
  risk: BudgetRiskLevel;
}

export type BudgetRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface BudgetThresholds {
  warningThresholdPercent?: number;
  criticalThresholdPercent?: number;
  mediumThresholdPercent?: number;
}

export interface BudgetTokenSource {
  key?: string;
  text: string;
  fileName?: string;
}

export interface BudgetEstimateInput extends BudgetThresholds {
  budgetTokens: number;
  currentFile?: BudgetTokenSource;
  openFiles?: BudgetTokenSource[];
  workspaceFiles?: BudgetTokenSource[];
  includeWorkspaceEstimate?: boolean;
  includeRetrievalAmplification?: boolean;
}

export interface BudgetEstimate {
  tokens: number;
  estimatedRetrievalTokens: number;
  estimatedFinalContext: number;
}

export interface BudgetWorkspaceFileRisk {
  fileName: string;
  tokens: number;
  estimatedRetrievalTokens: number;
  estimatedFinalContext: number;
}

export interface WorkspaceBudgetAnalysis {
  filesScanned: number;
  estimatedTokens: number;
  estimatedRetrievalTokens: number;
  estimatedFinalContext: number;
  estimatedRuntimeAmplification: number;
  highestRiskFiles: string[];
  fileEstimates: BudgetWorkspaceFileRisk[];
}