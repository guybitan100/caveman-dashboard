import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

vi.mock('../../api/metafinderApi', () => ({
  metafinderApi: {
    fetchAllOptions: vi.fn(),
  },
}));

import { useMetaFinderStore } from '../../stores/metafinderStore';
import { metafinderApi } from '../../api/metafinderApi';

const mockFetchAllOptions = vi.mocked(metafinderApi.fetchAllOptions);

describe('metafinderStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { setState } = useMetaFinderStore;
    setState({
      options: {},
      allLanguages: [],
      isLoading: false,
      isInitialized: false,
      error: null,
    });
  });

  it('has correct initial state', () => {
    const state = useMetaFinderStore.getState();
    expect(state.options).toEqual({});
    expect(state.allLanguages).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.isInitialized).toBe(false);
    expect(state.error).toBeNull();
  });

  it('initializes successfully with mapped options', async () => {
    mockFetchAllOptions.mockResolvedValueOnce({
      formats: {
        image: ['jpg', 'png'],
        audio: ['mp3'],
        video: ['mp4'],
        document: ['pdf'],
      },
      categories: {
        image: ['landscape'],
        audio: ['music'],
        video: ['clip'],
        chat: ['personal'],
        url: ['news'],
      },
      languages: ['en', 'fr'],
    });

    await act(async () => {
      await useMetaFinderStore.getState().initialize();
    });

    const state = useMetaFinderStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.allLanguages.length).toBe(2);
    expect(state.options.images?.formats).toEqual(['jpg', 'png']);
    expect(state.options['chat messages']?.languages).toBeDefined();
  });

  it('handles initialization error', async () => {
    mockFetchAllOptions.mockRejectedValueOnce(new Error('API down'));

    await act(async () => {
      await useMetaFinderStore.getState().initialize();
    });

    const state = useMetaFinderStore.getState();
    expect(state.isInitialized).toBe(false);
    expect(state.error).toBe('API down');
  });

  it('prevents multiple initializations', async () => {
    mockFetchAllOptions.mockResolvedValue({
      formats: { image: [], audio: [], video: [], document: [] },
      categories: { image: [], audio: [], video: [], chat: [], url: [] },
      languages: [],
    });

    await act(async () => {
      await useMetaFinderStore.getState().initialize();
    });
    await act(async () => {
      await useMetaFinderStore.getState().initialize();
    });

    expect(mockFetchAllOptions).toHaveBeenCalledTimes(1);
  });

  it('getOptionsForEventType returns null when not initialized', () => {
    const result = useMetaFinderStore.getState().getOptionsForEventType('images');
    expect(result).toBeNull();
  });

  it('getOptionsForEventType returns options after initialization', async () => {
    mockFetchAllOptions.mockResolvedValueOnce({
      formats: { image: ['jpg'], audio: [], video: [], document: [] },
      categories: { image: ['cat1'], audio: [], video: [], chat: [], url: [] },
      languages: [],
    });

    await act(async () => {
      await useMetaFinderStore.getState().initialize();
    });

    const result = useMetaFinderStore.getState().getOptionsForEventType('images');
    expect(result?.formats).toEqual(['jpg']);
    expect(result?.categories).toEqual(['cat1']);
  });

  it('getOptionsForEventType returns null for unknown type', async () => {
    mockFetchAllOptions.mockResolvedValueOnce({
      formats: { image: [], audio: [], video: [], document: [] },
      categories: { image: [], audio: [], video: [], chat: [], url: [] },
      languages: [],
    });

    await act(async () => {
      await useMetaFinderStore.getState().initialize();
    });

    const result = useMetaFinderStore.getState().getOptionsForEventType('calls');
    expect(result).toBeNull();
  });

  it('getFormats returns null when not initialized', () => {
    expect(useMetaFinderStore.getState().getFormats('images')).toBeNull();
  });

  it('getCategories returns null when not initialized', () => {
    expect(useMetaFinderStore.getState().getCategories('images')).toBeNull();
  });

  it('getLanguages returns null when not initialized', () => {
    expect(useMetaFinderStore.getState().getLanguages()).toBeNull();
  });

  it('getFormats returns formats after init', async () => {
    mockFetchAllOptions.mockResolvedValueOnce({
      formats: { image: ['gif'], audio: [], video: [], document: [] },
      categories: { image: [], audio: [], video: [], chat: [], url: [] },
      languages: [],
    });

    await act(async () => {
      await useMetaFinderStore.getState().initialize();
    });

    expect(useMetaFinderStore.getState().getFormats('images')).toEqual(['gif']);
  });

  it('getLanguages returns languages after init', async () => {
    mockFetchAllOptions.mockResolvedValueOnce({
      formats: { image: [], audio: [], video: [], document: [] },
      categories: { image: [], audio: [], video: [], chat: [], url: [] },
      languages: ['en'],
    });

    await act(async () => {
      await useMetaFinderStore.getState().initialize();
    });

    const langs = useMetaFinderStore.getState().getLanguages();
    expect(langs).toHaveLength(1);
    expect(langs![0].code).toBe('en');
  });

  it('handles non-Error thrown values', async () => {
    mockFetchAllOptions.mockRejectedValueOnce('string error');

    await act(async () => {
      await useMetaFinderStore.getState().initialize();
    });

    expect(useMetaFinderStore.getState().error).toBe('Failed to fetch MetaFinder options');
  });
});
