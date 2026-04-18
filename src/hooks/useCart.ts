import { useCallback } from "react";
import { useCartStore } from "../stores/cartStore";
import { GenerationJob } from "../types/cart";

/**
 * Hook for managing cart data inputs.
 * The cart state is synced from the current GenerationJob.
 */
export function useCart() {
  const {
    // State
    job,
    isOpen,
    expandedSections,
    isLoading,
    isSaving,
    error,
    currentJobId,

    // Computed
    getTotalItemCount,
    getSectionItemCount,

    // UI Actions
    openCart,
    closeCart,
    toggleCart,
    toggleSection,

    // Data Actions
    setCurrentJob,
    setCurrentJobId,
    syncFromJob,

    // Device Context
    updateDeviceContext,

    // Owner Entity
    updateOwnerEntity,

    // Entities
    addEntity,
    updateEntity,
    deleteEntity,

    // Stories
    addStory,
    addStories,
    updateStory,
    deleteStory,

    // Custom Events
    addCustomEvent,
    updateCustomEvent,
    deleteCustomEvent,

    // Tasks
    addTask,
    updateTask,
    deleteTask,

    // Random Events
    createRandomEvents,

    // Error handling
    setError,
    clearError,
  } = useCartStore();

  const syncCart = useCallback(
    (jobData: GenerationJob) => {
      syncFromJob(jobData);
    },
    [syncFromJob]
  );

  return {
    // Full job data
    job,

    // Extracted data for convenience
    context: job?.context ?? null,
    tasks: job?.tasks ?? [],
    stories: job?.stories?.nodes ?? [],
    entities: job?.entities ?? [],
    ownerEntity: job?.owner_entity ?? null,
    customEvents: job?.custom_events ?? [],

    // Counts
    totalItemCount: getTotalItemCount(),
    getSectionItemCount,

    // UI state
    isOpen,
    expandedSections,
    isLoading,
    isSaving,
    error,
    currentJobId,

    // UI actions
    openCart,
    closeCart,
    toggleCart,
    toggleSection,

    // Data sync
    setCurrentJob,
    setCurrentJobId,
    syncCart,

    // Device context
    updateDeviceContext,

    // Owner entity
    updateOwnerEntity,

    // Entities
    addEntity,
    updateEntity,
    deleteEntity,

    // Stories
    addStory,
    addStories,
    updateStory,
    deleteStory,

    // Custom events
    addCustomEvent,
    updateCustomEvent,
    deleteCustomEvent,

    // Tasks
    addTask,
    updateTask,
    deleteTask,

    // Random Events
    createRandomEvents,

    // Error handling
    setError,
    clearError,
  };
}

export default useCart;
