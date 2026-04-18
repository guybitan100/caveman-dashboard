/**
 * Tests for Download Store - Zustand State Management
 *
 * These tests verify the download state management including:
 * - Adding/removing downloads
 * - Updating progress
 * - Selectors for active downloads
 */

import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useDownloadStore } from "../downloadStore";
import type { DownloadProgress } from "../../services/downloadService";

describe("downloadStore", () => {
  // Helper to create mock download progress
  const createMockDownload = (
    id: string,
    overrides?: Partial<DownloadProgress>
  ): DownloadProgress => ({
    downloadId: id,
    fileName: `file-${id}.ufdr`,
    totalBytes: 100 * 1024 * 1024, // 100MB
    downloadedBytes: 0,
    speed: 0,
    eta: 0,
    status: "pending",
    ...overrides,
  });

  beforeEach(() => {
    // Reset store state before each test
    const store = useDownloadStore.getState();
    // Clear all downloads
    const downloads = store.downloads;
    Object.keys(downloads).forEach((id) => {
      store.removeDownload(id);
    });
  });

  describe("Initial State", () => {
    it("should initialize with empty downloads", () => {
      const { downloads } = useDownloadStore.getState();
      expect(downloads).toEqual({});
    });

    it("should have no active downloads initially", () => {
      const { hasActiveDownloads, getActiveDownloadCount } =
        useDownloadStore.getState();
      expect(hasActiveDownloads()).toBe(false);
      expect(getActiveDownloadCount()).toBe(0);
    });
  });

  describe("addDownload", () => {
    it("should add a download to the store", () => {
      const download = createMockDownload("download-1");

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      const { downloads } = useDownloadStore.getState();
      expect(downloads["download-1"]).toEqual(download);
    });

    it("should add multiple downloads", () => {
      const download1 = createMockDownload("download-1");
      const download2 = createMockDownload("download-2");

      act(() => {
        const store = useDownloadStore.getState();
        store.addDownload(download1);
        store.addDownload(download2);
      });

      const { downloads } = useDownloadStore.getState();
      expect(Object.keys(downloads)).toHaveLength(2);
      expect(downloads["download-1"]).toEqual(download1);
      expect(downloads["download-2"]).toEqual(download2);
    });

    it("should overwrite existing download with same ID", () => {
      const download1 = createMockDownload("download-1", {
        fileName: "original.ufdr",
      });
      const download2 = createMockDownload("download-1", {
        fileName: "updated.ufdr",
      });

      act(() => {
        const store = useDownloadStore.getState();
        store.addDownload(download1);
        store.addDownload(download2);
      });

      const { downloads } = useDownloadStore.getState();
      expect(Object.keys(downloads)).toHaveLength(1);
      expect(downloads["download-1"].fileName).toBe("updated.ufdr");
    });
  });

  describe("updateProgress", () => {
    it("should update progress for existing download", () => {
      const download = createMockDownload("download-1");

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      act(() => {
        useDownloadStore.getState().updateProgress("download-1", {
          downloadedBytes: 50 * 1024 * 1024,
          status: "downloading",
          speed: 10 * 1024 * 1024,
          eta: 5,
        });
      });

      const { downloads } = useDownloadStore.getState();
      expect(downloads["download-1"].downloadedBytes).toBe(50 * 1024 * 1024);
      expect(downloads["download-1"].status).toBe("downloading");
      expect(downloads["download-1"].speed).toBe(10 * 1024 * 1024);
      expect(downloads["download-1"].eta).toBe(5);
    });

    it("should preserve unchanged fields during update", () => {
      const download = createMockDownload("download-1", {
        fileName: "test.ufdr",
        totalBytes: 100 * 1024 * 1024,
      });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      act(() => {
        useDownloadStore.getState().updateProgress("download-1", {
          status: "downloading",
        });
      });

      const { downloads } = useDownloadStore.getState();
      expect(downloads["download-1"].fileName).toBe("test.ufdr");
      expect(downloads["download-1"].totalBytes).toBe(100 * 1024 * 1024);
      expect(downloads["download-1"].status).toBe("downloading");
    });

    it("should not modify state for non-existent download", () => {
      const download = createMockDownload("download-1");

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      act(() => {
        useDownloadStore.getState().updateProgress("non-existent", {
          status: "downloading",
        });
      });

      const { downloads } = useDownloadStore.getState();
      // Original download unchanged
      expect(downloads["download-1"].status).toBe("pending");
      // No new download created
      expect(downloads["non-existent"]).toBeUndefined();
    });

    it("should update status to completed", () => {
      const download = createMockDownload("download-1");

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      act(() => {
        useDownloadStore.getState().updateProgress("download-1", {
          status: "completed",
          downloadedBytes: 100 * 1024 * 1024,
        });
      });

      const { downloads } = useDownloadStore.getState();
      expect(downloads["download-1"].status).toBe("completed");
      expect(downloads["download-1"].downloadedBytes).toBe(100 * 1024 * 1024);
    });

    it("should update status to failed with error message", () => {
      const download = createMockDownload("download-1");

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      act(() => {
        useDownloadStore.getState().updateProgress("download-1", {
          status: "failed",
          error: "Network error",
        });
      });

      const { downloads } = useDownloadStore.getState();
      expect(downloads["download-1"].status).toBe("failed");
      expect(downloads["download-1"].error).toBe("Network error");
    });
  });

  describe("removeDownload", () => {
    it("should remove a download from the store", () => {
      const download = createMockDownload("download-1");

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      act(() => {
        useDownloadStore.getState().removeDownload("download-1");
      });

      const { downloads } = useDownloadStore.getState();
      expect(downloads["download-1"]).toBeUndefined();
    });

    it("should not affect other downloads when removing one", () => {
      const download1 = createMockDownload("download-1");
      const download2 = createMockDownload("download-2");

      act(() => {
        const store = useDownloadStore.getState();
        store.addDownload(download1);
        store.addDownload(download2);
      });

      act(() => {
        useDownloadStore.getState().removeDownload("download-1");
      });

      const { downloads } = useDownloadStore.getState();
      expect(downloads["download-1"]).toBeUndefined();
      expect(downloads["download-2"]).toEqual(download2);
    });

    it("should handle removing non-existent download gracefully", () => {
      const download = createMockDownload("download-1");

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      act(() => {
        useDownloadStore.getState().removeDownload("non-existent");
      });

      const { downloads } = useDownloadStore.getState();
      expect(downloads["download-1"]).toEqual(download);
    });
  });

  describe("getDownload selector", () => {
    it("should return download by ID", () => {
      const download = createMockDownload("download-1");

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      const result = useDownloadStore.getState().getDownload("download-1");
      expect(result).toEqual(download);
    });

    it("should return undefined for non-existent download", () => {
      const result = useDownloadStore.getState().getDownload("non-existent");
      expect(result).toBeUndefined();
    });
  });

  describe("hasActiveDownloads selector", () => {
    it("should return false when no downloads exist", () => {
      expect(useDownloadStore.getState().hasActiveDownloads()).toBe(false);
    });

    it("should return true when there is a downloading download", () => {
      const download = createMockDownload("download-1", {
        status: "downloading",
      });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      expect(useDownloadStore.getState().hasActiveDownloads()).toBe(true);
    });

    it("should return true when there is a pending download", () => {
      const download = createMockDownload("download-1", { status: "pending" });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      expect(useDownloadStore.getState().hasActiveDownloads()).toBe(true);
    });

    it("should return false when only paused downloads exist", () => {
      const download = createMockDownload("download-1", { status: "paused" });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      expect(useDownloadStore.getState().hasActiveDownloads()).toBe(false);
    });

    it("should return false when only completed downloads exist", () => {
      const download = createMockDownload("download-1", {
        status: "completed",
      });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      expect(useDownloadStore.getState().hasActiveDownloads()).toBe(false);
    });

    it("should return false when only failed downloads exist", () => {
      const download = createMockDownload("download-1", { status: "failed" });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      expect(useDownloadStore.getState().hasActiveDownloads()).toBe(false);
    });
  });

  describe("getActiveDownloads selector", () => {
    it("should return empty array when no downloads exist", () => {
      const result = useDownloadStore.getState().getActiveDownloads();
      expect(result).toEqual([]);
    });

    it("should return downloading downloads", () => {
      const download = createMockDownload("download-1", {
        status: "downloading",
      });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      const result = useDownloadStore.getState().getActiveDownloads();
      expect(result).toHaveLength(1);
      expect(result[0].downloadId).toBe("download-1");
    });

    it("should return pending downloads", () => {
      const download = createMockDownload("download-1", { status: "pending" });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      const result = useDownloadStore.getState().getActiveDownloads();
      expect(result).toHaveLength(1);
    });

    it("should return paused downloads", () => {
      const download = createMockDownload("download-1", { status: "paused" });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      const result = useDownloadStore.getState().getActiveDownloads();
      expect(result).toHaveLength(1);
    });

    it("should not return completed downloads", () => {
      const download = createMockDownload("download-1", {
        status: "completed",
      });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      const result = useDownloadStore.getState().getActiveDownloads();
      expect(result).toHaveLength(0);
    });

    it("should not return failed downloads", () => {
      const download = createMockDownload("download-1", { status: "failed" });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      const result = useDownloadStore.getState().getActiveDownloads();
      expect(result).toHaveLength(0);
    });

    it("should return mixed active downloads", () => {
      const download1 = createMockDownload("download-1", {
        status: "downloading",
      });
      const download2 = createMockDownload("download-2", { status: "pending" });
      const download3 = createMockDownload("download-3", { status: "paused" });
      const download4 = createMockDownload("download-4", {
        status: "completed",
      });

      act(() => {
        const store = useDownloadStore.getState();
        store.addDownload(download1);
        store.addDownload(download2);
        store.addDownload(download3);
        store.addDownload(download4);
      });

      const result = useDownloadStore.getState().getActiveDownloads();
      expect(result).toHaveLength(3);
      expect(result.map((d) => d.downloadId).sort()).toEqual([
        "download-1",
        "download-2",
        "download-3",
      ]);
    });
  });

  describe("getActiveDownloadCount selector", () => {
    it("should return 0 when no downloads exist", () => {
      expect(useDownloadStore.getState().getActiveDownloadCount()).toBe(0);
    });

    it("should return correct count of active downloads", () => {
      const download1 = createMockDownload("download-1", {
        status: "downloading",
      });
      const download2 = createMockDownload("download-2", { status: "pending" });
      const download3 = createMockDownload("download-3", {
        status: "completed",
      });

      act(() => {
        const store = useDownloadStore.getState();
        store.addDownload(download1);
        store.addDownload(download2);
        store.addDownload(download3);
      });

      expect(useDownloadStore.getState().getActiveDownloadCount()).toBe(2);
    });

    it("should include paused downloads in count", () => {
      const download = createMockDownload("download-1", { status: "paused" });

      act(() => {
        useDownloadStore.getState().addDownload(download);
      });

      expect(useDownloadStore.getState().getActiveDownloadCount()).toBe(1);
    });
  });

  describe("State Persistence", () => {
    it("should maintain state across multiple operations", () => {
      const download1 = createMockDownload("download-1");
      const download2 = createMockDownload("download-2");

      // Add downloads
      act(() => {
        const store = useDownloadStore.getState();
        store.addDownload(download1);
        store.addDownload(download2);
      });

      // Update one
      act(() => {
        useDownloadStore.getState().updateProgress("download-1", {
          status: "downloading",
          downloadedBytes: 25 * 1024 * 1024,
        });
      });

      // Remove one
      act(() => {
        useDownloadStore.getState().removeDownload("download-2");
      });

      // Verify final state
      const { downloads } = useDownloadStore.getState();
      expect(Object.keys(downloads)).toHaveLength(1);
      expect(downloads["download-1"].status).toBe("downloading");
      expect(downloads["download-1"].downloadedBytes).toBe(25 * 1024 * 1024);
    });
  });
});
