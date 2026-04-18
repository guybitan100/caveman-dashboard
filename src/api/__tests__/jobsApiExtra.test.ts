import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';

vi.mock('axios');

describe('jobsApi - getMultipleTaskProgress & getDownloadUrl', () => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(axios.create).mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: vi.fn(),
      delete: vi.fn(),
    } as any);
    vi.resetModules();
  });

  describe('getMultipleTaskProgress', () => {
    it('fetches progress for all tasks', async () => {
      const { jobsApi } = await import('../../api/jobsApi');
      mockGet.mockResolvedValue({
        data: { task_id: 't1', status: 'Generating', progress: 0.5 },
      });

      const result = await jobsApi.getMultipleTaskProgress(['t1', 't2']);
      expect(result.size).toBe(2);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('respects concurrency limit', async () => {
      const { jobsApi } = await import('../../api/jobsApi');
      const calls: string[] = [];
      mockGet.mockImplementation(async (url: string) => {
        calls.push(url);
        return { data: { task_id: 'x', status: 'Done', progress: 1.0 } };
      });

      const taskIds = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
      await jobsApi.getMultipleTaskProgress(taskIds, 3);
      // Should have been called 7 times total, in batches of 3
      expect(mockGet).toHaveBeenCalledTimes(7);
    });

    it('skips failed task fetches gracefully', async () => {
      const { jobsApi } = await import('../../api/jobsApi');
      mockGet
        .mockResolvedValueOnce({
          data: { task_id: 't1', status: 'Done', progress: 1.0 },
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await jobsApi.getMultipleTaskProgress(['t1', 't2']);
      expect(result.size).toBe(1);
      expect(result.has('t1')).toBe(true);
    });
  });

  describe('getDownloadUrl', () => {
    it('returns download URL, size, and filename', async () => {
      const { jobsApi } = await import('../../api/jobsApi');
      mockGet.mockResolvedValueOnce({
        data: {
          url: 'https://s3.example.com/file.ufdr',
          file_size: 12345,
          file_name: 'output.ufdr',
        },
      });

      const result = await jobsApi.getDownloadUrl('job-123');
      expect(result.url).toBe('https://s3.example.com/file.ufdr');
      expect(result.fileSize).toBe(12345);
      expect(result.fileName).toBe('output.ufdr');
      expect(mockGet).toHaveBeenCalledWith('/download/job-123');
    });
  });

  describe('getTaskProgress', () => {
    it('fetches single task progress', async () => {
      const { jobsApi } = await import('../../api/jobsApi');
      mockGet.mockResolvedValueOnce({
        data: { task_id: 't1', status: 'Generating', progress: 0.75 },
      });

      const result = await jobsApi.getTaskProgress('t1');
      expect(result.status).toBe('Generating');
      expect(result.progress).toBe(0.75);
    });
  });

  describe('deleteJob', () => {
    it('calls DELETE on the correct endpoint', async () => {
      const { jobsApi } = await import('../../api/jobsApi');
      const mockDelete = vi.fn().mockResolvedValueOnce({ data: 'deleted' });
      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: mockDelete,
      } as any);
      vi.resetModules();
      const { jobsApi: api2 } = await import('../../api/jobsApi');

      await api2.deleteJob('job-456');
      expect(mockDelete).toHaveBeenCalledWith('/job/job-456');
    });
  });
});
