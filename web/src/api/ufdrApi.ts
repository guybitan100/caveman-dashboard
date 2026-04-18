/**
 * API client for UFDR job submission and status polling.
 * Submits jobs to the main Titan API service.
 */

import { JobStatus } from "@/types/job.ts";
import {
  AiGenerationJob,
  JobStatusResponse,
  SubmittedJob,
} from "../types/pipeline.ts";
import { TITAN_API_UFDR_BASE_URL } from "./config.ts";

const API_BASE_URL = TITAN_API_UFDR_BASE_URL;

/**
 * Generate a new UUID v4.
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Submit a single generation job to the UFDR API.
 * Assigns a new job_id before submission.
 */
export async function submitUfdrJob(
  job: AiGenerationJob,
  phoneEntityName: string
): Promise<SubmittedJob> {
  // Create a new job_id for this submission
  const newJobId = generateUUID();
  const jobWithNewId: AiGenerationJob = {
    ...job,
    job_id: newJobId,
  };

  const response = await fetch(`${API_BASE_URL}/job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jobWithNewId),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to submit job: ${response.statusText} - ${JSON.stringify(
        errorData
      )}`
    );
  }

  return {
    job_id: newJobId,
    phone_entity_name: phoneEntityName,
    status: "Pending",
    submitted_at: new Date(),
  };
}

/**
 * Get the status of a job.
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/job/${jobId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to get job status: ${response.statusText} - ${JSON.stringify(
        errorData
      )}`
    );
  }

  return response.json();
}

/**
 * Check if a job status is terminal (completed or failed).
 */
export function isTerminalStatus(status: JobStatus): boolean {
  return ["Done", "Failed", "Cancelled", "Deleted"].includes(status);
}

/**
 * Check if a job status indicates success.
 */
export function isSuccessStatus(status: JobStatus): boolean {
  return status === "Done";
}

/**
 * Poll job statuses until all are complete or timeout.
 */
export async function pollJobStatuses(
  jobIds: string[],
  onStatusUpdate: (statuses: Map<string, JobStatus>) => void,
  options: {
    pollIntervalMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<Map<string, JobStatus>> {
  const { pollIntervalMs = 5000, timeoutMs = 600000 } = options; // Default: 5s interval, 10min timeout
  const statuses = new Map<string, JobStatus>();
  const startTime = Date.now();

  // Initialize all as Pending
  jobIds.forEach((id) => statuses.set(id, "Pending"));
  onStatusUpdate(statuses);

  while (Date.now() - startTime < timeoutMs) {
    // Check each job that's not in a terminal state
    const pendingJobs = jobIds.filter(
      (id) => !isTerminalStatus(statuses.get(id) || "Pending")
    );

    if (pendingJobs.length === 0) {
      // All jobs are complete
      break;
    }

    // Poll each pending job
    await Promise.all(
      pendingJobs.map(async (jobId) => {
        try {
          const response = await getJobStatus(jobId);
          statuses.set(jobId, response.status);
        } catch (error) {
          console.error(`Error polling job ${jobId}:`, error);
          // Keep the previous status on error
        }
      })
    );

    onStatusUpdate(statuses);

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return statuses;
}

export const ufdrApi = {
  submitJob: submitUfdrJob,
  getJobStatus,
  pollJobStatuses,
  isTerminalStatus,
  isSuccessStatus,
};
