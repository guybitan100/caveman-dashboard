import { BudgetRiskLevel } from '../../core/budget/budgetModels';

import {
  AISession,
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

    return {
      generatedAt: Date.now(),
      latestSession: sessions[0],
      sessions,
      summary: {
        totalSessions: sessions.length,
        totalCost: roundTo(sum(sessions.map(session => session.estimatedCost)), 2),
        totalCredits: roundTo(sum(sessions.map(session => session.credits)), 2),
        averageCacheEfficiency: average(sessions.map(session => session.cacheEfficiency), 1),
        averageRetrievalAmplification: average(
          sessions.map(session => session.retrievalAmplification),
          2
        ),
        averageContextPressure: average(sessions.map(session => session.contextPressure), 1),
        stablePromptRegions,
        volatilePromptRegions: Math.max(0, 100 - stablePromptRegions)
      },
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
      source: telemetry.source
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
      cacheEfficiency: roundTo(
        (totalCacheReadTokens / Math.max(totalPromptTokens, 1)) * 100,
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

function maxRisk(left: BudgetRiskLevel, right: BudgetRiskLevel): BudgetRiskLevel {
  const ranks: Record<BudgetRiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };

  return ranks[left] >= ranks[right] ? left : right;
}