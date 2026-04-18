import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';

vi.mock('axios');

describe('deviceModelsApi', () => {
  const mockGet = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(axios.create).mockReturnValue({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as any);
    vi.resetModules();
  });

  it('getDeviceModels fetches from correct endpoint', async () => {
    const { getDeviceModels } = await import('../../api/deviceModelsApi');
    mockGet.mockResolvedValueOnce({
      data: [
        { manufacturer: 'Apple', name: 'iPhone 15', os: 'ios' },
        { manufacturer: 'Samsung', name: 'Galaxy S24', os: 'android' },
      ],
    });

    const result = await getDeviceModels();
    expect(result).toHaveLength(2);
    expect(result[0].manufacturer).toBe('Apple');
    expect(mockGet).toHaveBeenCalledWith('/device-models');
  });
});
