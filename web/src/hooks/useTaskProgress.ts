import { useEffect, useRef, useCallback, useState } from "react";
import { jobsApi } from "../api/jobsApi";
import { useTaskProgressStore } from "../stores/taskProgressStore";
import { GenerationTaskStatus, EventTypeProgress } from "../types/taskProgress";
import { EventType, GenerationTask } from "../types/cart";
import { JobStatus } from "../types/job";

const POLLING_JOB_STATUSES: JobStatus[] = [
  "Generating",
  "Converting",
  "Finalizing",
];

/**
 * Get polling interval based on progress state
 * Relaxed polling to reduce server load
 */
function getPollingInterval(avgProgress: number): number {
  if (avgProgress < 0.2) return 2000; // 2s - Initial check
  if (avgProgress < 0.5) return 5000; // 5s - Normal
  if (avgProgress < 0.9) return 9000; // 9s - Slowing down
  return 15000; // 15s - Near completion
}

interface UseTaskProgressOptions {
  enabled?: boolean;
  /** Maximum polling duration in ms before auto-stop */
  maxPollingDuration?: number;
}

interface UseTaskProgressReturn {
  isPolling: boolean;
  startPolling: (jobId: string, tasks: GenerationTask[]) => void;
  stopPolling: (jobId: string) => void;
  getTaskProgress: (taskId: string) => {
    status: GenerationTaskStatus;
    progress: number;
  } | null;
  getEventTypeProgress: (
    eventType: EventType,
    tasks: GenerationTask[]
  ) => EventTypeProgress;
}

/**
 * Hook for polling task progress during job generation.
 * Automatically handles lifecycle, adaptive polling intervals, and cleanup.
 */
export function useTaskProgress(
  jobId: string | null,
  jobStatus: JobStatus | null,
  tasks: GenerationTask[],
  options: UseTaskProgressOptions = {}
): UseTaskProgressReturn {
  const {
    enabled = true,
    maxPollingDuration = 30 * 60 * 1000, // 30 minutes default
  } = options;

  const {
    updateMultipleTaskProgress,
    startJobPolling,
    stopJobPolling,
    getTaskProgress: storeGetTaskProgress,
    getEventTypeProgress: storeGetEventTypeProgress,
    hasActiveTasksForJob,
    taskProgress,
  } = useTaskProgressStore();

  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isVisibleRef = useRef(true);
  const isPollingRef = useRef(false); // Guard against multiple polling loops

  // Use refs for values that shouldn't trigger effect re-runs
  const jobIdRef = useRef(jobId);
  const tasksRef = useRef(tasks);
  const jobStatusRef = useRef(jobStatus);

  // Update refs when values change
  useEffect(() => {
    jobIdRef.current = jobId;
    tasksRef.current = tasks;
    jobStatusRef.current = jobStatus;
  }, [jobId, tasks, jobStatus]);

  // Track page visibility to pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Fetch progress for all tasks (uses refs for current values)
  const fetchAllTaskProgress = useCallback(async () => {
    const currentJobId = jobIdRef.current;
    const currentTasks = tasksRef.current;

    if (!currentJobId || currentTasks.length === 0) return;

    const taskIds = currentTasks.map((t) => t.task_id);

    try {
      const progressMap = await jobsApi.getMultipleTaskProgress(taskIds);

      const updates: Array<{
        taskId: string;
        status: GenerationTaskStatus;
        progress: number;
      }> = [];

      for (const [taskId, response] of progressMap) {
        updates.push({
          taskId,
          status: response.status,
          progress: response.progress,
        });
      }

      if (updates.length > 0) {
        updateMultipleTaskProgress(updates);
      }
    } catch (error) {
      console.error("Error fetching task progress:", error);
      // Continue polling on error - don't stop
    }
  }, [updateMultipleTaskProgress]);

  // Calculate average progress for interval adjustment (uses refs)
  const getAverageProgress = useCallback(() => {
    const currentTasks = tasksRef.current;
    if (currentTasks.length === 0) return 0;

    let totalProgress = 0;
    let count = 0;

    for (const task of currentTasks) {
      const progress = taskProgress.get(task.task_id);
      if (progress) {
        totalProgress += progress.progress;
        count++;
      }
    }

    return count > 0 ? totalProgress / count : 0;
  }, [taskProgress]);

  // Stop polling helper (defined first to be used in startPollingInternal)
  const stopPollingInternal = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    startTimeRef.current = null;
    isPollingRef.current = false;
    setIsPolling(false);

    const currentJobId = jobIdRef.current;
    if (currentJobId) {
      stopJobPolling(currentJobId);
    }
  }, [stopJobPolling]);

  // Start polling with adaptive interval (uses refs to avoid dependency issues)
  const startPollingInternal = useCallback(() => {
    const currentJobId = jobIdRef.current;

    // Guard: prevent multiple polling loops
    if (!currentJobId || isPollingRef.current) {
      return;
    }

    isPollingRef.current = true;
    startTimeRef.current = Date.now();
    setIsPolling(true);

    const poll = async () => {
      // Double-check we should still be polling
      if (!isPollingRef.current) {
        return;
      }

      // Check if we should continue polling
      if (!isVisibleRef.current) {
        // Page hidden, skip this poll but continue with longer interval
        pollingIntervalRef.current = setTimeout(poll, 15000);
        return;
      }

      // Check max duration
      if (
        startTimeRef.current &&
        Date.now() - startTimeRef.current > maxPollingDuration
      ) {
        console.log("Task polling exceeded max duration, stopping");
        stopPollingInternal();
        return;
      }

      await fetchAllTaskProgress();

      // Check if all tasks are in terminal state
      const currentTasks = tasksRef.current;
      const currentJob = jobIdRef.current;
      if (currentJob && currentTasks.length > 0) {
        const taskIds = currentTasks.map((t) => t.task_id);
        if (!hasActiveTasksForJob(currentJob, taskIds)) {
          console.log("All tasks complete, stopping polling");
          stopPollingInternal();
          return;
        }
      }

      // Calculate next interval based on progress
      const avgProgress = getAverageProgress();
      const nextInterval = getPollingInterval(avgProgress);

      // Only schedule next poll if still polling
      if (isPollingRef.current) {
        pollingIntervalRef.current = setTimeout(poll, nextInterval);
      }
    };

    // Initial fetch after a short delay (not immediately)
    pollingIntervalRef.current = setTimeout(poll, 1000);
  }, [
    maxPollingDuration,
    fetchAllTaskProgress,
    hasActiveTasksForJob,
    getAverageProgress,
    stopPollingInternal,
  ]);

  // Public start polling function
  const startPolling = useCallback(
    (jId: string, jobTasks: GenerationTask[]) => {
      const taskIds = jobTasks.map((t) => t.task_id);
      startJobPolling(jId, taskIds);
      startPollingInternal();
    },
    [startJobPolling, startPollingInternal]
  );

  // Public stop polling function
  const stopPolling = useCallback(
    (_jId: string) => {
      stopPollingInternal();
    },
    [stopPollingInternal]
  );

  // Auto-start/stop polling based on job status (minimal dependencies)
  useEffect(() => {
    if (!enabled || !jobId || !jobStatus) {
      if (isPollingRef.current) {
        stopPollingInternal();
      }
      return;
    }

    const shouldPoll =
      POLLING_JOB_STATUSES.includes(jobStatus) && tasks.length > 0;

    if (shouldPoll && !isPollingRef.current) {
      const taskIds = tasks.map((t) => t.task_id);
      startJobPolling(jobId, taskIds);
      startPollingInternal();
    } else if (!shouldPoll && isPollingRef.current) {
      stopPollingInternal();
    }

    return () => {
      // Cleanup on unmount
      if (isPollingRef.current) {
        stopPollingInternal();
      }
    };
  }, [
    enabled,
    jobId,
    jobStatus,
    tasks.length,
    startJobPolling,
    startPollingInternal,
    stopPollingInternal,
  ]);

  // Get progress for a specific task
  const getTaskProgress = useCallback(
    (taskId: string) => {
      const progress = storeGetTaskProgress(taskId);
      if (!progress) return null;
      return {
        status: progress.status,
        progress: progress.progress,
      };
    },
    [storeGetTaskProgress]
  );

  // Get aggregated progress for an event type
  const getEventTypeProgress = useCallback(
    (eventType: EventType, eventTasks: GenerationTask[]): EventTypeProgress => {
      if (!jobId) {
        return {
          eventType,
          status: "Pending",
          progress: 0,
          totalTasks: eventTasks.length,
          completedTasks: 0,
          generatingTasks: 0,
          failedTasks: 0,
        };
      }

      const taskIds = eventTasks.map((t) => t.task_id);
      return storeGetEventTypeProgress(jobId, eventType, taskIds);
    },
    [jobId, storeGetEventTypeProgress]
  );

  return {
    isPolling,
    startPolling,
    stopPolling,
    getTaskProgress,
    getEventTypeProgress,
  };
}

/**
 * Lightweight hook for components that only need to read task progress.
 * Does not manage polling - use with useTaskProgress in a parent component.
 */
export function useTaskProgressReader() {
  const { taskProgress, getEventTypeProgress } = useTaskProgressStore();

  const getProgress = useCallback(
    (taskId: string) => {
      const progress = taskProgress.get(taskId);
      if (!progress) return null;
      return {
        status: progress.status,
        progress: progress.progress,
      };
    },
    [taskProgress]
  );

  return {
    getProgress,
    getEventTypeProgress,
    taskProgress,
  };
}
