import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { metafinderApi, MetaFinderAllOptions } from "../api/metafinderApi";
import { EventType } from "../types/cart";

/**
 * Language option with code and display name
 */
export interface LanguageOption {
  code: string;
  displayName: string;
}

/**
 * Options available for a specific event type
 */
export interface EventTypeOptions {
  formats?: string[];
  categories?: string[];
  languages?: LanguageOption[];
}

/**
 * MetaFinder store state
 */
interface MetaFinderState {
  // Data
  options: Partial<Record<EventType, EventTypeOptions>>;
  allLanguages: LanguageOption[];

  // Loading state
  isLoading: boolean;
  isInitialized: boolean;

  // Error state
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  getOptionsForEventType: (eventType: EventType) => EventTypeOptions | null;
  getFormats: (eventType: EventType) => string[] | null;
  getCategories: (eventType: EventType) => string[] | null;
  getLanguages: () => LanguageOption[] | null;
}

/**
 * Map language code to display name using Intl.DisplayNames
 */
function getLanguageDisplayName(code: string): string {
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Convert language codes to LanguageOption array with display names
 */
function mapLanguageCodes(codes: string[]): LanguageOption[] {
  return codes
    .map((code) => ({
      code,
      displayName: getLanguageDisplayName(code),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Map MetaFinder raw options to EventType-organized options
 */
function mapToEventTypeOptions(
  raw: MetaFinderAllOptions
): Partial<Record<EventType, EventTypeOptions>> {
  const languageOptions = mapLanguageCodes(raw.languages);

  return {
    // Media types with formats and categories
    images: {
      formats: raw.formats.image,
      categories: raw.categories.image,
    },
    audios: {
      formats: raw.formats.audio,
      categories: raw.categories.audio,
    },
    videos: {
      formats: raw.formats.video,
      categories: raw.categories.video,
    },
    documents: {
      formats: raw.formats.document,
    },

    // Chat/messaging with languages and categories
    "chat messages": {
      languages: languageOptions,
      categories: raw.categories.chat,
    },
    "sms/mms": {
      languages: languageOptions,
      categories: raw.categories.chat,
    },

    // Notes with languages and categories
    notes: {
      languages: languageOptions,
      categories: raw.categories.chat,
    },

    // Calendar with languages and categories
    "calendar entry": {
      languages: languageOptions,
      categories: raw.categories.chat,
    },

    // Web types with URL categories
    "web bookmarks": {
      categories: raw.categories.url,
    },
    "web history": {
      categories: raw.categories.url,
    },
  };
}

/**
 * MetaFinder Zustand store
 */
export const useMetaFinderStore = create<MetaFinderState>()(
  immer((set, get) => ({
    // Initial state
    options: {},
    allLanguages: [],
    isLoading: false,
    isInitialized: false,
    error: null,

    /**
     * Initialize MetaFinder options - should be called on app startup
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
        const rawOptions = await metafinderApi.fetchAllOptions();
        const mappedOptions = mapToEventTypeOptions(rawOptions);
        const languageOptions = mapLanguageCodes(rawOptions.languages);

        set((draft) => {
          draft.options = mappedOptions;
          draft.allLanguages = languageOptions;
          draft.isLoading = false;
          draft.isInitialized = true;
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to fetch MetaFinder options";

        set((draft) => {
          draft.isLoading = false;
          draft.error = errorMessage;
        });

        console.error("MetaFinder initialization failed:", error);
      }
    },

    /**
     * Get all options for an event type
     */
    getOptionsForEventType: (eventType: EventType) => {
      const state = get();
      if (!state.isInitialized) return null;
      return state.options[eventType] ?? null;
    },

    /**
     * Get formats for an event type
     */
    getFormats: (eventType: EventType) => {
      const state = get();
      if (!state.isInitialized) return null;
      return state.options[eventType]?.formats ?? null;
    },

    /**
     * Get categories for an event type
     */
    getCategories: (eventType: EventType) => {
      const state = get();
      if (!state.isInitialized) return null;
      return state.options[eventType]?.categories ?? null;
    },

    /**
     * Get all available languages
     */
    getLanguages: () => {
      const state = get();
      if (!state.isInitialized) return null;
      return state.allLanguages;
    },
  }))
);
