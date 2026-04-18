/**
 * TypeScript types for the Jobs panel.
 * These types mirror the backend models from model/status.py and six_db/jobs/models.py
 */

import { Theme } from "@mui/material/styles";
import { palette } from "../theme/palette";

export type JobStatus =
  | "Draft"
  | "Pending"
  | "Generating"
  | "Converting"
  | "Finalizing"
  | "Done"
  | "Cancelled"
  | "Failed"
  | "Deleted";

/**
 * Simplified job summary for list views - contains only essential fields.
 * Matches the JobSummary model from model/common.py
 */
export interface JobSummary {
  id: string;
  name: string;
  status: JobStatus;
  timestamp: string | null;
  user: string;
}

export interface CreateDraftJobRequest {
  name?: string;
  user: string;
}

export interface JobsListResponse {
  jobs: JobSummary[];
  total: number;
}

export interface GetJobsParams {
  page: number;
  page_size?: number;
  name?: string;
  status?: JobStatus;
  exclude_status?: JobStatus;
  user?: string;
  event_type?: string;
}

export interface JobStatusUpdateMessage {
  type: "status_change";
  job_id: string;
  status: JobStatus;
}

export interface JobStatusConfig {
  label: string;
  color: string;
  backgroundColor: string;
  icon: string;
  animated?: boolean;
}

export const JOB_STATUS_CONFIG: Record<JobStatus, JobStatusConfig> = {
  Draft: {
    label: "Draft",
    color: palette.status.draft.main,
    backgroundColor: palette.status.draft.background,
    icon: "○",
  },
  Pending: {
    label: "Pending",
    color: palette.status.warning.main,
    backgroundColor: palette.status.warning.background,
    icon: "⏳",
  },
  Generating: {
    label: "Generating",
    color: palette.status.info.main,
    backgroundColor: palette.status.info.background,
    icon: "●",
    animated: true,
  },
  Converting: {
    label: "Converting",
    color: palette.status.converting.main,
    backgroundColor: palette.status.converting.background,
    icon: "●",
    animated: true,
  },
  Finalizing: {
    label: "Finalizing",
    color: palette.status.finalizing.main,
    backgroundColor: palette.status.finalizing.background,
    icon: "●",
    animated: true,
  },
  Done: {
    label: "Done",
    color: palette.status.success.dark,
    backgroundColor: palette.status.success.background,
    icon: "✓",
  },
  Cancelled: {
    label: "Cancelled",
    color: palette.status.cancelled.main,
    backgroundColor: palette.status.cancelled.background,
    icon: "○",
  },
  Failed: {
    label: "Failed",
    color: palette.status.error.dark,
    backgroundColor: palette.status.error.background,
    icon: "✗",
  },
  Deleted: {
    label: "Deleted",
    color: palette.status.deleted.main,
    backgroundColor: palette.status.deleted.background,
    icon: "○",
  },
};

/**
 * Creates job status configuration from a MUI theme.
 * Use this function when you need theme-aware status colors in components.
 */
export const createJobStatusConfig = (
  theme: Theme
): Record<JobStatus, JobStatusConfig> => ({
  Draft: {
    label: "Draft",
    color: theme.custom.status.draft.main,
    backgroundColor: theme.custom.status.draft.background,
    icon: "○",
  },
  Pending: {
    label: "Pending",
    color: theme.palette.warning.main,
    backgroundColor: theme.custom.status.warning.background,
    icon: "⏳",
  },
  Generating: {
    label: "Generating",
    color: theme.palette.info.main,
    backgroundColor: theme.custom.status.info.background,
    icon: "●",
    animated: true,
  },
  Converting: {
    label: "Converting",
    color: theme.custom.status.converting.main,
    backgroundColor: theme.custom.status.converting.background,
    icon: "●",
    animated: true,
  },
  Finalizing: {
    label: "Finalizing",
    color: theme.custom.status.finalizing.main,
    backgroundColor: theme.custom.status.finalizing.background,
    icon: "●",
    animated: true,
  },
  Done: {
    label: "Done",
    color: theme.palette.success.dark,
    backgroundColor: theme.custom.status.success.background,
    icon: "✓",
  },
  Cancelled: {
    label: "Cancelled",
    color: theme.custom.status.cancelled.main,
    backgroundColor: theme.custom.status.cancelled.background,
    icon: "○",
  },
  Failed: {
    label: "Failed",
    color: theme.palette.error.dark,
    backgroundColor: theme.custom.status.error.background,
    icon: "✗",
  },
  Deleted: {
    label: "Deleted",
    color: theme.custom.status.deleted.main,
    backgroundColor: theme.custom.status.deleted.background,
    icon: "○",
  },
});
