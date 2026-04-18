import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { getDeviceModels } from "../api/deviceModelsApi";
import { DeviceModel } from "../types/cart";

/**
 * Device Models store state
 */
interface DeviceModelsState {
  // Data
  deviceModels: DeviceModel[];

  // Loading state
  isLoading: boolean;
  isInitialized: boolean;

  // Error state
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
}

/**
 * Device Models Zustand store
 */
export const useDeviceModelsStore = create<DeviceModelsState>()(
  immer((set, get) => ({
    // Initial state
    deviceModels: [],
    isLoading: false,
    isInitialized: false,
    error: null,

    /**
     * Initialize device models - should be called on app startup
     */
    initialize: async () => {
      const state = get();

      // Prevent multiple initializations
      if (state.isInitialized || state.isLoading) {
        return;
      }

      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const models = await getDeviceModels();

        set((draft) => {
          draft.deviceModels = models;
          draft.isLoading = false;
          draft.isInitialized = true;
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to fetch device models";

        set((draft) => {
          draft.isLoading = false;
          draft.error = errorMessage;
        });

        console.error("Device models initialization failed:", error);
      }
    },
  }))
);
