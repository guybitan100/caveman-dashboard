import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "@testing-library/react";
import { useUfdrRuntimeStore } from "../ufdrRuntimeStore";
import { DEFAULT_FORM, EMPTY_JOB } from "../../types/ufdrRuntime";

// Mock the API module
vi.mock("../../api/ufdrRuntimeApi", () => ({
  ufdrRuntimeApi: {
    getHealth: vi.fn(),
    getInfo: vi.fn(),
    getSystemStats: vi.fn(),
    listLocalFiles: vi.fn(),
    getCurrentJob: vi.fn(),
    runSummary: vi.fn(),
    runJob: vi.fn(),
    cancelJob: vi.fn(),
    restart: vi.fn(),
    reset: vi.fn(),
  },
}));

import { ufdrRuntimeApi } from "../../api/ufdrRuntimeApi";
const mockApi = vi.mocked(ufdrRuntimeApi);

describe("ufdrRuntimeStore", () => {
  beforeEach(() => {
    // Reset the store to initial state
    useUfdrRuntimeStore.setState({
      form: { ...DEFAULT_FORM },
      localFiles: [],
      job: { ...EMPTY_JOB },
      appInfo: null,
      systemStats: null,
      summaryOutput: "",
      summaryCommand: "",
      busyAction: null,
      formError: null,
      inventoryError: null,
      pageError: null,
      activeTab: "builder",
      consoleVisible: true,
      consolePoppedOut: false,
    });
  });

  describe("Initial state", () => {
    it("should have default form state", () => {
      const { form } = useUfdrRuntimeStore.getState();
      expect(form.executionMode).toBe("duplicate");
      expect(form.sourceMode).toBe("local");
      expect(form.modelMode).toBe("copies");
      expect(form.modelCopies).toBe("3");
    });

    it("should have empty job", () => {
      const { job } = useUfdrRuntimeStore.getState();
      expect(job.status).toBe("idle");
      expect(job.logs).toEqual([]);
    });

    it("should have builder as active tab", () => {
      const { activeTab } = useUfdrRuntimeStore.getState();
      expect(activeTab).toBe("builder");
    });
  });

  describe("updateField", () => {
    it("should update a form field", () => {
      const { updateField } = useUfdrRuntimeStore.getState();
      updateField("executionMode", "summary");
      const { form } = useUfdrRuntimeStore.getState();
      expect(form.executionMode).toBe("summary");
    });

    it("should update boolean fields", () => {
      const { updateField } = useUfdrRuntimeStore.getState();
      updateField("uploadToS3", true);
      const { form } = useUfdrRuntimeStore.getState();
      expect(form.uploadToS3).toBe(true);
    });

    it("should update string fields", () => {
      const { updateField } = useUfdrRuntimeStore.getState();
      updateField("s3EvidenceId", "ev-123");
      const { form } = useUfdrRuntimeStore.getState();
      expect(form.s3EvidenceId).toBe("ev-123");
    });
  });

  describe("setActiveTab", () => {
    it("should change active tab", () => {
      const { setActiveTab } = useUfdrRuntimeStore.getState();
      setActiveTab("launch");
      expect(useUfdrRuntimeStore.getState().activeTab).toBe("launch");
    });
  });

  describe("toggleConsole", () => {
    it("should toggle console visibility", () => {
      const { toggleConsole } = useUfdrRuntimeStore.getState();
      expect(useUfdrRuntimeStore.getState().consoleVisible).toBe(true);
      toggleConsole();
      expect(useUfdrRuntimeStore.getState().consoleVisible).toBe(false);
      toggleConsole();
      expect(useUfdrRuntimeStore.getState().consoleVisible).toBe(true);
    });

    it("should close popout when toggling", () => {
      useUfdrRuntimeStore.setState({ consolePoppedOut: true });
      const { toggleConsole } = useUfdrRuntimeStore.getState();
      toggleConsole();
      expect(useUfdrRuntimeStore.getState().consolePoppedOut).toBe(false);
    });
  });

  describe("togglePopout", () => {
    it("should toggle popout and ensure visible", () => {
      useUfdrRuntimeStore.setState({ consoleVisible: false, consolePoppedOut: false });
      const { togglePopout } = useUfdrRuntimeStore.getState();
      togglePopout();
      expect(useUfdrRuntimeStore.getState().consolePoppedOut).toBe(true);
      expect(useUfdrRuntimeStore.getState().consoleVisible).toBe(true);
    });
  });

  describe("getIsRunning", () => {
    it("returns false when idle", () => {
      const { getIsRunning } = useUfdrRuntimeStore.getState();
      expect(getIsRunning()).toBe(false);
    });

    it("returns true when running", () => {
      useUfdrRuntimeStore.setState({
        job: { ...EMPTY_JOB, status: "running" },
      });
      const { getIsRunning } = useUfdrRuntimeStore.getState();
      expect(getIsRunning()).toBe(true);
    });
  });

  describe("getCanSubmit", () => {
    it("returns false when no local file selected", () => {
      const { getCanSubmit } = useUfdrRuntimeStore.getState();
      expect(getCanSubmit()).toBe(false);
    });

    it("returns true when local file is in files list", () => {
      useUfdrRuntimeStore.setState({
        form: { ...DEFAULT_FORM, selectedLocalFile: "test.ufdr" },
        localFiles: [
          {
            name: "test.ufdr",
            path: "test.ufdr",
            size: 1024,
            modifiedAt: "2024-01-01",
          },
        ],
      });
      const { getCanSubmit } = useUfdrRuntimeStore.getState();
      expect(getCanSubmit()).toBe(true);
    });

    it("returns true for S3 mode with evidence id", () => {
      useUfdrRuntimeStore.setState({
        form: { ...DEFAULT_FORM, sourceMode: "s3", s3EvidenceId: "ev-123" },
      });
      const { getCanSubmit } = useUfdrRuntimeStore.getState();
      expect(getCanSubmit()).toBe(true);
    });

    it("returns false for S3 mode without evidence id", () => {
      useUfdrRuntimeStore.setState({
        form: { ...DEFAULT_FORM, sourceMode: "s3", s3EvidenceId: "" },
      });
      const { getCanSubmit } = useUfdrRuntimeStore.getState();
      expect(getCanSubmit()).toBe(false);
    });
  });

  describe("getSelectedFileDetails", () => {
    it("returns null when no file selected", () => {
      const { getSelectedFileDetails } = useUfdrRuntimeStore.getState();
      expect(getSelectedFileDetails()).toBeNull();
    });

    it("returns file details when matched", () => {
      const file = {
        name: "test.ufdr",
        path: "test.ufdr",
        size: 2048,
        modifiedAt: "2024-06-01",
      };
      useUfdrRuntimeStore.setState({
        form: { ...DEFAULT_FORM, selectedLocalFile: "test.ufdr" },
        localFiles: [file],
      });
      const { getSelectedFileDetails } = useUfdrRuntimeStore.getState();
      expect(getSelectedFileDetails()).toEqual(file);
    });
  });

  describe("setConsoleVisible", () => {
    it("sets console visible", () => {
      useUfdrRuntimeStore.getState().setConsoleVisible(false);
      expect(useUfdrRuntimeStore.getState().consoleVisible).toBe(false);
      useUfdrRuntimeStore.getState().setConsoleVisible(true);
      expect(useUfdrRuntimeStore.getState().consoleVisible).toBe(true);
    });
  });

  describe("setConsolePoppedOut", () => {
    it("sets console popped out", () => {
      useUfdrRuntimeStore.getState().setConsolePoppedOut(true);
      expect(useUfdrRuntimeStore.getState().consolePoppedOut).toBe(true);
    });
  });

  describe("loadLocalFiles", () => {
    it("loads files and auto-selects first", async () => {
      const files = [
        { name: "a.ufdr", path: "/a.ufdr", size: 100, modifiedAt: "2024-01-01" },
        { name: "b.ufdr", path: "/b.ufdr", size: 200, modifiedAt: "2024-01-02" },
      ];
      mockApi.listLocalFiles.mockResolvedValueOnce(files);

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadLocalFiles();
      });

      const state = useUfdrRuntimeStore.getState();
      expect(state.localFiles).toHaveLength(2);
      expect(state.form.selectedLocalFile).toBe("/a.ufdr");
      expect(state.inventoryError).toBeNull();
    });

    it("handles error", async () => {
      mockApi.listLocalFiles.mockRejectedValueOnce(new Error("fail"));

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadLocalFiles();
      });

      expect(useUfdrRuntimeStore.getState().inventoryError).toBe("fail");
    });

    it("handles non-Error thrown values", async () => {
      mockApi.listLocalFiles.mockRejectedValueOnce("string error");

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadLocalFiles();
      });

      expect(useUfdrRuntimeStore.getState().inventoryError).toBe(
        "Failed loading local UFDR files"
      );
    });

    it("keeps existing selection if file still in list", async () => {
      useUfdrRuntimeStore.setState({
        form: { ...DEFAULT_FORM, selectedLocalFile: "/b.ufdr" },
      });
      const files = [
        { name: "a.ufdr", path: "/a.ufdr", size: 100, modifiedAt: "2024-01-01" },
        { name: "b.ufdr", path: "/b.ufdr", size: 200, modifiedAt: "2024-01-02" },
      ];
      mockApi.listLocalFiles.mockResolvedValueOnce(files);

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadLocalFiles();
      });

      expect(useUfdrRuntimeStore.getState().form.selectedLocalFile).toBe("/b.ufdr");
    });
  });

  describe("loadJobStatus", () => {
    it("updates job snapshot", async () => {
      const snapshot = { ...EMPTY_JOB, status: "running" as const, logs: ["line1"] };
      mockApi.getCurrentJob.mockResolvedValueOnce(snapshot);

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadJobStatus();
      });

      expect(useUfdrRuntimeStore.getState().job.status).toBe("running");
    });

    it("shows console when job starts running", async () => {
      useUfdrRuntimeStore.setState({
        consoleVisible: false,
        consolePoppedOut: false,
        job: { ...EMPTY_JOB, status: "idle" },
      });
      mockApi.getCurrentJob.mockResolvedValueOnce({ ...EMPTY_JOB, status: "running", logs: [] });

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadJobStatus();
      });

      expect(useUfdrRuntimeStore.getState().consoleVisible).toBe(true);
      expect(useUfdrRuntimeStore.getState().activeTab).toBe("logs");
    });
  });

  describe("loadAppInfo", () => {
    it("loads app info", async () => {
      const info = { appName: "UFDR Runtime", pythonCommand: "python3", availableUfdrs: 5 };
      mockApi.getInfo.mockResolvedValueOnce(info);

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadAppInfo();
      });

      expect(useUfdrRuntimeStore.getState().appInfo).toEqual(info);
    });
  });

  describe("loadSystemStats", () => {
    it("loads system stats", async () => {
      const stats = { hostname: "host1", memoryMb: 8192, cpuLoad: 0.5, uptimeSeconds: 3600 };
      mockApi.getSystemStats.mockResolvedValueOnce(stats);

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadSystemStats();
      });

      expect(useUfdrRuntimeStore.getState().systemStats).toEqual(stats);
    });

    it("silently handles error", async () => {
      mockApi.getSystemStats.mockRejectedValueOnce(new Error("fail"));

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadSystemStats();
      });

      expect(useUfdrRuntimeStore.getState().systemStats).toBeNull();
    });
  });

  describe("loadAppBoot", () => {
    it("calls all loaders in parallel", async () => {
      mockApi.listLocalFiles.mockResolvedValueOnce([]);
      mockApi.getCurrentJob.mockResolvedValueOnce(EMPTY_JOB);
      mockApi.getInfo.mockResolvedValueOnce({ appName: "test" });
      mockApi.getSystemStats.mockResolvedValueOnce({ hostname: "h" });

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadAppBoot();
      });

      expect(useUfdrRuntimeStore.getState().pageError).toBeNull();
    });

    it("sets pageError on failure", async () => {
      mockApi.listLocalFiles.mockRejectedValueOnce(new Error("boot fail"));
      mockApi.getCurrentJob.mockRejectedValueOnce(new Error("boot fail"));
      mockApi.getInfo.mockRejectedValueOnce(new Error("boot fail"));
      mockApi.getSystemStats.mockRejectedValueOnce(new Error("boot fail"));

      await act(async () => {
        await useUfdrRuntimeStore.getState().loadAppBoot();
      });

      expect(useUfdrRuntimeStore.getState().pageError).toBeTruthy();
    });
  });

  describe("handlePreviewSummary", () => {
    it("sets error when canSubmit is false", async () => {
      await act(async () => {
        await useUfdrRuntimeStore.getState().handlePreviewSummary();
      });

      expect(useUfdrRuntimeStore.getState().formError).toContain("Select a local UFDR");
    });

    it("runs summary and updates state", async () => {
      useUfdrRuntimeStore.setState({
        form: { ...DEFAULT_FORM, selectedLocalFile: "/a.ufdr" },
        localFiles: [{ name: "a.ufdr", path: "/a.ufdr", size: 100, modifiedAt: "2024-01-01" }],
      });
      mockApi.runSummary.mockResolvedValueOnce({
        commandLine: "cmd",
        output: "summary text",
      });

      await act(async () => {
        await useUfdrRuntimeStore.getState().handlePreviewSummary();
      });

      const state = useUfdrRuntimeStore.getState();
      expect(state.summaryOutput).toBe("summary text");
      expect(state.summaryCommand).toBe("cmd");
      expect(state.activeTab).toBe("summary");
      expect(state.busyAction).toBeNull();
    });

    it("handles summary error", async () => {
      useUfdrRuntimeStore.setState({
        form: { ...DEFAULT_FORM, selectedLocalFile: "/a.ufdr" },
        localFiles: [{ name: "a.ufdr", path: "/a.ufdr", size: 100, modifiedAt: "2024-01-01" }],
      });
      mockApi.runSummary.mockRejectedValueOnce(new Error("summary fail"));

      await act(async () => {
        await useUfdrRuntimeStore.getState().handlePreviewSummary();
      });

      expect(useUfdrRuntimeStore.getState().formError).toBe("summary fail");
      expect(useUfdrRuntimeStore.getState().busyAction).toBeNull();
    });
  });

  describe("handlePrimaryAction", () => {
    it("sets error when canSubmit is false", async () => {
      await act(async () => {
        await useUfdrRuntimeStore.getState().handlePrimaryAction();
      });

      expect(useUfdrRuntimeStore.getState().formError).toContain("Select a local UFDR");
    });

    it("delegates to handlePreviewSummary for summary mode", async () => {
      useUfdrRuntimeStore.setState({
        form: { ...DEFAULT_FORM, executionMode: "summary", selectedLocalFile: "/a.ufdr" },
        localFiles: [{ name: "a.ufdr", path: "/a.ufdr", size: 100, modifiedAt: "2024-01-01" }],
      });
      mockApi.runSummary.mockResolvedValueOnce({ commandLine: "", output: "sum" });

      await act(async () => {
        await useUfdrRuntimeStore.getState().handlePrimaryAction();
      });

      expect(useUfdrRuntimeStore.getState().summaryOutput).toBe("sum");
    });

    it("runs job for non-summary mode", async () => {
      useUfdrRuntimeStore.setState({
        form: { ...DEFAULT_FORM, executionMode: "duplicate", selectedLocalFile: "/a.ufdr" },
        localFiles: [{ name: "a.ufdr", path: "/a.ufdr", size: 100, modifiedAt: "2024-01-01" }],
      });
      const snapshot = { ...EMPTY_JOB, status: "running" as const };
      mockApi.runJob.mockResolvedValueOnce(snapshot);

      await act(async () => {
        await useUfdrRuntimeStore.getState().handlePrimaryAction();
      });

      expect(useUfdrRuntimeStore.getState().job.status).toBe("running");
      expect(useUfdrRuntimeStore.getState().busyAction).toBeNull();
    });

    it("handles run error", async () => {
      useUfdrRuntimeStore.setState({
        form: { ...DEFAULT_FORM, executionMode: "duplicate", selectedLocalFile: "/a.ufdr" },
        localFiles: [{ name: "a.ufdr", path: "/a.ufdr", size: 100, modifiedAt: "2024-01-01" }],
      });
      mockApi.runJob.mockRejectedValueOnce(new Error("run fail"));

      await act(async () => {
        await useUfdrRuntimeStore.getState().handlePrimaryAction();
      });

      expect(useUfdrRuntimeStore.getState().formError).toBe("run fail");
    });
  });

  describe("handleCancelRun", () => {
    it("cancels and updates job", async () => {
      const snapshot = { ...EMPTY_JOB, status: "cancelled" as const };
      mockApi.cancelJob.mockResolvedValueOnce(snapshot);

      await act(async () => {
        await useUfdrRuntimeStore.getState().handleCancelRun();
      });

      expect(useUfdrRuntimeStore.getState().job.status).toBe("cancelled");
      expect(useUfdrRuntimeStore.getState().busyAction).toBeNull();
    });

    it("handles cancel error", async () => {
      mockApi.cancelJob.mockRejectedValueOnce(new Error("cancel fail"));

      await act(async () => {
        await useUfdrRuntimeStore.getState().handleCancelRun();
      });

      expect(useUfdrRuntimeStore.getState().formError).toBe("cancel fail");
    });
  });

  describe("handleReset", () => {
    it("resets and reloads", async () => {
      mockApi.reset.mockResolvedValueOnce(undefined);
      mockApi.getCurrentJob.mockResolvedValueOnce(EMPTY_JOB);
      mockApi.listLocalFiles.mockResolvedValueOnce([]);

      await act(async () => {
        await useUfdrRuntimeStore.getState().handleReset();
      });

      expect(mockApi.reset).toHaveBeenCalled();
    });

    it("handles reset error", async () => {
      mockApi.reset.mockRejectedValueOnce(new Error("reset fail"));

      await act(async () => {
        await useUfdrRuntimeStore.getState().handleReset();
      });

      expect(useUfdrRuntimeStore.getState().formError).toBe("reset fail");
    });
  });
});
