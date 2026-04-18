import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils/test-utils";
import React from "react";

// Mock ufdr runtime store
vi.mock("../../stores/ufdrRuntimeStore", () => ({
  useUfdrRuntimeStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        activeTab: "builder" as const,
        form: {
          sourceMode: "local", executionMode: "full", modelMode: "uniform",
          selectedLocalFile: "", s3EvidenceId: "", outputPath: "/output",
          modelCopies: "1", uniformModelCount: "1", explicitModelCounts: "",
          excludeModelTypes: "", fileCopies: "1", scale: "1", audioSr: "16000",
          strDataRepeat: "1", uploadToS3: false, deleteExisting: false,
          noUpload: false, keepExtracted: false,
        },
        localFiles: [],
        job: { id: "r1", status: "idle", cancellationRequested: false, ufdrFile: null, logs: [], runId: null, startedAt: null, finishedAt: null, commandLine: null },
        latestSummary: null,
        inventory: [],
        pageError: null,
        formError: null,
        inventoryError: null,
        busyAction: null,
        consoleVisible: false,
        consolePoppedOut: false,
        summaryOutput: null,
        summaryCommand: null,
        systemStats: null,
        setTab: vi.fn(),
        setActiveTab: vi.fn(),
        updateField: vi.fn(),
        refreshLocalFiles: vi.fn(),
        runJob: vi.fn(),
        cancelJob: vi.fn(),
        previewSummary: vi.fn(),
        loadAppBoot: vi.fn(),
        loadLatestSummary: vi.fn(),
        loadInventory: vi.fn(),
        loadLocalFiles: vi.fn(),
        loadJobStatus: vi.fn(),
        loadSystemStats: vi.fn(),
        handlePreviewSummary: vi.fn(),
        handlePrimaryAction: vi.fn(),
        handleCancelRun: vi.fn(),
        toggleConsole: vi.fn(),
        togglePopout: vi.fn(),
        resetForm: vi.fn(),
        getIsRunning: vi.fn().mockReturnValue(false),
        getCanSubmit: vi.fn().mockReturnValue(false),
        getSelectedFileDetails: vi.fn().mockReturnValue(null),
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({}) }
  ),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false, login: vi.fn(), logout: vi.fn(),
  }),
}));

vi.mock("../../contexts", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false, login: vi.fn(), logout: vi.fn(),
  }),
}));

vi.mock("../../stores/downloadStore", () => ({
  useDownloadStore: vi.fn((selector) => {
    const state = { downloads: new Map(), getActiveDownloads: vi.fn().mockReturnValue([]), updateProgress: vi.fn(), addDownload: vi.fn(), removeDownload: vi.fn(), updateDownload: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/cartStore", () => ({
  useCartStore: Object.assign(
    vi.fn((selector) => {
      const state = { getTotalItemCount: vi.fn().mockReturnValue(0), getSectionItemCount: vi.fn().mockReturnValue(0), isOpen: false, job: null };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({}) }
  ),
}));

vi.mock("../../stores/jobStore", () => ({
  useJobStore: Object.assign(
    vi.fn((selector) => {
      const state = { selectedJobId: null, jobs: [], getSelectedJob: vi.fn().mockReturnValue(null) };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({}) }
  ),
  useSelectedJobStatus: vi.fn().mockReturnValue("Draft"),
}));

vi.mock("../../hooks/useJobs", () => ({
  useDebounce: vi.fn((value: any) => value),
  useJobs: vi.fn().mockReturnValue({
    jobs: [], filteredJobs: [], selectedJob: null, isLoading: false,
    searchQuery: "", setSearchQuery: vi.fn(), selectJob: vi.fn(),
    createJob: vi.fn(), deleteJob: vi.fn(), loadMore: vi.fn(), refresh: vi.fn(),
  }),
}));

describe("UfdrRuntimePage", () => {
  it("renders on builder tab", async () => {
    const { UfdrRuntimePage } = await import("../ufdr-runtime/UfdrRuntimePage");
    const { container } = render(<UfdrRuntimePage />);
    expect(container).toBeTruthy();
  });
});
