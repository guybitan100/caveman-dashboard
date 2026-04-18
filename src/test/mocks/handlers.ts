import { http, HttpResponse } from 'msw';

const API_BASE_URL = 'http://localhost:3000/UFDR';

export const handlers = [
  // Jobs API
  http.get(`${API_BASE_URL}/jobs`, () => {
    return HttpResponse.json({
      jobs: [
        {
          id: 'job-1',
          name: 'Test Job 1',
          status: 'Draft',
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: 'job-2',
          name: 'Test Job 2',
          status: 'Generating',
          timestamp: '2024-01-02T00:00:00Z',
        },
      ],
      total: 2,
    });
  }),

  http.get(`${API_BASE_URL}/job/:jobId`, ({ params }) => {
    const { jobId } = params;
    return HttpResponse.json({
      id: jobId,
      name: 'Test Job',
      status: 'Draft',
      drafted_at: '2024-01-01T00:00:00Z',
      created_at: null,
      started_at: null,
      finished_at: null,
      total_events: 0,
      size: 0,
    });
  }),

  http.post(`${API_BASE_URL}/draft`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      job_id: 'new-job-id',
      name: (body as any).name || 'New Job',
      tasks: [],
      context: null,
      custom_events: [],
      stories: { nodes: [] },
      owner_entity: null,
      entities: [],
    });
  }),

  http.post(`${API_BASE_URL}/job/:jobId`, () => {
    return HttpResponse.json({
      job_id: 'job-id',
      status: 'Pending',
    });
  }),

  http.delete(`${API_BASE_URL}/job/:jobId`, () => {
    return HttpResponse.json('Job deleted');
  }),

  http.post(`${API_BASE_URL}/job/cancel/:jobId`, () => {
    return HttpResponse.json('Job cancelled');
  }),

  // Task Progress API
  http.get(`${API_BASE_URL}/job/task-progress/:taskId`, () => {
    return HttpResponse.json({
      status: 'Generating',
      progress: 0.5,
    });
  }),

  // Draft API
  http.put(`${API_BASE_URL}/draft/:jobId/device-context`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      job_id: 'job-id',
      name: 'Test Job',
      tasks: [],
      context: body,
      custom_events: [],
      stories: { nodes: [] },
      owner_entity: null,
      entities: [],
    });
  }),

  http.put(`${API_BASE_URL}/draft/:jobId/device-info`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      job_id: 'job-id',
      name: 'Test Job',
      tasks: [],
      context: { device_info: body },
      custom_events: [],
      stories: { nodes: [] },
      owner_entity: null,
      entities: [],
    });
  }),

  http.post(`${API_BASE_URL}/draft/:jobId/entity`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      job_id: 'job-id',
      name: 'Test Job',
      tasks: [],
      context: null,
      custom_events: [],
      stories: { nodes: [] },
      owner_entity: null,
      entities: [
        {
          uid: 'entity-1',
          ...(body as any),
        },
      ],
    });
  }),

  http.put(`${API_BASE_URL}/draft/:jobId/entity`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      job_id: 'job-id',
      name: 'Test Job',
      tasks: [],
      context: null,
      custom_events: [],
      stories: { nodes: [] },
      owner_entity: null,
      entities: [
        {
          uid: 'entity-1',
          ...(body as any),
        },
      ],
    });
  }),

  http.delete(`${API_BASE_URL}/draft/:jobId/entity`, () => {
    return HttpResponse.json({
      job_id: 'job-id',
      name: 'Test Job',
      tasks: [],
      context: null,
      custom_events: [],
      stories: { nodes: [] },
      owner_entity: null,
      entities: [],
    });
  }),

  http.post(`${API_BASE_URL}/draft/:jobId/story`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      job_id: 'job-id',
      name: 'Test Job',
      tasks: [],
      context: null,
      custom_events: [],
      stories: {
        nodes: [
          {
            story_id: 'story-1',
            ...(body as any),
          },
        ],
      },
      owner_entity: null,
      entities: [],
    });
  }),

  http.post(`${API_BASE_URL}/draft/:jobId/task`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      job: {
        job_id: 'job-id',
        name: 'Test Job',
        tasks: [
          {
            task_id: 'task-1',
            ...(body as any),
          },
        ],
        context: null,
        custom_events: [],
        stories: { nodes: [] },
        owner_entity: null,
        entities: [],
      },
      validation: null,
    });
  }),

  // Device Models API
  http.get(`${API_BASE_URL}/device-models`, () => {
    return HttpResponse.json([
      {
        manufacturer: 'Apple',
        name: 'iPhone 14',
        os: 'ios',
      },
      {
        manufacturer: 'Samsung',
        name: 'Galaxy S23',
        os: 'android',
      },
    ]);
  }),

  // File Upload API
  http.get(`${API_BASE_URL}/upload-file/:md5`, () => {
    return HttpResponse.json(false); // File doesn't exist
  }),

  http.post(`${API_BASE_URL}/upload-file/:md5`, () => {
    return HttpResponse.json({
      url: 'https://test-bucket.s3.amazonaws.com',
      fields: {
        key: 'test-key',
        'Content-Type': 'application/octet-stream',
      },
    });
  }),
];
