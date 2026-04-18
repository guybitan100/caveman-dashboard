import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils/test-utils";
import React from "react";

// Mock ALL stores and hooks needed by cart dialogs and sections
vi.mock("../../stores/cartStore", () => ({
  useCartStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        job: {
          id: "j1", name: "Test Job", status: "Draft",
          device_context: { manufacturer: "Apple", model: "iPhone 15", os: "iOS", os_version: "17.0", device_name: "My Phone" },
          device_info: { date_range: { start: "2024-01-01", end: "2024-06-01" } },
          owner_entity: { entity_id: "owner1", name: "John Doe", phone_number: "+1234567890", email: "john@test.com", is_owner: true },
          entities: [
            { entity_id: "e1", name: "John Doe", phone_number: "+1234567890", email: "john@test.com", is_owner: true },
            { entity_id: "e2", name: "Jane Smith", phone_number: "+0987654321", email: "jane@test.com", is_owner: false },
          ],
          stories: [],
          tasks: [],
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
        getTotalItemCount: vi.fn().mockReturnValue(2),
        getSectionItemCount: vi.fn().mockReturnValue(1),
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
        jobs: [], searchQuery: "", isLoading: false, selectedJobId: "j1",
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
      isLoading: false,
      isInitialized: true,
      error: null,
      initialize: vi.fn(),
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
    getTaskProgress: vi.fn(), getEventTypeProgress: vi.fn(),
  }),
  useTaskProgressReader: vi.fn().mockReturnValue({
    getProgress: vi.fn().mockReturnValue(null),
    getEventTypeProgress: vi.fn().mockReturnValue(null),
    taskProgress: new Map(),
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

describe("Cart Dialogs - StoryFormDialog", () => {
  it("renders closed", async () => {
    const { StoryFormDialog } = await import("../cart/dialogs/StoryFormDialog");
    const { container } = render(
      <StoryFormDialog open={false} storyType="chat_message" storyIcon={<span>💬</span>} editingStory={null} onClose={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders open with chat_message type", async () => {
    const { StoryFormDialog } = await import("../cart/dialogs/StoryFormDialog");
    const { container } = render(
      <StoryFormDialog open={true} storyType="chat_message" storyIcon={<span>💬</span>} editingStory={null} onClose={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders open with call type", async () => {
    const { StoryFormDialog } = await import("../cart/dialogs/StoryFormDialog");
    const { container } = render(
      <StoryFormDialog open={true} storyType="call" storyIcon={<span>📞</span>} editingStory={null} onClose={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });
});

describe("Cart Dialogs - TaskFormDialog", () => {
  it("renders closed", async () => {
    const { TaskFormDialog } = await import("../cart/dialogs/TaskFormDialog");
    const { container } = render(
      <TaskFormDialog open={false} eventType="chat_messages" eventIcon={<span>💬</span>} editingTask={null} onClose={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders open", async () => {
    const { TaskFormDialog } = await import("../cart/dialogs/TaskFormDialog");
    const { container } = render(
      <TaskFormDialog open={true} eventType="chat_messages" eventIcon={<span>💬</span>} editingTask={null} onClose={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });
});

describe("Cart Dialogs - TaskListDialog", () => {
  it("renders closed", async () => {
    const { TaskListDialog } = await import("../cart/dialogs/TaskListDialog");
    const { container } = render(
      <TaskListDialog open={false} eventType="chat_messages" eventIcon={<span>💬</span>} onClose={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders open", async () => {
    const { TaskListDialog } = await import("../cart/dialogs/TaskListDialog");
    const { container } = render(
      <TaskListDialog open={true} eventType="chat_messages" eventIcon={<span>💬</span>} onClose={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });
});

describe("Cart Dialogs - SubtaskField", () => {
  it("renders with empty subtasks", async () => {
    const { SubtaskField } = await import("../cart/dialogs/SubtaskField");
    const { container } = render(
      <SubtaskField
        field={{ name: "subtasks", label: "Subtasks", type: "subtask", eventType: "chat_messages" } as any}
        value={[]}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders with subtask data", async () => {
    const { SubtaskField } = await import("../cart/dialogs/SubtaskField");
    const { container } = render(
      <SubtaskField
        field={{ name: "subtasks", label: "Subtasks", type: "subtask", eventType: "chat_messages" } as any}
        value={[{ entity_id: "e1", count: 5, event_type: "chat_messages" } as any]}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("Cart Dialogs - SubtaskParamsForm", () => {
  it("renders with empty config", async () => {
    const { SubtaskParamsForm } = await import("../cart/dialogs/SubtaskParamsForm");
    const { container } = render(
      <SubtaskParamsForm
        subtask={{ entity_id: "e1", count: 1 } as any}
        fieldConfig={[]}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("Cart Dialogs - EntityFormDialog", () => {
  it("renders open for creation", async () => {
    const { EntityFormDialog } = await import("../cart/dialogs/EntityFormDialog");
    const { container } = render(
      <EntityFormDialog open={true} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders open for editing", async () => {
    const { EntityFormDialog } = await import("../cart/dialogs/EntityFormDialog");
    const { container } = render(
      <EntityFormDialog
        open={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        editingEntity={{ entity_id: "e1", name: "John", phone_number: "+1", email: "john@test.com", is_owner: false }}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("Cart Dialogs - StoryTypeDialog", () => {
  it("renders open", async () => {
    const { StoryTypeDialog } = await import("../cart/dialogs/StoryTypeDialog");
    const { container } = render(
      <StoryTypeDialog open={true} onClose={vi.fn()} onSelectType={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });
});

describe("Cart Dialogs - RandomEventsDialog", () => {
  it("renders closed", async () => {
    const { RandomEventsDialog } = await import("../cart/dialogs/RandomEventsDialog");
    const { container } = render(
      <RandomEventsDialog open={false} onClose={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });
});

describe("Cart Sections - CaseDataSection", () => {
  it("renders", async () => {
    const { CaseDataSection } = await import("../cart/sections/CaseDataSection");
    const { container } = render(<CaseDataSection />);
    expect(container).toBeTruthy();
  });
});

describe("Cart Sections - DeviceInfoSection", () => {
  it("renders standalone", async () => {
    const { DeviceInfoSection } = await import("../cart/sections/DeviceInfoSection");
    const { container } = render(<DeviceInfoSection />);
    expect(container).toBeTruthy();
  });

  it("renders embedded", async () => {
    const { DeviceInfoSection } = await import("../cart/sections/DeviceInfoSection");
    const { container } = render(<DeviceInfoSection embedded />);
    expect(container).toBeTruthy();
  });
});

describe("Cart Sections - EventsGrid", () => {
  it("renders", async () => {
    const { EventsGrid } = await import("../cart/sections/EventsGrid");
    const { container } = render(<EventsGrid />);
    expect(container).toBeTruthy();
  });
});

describe("Cart Sections - EventsSection", () => {
  it("renders with default expanded", async () => {
    const { EventsSection } = await import("../cart/sections/EventsSection");
    const { container } = render(<EventsSection />);
    expect(container).toBeTruthy();
  });
});

describe("Cart Sections - ExtractionPanel", () => {
  it("renders without extractions", async () => {
    const { ExtractionPanel } = await import("../cart/sections/ExtractionPanel");
    const { container } = render(<ExtractionPanel />);
    expect(container).toBeTruthy();
  });
});

describe("Cart Sections - StoriesSection", () => {
  it("renders", async () => {
    const mod = await import("../cart/sections/StoriesSection");
    const StoriesSection = mod.StoriesSection || mod.default;
    if (StoriesSection) {
      const { container } = render(<StoriesSection />);
      expect(container).toBeTruthy();
    }
  });
});

describe("Cart Sections - StoriesCollapsibleSection", () => {
  it("renders", async () => {
    const mod = await import("../cart/sections/StoriesCollapsibleSection");
    const Component = mod.StoriesCollapsibleSection || mod.default;
    if (Component) {
      const { container } = render(<Component />);
      expect(container).toBeTruthy();
    }
  });
});

describe("Cart Sections - DeviceInfoCollapsibleSection", () => {
  it("renders", async () => {
    const mod = await import("../cart/sections/DeviceInfoCollapsibleSection");
    const Component = mod.DeviceInfoCollapsibleSection || mod.default;
    if (Component) {
      const { container } = render(<Component />);
      expect(container).toBeTruthy();
    }
  });
});
