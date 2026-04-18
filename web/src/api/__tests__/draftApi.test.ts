/**
 * Tests for draftApi - API Layer Validation
 * 
 * Priority: HIGH
 * Tests ensure correct endpoint calls for draft job operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import type { GenerationJob, DeviceContext, Entity } from '../../types/cart';

// Mock axios
vi.mock('axios');

describe('draftApi - API Layer Tests', () => {
  const mockAxiosCreate = vi.fn();
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const mockPut = vi.fn();
  const mockDelete = vi.fn();

  const createMockJob = (): GenerationJob => ({
    job_id: 'job-123',
    name: 'Test Job',
    status: 'Draft',
    context: {
      device: { manufacturer: 'Apple', name: 'iPhone 12', os: 'ios' },
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      country_info: { name: 'USA', alpha2: 'US', alpha3: 'USA', timezones: ['America/New_York'], languages: ['en'] }
    },
    device_info: [],
    owner_entity: null,
    entities: [],
    stories: { directed: true, multigraph: false, graph: {}, nodes: [], edges: [] },
    custom_events: [],
    tasks: []
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    
    mockAxiosCreate.mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    });
    vi.mocked(axios.create).mockImplementation(mockAxiosCreate);
    vi.resetModules();
  });

  describe('Device Context Operations', () => {
    it('should update device context', async () => {
      const mockJob = createMockJob();
      const newContext: DeviceContext = {
        device: { manufacturer: 'Samsung', name: 'Galaxy S21', os: 'android' },
        start_date: '2024-02-01',
        end_date: '2024-02-28',
        country_info: { name: 'Canada', alpha2: 'CA', alpha3: 'CAN', timezones: ['America/Toronto'], languages: ['en', 'fr'] }
      };

      mockPut.mockResolvedValue({ data: { ...mockJob, context: newContext } });

      const { draftApi } = await import('../draftApi');
      const result = await draftApi.updateDeviceContext('job-123', newContext);

      expect(mockPut).toHaveBeenCalledWith('/draft/job-123/device-context', newContext);
      expect(result.context).toEqual(newContext);
    });

    it('should update device info', async () => {
      const mockJob = createMockJob();
      const deviceInfo = [
        { key: 'OS Version', value: 'iOS 15.0' },
        { key: 'IMEI', value: '123456789' }
      ];

      mockPut.mockResolvedValue({ data: { ...mockJob, device_info: deviceInfo } });

      const { draftApi } = await import('../draftApi');
      const result = await draftApi.updateDeviceInfo('job-123', deviceInfo);

      expect(mockPut).toHaveBeenCalledWith('/draft/job-123/device-info', deviceInfo);
      expect(result.device_info).toEqual(deviceInfo);
    });
  });

  describe('Entity Operations', () => {
    it('should create entity', async () => {
      const mockJob = createMockJob();
      const newEntity: Entity = {
        uid: 'e1',
        is_owner: false,
        first_name: 'John',
        last_name: 'Doe',
        phone: '555-1234',
        email: 'john@test.com',
        is_male: true
      };

      mockPost.mockResolvedValue({ data: { ...mockJob, entities: [newEntity] } });

      const { draftApi } = await import('../draftApi');
      const result = await draftApi.createEntity('job-123', { first_name: 'John', last_name: 'Doe', phone: '555-1234', email: 'john@test.com', is_male: true });

      expect(mockPost).toHaveBeenCalledWith('/draft/job-123/entity', expect.objectContaining({ first_name: 'John' }));
      expect(result.entities).toHaveLength(1);
    });

    it('should update entity', async () => {
      const mockJob = createMockJob();
      mockPut.mockResolvedValue({ data: mockJob });

      const { draftApi } = await import('../draftApi');
      await draftApi.updateEntity('job-123', 'e1', { first_name: 'Jane' });

      expect(mockPut).toHaveBeenCalledWith(
        '/draft/job-123/entity',
        { first_name: 'Jane' },
        { params: { entity_id: 'e1' } }
      );
    });

    it('should delete entity', async () => {
      const mockJob = createMockJob();
      mockDelete.mockResolvedValue({ data: mockJob });

      const { draftApi } = await import('../draftApi');
      await draftApi.deleteEntity('job-123', 'e1');

      expect(mockDelete).toHaveBeenCalledWith('/draft/job-123/entity', { params: { entity_id: 'e1' } });
    });

    it('should update owner entity', async () => {
      const mockJob = createMockJob();
      const ownerEntity: Entity = {
        uid: 'owner',
        is_owner: true,
        first_name: 'Owner',
        last_name: 'Person',
        phone: null,
        email: null,
        is_male: null
      };

      mockPut.mockResolvedValue({ data: { ...mockJob, owner_entity: ownerEntity } });

      const { draftApi } = await import('../draftApi');
      const result = await draftApi.updateOwnerEntity('job-123', ownerEntity);

      expect(mockPut).toHaveBeenCalledWith('/draft/owner-entity/job-123', ownerEntity);
      expect(result.owner_entity).toEqual(ownerEntity);
    });
  });

  describe('Story Operations', () => {
    it('should create story', async () => {
      const mockJob = createMockJob();
      const story = { story_id: 's1', story_type: 'sms/mms' as const, user_description: 'Test', time: '2024-01-01T10:00:00Z' };

      mockPost.mockResolvedValue({ data: mockJob });

      const { draftApi } = await import('../draftApi');
      await draftApi.createStory('job-123', story);

      expect(mockPost).toHaveBeenCalledWith('/draft/job-123/story', story);
    });

    it('should create multiple stories', async () => {
      const mockJob = createMockJob();
      const stories = [
        { story_id: 's1', story_type: 'sms/mms' as const, user_description: 'Test 1', time: '2024-01-01T10:00:00Z' },
        { story_id: 's2', story_type: 'call' as const, user_description: 'Test 2', time: '2024-01-02T10:00:00Z' }
      ];

      mockPost.mockResolvedValue({ data: mockJob });

      const { draftApi } = await import('../draftApi');
      await draftApi.createStories('job-123', stories);

      expect(mockPost).toHaveBeenCalledWith('/draft/job-123/stories', stories);
    });

    it('should update story', async () => {
      const mockJob = createMockJob();
      mockPut.mockResolvedValue({ data: mockJob });

      const { draftApi } = await import('../draftApi');
      await draftApi.updateStory('job-123', 's1', { user_description: 'Updated' });

      expect(mockPut).toHaveBeenCalledWith(
        '/draft/job-123/story',
        { user_description: 'Updated' },
        { params: { story_id: 's1' } }
      );
    });

    it('should delete story', async () => {
      const mockJob = createMockJob();
      mockDelete.mockResolvedValue({ data: mockJob });

      const { draftApi } = await import('../draftApi');
      await draftApi.deleteStory('job-123', 's1');

      expect(mockDelete).toHaveBeenCalledWith('/draft/job-123/story', { params: { story_id: 's1' } });
    });
  });

  describe('Task Operations', () => {
    it('should create task', async () => {
      const mockJob = createMockJob();
      const task = { event_type: 'chat messages' as const, quantity: 10 };

      mockPost.mockResolvedValue({ data: { job: mockJob, validation: null } });

      const { draftApi } = await import('../draftApi');
      const result = await draftApi.createTask('job-123', task);

      expect(mockPost).toHaveBeenCalledWith('/draft/job-123/task', task);
      expect(result.job).toEqual(mockJob);
      expect(result.validation).toBeNull();
    });

    it('should update task', async () => {
      const mockJob = createMockJob();
      mockPut.mockResolvedValue({ data: { job: mockJob, validation: null } });

      const { draftApi } = await import('../draftApi');
      await draftApi.updateTask('job-123', 't1', { quantity: 20 });

      expect(mockPut).toHaveBeenCalledWith(
        '/draft/job-123/task',
        { quantity: 20 },
        { params: { task_id: 't1' } }
      );
    });

    it('should delete task', async () => {
      const mockJob = createMockJob();
      mockDelete.mockResolvedValue({ data: mockJob });

      const { draftApi } = await import('../draftApi');
      await draftApi.deleteTask('job-123', 't1');

      expect(mockDelete).toHaveBeenCalledWith('/draft/job-123/task', { params: { task_id: 't1' } });
    });

    it('should handle validation errors on task creation', async () => {
      mockPost.mockResolvedValue({ 
        data: { 
          job: null, 
          validation: { valid: false, errors: ['Invalid quantity'] } 
        } 
      });

      const { draftApi } = await import('../draftApi');
      const result = await draftApi.createTask('job-123', { event_type: 'chat messages', quantity: -1 });

      expect(result.job).toBeNull();
      expect(result.validation?.valid).toBe(false);
      expect(result.validation?.errors).toContain('Invalid quantity');
    });
  });

  describe('Custom Event Operations', () => {
    it('should create custom event', async () => {
      const mockJob = createMockJob();
      const customEvent = { event_id: 'ce1', model_type: 'test_model', fields: {} };

      mockPost.mockResolvedValue({ data: mockJob });

      const { draftApi } = await import('../draftApi');
      await draftApi.createCustomEvent('job-123', customEvent);

      expect(mockPost).toHaveBeenCalledWith('/draft/job-123/custom-event', customEvent);
    });

    it('should update custom event', async () => {
      const mockJob = createMockJob();
      mockPut.mockResolvedValue({ data: mockJob });

      const { draftApi } = await import('../draftApi');
      await draftApi.updateCustomEvent('job-123', 'ce1', { model_type: 'updated_model' });

      expect(mockPut).toHaveBeenCalledWith(
        '/draft/job-123/custom-event',
        { model_type: 'updated_model' },
        { params: { event_id: 'ce1' } }
      );
    });

    it('should delete custom event', async () => {
      const mockJob = createMockJob();
      mockDelete.mockResolvedValue({ data: mockJob });

      const { draftApi } = await import('../draftApi');
      await draftApi.deleteCustomEvent('job-123', 'ce1');

      expect(mockDelete).toHaveBeenCalledWith('/draft/job-123/custom-event', { params: { event_id: 'ce1' } });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockPut.mockRejectedValue(new Error('Network Error'));

      const { draftApi } = await import('../draftApi');
      await expect(draftApi.updateDeviceContext('job-123', {} as DeviceContext)).rejects.toThrow('Network Error');
    });

    it('should handle 500 errors', async () => {
      const serverError = {
        response: { status: 500, data: { detail: 'Internal Server Error' } }
      };
      mockPost.mockRejectedValue(serverError);

      const { draftApi } = await import('../draftApi');
      await expect(draftApi.createEntity('job-123', { first_name: 'Test', last_name: 'User' })).rejects.toEqual(serverError);
    });
  });
});
