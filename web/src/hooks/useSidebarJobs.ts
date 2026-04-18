import useSWRInfinite from "swr/infinite";
import { useCallback, useMemo } from "react";
import { jobsApi } from "../api/jobsApi.ts";
import { useAuth } from "../contexts/AuthContext.tsx";
import { JobSummary, JobsListResponse } from "../types/job.ts";

const PAGE_SIZE = 20;

interface UseSidebarJobsReturn {
  myDrafts: JobSummary[];
  allJobs: JobSummary[];
  myDraftsTotal: number;
  allJobsTotal: number;
  isLoadingDrafts: boolean;
  isLoadingAllJobs: boolean;
  isLoadingMoreDrafts: boolean;
  isLoadingMoreAllJobs: boolean;
  hasMoreDrafts: boolean;
  hasMoreAllJobs: boolean;
  isError: boolean;
  refresh: () => void;
  loadMoreDrafts: () => void;
  loadMoreAllJobs: () => void;
}

export function useSidebarJobs(searchQuery?: string): UseSidebarJobsReturn {
  const { user } = useAuth();
  const currentUserEmail = user?.email;

  const getDraftsKey = useCallback(
    (pageIndex: number, previousPageData: JobsListResponse | null) => {
      if (!currentUserEmail) return null;
      if (previousPageData && previousPageData.jobs.length === 0) return null;
      return ["/jobs/my-drafts", currentUserEmail, searchQuery, pageIndex];
    },
    [currentUserEmail, searchQuery]
  );

  const getAllJobsKey = useCallback(
    (pageIndex: number, previousPageData: JobsListResponse | null) => {
      if (previousPageData && previousPageData.jobs.length === 0) return null;
      return ["/jobs/all", searchQuery, pageIndex];
    },
    [searchQuery]
  );

  const fetchDrafts = useCallback(
    async ([, , query, pageIndex]: [
      string,
      string,
      string | undefined,
      number
    ]): Promise<JobsListResponse> => {
      return jobsApi.getJobs({
        page: pageIndex + 1, // API uses 1-based pages
        page_size: PAGE_SIZE,
        status: "Draft",
        user: currentUserEmail,
        name: query || undefined,
      });
    },
    []
  );

  const fetchAllJobs = useCallback(
    async ([, query, pageIndex]: [
      string,
      string | undefined,
      number
    ]): Promise<JobsListResponse> => {
      return jobsApi.getJobs({
        page: pageIndex + 1, // API uses 1-based pages
        page_size: PAGE_SIZE,
        exclude_status: "Draft",
        name: query || undefined,
      });
    },
    []
  );

  const {
    data: draftsPages,
    error: draftsError,
    isLoading: isLoadingDrafts,
    isValidating: isValidatingDrafts,
    mutate: mutateDrafts,
    size: draftsSize,
    setSize: setDraftsSize,
  } = useSWRInfinite<JobsListResponse>(getDraftsKey, fetchDrafts, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    revalidateFirstPage: true,
    parallel: true, // Fetch pages in parallel for speed
  });

  const {
    data: allJobsPages,
    error: allJobsError,
    isLoading: isLoadingAllJobs,
    isValidating: isValidatingAllJobs,
    mutate: mutateAllJobs,
    size: allJobsSize,
    setSize: setAllJobsSize,
  } = useSWRInfinite<JobsListResponse>(getAllJobsKey, fetchAllJobs, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    revalidateFirstPage: true,
    parallel: true,
  });

  const sortJobs = useCallback((jobs: JobSummary[]): JobSummary[] => {
    return [...jobs].sort((a, b) => {
      const dateA = a.timestamp || "";
      const dateB = b.timestamp || "";
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, []);

  const myDrafts = useMemo(() => {
    if (!draftsPages) return [];
    const allJobs = draftsPages.flatMap((page) => page.jobs);
    return sortJobs(allJobs);
  }, [draftsPages, sortJobs]);

  const allJobs = useMemo(() => {
    if (!allJobsPages) return [];
    const jobs = allJobsPages.flatMap((page) => page.jobs);
    return sortJobs(jobs);
  }, [allJobsPages, sortJobs]);

  const myDraftsTotal = draftsPages?.[0]?.total || 0;
  const allJobsTotal = allJobsPages?.[0]?.total || 0;

  const hasMoreDrafts = myDrafts.length < myDraftsTotal;
  const hasMoreAllJobs = allJobs.length < allJobsTotal;

  const isLoadingMoreDrafts =
    isValidatingDrafts && draftsPages && draftsPages.length < draftsSize;
  const isLoadingMoreAllJobs =
    isValidatingAllJobs && allJobsPages && allJobsPages.length < allJobsSize;

  const refresh = useCallback(() => {
    mutateDrafts();
    mutateAllJobs();
  }, [mutateDrafts, mutateAllJobs]);

  const loadMoreDrafts = useCallback(() => {
    if (isValidatingDrafts || !hasMoreDrafts) return;
    setDraftsSize(draftsSize + 1);
  }, [isValidatingDrafts, hasMoreDrafts, draftsSize, setDraftsSize]);

  const loadMoreAllJobs = useCallback(() => {
    if (isValidatingAllJobs || !hasMoreAllJobs) return;
    setAllJobsSize(allJobsSize + 1);
  }, [isValidatingAllJobs, hasMoreAllJobs, allJobsSize, setAllJobsSize]);

  return {
    myDrafts,
    allJobs,
    myDraftsTotal,
    allJobsTotal,
    isLoadingDrafts,
    isLoadingAllJobs,
    isLoadingMoreDrafts: isLoadingMoreDrafts || false,
    isLoadingMoreAllJobs: isLoadingMoreAllJobs || false,
    hasMoreDrafts,
    hasMoreAllJobs,
    isError: !!(draftsError || allJobsError),
    refresh,
    loadMoreDrafts,
    loadMoreAllJobs,
  };
}
