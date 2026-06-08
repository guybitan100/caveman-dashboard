import { BudgetResult, WorkspaceBudgetAnalysis } from '../../core/budget/budgetModels';

import { calculateCacheInsight } from './cacheEngine';
import { estimateRuntimeCost, modelProfiles, selectModelProfile } from './costEngine';
import { AISession, SessionTelemetry } from './sessionModels';

export interface TelemetryCollectorInput {
  workspace: string;
  visibleFiles: string[];
  budget: BudgetResult;
  workspaceAnalysis?: WorkspaceBudgetAnalysis;
  previousSession?: AISession;
  preferredModel?: string;
  now?: number;
}

const promptFileRegex = /(?:^|[\/_-])(prompt|instruction|memory|context)(?:[\/_-]|\.)|\.(?:md|prompt)$/i;
const skillFileRegex = /skill/i;
const mcpFileRegex = /mcp/i;
const retrievalFileRegex = /(retrieval|rag|context|memory|knowledge)/i;

export function collectRuntimeTelemetry(input: TelemetryCollectorInput): SessionTelemetry {
  const visibleFiles = uniqueValues(input.visibleFiles);
  const retrievalFiles = uniqueValues([
    ...(input.workspaceAnalysis?.highestRiskFiles ?? []).filter(fileName => retrievalFileRegex.test(fileName)),
    ...visibleFiles.filter(fileName => retrievalFileRegex.test(fileName))
  ]);
  const promptFiles = visibleFiles.filter(fileName => promptFileRegex.test(fileName));
  const skills = visibleFiles.filter(fileName => skillFileRegex.test(fileName));
  const mcpConfigs = visibleFiles.filter(fileName => mcpFileRegex.test(fileName));
  const retrievalAmplification = resolveRetrievalAmplification(input.budget, input.workspaceAnalysis);
  const promptTokens = resolvePromptTokens(input.budget);
  const completionTokens = estimateCompletionTokens(promptTokens, input.budget.risk, retrievalAmplification);
  const modelProfile = resolveModelProfile(input.preferredModel, input.budget.estimatedFinalContext);
  const cacheInsight = calculateCacheInsight({
    promptTokens,
    currentFiles: visibleFiles,
    previousFiles: input.previousSession?.files,
    retrievalAmplification
  });
  const costEstimate = estimateRuntimeCost({
    model: modelProfile.name,
    promptTokens,
    completionTokens,
    cacheCreateTokens: cacheInsight.cacheCreateTokens,
    cacheReadTokens: cacheInsight.cacheReadTokens
  });
  const now = input.now ?? Date.now();

  return {
    workspace: input.workspace,
    startedAt: now,
    endedAt: now,
    model: modelProfile.name,
    contextWindow: modelProfile.contextWindow,
    promptTokens,
    completionTokens,
    cacheCreateTokens: cacheInsight.cacheCreateTokens,
    cacheReadTokens: cacheInsight.cacheReadTokens,
    requests: 1,
    estimatedCost: costEstimate.estimatedCost,
    credits: costEstimate.credits,
    cacheEfficiency: cacheInsight.cacheEfficiency,
    files: uniqueValues([...visibleFiles, ...(input.workspaceAnalysis?.highestRiskFiles ?? [])]),
    retrievalFiles,
    promptFiles,
    skills,
    mcpConfigs,
    retrievalAmplification,
    contextPressure: roundTo((input.budget.usedTokens / Math.max(input.budget.budgetTokens, 1)) * 100, 1),
    promptStability: cacheInsight.promptStability,
    latencyMs: estimateLatency(input.budget, retrievalAmplification),
    risk: input.budget.risk,
    source: 'simulated'
  };
}

function resolveModelProfile(preferredModel: string | undefined, totalContextTokens: number) {
  const normalized = preferredModel?.trim();
  if (!normalized || normalized === 'auto') {
    return selectModelProfile(totalContextTokens);
  }

  return modelProfiles.find(profile => profile.name === normalized) ?? selectModelProfile(totalContextTokens);
}

function resolvePromptTokens(budget: BudgetResult): number {
  const livePromptTokens = budget.currentFileTokens + budget.openFilesTokens;
  const inferredPromptTokens = Math.max(budget.estimatedFinalContext - budget.estimatedRetrievalTokens, 0);
  const promptTokens = Math.max(livePromptTokens, inferredPromptTokens);
  return Math.max(256, Math.min(promptTokens, budget.estimatedFinalContext));
}

function resolveRetrievalAmplification(
  budget: BudgetResult,
  workspaceAnalysis?: WorkspaceBudgetAnalysis
): number {
  if (workspaceAnalysis?.estimatedRuntimeAmplification) {
    return roundTo(workspaceAnalysis.estimatedRuntimeAmplification, 2);
  }

  const promptTokens = Math.max(resolvePromptTokens(budget), 1);
  return roundTo(Math.max(budget.estimatedFinalContext / promptTokens, 1), 2);
}

function estimateCompletionTokens(
  promptTokens: number,
  risk: BudgetResult['risk'],
  retrievalAmplification: number
): number {
  const riskFactor: Record<BudgetResult['risk'], number> = {
    low: 0.18,
    medium: 0.22,
    high: 0.26,
    critical: 0.3
  };
  const amplificationBonus = Math.min(Math.max(retrievalAmplification - 1, 0), 4) * 0.025;
  return Math.max(256, Math.min(Math.round(promptTokens * (riskFactor[risk] + amplificationBonus)), 8_192));
}

function estimateLatency(budget: BudgetResult, retrievalAmplification: number): number {
  const riskPenalty: Record<BudgetResult['risk'], number> = {
    low: 0,
    medium: 120,
    high: 260,
    critical: 420
  };

  return Math.round(380 + budget.usedTokens / 65 + retrievalAmplification * 140 + riskPenalty[budget.risk]);
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}