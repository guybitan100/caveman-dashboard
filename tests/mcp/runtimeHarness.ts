import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type {
  RuntimeDashboardDiffMode,
  RuntimeDashboardExportView,
  RuntimeDashboardSection,
  RuntimeDashboardViewState
} from '../../src/extension/providers/runtimeDashboardPanel';
import { RuntimeHistoryStore } from '../../src/runtime/history/historyStore';
import { RuntimeComparison, RuntimeSnapshot } from '../../src/runtime/history/runtimeComparison';
import { RuntimeHistorySettings, RuntimeSnapshotManager } from '../../src/runtime/history/snapshotManager';
import { RuntimeSessionManager } from '../../src/runtime/session/sessionManager';
import { AISession, allWorkspacesLabel, RuntimeDashboardFilter } from '../../src/runtime/session/sessionModels';
import { RuntimeSessionStore, SessionStoreBackend } from '../../src/runtime/session/sessionStore';

import {
  buildBudgetFromRuntime,
  buildDiagnosticsMap,
  buildWorkspaceAnalysisFromRuntime,
  TelemetrySeed
} from './sessionFactory';
import { seedTelemetry, SeededSession } from './telemetrySeeder';

export interface BuildViewStateOptions {
  filter?: RuntimeDashboardFilter;
  activeSection?: RuntimeDashboardSection;
  activeView?: RuntimeDashboardExportView;
  activeComparison?: RuntimeComparison;
  currentWorkspace?: string;
  diffMode?: RuntimeDashboardDiffMode;
}

class MemorySessionBackend implements SessionStoreBackend {
  private readonly state = new Map<string, unknown>();

  get<T>(key: string, defaultValue: T): T {
    return (this.state.get(key) as T | undefined) ?? defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.state.set(key, value);
  }
}

export class RuntimeValidationHarness {
  readonly workspaceRoot: string;
  readonly sessionManager: RuntimeSessionManager;
  readonly historyStore: RuntimeHistoryStore;
  readonly snapshotManager: RuntimeSnapshotManager;
  readonly historySettings: RuntimeHistorySettings = {
    retentionDays: 30,
    maxSnapshots: 500,
    baseline: 'latest'
  };

  private readonly seededSessions = new Map<string, SeededSession>();

  constructor(private readonly workspaceName = 'token-lint', workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot ?? fs.mkdtempSync(path.join(os.tmpdir(), 'tokenlint-runtime-'));
    this.sessionManager = new RuntimeSessionManager(new RuntimeSessionStore(new MemorySessionBackend()));
    this.historyStore = new RuntimeHistoryStore(this.workspaceRoot);
    this.snapshotManager = new RuntimeSnapshotManager(this.historyStore);
  }

  async seedSessions(seeds: TelemetrySeed[]): Promise<SeededSession[]> {
    const seeded = await seedTelemetry(this.sessionManager, seeds);

    for (const entry of seeded) {
      this.seededSessions.set(entry.session.id, entry);
    }

    return seeded;
  }

  async toggleFavorite(sessionId: string): Promise<AISession | undefined> {
    return this.sessionManager.toggleFavorite(sessionId);
  }

  getDashboardState(filter: RuntimeDashboardFilter = {}) {
    return this.sessionManager.getDashboardState({
      workspace: allWorkspacesLabel,
      timeWindowDays: 30,
      ...filter
    });
  }

  buildViewState(options: BuildViewStateOptions = {}): RuntimeDashboardViewState {
    const filter = {
      workspace: allWorkspacesLabel,
      timeWindowDays: 30,
      ...options.filter
    };
    const dashboardState = this.getDashboardState(filter);
    const historyWorkspace = filter.workspace && filter.workspace !== allWorkspacesLabel
      ? filter.workspace
      : undefined;

    return {
      ...dashboardState,
      filter: {
        workspace: filter.workspace ?? allWorkspacesLabel,
        timeWindowDays: filter.timeWindowDays ?? 30,
        favoritesOnly: filter.favoritesOnly
      },
      activeSection: options.activeSection ?? 'overview',
      activeView: options.activeView ?? 'all',
      history: {
        snapshots: this.snapshotManager.listSnapshots(historyWorkspace),
        baselineId: this.snapshotManager.getBaselineId(),
        activeComparison: options.activeComparison,
        diffMode: options.diffMode ?? 'previous',
        settings: {
          enabled: true,
          retentionDays: this.historySettings.retentionDays,
          maxSnapshots: this.historySettings.maxSnapshots,
          snapshotOnScan: true,
          snapshotOnDashboardOpen: true,
          baseline: this.historySettings.baseline
        }
      },
      currentWorkspace: options.currentWorkspace ?? this.workspaceName
    };
  }

  captureLatestSnapshot(options: {
    sessionId?: string;
    createdAt?: number;
    workspace?: string;
  } = {}): RuntimeSnapshot | undefined {
    const dashboardState = this.getDashboardState({
      workspace: options.workspace ?? allWorkspacesLabel,
      timeWindowDays: 30
    });
    const latestSession = options.sessionId
      ? dashboardState.sessions.find(session => session.id === options.sessionId)
      : dashboardState.latestSession;

    if (!latestSession) {
      return undefined;
    }

    const seed = this.seededSessions.get(latestSession.id)?.seed ?? {};

    return this.snapshotManager.captureSnapshot(
      {
        workspace: latestSession.workspace,
        createdAt: options.createdAt ?? latestSession.endedAt ?? latestSession.startedAt,
        latestSession,
        dashboardSummary: dashboardState.summary,
        costByModel: dashboardState.costByModel,
        budget: buildBudgetFromRuntime(latestSession, seed),
        workspaceAnalysis: buildWorkspaceAnalysisFromRuntime(latestSession, seed),
        diagnosticsByFile: buildDiagnosticsMap(latestSession, seed)
      },
      this.historySettings
    );
  }

  listSnapshots(workspace?: string): RuntimeSnapshot[] {
    return this.snapshotManager.listSnapshots(workspace);
  }

  setBaseline(snapshotId: string): void {
    this.snapshotManager.setBaseline(snapshotId);
  }

  compareLatestToPrevious(workspace?: string) {
    return this.snapshotManager.compareLatestToPrevious(workspace);
  }

  compareLatestToBaseline(workspace?: string, configuredBaseline = 'latest') {
    return this.snapshotManager.compareLatestToBaseline(workspace, configuredBaseline);
  }

  compareLatestToSnapshot(snapshotId: string, workspace?: string) {
    return this.snapshotManager.compareLatestToSnapshot(snapshotId, workspace);
  }

  getHistoryPaths() {
    return this.historyStore.getPaths();
  }

  clearHistory(): number {
    return this.snapshotManager.clearAllHistory();
  }

  dispose(): void {
    fs.rmSync(this.workspaceRoot, { recursive: true, force: true });
  }
}