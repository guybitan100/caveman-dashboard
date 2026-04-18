/**
 * Tests for jobsApi - API Layer Validation
 *
 * Priority: HIGH
 * Tests ensure correct endpoint calls, parameter passing, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";
import type { JobsListResponse } from "../../types/job";
import type { GenerationJob } from "../../types/cart";

// Mock axios completely
vi.mock("axios");

describe("jobsApi - API Layer Tests", () => {
  const mockAxiosCreate = vi.fn();
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const mockPut = vi.fn();
  const mockDelete = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup axios.create to return a mock instance
    mockAxiosCreate.mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    });
    vi.mocked(axios.create).mockImplementation(mockAxiosCreate);

    // Clear the module cache and re-import to get fresh instance with mocks
    vi.resetModules();
  });

  describe("getJobs", () => {
    it("should fetch jobs with default pagination", async () => {
      const mockResponse: JobsListResponse = {
        jobs: [
          {
            id: "job-1",
            name: "Test Job 1",
            status: "Draft",
            timestamp: "2024-01-01T10:00:00Z",
            user: "test@example.com",
          },
          {
            id: "job-2",
            name: "Test Job 2",
            status: "Done",
            timestamp: "2024-01-02T10:00:00Z",
            user: "test@example.com",
          },
        ],
        total: 2,
      };

      mockGet.mockResolvedValue({ data: mockResponse });

      // Import after mocks are set up
      const { jobsApi } = await import("../jobsApi");
      const result = await jobsApi.getJobs();

      expect(mockGet).toHaveBeenCalledWith("/jobs", {
        params: {
          page: 1,
          name: undefined,
          status: undefined,
          event_type: undefined,
        },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should fetch jobs with custom page number", async () => {
      const mockResponse: JobsListResponse = { jobs: [], total: 0 };
      mockGet.mockResolvedValue({ data: mockResponse });

      const { jobsApi } = await import("../jobsApi");
      await jobsApi.getJobs({ page: 3 });

      expect(mockGet).toHaveBeenCalledWith("/jobs", {
        params: expect.objectContaining({ page: 3 }),
      });
    });

    it("should fetch jobs with name filter", async () => {
      const mockResponse: JobsListResponse = { jobs: [], total: 0 };
      mockGet.mockResolvedValue({ data: mockResponse });

      const { jobsApi } = await import("../jobsApi");
      await jobsApi.getJobs({ page: 1, name: "test-query" });

      expect(mockGet).toHaveBeenCalledWith("/jobs", {
        params: expect.objectContaining({ name: "test-query" }),
      });
    });

    it("should handle API errors", async () => {
      const error = new Error("Network Error");
      mockGet.mockRejectedValue(error);

      const { jobsApi } = await import("../jobsApi");
      await expect(jobsApi.getJobs()).rejects.toThrow("Network Error");
    });
  });

  describe("getJob", () => {
    it("should fetch a single job by ID", async () => {
      const mockJob: GenerationJob = {
        job_id: "job-123",
        name: "Test Job",
        status: "Draft",
        tasks: [],
        context: {
          device: { manufacturer: "Apple", name: "iPhone 14", os: "ios" },
          start_date: null,
          end_date: null,
          country_info: null,
        },
        device_info: [],
        custom_events: [],
        stories: {
          directed: false,
          multigraph: false,
          graph: {},
          nodes: [],
          edges: [],
        },
        owner_entity: null,
        entities: [],
      };

      mockGet.mockResolvedValue({ data: mockJob });

      const { jobsApi } = await import("../jobsApi");
      const result = await jobsApi.getJob("job-123");

      expect(mockGet).toHaveBeenCalledWith("/job/job-123");
      expect(result).toEqual(mockJob);
    });

    it("should handle 404 errors for non-existent job", async () => {
      const error = { response: { status: 404 }, message: "Not Found" };
      mockGet.mockRejectedValue(error);

      const { jobsApi } = await import("../jobsApi");
      await expect(jobsApi.getJob("non-existent")).rejects.toEqual(error);
    });
  });

  describe("createJob", () => {
    it("should create a new job with user only", async () => {
      const mockResponse = {
        job_id: "new-job-123",
        name: "Untitled",
        tasks: [],
        context: {},
        custom_events: [],
        stories: {},
        owner_entity: null,
        entities: [],
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const { jobsApi } = await import("../jobsApi");
      const result = await jobsApi.createJob("test-user");

      expect(mockPost).toHaveBeenCalledWith("/draft", { user: "test-user" });
      expect(result.job_id).toBe("new-job-123");
    });

    it("should create a new job with user and name", async () => {
      const mockResponse = {
        job_id: "new-job-123",
        name: "Custom Name",
        tasks: [],
        context: {},
        custom_events: [],
        stories: {},
        owner_entity: null,
        entities: [],
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const { jobsApi } = await import("../jobsApi");
      const result = await jobsApi.createJob("test-user", "Custom Name");

      expect(mockPost).toHaveBeenCalledWith("/draft", {
        user: "test-user",
        name: "Custom Name",
      });
      expect(result.name).toBe("Custom Name");
    });

    it("should handle creation errors", async () => {
      mockPost.mockRejectedValue(new Error("Server Error"));

      const { jobsApi } = await import("../jobsApi");
      await expect(jobsApi.createJob("test-user")).rejects.toThrow(
        "Server Error"
      );
    });
  });

  describe("updateJobName", () => {
    it("should update job name", async () => {
      const mockResponse = {
        job_id: "job-123",
        name: "Updated Name",
        tasks: [],
        context: {},
        custom_events: [],
        stories: {},
        owner_entity: null,
        entities: [],
      };

      mockPut.mockResolvedValue({ data: mockResponse });

      const { jobsApi } = await import("../jobsApi");
      const result = await jobsApi.updateJobName("job-123", "Updated Name");

      expect(mockPut).toHaveBeenCalledWith("/draft/job-123/name", null, {
        params: { name: "Updated Name" },
      });
      expect(result.name).toBe("Updated Name");
    });
  });

  describe("runJob", () => {
    it("should submit job for generation", async () => {
      const mockResponse = {
        job_id: "job-123",
        name: "Test Job",
        tasks: [{ task_id: "t1", event_type: "chat messages", quantity: 10 }],
        context: {},
        custom_events: [],
        stories: {},
        owner_entity: null,
        entities: [],
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const { jobsApi } = await import("../jobsApi");
      const result = await jobsApi.runJob("job-123");

      expect(mockPost).toHaveBeenCalledWith("/job/job-123");
      expect(result.job_id).toBe("job-123");
    });
  });

  describe("deleteJob", () => {
    it("should delete a job", async () => {
      mockDelete.mockResolvedValue({ data: "Job deleted" });

      const { jobsApi } = await import("../jobsApi");
      const result = await jobsApi.deleteJob("job-123");

      expect(mockDelete).toHaveBeenCalledWith("/job/job-123");
      expect(result).toBe("Job deleted");
    });

    it("should handle delete errors", async () => {
      mockDelete.mockRejectedValue(new Error("Cannot delete"));

      const { jobsApi } = await import("../jobsApi");
      await expect(jobsApi.deleteJob("job-123")).rejects.toThrow(
        "Cannot delete"
      );
    });
  });

  describe("cancelJob", () => {
    it("should cancel a running job", async () => {
      mockPost.mockResolvedValue({ data: "Job cancelled" });

      const { jobsApi } = await import("../jobsApi");
      const result = await jobsApi.cancelJob("job-123");

      expect(mockPost).toHaveBeenCalledWith("/job/cancel/job-123");
      expect(result).toBe("Job cancelled");
    });
  });

  describe("Error Handling", () => {
    it("should handle timeout errors", async () => {
      const timeoutError = new Error("timeout of 30000ms exceeded");
      timeoutError.name = "AxiosError";
      mockGet.mockRejectedValue(timeoutError);

      const { jobsApi } = await import("../jobsApi");
      await expect(jobsApi.getJobs()).rejects.toThrow("timeout");
    });

    it("should handle network disconnect", async () => {
      const networkError = new Error("Network Error");
      mockGet.mockRejectedValue(networkError);

      const { jobsApi } = await import("../jobsApi");
      await expect(jobsApi.getJob("job-123")).rejects.toThrow("Network Error");
    });
  });
});
