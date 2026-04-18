/**
 * Tests for cartStore - Data Integrity Focus
 *
 * Priority: CRITICAL
 * These tests ensure no data loss during cart operations and state management.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCartStore } from "../cartStore";
import { draftApi } from "../../api/draftApi";
import type {
  GenerationJob,
  Entity,
  StoryData,
  GenerationTask,
  DeviceContext,
  StoriesGraph,
  EventType,
} from "../../types/cart";

// Mock the draftApi
vi.mock("../../api/draftApi", () => ({
  draftApi: {
    updateDeviceContext: vi.fn(),
    updateDeviceInfo: vi.fn(),
    updateOwnerEntity: vi.fn(),
    createEntity: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn(),
    createStory: vi.fn(),
    createStories: vi.fn(),
    updateStory: vi.fn(),
    deleteStory: vi.fn(),
    createCustomEvent: vi.fn(),
    updateCustomEvent: vi.fn(),
    deleteCustomEvent: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

describe("cartStore - Data Integrity Tests", () => {
  // Helper to create mock stories graph
  const createEmptyStoriesGraph = (): StoriesGraph => ({
    directed: true,
    multigraph: false,
    graph: {},
    nodes: [],
    edges: [],
  });

  // Helper to create mock job data
  const createMockJob = (
    overrides?: Partial<GenerationJob>
  ): GenerationJob => ({
    job_id: "job-123",
    name: "Test Job",
    status: "Draft",
    context: {
      device: {
        manufacturer: "Apple",
        name: "iPhone 12",
        os: "ios",
      },
      start_date: "2024-01-01",
      end_date: "2024-01-31",
      country_info: {
        name: "United States",
        alpha2: "US",
        alpha3: "USA",
        timezones: ["America/New_York"],
        languages: ["en"],
      },
    },
    device_info: [],
    owner_entity: null,
    entities: [],
    stories: createEmptyStoriesGraph(),
    custom_events: [],
    tasks: [],
    ...overrides,
  });

  beforeEach(() => {
    // Reset store state before each test
    const store = useCartStore.getState();
    store.setCurrentJob(null);
    store.closeCart();
    store.clearError();
    vi.clearAllMocks();
  });

  describe("Basic Store Operations", () => {
    it("should initialize with null job", () => {
      const { job, currentJobId } = useCartStore.getState();
      expect(job).toBeNull();
      expect(currentJobId).toBeNull();
    });

    it("should sync job data without loss", () => {
      const mockJob = createMockJob();
      const { syncFromJob } = useCartStore.getState();

      syncFromJob(mockJob);

      const { job, currentJobId } = useCartStore.getState();
      expect(job).toEqual(mockJob);
      expect(currentJobId).toBe("job-123");
    });

    it("should preserve all job properties during sync", () => {
      const complexJob = createMockJob({
        entities: [
          {
            uid: "e1",
            is_owner: false,
            first_name: "John",
            last_name: "Doe",
            phone: "123-456-7890",
            email: "john@test.com",
            is_male: true,
          },
        ],
        stories: {
          directed: true,
          multigraph: false,
          graph: {},
          nodes: [
            {
              id: "s1",
              data: {
                story_id: "s1",
                story_type: "sms/mms",
                user_description: "Test SMS",
                time: "2024-01-15T10:00:00Z",
              },
            },
          ],
          edges: [],
        },
        custom_events: [
          { event_id: "ce1", model_type: "test_model", fields: {} },
        ],
        tasks: [{ task_id: "t1", event_type: "chat messages", quantity: 10 }],
      });

      const { syncFromJob } = useCartStore.getState();
      syncFromJob(complexJob);

      const { job } = useCartStore.getState();
      expect(job?.entities).toEqual(complexJob.entities);
      expect(job?.stories).toEqual(complexJob.stories);
      expect(job?.custom_events).toEqual(complexJob.custom_events);
      expect(job?.tasks).toEqual(complexJob.tasks);
      expect(job?.context).toEqual(complexJob.context);
    });

    it("should clear job when setting to null", () => {
      const mockJob = createMockJob();
      const { syncFromJob, setCurrentJob } = useCartStore.getState();

      syncFromJob(mockJob);
      expect(useCartStore.getState().job).not.toBeNull();

      setCurrentJob(null);

      const { job, currentJobId } = useCartStore.getState();
      expect(job).toBeNull();
      expect(currentJobId).toBeNull();
    });
  });

  describe("Entity Operations - Data Integrity", () => {
    it("should add entity and preserve existing data", async () => {
      const mockJob = createMockJob({
        entities: [
          {
            uid: "e1",
            is_owner: false,
            first_name: "Existing",
            last_name: "Entity",
            phone: null,
            email: null,
            is_male: null,
          },
        ],
      });

      const newEntity: Entity = {
        uid: "e2",
        is_owner: false,
        first_name: "New",
        last_name: "Entity",
        phone: "555-1234",
        email: "new@test.com",
        is_male: true,
      };

      const updatedJob = createMockJob({
        entities: [...mockJob.entities, newEntity],
      });

      vi.mocked(draftApi.createEntity).mockResolvedValue(updatedJob);

      const { syncFromJob, addEntity } = useCartStore.getState();
      syncFromJob(mockJob);

      const result = await addEntity({
        first_name: "New",
        last_name: "Entity",
        phone: "555-1234",
        email: "new@test.com",
        is_male: true,
      });

      const { job } = useCartStore.getState();
      expect(job?.entities).toHaveLength(2);
      expect(job?.entities[0].uid).toBe("e1"); // Original entity preserved
      expect(job?.entities[1].uid).toBe("e2"); // New entity added
      expect(result?.uid).toBe("e2");
    });

    it("should update entity without affecting other entities", async () => {
      const mockJob = createMockJob({
        entities: [
          {
            uid: "e1",
            is_owner: false,
            first_name: "Entity1",
            last_name: "Test",
            phone: null,
            email: null,
            is_male: null,
          },
          {
            uid: "e2",
            is_owner: false,
            first_name: "Entity2",
            last_name: "Test",
            phone: null,
            email: null,
            is_male: null,
          },
        ],
      });

      const updatedJob = createMockJob({
        entities: [
          mockJob.entities[0],
          { ...mockJob.entities[1], first_name: "Updated", phone: "555-9999" },
        ],
      });

      vi.mocked(draftApi.updateEntity).mockResolvedValue(updatedJob);

      const { syncFromJob, updateEntity } = useCartStore.getState();
      syncFromJob(mockJob);

      await updateEntity("e2", { first_name: "Updated", phone: "555-9999" });

      const { job } = useCartStore.getState();
      expect(job?.entities).toHaveLength(2);
      expect(job?.entities[0].first_name).toBe("Entity1"); // Unchanged
      expect(job?.entities[1].first_name).toBe("Updated"); // Changed
      expect(job?.entities[1].phone).toBe("555-9999");
    });

    it("should delete entity without affecting others", async () => {
      const mockJob = createMockJob({
        entities: [
          {
            uid: "e1",
            is_owner: false,
            first_name: "Entity1",
            last_name: "Test",
            phone: null,
            email: null,
            is_male: null,
          },
          {
            uid: "e2",
            is_owner: false,
            first_name: "Entity2",
            last_name: "Test",
            phone: null,
            email: null,
            is_male: null,
          },
          {
            uid: "e3",
            is_owner: false,
            first_name: "Entity3",
            last_name: "Test",
            phone: null,
            email: null,
            is_male: null,
          },
        ],
      });

      const updatedJob = createMockJob({
        entities: [mockJob.entities[0], mockJob.entities[2]],
      });

      vi.mocked(draftApi.deleteEntity).mockResolvedValue(updatedJob);

      const { syncFromJob, deleteEntity } = useCartStore.getState();
      syncFromJob(mockJob);

      await deleteEntity("e2");

      const { job } = useCartStore.getState();
      expect(job?.entities).toHaveLength(2);
      expect(job?.entities.find((e) => e.uid === "e2")).toBeUndefined();
      expect(job?.entities[0].uid).toBe("e1");
      expect(job?.entities[1].uid).toBe("e3");
    });

    it("should handle API errors without corrupting state", async () => {
      const mockJob = createMockJob({
        entities: [
          {
            uid: "e1",
            is_owner: false,
            first_name: "Original",
            last_name: "Entity",
            phone: null,
            email: null,
            is_male: null,
          },
        ],
      });

      vi.mocked(draftApi.updateEntity).mockRejectedValue(
        new Error("Network error")
      );

      const { syncFromJob, updateEntity } = useCartStore.getState();
      syncFromJob(mockJob);

      const originalJob = JSON.parse(JSON.stringify(mockJob));

      try {
        await updateEntity("e1", { first_name: "Failed Update" });
      } catch (error) {
        // Expected to fail
      }

      const { job, error: storeError } = useCartStore.getState();
      // State should remain unchanged after error
      expect(job?.entities[0].first_name).toBe("Original");
      expect(storeError).toBe("Network error"); // Error message is passed through from the Error object
      expect(job).toEqual(originalJob);
    });
  });

  describe("Story Operations - Data Integrity", () => {
    it("should add story without losing existing stories", async () => {
      const existingStoryData: StoryData = {
        story_id: "s1",
        story_type: "sms/mms",
        user_description: "Existing",
        time: "2024-01-01T10:00:00Z",
      };

      const mockJob = createMockJob({
        stories: {
          directed: true,
          multigraph: false,
          graph: {},
          nodes: [{ id: "s1", data: existingStoryData }],
          edges: [],
        },
      });

      const newStoryData: StoryData = {
        story_id: "s2",
        story_type: "call",
        user_description: "New Call",
        time: "2024-01-02T10:00:00Z",
      };

      const updatedJob = createMockJob({
        stories: {
          directed: true,
          multigraph: false,
          graph: {},
          nodes: [
            { id: "s1", data: existingStoryData },
            { id: "s2", data: newStoryData },
          ],
          edges: [],
        },
      });

      vi.mocked(draftApi.createStory).mockResolvedValue(updatedJob);

      const { syncFromJob, addStory } = useCartStore.getState();
      syncFromJob(mockJob);

      await addStory(newStoryData);

      const { job } = useCartStore.getState();
      expect(job?.stories?.nodes).toHaveLength(2);
      expect(job?.stories?.nodes[0].id).toBe("s1");
      expect(job?.stories?.nodes[1].id).toBe("s2");
    });

    it("should update story without affecting others", async () => {
      const story1: StoryData = {
        story_id: "s1",
        story_type: "sms/mms",
        user_description: "Story1",
        time: "2024-01-01T10:00:00Z",
      };

      const story2: StoryData = {
        story_id: "s2",
        story_type: "call",
        user_description: "Story2",
        time: "2024-01-02T10:00:00Z",
      };

      const mockJob = createMockJob({
        stories: {
          directed: true,
          multigraph: false,
          graph: {},
          nodes: [
            { id: "s1", data: story1 },
            { id: "s2", data: story2 },
          ],
          edges: [],
        },
      });

      const updatedStory2 = { ...story2, user_description: "Updated Story" };

      const updatedJob = createMockJob({
        stories: {
          directed: true,
          multigraph: false,
          graph: {},
          nodes: [
            { id: "s1", data: story1 },
            { id: "s2", data: updatedStory2 },
          ],
          edges: [],
        },
      });

      vi.mocked(draftApi.updateStory).mockResolvedValue(updatedJob);

      const { syncFromJob, updateStory } = useCartStore.getState();
      syncFromJob(mockJob);

      await updateStory("s2", { user_description: "Updated Story" });

      const { job } = useCartStore.getState();
      expect(job?.stories?.nodes).toHaveLength(2);
      expect(job?.stories?.nodes[0].data.user_description).toBe("Story1"); // Unchanged
      expect(job?.stories?.nodes[1].data.user_description).toBe(
        "Updated Story"
      ); // Changed
    });

    it("should delete story without affecting others", async () => {
      const mockJob = createMockJob({
        stories: {
          directed: true,
          multigraph: false,
          graph: {},
          nodes: [
            {
              id: "s1",
              data: {
                story_id: "s1",
                story_type: "sms/mms",
                user_description: "Story1",
                time: "2024-01-01T10:00:00Z",
              },
            },
            {
              id: "s2",
              data: {
                story_id: "s2",
                story_type: "call",
                user_description: "Story2",
                time: "2024-01-02T10:00:00Z",
              },
            },
            {
              id: "s3",
              data: {
                story_id: "s3",
                story_type: "email",
                user_description: "Story3",
                time: "2024-01-03T10:00:00Z",
              },
            },
          ],
          edges: [],
        },
      });

      const updatedJob = createMockJob({
        stories: {
          directed: true,
          multigraph: false,
          graph: {},
          nodes: [mockJob.stories.nodes[0], mockJob.stories.nodes[2]],
          edges: [],
        },
      });

      vi.mocked(draftApi.deleteStory).mockResolvedValue(updatedJob);

      const { syncFromJob, deleteStory } = useCartStore.getState();
      syncFromJob(mockJob);

      await deleteStory("s2");

      const { job } = useCartStore.getState();
      expect(job?.stories?.nodes).toHaveLength(2);
      expect(job?.stories?.nodes.find((s) => s.id === "s2")).toBeUndefined();
      expect(job?.stories?.nodes[0].id).toBe("s1");
      expect(job?.stories?.nodes[1].id).toBe("s3");
    });
  });

  describe("Task Operations - Data Integrity", () => {
    it("should add task and preserve existing tasks", async () => {
      const mockJob = createMockJob({
        tasks: [
          {
            task_id: "t1",
            event_type: "chat messages" as EventType,
            quantity: 10,
          },
        ],
      });

      const newTask: GenerationTask = {
        task_id: "t2",
        event_type: "images" as EventType,
        quantity: 50,
      };

      const updatedJob = createMockJob({
        tasks: [...mockJob.tasks, newTask],
      });

      vi.mocked(draftApi.createTask).mockResolvedValue({
        job: updatedJob,
        validation: null,
      });

      const { syncFromJob, addTask } = useCartStore.getState();
      syncFromJob(mockJob);

      await addTask(newTask);

      const { job } = useCartStore.getState();
      expect(job?.tasks).toHaveLength(2);
      expect(job?.tasks[0].task_id).toBe("t1");
      expect(job?.tasks[1].task_id).toBe("t2");
    });

    it("should update task without affecting others", async () => {
      const mockJob = createMockJob({
        tasks: [
          {
            task_id: "t1",
            event_type: "chat messages" as EventType,
            quantity: 10,
          },
          { task_id: "t2", event_type: "images" as EventType, quantity: 50 },
        ],
      });

      const updatedJob = createMockJob({
        tasks: [mockJob.tasks[0], { ...mockJob.tasks[1], quantity: 100 }],
      });

      vi.mocked(draftApi.updateTask).mockResolvedValue({
        job: updatedJob,
        validation: null,
      });

      const { syncFromJob, updateTask } = useCartStore.getState();
      syncFromJob(mockJob);

      await updateTask("t2", { quantity: 100 });

      const { job } = useCartStore.getState();
      expect(job?.tasks).toHaveLength(2);
      expect(job?.tasks[0].quantity).toBe(10); // Unchanged
      expect(job?.tasks[1].quantity).toBe(100); // Changed
    });

    it("should handle validation errors from API", async () => {
      const mockJob = createMockJob({
        tasks: [],
      });

      vi.mocked(draftApi.createTask).mockResolvedValue({
        job: null,
        validation: {
          valid: false,
          errors: ["Invalid task type", "Quantity must be positive"],
        },
      });

      const { syncFromJob, addTask } = useCartStore.getState();
      syncFromJob(mockJob);

      await expect(
        addTask({
          event_type: "chat messages" as EventType,
          quantity: -1,
        })
      ).rejects.toThrow("Invalid task type, Quantity must be positive");

      // Original job should remain unchanged
      const { job } = useCartStore.getState();
      expect(job?.tasks).toHaveLength(0);
    });
  });

  describe("Device Context Operations", () => {
    it("should update device context without losing job data", async () => {
      const mockJob = createMockJob({
        entities: [
          {
            uid: "e1",
            is_owner: false,
            first_name: "Test",
            last_name: "Entity",
            phone: null,
            email: null,
            is_male: null,
          },
        ],
        tasks: [
          {
            task_id: "t1",
            event_type: "chat messages" as EventType,
            quantity: 10,
          },
        ],
      });

      const newContext: DeviceContext = {
        device: {
          manufacturer: "Samsung",
          name: "Galaxy S21",
          os: "android",
        },
        start_date: "2024-02-01",
        end_date: "2024-02-28",
        country_info: {
          name: "Canada",
          alpha2: "CA",
          alpha3: "CAN",
          timezones: ["America/Toronto"],
          languages: ["en", "fr"],
        },
      };

      const updatedJob = {
        ...mockJob,
        context: newContext,
      };

      vi.mocked(draftApi.updateDeviceContext).mockResolvedValue(updatedJob);

      const { syncFromJob, updateDeviceContext } = useCartStore.getState();
      syncFromJob(mockJob);

      await updateDeviceContext(newContext);

      const { job } = useCartStore.getState();
      expect(job?.context).toEqual(newContext);
      // Ensure other data is preserved
      expect(job?.entities).toHaveLength(1);
      expect(job?.tasks).toHaveLength(1);
      expect(job?.entities[0].uid).toBe("e1");
      expect(job?.tasks[0].task_id).toBe("t1");
    });
  });

  describe("Computed Values", () => {
    it("should calculate total item count correctly", () => {
      const mockJob = createMockJob({
        tasks: [
          {
            task_id: "t1",
            event_type: "chat messages" as EventType,
            quantity: 10,
          },
          { task_id: "t2", event_type: "images" as EventType, quantity: 25 },
        ],
        stories: {
          directed: true,
          multigraph: false,
          graph: {},
          nodes: [
            {
              id: "s1",
              data: {
                story_id: "s1",
                story_type: "sms/mms",
                user_description: "Story1",
                time: "2024-01-01T10:00:00Z",
              },
            },
            {
              id: "s2",
              data: {
                story_id: "s2",
                story_type: "call",
                user_description: "Story2",
                time: "2024-01-02T10:00:00Z",
              },
            },
          ],
          edges: [],
        },
      });

      const { syncFromJob, getTotalItemCount } = useCartStore.getState();
      syncFromJob(mockJob);

      const count = getTotalItemCount();
      // 10 (task1) + 25 (task2) + 2 (stories) = 37
      expect(count).toBe(37);
    });

    it("should calculate section item counts correctly", () => {
      const mockJob = createMockJob({
        entities: [
          {
            uid: "e1",
            is_owner: false,
            first_name: "Entity1",
            last_name: "Test",
            phone: null,
            email: null,
            is_male: null,
          },
          {
            uid: "e2",
            is_owner: false,
            first_name: "Entity2",
            last_name: "Test",
            phone: null,
            email: null,
            is_male: null,
          },
        ],
        owner_entity: {
          uid: "owner",
          is_owner: true,
          first_name: "Owner",
          last_name: "Entity",
          phone: null,
          email: null,
          is_male: null,
        },
        tasks: [
          {
            task_id: "t1",
            event_type: "chat messages" as EventType,
            quantity: 10,
          },
        ],
        stories: {
          directed: true,
          multigraph: false,
          graph: {},
          nodes: [
            {
              id: "s1",
              data: {
                story_id: "s1",
                story_type: "sms/mms",
                user_description: "Story1",
                time: "2024-01-01T10:00:00Z",
              },
            },
          ],
          edges: [],
        },
        custom_events: [{ event_id: "ce1", model_type: "test", fields: {} }],
      });

      const { syncFromJob, getSectionItemCount } = useCartStore.getState();
      syncFromJob(mockJob);

      expect(getSectionItemCount("deviceContext")).toBe(1);
      expect(getSectionItemCount("tasks")).toBe(1);
      expect(getSectionItemCount("stories")).toBe(1);
      expect(getSectionItemCount("entities")).toBe(3); // 2 entities + 1 owner
      expect(getSectionItemCount("customEvents")).toBe(1);
    });
  });

  describe("UI State Management", () => {
    it("should toggle cart open/close", () => {
      const { openCart, closeCart, toggleCart } = useCartStore.getState();

      expect(useCartStore.getState().isOpen).toBe(false);

      openCart();
      expect(useCartStore.getState().isOpen).toBe(true);

      closeCart();
      expect(useCartStore.getState().isOpen).toBe(false);

      toggleCart();
      expect(useCartStore.getState().isOpen).toBe(true);

      toggleCart();
      expect(useCartStore.getState().isOpen).toBe(false);
    });

    it("should toggle sections independently", () => {
      const { toggleSection } = useCartStore.getState();

      const initialState = useCartStore.getState().expandedSections;
      expect(initialState.deviceContext).toBe(true);
      expect(initialState.stories).toBe(false);

      toggleSection("deviceContext");
      expect(useCartStore.getState().expandedSections.deviceContext).toBe(
        false
      );
      expect(useCartStore.getState().expandedSections.stories).toBe(false);

      toggleSection("stories");
      expect(useCartStore.getState().expandedSections.deviceContext).toBe(
        false
      );
      expect(useCartStore.getState().expandedSections.stories).toBe(true);
    });

    describe("Error Handling", () => {
      it("should set and clear errors", () => {
        const { setError, clearError } = useCartStore.getState();

        setError("Test error message");
        expect(useCartStore.getState().error).toBe("Test error message");

        clearError();
        expect(useCartStore.getState().error).toBeNull();
      });

      it("should set error on API failure and preserve isSaving state", async () => {
        const mockJob = createMockJob();
        vi.mocked(draftApi.createEntity).mockRejectedValue(
          new Error("API Error")
        );

        const { syncFromJob, addEntity } = useCartStore.getState();
        syncFromJob(mockJob);

        await expect(
          addEntity({
            first_name: "Test",
            last_name: "Entity",
          })
        ).rejects.toThrow("API Error");

        expect(useCartStore.getState().error).toBe("API Error");
        expect(useCartStore.getState().isSaving).toBe(false);
      });
    });

    describe("Loading States", () => {
      it("should manage loading state", () => {
        const { setIsLoading } = useCartStore.getState();

        expect(useCartStore.getState().isLoading).toBe(false);

        setIsLoading(true);
        expect(useCartStore.getState().isLoading).toBe(true);

        setIsLoading(false);
        expect(useCartStore.getState().isLoading).toBe(false);
      });

      it("should set isSaving during async operations", async () => {
        const mockJob = createMockJob();
        const updatedJob = createMockJob({
          entities: [
            {
              uid: "e1",
              is_owner: false,
              first_name: "New",
              last_name: "Entity",
              phone: null,
              email: null,
              is_male: null,
            },
          ],
        });

        let resolveMock: (value: GenerationJob) => void;
        const mockPromise = new Promise<GenerationJob>((resolve) => {
          resolveMock = resolve;
        });

        vi.mocked(draftApi.createEntity).mockReturnValue(mockPromise);

        const { syncFromJob, addEntity } = useCartStore.getState();
        syncFromJob(mockJob);

        const addPromise = addEntity({
          first_name: "New",
          last_name: "Entity",
        });

        // Should be saving during the operation
        expect(useCartStore.getState().isSaving).toBe(true);

        // Resolve the mock
        resolveMock!(updatedJob);
        await addPromise;

        // Should no longer be saving after completion
        expect(useCartStore.getState().isSaving).toBe(false);
      });
    });
  });
});
