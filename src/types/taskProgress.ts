export type GenerationTaskStatus =
  | "Pending"
  | "Generating"
  | "Done"
  | "Cancelled"
  | "Failed"
  | "Partial";

export interface TaskProgressResponse {
  task_id: string;
  status: GenerationTaskStatus;
  progress: number; // 0.0 to 1.0
}

export interface TaskProgress {
  taskId: string;
  status: GenerationTaskStatus;
  progress: number; // 0.0 to 1.0
  lastUpdated: number; // timestamp
  isPolling: boolean;
}

export interface EventTypeProgress {
  eventType: string;
  status: GenerationTaskStatus;
  progress: number; // 0.0 to 1.0
  totalTasks: number;
  completedTasks: number;
  generatingTasks: number;
  failedTasks: number;
}

/**
 * Job-level progress aggregation
 */
export interface JobProgress {
  jobId: string;
  status: GenerationTaskStatus;
  progress: number; // 0.0 to 1.0
  isPolling: boolean;
  lastUpdated: number;
}

export const TERMINAL_TASK_STATUSES: GenerationTaskStatus[] = [
  "Done",
  "Failed",
  "Cancelled",
  "Partial",
];

export function isTerminalTaskStatus(status: GenerationTaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.includes(status);
}

export const TASK_STATUS_PRIORITY: Record<GenerationTaskStatus, number> = {
  Failed: 0,
  Cancelled: 1,
  Generating: 2,
  Pending: 3,
  Partial: 4,
  Done: 5,
};

export function getAggregateStatus(
  statuses: GenerationTaskStatus[]
): GenerationTaskStatus {
  if (statuses.length === 0) return "Pending";

  return statuses.reduce((acc, status) =>
    TASK_STATUS_PRIORITY[status] < TASK_STATUS_PRIORITY[acc] ? status : acc
  );
}

export interface TaskStatusConfig {
  label: string;
  color: string;
  backgroundColor: string;
  animated?: boolean;
}

export const TASK_STATUS_CONFIG: Record<
  GenerationTaskStatus,
  TaskStatusConfig
> = {
  Pending: {
    label: "Pending",
    color: "#F59E0B",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  Generating: {
    label: "Generating",
    color: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    animated: true,
  },
  Done: {
    label: "Done",
    color: "#10B981",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  Failed: {
    label: "Failed",
    color: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  Cancelled: {
    label: "Cancelled",
    color: "#9CA3AF",
    backgroundColor: "rgba(156, 163, 175, 0.15)",
  },
  Partial: {
    label: "Partial",
    color: "#F59E0B",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
};
