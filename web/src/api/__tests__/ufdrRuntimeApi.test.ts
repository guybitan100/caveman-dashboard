import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";

vi.mock("axios");

describe("ufdrRuntimeApi", () => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(axios.create).mockReturnValue({
      get: mockGet,
      post: mockPost,
    } as unknown as ReturnType<typeof axios.create>);
    vi.resetModules();
  });

  describe("getHealth", () => {
    it("should call /api/health", async () => {
      mockGet.mockResolvedValue({ data: { ok: true } });
      const { ufdrRuntimeApi } = await import("../ufdrRuntimeApi");
      const result = await ufdrRuntimeApi.getHealth();
      expect(mockGet).toHaveBeenCalledWith("/api/health");
      expect(result).toEqual({ ok: true });
    });
  });

  describe("getInfo", () => {
    it("should call /api/info", async () => {
      const info = {
        appName: "UFDR Creation Center",
        pythonCommand: "python3",
        runtimeRoot: "/runtime",
        availableUfdrs: 3,
      };
      mockGet.mockResolvedValue({ data: info });
      const { ufdrRuntimeApi } = await import("../ufdrRuntimeApi");
      const result = await ufdrRuntimeApi.getInfo();
      expect(mockGet).toHaveBeenCalledWith("/api/info");
      expect(result).toEqual(info);
    });
  });

  describe("getSystemStats", () => {
    it("should call /api/system/stats", async () => {
      const stats = {
        hostname: "test-host",
        nodeVersion: "v20.0.0",
        uptimeSeconds: 3600,
        memoryUsedPercent: 45,
        loadAverage: [1.5, 1.2, 0.9],
      };
      mockGet.mockResolvedValue({ data: stats });
      const { ufdrRuntimeApi } = await import("../ufdrRuntimeApi");
      const result = await ufdrRuntimeApi.getSystemStats();
      expect(mockGet).toHaveBeenCalledWith("/api/system/stats");
      expect(result).toEqual(stats);
    });
  });

  describe("listLocalFiles", () => {
    it("should call /api/ufdr/files and return files array", async () => {
      const files = [
        {
          name: "test.ufdr",
          path: "ufdrs/test.ufdr",
          size: 1024,
          modifiedAt: "2024-01-01T00:00:00Z",
        },
      ];
      mockGet.mockResolvedValue({ data: { files } });
      const { ufdrRuntimeApi } = await import("../ufdrRuntimeApi");
      const result = await ufdrRuntimeApi.listLocalFiles();
      expect(mockGet).toHaveBeenCalledWith("/api/ufdr/files");
      expect(result).toEqual(files);
    });
  });

  describe("getCurrentJob", () => {
    it("should call /api/ufdr/jobs/current", async () => {
      const job = { status: "idle", commandLine: "", logs: [] };
      mockGet.mockResolvedValue({ data: job });
      const { ufdrRuntimeApi } = await import("../ufdrRuntimeApi");
      const result = await ufdrRuntimeApi.getCurrentJob();
      expect(mockGet).toHaveBeenCalledWith("/api/ufdr/jobs/current");
      expect(result).toEqual(job);
    });
  });

  describe("runSummary", () => {
    it("should POST to /api/ufdr/summary", async () => {
      const payload = { sourceMode: "local" as const, inputPath: "test.ufdr" };
      const response = { commandLine: "python main.py --summary", output: "summary text" };
      mockPost.mockResolvedValue({ data: response });
      const { ufdrRuntimeApi } = await import("../ufdrRuntimeApi");
      const result = await ufdrRuntimeApi.runSummary(payload);
      expect(mockPost).toHaveBeenCalledWith("/api/ufdr/summary", payload);
      expect(result).toEqual(response);
    });
  });

  describe("runJob", () => {
    it("should POST to /api/ufdr/run", async () => {
      const payload = { sourceMode: "local" as const, inputPath: "test.ufdr" };
      const job = { status: "running", commandLine: "python main.py 3", logs: [] };
      mockPost.mockResolvedValue({ data: job });
      const { ufdrRuntimeApi } = await import("../ufdrRuntimeApi");
      const result = await ufdrRuntimeApi.runJob(payload);
      expect(mockPost).toHaveBeenCalledWith("/api/ufdr/run", payload);
      expect(result).toEqual(job);
    });
  });

  describe("cancelJob", () => {
    it("should POST to /api/ufdr/jobs/current/cancel", async () => {
      const job = { status: "cancelled", commandLine: "", logs: [] };
      mockPost.mockResolvedValue({ data: job });
      const { ufdrRuntimeApi } = await import("../ufdrRuntimeApi");
      const result = await ufdrRuntimeApi.cancelJob();
      expect(mockPost).toHaveBeenCalledWith("/api/ufdr/jobs/current/cancel");
      expect(result).toEqual(job);
    });
  });

  describe("restart", () => {
    it("should POST to /api/restart", async () => {
      mockPost.mockResolvedValue({ data: { ok: true } });
      const { ufdrRuntimeApi } = await import("../ufdrRuntimeApi");
      const result = await ufdrRuntimeApi.restart();
      expect(mockPost).toHaveBeenCalledWith("/api/restart");
      expect(result).toEqual({ ok: true });
    });
  });

  describe("reset", () => {
    it("should POST to /api/reset", async () => {
      mockPost.mockResolvedValue({ data: { ok: true } });
      const { ufdrRuntimeApi } = await import("../ufdrRuntimeApi");
      const result = await ufdrRuntimeApi.reset();
      expect(mockPost).toHaveBeenCalledWith("/api/reset");
      expect(result).toEqual({ ok: true });
    });
  });
});
