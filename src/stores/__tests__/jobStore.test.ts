/**
 * Tests for jobStore - Jobs List Management
 *
 * Priority: HIGH
 * These tests ensure proper management of the jobs list, filtering, and state updates.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useJobStore, useSelectedJobStatus } from "../jobStore";
import type { JobSummary } from "../../types/job";

describe("jobStore - Jobs List Management", () => {
  // Helper to create mock job summaries
  const createMockJob = (
    id: string,
    overrides?: Partial<JobSummary>
  ): JobSummary => ({
    id,
    name: `Job ${id}`,
    status: "Draft",
    timestamp: new Date().toISOString(),
    user: "test@example.com",
    ...overrides,
  });

  beforeEach(() => {
    // Reset store state before each test
    const store = useJobStore.getState();
    store.setJobs([], 0);
    store.selectJob(null);
    store.setSearchQuery("");
    store.setError(null);
    store.setLoading(false);
  });

  describe("Basic State Management", () => {
    it("should initialize with empty jobs list", () => {
      const { jobs, totalCount, selectedJobId } = useJobStore.getState();
      expect(jobs).toEqual([]);
      expect(totalCount).toBe(0);
      expect(selectedJobId).toBeNull();
    });

    it("should set jobs and total count", () => {
      const mockJobs = [
        createMockJob("job-1"),
        createMockJob("job-2"),
        createMockJob("job-3"),
      ];

      const { setJobs } = useJobStore.getState();
      setJobs(mockJobs, 10);

      const { jobs, totalCount, hasMore, currentPage } = useJobStore.getState();
      expect(jobs).toEqual(mockJobs);
      expect(totalCount).toBe(10);
      expect(hasMore).toBe(true); // 3 jobs < 10 total
      expect(currentPage).toBe(1);
    });

    it("should correctly set hasMore flag when all jobs are loaded", () => {
      const mockJobs = [createMockJob("job-1"), createMockJob("job-2")];

      const { setJobs } = useJobStore.getState();
      setJobs(mockJobs, 2);

      const { hasMore } = useJobStore.getState();
      expect(hasMore).toBe(false); // 2 jobs === 2 total
    });
  });

  describe("Job Addition", () => {
    it("should add new job to the beginning of list", () => {
      const existingJobs = [createMockJob("job-1"), createMockJob("job-2")];

      const { setJobs, addJob } = useJobStore.getState();
      setJobs(existingJobs, 2);

      const newJob = createMockJob("job-new", { name: "New Job" });
      addJob(newJob);

      const { jobs, totalCount } = useJobStore.getState();
      expect(jobs).toHaveLength(3);
      expect(jobs[0]).toEqual(newJob); // New job should be first
      expect(jobs[1].id).toBe("job-1");
      expect(jobs[2].id).toBe("job-2");
      expect(totalCount).toBe(3);
    });

    it("should increment totalCount when adding job", () => {
      const { setJobs, addJob } = useJobStore.getState();
      setJobs([], 0);

      addJob(createMockJob("job-1"));
      expect(useJobStore.getState().totalCount).toBe(1);

      addJob(createMockJob("job-2"));
      expect(useJobStore.getState().totalCount).toBe(2);
    });
  });

  describe("Job Updates", () => {
    beforeEach(() => {
      const mockJobs = [
        createMockJob("job-1", { name: "Original Name 1", status: "Draft" }),
        createMockJob("job-2", {
          name: "Original Name 2",
          status: "Generating",
        }),
        createMockJob("job-3", { name: "Original Name 3", status: "Done" }),
      ];
      useJobStore.getState().setJobs(mockJobs, 3);
    });

    it("should update job properties", () => {
      const { updateJob } = useJobStore.getState();
      updateJob("job-2", { name: "Updated Name", status: "Done" });

      const { jobs } = useJobStore.getState();
      const updatedJob = jobs.find((j) => j.id === "job-2");
      expect(updatedJob?.name).toBe("Updated Name");
      expect(updatedJob?.status).toBe("Done");

      // Other jobs should remain unchanged
      expect(jobs[0].name).toBe("Original Name 1");
      expect(jobs[2].name).toBe("Original Name 3");
    });

    it("should update job status independently", () => {
      const { updateJobStatus } = useJobStore.getState();
      updateJobStatus("job-1", "Generating");

      const { jobs } = useJobStore.getState();
      expect(jobs[0].status).toBe("Generating");
      expect(jobs[0].name).toBe("Original Name 1"); // Name unchanged
    });

    it("should handle updates to non-existent job gracefully", () => {
      const { updateJob } = useJobStore.getState();
      updateJob("non-existent", { name: "Should Not Crash" });

      const { jobs } = useJobStore.getState();
      expect(jobs).toHaveLength(3); // No change
    });
  });

  describe("Job Deletion", () => {
    beforeEach(() => {
      const mockJobs = [
        createMockJob("job-1"),
        createMockJob("job-2"),
        createMockJob("job-3"),
      ];
      useJobStore.getState().setJobs(mockJobs, 3);
    });

    it("should remove job from list", () => {
      const { removeJob } = useJobStore.getState();
      removeJob("job-2");

      const { jobs } = useJobStore.getState();
      expect(jobs).toHaveLength(2);
      expect(jobs.find((j) => j.id === "job-2")).toBeUndefined();
      expect(jobs[0].id).toBe("job-1");
      expect(jobs[1].id).toBe("job-3");
    });

    it("should clear selected job if deleted job was selected", () => {
      const { selectJob, removeJob } = useJobStore.getState();

      selectJob("job-2");
      expect(useJobStore.getState().selectedJobId).toBe("job-2");

      removeJob("job-2");

      const { selectedJobId, jobs } = useJobStore.getState();
      expect(selectedJobId).toBeNull();
      expect(jobs.find((j) => j.id === "job-2")).toBeUndefined();
    });

    it("should preserve selected job if different job is deleted", () => {
      const { selectJob, removeJob } = useJobStore.getState();

      selectJob("job-1");
      removeJob("job-2");

      expect(useJobStore.getState().selectedJobId).toBe("job-1");
    });
  });

  describe("Job Selection", () => {
    beforeEach(() => {
      const mockJobs = [
        createMockJob("job-1"),
        createMockJob("job-2"),
        createMockJob("job-3"),
      ];
      useJobStore.getState().setJobs(mockJobs, 3);
    });

    it("should select job by id", () => {
      const { selectJob, getSelectedJob } = useJobStore.getState();

      selectJob("job-2");

      const selectedJob = getSelectedJob();
      expect(selectedJob?.id).toBe("job-2");
      expect(useJobStore.getState().selectedJobId).toBe("job-2");
    });

    it("should clear selection when passing null", () => {
      const { selectJob, getSelectedJob } = useJobStore.getState();

      selectJob("job-2");
      expect(getSelectedJob()).not.toBeNull();

      selectJob(null);

      expect(getSelectedJob()).toBeNull();
      expect(useJobStore.getState().selectedJobId).toBeNull();
    });

    it("should return null for non-existent selected job", () => {
      const { selectJob, getSelectedJob } = useJobStore.getState();

      selectJob("non-existent");

      expect(getSelectedJob()).toBeNull();
    });
  });

  describe("Pagination", () => {
    it("should append jobs without duplicates", () => {
      const initialJobs = [createMockJob("job-1"), createMockJob("job-2")];

      const newJobs = [
        createMockJob("job-2"), // Duplicate
        createMockJob("job-3"), // New
        createMockJob("job-4"), // New
      ];

      const { setJobs, appendJobs } = useJobStore.getState();
      setJobs(initialJobs, 10);
      appendJobs(newJobs);

      const { jobs } = useJobStore.getState();
      expect(jobs).toHaveLength(4); // Should have job-1, job-2, job-3, job-4
      expect(jobs.map((j) => j.id)).toEqual([
        "job-1",
        "job-2",
        "job-3",
        "job-4",
      ]);
    });

    it("should update hasMore flag after appending jobs", () => {
      const { setJobs, appendJobs } = useJobStore.getState();
      setJobs([createMockJob("job-1")], 5);

      expect(useJobStore.getState().hasMore).toBe(true);

      appendJobs([
        createMockJob("job-2"),
        createMockJob("job-3"),
        createMockJob("job-4"),
        createMockJob("job-5"),
      ]);

      const { hasMore, jobs, totalCount } = useJobStore.getState();
      expect(jobs).toHaveLength(5);
      expect(totalCount).toBe(5);
      expect(hasMore).toBe(false); // All jobs loaded
    });

    it("should manage page number", () => {
      const { setCurrentPage, currentPage: initialPage } =
        useJobStore.getState();
      expect(initialPage).toBe(1);

      setCurrentPage(2);
      expect(useJobStore.getState().currentPage).toBe(2);

      setCurrentPage(5);
      expect(useJobStore.getState().currentPage).toBe(5);
    });

    it("should reset page to 1 when setting new jobs", () => {
      const { setCurrentPage, setJobs } = useJobStore.getState();

      setCurrentPage(3);
      expect(useJobStore.getState().currentPage).toBe(3);

      setJobs([createMockJob("job-1")], 1);
      expect(useJobStore.getState().currentPage).toBe(1);
    });

    it("should manage loadingMore state", () => {
      const { setLoadingMore, isLoadingMore: initial } = useJobStore.getState();
      expect(initial).toBe(false);

      setLoadingMore(true);
      expect(useJobStore.getState().isLoadingMore).toBe(true);

      setLoadingMore(false);
      expect(useJobStore.getState().isLoadingMore).toBe(false);
    });
  });

  describe("Search and Filtering", () => {
    it("should update search query", () => {
      const { setSearchQuery, searchQuery: initial } = useJobStore.getState();
      expect(initial).toBe("");

      setSearchQuery("test query");
      expect(useJobStore.getState().searchQuery).toBe("test query");

      setSearchQuery("");
      expect(useJobStore.getState().searchQuery).toBe("");
    });

    it("should return jobs from getFilteredJobs", () => {
      const mockJobs = [
        createMockJob("job-1", { name: "Test Job 1" }),
        createMockJob("job-2", { name: "Another Job" }),
        createMockJob("job-3", { name: "Test Job 3" }),
      ];

      const { setJobs, getFilteredJobs } = useJobStore.getState();
      setJobs(mockJobs, 3);

      const filtered = getFilteredJobs();
      expect(filtered).toEqual(mockJobs); // Filtering is done on backend, so returns all jobs
    });
  });

  describe("Loading and Error States", () => {
    it("should manage loading state", () => {
      const { setLoading, isLoading: initial } = useJobStore.getState();
      expect(initial).toBe(false);

      setLoading(true);
      expect(useJobStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useJobStore.getState().isLoading).toBe(false);
    });

    it("should manage error state", () => {
      const { setError, error: initial } = useJobStore.getState();
      expect(initial).toBeNull();

      setError("Network error");
      expect(useJobStore.getState().error).toBe("Network error");

      setError(null);
      expect(useJobStore.getState().error).toBeNull();
    });
  });

  describe("Data Integrity - Complex Scenarios", () => {
    it("should handle rapid job status updates", () => {
      const mockJobs = [
        createMockJob("job-1", { status: "Draft" }),
        createMockJob("job-2", { status: "Draft" }),
        createMockJob("job-3", { status: "Draft" }),
      ];

      const { setJobs, updateJobStatus } = useJobStore.getState();
      setJobs(mockJobs, 3);

      // Simulate rapid status updates (e.g., from WebSocket)
      updateJobStatus("job-1", "Pending");
      updateJobStatus("job-2", "Generating");
      updateJobStatus("job-1", "Generating");
      updateJobStatus("job-3", "Done");
      updateJobStatus("job-1", "Done");

      const { jobs } = useJobStore.getState();
      expect(jobs[0].status).toBe("Done");
      expect(jobs[1].status).toBe("Generating");
      expect(jobs[2].status).toBe("Done");
    });

    it("should maintain job order during updates", () => {
      const mockJobs = [
        createMockJob("job-1", { name: "First" }),
        createMockJob("job-2", { name: "Second" }),
        createMockJob("job-3", { name: "Third" }),
      ];

      const { setJobs, updateJob } = useJobStore.getState();
      setJobs(mockJobs, 3);

      // Update middle job
      updateJob("job-2", { name: "Updated Second" });

      const { jobs } = useJobStore.getState();
      expect(jobs[0].name).toBe("First");
      expect(jobs[1].name).toBe("Updated Second");
      expect(jobs[2].name).toBe("Third");
    });

    it("should handle multiple concurrent operations", () => {
      const initialJobs = [
        createMockJob("job-1", { status: "Draft" }),
        createMockJob("job-2", { status: "Generating" }),
      ];

      const { setJobs, addJob, updateJobStatus, removeJob, selectJob } =
        useJobStore.getState();
      setJobs(initialJobs, 2);

      // Perform multiple operations
      addJob(createMockJob("job-3", { status: "Draft" }));
      updateJobStatus("job-1", "Pending");
      selectJob("job-3");
      updateJobStatus("job-2", "Done");
      removeJob("job-1");

      const { jobs, selectedJobId } = useJobStore.getState();
      expect(jobs).toHaveLength(2);
      expect(jobs.find((j) => j.id === "job-2")?.status).toBe("Done");
      expect(jobs.find((j) => j.id === "job-3")).toBeDefined();
      expect(selectedJobId).toBe("job-3");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty job list operations", () => {
      const { updateJob, removeJob, getSelectedJob } = useJobStore.getState();

      // These should not crash with empty list
      updateJob("any-id", { name: "Test" });
      removeJob("any-id");
      const selected = getSelectedJob();

      expect(selected).toBeNull();
      expect(useJobStore.getState().jobs).toEqual([]);
    });

    it("should handle very long job lists", () => {
      const manyJobs = Array.from({ length: 1000 }, (_, i) =>
        createMockJob(`job-${i}`, { name: `Job ${i}` })
      );

      const { setJobs } = useJobStore.getState();
      setJobs(manyJobs, 1000);

      const { jobs, totalCount } = useJobStore.getState();
      expect(jobs).toHaveLength(1000);
      expect(totalCount).toBe(1000);
    });

    it("should handle job with null timestamp", () => {
      const jobWithNullTimestamp = createMockJob("job-1", { timestamp: null });

      const { setJobs } = useJobStore.getState();
      setJobs([jobWithNullTimestamp], 1);

      const { jobs } = useJobStore.getState();
      expect(jobs[0].timestamp).toBeNull();
    });
  });

  describe("useSelectedJobStatus Hook", () => {
    it("should return Draft when no job is selected", () => {
      const { result } = renderHook(() => useSelectedJobStatus());
      expect(result.current).toBe("Draft");
    });

    it("should return Draft when selected job is not found in list", () => {
      const { selectJob } = useJobStore.getState();
      selectJob("non-existent-job");

      const { result } = renderHook(() => useSelectedJobStatus());
      expect(result.current).toBe("Draft");
    });

    it("should return correct status for selected job", () => {
      const mockJobs = [
        createMockJob("job-1", { status: "Draft" }),
        createMockJob("job-2", { status: "Generating" }),
        createMockJob("job-3", { status: "Done" }),
      ];

      const { setJobs, selectJob } = useJobStore.getState();
      setJobs(mockJobs, 3);
      selectJob("job-2");

      const { result } = renderHook(() => useSelectedJobStatus());
      expect(result.current).toBe("Generating");
    });

    it("should update when status changes", () => {
      const mockJobs = [createMockJob("job-1", { status: "Draft" })];

      const { setJobs, selectJob, updateJobStatus } = useJobStore.getState();
      setJobs(mockJobs, 1);
      selectJob("job-1");

      const { result } = renderHook(() => useSelectedJobStatus());
      expect(result.current).toBe("Draft");

      act(() => {
        updateJobStatus("job-1", "Pending");
      });
      expect(result.current).toBe("Pending");

      act(() => {
        updateJobStatus("job-1", "Generating");
      });
      expect(result.current).toBe("Generating");

      act(() => {
        updateJobStatus("job-1", "Done");
      });
      expect(result.current).toBe("Done");
    });

    it("should update when selected job changes", () => {
      const mockJobs = [
        createMockJob("job-1", { status: "Draft" }),
        createMockJob("job-2", { status: "Done" }),
      ];

      const { setJobs, selectJob } = useJobStore.getState();
      setJobs(mockJobs, 2);
      selectJob("job-1");

      const { result } = renderHook(() => useSelectedJobStatus());
      expect(result.current).toBe("Draft");

      act(() => {
        selectJob("job-2");
      });
      expect(result.current).toBe("Done");

      act(() => {
        selectJob(null);
      });
      expect(result.current).toBe("Draft");
    });
  });
});
