import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isTerminalStatus, isSuccessStatus } from '../../api/ufdrApi';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('isTerminalStatus', () => {
  it('returns true for Done', () => {
    expect(isTerminalStatus('Done')).toBe(true);
  });

  it('returns true for Failed', () => {
    expect(isTerminalStatus('Failed')).toBe(true);
  });

  it('returns true for Cancelled', () => {
    expect(isTerminalStatus('Cancelled')).toBe(true);
  });

  it('returns true for Deleted', () => {
    expect(isTerminalStatus('Deleted')).toBe(true);
  });

  it('returns false for Pending', () => {
    expect(isTerminalStatus('Pending')).toBe(false);
  });

  it('returns false for Generating', () => {
    expect(isTerminalStatus('Generating')).toBe(false);
  });

  it('returns false for Converting', () => {
    expect(isTerminalStatus('Converting')).toBe(false);
  });

  it('returns false for Draft', () => {
    expect(isTerminalStatus('Draft')).toBe(false);
  });
});

describe('isSuccessStatus', () => {
  it('returns true for Done', () => {
    expect(isSuccessStatus('Done')).toBe(true);
  });

  it('returns false for Failed', () => {
    expect(isSuccessStatus('Failed')).toBe(false);
  });

  it('returns false for Pending', () => {
    expect(isSuccessStatus('Pending')).toBe(false);
  });

  it('returns false for Cancelled', () => {
    expect(isSuccessStatus('Cancelled')).toBe(false);
  });
});

describe('submitUfdrJob', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('submits a job with a new UUID', async () => {
    const { submitUfdrJob } = await import('../../api/ufdrApi');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const job = { job_id: 'old-id', tasks: [], context: {}, custom_events: [], stories: [], entities: [] } as any;
    const result = await submitUfdrJob(job, 'Phone A');

    expect(result.phone_entity_name).toBe('Phone A');
    expect(result.status).toBe('Pending');
    expect(result.job_id).not.toBe('old-id');
    expect(result.submitted_at).toBeInstanceOf(Date);
  });

  it('throws on non-ok response', async () => {
    const { submitUfdrJob } = await import('../../api/ufdrApi');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ detail: 'invalid' }),
    });

    const job = { job_id: 'x', tasks: [], context: {}, custom_events: [], stories: [], entities: [] } as any;
    await expect(submitUfdrJob(job, 'Phone')).rejects.toThrow('Failed to submit job');
  });
});

describe('getJobStatus', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns job status response', async () => {
    const { getJobStatus } = await import('../../api/ufdrApi');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: 'j1', name: 'test', status: 'Done' }),
    });

    const result = await getJobStatus('j1');
    expect(result.status).toBe('Done');
    expect(result.job_id).toBe('j1');
  });

  it('throws on error', async () => {
    const { getJobStatus } = await import('../../api/ufdrApi');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
      json: async () => ({}),
    });

    await expect(getJobStatus('j1')).rejects.toThrow('Failed to get job status');
  });
});
