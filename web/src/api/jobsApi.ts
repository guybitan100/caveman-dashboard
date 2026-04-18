import axios from "axios";
import {
  JobsListResponse,
  GetJobsParams,
  CreateDraftJobRequest,
} from "../types/job.ts";
import { TaskProgressResponse } from "../types/taskProgress.ts";
import { GenerationJob } from "../types/cart.ts";
import { TITAN_API_UFDR_BASE_URL } from "./config.ts";

// Axios instance with baseURL from VITE_TITAN_API_URL
export const apiClient = axios.create({
  baseURL: TITAN_API_UFDR_BASE_URL,
  timeout: 30000,
});

export const jobsApi = {
  /**
   * Fetch all jobs with optional filtering and pagination.
   * GET /UFDR/jobs
   */
  async getJobs(
    params: GetJobsParams = { page: 1 }
  ): Promise<JobsListResponse> {
    const response = await apiClient.get<JobsListResponse>("/jobs", {
      params: {
        page: params.page,
        page_size: params.page_size,
        name: params.name,
        status: params.status,
        exclude_status: params.exclude_status,
        user: params.user,
        event_type: params.event_type,
      },
    });
    return response.data;
  },

  /**
   * Get a single job by ID.
   * GET /UFDR/job/{job_id}
   */
  async getJob(id: string): Promise<GenerationJob> {
    const response = await apiClient.get<GenerationJob>(`/job/${id}`);
    return response.data;
  },

  /**
   * Create a new draft job.
   * POST /UFDR/draft
   */
  async createJob(user: string, name?: string): Promise<GenerationJob> {
    const request: CreateDraftJobRequest = name ? { name, user } : { user };
    const response = await apiClient.post<GenerationJob>("/draft", request);
    return response.data;
  },

  /**
   * Update job name.
   * PUT /UFDR/draft/{job_id}/name
   */
  async updateJobName(id: string, name: string): Promise<GenerationJob> {
    const response = await apiClient.put<GenerationJob>(
      `/draft/${id}/name`,
      null,
      { params: { name } }
    );
    return response.data;
  },

  /**
   * Run a draft job (submit for generation).
   * POST /UFDR/job/{job_id}
   */
  async runJob(id: string): Promise<GenerationJob> {
    const response = await apiClient.post<GenerationJob>(`/job/${id}`);
    return response.data;
  },

  /**
   * Delete a job.
   * DELETE /UFDR/job/{job_id}
   */
  async deleteJob(id: string): Promise<string> {
    const response = await apiClient.delete<string>(`/job/${id}`);
    return response.data;
  },

  /**
   * Cancel a running job.
   * POST /UFDR/job/cancel/{job_id}
   */
  async cancelJob(id: string): Promise<string> {
    const response = await apiClient.post<string>(`/job/cancel/${id}`);
    return response.data;
  },

  /**
   * Get task progress for a single task.
   * GET /UFDR/job/task-progress/{task_id}
   */
  async getTaskProgress(taskId: string): Promise<TaskProgressResponse> {
    const response = await apiClient.get<TaskProgressResponse>(
      `/job/task-progress/${taskId}`
    );
    return response.data;
  },

  /**
   * Get task progress for multiple tasks in parallel with concurrency limit.
   * Returns a Map of taskId -> TaskProgressResponse
   */
  async getMultipleTaskProgress(
    taskIds: string[],
    concurrencyLimit: number = 5
  ): Promise<Map<string, TaskProgressResponse>> {
    const results = new Map<string, TaskProgressResponse>();

    // Process in batches to limit concurrency
    for (let i = 0; i < taskIds.length; i += concurrencyLimit) {
      const batch = taskIds.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.allSettled(
        batch.map(async (taskId) => {
          const progress = await this.getTaskProgress(taskId);
          return { taskId, progress };
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.set(result.value.taskId, result.value.progress);
        }
      }
    }

    return results;
  },

  /**
   * Get the download URL, file size, and file name for a UFDR file.
   * GET /UFDR/download/{job_id}
   */
  async getDownloadUrl(id: string): Promise<{
    url: string;
    fileSize: number;
    fileName: string;
  }> {
    const response = await apiClient.get(`/download/${id}`);

    return {
      url: response.data.url,
      fileSize: response.data.file_size,
      fileName: response.data.file_name,
    };
  },
};
