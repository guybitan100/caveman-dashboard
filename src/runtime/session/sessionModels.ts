import { BudgetRiskLevel } from '../../core/budget/budgetModels';

export interface AISession {
  id: string;
  workspace: string;
  startedAt: number;
  endedAt?: number;
  model: string;
  contextWindow: number;
  promptTokens: number;
  completionTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  requests: number;
  estimatedCost: number;
  credits: number;
  cacheEfficiency: number;
  files: string[];
  retrievalFiles: string[];
  promptFiles: string[];
  skills: string[];
  mcpConfigs: string[];
  retrievalAmplification: number;
  contextPressure: number;
  promptStability: number;
  latencyMs: number;
  risk: BudgetRiskLevel;
  source: 'simulated';
}

export interface SessionTelemetry {
  workspace: string;
  startedAt: number;
  endedAt?: number;
  model: string;
  contextWindow: number;
  promptTokens: number;
  completionTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  requests: number;
  estimatedCost: number;
  credits: number;
  cacheEfficiency: number;
  files: string[];
  retrievalFiles: string[];
  promptFiles: string[];
  skills: string[];
  mcpConfigs: string[];
  retrievalAmplification: number;
  contextPressure: number;
  promptStability: number;
  latencyMs: number;
  risk: BudgetRiskLevel;
  source: 'simulated';
}

export interface CacheInsight {
  cacheCreateTokens: number;
  cacheReadTokens: number;
  cacheEfficiency: number;
  promptStability: number;
  cacheIndicator: 'high' | 'partial' | 'none';
}

export interface CostEstimate {
  estimatedCost: number;
  credits: number;
  cacheSavings: number;
}

export interface RuntimeDashboardSummary {
  totalSessions: number;
  totalCost: number;
  totalCredits: number;
  averageCacheEfficiency: number;
  averageRetrievalAmplification: number;
  averageContextPressure: number;
  stablePromptRegions: number;
  volatilePromptRegions: number;
}

export interface RuntimeDashboardState {
  generatedAt: number;
  latestSession?: AISession;
  sessions: AISession[];
  summary: RuntimeDashboardSummary;
  workspaces: string[];
}

export interface RuntimeDashboardFilter {
  timeWindowDays?: number;
  workspace?: string;
}

export const allWorkspacesLabel = 'All workspaces';

export interface ModelPricing {
  input: number;
  output: number;
  cache: number;
}

export interface ModelProfile {
  name: string;
  contextWindow: number;
  pricing: ModelPricing;
}