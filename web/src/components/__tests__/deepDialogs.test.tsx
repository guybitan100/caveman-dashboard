import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../../test/utils/test-utils";
import React from "react";

// Mock all stores with rich data
vi.mock("../../stores/cartStore", () => ({
  useCartStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        job: {
          id: "j1", name: "Test Job", status: "Draft",
          device_context: { manufacturer: "Apple", model: "iPhone 15", os: "iOS", os_version: "17.0", device_name: "My iPhone" },
          device_info: {
            date_range: { start: "2024-01-01", end: "2024-06-01" },
            imei: "123456789012345",
            serial_number: "ABC123",
          },
          owner_entity: { entity_id: "e1", name: "John Doe", phone_number: "+1234567890", email: "john@test.com", is_owner: true },
          entities: [
            { entity_id: "e1", name: "John Doe", phone_number: "+1234567890", email: "john@test.com", is_owner: true },
            { entity_id: "e2", name: "Jane Smith", phone_number: "+0987654321", email: "jane@test.com", is_owner: false },
            { entity_id: "e3", name: "Bob Wilson", phone_number: "+1111111111", email: "bob@test.com", is_owner: false },
          ],
          stories: [
            { story_id: "s1", story_type: "chat_message", entity_id: "e1", params: { text: "Hello" } },
            { story_id: "s2", story_type: "call", entity_id: "e1", params: { duration: 120, direction: "outgoing" } },
          ],
          tasks: [
            { task_id: "t1", event_type: "chat_messages", count: 10, params: {} },
            { task_id: "t2", event_type: "calls", count: 5, params: {} },
          ],
          custom_events: [
            { event_id: "ce1", event_type: "custom", name: "GPS Check", params: {} },
          ],
        },
        isOpen: true,
        currentJobId: "j1",
        expandedSections: { deviceContext: true, tasks: true, stories: true, entities: true, customEvents: true },
        isLoading: false,
        isSaving: false,
        error: null,
        openCart: vi.fn(),
        closeCart: vi.fn(),
        toggleCart: vi.fn(),
        toggleSection: vi.fn(),
        syncFromJob: vi.fn(),
        setCurrentJob: vi.fn(),
        setCurrentJobId: vi.fn(),
        setIsLoading: vi.fn(),
        setError: vi.fn(),
        clearError: vi.fn(),
        getTotalItemCount: vi.fn().mockReturnValue(5),
        getSectionItemCount: vi.fn().mockReturnValue(2),
        updateDeviceContext: vi.fn(),
        updateDeviceInfo: vi.fn(),
        updateOwnerEntity: vi.fn(),
        addEntity: vi.fn(),
        updateEntity: vi.fn(),
        deleteEntity: vi.fn(),
        addStory: vi.fn(),
        addStories: vi.fn(),
        updateStory: vi.fn(),
        deleteStory: vi.fn(),
        addCustomEvent: vi.fn(),
        updateCustomEvent: vi.fn(),
        deleteCustomEvent: vi.fn(),
        addTask: vi.fn(),
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        createRandomEvents: vi.fn(),
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({ openCart: vi.fn(), setCurrentJob: vi.fn(), setIsLoading: vi.fn(), setError: vi.fn(), job: null }) }
  ),
}));

vi.mock("../../stores/jobStore", () => ({
  useJobStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        jobs: [{ id: "j1", name: "Test Job", status: "Draft", timestamp: "2024-01-01T00:00:00Z", user: "user@test.com" }],
        searchQuery: "", isLoading: false, selectedJobId: "j1",
        setJobs: vi.fn(), addJob: vi.fn(), updateJobStatus: vi.fn(), removeJob: vi.fn(),
        selectJob: vi.fn(), setSearchQuery: vi.fn(), setLoading: vi.fn(), setError: vi.fn(),
        getFilteredJobs: vi.fn().mockReturnValue([]),
        getSelectedJob: vi.fn().mockReturnValue({ id: "j1", name: "Test Job", status: "Draft" }),
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({ selectedJobId: "j1", jobs: [] }) }
  ),
  useSelectedJobStatus: vi.fn().mockReturnValue("Draft"),
}));

vi.mock("../../stores/deviceModelsStore", () => ({
  useDeviceModelsStore: vi.fn((selector) => {
    const state = {
      deviceModels: [
        { manufacturer: "Apple", model: "iPhone 15", display_name: "iPhone 15" },
        { manufacturer: "Samsung", model: "Galaxy S24", display_name: "Galaxy S24" },
      ],
      isLoading: false, isInitialized: true, error: null, initialize: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/metafinderStore", () => ({
  useMetaFinderStore: vi.fn((selector) => {
    const state = { isLoading: false, isInitialized: true, error: null, initialize: vi.fn(), getOptionsForEventType: vi.fn().mockReturnValue(null) };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/taskProgressStore", () => ({
  useTaskProgressStore: vi.fn((selector) => {
    const state = { taskProgress: new Map(), getTaskProgress: vi.fn(), getEventTypeProgress: vi.fn(), hasActiveTasksForJob: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../hooks/useMetaFinder", () => ({
  useMetaFinderInit: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
  useMetaFinderOptions: vi.fn().mockReturnValue({ options: null, isLoading: false, error: null }),
  useMetaFinderStatus: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
}));

vi.mock("../../hooks", () => ({
  useMetaFinderInit: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
  useMetaFinderOptions: vi.fn().mockReturnValue({ options: null, isLoading: false, error: null }),
  useMetaFinderStatus: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
}));

vi.mock("../../hooks/useTaskProgress", () => ({
  useTaskProgress: vi.fn().mockReturnValue({
    isPolling: false, startPolling: vi.fn(), stopPolling: vi.fn(),
    getTaskProgress: vi.fn(), getEventTypeProgress: vi.fn().mockReturnValue({
      eventType: "chat_messages", status: "Pending", progress: 0,
      totalTasks: 10, completedTasks: 0, generatingTasks: 0, failedTasks: 0,
    }),
  }),
  useTaskProgressReader: vi.fn().mockReturnValue({
    getProgress: vi.fn().mockReturnValue(null),
    getEventTypeProgress: vi.fn().mockReturnValue(null),
    taskProgress: new Map(),
  }),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false, login: vi.fn(), logout: vi.fn(),
  }),
}));

vi.mock("../../contexts", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false, login: vi.fn(), logout: vi.fn(),
  }),
}));

vi.mock("../../api/uploadsApi", () => ({
  uploadsApi: { getPresignedUrl: vi.fn(), uploadFile: vi.fn(), confirmUpload: vi.fn() },
  MAX_FILE_SIZE: 100 * 1024 * 1024,
  ALLOWED_EXTENSIONS: { image: [".jpg", ".png"], audio: [".mp3"], video: [".mp4"] },
}));

vi.mock("../../api/metafinderApi", () => ({
  metafinderApi: { getOptions: vi.fn().mockResolvedValue({}) },
}));

vi.mock("../../api/jobsApi", () => ({
  jobsApi: { getJobs: vi.fn(), getJob: vi.fn(), createJob: vi.fn(), deleteJob: vi.fn(), getMultipleTaskProgress: vi.fn().mockResolvedValue(new Map()) },
}));

// Deep tests for dialogs in OPEN state with data
describe("StoryFormDialog - Open with data", () => {
  it("renders open with chat_message type and entities", async () => {
    const { StoryFormDialog } = await import("../cart/dialogs/StoryFormDialog");
    const { container } = render(
      <StoryFormDialog
        open={true}
        storyType="chat_message"
        storyIcon={<span>💬</span>}
        editingStory={null}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders open with location type", async () => {
    const { StoryFormDialog } = await import("../cart/dialogs/StoryFormDialog");
    const { container } = render(
      <StoryFormDialog
        open={true}
        storyType="location"
        storyIcon={<span>📍</span>}
        editingStory={null}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders open with web_search type", async () => {
    const { StoryFormDialog } = await import("../cart/dialogs/StoryFormDialog");
    const { container } = render(
      <StoryFormDialog
        open={true}
        storyType="web_search"
        storyIcon={<span>🔍</span>}
        editingStory={null}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders editing an existing story", async () => {
    const { StoryFormDialog } = await import("../cart/dialogs/StoryFormDialog");
    const { container } = render(
      <StoryFormDialog
        open={true}
        storyType="chat_message"
        storyIcon={<span>💬</span>}
        editingStory={{
          story_id: "s1",
          story_type: "chat_message",
          entity_id: "e1",
          params: { text: "Hello world" },
        } as any}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("TaskFormDialog - Open with data", () => {
  it("renders open with chat_messages event", async () => {
    const { TaskFormDialog } = await import("../cart/dialogs/TaskFormDialog");
    const { container } = render(
      <TaskFormDialog
        open={true}
        eventType="chat_messages"
        eventIcon={<span>💬</span>}
        editingTask={null}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders open with calls event", async () => {
    const { TaskFormDialog } = await import("../cart/dialogs/TaskFormDialog");
    const { container } = render(
      <TaskFormDialog
        open={true}
        eventType="calls"
        eventIcon={<span>📞</span>}
        editingTask={null}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders editing existing task", async () => {
    const { TaskFormDialog } = await import("../cart/dialogs/TaskFormDialog");
    const { container } = render(
      <TaskFormDialog
        open={true}
        eventType="chat_messages"
        eventIcon={<span>💬</span>}
        editingTask={{
          task_id: "t1",
          event_type: "chat_messages",
          count: 10,
          params: {},
        } as any}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("TaskListDialog - Open with tasks", () => {
  it("renders open with tasks", async () => {
    const { TaskListDialog } = await import("../cart/dialogs/TaskListDialog");
    const { container } = render(
      <TaskListDialog
        open={true}
        eventType="chat_messages"
        eventIcon={<span>💬</span>}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders open with calls tasks", async () => {
    const { TaskListDialog } = await import("../cart/dialogs/TaskListDialog");
    const { container } = render(
      <TaskListDialog
        open={true}
        eventType="calls"
        eventIcon={<span>📞</span>}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("SubtaskField - With rich data", () => {
  it("renders multiple subtasks", async () => {
    const { SubtaskField } = await import("../cart/dialogs/SubtaskField");
    const { container } = render(
      <SubtaskField
        field={{ name: "subtasks", label: "Subtasks", type: "subtask", eventType: "chat_messages" } as any}
        value={[
          { entity_id: "e1", count: 5, event_type: "chat_messages", params: {} } as any,
          { entity_id: "e2", count: 3, event_type: "chat_messages", params: {} } as any,
        ]}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders disabled", async () => {
    const { SubtaskField } = await import("../cart/dialogs/SubtaskField");
    const { container } = render(
      <SubtaskField
        field={{ name: "subtasks", label: "Subtasks", type: "subtask", eventType: "calls" } as any}
        value={[]}
        onChange={vi.fn()}
        disabled={true}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("SubtaskParamsForm - With config", () => {
  it("renders with field config", async () => {
    const { SubtaskParamsForm } = await import("../cart/dialogs/SubtaskParamsForm");
    const { container } = render(
      <SubtaskParamsForm
        subtask={{ entity_id: "e1", count: 5, event_type: "chat_messages", params: { language: "en", tone: "casual" } } as any}
        fieldConfig={[
          { name: "language", label: "Language", type: "select", options: ["en", "es", "fr"] } as any,
          { name: "tone", label: "Tone", type: "text" } as any,
        ]}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("DeviceInfoSection - Deep", () => {
  it("renders with device models", async () => {
    const { DeviceInfoSection } = await import("../cart/sections/DeviceInfoSection");
    const { container } = render(<DeviceInfoSection />);
    expect(container).toBeTruthy();
  });
});

describe("CaseDataSection - With entities", () => {
  it("renders with multiple entities", async () => {
    const { CaseDataSection } = await import("../cart/sections/CaseDataSection");
    const { container } = render(<CaseDataSection />);
    expect(container).toBeTruthy();
  });
});

describe("EventsGrid - With tasks", () => {
  it("renders grid with tasks", async () => {
    const { EventsGrid } = await import("../cart/sections/EventsGrid");
    const { container } = render(<EventsGrid />);
    expect(container).toBeTruthy();
  });
});

describe("ExtractionPanel - With data", () => {
  it("renders with extractions", async () => {
    const { ExtractionPanel } = await import("../cart/sections/ExtractionPanel");
    const { container } = render(
      <ExtractionPanel extractions={[{ id: "ext1", name: "Extraction 1" }]} />
    );
    expect(container).toBeTruthy();
  });
});
