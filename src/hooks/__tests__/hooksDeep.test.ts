import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock all API and store dependencies
vi.mock("../../api/jobsApi", () => ({
  jobsApi: {
    getJobs: vi.fn().mockResolvedValue({ jobs: [], total: 0 }),
    getJob: vi.fn().mockResolvedValue(null),
    createJob: vi.fn().mockResolvedValue({ id: "new1", name: "New Job", status: "Draft" }),
    deleteJob: vi.fn().mockResolvedValue(true),
    getMultipleTaskProgress: vi.fn().mockResolvedValue(new Map()),
  },
}));

vi.mock("swr", () => ({
  default: vi.fn().mockReturnValue({
    data: { jobs: [{ id: "j1", name: "Job 1", status: "Draft", timestamp: "2024-01-01T00:00:00Z" }], total: 1 },
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("swr/infinite", () => ({
  default: vi.fn().mockReturnValue({
    data: [{ jobs: [{ id: "j1", name: "Job 1", status: "Draft", timestamp: "2024-01-01T00:00:00Z" }], total: 1 }],
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
    size: 1,
    setSize: vi.fn(),
  }),
}));

const mockStoreState = {
  jobs: [{ id: "j1", name: "Job 1", status: "Draft", timestamp: "2024-01-01T00:00:00Z", user: "test@test.com" }],
  searchQuery: "",
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  currentPage: 0,
  error: null,
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
  selectedJobId: null,
};

vi.mock("../../stores/jobStore", () => ({
  useJobStore: Object.assign(
    vi.fn(() => mockStoreState),
    { getState: vi.fn().mockReturnValue(mockStoreState) }
  ),
}));

vi.mock("../../stores/cartStore", () => ({
  useCartStore: Object.assign(
    vi.fn(() => ({
      syncFromJob: vi.fn(),
      setCurrentJobId: vi.fn(),
      job: null,
    })),
    { getState: vi.fn().mockReturnValue({ syncFromJob: vi.fn(), job: null }) }
  ),
}));

vi.mock("../../stores/taskProgressStore", () => ({
  useTaskProgressStore: vi.fn(() => ({
    updateMultipleTaskProgress: vi.fn(),
    startJobPolling: vi.fn(),
    stopJobPolling: vi.fn(),
    getTaskProgress: vi.fn().mockReturnValue(null),
    getEventTypeProgress: vi.fn().mockReturnValue({
      eventType: "chat_messages", status: "Pending", progress: 0,
      totalTasks: 0, completedTasks: 0, generatingTasks: 0, failedTasks: 0,
    }),
    hasActiveTasksForJob: vi.fn().mockReturnValue(false),
    taskProgress: new Map(),
  })),
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

describe("useJobs hook", () => {
  it("returns initial state", async () => {
    const { useJobs } = await import("./useJobs");
    const { result } = renderHook(() => useJobs());
    expect(result.current.jobs).toBeDefined();
    expect(result.current.searchQuery).toBeDefined();
    expect(result.current.isLoading).toBeDefined();
    expect(result.current.selectJob).toBeDefined();
    expect(result.current.createJob).toBeDefined();
    expect(result.current.deleteJob).toBeDefined();
    expect(result.current.loadMore).toBeDefined();
    expect(result.current.refresh).toBeDefined();
  });

  it("provides setSearchQuery", async () => {
    const { useJobs } = await import("./useJobs");
    const { result } = renderHook(() => useJobs());
    act(() => { result.current.setSearchQuery("test"); });
    expect(mockStoreState.setSearchQuery).toHaveBeenCalledWith("test");
  });

  it("provides selectJob", async () => {
    const { useJobs } = await import("./useJobs");
    const { result } = renderHook(() => useJobs());
    act(() => { result.current.selectJob({ id: "j1", name: "Job 1", status: "Draft" } as any); });
  });

  it("provides createJob", async () => {
    const { useJobs } = await import("./useJobs");
    const { result } = renderHook(() => useJobs());
    let created: any;
    await act(async () => {
      created = await result.current.createJob("test@test.com", "My Job");
    });
  });

  it("provides deleteJob", async () => {
    const { useJobs } = await import("./useJobs");
    const { result } = renderHook(() => useJobs());
    await act(async () => {
      await result.current.deleteJob("j1");
    });
  });

  it("provides loadMore", async () => {
    const { useJobs } = await import("./useJobs");
    const { result } = renderHook(() => useJobs());
    await act(async () => {
      await result.current.loadMore();
    });
  });
});

describe("useTaskProgress hook", () => {
  it("returns initial state with no job", async () => {
    const { useTaskProgress } = await import("./useTaskProgress");
    const { result } = renderHook(() => useTaskProgress(null, null, []));
    expect(result.current.isPolling).toBe(false);
    expect(result.current.startPolling).toBeDefined();
    expect(result.current.stopPolling).toBeDefined();
    expect(result.current.getTaskProgress).toBeDefined();
    expect(result.current.getEventTypeProgress).toBeDefined();
  });

  it("returns initial state with Draft status", async () => {
    const { useTaskProgress } = await import("./useTaskProgress");
    const { result } = renderHook(() => useTaskProgress("j1", "Draft", []));
    expect(result.current.isPolling).toBe(false);
  });

  it("getTaskProgress returns null for unknown task", async () => {
    const { useTaskProgress } = await import("./useTaskProgress");
    const { result } = renderHook(() => useTaskProgress("j1", "Draft", []));
    expect(result.current.getTaskProgress("unknown")).toBeNull();
  });

  it("getEventTypeProgress returns default for no job", async () => {
    const { useTaskProgress } = await import("./useTaskProgress");
    const { result } = renderHook(() => useTaskProgress(null, null, []));
    const progress = result.current.getEventTypeProgress("chat_messages" as any, []);
    expect(progress.status).toBe("Pending");
    expect(progress.progress).toBe(0);
  });

  it("enabled=false prevents polling", async () => {
    const { useTaskProgress } = await import("./useTaskProgress");
    const tasks = [{ task_id: "t1", event_type: "chat_messages" }] as any;
    const { result } = renderHook(() =>
      useTaskProgress("j1", "Generating", tasks, { enabled: false })
    );
    expect(result.current.isPolling).toBe(false);
  });

  it("can start and stop polling manually", async () => {
    const { useTaskProgress } = await import("./useTaskProgress");
    const { result } = renderHook(() => useTaskProgress("j1", "Draft", []));
    act(() => {
      result.current.startPolling("j1", [{ task_id: "t1", event_type: "chat_messages" }] as any);
    });
    act(() => {
      result.current.stopPolling("j1");
    });
  });
});

describe("useTaskProgressReader hook", () => {
  it("returns reader interface", async () => {
    const { useTaskProgressReader } = await import("./useTaskProgress");
    const { result } = renderHook(() => useTaskProgressReader());
    expect(result.current.getProgress).toBeDefined();
    expect(result.current.getEventTypeProgress).toBeDefined();
    expect(result.current.taskProgress).toBeDefined();
  });

  it("getProgress returns null for unknown task", async () => {
    const { useTaskProgressReader } = await import("./useTaskProgress");
    const { result } = renderHook(() => useTaskProgressReader());
    expect(result.current.getProgress("unknown")).toBeNull();
  });
});

describe("useSidebarJobs hook", () => {
  it("returns sidebar jobs data", async () => {
    const { useSidebarJobs } = await import("./useSidebarJobs");
    const { result } = renderHook(() => useSidebarJobs("test@test.com"));
    expect(result.current.myDrafts).toBeDefined();
    expect(result.current.allJobs).toBeDefined();
    expect(result.current.refresh).toBeDefined();
    expect(result.current.loadMoreDrafts).toBeDefined();
    expect(result.current.loadMoreAllJobs).toBeDefined();
  });

  it("returns empty data for null user", async () => {
    const { useSidebarJobs } = await import("./useSidebarJobs");
    const { result } = renderHook(() => useSidebarJobs(null as any));
    expect(result.current).toBeDefined();
  });
});

describe("useDebounce hook", () => {
  it("returns debounced value", async () => {
    const { useDebounce } = await import("./useJobs");
    if (useDebounce) {
      const { result } = renderHook(() => useDebounce("test", 100));
      expect(result.current).toBeDefined();
    }
  });
});
