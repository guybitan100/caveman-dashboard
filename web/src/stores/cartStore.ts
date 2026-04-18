import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  GenerationJob,
  DeviceContext,
  DeviceInfoMetadata,
  Entity,
  StoryData,
  CustomEvent,
  GenerationTask,
  CartSectionKey,
  UpdateDeviceContextRequest,
  CreateEntityRequest,
  CreateStoryRequest,
  CreateCustomEventRequest,
  CreateTaskRequest,
  extractSubtasks,
} from "../types/cart";
import { draftApi } from "../api/draftApi";

/**
 * Extract error message from unknown error type.
 */
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

interface CartState {
  // Current job data (the full GenerationJob)
  job: GenerationJob | null;

  // UI state
  isOpen: boolean;
  expandedSections: Record<CartSectionKey, boolean>;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // Error state
  error: string | null;

  // Current job context
  currentJobId: string | null;

  // Computed values
  getTotalItemCount: () => number;
  getSectionItemCount: (section: CartSectionKey) => number;

  // UI Actions
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  toggleSection: (section: CartSectionKey) => void;

  // Data Actions
  setCurrentJob: (job: GenerationJob | null) => void;
  setCurrentJobId: (jobId: string | null) => void;
  syncFromJob: (job: GenerationJob) => void;

  // Device Context Actions
  updateDeviceContext: (
    data: DeviceContext | UpdateDeviceContextRequest
  ) => Promise<void>;

  // Device Info Actions
  updateDeviceInfo: (data: DeviceInfoMetadata[]) => Promise<void>;

  // Owner Entity Actions
  updateOwnerEntity: (entity: Entity | CreateEntityRequest) => Promise<void>;

  // Entity Actions
  addEntity: (data: CreateEntityRequest) => Promise<Entity>;
  updateEntity: (entityId: string, data: Partial<Entity>) => Promise<void>;
  deleteEntity: (entityId: string) => Promise<void>;

  // Story Actions
  addStory: (data: CreateStoryRequest | StoryData) => Promise<void>;
  addStories: (data: (CreateStoryRequest | StoryData)[]) => Promise<void>;
  updateStory: (storyId: string, data: Partial<StoryData>) => Promise<void>;
  deleteStory: (storyId: string) => Promise<void>;

  // Custom Event Actions
  addCustomEvent: (
    data: CreateCustomEventRequest | CustomEvent
  ) => Promise<CustomEvent>;
  updateCustomEvent: (
    eventId: string,
    data: Partial<CustomEvent>
  ) => Promise<void>;
  deleteCustomEvent: (eventId: string) => Promise<void>;

  // Task Actions
  addTask: (data: CreateTaskRequest | GenerationTask) => Promise<void>;
  updateTask: (taskId: string, data: Partial<GenerationTask>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  // Random Events Actions
  createRandomEvents: (totalEvents: number) => Promise<void>;

  // Loading state
  setIsLoading: (loading: boolean) => void;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
}

const initialExpandedSections: Record<CartSectionKey, boolean> = {
  deviceContext: true,
  tasks: true,
  stories: false,
  entities: false,
  customEvents: false,
};

export const useCartStore = create<CartState>()(
  immer((set, get) => ({
    // Initial state
    job: null,
    isOpen: false,
    expandedSections: initialExpandedSections,
    isLoading: false,
    isSaving: false,
    error: null,
    currentJobId: null,

    // Computed values
    getTotalItemCount: () => {
      const { job } = get();
      if (!job) return 0;

      // Sum all task quantities
      const taskQuantities = job.tasks.reduce(
        (sum, task) => sum + task.quantity,
        0
      );

      // Sum all subtask quantities from attachments
      const subtaskMap = extractSubtasks(job.tasks);
      let subtaskQuantities = 0;
      for (const subtasks of subtaskMap.values()) {
        subtaskQuantities += subtasks.reduce(
          (sum, s) => sum + s.task.quantity,
          0
        );
      }

      // Story count
      const storyCount = job.stories?.nodes?.length || 0;

      return taskQuantities + subtaskQuantities + storyCount;
    },

    getSectionItemCount: (section: CartSectionKey) => {
      const { job } = get();
      if (!job) return 0;

      switch (section) {
        case "deviceContext":
          return job.context ? 1 : 0;
        case "tasks":
          return job.tasks.length;
        case "stories":
          return job.stories?.nodes?.length || 0;
        case "entities":
          return job.entities.length + (job.owner_entity ? 1 : 0);
        case "customEvents":
          return job.custom_events.length;
        default:
          return 0;
      }
    },

    // UI Actions
    openCart: () =>
      set((state) => {
        state.isOpen = true;
      }),

    closeCart: () =>
      set((state) => {
        state.isOpen = false;
      }),

    toggleCart: () =>
      set((state) => {
        state.isOpen = !state.isOpen;
      }),

    toggleSection: (section: CartSectionKey) =>
      set((state) => {
        state.expandedSections[section] = !state.expandedSections[section];
      }),

    // Data Actions
    setCurrentJob: (job: GenerationJob | null) =>
      set((state) => {
        state.job = job;
        state.currentJobId = job?.job_id || null;
      }),

    setCurrentJobId: (jobId: string | null) =>
      set((state) => {
        state.currentJobId = jobId;
        if (!jobId) {
          state.job = null;
        }
      }),

    syncFromJob: (job: GenerationJob) =>
      set((state) => {
        state.job = job;
        state.currentJobId = job.job_id;
      }),

    // Device Context Actions
    updateDeviceContext: async (
      data: DeviceContext | UpdateDeviceContextRequest
    ) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot update device context");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.updateDeviceContext(
          currentJobId,
          data as DeviceContext
        );
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(
            error,
            "Failed to update device context"
          );
        });
        throw error;
      }
    },

    // Device Info Actions
    updateDeviceInfo: async (data: DeviceInfoMetadata[]) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot update device info");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.updateDeviceInfo(currentJobId, data);
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to update device info");
        });
        throw error;
      }
    },

    // Owner Entity Actions
    updateOwnerEntity: async (entity: Entity | CreateEntityRequest) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot update owner entity");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.updateOwnerEntity(
          currentJobId,
          entity as Entity
        );
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to update owner entity");
        });
        throw error;
      }
    },

    // Entity Actions
    addEntity: async (data: CreateEntityRequest) => {
      const { currentJobId } = get();
      if (!currentJobId) throw new Error("No job selected - cannot add entity");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.createEntity(currentJobId, data);
        const newEntity = updatedJob.entities[updatedJob.entities.length - 1];
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
        return newEntity;
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to add entity");
        });
        throw error;
      }
    },

    updateEntity: async (entityId: string, data: Partial<Entity>) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot update entity");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.updateEntity(
          currentJobId,
          entityId,
          data
        );
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to update entity");
        });
        throw error;
      }
    },

    deleteEntity: async (entityId: string) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot delete entity");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.deleteEntity(currentJobId, entityId);
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to delete entity");
        });
        throw error;
      }
    },

    // Story Actions
    addStory: async (data: CreateStoryRequest | StoryData) => {
      const { currentJobId } = get();
      if (!currentJobId) throw new Error("No job selected - cannot add story");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.createStory(currentJobId, data);
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to add story");
        });
        throw error;
      }
    },

    addStories: async (data: (CreateStoryRequest | StoryData)[]) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot add stories");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.createStories(currentJobId, data);
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to add stories");
        });
        throw error;
      }
    },

    updateStory: async (storyId: string, data: Partial<StoryData>) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot update story");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.updateStory(
          currentJobId,
          storyId,
          data
        );
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to update story");
        });
        throw error;
      }
    },

    deleteStory: async (storyId: string) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot delete story");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.deleteStory(currentJobId, storyId);
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to delete story");
        });
        throw error;
      }
    },

    // Custom Event Actions
    addCustomEvent: async (data: CreateCustomEventRequest | CustomEvent) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot add custom event");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.createCustomEvent(currentJobId, data);
        const newEvent =
          updatedJob.custom_events[updatedJob.custom_events.length - 1];
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
        return newEvent;
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to add custom event");
        });
        throw error;
      }
    },

    updateCustomEvent: async (eventId: string, data: Partial<CustomEvent>) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot update custom event");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.updateCustomEvent(
          currentJobId,
          eventId,
          data
        );
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to update custom event");
        });
        throw error;
      }
    },

    deleteCustomEvent: async (eventId: string) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot delete custom event");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.deleteCustomEvent(
          currentJobId,
          eventId
        );
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to delete custom event");
        });
        throw error;
      }
    },

    // Task Actions
    addTask: async (data: CreateTaskRequest | GenerationTask) => {
      const { currentJobId } = get();
      if (!currentJobId) throw new Error("No job selected");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const response = await draftApi.createTask(currentJobId, data);
        if (!response.job) {
          throw new Error(
            response.validation?.errors?.join(", ") || "Failed to create task"
          );
        }
        set((state) => {
          state.job = response.job;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to add task");
        });
        throw error;
      }
    },

    updateTask: async (taskId: string, data: Partial<GenerationTask>) => {
      const { currentJobId } = get();
      if (!currentJobId) throw new Error("No job selected");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const response = await draftApi.updateTask(currentJobId, taskId, data);
        if (!response.job) {
          throw new Error(
            response.validation?.errors?.join(", ") || "Failed to update task"
          );
        }
        set((state) => {
          state.job = response.job;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to update task");
        });
        throw error;
      }
    },

    deleteTask: async (taskId: string) => {
      const { currentJobId } = get();
      if (!currentJobId)
        throw new Error("No job selected - cannot delete task");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.deleteTask(currentJobId, taskId);
        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(error, "Failed to delete task");
        });
        throw error;
      }
    },

    // Random Events Actions
    createRandomEvents: async (totalEvents: number) => {
      const { currentJobId } = get();
      if (!currentJobId) throw new Error("No job selected");

      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const updatedJob = await draftApi.createRandomEvents(currentJobId, {
          total_events: totalEvents,
        });

        set((state) => {
          state.job = updatedJob;
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = getErrorMessage(
            error,
            "Failed to generate random events"
          );
        });
        throw error;
      }
    },

    // Error handling
    setError: (error: string | null) =>
      set((state) => {
        state.error = error;
      }),

    clearError: () =>
      set((state) => {
        state.error = null;
      }),

    // Loading state
    setIsLoading: (loading: boolean) =>
      set((state) => {
        state.isLoading = loading;
      }),
  }))
);
