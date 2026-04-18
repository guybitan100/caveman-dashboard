import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../../api/jobsApi", () => ({
  jobsApi: {
    getJobs: vi.fn().mockResolvedValue({ jobs: [], total: 0, page: 1, page_size: 20 }),
  },
}));

vi.mock("swr/infinite", () => ({
  default: vi.fn().mockReturnValue({
    data: [{ jobs: [{ id: "j1", name: "Draft Job", status: "Draft", timestamp: "2024-01-01", user: "user@test.com" }], total: 1 }],
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
    size: 1,
    setSize: vi.fn(),
  }),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "user@test.com", firstName: "Test", lastName: "User" },
    isLoading: false, login: vi.fn(), logout: vi.fn(),
  }),
}));

describe("useSidebarJobs hook", () => {
  it("returns drafts and allJobs", async () => {
    const { useSidebarJobs } = await import("../../hooks/useSidebarJobs");
    const { result } = renderHook(() => useSidebarJobs());
    expect(result.current.myDrafts).toBeDefined();
    expect(result.current.allJobs).toBeDefined();
  });

  it("returns loading states", async () => {
    const { useSidebarJobs } = await import("../../hooks/useSidebarJobs");
    const { result } = renderHook(() => useSidebarJobs());
    expect(result.current.isLoadingDrafts).toBe(false);
    expect(result.current.isLoadingAllJobs).toBe(false);
  });

  it("returns totals", async () => {
    const { useSidebarJobs } = await import("../../hooks/useSidebarJobs");
    const { result } = renderHook(() => useSidebarJobs());
    expect(result.current.myDraftsTotal).toBeDefined();
    expect(result.current.allJobsTotal).toBeDefined();
  });

  it("provides refresh function", async () => {
    const { useSidebarJobs } = await import("../../hooks/useSidebarJobs");
    const { result } = renderHook(() => useSidebarJobs());
    expect(typeof result.current.refresh).toBe("function");
  });

  it("provides loadMore functions", async () => {
    const { useSidebarJobs } = await import("../../hooks/useSidebarJobs");
    const { result } = renderHook(() => useSidebarJobs());
    expect(typeof result.current.loadMoreDrafts).toBe("function");
    expect(typeof result.current.loadMoreAllJobs).toBe("function");
  });

  it("returns hasMore flags", async () => {
    const { useSidebarJobs } = await import("../../hooks/useSidebarJobs");
    const { result } = renderHook(() => useSidebarJobs());
    expect(typeof result.current.hasMoreDrafts).toBe("boolean");
    expect(typeof result.current.hasMoreAllJobs).toBe("boolean");
  });

  it("accepts searchQuery parameter", async () => {
    const { useSidebarJobs } = await import("../../hooks/useSidebarJobs");
    const { result } = renderHook(() => useSidebarJobs("search term"));
    expect(result.current.myDrafts).toBeDefined();
  });
});
