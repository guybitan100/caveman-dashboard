import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils/test-utils";
import React from "react";

// Mock stores used by shared components
vi.mock("../../stores/cartStore", () => ({
  useCartStore: Object.assign(
    vi.fn((selector) => {
      const state = { job: null, isOpen: false };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({}) }
  ),
}));

vi.mock("../../stores/metafinderStore", () => ({
  useMetaFinderStore: vi.fn((selector) => {
    const state = {
      isLoading: false,
      isInitialized: true,
      error: null,
      initialize: vi.fn(),
      getOptionsForEventType: vi.fn().mockReturnValue(null),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/taskProgressStore", () => ({
  useTaskProgressStore: vi.fn((selector) => {
    const state = {
      taskProgress: new Map(),
      getTaskProgress: vi.fn(),
      getEventTypeProgress: vi.fn().mockReturnValue({
        eventType: "chat messages",
        status: "Pending",
        progress: 0,
        totalTasks: 0,
        completedTasks: 0,
        generatingTasks: 0,
        failedTasks: 0,
      }),
      hasActiveTasksForJob: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../hooks/useMetaFinder", () => ({
  useMetaFinderOptions: vi.fn().mockReturnValue({ options: null, isLoading: false, error: null }),
  useMetaFinderStatus: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
}));

vi.mock("../../api/uploadsApi", () => ({
  uploadsApi: {
    getPresignedUrl: vi.fn().mockResolvedValue({ upload_url: "https://example.com/upload", file_key: "key" }),
    uploadFile: vi.fn().mockResolvedValue({}),
    confirmUpload: vi.fn().mockResolvedValue({}),
  },
  MAX_FILE_SIZE: 100 * 1024 * 1024,
  ALLOWED_EXTENSIONS: { image: [".jpg", ".png"], audio: [".mp3"], video: [".mp4"] },
}));

vi.mock("../../api/metafinderApi", () => ({
  metafinderApi: { getOptions: vi.fn().mockResolvedValue({}) },
}));

vi.mock("../../hooks/useTaskProgress", () => ({
  useTaskProgress: vi.fn().mockReturnValue({
    isPolling: false,
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    getTaskProgress: vi.fn(),
    getEventTypeProgress: vi.fn().mockReturnValue({
      eventType: "chat messages",
      status: "Pending",
      progress: 0,
      totalTasks: 0,
      completedTasks: 0,
      generatingTasks: 0,
      failedTasks: 0,
    }),
  }),
  useTaskProgressReader: vi.fn().mockReturnValue({
    getProgress: vi.fn(),
    getEventTypeProgress: vi.fn(),
    taskProgress: new Map(),
  }),
}));

describe("Shared Components Smoke Tests", () => {
  it("renders TaskStatusChip with status", async () => {
    const { TaskStatusChip } = await import("../shared/TaskStatusChip");
    const { container } = render(<TaskStatusChip status="Pending" />);
    expect(container).toBeTruthy();
  });

  it("renders TaskProgressBar", async () => {
    const { TaskProgressBar } = await import("../shared/TaskProgressBar");
    const { container } = render(
      <TaskProgressBar
        progress={0.5}
        status="Generating"
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders LocationPicker", async () => {
    const { LocationPicker } = await import("../shared/LocationPicker");
    const { container } = render(
      <LocationPicker
        value={{ latitude: 0, longitude: 0 }}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders StoryRefSelector", async () => {
    const { StoryRefSelector } = await import("../shared/StoryRefSelector");
    const { container } = render(
      <StoryRefSelector
        label="References"
        value={null}
        onChange={vi.fn()}
        storyRefTypes={[]}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("FilePicker Smoke Tests", () => {
  it("renders FilePicker", async () => {
    const { FilePicker } = await import("../shared/FilePicker/FilePicker");
    const { container } = render(
      <FilePicker
        dataType="image"
        value={null}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders FileUploader", async () => {
    const { FileUploader } = await import("../shared/FilePicker/FileUploader");
    const { container } = render(
      <FileUploader
        dataType="image"
        onComplete={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});
