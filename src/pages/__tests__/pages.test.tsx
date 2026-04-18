import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils/test-utils";
import React from "react";

// Mock all dependencies
vi.mock("../../stores/conversationStore", () => ({
  useConversationStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        isConversationStarted: false,
        messages: [],
        isLoading: false,
        initialPrompt: "",
        isGenerating: false,
        generationProgress: { currentStep: null, steps: {}, stepData: {}, expandedSteps: {} },
        autoContinue: { isActive: false, remainingSeconds: 15, stepKey: null },
        error: null,
        startConversation: vi.fn(),
        runPipeline: vi.fn(),
        resetConversation: vi.fn(),
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({}) }
  ),
}));

vi.mock("../../stores/cartStore", () => ({
  useCartStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        isOpen: false,
        job: null,
        currentJobId: null,
        openCart: vi.fn(),
        closeCart: vi.fn(),
        toggleCart: vi.fn(),
        syncFromJob: vi.fn(),
        setCurrentJob: vi.fn(),
        setIsLoading: vi.fn(),
        setError: vi.fn(),
        getTotalItemCount: vi.fn().mockReturnValue(0),
        getSectionItemCount: vi.fn().mockReturnValue(0),
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({ openCart: vi.fn(), setCurrentJob: vi.fn(), setIsLoading: vi.fn(), setError: vi.fn() }) }
  ),
}));

vi.mock("../../stores/jobStore", () => ({
  useJobStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        jobs: [],
        searchQuery: "",
        isLoading: false,
        isLoadingMore: false,
        hasMore: false,
        currentPage: 1,
        error: null,
        selectedJobId: null,
        setJobs: vi.fn(),
        appendJobs: vi.fn(),
        setCurrentPage: vi.fn(),
        setLoadingMore: vi.fn(),
        addJob: vi.fn(),
        updateJobStatus: vi.fn(),
        removeJob: vi.fn(),
        selectJob: vi.fn(),
        setSearchQuery: vi.fn(),
        setLoading: vi.fn(),
        setError: vi.fn(),
        getFilteredJobs: vi.fn().mockReturnValue([]),
        getSelectedJob: vi.fn().mockReturnValue(null),
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({ selectedJobId: null, jobs: [] }) }
  ),
  useSelectedJobStatus: vi.fn().mockReturnValue("Draft"),
}));

vi.mock("../../stores/deviceModelsStore", () => ({
  useDeviceModelsStore: vi.fn((selector) => {
    const state = { deviceModels: [], isLoading: false, isInitialized: true, error: null, initialize: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/downloadStore", () => ({
  useDownloadStore: vi.fn((selector) => {
    const state = { downloads: new Map(), addDownload: vi.fn(), updateDownload: vi.fn(), updateProgress: vi.fn(), removeDownload: vi.fn(), getActiveDownloads: vi.fn().mockReturnValue([]) };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/metafinderStore", () => ({
  useMetaFinderStore: vi.fn((selector) => {
    const state = { isLoading: false, isInitialized: true, error: null, initialize: vi.fn(), getOptionsForEventType: vi.fn().mockReturnValue(null) };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/taskProgressStore", () => ({
  useTaskProgressStore: vi.fn((selector) => {
    const state = { taskProgress: new Map(), updateMultipleTaskProgress: vi.fn(), startJobPolling: vi.fn(), stopJobPolling: vi.fn(), getTaskProgress: vi.fn(), getEventTypeProgress: vi.fn(), hasActiveTasksForJob: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../contexts", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../hooks", () => ({
  useMetaFinderInit: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
}));

vi.mock("../../hooks/useJobs", () => ({
  useDebounce: vi.fn((value: any) => value),
  useJobs: vi.fn().mockReturnValue({
    jobs: [],
    filteredJobs: [],
    selectedJob: null,
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    isError: false,
    error: null,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    selectJob: vi.fn(),
    createJob: vi.fn(),
    deleteJob: vi.fn(),
    loadMore: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("../../hooks/useSidebarJobs", () => ({
  useSidebarJobs: vi.fn().mockReturnValue({
    myDrafts: [],
    allJobs: [],
    myDraftsTotal: 0,
    allJobsTotal: 0,
    isLoadingDrafts: false,
    isLoadingAllJobs: false,
    isLoadingMoreDrafts: false,
    isLoadingMoreAllJobs: false,
    hasMoreDrafts: false,
    hasMoreAllJobs: false,
    isError: false,
    refresh: vi.fn(),
    loadMoreDrafts: vi.fn(),
    loadMoreAllJobs: vi.fn(),
  }),
}));

vi.mock("../../hooks/useTaskProgress", () => ({
  useTaskProgress: vi.fn().mockReturnValue({
    isPolling: false,
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    getTaskProgress: vi.fn(),
    getEventTypeProgress: vi.fn(),
  }),
  useTaskProgressReader: vi.fn().mockReturnValue({
    getProgress: vi.fn(),
    getEventTypeProgress: vi.fn(),
    taskProgress: new Map(),
  }),
}));

vi.mock("../../hooks/useCart", () => ({
  default: vi.fn().mockReturnValue({ job: null }),
  useCart: vi.fn().mockReturnValue({ job: null }),
}));

vi.mock("../../hooks/useMetaFinder", () => ({
  useMetaFinderInit: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
}));

vi.mock("../../api/jobsApi", () => ({
  jobsApi: {
    getJobs: vi.fn().mockResolvedValue({ jobs: [], total: 0 }),
    getJob: vi.fn().mockResolvedValue({}),
    createJob: vi.fn(),
    deleteJob: vi.fn(),
    getMultipleTaskProgress: vi.fn().mockResolvedValue(new Map()),
  },
}));

vi.mock("../../services/downloadService", () => ({
  downloadService: { downloadJob: vi.fn(), cancelDownload: vi.fn() },
}));

vi.mock("swr", () => ({
  default: vi.fn().mockReturnValue({ data: undefined, error: undefined, isLoading: false, mutate: vi.fn() }),
}));

vi.mock("swr/infinite", () => ({
  default: vi.fn().mockReturnValue({ data: undefined, error: undefined, isLoading: false, isValidating: false, mutate: vi.fn(), size: 1, setSize: vi.fn() }),
}));

describe("Page Smoke Tests", () => {
  it("renders LoginPage", async () => {
    const { LoginPage } = await import("../../pages/LoginPage");
    const { container } = render(<LoginPage />);
    expect(container).toBeTruthy();
    expect(container.querySelector("form")).toBeTruthy();
  });

  it("renders HomePage", async () => {
    const { HomePage } = await import("../../pages/HomePage");
    const { container } = render(<HomePage />);
    expect(container).toBeTruthy();
  });

  it("renders Animation", async () => {
    const { Animation } = await import("../../pages/Animation");
    const { container } = render(<Animation />);
    expect(container).toBeTruthy();
  });
});

describe("App Smoke Test", () => {
  it("renders App", async () => {
    const { App } = await import("../../App");
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });
});
