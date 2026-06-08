import { BudgetRiskLevel } from '../../core/budget/budgetModels';

import {
  AISession,
  CacheBreakdown,
  CacheEfficiencyPoint,
  ContextComposition,
  CostByModelPoint,
  CostOverTimePoint,
  DashboardSummary,
  RetrievalAmplificationPoint,
  RuntimeDashboardFilter,
  RuntimeDashboardState,
  SessionTelemetry
} from './sessionModels';
import { RuntimeSessionStore } from './sessionStore';

const defaultMergeWindowMs = 15 * 60 * 1000;
const allWorkspacesFilter = 'All workspaces';

export class RuntimeSessionManager {
  constructor(
    private readonly store: RuntimeSessionStore,
    private readonly mergeWindowMs = defaultMergeWindowMs
  ) {}

  async recordTelemetry(telemetry: SessionTelemetry): Promise<AISession> {
    const sessions = this.store.getSessions();
    const existingIndex = sessions.findIndex(session => this.shouldMerge(session, telemetry));
    const nextSession = existingIndex >= 0
      ? this.mergeSession(sessions[existingIndex], telemetry)
      : this.createSession(telemetry);

    if (existingIndex >= 0) {
      sessions.splice(existingIndex, 1, nextSession);
    } else {
      sessions.unshift(nextSession);
    }

    await this.store.saveSessions(sessions);
    return nextSession;
  }

  getDashboardState(filter: RuntimeDashboardFilter = {}): RuntimeDashboardState {
    const sessions = this.filterSessions(filter);
    const stablePromptRegions = sessions.length === 0
      ? 0
      : Math.round(sum(sessions.map(session => session.promptStability)) / sessions.length);
    const averageCacheEfficiency = average(sessions.map(session => session.cacheEfficiency), 1);
    const averageRetrievalAmplification = average(
      sessions.map(session => session.retrievalAmplification),
      2
    );
    const averageContextPressure = average(sessions.map(session => session.contextPressure), 1);
    const estimatedWaste = calculateEstimatedWaste(sessions);
    const contextHealth = calculateContextHealth({
      averageCacheEfficiency,
      averageRetrievalAmplification,
      averageContextPressure,
      stablePromptRegions,
      estimatedWaste
    });
    const summary: DashboardSummary = {
      sessions: sessions.length,
      totalCost: roundTo(sum(sessions.map(session => session.estimatedCost)), 2),
      totalCredits: roundTo(sum(sessions.map(session => session.credits)), 2),
      averageCacheEfficiency,
      estimatedSavings: roundTo(sum(sessions.map(session => session.cacheSavings)), 2),
      estimatedWaste,
      averageRetrievalAmplification,
      averageContextPressure,
      stablePromptRegions,
      volatilePromptRegions: Math.max(0, 100 - stablePromptRegions),
      contextHealth,
      reasoningRisk: calculateReasoningRisk(averageContextPressure, estimatedWaste, contextHealth)
    };

    return {
      generatedAt: Date.now(),
      latestSession: sessions[0],
      sessions,
      summary,
      costOverTime: buildCostOverTime(sessions),
      costByModel: buildCostByModel(sessions, summary.totalCost),
      cacheBreakdown: buildCacheBreakdown(sessions),
      retrievalAmplification: buildRetrievalAmplificationSeries(sessions),
      cacheEfficiencyTrend: buildCacheEfficiencyTrend(sessions),
      contextComposition: buildContextComposition(sessions),
      workspaces: buildWorkspaceOptions(this.store.getSessions())
    };
  }

  private filterSessions(filter: RuntimeDashboardFilter): AISession[] {
    const workspace = filter.workspace?.trim() || allWorkspacesFilter;
    const timeWindowDays = Math.max(1, Math.round(filter.timeWindowDays ?? 7));
    const cutoff = Date.now() - timeWindowDays * 24 * 60 * 60 * 1000;

    return this.store.getSessions().filter(session => {
      if (getSessionTime(session) < cutoff) {
        return false;
      }

      return workspace === allWorkspacesFilter || session.workspace === workspace;
    });
  }

  private shouldMerge(session: AISession, telemetry: SessionTelemetry): boolean {
    return session.workspace === telemetry.workspace
      && Math.abs(getSessionTime(session) - telemetry.startedAt) <= this.mergeWindowMs;
  }

  private createSession(telemetry: SessionTelemetry): AISession {
    return {
      id: createSessionId(telemetry),
      workspace: telemetry.workspace,
      title: normalizeSessionTitle(telemetry.workspace, telemetry.title),
      startedAt: telemetry.startedAt,
      endedAt: telemetry.endedAt ?? telemetry.startedAt,
      model: telemetry.model,
      contextWindow: telemetry.contextWindow,
      promptTokens: telemetry.promptTokens,
      completionTokens: telemetry.completionTokens,
      cacheCreateTokens: telemetry.cacheCreateTokens,
      cacheReadTokens: telemetry.cacheReadTokens,
      requests: Math.max(1, telemetry.requests),
      estimatedCost: telemetry.estimatedCost,
      credits: telemetry.credits,
      cacheSavings: telemetry.cacheSavings ?? 0,
      cacheEfficiency: telemetry.cacheEfficiency,
      files: uniqueValues(telemetry.files),
      retrievalFiles: uniqueValues(telemetry.retrievalFiles),
      promptFiles: uniqueValues(telemetry.promptFiles),
      skills: uniqueValues(telemetry.skills),
      mcpConfigs: uniqueValues(telemetry.mcpConfigs),
      retrievalAmplification: telemetry.retrievalAmplification,
      contextPressure: telemetry.contextPressure,
      promptStability: telemetry.promptStability,
      latencyMs: telemetry.latencyMs,
      risk: telemetry.risk,
      source: telemetry.source ?? 'simulated'
    };
  }

  private mergeSession(session: AISession, telemetry: SessionTelemetry): AISession {
    const totalPromptTokens = session.promptTokens + telemetry.promptTokens;
    const totalCompletionTokens = session.completionTokens + telemetry.completionTokens;
    const totalCacheCreateTokens = session.cacheCreateTokens + telemetry.cacheCreateTokens;
    const totalCacheReadTokens = session.cacheReadTokens + telemetry.cacheReadTokens;
    const totalRequests = session.requests + Math.max(1, telemetry.requests);

    return {
      ...session,
      title: normalizeSessionTitle(telemetry.workspace, telemetry.title) || session.title,
      endedAt: telemetry.endedAt ?? telemetry.startedAt,
      model: telemetry.model,
      contextWindow: telemetry.contextWindow,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      cacheCreateTokens: totalCacheCreateTokens,
      cacheReadTokens: totalCacheReadTokens,
      requests: totalRequests,
      estimatedCost: roundTo(session.estimatedCost + telemetry.estimatedCost, 4),
      credits: roundTo(session.credits + telemetry.credits, 2),
      cacheSavings: roundTo(session.cacheSavings + (telemetry.cacheSavings ?? 0), 4),
      cacheEfficiency: roundTo(
        (totalCacheReadTokens / Math.max(totalCacheCreateTokens, 1)) * 100,
        1
      ),
      files: uniqueValues([...session.files, ...telemetry.files]),
      retrievalFiles: uniqueValues([...session.retrievalFiles, ...telemetry.retrievalFiles]),
      promptFiles: uniqueValues([...session.promptFiles, ...telemetry.promptFiles]),
      skills: uniqueValues([...session.skills, ...telemetry.skills]),
      mcpConfigs: uniqueValues([...session.mcpConfigs, ...telemetry.mcpConfigs]),
      retrievalAmplification: weightedAverage(
        session.retrievalAmplification,
        session.requests,
        telemetry.retrievalAmplification,
        Math.max(1, telemetry.requests),
        2
      ),
      contextPressure: Math.max(session.contextPressure, telemetry.contextPressure),
      promptStability: weightedAverage(
        session.promptStability,
        session.requests,
        telemetry.promptStability,
        Math.max(1, telemetry.requests),
        1
      ),
      latencyMs: Math.round(weightedAverage(
        session.latencyMs,
        session.requests,
        telemetry.latencyMs,
        Math.max(1, telemetry.requests),
        0
      )),
      risk: maxRisk(session.risk, telemetry.risk)
    };
  }
}

function buildWorkspaceOptions(sessions: AISession[]): string[] {
  const workspaces = uniqueValues(sessions.map(session => session.workspace));
  return [allWorkspacesFilter, ...workspaces];
}

function createSessionId(telemetry: SessionTelemetry): string {
  const workspace = telemetry.workspace.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${workspace || 'workspace'}-${telemetry.startedAt}`;
}

function normalizeSessionTitle(workspace: string, title?: string): string {
  const normalizedTitle = title?.trim();
  return normalizedTitle && normalizedTitle.length > 0
    ? normalizedTitle
    : `New session - ${workspace}`;
}

function buildCostOverTime(sessions: AISession[]): CostOverTimePoint[] {
  const totals = new Map<string, number>();

  for (const session of sessions) {
    const key = toUtcDateKey(session.endedAt ?? session.startedAt);
    totals.set(key, roundTo((totals.get(key) ?? 0) + session.estimatedCost, 4));
  }

  return [...totals.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, cost]) => ({ date, cost: roundTo(cost, 2) }));
}

function buildCostByModel(sessions: AISession[], totalCost: number): CostByModelPoint[] {
  const totals = new Map<string, number>();

  for (const session of sessions) {
    totals.set(session.model, roundTo((totals.get(session.model) ?? 0) + session.estimatedCost, 4));
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([model, cost]) => ({
      model,
      cost: roundTo(cost, 2),
      percent: totalCost === 0 ? 0 : roundTo((cost / totalCost) * 100, 1)
    }));
}

function buildCacheBreakdown(sessions: AISession[]): CacheBreakdown {
  return {
    totalTokens: Math.round(sum(sessions.map(session => session.promptTokens))),
    cacheReadTokens: Math.round(sum(sessions.map(session => session.cacheReadTokens))),
    cacheCreateTokens: Math.round(sum(sessions.map(session => session.cacheCreateTokens)))
  };
}

function buildRetrievalAmplificationSeries(sessions: AISession[]): RetrievalAmplificationPoint[] {
  const totals = new Map<string, { amplification: number; count: number }>();

  for (const session of sessions) {
    const key = toUtcDateKey(session.endedAt ?? session.startedAt);
    const current = totals.get(key) ?? { amplification: 0, count: 0 };
    current.amplification += session.retrievalAmplification;
    current.count += 1;
    totals.set(key, current);
  }

  return [...totals.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, value]) => ({
      date,
      amplification: roundTo(value.amplification / Math.max(value.count, 1), 2)
    }));
}

function buildCacheEfficiencyTrend(sessions: AISession[]): CacheEfficiencyPoint[] {
  const totals = new Map<string, { efficiency: number; count: number }>();

  for (const session of sessions) {
    const key = toUtcDateKey(session.endedAt ?? session.startedAt);
    const current = totals.get(key) ?? { efficiency: 0, count: 0 };
    current.efficiency += session.cacheEfficiency;
    current.count += 1;
    totals.set(key, current);
  }

  return [...totals.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, value]) => ({
      date,
      efficiency: roundTo(value.efficiency / Math.max(value.count, 1), 1)
    }));
}

function buildContextComposition(sessions: AISession[]): ContextComposition {
  const composition: ContextComposition = {
    systemPrompt: 0,
    memory: 0,
    retrieval: 0,
    toolOutput: 0,
    userInput: 0,
    completion: 0
  };

  for (const session of sessions) {
    const promptTokens = Math.max(session.promptTokens, 0);
    if (promptTokens === 0) {
      composition.completion += Math.max(session.completionTokens, 0);
      continue;
    }

    const weights = {
      systemPrompt: 1.4,
      memory: clamp((session.cacheReadTokens / Math.max(promptTokens, 1)) * 2.2, 0.7, 1.8),
      retrieval: clamp(Math.max(session.retrievalAmplification - 1, 0) * 0.9, 0.3, 2.8),
      toolOutput: clamp(session.mcpConfigs.length * 0.6, 0.2, 1.2),
      userInput: clamp(session.promptFiles.length * 0.85, 0.8, 1.6)
    };
    const totalWeight = weights.systemPrompt + weights.memory + weights.retrieval + weights.toolOutput + weights.userInput;
    const systemPrompt = Math.round(promptTokens * (weights.systemPrompt / totalWeight));
    const memory = Math.round(promptTokens * (weights.memory / totalWeight));
    const retrieval = Math.round(promptTokens * (weights.retrieval / totalWeight));
    const toolOutput = Math.round(promptTokens * (weights.toolOutput / totalWeight));
    const userInput = Math.max(promptTokens - systemPrompt - memory - retrieval - toolOutput, 0);

    composition.systemPrompt += systemPrompt;
    composition.memory += memory;
    composition.retrieval += retrieval;
    composition.toolOutput += toolOutput;
    composition.userInput += userInput;
    composition.completion += Math.max(session.completionTokens, 0);
  }

  return composition;
}

function calculateEstimatedWaste(sessions: AISession[]): number {
  if (sessions.length === 0) {
    return 0;
  }

  const retrievalWaste = average(sessions.map(session => {
    if (session.retrievalAmplification <= 1) {
      return 0;
    }

    return ((session.retrievalAmplification - 1) / session.retrievalAmplification) * 100;
  }), 1);
  const volatilityWaste = average(sessions.map(session => Math.max(0, 100 - session.promptStability)), 1);
  return roundTo(clamp(retrievalWaste * 0.65 + volatilityWaste * 0.35, 0, 100), 1);
}

function calculateContextHealth(metrics: {
  averageCacheEfficiency: number;
  averageRetrievalAmplification: number;
  averageContextPressure: number;
  stablePromptRegions: number;
  estimatedWaste: number;
}): number {
  const cacheHealth = clamp(metrics.averageCacheEfficiency, 0, 100);
  const retrievalHealth = clamp(100 - Math.max(metrics.averageRetrievalAmplification - 1, 0) * 22, 0, 100);
  const pressureHealth = clamp(100 - metrics.averageContextPressure * 0.8, 0, 100);
  const wasteHealth = clamp(100 - metrics.estimatedWaste, 0, 100);

  return roundTo(
    cacheHealth * 0.22
      + retrievalHealth * 0.2
      + pressureHealth * 0.2
      + metrics.stablePromptRegions * 0.2
      + wasteHealth * 0.18,
    0
  );
}

function calculateReasoningRisk(
  averageContextPressure: number,
  estimatedWaste: number,
  contextHealth: number
): BudgetRiskLevel {
  if (averageContextPressure >= 82 || estimatedWaste >= 78 || contextHealth < 35) {
    return 'critical';
  }

  if (averageContextPressure >= 65 || estimatedWaste >= 60 || contextHealth < 50) {
    return 'high';
  }

  if (averageContextPressure >= 40 || estimatedWaste >= 35 || contextHealth < 70) {
    return 'medium';
  }

  return 'low';
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[], precision: number): number {
  if (values.length === 0) {
    return 0;
  }

  return roundTo(sum(values) / values.length, precision);
}

function weightedAverage(
  leftValue: number,
  leftWeight: number,
  rightValue: number,
  rightWeight: number,
  precision: number
): number {
  const totalWeight = leftWeight + rightWeight;
  if (totalWeight === 0) {
    return 0;
  }

  return roundTo(
    (leftValue * leftWeight + rightValue * rightWeight) / totalWeight,
    precision
  );
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function getSessionTime(session: AISession): number {
  return session.endedAt ?? session.startedAt;
}

function toUtcDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function maxRisk(left: BudgetRiskLevel, right: BudgetRiskLevel): BudgetRiskLevel {
  const ranks: Record<BudgetRiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };

  return ranks[left] >= ranks[right] ? left : right;
}