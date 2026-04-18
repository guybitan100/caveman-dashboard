import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  FormState,
  LocalUfdrFile,
  RuntimeJobSnapshot,
  AppInfo,
  SystemStats,
  TabId,
} from "../types/ufdrRuntime.ts";
import { DEFAULT_FORM, EMPTY_JOB } from "../types/ufdrRuntime.ts";
import { ufdrRuntimeApi } from "../api/ufdrRuntimeApi.ts";
import { buildRequestPayload } from "../utils/ufdrRuntime.ts";

type BusyAction = "summary" | "run" | "cancel" | null;

interface UfdrRuntimeState {
  form: FormState;
  localFiles: LocalUfdrFile[];
  job: RuntimeJobSnapshot;
  appInfo: AppInfo | null;
  systemStats: SystemStats | null;
  summaryOutput: string;
  summaryCommand: string;
  busyAction: BusyAction;
  formError: string | null;
  inventoryError: string | null;
  pageError: string | null;
  activeTab: TabId;
  consoleVisible: boolean;
  consolePoppedOut: boolean;

  // Actions
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  setActiveTab: (tab: TabId) => void;
  setConsoleVisible: (visible: boolean) => void;
  setConsolePoppedOut: (poppedOut: boolean) => void;
  toggleConsole: () => void;
  togglePopout: () => void;

  // Async actions
  loadAppBoot: () => Promise<void>;
  loadLocalFiles: () => Promise<void>;
  loadJobStatus: () => Promise<void>;
  loadAppInfo: () => Promise<void>;
  loadSystemStats: () => Promise<void>;
  handlePreviewSummary: () => Promise<void>;
  handlePrimaryAction: () => Promise<void>;
  handleCancelRun: () => Promise<void>;
  handleReset: () => Promise<void>;

  // Computed
  getIsRunning: () => boolean;
  getCanSubmit: () => boolean;
  getSelectedFileDetails: () => LocalUfdrFile | null;
}

export const useUfdrRuntimeStore = create<UfdrRuntimeState>()(
  immer((set, get) => ({
    form: DEFAULT_FORM,
    localFiles: [],
    job: EMPTY_JOB,
    appInfo: null,
    systemStats: null,
    summaryOutput: "",
    summaryCommand: "",
    busyAction: null,
    formError: null,
    inventoryError: null,
    pageError: null,
    activeTab: "builder" as TabId,
    consoleVisible: true,
    consolePoppedOut: false,

    updateField: (key, value) =>
      set((state) => {
        (state.form as Record<string, unknown>)[key] = value;
      }),

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab;
      }),

    setConsoleVisible: (visible) =>
      set((state) => {
        state.consoleVisible = visible;
      }),

    setConsolePoppedOut: (poppedOut) =>
      set((state) => {
        state.consolePoppedOut = poppedOut;
      }),

    toggleConsole: () =>
      set((state) => {
        if (state.consolePoppedOut) state.consolePoppedOut = false;
        state.consoleVisible = !state.consoleVisible;
      }),

    togglePopout: () =>
      set((state) => {
        state.consolePoppedOut = !state.consolePoppedOut;
        state.consoleVisible = true;
      }),

    loadAppBoot: async () => {
      set((state) => {
        state.pageError = null;
      });
      try {
        await Promise.all([
          get().loadLocalFiles(),
          get().loadJobStatus(),
          get().loadAppInfo(),
          get().loadSystemStats(),
        ]);
      } catch (error) {
        set((state) => {
          state.pageError =
            error instanceof Error
              ? error.message
              : "Failed loading UFDR Creation Center";
        });
      }
    },

    loadLocalFiles: async () => {
      set((state) => {
        state.inventoryError = null;
      });
      try {
        const files = await ufdrRuntimeApi.listLocalFiles();
        set((state) => {
          state.localFiles = files;
          // Auto-select first file if none selected
          if (
            files.length > 0 &&
            (!state.form.selectedLocalFile ||
              !files.some((f) => f.path === state.form.selectedLocalFile))
          ) {
            state.form.selectedLocalFile = files[0].path;
          }
        });
      } catch (error) {
        set((state) => {
          state.inventoryError =
            error instanceof Error
              ? error.message
              : "Failed loading local UFDR files";
        });
      }
    },

    loadJobStatus: async () => {
      const snapshot = await ufdrRuntimeApi.getCurrentJob();
      set((state) => {
        const wasRunning = state.job.status === "running";
        state.job = snapshot;
        if (wasRunning && snapshot.status !== "running") {
          // job finished; reload inventory
          get().loadLocalFiles();
        }
        if (
          state.job.status === "running" &&
          !state.consoleVisible &&
          !state.consolePoppedOut
        ) {
          state.consoleVisible = true;
          state.activeTab = "logs";
        }
      });
    },

    loadAppInfo: async () => {
      const info = await ufdrRuntimeApi.getInfo();
      set((state) => {
        state.appInfo = info;
      });
    },

    loadSystemStats: async () => {
      try {
        const stats = await ufdrRuntimeApi.getSystemStats();
        set((state) => {
          state.systemStats = stats;
        });
      } catch {
        // stats polling failure is non-critical
      }
    },

    handlePreviewSummary: async () => {
      const { form } = get();
      if (!get().getCanSubmit()) {
        set((state) => {
          state.formError =
            "Select a local UFDR or provide an S3 evidence id before generating a summary.";
        });
        return;
      }
      set((state) => {
        state.formError = null;
        state.busyAction = "summary";
      });
      try {
        const payload = buildRequestPayload({
          ...form,
          executionMode: "summary",
        });
        const result = await ufdrRuntimeApi.runSummary(payload);
        set((state) => {
          state.summaryCommand = result.commandLine;
          state.summaryOutput = result.output;
          state.activeTab = "summary";
        });
      } catch (error) {
        set((state) => {
          state.formError =
            error instanceof Error
              ? error.message
              : "Summary request failed";
        });
      } finally {
        set((state) => {
          state.busyAction = null;
        });
      }
    },

    handlePrimaryAction: async () => {
      const { form } = get();
      if (!get().getCanSubmit()) {
        set((state) => {
          state.formError =
            "Select a local UFDR or provide an S3 evidence id before starting the flow.";
        });
        return;
      }
      if (form.executionMode === "summary") {
        return get().handlePreviewSummary();
      }
      set((state) => {
        state.formError = null;
        state.busyAction = "run";
      });
      try {
        const payload = buildRequestPayload(form);
        const snapshot = await ufdrRuntimeApi.runJob(payload);
        set((state) => {
          state.job = snapshot;
          state.summaryOutput = "";
          state.summaryCommand = "";
        });
      } catch (error) {
        set((state) => {
          state.formError =
            error instanceof Error ? error.message : "Run request failed";
        });
      } finally {
        set((state) => {
          state.busyAction = null;
        });
      }
    },

    handleCancelRun: async () => {
      set((state) => {
        state.busyAction = "cancel";
      });
      try {
        const snapshot = await ufdrRuntimeApi.cancelJob();
        set((state) => {
          state.job = snapshot;
        });
      } catch (error) {
        set((state) => {
          state.formError =
            error instanceof Error ? error.message : "Cancel request failed";
        });
      } finally {
        set((state) => {
          state.busyAction = null;
        });
      }
    },

    handleReset: async () => {
      try {
        await ufdrRuntimeApi.reset();
        await Promise.all([get().loadJobStatus(), get().loadLocalFiles()]);
      } catch (error) {
        set((state) => {
          state.formError =
            error instanceof Error ? error.message : "Reset failed";
        });
      }
    },

    getIsRunning: () => get().job.status === "running",
    getCanSubmit: () => {
      const { form, localFiles } = get();
      if (form.sourceMode === "local") {
        return localFiles.some((f) => f.path === form.selectedLocalFile);
      }
      return Boolean(form.s3EvidenceId.trim());
    },
    getSelectedFileDetails: () => {
      const { form, localFiles } = get();
      return (
        localFiles.find((f) => f.path === form.selectedLocalFile) ?? null
      );
    },
  }))
);
