import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockStoreState = {
  updateMultipleTaskProgress: vi.fn(),
  startJobPolling: vi.fn(),
  stopJobPolling: vi.fn(),
  getTaskProgress: vi.fn().mockReturnValue(null),
  getEventTypeProgress: vi.fn().mockReturnValue({
    eventType: "chat_messages" as const,
    status: "Pending" as const,
    progress: 0,
    totalTasks: 0,
    completedTasks: 0,
    generatingTasks: 0,
    failedTasks: 0,
  }),
  hasActiveTasksForJob: vi.fn().mockReturnValue(false),
  taskProgress: new Map(),
};

vi.mock("../../stores/taskProgressStore", () => ({
  useTaskProgressStore: vi.fn(() => mockStoreState),
}));

vi.mock("../../api/jobsApi", () => ({
  jobsApi: {
    getMultipleTaskProgress: vi.fn().mockResolvedValue(new Map()),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTaskProgress hook", () => {
  it("returns default state when no jobId", async () => {
    const { useTaskProgress } = await import("../../hooks/useTaskProgress");
    const { result } = renderHook(() => useTaskProgress(null, null, []));
    expect(result.current.isPolling).toBe(false);
    expect(typeof result.current.startPolling).toBe("function");
    expect(typeof result.current.stopPolling).toBe("function");
    expect(typeof result.current.getTaskProgress).toBe("function");
    expect(typeof result.current.getEventTypeProgress).toBe("function");
  });

  it("returns getTaskProgress that returns null for unknown task", async () => {
    const { useTaskProgress } = await import("../../hooks/useTaskProgress");
    const { result } = renderHook(() => useTaskProgress("j1", "Draft", []));
    expect(result.current.getTaskProgress("unknown")).toBeNull();
  });

  it("returns getEventTypeProgress", async () => {
    const { useTaskProgress } = await import("../../hooks/useTaskProgress");
    const { result } = renderHook(() => useTaskProgress("j1", "Draft", []));
    const progress = result.current.getEventTypeProgress("chat_messages" as any, []);
    expect(progress).toBeDefined();
    expect(progress.status).toBe("Pending");
  });

  it("does not poll when jobStatus is Draft", async () => {
    const { useTaskProgress } = await import("../../hooks/useTaskProgress");
    const { result } = renderHook(() =>
      useTaskProgress("j1", "Draft", [{ task_id: "t1", event_type: "chat_messages", status: "Pending" } as any])
    );
    expect(result.current.isPolling).toBe(false);
  });

  it("does not poll when disabled", async () => {
    const { useTaskProgress } = await import("../../hooks/useTaskProgress");
    const { result } = renderHook(() =>
      useTaskProgress("j1", "Generating", [], { enabled: false })
    );
    expect(result.current.isPolling).toBe(false);
  });
});

describe("useTaskProgressReader hook", () => {
  it("returns reader functions", async () => {
    const { useTaskProgressReader } = await import("../../hooks/useTaskProgress");
    const { result } = renderHook(() => useTaskProgressReader());
    expect(typeof result.current.getProgress).toBe("function");
    expect(typeof result.current.getEventTypeProgress).toBe("function");
    expect(result.current.taskProgress).toBeDefined();
  });
});

describe("getPollingInterval (internal)", () => {
  it("module exports useTaskProgress and useTaskProgressReader", async () => {
    const mod = await import("../../hooks/useTaskProgress");
    expect(mod.useTaskProgress).toBeDefined();
    expect(mod.useTaskProgressReader).toBeDefined();
  });
});
