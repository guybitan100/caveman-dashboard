import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCartStore } from "../cartStore";
import { draftApi } from "../../api/draftApi";
import type {
  GenerationJob,
  StoriesGraph,
  EventType,
} from "../../types/cart";

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
    createRandomEvents: vi.fn(),
  },
}));

const createEmptyStoriesGraph = (): StoriesGraph => ({
  directed: true,
  multigraph: false,
  graph: {},
  nodes: [],
  edges: [],
});

const createMockJob = (overrides?: Partial<GenerationJob>): GenerationJob => ({
  job_id: "job-123",
  name: "Test Job",
  status: "Draft",
  context: {
    device: { manufacturer: "Apple", name: "iPhone 12", os: "ios" },
    start_date: "2024-01-01",
    end_date: "2024-01-31",
    country_info: {
      name: "US",
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

describe("cartStore - Additional Coverage", () => {
  beforeEach(() => {
    const store = useCartStore.getState();
    store.setCurrentJob(null);
    store.closeCart();
    store.clearError();
    vi.clearAllMocks();
  });

  describe("No job selected guard paths", () => {
    it("updateDeviceContext throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().updateDeviceContext({
          device: { manufacturer: "X", name: "X", os: "android" },
          start_date: "2024-01-01",
          end_date: "2024-01-02",
          country_info: { name: "US", alpha2: "US", alpha3: "USA", timezones: [], languages: [] },
        })
      ).rejects.toThrow("No job selected");
    });

    it("updateDeviceInfo throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().updateDeviceInfo([])
      ).rejects.toThrow("No job selected");
    });

    it("updateOwnerEntity throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().updateOwnerEntity({ first_name: "Test", last_name: "User" })
      ).rejects.toThrow("No job selected");
    });

    it("addEntity throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().addEntity({ first_name: "X", last_name: "Y" })
      ).rejects.toThrow("No job selected");
    });

    it("updateEntity throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().updateEntity("e1", { first_name: "Z" })
      ).rejects.toThrow("No job selected");
    });

    it("deleteEntity throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().deleteEntity("e1")
      ).rejects.toThrow("No job selected");
    });

    it("addStory throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().addStory({ story_type: "call", user_description: "x" })
      ).rejects.toThrow("No job selected");
    });

    it("addStories throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().addStories([])
      ).rejects.toThrow("No job selected");
    });

    it("updateStory throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().updateStory("s1", {})
      ).rejects.toThrow("No job selected");
    });

    it("deleteStory throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().deleteStory("s1")
      ).rejects.toThrow("No job selected");
    });

    it("addCustomEvent throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().addCustomEvent({ model_type: "test", fields: {} })
      ).rejects.toThrow("No job selected");
    });

    it("updateCustomEvent throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().updateCustomEvent("ce1", {})
      ).rejects.toThrow("No job selected");
    });

    it("deleteCustomEvent throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().deleteCustomEvent("ce1")
      ).rejects.toThrow("No job selected");
    });

    it("addTask throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().addTask({ event_type: "chat messages" as EventType, quantity: 1 })
      ).rejects.toThrow("No job selected");
    });

    it("updateTask throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().updateTask("t1", {})
      ).rejects.toThrow("No job selected");
    });

    it("deleteTask throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().deleteTask("t1")
      ).rejects.toThrow("No job selected");
    });

    it("createRandomEvents throws without currentJobId", async () => {
      await expect(
        useCartStore.getState().createRandomEvents(10)
      ).rejects.toThrow("No job selected");
    });
  });

  describe("addStories", () => {
    it("adds multiple stories", async () => {
      const mockJob = createMockJob();
      const updatedJob = createMockJob({
        stories: {
          ...createEmptyStoriesGraph(),
          nodes: [
            { id: "s1", data: { story_id: "s1", story_type: "call", user_description: "a", time: "2024-01-01" } },
            { id: "s2", data: { story_id: "s2", story_type: "email", user_description: "b", time: "2024-01-02" } },
          ],
        },
      });

      vi.mocked(draftApi.createStories).mockResolvedValue(updatedJob);
      useCartStore.getState().syncFromJob(mockJob);

      await useCartStore.getState().addStories([
        { story_type: "call", user_description: "a" },
        { story_type: "email", user_description: "b" },
      ]);

      expect(useCartStore.getState().job?.stories?.nodes).toHaveLength(2);
    });

    it("handles addStories error", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.createStories).mockRejectedValue(new Error("Batch fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().addStories([{ story_type: "call", user_description: "x" }])
      ).rejects.toThrow("Batch fail");

      expect(useCartStore.getState().error).toBe("Batch fail");
      expect(useCartStore.getState().isSaving).toBe(false);
    });
  });

  describe("Custom Event Operations", () => {
    it("adds a custom event", async () => {
      const mockJob = createMockJob();
      const updatedJob = createMockJob({
        custom_events: [{ event_id: "ce1", model_type: "test", fields: { key: "val" } }],
      });

      vi.mocked(draftApi.createCustomEvent).mockResolvedValue(updatedJob);
      useCartStore.getState().syncFromJob(mockJob);

      const result = await useCartStore.getState().addCustomEvent({ model_type: "test", fields: { key: "val" } });

      expect(result.event_id).toBe("ce1");
      expect(useCartStore.getState().job?.custom_events).toHaveLength(1);
    });

    it("handles addCustomEvent error", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.createCustomEvent).mockRejectedValue(new Error("Event fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().addCustomEvent({ model_type: "test", fields: {} })
      ).rejects.toThrow("Event fail");

      expect(useCartStore.getState().error).toBe("Event fail");
    });

    it("updates a custom event", async () => {
      const mockJob = createMockJob({
        custom_events: [{ event_id: "ce1", model_type: "test", fields: { a: 1 } }],
      });
      const updatedJob = createMockJob({
        custom_events: [{ event_id: "ce1", model_type: "test", fields: { a: 2 } }],
      });

      vi.mocked(draftApi.updateCustomEvent).mockResolvedValue(updatedJob);
      useCartStore.getState().syncFromJob(mockJob);

      await useCartStore.getState().updateCustomEvent("ce1", { fields: { a: 2 } });

      expect(useCartStore.getState().job?.custom_events[0].fields).toEqual({ a: 2 });
    });

    it("handles updateCustomEvent error", async () => {
      const mockJob = createMockJob({
        custom_events: [{ event_id: "ce1", model_type: "test", fields: {} }],
      });
      vi.mocked(draftApi.updateCustomEvent).mockRejectedValue(new Error("Update fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().updateCustomEvent("ce1", {})
      ).rejects.toThrow("Update fail");

      expect(useCartStore.getState().error).toBe("Update fail");
    });

    it("deletes a custom event", async () => {
      const mockJob = createMockJob({
        custom_events: [
          { event_id: "ce1", model_type: "test", fields: {} },
          { event_id: "ce2", model_type: "test2", fields: {} },
        ],
      });
      const updatedJob = createMockJob({
        custom_events: [{ event_id: "ce2", model_type: "test2", fields: {} }],
      });

      vi.mocked(draftApi.deleteCustomEvent).mockResolvedValue(updatedJob);
      useCartStore.getState().syncFromJob(mockJob);

      await useCartStore.getState().deleteCustomEvent("ce1");

      expect(useCartStore.getState().job?.custom_events).toHaveLength(1);
      expect(useCartStore.getState().job?.custom_events[0].event_id).toBe("ce2");
    });

    it("handles deleteCustomEvent error", async () => {
      const mockJob = createMockJob({
        custom_events: [{ event_id: "ce1", model_type: "test", fields: {} }],
      });
      vi.mocked(draftApi.deleteCustomEvent).mockRejectedValue(new Error("Delete fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().deleteCustomEvent("ce1")
      ).rejects.toThrow("Delete fail");

      expect(useCartStore.getState().error).toBe("Delete fail");
    });
  });

  describe("deleteTask", () => {
    it("deletes a task", async () => {
      const mockJob = createMockJob({
        tasks: [
          { task_id: "t1", event_type: "chat messages" as EventType, quantity: 10 },
          { task_id: "t2", event_type: "images" as EventType, quantity: 5 },
        ],
      });
      const updatedJob = createMockJob({
        tasks: [{ task_id: "t2", event_type: "images" as EventType, quantity: 5 }],
      });

      vi.mocked(draftApi.deleteTask).mockResolvedValue(updatedJob);
      useCartStore.getState().syncFromJob(mockJob);

      await useCartStore.getState().deleteTask("t1");

      expect(useCartStore.getState().job?.tasks).toHaveLength(1);
      expect(useCartStore.getState().job?.tasks[0].task_id).toBe("t2");
    });

    it("handles deleteTask error", async () => {
      const mockJob = createMockJob({
        tasks: [{ task_id: "t1", event_type: "images" as EventType, quantity: 5 }],
      });
      vi.mocked(draftApi.deleteTask).mockRejectedValue(new Error("Delete task fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().deleteTask("t1")
      ).rejects.toThrow("Delete task fail");

      expect(useCartStore.getState().error).toBe("Delete task fail");
    });
  });

  describe("updateTask error", () => {
    it("handles updateTask API error", async () => {
      const mockJob = createMockJob({
        tasks: [{ task_id: "t1", event_type: "images" as EventType, quantity: 5 }],
      });
      vi.mocked(draftApi.updateTask).mockRejectedValue(new Error("Update task fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().updateTask("t1", { quantity: 100 })
      ).rejects.toThrow("Update task fail");

      expect(useCartStore.getState().error).toBe("Update task fail");
    });
  });

  describe("createRandomEvents", () => {
    it("creates random events", async () => {
      const mockJob = createMockJob();
      const updatedJob = createMockJob({
        custom_events: [
          { event_id: "ce1", model_type: "random", fields: {} },
          { event_id: "ce2", model_type: "random", fields: {} },
        ],
      });

      vi.mocked(draftApi.createRandomEvents).mockResolvedValue(updatedJob);
      useCartStore.getState().syncFromJob(mockJob);

      await useCartStore.getState().createRandomEvents(10);

      expect(draftApi.createRandomEvents).toHaveBeenCalledWith("job-123", { total_events: 10 });
      expect(useCartStore.getState().job?.custom_events).toHaveLength(2);
    });

    it("handles createRandomEvents error", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.createRandomEvents).mockRejectedValue(new Error("Random fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().createRandomEvents(10)
      ).rejects.toThrow("Random fail");

      expect(useCartStore.getState().error).toBe("Random fail");
    });
  });

  describe("updateDeviceInfo", () => {
    it("updates device info", async () => {
      const mockJob = createMockJob();
      const updatedJob = createMockJob({ device_info: [{ key: "model", value: "iPhone" }] as any });

      vi.mocked(draftApi.updateDeviceInfo).mockResolvedValue(updatedJob);
      useCartStore.getState().syncFromJob(mockJob);

      await useCartStore.getState().updateDeviceInfo([{ key: "model", value: "iPhone" }] as any);

      expect(useCartStore.getState().isSaving).toBe(false);
    });

    it("handles updateDeviceInfo error", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.updateDeviceInfo).mockRejectedValue(new Error("Info fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().updateDeviceInfo([])
      ).rejects.toThrow("Info fail");

      expect(useCartStore.getState().error).toBe("Info fail");
    });
  });

  describe("updateOwnerEntity", () => {
    it("updates owner entity", async () => {
      const mockJob = createMockJob();
      const updatedJob = createMockJob({
        owner_entity: { uid: "o1", is_owner: true, first_name: "Owner", last_name: "User", phone: null, email: null, is_male: null },
      });

      vi.mocked(draftApi.updateOwnerEntity).mockResolvedValue(updatedJob);
      useCartStore.getState().syncFromJob(mockJob);

      await useCartStore.getState().updateOwnerEntity({ first_name: "Owner", last_name: "User" });

      expect(useCartStore.getState().job?.owner_entity?.first_name).toBe("Owner");
    });

    it("handles updateOwnerEntity error", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.updateOwnerEntity).mockRejectedValue(new Error("Owner fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().updateOwnerEntity({ first_name: "X", last_name: "Y" })
      ).rejects.toThrow("Owner fail");

      expect(useCartStore.getState().error).toBe("Owner fail");
    });
  });

  describe("updateDeviceContext error", () => {
    it("handles error from non-Error type", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.updateDeviceContext).mockRejectedValue("string error");
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().updateDeviceContext(mockJob.context!)
      ).rejects.toBe("string error");

      expect(useCartStore.getState().error).toBe("Failed to update device context");
    });
  });

  describe("addStory error", () => {
    it("handles addStory error", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.createStory).mockRejectedValue(new Error("Story fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().addStory({ story_type: "call", user_description: "x" })
      ).rejects.toThrow("Story fail");

      expect(useCartStore.getState().error).toBe("Story fail");
    });
  });

  describe("updateStory error", () => {
    it("handles updateStory error", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.updateStory).mockRejectedValue(new Error("Update story fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().updateStory("s1", {})
      ).rejects.toThrow("Update story fail");

      expect(useCartStore.getState().error).toBe("Update story fail");
    });
  });

  describe("deleteStory error", () => {
    it("handles deleteStory error", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.deleteStory).mockRejectedValue(new Error("Delete story fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().deleteStory("s1")
      ).rejects.toThrow("Delete story fail");

      expect(useCartStore.getState().error).toBe("Delete story fail");
    });
  });

  describe("addTask error", () => {
    it("handles addTask error", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.createTask).mockRejectedValue(new Error("Add task fail"));
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().addTask({ event_type: "images" as EventType, quantity: 1 })
      ).rejects.toThrow("Add task fail");

      expect(useCartStore.getState().error).toBe("Add task fail");
    });
  });

  describe("setCurrentJobId", () => {
    it("clears job when setting jobId to null", () => {
      const mockJob = createMockJob();
      useCartStore.getState().syncFromJob(mockJob);
      expect(useCartStore.getState().job).not.toBeNull();

      useCartStore.getState().setCurrentJobId(null);

      expect(useCartStore.getState().job).toBeNull();
      expect(useCartStore.getState().currentJobId).toBeNull();
    });

    it("sets jobId without clearing job when non-null", () => {
      useCartStore.getState().setCurrentJobId("new-job-id");
      expect(useCartStore.getState().currentJobId).toBe("new-job-id");
    });
  });

  describe("getSectionItemCount edge cases", () => {
    it("returns 0 for null job", () => {
      expect(useCartStore.getState().getSectionItemCount("deviceContext")).toBe(0);
      expect(useCartStore.getState().getSectionItemCount("tasks")).toBe(0);
    });

    it("returns 0 for unknown section", () => {
      const mockJob = createMockJob();
      useCartStore.getState().syncFromJob(mockJob);
      expect(useCartStore.getState().getSectionItemCount("unknown" as any)).toBe(0);
    });
  });

  describe("getTotalItemCount edge cases", () => {
    it("returns 0 for null job", () => {
      expect(useCartStore.getState().getTotalItemCount()).toBe(0);
    });
  });

  describe("non-Error error handling", () => {
    it("uses fallback message for non-Error thrown values on addEntity", async () => {
      const mockJob = createMockJob();
      vi.mocked(draftApi.createEntity).mockRejectedValue("string error");
      useCartStore.getState().syncFromJob(mockJob);

      await expect(
        useCartStore.getState().addEntity({ first_name: "X", last_name: "Y" })
      ).rejects.toBe("string error");

      expect(useCartStore.getState().error).toBe("Failed to add entity");
    });
  });
});
