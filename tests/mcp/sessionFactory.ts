import {
  BudgetResult,
  BudgetWorkspaceFileRisk,
  WorkspaceBudgetAnalysis
} from '../../src/core/budget/budgetModels';
import { estimateRuntimeCost } from '../../src/runtime/session/costEngine';
import { AISession, SessionTelemetry } from '../../src/runtime/session/sessionModels';

export interface TelemetrySeed extends Partial<SessionTelemetry> {
  favorite?: boolean;
  diagnosticsByFile?: Record<string, number>;
  fileEstimates?: BudgetWorkspaceFileRisk[];
  highestRiskFiles?: string[];
  budget?: Partial<BudgetResult>;
  workspaceAnalysis?: Partial<WorkspaceBudgetAnalysis>;
}

const defaultTimestamp = Date.parse('2099-06-15T12:00:00Z');

type RuntimeLike = Pick<
  SessionTelemetry,
  | 'workspace'
  | 'title'
  | 'startedAt'
  | 'endedAt'
  | 'model'
  | 'contextWindow'
  | 'promptTokens'
  | 'completionTokens'
  | 'cacheCreateTokens'
  | 'cacheReadTokens'
  | 'requests'
  | 'estimatedCost'
  | 'credits'
  | 'cacheSavings'
  | 'cacheEfficiency'
  | 'files'
  | 'retrievalFiles'
  | 'promptFiles'
  | 'skills'
  | 'mcpConfigs'
  | 'retrievalAmplification'
  | 'contextPressure'
  | 'promptStability'
  | 'latencyMs'
  | 'risk'
  | 'source'
>;

export function buildTelemetry(seed: TelemetrySeed = {}): SessionTelemetry {
  const promptTokens = seed.promptTokens ?? 18_000;
  const completionTokens = seed.completionTokens ?? 3_600;
  const cacheCreateTokens = seed.cacheCreateTokens ?? 9_000;
  const cacheReadTokens = seed.cacheReadTokens ?? 4_500;
  const model = seed.model ?? 'GPT-5.4';
  const estimate = estimateRuntimeCost({
    model,
    promptTokens,
    completionTokens,
    cacheCreateTokens,
    cacheReadTokens
  });

  return {
    workspace: seed.workspace ?? 'token-lint',
    title: seed.title ?? 'New session - runtime validation',
    startedAt: seed.startedAt ?? defaultTimestamp,
    endedAt: seed.endedAt ?? seed.startedAt ?? defaultTimestamp,
    model,
    contextWindow: seed.contextWindow ?? 192_000,
    promptTokens,
    completionTokens,
    cacheCreateTokens,
    cacheReadTokens,
    requests: Math.max(1, seed.requests ?? 1),
    estimatedCost: seed.estimatedCost ?? estimate.estimatedCost,
    credits: seed.credits ?? estimate.credits,
    cacheSavings: seed.cacheSavings ?? estimate.cacheSavings,
    cacheEfficiency: seed.cacheEfficiency ?? roundTo((cacheReadTokens / Math.max(cacheCreateTokens, 1)) * 100, 1),
    files: uniqueValues(seed.files ?? ['prompt.md', 'skill.yaml']),
    retrievalFiles: uniqueValues(seed.retrievalFiles ?? ['retrieval.yaml']),
    promptFiles: uniqueValues(seed.promptFiles ?? ['prompt.md']),
    skills: uniqueValues(seed.skills ?? ['skill.yaml']),
    mcpConfigs: uniqueValues(seed.mcpConfigs ?? ['mcp.json']),
    retrievalAmplification: seed.retrievalAmplification ?? 2.4,
    contextPressure: seed.contextPressure ?? 44.2,
    promptStability: seed.promptStability ?? 58,
    latencyMs: seed.latencyMs ?? 940,
    risk: seed.risk ?? 'medium',
    source: seed.source ?? 'mcp'
  };
}

export function buildBudgetFromRuntime(runtime: RuntimeLike | AISession, seed: TelemetrySeed = {}): BudgetResult {
  const estimatedRetrievalTokens = seed.budget?.estimatedRetrievalTokens
    ?? Math.round(runtime.promptTokens * Math.max(runtime.retrievalAmplification - 1, 0));
  const estimatedFinalContext = seed.budget?.estimatedFinalContext
    ?? Math.round(runtime.promptTokens + runtime.completionTokens + estimatedRetrievalTokens);
  const budgetTokens = seed.budget?.budgetTokens
    ?? Math.max(runtime.contextWindow, Math.round(estimatedFinalContext * 1.1));
  const currentFileTokens = seed.budget?.currentFileTokens
    ?? Math.round(runtime.promptTokens * 0.45);
  const openFilesTokens = seed.budget?.openFilesTokens
    ?? Math.max(runtime.promptTokens - currentFileTokens, 0);
  const usedTokens = seed.budget?.usedTokens ?? estimatedFinalContext;

  return {
    budgetTokens,
    usedTokens,
    usagePercent: seed.budget?.usagePercent ?? roundTo((usedTokens / Math.max(budgetTokens, 1)) * 100, 1),
    currentFileTokens,
    openFilesTokens,
    workspaceTokens: seed.budget?.workspaceTokens ?? Math.max(runtime.promptTokens, currentFileTokens + openFilesTokens),
    estimatedRetrievalTokens,
    estimatedFinalContext,
    risk: seed.budget?.risk ?? runtime.risk
  };
}

export function buildWorkspaceAnalysisFromRuntime(
  runtime: RuntimeLike | AISession,
  seed: TelemetrySeed = {}
): WorkspaceBudgetAnalysis {
  const fileEstimates = seed.fileEstimates ?? buildFileEstimates(runtime);
  const estimatedTokens = seed.workspaceAnalysis?.estimatedTokens
    ?? fileEstimates.reduce((total, entry) => total + entry.tokens, 0);
  const estimatedRetrievalTokens = seed.workspaceAnalysis?.estimatedRetrievalTokens
    ?? fileEstimates.reduce((total, entry) => total + entry.estimatedRetrievalTokens, 0);
  const estimatedFinalContext = seed.workspaceAnalysis?.estimatedFinalContext
    ?? fileEstimates.reduce((total, entry) => total + entry.estimatedFinalContext, 0);

  return {
    filesScanned: seed.workspaceAnalysis?.filesScanned ?? fileEstimates.length,
    estimatedTokens,
    estimatedRetrievalTokens,
    estimatedFinalContext,
    estimatedRuntimeAmplification: seed.workspaceAnalysis?.estimatedRuntimeAmplification ?? runtime.retrievalAmplification,
    highestRiskFiles: seed.highestRiskFiles ?? seed.workspaceAnalysis?.highestRiskFiles ?? runtime.retrievalFiles,
    fileEstimates
  };
}

export function buildDiagnosticsMap(runtime: RuntimeLike | AISession, seed: TelemetrySeed = {}): Map<string, number> {
  const entries = seed.diagnosticsByFile
    ? Object.entries(seed.diagnosticsByFile)
    : runtime.files.map(fileName => [fileName, runtime.retrievalFiles.includes(fileName) ? 2 : 0] as const);

  return new Map(entries);
}

function buildFileEstimates(runtime: RuntimeLike | AISession): BudgetWorkspaceFileRisk[] {
  const files = uniqueValues(runtime.files);
  const promptTokenShare = Math.max(1, Math.round(runtime.promptTokens / Math.max(files.length, 1)));

  return files.map(fileName => {
    const retrievalTokens = runtime.retrievalFiles.includes(fileName)
      ? Math.round(promptTokenShare * Math.max(runtime.retrievalAmplification - 1, 0))
      : Math.round(promptTokenShare * 0.08);
    const finalContext = promptTokenShare + retrievalTokens + Math.round(runtime.completionTokens / Math.max(files.length, 1));

    return {
      fileName,
      tokens: promptTokenShare,
      estimatedRetrievalTokens: retrievalTokens,
      estimatedFinalContext: finalContext
    };
  });
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}