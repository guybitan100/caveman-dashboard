import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../test/utils/test-utils";

// Mock all store hooks and dependencies
vi.mock("../../stores/conversationStore", () => ({
  useConversationStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        isConversationStarted: false,
        messages: [],
        isLoading: false,
        initialPrompt: "",
        isGenerating: false,
        generationProgress: {
          currentStep: null,
          steps: {},
          stepData: {},
          expandedSteps: {},
        },
        autoContinue: { isActive: false, remainingSeconds: 15, stepKey: null },
        editingStep: null,
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
    const state = {
      deviceModels: [],
      isLoading: false,
      isInitialized: true,
      error: null,
      initialize: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/downloadStore", () => ({
  useDownloadStore: vi.fn((selector) => {
    const state = {
      downloads: new Map(),
      addDownload: vi.fn(),
      updateDownload: vi.fn(),
      updateProgress: vi.fn(),
      removeDownload: vi.fn(),
      getActiveDownloads: vi.fn().mockReturnValue([]),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/metafinderStore", () => ({
  useMetaFinderStore: vi.fn((selector) => {
    const state = {
      isLoading: false,
      isInitialized: true,
      error: null,
      initialize: vi.fn(),
      getOptionsForEventType: vi.fn().mockReturnValue(null),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/taskProgressStore", () => ({
  useTaskProgressStore: vi.fn((selector) => {
    const state = {
      taskProgress: new Map(),
      updateMultipleTaskProgress: vi.fn(),
      startJobPolling: vi.fn(),
      stopJobPolling: vi.fn(),
      getTaskProgress: vi.fn(),
      getEventTypeProgress: vi.fn(),
      hasActiveTasksForJob: vi.fn(),
    };
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
  useMetaFinderInit: vi.fn().mockReturnValue({
    isLoading: false,
    isInitialized: true,
    error: null,
  }),
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
  default: vi.fn().mockReturnValue({
    job: null,
    context: null,
    tasks: [],
    stories: [],
    entities: [],
    ownerEntity: null,
    customEvents: [],
    totalItemCount: 0,
    getSectionItemCount: vi.fn().mockReturnValue(0),
    isOpen: false,
    expandedSections: {},
    isLoading: false,
    isSaving: false,
    error: null,
    currentJobId: null,
    openCart: vi.fn(),
    closeCart: vi.fn(),
    toggleCart: vi.fn(),
    toggleSection: vi.fn(),
    setCurrentJob: vi.fn(),
    setCurrentJobId: vi.fn(),
    syncCart: vi.fn(),
    updateDeviceContext: vi.fn(),
    updateOwnerEntity: vi.fn(),
    addEntity: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn(),
    addStory: vi.fn(),
    addStories: vi.fn(),
    updateStory: vi.fn(),
    deleteStory: vi.fn(),
    addCustomEvent: vi.fn(),
    updateCustomEvent: vi.fn(),
    deleteCustomEvent: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    createRandomEvents: vi.fn(),
    setError: vi.fn(),
    clearError: vi.fn(),
  }),
  useCart: vi.fn().mockReturnValue({
    job: null,
    context: null,
    tasks: [],
    stories: [],
    entities: [],
    ownerEntity: null,
    customEvents: [],
    totalItemCount: 0,
    getSectionItemCount: vi.fn().mockReturnValue(0),
    isOpen: false,
    expandedSections: {},
    isLoading: false,
    isSaving: false,
    error: null,
    currentJobId: null,
  }),
}));

vi.mock("../../hooks/useMetaFinder", () => ({
  useMetaFinderInit: vi.fn().mockReturnValue({
    isLoading: false,
    isInitialized: true,
    error: null,
  }),
  useMetaFinderOptions: vi.fn().mockReturnValue({
    options: null,
    isLoading: false,
    error: null,
  }),
  useMetaFinderStatus: vi.fn().mockReturnValue({
    isLoading: false,
    isInitialized: true,
    error: null,
  }),
}));

vi.mock("../../api/jobsApi", () => ({
  jobsApi: {
    getJobs: vi.fn().mockResolvedValue({ jobs: [], total: 0 }),
    getJob: vi.fn().mockResolvedValue({}),
    createJob: vi.fn().mockResolvedValue({ job_id: "new", name: "New" }),
    deleteJob: vi.fn().mockResolvedValue(undefined),
    getMultipleTaskProgress: vi.fn().mockResolvedValue(new Map()),
  },
}));

vi.mock("../../services/downloadService", () => ({
  downloadService: {
    downloadJob: vi.fn(),
    cancelDownload: vi.fn(),
  },
}));

vi.mock("swr", () => ({
  default: vi.fn().mockReturnValue({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("swr/infinite", () => ({
  default: vi.fn().mockReturnValue({
    data: undefined,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
    size: 1,
    setSize: vi.fn(),
  }),
}));

import React from "react";

describe("Component Smoke Tests - Icons", () => {
  it("renders AIStar", async () => {
    const { AIStar } = await import("../../components/icons/AiStar");
    const { container } = render(<AIStar />);
    expect(container).toBeTruthy();
  });

  it("renders AIStarSpinner", async () => {
    const { AIStarSpinner } = await import("../../components/icons/AiStarSpinner");
    const { container } = render(<AIStarSpinner />);
    expect(container).toBeTruthy();
  });

  it("renders ButtonIcon", async () => {
    const mod = await import("../../components/icons/ButtonIcon");
    const ButtonIcon = mod.default || mod.ButtonIcon;
    const { container } = render(<ButtonIcon />);
    expect(container).toBeTruthy();
  });

  it("renders SmallLogo", async () => {
    const { SmallLogo } = await import("../../components/icons/logo/SmallLogo");
    const { container } = render(<SmallLogo />);
    expect(container).toBeTruthy();
  });
});

describe("Component Smoke Tests - Layout", () => {
  it("renders AppLayout with children", async () => {
    const { AppLayout } = await import("../../components/layout/AppLayout");
    const { container } = render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );
    expect(container).toBeTruthy();
  });

  it("renders SplitScreenLayout", async () => {
    const { SplitScreenLayout } = await import("../../components/layout/SplitScreenLayout");
    const { container } = render(<SplitScreenLayout />);
    expect(container).toBeTruthy();
  });
});

describe("Component Smoke Tests - Home", () => {
  it("renders GenerateInput", async () => {
    const { GenerateInput } = await import("../../components/home/GenerateInput");
    const { container } = render(
      <GenerateInput value="" onChange={vi.fn()} onSubmit={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders HomeHeader", async () => {
    const { HomeHeader } = await import("../../components/home/HomeHeader");
    const { container } = render(<HomeHeader />);
    expect(container).toBeTruthy();
  });
});

describe("Component Smoke Tests - Shared", () => {
  it("renders GoButton", async () => {
    const { GoButton } = await import("../../components/shared/GoButton");
    const { container } = render(<GoButton onClick={vi.fn()} />);
    expect(container).toBeTruthy();
  });
});

describe("Component Smoke Tests - Sidebar", () => {
  it("renders LeftSidebar", async () => {
    const { LeftSidebar } = await import("../../components/sidebar/LeftSidebar");
    const { container } = render(<LeftSidebar />);
    expect(container).toBeTruthy();
  });

  it("renders ErrorState", async () => {
    const { ErrorState } = await import("../../components/sidebar/ErrorState");
    const { container } = render(<ErrorState message="Error occurred" onRetry={vi.fn()} />);
    expect(container).toBeTruthy();
  });

  it("renders LoadingState", async () => {
    const { LoadingState } = await import("../../components/sidebar/LoadingState");
    const { container } = render(<LoadingState />);
    expect(container).toBeTruthy();
  });

  it("renders NewJobDialog", async () => {
    const { NewJobDialog } = await import("../../components/sidebar/NewJobDialog");
    const { container } = render(
      <NewJobDialog open={false} onClose={vi.fn()} onCreateJob={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });
});

describe("Component Smoke Tests - Cart", () => {
  it("renders FloatingCartButton", async () => {
    const { FloatingCartButton } = await import("../../components/cart/FloatingCartButton");
    const { container } = render(<FloatingCartButton />);
    expect(container).toBeTruthy();
  });

  it("renders CartEmptyState", async () => {
    const { CartEmptyState } = await import("../../components/cart/CartEmptyState");
    const { container } = render(<CartEmptyState />);
    expect(container).toBeTruthy();
  });
});

describe("Component Smoke Tests - Download", () => {
  it("renders DownloadIndicator", async () => {
    const { DownloadIndicator } = await import("../../components/download/DownloadIndicator");
    const { container } = render(<DownloadIndicator />);
    expect(container).toBeTruthy();
  });
});

describe("Component Smoke Tests - Chat", () => {
  it("renders ChatPanel", async () => {
    const { ChatPanel } = await import("../../components/chat/ChatPanel");
    const { container } = render(<ChatPanel />);
    expect(container).toBeTruthy();
  });
});
