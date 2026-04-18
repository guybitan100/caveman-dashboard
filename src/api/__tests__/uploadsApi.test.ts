import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      post: vi.fn(),
    },
  };
});

const mockClient = (axios.create as any)();

describe('uploadsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('doesFileExist returns boolean', async () => {
    const { doesFileExist } = await import('../../api/uploadsApi');
    mockClient.get.mockResolvedValueOnce({ data: true });

    const result = await doesFileExist('abc123');
    expect(result).toBe(true);
    expect(mockClient.get).toHaveBeenCalledWith('/upload-file/abc123');
  });

  it('getUploadPresignedUrl returns url and fields', async () => {
    const { getUploadPresignedUrl } = await import('../../api/uploadsApi');
    mockClient.post.mockResolvedValueOnce({
      data: { url: 'https://s3.example.com', fields: { key: 'value' } },
    });

    const result = await getUploadPresignedUrl('abc123');
    expect(result.url).toBe('https://s3.example.com');
    expect(result.fields.key).toBe('value');
  });

  it('uploadFileToS3 sends FormData with file', async () => {
    const { uploadFileToS3 } = await import('../../api/uploadsApi');
    (axios.post as any).mockResolvedValueOnce({});

    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const presigned = {
      url: 'https://s3.example.com/upload',
      fields: { 'x-amz-key': 'val' },
    };

    await uploadFileToS3(file, presigned);
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, formData] = (axios.post as any).mock.calls[0];
    expect(url).toBe('https://s3.example.com/upload');
    expect(formData).toBeInstanceOf(FormData);
  });

  it('uploadFileToS3 calls onProgress callback', async () => {
    const { uploadFileToS3 } = await import('../../api/uploadsApi');
    (axios.post as any).mockImplementationOnce((_url: any, _data: any, config: any) => {
      if (config?.onUploadProgress) {
        config.onUploadProgress({ loaded: 50, total: 100 });
      }
      return Promise.resolve({});
    });

    const file = new File(['hello'], 'test.txt');
    const presigned = { url: 'https://s3.example.com', fields: {} };
    const onProgress = vi.fn();

    await uploadFileToS3(file, presigned, onProgress);
    expect(onProgress).toHaveBeenCalledWith(50);
  });
});
