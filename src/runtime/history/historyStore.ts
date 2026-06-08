import * as fs from 'node:fs';
import * as path from 'node:path';

import { applyHistoryRetention, RuntimeHistoryRetentionPolicy } from './historyRetention';
import { RuntimeSnapshot } from './runtimeComparison';

export interface RuntimeHistoryPaths {
  root: string;
  history: string;
  snapshots: string;
  baseline: string;
  latest: string;
}

export class RuntimeHistoryStore {
  constructor(private readonly workspaceRoot?: string) {}

  isAvailable(): boolean {
    return Boolean(this.workspaceRoot);
  }

  getPaths(): RuntimeHistoryPaths | undefined {
    if (!this.workspaceRoot) {
      return undefined;
    }

    const root = path.join(this.workspaceRoot, '.tokenlint');
    return {
      root,
      history: path.join(root, 'history'),
      snapshots: path.join(root, 'snapshots'),
      baseline: path.join(root, 'history', 'baseline.json'),
      latest: path.join(root, 'snapshots', 'latest.json')
    };
  }

  listSnapshots(workspace?: string): RuntimeSnapshot[] {
    const paths = this.getPaths();
    if (!paths || !fs.existsSync(paths.history)) {
      return [];
    }

    return fs.readdirSync(paths.history)
      .filter(fileName => fileName.endsWith('.json') && fileName !== 'baseline.json')
      .map(fileName => this.readJson<RuntimeSnapshot>(path.join(paths.history, fileName)))
      .filter((snapshot): snapshot is RuntimeSnapshot => Boolean(snapshot))
      .filter(snapshot => !workspace || snapshot.workspace === workspace)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }

  getSnapshot(snapshotId: string): RuntimeSnapshot | undefined {
    const paths = this.getPaths();
    if (!paths) {
      return undefined;
    }

    return this.readJson<RuntimeSnapshot>(path.join(paths.history, `${sanitizeFileSegment(snapshotId)}.json`));
  }

  saveSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshot | undefined {
    const paths = this.getPaths();
    if (!paths) {
      return undefined;
    }

    this.ensureDirectories(paths);
    const serialized = JSON.stringify(snapshot, null, 2);
    fs.writeFileSync(path.join(paths.history, `${sanitizeFileSegment(snapshot.id)}.json`), serialized, 'utf8');
    fs.writeFileSync(paths.latest, serialized, 'utf8');
    return snapshot;
  }

  deleteSnapshot(snapshotId: string): boolean {
    const paths = this.getPaths();
    if (!paths) {
      return false;
    }

    const snapshotPath = path.join(paths.history, `${sanitizeFileSegment(snapshotId)}.json`);
    if (!fs.existsSync(snapshotPath)) {
      return false;
    }

    fs.rmSync(snapshotPath, { force: true });
    const latest = this.readJson<RuntimeSnapshot>(paths.latest);
    if (latest?.id === snapshotId) {
      const nextLatest = this.listSnapshots()[0];
      if (nextLatest) {
        fs.writeFileSync(paths.latest, JSON.stringify(nextLatest, null, 2), 'utf8');
      } else if (fs.existsSync(paths.latest)) {
        fs.rmSync(paths.latest, { force: true });
      }
    }
    if (this.getBaselineId() === snapshotId) {
      this.setBaselineId(undefined);
    }
    return true;
  }

  getBaselineId(): string | undefined {
    const paths = this.getPaths();
    if (!paths) {
      return undefined;
    }

    return this.readJson<{ snapshotId?: string }>(paths.baseline)?.snapshotId;
  }

  setBaselineId(snapshotId: string | undefined): void {
    const paths = this.getPaths();
    if (!paths) {
      return;
    }

    this.ensureDirectories(paths);
    if (!snapshotId) {
      if (fs.existsSync(paths.baseline)) {
        fs.rmSync(paths.baseline, { force: true });
      }
      return;
    }

    fs.writeFileSync(paths.baseline, JSON.stringify({ snapshotId }, null, 2), 'utf8');
  }

  clearHistory(): number {
    const paths = this.getPaths();
    if (!paths) {
      return 0;
    }

    const snapshots = this.listSnapshots();
    for (const snapshot of snapshots) {
      fs.rmSync(path.join(paths.history, `${sanitizeFileSegment(snapshot.id)}.json`), { force: true });
    }
    if (fs.existsSync(paths.latest)) {
      fs.rmSync(paths.latest, { force: true });
    }
    this.setBaselineId(undefined);
    return snapshots.length;
  }

  prune(policy: RuntimeHistoryRetentionPolicy, workspace?: string): RuntimeSnapshot[] {
    const snapshots = this.listSnapshots(workspace);
    const result = applyHistoryRetention(snapshots, {
      ...policy,
      baselineId: policy.baselineId ?? this.getBaselineId()
    });

    for (const snapshot of result.removed) {
      this.deleteSnapshot(snapshot.id);
    }

    return result.removed;
  }

  private ensureDirectories(paths: RuntimeHistoryPaths): void {
    fs.mkdirSync(paths.root, { recursive: true });
    fs.mkdirSync(paths.history, { recursive: true });
    fs.mkdirSync(paths.snapshots, { recursive: true });
  }

  private readJson<T>(filePath: string): T | undefined {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
      return undefined;
    }
  }
}

function sanitizeFileSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'snapshot';
}
