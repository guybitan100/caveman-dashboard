import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { RuntimeHistoryStore } from './historyStore';
import { RuntimeSnapshot } from './runtimeComparison';

describe('runtime history store', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('writes snapshots to history and updates the latest pointer', () => {
    const root = createTempDir(tempDirs);
    const store = new RuntimeHistoryStore(root);
    const first = buildSnapshot('2026-06-07T10-17-00', '2026-06-07T10:17:00Z');
    const second = buildSnapshot('2026-06-08T10-58-56', '2026-06-08T10:58:56Z');

    store.saveSnapshot(first);
    store.saveSnapshot(second);

    const paths = store.getPaths();

    expect(store.listSnapshots()).toHaveLength(2);
    expect(store.listSnapshots()[0].id).toBe(second.id);
    expect(fs.existsSync(path.join(paths!.history, `${second.id}.json`))).toBe(true);
    expect(JSON.parse(fs.readFileSync(paths!.latest, 'utf8'))).toMatchObject({ id: second.id });
  });

  it('stores baseline metadata and clears history safely', () => {
    const root = createTempDir(tempDirs);
    const store = new RuntimeHistoryStore(root);
    const snapshot = buildSnapshot('2026-06-08T10-58-56', '2026-06-08T10:58:56Z');

    store.saveSnapshot(snapshot);
    store.setBaselineId(snapshot.id);

    expect(store.getBaselineId()).toBe(snapshot.id);
    expect(store.clearHistory()).toBe(1);
    expect(store.listSnapshots()).toEqual([]);
    expect(store.getBaselineId()).toBeUndefined();
  });
});

function createTempDir(tempDirs: string[]): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenlint-history-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function buildSnapshot(id: string, createdAt: string): RuntimeSnapshot {
  return {
    id,
    createdAt,
    workspace: 'token-lint',
    summary: {
      totalTokens: 25_000,
      promptTokens: 20_000,
      completionTokens: 5_000,
      cacheTokens: 11_000,
      cacheEfficiency: 42,
      retrievalAmplification: 4.2,
      contextHealth: 72,
      promptStability: 68,
      runtimeCost: 1.18,
      credits: 118,
      modelUsage: [{ model: 'GPT-5.4', cost: 1.18, percent: 100 }]
    },
    files: []
  };
}