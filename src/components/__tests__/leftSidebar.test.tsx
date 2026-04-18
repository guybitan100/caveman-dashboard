import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils/test-utils";
import React from "react";

// Mock sidebar dependencies
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

vi.mock("../../hooks/useJobs", () => ({
  useDebounce: vi.fn((value: any) => value),
  useJobs: vi.fn().mockReturnValue({
    jobs: [{ id: "j1", name: "Job 1", status: "Draft", timestamp: "2024-01-01T00:00:00Z", user: "test@cellebrite.com" }],
    filteredJobs: [], selectedJob: null, isLoading: false,
    isLoadingMore: false, hasMore: false, isError: false, error: null,
    searchQuery: "", setSearchQuery: vi.fn(), selectJob: vi.fn(),
    createJob: vi.fn(), deleteJob: vi.fn(), loadMore: vi.fn(), refresh: vi.fn(),
  }),
}));

vi.mock("../../hooks/useSidebarJobs", () => ({
  useSidebarJobs: vi.fn().mockReturnValue({
    myDrafts: [
      { id: "j1", name: "My Draft", status: "Draft", timestamp: "2024-01-01T00:00:00Z", user: "test@cellebrite.com" },
    ],
    allJobs: [
      { id: "j2", name: "All Job", status: "Done", timestamp: "2024-01-01T00:00:00Z", user: "other@test.com" },
    ],
    myDraftsTotal: 1, allJobsTotal: 1,
    isLoadingDrafts: false, isLoadingAllJobs: false,
    isLoadingMoreDrafts: false, isLoadingMoreAllJobs: false,
    hasMoreDrafts: false, hasMoreAllJobs: false, isError: false,
    refresh: vi.fn(), loadMoreDrafts: vi.fn(), loadMoreAllJobs: vi.fn(),
  }),
}));

vi.mock("../../stores/jobStore", () => ({
  useJobStore: Object.assign(
    vi.fn((selector) => {
      const state = { selectedJobId: "j1", jobs: [], getSelectedJob: vi.fn().mockReturnValue(null), selectJob: vi.fn() };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({ selectedJobId: null }) }
  ),
  useSelectedJobStatus: vi.fn().mockReturnValue("Draft"),
}));

vi.mock("../../stores/cartStore", () => ({
  useCartStore: Object.assign(
    vi.fn((selector) => {
      const state = { getTotalItemCount: vi.fn().mockReturnValue(0), getSectionItemCount: vi.fn().mockReturnValue(0), isOpen: false, job: null, closeCart: vi.fn(), syncFromJob: vi.fn() };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({}) }
  ),
}));

vi.mock("../../api/jobsApi", () => ({
  jobsApi: { getJobs: vi.fn(), getJob: vi.fn(), createJob: vi.fn().mockResolvedValue({ id: "new1", name: "New", status: "Draft" }), deleteJob: vi.fn() },
}));

describe("LeftSidebar - Deep", () => {
  it("renders with jobs", async () => {
    const { LeftSidebar } = await import("../sidebar/LeftSidebar");
    const { container } = render(<LeftSidebar onJobSelect={vi.fn()} />);
    expect(container).toBeTruthy();
  });

  it("renders without onJobSelect", async () => {
    const { LeftSidebar } = await import("../sidebar/LeftSidebar");
    const { container } = render(<LeftSidebar />);
    expect(container).toBeTruthy();
  });
});
