import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Need to import after setting up fetch mock
const { submitUfdrJob, getJobStatus, pollJobStatuses, isTerminalStatus, isSuccessStatus } = await import("../ufdrApi");

describe("ufdrApi - extended coverage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("submitUfdrJob", () => {
    it("submits a job and returns SubmittedJob", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const job = {
        job_id: "old-id",
        name: "Test Job",
        status: "Draft" as const,
        tasks: [],
        entities: [],
        stories: { directed: true, multigraph: false, graph: {}, nodes: [], edges: [] },
        custom_events: [],
        context: null,
        device_info: [],
        owner_entity: null,
      };

      const result = await submitUfdrJob(job, "John");

      expect(result.phone_entity_name).toBe("John");
      expect(result.status).toBe("Pending");
      expect(result.job_id).toBeTruthy();
      expect(result.job_id).not.toBe("old-id"); // Should generate new UUID
      expect(result.submitted_at).toBeInstanceOf(Date);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Bad Request",
        json: async () => ({ error: "Invalid job" }),
      });

      const job = {
        job_id: "id",
        name: "Test",
        status: "Draft" as const,
        tasks: [],
        entities: [],
        stories: { directed: true, multigraph: false, graph: {}, nodes: [], edges: [] },
        custom_events: [],
        context: null,
        device_info: [],
        owner_entity: null,
      };

      await expect(submitUfdrJob(job, "John")).rejects.toThrow("Failed to submit job");
    });

    it("handles json parse failure on error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
        json: async () => { throw new Error("parse fail"); },
      });

      const job = {
        job_id: "id",
        name: "Test",
        status: "Draft" as const,
        tasks: [],
        entities: [],
        stories: { directed: true, multigraph: false, graph: {}, nodes: [], edges: [] },
        custom_events: [],
        context: null,
        device_info: [],
        owner_entity: null,
      };

      await expect(submitUfdrJob(job, "John")).rejects.toThrow("Failed to submit job");
    });
  });

  describe("getJobStatus", () => {
    it("returns job status response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ job_id: "j1", status: "Done" }),
      });

      const result = await getJobStatus("j1");
      expect(result).toEqual({ job_id: "j1", status: "Done" });
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
        json: async () => ({ error: "Job not found" }),
      });

      await expect(getJobStatus("unknown")).rejects.toThrow("Failed to get job status");
    });

    it("handles json parse failure on error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Server Error",
        json: async () => { throw new Error("parse fail"); },
      });

      await expect(getJobStatus("j1")).rejects.toThrow("Failed to get job status");
    });
  });

  describe("pollJobStatuses", () => {
    it("polls until all jobs are terminal", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({
            job_id: "j1",
            status: callCount >= 2 ? "Done" : "Generating",
          }),
        };
      });

      const updates: Map<string, string>[] = [];
      const result = await pollJobStatuses(
        ["j1"],
        (statuses) => updates.push(new Map(statuses)),
        { pollIntervalMs: 10, timeoutMs: 5000 }
      );

      expect(result.get("j1")).toBe("Done");
      expect(updates.length).toBeGreaterThanOrEqual(2);
    });

    it("returns on timeout", async () => {
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({ job_id: "j1", status: "Generating" }),
      }));

      const result = await pollJobStatuses(
        ["j1"],
        () => {},
        { pollIntervalMs: 10, timeoutMs: 50 }
      );

      expect(result.get("j1")).toBeTruthy();
    });

    it("handles fetch errors during polling", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Network error");
        }
        return {
          ok: true,
          json: async () => ({ job_id: "j1", status: "Done" }),
        };
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await pollJobStatuses(
        ["j1"],
        () => {},
        { pollIntervalMs: 10, timeoutMs: 5000 }
      );

      // Should eventually complete despite the error
      expect(result.get("j1")).toBe("Done");
      consoleSpy.mockRestore();
    });
  });

  describe("isTerminalStatus", () => {
    it("returns true for terminal statuses", () => {
      expect(isTerminalStatus("Done")).toBe(true);
      expect(isTerminalStatus("Failed")).toBe(true);
      expect(isTerminalStatus("Cancelled")).toBe(true);
      expect(isTerminalStatus("Deleted")).toBe(true);
    });

    it("returns false for non-terminal statuses", () => {
      expect(isTerminalStatus("Pending")).toBe(false);
      expect(isTerminalStatus("Generating")).toBe(false);
      expect(isTerminalStatus("Draft")).toBe(false);
    });
  });

  describe("isSuccessStatus", () => {
    it("returns true only for Done", () => {
      expect(isSuccessStatus("Done")).toBe(true);
      expect(isSuccessStatus("Failed")).toBe(false);
      expect(isSuccessStatus("Pending")).toBe(false);
    });
  });
});
