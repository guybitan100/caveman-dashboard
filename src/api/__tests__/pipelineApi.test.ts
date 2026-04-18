import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('pipelineApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('expandStory sends POST to story-expansion endpoint', async () => {
    const { pipelineApi } = await import('../../api/pipelineApi');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        original_description: 'test',
        expanded_narrative: 'expanded',
        setting: 'office',
        key_themes: ['work'],
        generated_at: '2024-01-01',
      }),
    });

    const result = await pipelineApi.expandStory('test');
    expect(result.expanded_narrative).toBe('expanded');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/pipeline/1/story-expansion');
    expect(opts.method).toBe('POST');
  });

  it('extractEntities sends POST to entity-extraction endpoint', async () => {
    const { pipelineApi } = await import('../../api/pipelineApi');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { entity_id: 'e1', name: 'Alice', characteristics: {}, languages: [], phone_numbers: [], emails: [] },
      ],
    });

    const story = {
      original_description: 'test',
      expanded_narrative: 'test',
      setting: 'test',
      key_themes: [],
      generated_at: '2024-01-01',
    };
    const result = await pipelineApi.extractEntities(story);
    expect(result).toHaveLength(1);
    expect(result[0].entity_id).toBe('e1');
  });

  it('generateSocialGraph sends correct body', async () => {
    const { pipelineApi } = await import('../../api/pipelineApi');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: [] }),
    });

    const story = {
      original_description: 'test',
      expanded_narrative: 'test',
      setting: 'test',
      key_themes: [],
      generated_at: '2024-01-01',
    };
    const result = await pipelineApi.generateSocialGraph(story, []);
    expect(result.relationships).toEqual([]);
  });

  it('generateTimeline sends correct body', async () => {
    const { pipelineApi } = await import('../../api/pipelineApi');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const story = {
      original_description: 'test',
      expanded_narrative: 'test',
      setting: 'test',
      key_themes: [],
      generated_at: '2024-01-01',
    };
    const result = await pipelineApi.generateTimeline(story, [], { relationships: [] });
    expect(result).toEqual([]);
  });

  it('selectPhones sends correct body', async () => {
    const { pipelineApi } = await import('../../api/pipelineApi');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const result = await pipelineApi.selectPhones([], [], { relationships: [] });
    expect(result).toEqual([]);
  });

  it('generateStories sends correct body', async () => {
    const { pipelineApi } = await import('../../api/pipelineApi');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session_id: 's1',
        phone_mappings: [],
        generation_jobs: [],
        total_stories_generated: 0,
        total_jobs_created: 0,
        ufdr_submissions: [],
        all_jobs_submitted: true,
      }),
    });

    const result = await pipelineApi.generateStories([], [], []);
    expect(result.session_id).toBe('s1');
  });

  it('submitJob sends correct body', async () => {
    const { pipelineApi } = await import('../../api/pipelineApi');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => undefined,
    });

    await pipelineApi.submitJob({
      session_id: 's1',
      phone_mappings: [],
      generation_jobs: [],
      total_stories_generated: 0,
      total_jobs_created: 0,
      ufdr_submissions: [],
      all_jobs_submitted: true,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError on non-ok response', async () => {
    const { pipelineApi, ApiError } = await import('../../api/pipelineApi');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ detail: 'invalid' }),
    });

    try {
      await pipelineApi.expandStory('test');
      expect.fail('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.status).toBe(422);
    }
  });

  it('throws ApiError when json parse fails', async () => {
    const { pipelineApi, ApiError } = await import('../../api/pipelineApi');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => { throw new Error('invalid json'); },
    });

    try {
      await pipelineApi.expandStory('test');
      expect.fail('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.status).toBe(500);
    }
  });
});
