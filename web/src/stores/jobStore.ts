/**
 * Zustand store for managing jobs state.
 * Handles job selection, filtering, and real-time updates.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { JobSummary, JobStatus } from "../types/job.ts";

interface JobsState {
  // Jobs data
  jobs: JobSummary[];
  selectedJobId: string | null;

  // Pagination state
  currentPage: number;
  totalCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;

  // Search/filter state
  searchQuery: string;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  setJobs: (jobs: JobSummary[], total: number) => void;
  appendJobs: (jobs: JobSummary[]) => void;
  setCurrentPage: (page: number) => void;
  setLoadingMore: (loading: boolean) => void;
  addJob: (job: JobSummary) => void;
  updateJob: (id: string, updates: Partial<JobSummary>) => void;
  updateJobStatus: (id: string, status: JobStatus) => void;
  removeJob: (id: string) => void;
  selectJob: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed getters (as functions for immer compatibility)
  getFilteredJobs: () => JobSummary[];
  getSelectedJob: () => JobSummary | null;
}

export const useJobStore = create<JobsState>()(
  immer((set, get) => ({
    // Initial state
    jobs: [],
    selectedJobId: null,
    currentPage: 1,
    totalCount: 0,
    hasMore: true,
    isLoadingMore: false,
    searchQuery: "",
    isLoading: false,
    error: null,

    // Actions
    setJobs: (jobs, total) =>
      set((state) => {
        state.jobs = jobs;
        state.totalCount = total;
        state.currentPage = 1;
        state.hasMore = jobs.length < total;
      }),

    appendJobs: (jobs) =>
      set((state) => {
        // Filter out duplicates
        const existingIds = new Set(state.jobs.map((j) => j.id));
        const newJobs = jobs.filter((j) => !existingIds.has(j.id));
        state.jobs.push(...newJobs);
        state.hasMore = state.jobs.length < state.totalCount;
      }),

    setCurrentPage: (page) =>
      set((state) => {
        state.currentPage = page;
      }),

    setLoadingMore: (loading) =>
      set((state) => {
        state.isLoadingMore = loading;
      }),

    addJob: (job) =>
      set((state) => {
        // Add at the beginning (most recent first)
        state.jobs.unshift(job);
        state.totalCount += 1;
      }),

    updateJob: (id, updates) =>
      set((state) => {
        const jobIndex = state.jobs.findIndex((j) => j.id === id);
        if (jobIndex !== -1) {
          Object.assign(state.jobs[jobIndex], updates);
        }
      }),

    updateJobStatus: (id, status) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === id);
        if (job) {
          job.status = status;
        }
      }),

    removeJob: (id) =>
      set((state) => {
        state.jobs = state.jobs.filter((j) => j.id !== id);
        if (state.selectedJobId === id) {
          state.selectedJobId = null;
        }
      }),

    selectJob: (id) =>
      set((state) => {
        state.selectedJobId = id;
      }),

    setSearchQuery: (query) =>
      set((state) => {
        state.searchQuery = query;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
      }),

    // Computed getters
    getFilteredJobs: () => {
      // Filtering is now done on the backend via API
      return get().jobs;
    },

    getSelectedJob: () => {
      const { jobs, selectedJobId } = get();
      if (!selectedJobId) return null;
      return jobs.find((j) => j.id === selectedJobId) || null;
    },
  }))
);

/**
 * Selector hook to get the status of the currently selected job.
 * This is the single source of truth for job status.
 * Returns 'Draft' as fallback if no job is selected or job not found.
 */
export function useSelectedJobStatus(): JobStatus {
  return useJobStore((state) => {
    if (!state.selectedJobId) return "Draft";
    const job = state.jobs.find((j) => j.id === state.selectedJobId);
    return job?.status ?? "Draft";
  });
}
