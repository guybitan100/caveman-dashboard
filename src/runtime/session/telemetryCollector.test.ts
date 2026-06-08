import { describe, expect, it } from 'vitest';

import { collectRuntimeTelemetry } from './telemetryCollector';

describe('runtime telemetry collector', () => {
  it('builds simulated telemetry from budget and workspace analysis inputs', () => {
    const telemetry = collectRuntimeTelemetry({
      workspace: 'token-lint',
      visibleFiles: [
        'prompt.md',
        'security_skill.yaml',
        'mcp.json',
        'rag-config.yaml'
      ],
      budget: {
        budgetTokens: 128_000,
        usedTokens: 142_000,
        usagePercent: 111,
        currentFileTokens: 9_000,
        openFilesTokens: 28_000,
        workspaceTokens: 104_000,
        estimatedRetrievalTokens: 64_000,
        estimatedFinalContext: 142_000,
        risk: 'critical'
      },
      workspaceAnalysis: {
        filesScanned: 12,
        estimatedTokens: 104_000,
        estimatedRetrievalTokens: 64_000,
        estimatedFinalContext: 168_000,
        estimatedRuntimeAmplification: 4.2,
        highestRiskFiles: ['rag-config.yaml', 'memory.md'],
        fileEstimates: []
      },
      preferredModel: 'auto',
      now: 1_718_000_000_000
    });

    expect(telemetry.workspace).toBe('token-lint');
    expect(telemetry.model).toBe('Claude Sonnet 4.6');
    expect(telemetry.contextWindow).toBe(400_000);
    expect(telemetry.promptTokens).toBe(78_000);
    expect(telemetry.completionTokens).toBe(8_192);
    expect(telemetry.cacheEfficiency).toBeGreaterThan(0);
    expect(telemetry.retrievalAmplification).toBe(4.2);
    expect(telemetry.promptFiles).toContain('prompt.md');
    expect(telemetry.skills).toContain('security_skill.yaml');
    expect(telemetry.mcpConfigs).toContain('mcp.json');
    expect(telemetry.retrievalFiles).toEqual(['rag-config.yaml', 'memory.md']);
    expect(telemetry.estimatedCost).toBeGreaterThan(0);
    expect(telemetry.cacheSavings).toBeGreaterThan(0);
    expect(telemetry.title).toBe('New session - prompt');
    expect(telemetry.source).toBe('simulated');
  });
});