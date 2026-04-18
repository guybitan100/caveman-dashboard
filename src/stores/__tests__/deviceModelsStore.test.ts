import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// Mock the API module
vi.mock('../../api/deviceModelsApi', () => ({
  getDeviceModels: vi.fn(),
}));

import { useDeviceModelsStore } from '../../stores/deviceModelsStore';
import { getDeviceModels } from '../../api/deviceModelsApi';

const mockGetDeviceModels = vi.mocked(getDeviceModels);

describe('deviceModelsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    const { setState } = useDeviceModelsStore;
    setState({
      deviceModels: [],
      isLoading: false,
      isInitialized: false,
      error: null,
    });
  });

  it('has correct initial state', () => {
    const state = useDeviceModelsStore.getState();
    expect(state.deviceModels).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.isInitialized).toBe(false);
    expect(state.error).toBeNull();
  });

  it('initializes successfully', async () => {
    mockGetDeviceModels.mockResolvedValueOnce([
      { manufacturer: 'Apple', name: 'iPhone 15', os: 'ios' },
    ]);

    await act(async () => {
      await useDeviceModelsStore.getState().initialize();
    });

    const state = useDeviceModelsStore.getState();
    expect(state.deviceModels).toHaveLength(1);
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('handles initialization error', async () => {
    mockGetDeviceModels.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      await useDeviceModelsStore.getState().initialize();
    });

    const state = useDeviceModelsStore.getState();
    expect(state.deviceModels).toEqual([]);
    expect(state.isInitialized).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Network error');
  });

  it('prevents multiple initializations', async () => {
    mockGetDeviceModels.mockResolvedValue([]);

    await act(async () => {
      await useDeviceModelsStore.getState().initialize();
    });
    await act(async () => {
      await useDeviceModelsStore.getState().initialize();
    });

    expect(mockGetDeviceModels).toHaveBeenCalledTimes(1);
  });

  it('handles non-Error thrown values', async () => {
    mockGetDeviceModels.mockRejectedValueOnce('string error');

    await act(async () => {
      await useDeviceModelsStore.getState().initialize();
    });

    const state = useDeviceModelsStore.getState();
    expect(state.error).toBe('Failed to fetch device models');
  });
});
