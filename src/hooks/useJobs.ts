import useSWR from "swr";
import { useCallback, useEffect, useRef, useState } from "react";
import { jobsApi } from "../api/jobsApi.ts";
import { useJobStore } from "../stores/jobStore.ts";
import { useCartStore } from "../stores/cartStore.ts";
import { JobSummary, JobsListResponse } from "../types/job.ts";

/**
 * Sort jobs by timestamp (most recent first).
 */
function sortJobsByTimestamp(jobs: JobSummary[]): JobSummary[] {
  return [...jobs].sort((a, b) => {
    const dateA = a.timestamp || "";
    const dateB = b.timestamp || "";
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
}

interface UseJobsReturn {
  jobs: JobSummary[];
  filteredJobs: JobSummary[];
  selectedJob: JobSummary | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  isError: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectJob: (job: JobSummary | null) => void;
  createJob: (user: string, name?: string) => Promise<JobSummary | null>;
  deleteJob: (id: string) => Promise<boolean>;
  loadMore: () => Promise<void>;
  refresh: () => void;
}

export function useJobs(): UseJobsReturn {
  const {
    jobs,
    searchQuery,
    isLoading: storeLoading,
    isLoadingMore,
    hasMore,
    currentPage,
    error: storeError,
    setJobs,
    appendJobs,
    setCurrentPage,
    setLoadingMore,
    addJob,
    updateJobStatus,
    removeJob,
    selectJob: storeSelectJob,
    setSearchQuery: storeSetSearchQuery,
    setLoading,
    setError,
    getFilteredJobs,
    getSelectedJob,
  } = useJobStore();

  const { syncFromJob, closeCart } = useCartStore();

  // Debounce search query for API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Create fetcher that includes search query
  const fetcherWithSearch = useCallback(async (): Promise<JobsListResponse> => {
    return jobsApi.getJobs({
      page: 1,
      name: debouncedSearchQuery || undefined,
    });
  }, [debouncedSearchQuery]);

  // SWR for data fetching with polling fallback
  // Key includes search query so it refetches when search changes
  const { data, error, isLoading, mutate } = useSWR<JobsListResponse>(
    ["/jobs", debouncedSearchQuery],
    fetcherWithSearch,
    {
      refreshInterval: 5000, // Poll every 5 seconds as fallback
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Track if we've done initial auto-selection
  const hasAutoSelectedRef = useRef(false);

  // Sync SWR data to store
  useEffect(() => {
    if (data?.jobs) {
      const sortedJobs = sortJobsByTimestamp(data.jobs);
      setJobs(sortedJobs, data.total);

      // Auto-select the first draft job on initial load
      const currentSelectedId = useJobStore.getState().selectedJobId;
      if (
        !hasAutoSelectedRef.current &&
        !currentSelectedId &&
        sortedJobs.length > 0
      ) {
        const firstDraftJob = sortedJobs.find((job) => job.status === "Draft");
        if (firstDraftJob) {
          hasAutoSelectedRef.current = true;
          // Use setTimeout to avoid state update during render
          setTimeout(() => {
            storeSelectJob(firstDraftJob.id);
            // Fetch full job data and sync to cart, then open cart
            jobsApi
              .getJob(firstDraftJob.id)
              .then((jobData) => {
                syncFromJob(jobData);
                useCartStore.getState().openCart();
              })
              .catch((err) => {
                console.error("Failed to fetch job for auto-select:", err);
              });
          }, 0);
        }
      }
    }
  }, [data, setJobs, storeSelectJob, syncFromJob]);

  // Sync loading state
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Sync error state
  useEffect(() => {
    if (error) {
      setError(error.message || "Failed to fetch jobs");
    } else {
      setError(null);
    }
  }, [error, setError]);

  // Create new job
  const createJob = useCallback(
    async (user: string, name?: string): Promise<JobSummary | null> => {
      try {
        const response = await jobsApi.createJob(user, name);

        const newJob: JobSummary = {
          id: response.job_id,
          name: response.name,
          status: response.status,
          timestamp: new Date().toISOString(),
          user,
        };
        addJob(newJob);
        storeSelectJob(newJob.id);

        // Sync the full job data to cart store
        syncFromJob(response);

        // Refresh the list to get accurate data from server
        mutate();
        return newJob;
      } catch (err) {
        console.error("Failed to create job:", err);
        setError("Failed to create job");
        return null;
      }
    },
    [addJob, storeSelectJob, setError, mutate, syncFromJob]
  );

  // Load more jobs (next page)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const response = await jobsApi.getJobs({
        page: nextPage,
        name: debouncedSearchQuery || undefined,
      });

      // Sort by timestamp (most recent first)
      const sortedJobs = sortJobsByTimestamp(response.jobs);

      appendJobs(sortedJobs);
      setCurrentPage(nextPage);
    } catch (err) {
      console.error("Failed to load more jobs:", err);
      setError("Failed to load more jobs");
    } finally {
      setLoadingMore(false);
    }
  }, [
    currentPage,
    isLoadingMore,
    hasMore,
    debouncedSearchQuery,
    appendJobs,
    setCurrentPage,
    setLoadingMore,
    setError,
  ]);

  // Refresh jobs list
  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const deleteJob = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await jobsApi.deleteJob(id);
        removeJob(id);

        const currentSelectedId = useJobStore.getState().selectedJobId;
        if (currentSelectedId === id) {
          closeCart();
        }

        mutate();
        return true;
      } catch (err) {
        console.error("Failed to delete job:", err);
        setError("Failed to delete job");
        return false;
      }
    },
    [removeJob, closeCart, mutate, setError]
  );

  // Select job and sync to cart
  const selectJob = useCallback(
    async (jobOrNull: JobSummary | null) => {
      const cartStore = useCartStore.getState();

      if (!jobOrNull) {
        // Clear selection
        storeSelectJob(null);
        cartStore.setCurrentJob(null);
        return;
      }

      const id = jobOrNull.id;

      // Ensure the job is in jobStore so useSelectedJobStatus can find it
      // This handles cases where the job comes from a different list (e.g., allJobs from sidebar)
      const existingJob = useJobStore.getState().jobs.find((j) => j.id === id);
      if (!existingJob) {
        // Add the job to the store
        addJob(jobOrNull);
      } else if (existingJob.status !== jobOrNull.status) {
        // Update status if it differs (e.g., job status changed)
        updateJobStatus(id, jobOrNull.status);
      }

      storeSelectJob(id);

      // Clear previous job and show loading state
      cartStore.setCurrentJob(null);
      cartStore.setIsLoading(true);

      // Open the cart immediately when a job is selected
      cartStore.openCart();

      // Fetch the full job data and sync to cart
      try {
        const jobData = await jobsApi.getJob(id);

        // Sync job data to cart store
        // Status is now derived from jobStore via useSelectedJobStatus hook
        syncFromJob(jobData);

        cartStore.setError(null);
      } catch (err) {
        console.error("Failed to fetch job for cart:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load job data";
        cartStore.setError(errorMessage);
      } finally {
        cartStore.setIsLoading(false);
      }
    },
    [storeSelectJob, syncFromJob, addJob, updateJobStatus]
  );

  return {
    jobs,
    filteredJobs: getFilteredJobs(),
    selectedJob: getSelectedJob(),
    isLoading: isLoading || storeLoading,
    isLoadingMore,
    hasMore,
    isError: !!error,
    error: storeError,
    searchQuery,
    setSearchQuery: storeSetSearchQuery,
    selectJob,
    createJob,
    deleteJob,
    loadMore,
    refresh,
  };
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
