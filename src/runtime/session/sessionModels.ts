import { BudgetRiskLevel } from '../../core/budget/budgetModels';

export type RuntimeSessionSource = 'vscode' | 'copilot' | 'simulated' | 'sdk' | 'agent' | 'mcp';

export interface AISession {
  id: string;
  workspace: string;
  title: string;
  favorite?: boolean;
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
  cacheSavings: number;
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
  source: RuntimeSessionSource;
}

export interface SessionTelemetry {
  workspace: string;
  title: string;
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
  cacheSavings: number;
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
  source: RuntimeSessionSource;
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

export interface DashboardSummary {
  sessions: number;
  totalCost: number;
  totalCredits: number;
  averageCacheEfficiency: number;
  estimatedSavings: number;
  estimatedWaste: number;
  averageRetrievalAmplification: number;
  averageContextPressure: number;
  stablePromptRegions: number;
  volatilePromptRegions: number;
  contextHealth: number;
  reasoningRisk: BudgetRiskLevel;
}

export interface CostOverTimePoint {
  date: string;
  cost: number;
}

export interface CostByModelPoint {
  model: string;
  cost: number;
  percent: number;
}

export interface CacheBreakdown {
  totalTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
}

export interface RetrievalAmplificationPoint {
  date: string;
  amplification: number;
}

export interface CacheEfficiencyPoint {
  date: string;
  efficiency: number;
}

export interface ContextComposition {
  systemPrompt: number;
  memory: number;
  retrieval: number;
  toolOutput: number;
  userInput: number;
  completion: number;
}

export interface RuntimeDashboardData {
  summary: DashboardSummary;
  sessions: AISession[];
  costOverTime: CostOverTimePoint[];
  costByModel: CostByModelPoint[];
  cacheBreakdown: CacheBreakdown;
  retrievalAmplification: RetrievalAmplificationPoint[];
  cacheEfficiencyTrend: CacheEfficiencyPoint[];
  contextComposition: ContextComposition;
}

export interface RuntimeDashboardState extends RuntimeDashboardData {
  generatedAt: number;
  latestSession?: AISession;
  workspaces: string[];
}

export interface RuntimeDashboardFilter {
  timeWindowDays?: number;
  workspace?: string;
  favoritesOnly?: boolean;
}

export const allWorkspacesLabel = 'All workspaces';

export interface ModelPricing {
  input: number;
  output: number;
  cache: number;
  creditMultiplier: number;
}

export interface ModelProfile {
  name: string;
  contextWindow: number;
  pricing: ModelPricing;
}