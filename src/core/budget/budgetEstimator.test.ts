import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  window: {
    visibleTextEditors: []
  }
}));

import {
  analyzeWorkspaceBudget,
  ASSUMED_RETRIEVAL_CHUNK_TOKENS,
  estimateBudget,
  estimateDocumentTokens,
  estimateOpenFilesTokens,
  estimateRetrievalTokens,
  estimateTextBudget
} from './budgetEstimator';

describe('budgetEstimator', () => {
  it('estimates retrieval amplification from explicit top_k settings', () => {
    const result = estimateTextBudget('top_k: 20\nretrieval: vector store', 'skill.yaml');

    expect(result.estimatedRetrievalTokens).toBe(20 * ASSUMED_RETRIEVAL_CHUNK_TOKENS);
    expect(result.estimatedFinalContext).toBe(result.tokens + result.estimatedRetrievalTokens);
    expect(estimateRetrievalTokens('This prompt mentions retrieval but not configuration.', 'README.md')).toBe(0);
  });

  it('deduplicates split editors when summing open-file tokens', () => {
    const editors = [
      {
        document: {
          fileName: 'first.md',
          uri: { toString: () => 'file:///first.md' },
          getText: () => 'first file'
        }
      },
      {
        document: {
          fileName: 'first.md',
          uri: { toString: () => 'file:///first.md' },
          getText: () => 'duplicate view should not count twice'
        }
      },
      {
        document: {
          fileName: 'second.md',
          uri: { toString: () => 'file:///second.md' },
          getText: () => 'second file'
        }
      }
    ];

    expect(estimateOpenFilesTokens(editors as never)).toBe(
      estimateDocumentTokens('first file') + estimateDocumentTokens('second file')
    );
  });

  it('builds a budget result from current, open, and workspace sources', () => {
    const result = estimateBudget({
      budgetTokens: 128000,
      currentFile: {
        fileName: 'prompt.md',
        text: 'top_k: 10\nAlways answer in JSON.'
      },
      openFiles: [
        {
          fileName: 'prompt.md',
          text: 'top_k: 10\nAlways answer in JSON.'
        },
        {
          fileName: 'skill.yaml',
          text: 'name: planner\ntop_k: 20'
        }
      ],
      workspaceFiles: [
        {
          fileName: 'skills/agent.yaml',
          text: 'top_k: 5\nretrieval: true'
        }
      ]
    });

    expect(result.currentFileTokens).toBeGreaterThan(0);
    expect(result.openFilesTokens).toBeGreaterThan(result.currentFileTokens);
    expect(result.workspaceTokens).toBeGreaterThan(0);
    expect(result.estimatedRetrievalTokens).toBe(
      (10 + 20 + 5) * ASSUMED_RETRIEVAL_CHUNK_TOKENS
    );
    expect(result.usedTokens).toBe(result.estimatedFinalContext);
  });

  it('summarizes workspace risk and highest-risk files', () => {
    const analysis = analyzeWorkspaceBudget([
      {
        fileName: 'agent.yaml',
        text: 'top_k: 20\nretrieval: true'
      },
      {
        fileName: 'prompt.md',
        text: 'Always be helpful.'
      },
      {
        fileName: 'rag_config.yaml',
        text: 'top_k: 12\nretrieval: true'
      }
    ]);

    expect(analysis.filesScanned).toBe(3);
    expect(analysis.estimatedTokens).toBeGreaterThan(0);
    expect(analysis.estimatedRetrievalTokens).toBe(
      (20 + 12) * ASSUMED_RETRIEVAL_CHUNK_TOKENS
    );
    expect(analysis.highestRiskFiles[0]).toBe('agent.yaml');
    expect(analysis.estimatedRuntimeAmplification).toBeGreaterThan(1);
  });
});