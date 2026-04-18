import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

const mockClient = (axios.create as any)();

describe('metafinderApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getFiles posts correct request', async () => {
    const { metafinderApi } = await import('../../api/metafinderApi');
    mockClient.post.mockResolvedValueOnce({
      data: [
        { presigned_url: 'url1', s3_key: 'key1', size: 100, format: 'jpg', md5: 'abc' },
      ],
    });

    const result = await metafinderApi.getFiles('image', 5, { format: 'jpg' });
    expect(result).toHaveLength(1);
    expect(result[0].s3_key).toBe('key1');
  });

  it('getFormats returns sorted format keys', async () => {
    const { metafinderApi } = await import('../../api/metafinderApi');
    mockClient.post.mockResolvedValueOnce({
      data: { png: 10, jpg: 20, gif: 5 },
    });

    const result = await metafinderApi.getFormats('image');
    expect(result).toEqual(['gif', 'jpg', 'png']);
  });

  it('getCategories returns sorted category keys', async () => {
    const { metafinderApi } = await import('../../api/metafinderApi');
    mockClient.post.mockResolvedValueOnce({
      data: { landscape: 5, portrait: 10 },
    });

    const result = await metafinderApi.getCategories('image');
    expect(result).toEqual(['landscape', 'portrait']);
  });

  it('getLanguages returns sorted language keys', async () => {
    const { metafinderApi } = await import('../../api/metafinderApi');
    mockClient.post.mockResolvedValueOnce({
      data: { en: 100, fr: 50 },
    });

    const result = await metafinderApi.getLanguages();
    expect(result).toEqual(['en', 'fr']);
  });

  it('fetchAllOptions calls all endpoints in parallel', async () => {
    const { metafinderApi } = await import('../../api/metafinderApi');
    // 4 format calls + 5 category calls + 1 language call = 10 calls
    for (let i = 0; i < 10; i++) {
      mockClient.post.mockResolvedValueOnce({ data: { test: 1 } });
    }

    const result = await metafinderApi.fetchAllOptions();
    expect(result.formats).toBeDefined();
    expect(result.categories).toBeDefined();
    expect(result.languages).toBeDefined();
    expect(mockClient.post).toHaveBeenCalledTimes(10);
  });
});
