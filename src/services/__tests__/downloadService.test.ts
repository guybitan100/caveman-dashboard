/**
 * Tests for Download Service - File System Access API Streaming
 *
 * These tests verify the core download functionality including:
 * - API support detection
 * - Download initiation and progress tracking
 * - Continuous chunk streaming behavior
 * - Error handling and retry logic
 * - Pause/Resume/Cancel functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadService, DownloadProgress } from "../downloadService";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock File System Access API
const mockWritableStream = {
  write: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockFileHandle = {
  createWritable: vi.fn().mockResolvedValue(mockWritableStream),
};

// Store original showSaveFilePicker
const originalShowSaveFilePicker = (window as any).showSaveFilePicker;

// Mock jobsApi
vi.mock("../../api/jobsApi", () => ({
  jobsApi: {
    getDownloadUrl: vi.fn().mockResolvedValue({
      url: "https://example.com/download",
      fileSize: 100 * 1024 * 1024, // 100MB
      fileName: "test.ufdr",
    }),
  },
}));

import { jobsApi } from "../../api/jobsApi";

describe("DownloadService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWritableStream.write.mockClear();
    mockWritableStream.close.mockClear();
    mockFileHandle.createWritable.mockClear();

    // Setup default file picker mock
    (window as any).showSaveFilePicker = vi
      .fn()
      .mockResolvedValue(mockFileHandle);

    // Default successful fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(15 * 1024 * 1024)),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore original (may be undefined)
    (window as any).showSaveFilePicker = originalShowSaveFilePicker;
  });

  describe("isSupported", () => {
    it("returns true when File System Access API is available", () => {
      (window as any).showSaveFilePicker = vi.fn();
      expect(downloadService.isSupported()).toBe(true);
    });

    it("returns false when showSaveFilePicker is not available", () => {
      delete (window as any).showSaveFilePicker;
      expect(downloadService.isSupported()).toBe(false);
    });

    it("returns false when showSaveFilePicker is not a function", () => {
      (window as any).showSaveFilePicker = "not a function";
      expect(downloadService.isSupported()).toBe(false);
    });
  });

  describe("startDownload", () => {
    it("returns a download ID and calls onProgress with pending status", async () => {
      const progressUpdates: DownloadProgress[] = [];
      const onProgress = vi.fn((progress: DownloadProgress) => {
        progressUpdates.push({ ...progress });
      });

      const downloadId = await downloadService.startDownload(
        "job-123",
        "test.ufdr",
        onProgress
      );

      // Wait for download to complete
      await vi.waitFor(() => {
        const hasCompleted = progressUpdates.some(
          (p) => p.status === "completed"
        );
        return hasCompleted;
      });

      expect(downloadId).toBeDefined();
      expect(typeof downloadId).toBe("string");
      expect(onProgress).toHaveBeenCalled();

      // First call should be pending status
      expect(progressUpdates[0].status).toBe("pending");
    });

    it("calls getDownloadUrl with the correct job ID", async () => {
      const onProgress = vi.fn();

      await downloadService.startDownload("job-456", "test.ufdr", onProgress);

      // Wait for download to complete
      await vi.waitFor(() => {
        return onProgress.mock.calls.some(
          (call) => call[0].status === "completed"
        );
      });

      expect(jobsApi.getDownloadUrl).toHaveBeenCalledWith("job-456");
    });

    it("opens file picker with correct options", async () => {
      const onProgress = vi.fn();

      await downloadService.startDownload("job-123", "test.ufdr", onProgress);

      // Wait for download to complete
      await vi.waitFor(() => {
        return onProgress.mock.calls.some(
          (call) => call[0].status === "completed"
        );
      });

      expect((window as any).showSaveFilePicker).toHaveBeenCalledWith({
        suggestedName: "test.ufdr",
        types: [
          {
            description: "UFDR File",
            accept: { "application/octet-stream": [".ufdr"] },
          },
        ],
      });
    });

    it("uses backend fileName when provided", async () => {
      vi.mocked(jobsApi.getDownloadUrl).mockResolvedValueOnce({
        url: "https://example.com/download",
        fileSize: 15 * 1024 * 1024,
        fileName: "backend-name.ufdr",
      });

      const onProgress = vi.fn();

      await downloadService.startDownload(
        "job-123",
        "client-name.ufdr",
        onProgress
      );

      // Wait for download to complete
      await vi.waitFor(() => {
        return onProgress.mock.calls.some(
          (call) => call[0].status === "completed"
        );
      });

      expect((window as any).showSaveFilePicker).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: "backend-name.ufdr",
        })
      );
    });

    it("handles user canceling file picker gracefully", async () => {
      (window as any).showSaveFilePicker = vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("User canceled"), { name: "AbortError" })
        );

      const onProgress = vi.fn();

      await expect(
        downloadService.startDownload("job-cancel", "test.ufdr", onProgress)
      ).rejects.toThrow("Download canceled by user");
    });

    it("propagates API errors from getDownloadUrl", async () => {
      vi.mocked(jobsApi.getDownloadUrl).mockRejectedValueOnce(
        new Error("API Error: Job not found")
      );

      const onProgress = vi.fn();

      await expect(
        downloadService.startDownload("job-api-error", "test.ufdr", onProgress)
      ).rejects.toThrow("API Error: Job not found");
    });
  });

  describe("Continuous Streaming Behavior", () => {
    it("maintains parallel connections by starting new download when any completes", async () => {
      const fetchCalls: { start: number; end: number }[] = [];
      const chunkResolvers: { resolve: () => void }[] = [];

      // Track fetch calls and control resolution order
      mockFetch.mockImplementation((_url: string, options: RequestInit) => {
        const headers = options.headers as Record<string, string>;
        const rangeHeader = headers?.Range || headers?.range;
        const match = rangeHeader?.match(/bytes=(\d+)-(\d+)/);
        const start = parseInt(match?.[1] || "0");
        const end = parseInt(match?.[2] || "0");

        fetchCalls.push({ start, end });

        return new Promise((resolve) => {
          const chunkResolve = () => {
            resolve({
              ok: true,
              arrayBuffer: () =>
                Promise.resolve(new ArrayBuffer(end - start + 1)),
            });
          };
          chunkResolvers.push({ resolve: chunkResolve });
        });
      });

      const onProgress = vi.fn();

      // Start download - will initiate 6 parallel fetches
      downloadService.startDownload("job-parallel", "test.ufdr", onProgress);

      // Wait for initial fetches to start
      await vi.waitFor(() => expect(fetchCalls.length).toBe(6));

      // Verify 6 parallel downloads started (chunks 0-5)
      expect(fetchCalls.length).toBe(6);

      // Simulate chunk 3 completing first (out of order)
      chunkResolvers[3].resolve();

      // Wait for next fetch to start
      await vi.waitFor(() => expect(fetchCalls.length).toBe(7));

      // Verify chunk 6 was started immediately
      expect(fetchCalls.length).toBe(7);

      // Complete all remaining chunks to cleanup
      for (let i = 0; i < chunkResolvers.length; i++) {
        if (i !== 3) {
          chunkResolvers[i].resolve();
        }
      }

      // Wait for completion
      await vi.waitFor(() => {
        return onProgress.mock.calls.some(
          (call) => call[0].status === "completed"
        );
      });
    });

    it("initiates multiple parallel fetch requests for large files", async () => {
      // Verify that multiple chunks start downloading in parallel
      let concurrentFetches = 0;
      let maxConcurrentFetches = 0;

      mockFetch.mockImplementation(() => {
        concurrentFetches++;
        maxConcurrentFetches = Math.max(
          maxConcurrentFetches,
          concurrentFetches
        );

        return new Promise((resolve) => {
          // Simulate network delay then resolve
          setTimeout(() => {
            concurrentFetches--;
            resolve({
              ok: true,
              arrayBuffer: () =>
                Promise.resolve(new ArrayBuffer(15 * 1024 * 1024)),
            });
          }, 10);
        });
      });

      const progressUpdates: DownloadProgress[] = [];
      const onProgress = vi.fn((p: DownloadProgress) =>
        progressUpdates.push({ ...p })
      );

      await downloadService.startDownload(
        "job-concurrent",
        "test.ufdr",
        onProgress
      );

      // Wait for completion
      await vi.waitFor(
        () => progressUpdates.some((p) => p.status === "completed"),
        { timeout: 5000 }
      );

      // Should have had multiple concurrent fetches (up to 6)
      expect(maxConcurrentFetches).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Progress Updates", () => {
    it("calls progress callback with pending status at start", async () => {
      const progressUpdates: DownloadProgress[] = [];
      const onProgress = vi.fn((progress: DownloadProgress) => {
        progressUpdates.push({ ...progress });
      });

      await downloadService.startDownload(
        "job-progress-pending",
        "test.ufdr",
        onProgress
      );

      // Wait a bit for the async download to start processing
      await new Promise((r) => setTimeout(r, 100));

      // The first update should be pending status
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].status).toBe("pending");
    });

    it("reports correct file name in progress", async () => {
      vi.mocked(jobsApi.getDownloadUrl).mockResolvedValueOnce({
        url: "https://example.com/download",
        fileSize: 15 * 1024 * 1024,
        fileName: "my-report.ufdr",
      });

      const progressUpdates: DownloadProgress[] = [];
      const onProgress = vi.fn((p: DownloadProgress) =>
        progressUpdates.push({ ...p })
      );

      await downloadService.startDownload(
        "job-name-test",
        "test.ufdr",
        onProgress
      );

      await vi.waitFor(
        () => progressUpdates.some((p) => p.status === "completed"),
        { timeout: 5000 }
      );

      expect(progressUpdates[0].fileName).toBe("my-report.ufdr");
    });

    it("reports correct total bytes in progress", async () => {
      const fileSize = 75 * 1024 * 1024;
      vi.mocked(jobsApi.getDownloadUrl).mockResolvedValueOnce({
        url: "https://example.com/download",
        fileSize,
        fileName: "test.ufdr",
      });

      const progressUpdates: DownloadProgress[] = [];
      const onProgress = vi.fn((p: DownloadProgress) =>
        progressUpdates.push({ ...p })
      );

      await downloadService.startDownload(
        "job-size-test",
        "test.ufdr",
        onProgress
      );

      await vi.waitFor(
        () => progressUpdates.some((p) => p.status === "completed"),
        { timeout: 5000 }
      );

      expect(progressUpdates[0].totalBytes).toBe(fileSize);
    });
  });

  describe("Error Handling", () => {
    it("retries failed chunks with exponential backoff", async () => {
      vi.useFakeTimers();
      let attemptCount = 0;

      // Single chunk file
      vi.mocked(jobsApi.getDownloadUrl).mockResolvedValueOnce({
        url: "https://example.com/download",
        fileSize: 15 * 1024 * 1024,
        fileName: "test.ufdr",
      });

      mockFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(15 * 1024 * 1024)),
        });
      });

      const progressUpdates: DownloadProgress[] = [];
      const onProgress = vi.fn((p: DownloadProgress) =>
        progressUpdates.push({ ...p })
      );

      const downloadPromise = downloadService.startDownload(
        "job-retry",
        "test.ufdr",
        onProgress
      );

      // Advance timers for exponential backoff (1s, then 2s)
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(1000);

      vi.useRealTimers();

      await downloadPromise;

      // Should have retried and succeeded
      expect(attemptCount).toBeGreaterThan(1);
      const completed = progressUpdates.find((p) => p.status === "completed");
      expect(completed).toBeDefined();
    });

    it("fails after max retry attempts", async () => {
      vi.useFakeTimers();

      // Single chunk file
      vi.mocked(jobsApi.getDownloadUrl).mockResolvedValueOnce({
        url: "https://example.com/download",
        fileSize: 15 * 1024 * 1024,
        fileName: "test.ufdr",
      });

      mockFetch.mockRejectedValue(new Error("Persistent network error"));

      const progressUpdates: DownloadProgress[] = [];
      const onProgress = vi.fn((p: DownloadProgress) =>
        progressUpdates.push({ ...p })
      );

      const downloadPromise = downloadService.startDownload(
        "job-fail",
        "test.ufdr",
        onProgress
      );

      // Advance timers for all retries (1s + 2s + 4s)
      await vi.advanceTimersByTimeAsync(10000);

      vi.useRealTimers();

      await downloadPromise;

      const failed = progressUpdates.find((p) => p.status === "failed");
      expect(failed).toBeDefined();
      expect(failed?.error).toContain("network error");
    });

    it("handles HTTP errors correctly", async () => {
      vi.useFakeTimers();

      // Single chunk file
      vi.mocked(jobsApi.getDownloadUrl).mockResolvedValueOnce({
        url: "https://example.com/download",
        fileSize: 15 * 1024 * 1024,
        fileName: "test.ufdr",
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      const progressUpdates: DownloadProgress[] = [];
      const onProgress = vi.fn((p: DownloadProgress) =>
        progressUpdates.push({ ...p })
      );

      const downloadPromise = downloadService.startDownload(
        "job-http-error",
        "test.ufdr",
        onProgress
      );

      // Advance timers for all retries
      await vi.advanceTimersByTimeAsync(10000);

      vi.useRealTimers();

      await downloadPromise;

      const failed = progressUpdates.find((p) => p.status === "failed");
      expect(failed).toBeDefined();
      expect(failed?.error).toContain("403");
    });
  });

  describe("Pause/Resume/Cancel", () => {
    it("pauses download and reports paused status", async () => {
      const chunkResolvers: (() => void)[] = [];

      mockFetch.mockImplementation(() => {
        return new Promise((resolve) => {
          chunkResolvers.push(() => {
            resolve({
              ok: true,
              arrayBuffer: () =>
                Promise.resolve(new ArrayBuffer(15 * 1024 * 1024)),
            });
          });
        });
      });

      const progressUpdates: DownloadProgress[] = [];
      const onProgress = vi.fn((p: DownloadProgress) =>
        progressUpdates.push({ ...p })
      );

      const downloadId = await downloadService.startDownload(
        "job-pause",
        "test.ufdr",
        onProgress
      );

      // Wait for downloads to start
      await vi.waitFor(() => expect(chunkResolvers.length).toBeGreaterThan(0));

      // Pause
      downloadService.pauseDownload(downloadId);

      const paused = progressUpdates.find((p) => p.status === "paused");
      expect(paused).toBeDefined();
    });

    it("cancels download and cleans up resources", async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Never resolve - simulate long download
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  arrayBuffer: () =>
                    Promise.resolve(new ArrayBuffer(15 * 1024 * 1024)),
                }),
              10000
            );
          })
      );

      const onProgress = vi.fn();
      const downloadId = await downloadService.startDownload(
        "job-cancel-test",
        "test.ufdr",
        onProgress
      );

      // Cancel
      await downloadService.cancelDownload(downloadId);

      // Verify stream was closed
      expect(mockWritableStream.close).toHaveBeenCalled();

      // Subsequent cancel should not throw
      await expect(
        downloadService.cancelDownload(downloadId)
      ).resolves.not.toThrow();
    });

    it("throws error when pausing non-existent download", () => {
      expect(() => downloadService.pauseDownload("non-existent-id")).toThrow(
        "Download not found"
      );
    });

    it("throws error when resuming non-existent download", async () => {
      await expect(
        downloadService.resumeDownload("non-existent-id")
      ).rejects.toThrow("Download not found");
    });

    it("cancel does not throw for non-existent download", async () => {
      await expect(
        downloadService.cancelDownload("non-existent-id")
      ).resolves.not.toThrow();
    });
  });

  describe("Stream Completion", () => {
    it("receives progress updates during download", async () => {
      vi.mocked(jobsApi.getDownloadUrl).mockResolvedValueOnce({
        url: "https://example.com/download",
        fileSize: 15 * 1024 * 1024, // Single chunk
        fileName: "test.ufdr",
      });

      const onProgress = vi.fn();

      await downloadService.startDownload(
        "job-stream-complete",
        "test.ufdr",
        onProgress
      );

      // Give some time for progress callbacks
      await new Promise((r) => setTimeout(r, 100));

      // Verify progress was called at least once
      expect(onProgress).toHaveBeenCalled();

      // Verify progress includes expected fields
      const lastCall =
        onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastCall).toHaveProperty("status");
      expect(lastCall).toHaveProperty("fileName");
      expect(lastCall).toHaveProperty("totalBytes");
    });

    it("starts with pending status", async () => {
      const fileSize = 15 * 1024 * 1024;
      vi.mocked(jobsApi.getDownloadUrl).mockResolvedValueOnce({
        url: "https://example.com/download",
        fileSize,
        fileName: "test.ufdr",
      });

      const progressUpdates: DownloadProgress[] = [];
      const onProgress = vi.fn((p: DownloadProgress) =>
        progressUpdates.push({ ...p })
      );

      await downloadService.startDownload(
        "job-status-check",
        "test.ufdr",
        onProgress
      );

      // Wait a moment for the first progress update
      await new Promise((r) => setTimeout(r, 50));

      // Should start with pending
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].status).toBe("pending");
    });
  });
});
