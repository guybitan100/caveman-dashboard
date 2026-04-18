import { useEffect } from "react";
import {
  useMetaFinderStore,
  LanguageOption,
  EventTypeOptions,
} from "../stores/metafinderStore";
import { EventType } from "../types/cart";

/**
 * Hook to initialize MetaFinder on app startup.
 * Should be called once in App.tsx or a top-level component.
 */
export function useMetaFinderInit(): {
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
} {
  const { initialize, isLoading, isInitialized, error } = useMetaFinderStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { isLoading, isInitialized, error };
}

/**
 * Hook to get all MetaFinder options for an event type.
 */
export function useMetaFinderOptions(eventType: EventType): {
  options: EventTypeOptions | null;
  isLoading: boolean;
  error: string | null;
} {
  const { getOptionsForEventType, isLoading, isInitialized, error } =
    useMetaFinderStore();

  const options = isInitialized ? getOptionsForEventType(eventType) : null;

  return { options, isLoading: isLoading || !isInitialized, error };
}

/**
 * Hook to check MetaFinder loading/error state.
 * Useful for components that need to show loading or error UI.
 */
export function useMetaFinderStatus(): {
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
} {
  const { isLoading, isInitialized, error } = useMetaFinderStore();
  return { isLoading, isInitialized, error };
}

// Re-export types for convenience
export type { LanguageOption, EventTypeOptions };
