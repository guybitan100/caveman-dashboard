import * as vscode from 'vscode';

import { PromptNode, RetrievalNode } from '../ir/nodes';
import { parseToIR } from '../parser/parser';
import { tokenCount } from '../tokenizer/tokenizer';
import { calculateBudget } from './budgetEngine';
import {
  BudgetEstimate,
  BudgetEstimateInput,
  BudgetResult,
  BudgetTokenSource,
  BudgetWorkspaceFileRisk,
  WorkspaceBudgetAnalysis
} from './budgetModels';

export const ASSUMED_RETRIEVAL_CHUNK_TOKENS = 750;

type DocumentLike = Pick<vscode.TextDocument, 'getText' | 'fileName'> & {
  uri?: { toString(): string };
};

export function estimateDocumentTokens(text: string): number {
  return tokenCount(text);
}

export function estimateRetrievalTokensFromIR(ir: PromptNode): number {
  const retrievalNodes = ir.children.filter(
    (node): node is RetrievalNode => node.type === 'retrieval' && node.topK !== undefined
  );

  return retrievalNodes.reduce((sum, node) => {
    return sum + node.topK! * ASSUMED_RETRIEVAL_CHUNK_TOKENS;
  }, 0);
}

export function estimateRetrievalTokens(text: string, fileName = 'unknown'): number {
  return estimateRetrievalTokensFromIR(parseToIR(text, fileName));
}

export function estimateTextBudget(text: string, fileName = 'unknown'): BudgetEstimate {
  const tokens = estimateDocumentTokens(text);
  const estimatedRetrievalTokens = estimateRetrievalTokens(text, fileName);

  return {
    tokens,
    estimatedRetrievalTokens,
    estimatedFinalContext: tokens + estimatedRetrievalTokens
  };
}

export function estimateOpenFilesTokens(
  editors: readonly Pick<vscode.TextEditor, 'document'>[] = vscode.window.visibleTextEditors
): number {
  let total = 0;
  const seenDocuments = new Set<string>();

  for (const editor of editors) {
    const key = getDocumentKey(editor.document as DocumentLike);
    if (seenDocuments.has(key)) {
      continue;
    }

    seenDocuments.add(key);
    total += estimateDocumentTokens(editor.document.getText());
  }

  return total;
}

export function estimateBudget(input: BudgetEstimateInput): BudgetResult {
  const currentFileTokens = estimateSourceTokens(input.currentFile);
  const openFiles = uniqueSources(input.openFiles ?? []);
  const workspaceFiles = uniqueSources(input.workspaceFiles ?? []);
  const openFilesTokens = sumSourceTokens(openFiles);
  const workspaceTokens = input.includeWorkspaceEstimate === false
    ? 0
    : sumSourceTokens(workspaceFiles);
  const includedRetrievalSources = uniqueSources([
    ...(input.currentFile ? [input.currentFile] : []),
    ...openFiles,
    ...(input.includeWorkspaceEstimate === false ? [] : workspaceFiles)
  ]);
  const estimatedRetrievalTokens = input.includeRetrievalAmplification === false
    ? 0
    : sumSourceRetrievalTokens(includedRetrievalSources);
  const baseContextTokens = input.includeWorkspaceEstimate === false
    ? Math.max(currentFileTokens, openFilesTokens)
    : Math.max(currentFileTokens, openFilesTokens, workspaceTokens);
  const estimatedFinalContext = baseContextTokens + estimatedRetrievalTokens;

  return calculateBudget(estimatedFinalContext, input.budgetTokens, {
    currentFileTokens,
    openFilesTokens,
    workspaceTokens,
    estimatedRetrievalTokens,
    estimatedFinalContext,
    warningThresholdPercent: input.warningThresholdPercent,
    criticalThresholdPercent: input.criticalThresholdPercent,
    mediumThresholdPercent: input.mediumThresholdPercent
  });
}

export function analyzeWorkspaceBudget(
  workspaceFiles: readonly BudgetTokenSource[]
): WorkspaceBudgetAnalysis {
  const uniqueWorkspaceFiles = uniqueSources(workspaceFiles);
  const fileEstimates = uniqueWorkspaceFiles
    .map<BudgetWorkspaceFileRisk>(source => {
      const tokens = estimateDocumentTokens(source.text);
      const estimatedRetrievalTokens = estimateRetrievalTokens(
        source.text,
        source.fileName ?? 'unknown'
      );

      return {
        fileName: source.fileName ?? source.key ?? 'unknown',
        tokens,
        estimatedRetrievalTokens,
        estimatedFinalContext: tokens + estimatedRetrievalTokens
      };
    })
    .sort((left, right) => right.estimatedFinalContext - left.estimatedFinalContext);
  const estimatedTokens = fileEstimates.reduce((sum, file) => sum + file.tokens, 0);
  const estimatedRetrievalTokens = fileEstimates.reduce((sum, file) => {
    return sum + file.estimatedRetrievalTokens;
  }, 0);
  const estimatedFinalContext = estimatedTokens + estimatedRetrievalTokens;
  const estimatedRuntimeAmplification = estimatedTokens > 0
    ? estimatedFinalContext / estimatedTokens
    : 1;

  return {
    filesScanned: uniqueWorkspaceFiles.length,
    estimatedTokens,
    estimatedRetrievalTokens,
    estimatedFinalContext,
    estimatedRuntimeAmplification,
    highestRiskFiles: fileEstimates.slice(0, 5).map(estimate => estimate.fileName),
    fileEstimates
  };
}

function estimateSourceTokens(source: BudgetTokenSource | undefined): number {
  if (!source) {
    return 0;
  }

  return estimateDocumentTokens(source.text);
}

function sumSourceTokens(sources: readonly BudgetTokenSource[]): number {
  return sources.reduce((sum, source) => {
    return sum + estimateDocumentTokens(source.text);
  }, 0);
}

function sumSourceRetrievalTokens(sources: readonly BudgetTokenSource[]): number {
  return sources.reduce((sum, source) => {
    return sum + estimateRetrievalTokens(source.text, source.fileName ?? 'unknown');
  }, 0);
}

function uniqueSources(sources: readonly BudgetTokenSource[]): BudgetTokenSource[] {
  const unique = new Map<string, BudgetTokenSource>();

  for (const source of sources) {
    unique.set(toSourceKey(source), source);
  }

  return [...unique.values()];
}

function toSourceKey(source: BudgetTokenSource): string {
  return source.key ?? source.fileName ?? source.text;
}

function getDocumentKey(document: DocumentLike): string {
  return document.uri?.toString() ?? document.fileName;
}