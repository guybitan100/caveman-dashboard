import { RuntimeSnapshot } from './runtimeComparison';

export interface RuntimeHistoryRetentionPolicy {
  retentionDays: number;
  maxSnapshots: number;
  baselineId?: string;
  now?: number;
}

export interface RuntimeHistoryRetentionResult {
  kept: RuntimeSnapshot[];
  removed: RuntimeSnapshot[];
}

export interface HistoryRetentionPlan {
  expiredIds: string[];
  retained: RuntimeSnapshot[];
}

export function applyHistoryRetention(
  snapshots: RuntimeSnapshot[],
  policy: RuntimeHistoryRetentionPolicy
): RuntimeHistoryRetentionResult {
  const sorted = [...snapshots].sort((left, right) => {
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
  const now = policy.now ?? Date.now();
  const maxSnapshots = Math.max(1, Math.round(policy.maxSnapshots));
  const cutoff = now - Math.max(1, Math.round(policy.retentionDays)) * 24 * 60 * 60 * 1000;
  const kept: RuntimeSnapshot[] = [];
  const removed: RuntimeSnapshot[] = [];

  for (const snapshot of sorted) {
    const withinAge = Date.parse(snapshot.createdAt) >= cutoff;
    const isBaseline = policy.baselineId === snapshot.id;

    if ((withinAge && kept.length < maxSnapshots) || isBaseline) {
      kept.push(snapshot);
      continue;
    }

    removed.push(snapshot);
  }

  return { kept, removed };
}

export function buildHistoryRetentionPlan(
  snapshots: RuntimeSnapshot[],
  retentionDays: number,
  maxSnapshots: number,
  now = Date.now(),
  baselineId?: string
): HistoryRetentionPlan {
  const result = applyHistoryRetention(snapshots, {
    retentionDays,
    maxSnapshots,
    now,
    baselineId
  });

  return {
    expiredIds: result.removed.map(snapshot => snapshot.id),
    retained: result.kept
  };
}
