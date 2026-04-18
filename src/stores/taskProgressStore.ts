import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import {
  GenerationTaskStatus,
  TaskProgress,
  EventTypeProgress,
  isTerminalTaskStatus,
  getAggregateStatus,
} from "../types/taskProgress";
import { EventType } from "../types/cart";

// Enable Immer support for Map and Set
enableMapSet();

interface TaskProgressState {
  taskProgress: Map<string, TaskProgress>;
  pollingJobs: Set<string>;

  // Actions
  updateMultipleTaskProgress: (
    updates: Array<{
      taskId: string;
      status: GenerationTaskStatus;
      progress: number;
    }>
  ) => void;

  startJobPolling: (jobId: string, taskIds: string[]) => void;
  stopJobPolling: (jobId: string) => void;

  getTaskProgress: (taskId: string) => TaskProgress | undefined;

  getEventTypeProgress: (
    jobId: string,
    eventType: EventType,
    taskIds: string[]
  ) => EventTypeProgress;

  // Check if any tasks are still generating for a job
  hasActiveTasksForJob: (jobId: string, taskIds: string[]) => boolean;
}

export const useTaskProgressStore = create<TaskProgressState>()(
  immer((set, get) => ({
    taskProgress: new Map(),
    pollingJobs: new Set(),

    updateMultipleTaskProgress: (updates) => {
      set((state) => {
        const now = Date.now();
        for (const { taskId, status, progress } of updates) {
          state.taskProgress.set(taskId, {
            taskId,
            status,
            progress,
            lastUpdated: now,
            isPolling: !isTerminalTaskStatus(status),
          });
        }
      });
    },

    startJobPolling: (jobId, taskIds) => {
      set((state) => {
        state.pollingJobs.add(jobId);

        // Initialize progress for all tasks if not already present
        for (const taskId of taskIds) {
          if (!state.taskProgress.has(taskId)) {
            state.taskProgress.set(taskId, {
              taskId,
              status: "Pending",
              progress: 0,
              lastUpdated: Date.now(),
              isPolling: true,
            });
          }
        }
      });
    },

    stopJobPolling: (jobId) => {
      set((state) => {
        state.pollingJobs.delete(jobId);
      });
    },

    getTaskProgress: (taskId) => {
      return get().taskProgress.get(taskId);
    },

    getEventTypeProgress: (_jobId, eventType, taskIds) => {
      const state = get();
      const tasks = taskIds
        .map((id) => state.taskProgress.get(id))
        .filter((t): t is TaskProgress => t !== undefined);

      if (tasks.length === 0) {
        return {
          eventType,
          status: "Pending",
          progress: 0,
          totalTasks: taskIds.length,
          completedTasks: 0,
          generatingTasks: 0,
          failedTasks: 0,
        };
      }

      const statuses = tasks.map((t) => t.status);
      const aggregateStatus = getAggregateStatus(statuses);
      const totalProgress = tasks.reduce((sum, t) => sum + t.progress, 0);

      return {
        eventType,
        status: aggregateStatus,
        progress: tasks.length > 0 ? totalProgress / tasks.length : 0,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === "Done").length,
        generatingTasks: tasks.filter((t) => t.status === "Generating").length,
        failedTasks: tasks.filter(
          (t) => t.status === "Failed" || t.status === "Cancelled"
        ).length,
      };
    },

    hasActiveTasksForJob: (_jobId, taskIds) => {
      const state = get();
      return taskIds.some((taskId) => {
        const task = state.taskProgress.get(taskId);
        if (!task) return true; // No data yet = still active
        return !isTerminalTaskStatus(task.status);
      });
    },
  }))
);
