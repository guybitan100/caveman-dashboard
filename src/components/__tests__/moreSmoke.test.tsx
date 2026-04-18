import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils/test-utils";
import React from "react";

// Mock all stores
vi.mock("../../stores/cartStore", () => ({
  useCartStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        job: null,
        isOpen: false,
        currentJobId: null,
        expandedSections: { deviceContext: true, tasks: true, stories: false, entities: false, customEvents: false },
        isLoading: false,
        isSaving: false,
        error: null,
        openCart: vi.fn(),
        closeCart: vi.fn(),
        toggleCart: vi.fn(),
        toggleSection: vi.fn(),
        syncFromJob: vi.fn(),
        setCurrentJob: vi.fn(),
        setIsLoading: vi.fn(),
        setError: vi.fn(),
        clearError: vi.fn(),
        getTotalItemCount: vi.fn().mockReturnValue(0),
        getSectionItemCount: vi.fn().mockReturnValue(0),
        updateDeviceContext: vi.fn(),
        updateDeviceInfo: vi.fn(),
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
        selectedJobId: null,
        setJobs: vi.fn(),
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

vi.mock("../../stores/deviceModelsStore", () => ({
  useDeviceModelsStore: vi.fn((selector) => {
    const state = { deviceModels: [], isLoading: false, isInitialized: true, error: null, initialize: vi.fn() };
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
    const state = { taskProgress: new Map(), getTaskProgress: vi.fn(), getEventTypeProgress: vi.fn(), hasActiveTasksForJob: vi.fn() };
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
}));

vi.mock("../../contexts", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../../hooks/useCart", () => ({
  default: vi.fn().mockReturnValue({
    job: null, context: null, tasks: [], stories: [], entities: [], ownerEntity: null,
    customEvents: [], totalItemCount: 0, getSectionItemCount: vi.fn().mockReturnValue(0),
    isOpen: false, expandedSections: {}, isLoading: false, isSaving: false, error: null,
    currentJobId: null, openCart: vi.fn(), closeCart: vi.fn(), toggleCart: vi.fn(),
    toggleSection: vi.fn(), setCurrentJob: vi.fn(), syncCart: vi.fn(),
    updateDeviceContext: vi.fn(), updateOwnerEntity: vi.fn(),
    addEntity: vi.fn(), updateEntity: vi.fn(), deleteEntity: vi.fn(),
    addStory: vi.fn(), addStories: vi.fn(), updateStory: vi.fn(), deleteStory: vi.fn(),
    addCustomEvent: vi.fn(), updateCustomEvent: vi.fn(), deleteCustomEvent: vi.fn(),
    addTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(),
    createRandomEvents: vi.fn(), setError: vi.fn(), clearError: vi.fn(),
  }),
  useCart: vi.fn().mockReturnValue({ job: null }),
}));

vi.mock("../../hooks/useJobs", () => ({
  useDebounce: vi.fn((value: any) => value),
  useJobs: vi.fn().mockReturnValue({
    jobs: [], filteredJobs: [], selectedJob: null, isLoading: false,
    isLoadingMore: false, hasMore: false, isError: false, error: null,
    searchQuery: "", setSearchQuery: vi.fn(), selectJob: vi.fn(),
    createJob: vi.fn(), deleteJob: vi.fn(), loadMore: vi.fn(), refresh: vi.fn(),
  }),
}));

vi.mock("../../hooks/useSidebarJobs", () => ({
  useSidebarJobs: vi.fn().mockReturnValue({
    myDrafts: [], allJobs: [], myDraftsTotal: 0, allJobsTotal: 0,
    isLoadingDrafts: false, isLoadingAllJobs: false,
    isLoadingMoreDrafts: false, isLoadingMoreAllJobs: false,
    hasMoreDrafts: false, hasMoreAllJobs: false, isError: false,
    refresh: vi.fn(), loadMoreDrafts: vi.fn(), loadMoreAllJobs: vi.fn(),
  }),
}));

vi.mock("../../hooks/useTaskProgress", () => ({
  useTaskProgress: vi.fn().mockReturnValue({
    isPolling: false, startPolling: vi.fn(), stopPolling: vi.fn(),
    getTaskProgress: vi.fn(), getEventTypeProgress: vi.fn(),
  }),
  useTaskProgressReader: vi.fn().mockReturnValue({
    getProgress: vi.fn(), getEventTypeProgress: vi.fn(), taskProgress: new Map(),
  }),
}));

vi.mock("../../hooks/useMetaFinder", () => ({
  useMetaFinderInit: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
  useMetaFinderOptions: vi.fn().mockReturnValue({ options: null, isLoading: false, error: null }),
  useMetaFinderStatus: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
}));

vi.mock("../../api/jobsApi", () => ({
  jobsApi: {
    getJobs: vi.fn().mockResolvedValue({ jobs: [], total: 0 }),
    getJob: vi.fn().mockResolvedValue({}),
    createJob: vi.fn(), deleteJob: vi.fn(),
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

describe("Cart Sections Smoke Tests", () => {
  it("renders TasksSection", async () => {
    const { TasksSection } = await import("../cart/sections/TasksSection");
    const { container } = render(<TasksSection />);
    expect(container).toBeTruthy();
  });

  it("renders EntitiesSection", async () => {
    const { EntitiesSection } = await import("../cart/sections/EntitiesSection");
    const { container } = render(<EntitiesSection />);
    expect(container).toBeTruthy();
  });

  it("renders CustomEventsSection", async () => {
    const { CustomEventsSection } = await import("../cart/sections/CustomEventsSection");
    const { container } = render(<CustomEventsSection />);
    expect(container).toBeTruthy();
  });

  it("renders StoriesSection", async () => {
    const mod = await import("../cart/sections/StoriesSection");
    const StoriesSection = mod.StoriesSection || mod.default;
    if (StoriesSection) {
      const { container } = render(<StoriesSection />);
      expect(container).toBeTruthy();
    }
  });

  it("renders sharedStyles (exports exist)", async () => {
    const mod = await import("../cart/sections/sharedStyles");
    expect(mod).toBeTruthy();
  });
});

describe("Cart Dialogs Smoke Tests", () => {
  it("renders EntityFormDialog closed", async () => {
    const { EntityFormDialog } = await import("../cart/dialogs/EntityFormDialog");
    const { container } = render(
      <EntityFormDialog open={false} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders StoryTypeDialog closed", async () => {
    const { StoryTypeDialog } = await import("../cart/dialogs/StoryTypeDialog");
    const { container } = render(
      <StoryTypeDialog open={false} onClose={vi.fn()} onSelectType={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });
});

describe("Sidebar Smoke Tests", () => {
  it("renders VirtualJobsList", async () => {
    const { VirtualJobsList } = await import("../sidebar/VirtualJobsList");
    const { container } = render(
      <VirtualJobsList
        myDrafts={[]}
        allJobs={[]}
        myDraftsTotal={0}
        allJobsTotal={0}
        selectedJobId={null}
        onSelectJob={vi.fn()}
        isSearching={false}
        searchQuery=""
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("Story Chat Smoke Tests", () => {
  it("renders StoryChatMessages", async () => {
    const { StoryChatMessages } = await import("../story-chat/StoryChatMessages");
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    const { container } = render(
      <StoryChatMessages
        groupedMessages={[]}
        messagesEndRef={ref}
        onEditMessage={vi.fn()}
        onDeleteMessage={vi.fn()}
        getEntityDisplayName={vi.fn().mockReturnValue("John")}
        isOwner={vi.fn().mockReturnValue(false)}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("Ufdr Runtime Smoke Tests", () => {
  it("renders LaunchTab", async () => {
    const { LaunchTab } = await import("../ufdr-runtime/LaunchTab");
    const { container } = render(
      <LaunchTab
        job={{ id: "j1", status: "idle", cancellationRequested: false, ufdrFile: null, logs: [], runId: null, startedAt: null, finishedAt: null } as any}
        form={{
          sourceMode: "local", executionMode: "full", modelMode: "uniform",
          selectedLocalFile: "", s3EvidenceId: "", outputPath: "/tmp",
          modelCopies: "1", uniformModelCount: "1", explicitModelCounts: "",
          excludeModelTypes: "", fileCopies: "1", scale: "1", audioSr: "16000",
          strDataRepeat: "1", uploadToS3: false, deleteExisting: false,
          noUpload: false, keepExtracted: false,
        } as any}
        selectedFileDetails={null}
        isRunning={false}
        canSubmit={false}
        busyAction={null}
        consoleVisible={false}
        consolePoppedOut={false}
        onPrimaryAction={vi.fn()}
        onPreviewSummary={vi.fn()}
        onCancelRun={vi.fn()}
        onToggleConsole={vi.fn()}
        onTogglePopout={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("Background Icon", () => {
  it("renders Background SVG", async () => {
    const { Background } = await import("../icons/Background");
    const { container } = render(<Background />);
    expect(container).toBeTruthy();
  });
});
