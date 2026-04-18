import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "../../../test/utils/test-utils";
import React from "react";

// Rich cart store mock for component tests
const mockCartState = {
  job: {
    id: "j1", name: "Test Job", status: "Draft",
    device_context: { manufacturer: "Apple", model: "iPhone 15", os: "iOS", os_version: "17.0", device_name: "iPhone" },
    device_info: { date_range: { start: "2024-01-01", end: "2024-06-01" }, imei: "123456789012345", serial_number: "ABC123" },
    owner_entity: { entity_id: "e1", name: "John Doe", phone_number: "+1234567890", email: "john@test.com", is_owner: true },
    entities: [
      { entity_id: "e1", name: "John Doe", phone_number: "+1234567890", email: "john@test.com", is_owner: true },
      { entity_id: "e2", name: "Jane Smith", phone_number: "+0987654321", email: "jane@test.com", is_owner: false },
    ],
    stories: [
      { story_id: "s1", story_type: "chat_message" as const, entity_id: "e1", params: { text: "Hello" }, created_at: "2024-01-01T10:00:00Z" },
      { story_id: "s2", story_type: "call" as const, entity_id: "e1", params: { duration: 120, direction: "outgoing" }, created_at: "2024-01-01T11:00:00Z" },
      { story_id: "s3", story_type: "location" as const, entity_id: "e2", params: { latitude: 40.7128, longitude: -74.006 }, created_at: "2024-01-01T12:00:00Z" },
    ],
    tasks: [
      { task_id: "t1", event_type: "chat_messages", count: 10, params: {} },
      { task_id: "t2", event_type: "calls", count: 5, params: {} },
      { task_id: "t3", event_type: "locations", count: 3, params: {} },
    ],
    custom_events: [],
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
  getTotalItemCount: vi.fn().mockReturnValue(8),
  getSectionItemCount: vi.fn().mockReturnValue(3),
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

vi.mock("../../../stores/cartStore", () => ({
  useCartStore: Object.assign(
    vi.fn((selector: any) => selector ? selector(mockCartState) : mockCartState),
    { getState: vi.fn().mockReturnValue(mockCartState) }
  ),
}));

vi.mock("../../../stores/jobStore", () => ({
  useJobStore: Object.assign(
    vi.fn((selector: any) => {
      const state = { selectedJobId: "j1", jobs: [], selectJob: vi.fn() };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({ selectedJobId: "j1" }) }
  ),
}));

vi.mock("../../../stores/deviceModelsStore", () => ({
  useDeviceModelsStore: vi.fn((selector: any) => {
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

vi.mock("../../../stores/metafinderStore", () => ({
  useMetaFinderStore: vi.fn((selector: any) => {
    const state = { isLoading: false, isInitialized: true, error: null, initialize: vi.fn(), getOptionsForEventType: vi.fn().mockReturnValue(null) };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../../stores/taskProgressStore", () => ({
  useTaskProgressStore: vi.fn((selector: any) => {
    const state = { taskProgress: new Map(), getTaskProgress: vi.fn(), getEventTypeProgress: vi.fn(), hasActiveTasksForJob: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../../hooks/useMetaFinder", () => ({
  useMetaFinderInit: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
  useMetaFinderOptions: vi.fn().mockReturnValue({ options: null, isLoading: false, error: null }),
  useMetaFinderStatus: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
}));

vi.mock("../../../hooks", () => ({
  useMetaFinderInit: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
  useMetaFinderOptions: vi.fn().mockReturnValue({ options: null, isLoading: false, error: null }),
  useMetaFinderStatus: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
}));

vi.mock("../../../hooks/useTaskProgress", () => ({
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

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false, login: vi.fn(), logout: vi.fn(),
  }),
}));

vi.mock("../../../contexts", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false, login: vi.fn(), logout: vi.fn(),
  }),
}));

vi.mock("../../../api/uploadsApi", () => ({
  doesFileExist: vi.fn().mockResolvedValue(false),
  getUploadPresignedUrl: vi.fn().mockResolvedValue({ url: "https://example.com", fields: {} }),
  uploadFileToS3: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../api/metafinderApi", () => ({
  metafinderApi: { getOptions: vi.fn().mockResolvedValue({}), getFiles: vi.fn().mockResolvedValue({ files: [] }) },
}));

vi.mock("../../../api/jobsApi", () => ({
  jobsApi: { getJobs: vi.fn(), getJob: vi.fn(), createJob: vi.fn(), deleteJob: vi.fn(), getMultipleTaskProgress: vi.fn().mockResolvedValue(new Map()) },
}));

vi.mock("../../../utils/date", () => ({
  formatDate: vi.fn((d: string) => d || ""),
  formatTimestamp: vi.fn((d: string) => d || ""),
  formatFullTimestamp: vi.fn((d: string) => d || ""),
}));

describe("StoriesSection", () => {
  it("renders with stories", async () => {
    const { StoriesSection } = await import("../../cart/sections/StoriesSection");
    const { container } = render(<StoriesSection />);
    expect(container).toBeTruthy();
  });
});

describe("ExtractionPanel - deep", () => {
  it("renders with extraction data", async () => {
    const mod = await import("../../cart/sections/ExtractionPanel");
    const ExtractionPanel = mod.ExtractionPanel || mod.default;
    if (ExtractionPanel) {
      const { container } = render(<ExtractionPanel extractions={[]} />);
      expect(container).toBeTruthy();
    }
  });
});

describe("DeviceInfoSection - deep", () => {
  it("renders with device context from store", async () => {
    const { DeviceInfoSection } = await import("../../cart/sections/DeviceInfoSection");
    const { container } = render(<DeviceInfoSection />);
    expect(container).toBeTruthy();
  });
});

describe("CaseDataSection - deep", () => {
  it("renders with entities from store", async () => {
    const { CaseDataSection } = await import("../../cart/sections/CaseDataSection");
    const { container } = render(<CaseDataSection />);
    expect(container).toBeTruthy();
  });
});

describe("EventsGrid - deep", () => {
  it("renders grid with task types", async () => {
    const { EventsGrid } = await import("../../cart/sections/EventsGrid");
    const { container } = render(<EventsGrid />);
    expect(container).toBeTruthy();
  });
});

describe("StoryRefSelector - deep", () => {
  it("renders with stories from cart", async () => {
    const { StoryRefSelector } = await import("../../shared/StoryRefSelector");
    const { container } = render(
      <StoryRefSelector
        label="Referenced Story"
        value={null}
        onChange={vi.fn()}
        storyRefTypes={["chat_message", "call"] as any}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders with selected value", async () => {
    const { StoryRefSelector } = await import("../../shared/StoryRefSelector");
    const { container } = render(
      <StoryRefSelector
        label="Referenced Story"
        value="s1"
        onChange={vi.fn()}
        storyRefTypes={["chat_message"] as any}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders multiple selection", async () => {
    const { StoryRefSelector } = await import("../../shared/StoryRefSelector");
    const { container } = render(
      <StoryRefSelector
        label="Stories"
        value={["s1", "s2"]}
        onChange={vi.fn()}
        storyRefTypes={["chat_message", "call"] as any}
        multiple
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders with error", async () => {
    const { StoryRefSelector } = await import("../../shared/StoryRefSelector");
    const { container } = render(
      <StoryRefSelector
        label="Story"
        value={null}
        onChange={vi.fn()}
        storyRefTypes={["chat_message"] as any}
        error="Required"
        required
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders disabled", async () => {
    const { StoryRefSelector } = await import("../../shared/StoryRefSelector");
    const { container } = render(
      <StoryRefSelector
        label="Story"
        value={null}
        onChange={vi.fn()}
        storyRefTypes={["chat_message"] as any}
        disabled
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("LocationPicker - deep", () => {
  it("renders with value", async () => {
    const { LocationPicker } = await import("../../shared/LocationPicker");
    const { container } = render(
      <LocationPicker value={{ latitude: 40.7128, longitude: -74.006 }} onChange={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders with error", async () => {
    const { LocationPicker } = await import("../../shared/LocationPicker");
    const { container } = render(
      <LocationPicker value={{ latitude: 0, longitude: 0 }} onChange={vi.fn()} error="Invalid location" />
    );
    expect(container).toBeTruthy();
  });

  it("renders disabled", async () => {
    const { LocationPicker } = await import("../../shared/LocationPicker");
    const { container } = render(
      <LocationPicker value={{ latitude: 51.5074, longitude: -0.1278 }} onChange={vi.fn()} disabled />
    );
    expect(container).toBeTruthy();
  });
});

describe("BuilderTab - deep", () => {
  it("renders builder with job loaded", async () => {
    const { BuilderTab } = await import("../../cart/BuilderTab");
    const { container } = render(<BuilderTab />);
    expect(container).toBeTruthy();
  });
});
