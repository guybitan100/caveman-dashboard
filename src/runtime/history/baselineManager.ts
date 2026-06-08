import { RuntimeHistoryStore } from './historyStore';
import { RuntimeSnapshot } from './runtimeComparison';

export class RuntimeBaselineManager {
  constructor(private readonly store: RuntimeHistoryStore) {}

  getBaselineSnapshot(
    snapshots: RuntimeSnapshot[],
    configuredBaseline = 'latest',
    excludeSnapshotId?: string
  ): RuntimeSnapshot | undefined {
    const filtered = snapshots.filter(snapshot => snapshot.id !== excludeSnapshotId);
    if (filtered.length === 0) {
      return undefined;
    }

    const manualBaselineId = this.store.getBaselineId();
    if (manualBaselineId) {
      return filtered.find(snapshot => snapshot.id === manualBaselineId);
    }

    if (configuredBaseline && configuredBaseline !== 'latest') {
      return filtered.find(snapshot => snapshot.id === configuredBaseline);
    }

    return filtered[0];
  }

  setBaseline(snapshotId: string): void {
    this.store.setBaselineId(snapshotId);
  }

  clearBaseline(): void {
    this.store.setBaselineId(undefined);
  }
}
