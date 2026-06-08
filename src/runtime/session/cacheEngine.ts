import { CacheInsight } from './sessionModels';

export interface CacheInsightInput {
  promptTokens: number;
  currentFiles: string[];
  previousFiles?: string[];
  retrievalAmplification: number;
}

export function calculateCacheInsight(input: CacheInsightInput): CacheInsight {
  const promptTokens = Math.max(0, Math.round(input.promptTokens));
  if (promptTokens === 0) {
    return {
      cacheCreateTokens: 0,
      cacheReadTokens: 0,
      cacheEfficiency: 0,
      promptStability: 0,
      cacheIndicator: 'none'
    };
  }

  const currentFiles = uniqueValues(input.currentFiles);
  const previousFiles = new Set(uniqueValues(input.previousFiles ?? []));
  const overlappingFiles = currentFiles.filter(fileName => previousFiles.has(fileName)).length;
  const overlapRatio = currentFiles.length === 0 ? 0 : overlappingFiles / currentFiles.length;
  const baselineStability = previousFiles.size === 0 ? 0.72 : 0.22 + overlapRatio * 0.62;
  const amplificationPenalty = clamp((Math.max(input.retrievalAmplification, 1) - 1) * 0.045, 0, 0.24);
  const promptStability = clamp(Math.round((baselineStability - amplificationPenalty) * 100), 15, 96);
  const cacheReadTokens = Math.round(promptTokens * (promptStability / 100) * 0.48);
  const cacheCreateTokens = Math.max(promptTokens - cacheReadTokens, 0);
  const cacheEfficiency = roundTo((cacheReadTokens / Math.max(cacheCreateTokens, 1)) * 100, 1);

  return {
    cacheCreateTokens,
    cacheReadTokens,
    cacheEfficiency,
    promptStability,
    cacheIndicator: toCacheIndicator(cacheEfficiency)
  };
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function toCacheIndicator(cacheEfficiency: number): CacheInsight['cacheIndicator'] {
  if (cacheEfficiency > 70) {
    return 'high';
  }

  if (cacheEfficiency > 30) {
    return 'partial';
  }

  return 'none';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}