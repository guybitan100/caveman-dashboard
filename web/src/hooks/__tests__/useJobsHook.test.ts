import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock dependencies before importing
vi.mock("../../api/jobsApi", () => ({
  jobsApi: {
    getJobs: vi.fn().mockResolvedValue({ jobs: [], total: 0, page: 1, page_size: 20 }),
    getJob: vi.fn().mockResolvedValue({}),
    createJob: vi.fn().mockResolvedValue({ id: "new1", name: "New Job", status: "Draft" }),
    deleteJob: vi.fn().mockResolvedValue(undefined),
    getMultipleTaskProgress: vi.fn().mockResolvedValue(new Map()),
  },
}));

vi.mock("swr", () => ({
  default: vi.fn().mockReturnValue({
    data: { jobs: [{ id: "j1", name: "Job 1", status: "Draft", timestamp: "2024-01-01" }], total: 1, page: 1, page_size: 20 },
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("../../stores/jobStore", () => {
  const state = {
    jobs: [{ id: "j1", name: "Job 1", status: "Draft", timestamp: "2024-01-01" }],
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
    getFilteredJobs: vi.fn().mockReturnValue([{ id: "j1", name: "Job 1", status: "Draft" }]),
    getSelectedJob: vi.fn().mockReturnValue(null),
  };
  return {
    useJobStore: Object.assign(vi.fn(() => state), {
      getState: vi.fn().mockReturnValue(state),
    }),
  };
});

vi.mock("../../stores/cartStore", () => ({
  useCartStore: vi.fn(() => ({
    syncFromJob: vi.fn(),
    closeCart: vi.fn(),
  })),
}));

describe("useJobs hook", () => {
  it("returns jobs list", async () => {
    const { useJobs } = await import("../../hooks/useJobs");
    const { result } = renderHook(() => useJobs());
    expect(result.current.jobs).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("provides searchQuery and setSearchQuery", async () => {
    const { useJobs } = await import("../../hooks/useJobs");
    const { result } = renderHook(() => useJobs());
    expect(result.current.searchQuery).toBe("");
    expect(typeof result.current.setSearchQuery).toBe("function");
  });

  it("provides createJob function", async () => {
    const { useJobs } = await import("../../hooks/useJobs");
    const { result } = renderHook(() => useJobs());
    expect(typeof result.current.createJob).toBe("function");
  });

  it("provides deleteJob function", async () => {
    const { useJobs } = await import("../../hooks/useJobs");
    const { result } = renderHook(() => useJobs());
    expect(typeof result.current.deleteJob).toBe("function");
  });

  it("provides selectJob function", async () => {
    const { useJobs } = await import("../../hooks/useJobs");
    const { result } = renderHook(() => useJobs());
    expect(typeof result.current.selectJob).toBe("function");
  });

  it("provides refresh function", async () => {
    const { useJobs } = await import("../../hooks/useJobs");
    const { result } = renderHook(() => useJobs());
    expect(typeof result.current.refresh).toBe("function");
  });

  it("provides loadMore function", async () => {
    const { useJobs } = await import("../../hooks/useJobs");
    const { result } = renderHook(() => useJobs());
    expect(typeof result.current.loadMore).toBe("function");
  });
});

describe("useDebounce", () => {
  it("returns initial value immediately", async () => {
    const { useDebounce } = await import("../../hooks/useJobs");
    const { result } = renderHook(() => useDebounce("test", 300));
    expect(result.current).toBe("test");
  });
});
