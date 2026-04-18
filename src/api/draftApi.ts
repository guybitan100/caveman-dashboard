import { apiClient } from "./jobsApi";
import {
  GenerationJob,
  DeviceContext,
  DeviceInfoMetadata,
  Entity,
  StoryData,
  CustomEvent,
  GenerationTask,
  UpdateDeviceContextRequest,
  CreateEntityRequest,
  CreateStoryRequest,
  CreateCustomEventRequest,
  CreateTaskRequest,
  DraftJobOperationResponse,
} from "../types/cart";

/**
 * Draft API client with methods for managing job data inputs.
 * Routes based on backend api/routers/draft_api.py
 */
export const draftApi = {
  /**
   * Update device context for a draft job.
   * Updates device model, OS, start/end dates, and country info.
   * Also auto-updates the DeviceInfoOSType and DeviceInfoDetectedPhoneModel fields in device_info.
   * PUT /UFDR/draft/{job_id}/device-context
   */
  async updateDeviceContext(
    jobId: string,
    deviceContext: DeviceContext | UpdateDeviceContextRequest
  ): Promise<GenerationJob> {
    const response = await apiClient.put<GenerationJob>(
      `/draft/${jobId}/device-context`,
      deviceContext
    );
    return response.data;
  },

  /**
   * Update device info metadata for a draft job.
   * Updates custom key-value pairs only (e.g., IMEI, Serial Number, etc.).
   * Does NOT update device model, OS, or auto-generated fields.
   * PUT /UFDR/draft/{job_id}/device-info
   */
  async updateDeviceInfo(
    jobId: string,
    deviceInfo: DeviceInfoMetadata[]
  ): Promise<GenerationJob> {
    const response = await apiClient.put<GenerationJob>(
      `/draft/${jobId}/device-info`,
      deviceInfo
    );
    return response.data;
  },

  /**
   * Update owner entity for a draft job.
   * PUT /UFDR/draft/owner-entity/{job_id}
   */
  async updateOwnerEntity(
    jobId: string,
    entity: Entity | CreateEntityRequest
  ): Promise<GenerationJob> {
    const response = await apiClient.put<GenerationJob>(
      `/draft/owner-entity/${jobId}`,
      entity
    );
    return response.data;
  },

  /**
   * Create a new entity in a draft job.
   * POST /UFDR/draft/{job_id}/entity
   */
  async createEntity(
    jobId: string,
    entity: CreateEntityRequest
  ): Promise<GenerationJob> {
    const response = await apiClient.post<GenerationJob>(
      `/draft/${jobId}/entity`,
      entity
    );
    return response.data;
  },

  /**
   * Update an existing entity in a draft job.
   * PUT /UFDR/draft/{job_id}/entity?entity_id={entity_id}
   */
  async updateEntity(
    jobId: string,
    entityId: string,
    entity: Partial<Entity>
  ): Promise<GenerationJob> {
    const response = await apiClient.put<GenerationJob>(
      `/draft/${jobId}/entity`,
      entity,
      { params: { entity_id: entityId } }
    );
    return response.data;
  },

  /**
   * Delete an entity from a draft job.
   * DELETE /UFDR/draft/{job_id}/entity?entity_id={entity_id}
   */
  async deleteEntity(jobId: string, entityId: string): Promise<GenerationJob> {
    const response = await apiClient.delete<GenerationJob>(
      `/draft/${jobId}/entity`,
      { params: { entity_id: entityId } }
    );
    return response.data;
  },

  /**
   * Create a new story in a draft job.
   * POST /UFDR/draft/{job_id}/story
   */
  async createStory(
    jobId: string,
    story: CreateStoryRequest | StoryData
  ): Promise<GenerationJob> {
    const response = await apiClient.post<GenerationJob>(
      `/draft/${jobId}/story`,
      story
    );
    return response.data;
  },

  /**
   * Create multiple stories in a draft job.
   * POST /UFDR/draft/{job_id}/stories
   */
  async createStories(
    jobId: string,
    stories: (CreateStoryRequest | StoryData)[]
  ): Promise<GenerationJob> {
    const response = await apiClient.post<GenerationJob>(
      `/draft/${jobId}/stories`,
      stories
    );
    return response.data;
  },

  /**
   * Update an existing story in a draft job.
   * PUT /UFDR/draft/{job_id}/story?story_id={story_id}
   */
  async updateStory(
    jobId: string,
    storyId: string,
    story: Partial<StoryData>
  ): Promise<GenerationJob> {
    const response = await apiClient.put<GenerationJob>(
      `/draft/${jobId}/story`,
      story,
      { params: { story_id: storyId } }
    );
    return response.data;
  },

  /**
   * Delete a story from a draft job.
   * DELETE /UFDR/draft/{job_id}/story?story_id={story_id}
   */
  async deleteStory(jobId: string, storyId: string): Promise<GenerationJob> {
    const response = await apiClient.delete<GenerationJob>(
      `/draft/${jobId}/story`,
      { params: { story_id: storyId } }
    );
    return response.data;
  },

  /**
   * Create a new custom event in a draft job.
   * POST /UFDR/draft/{job_id}/custom-event
   */
  async createCustomEvent(
    jobId: string,
    customEvent: CreateCustomEventRequest | CustomEvent
  ): Promise<GenerationJob> {
    const response = await apiClient.post<GenerationJob>(
      `/draft/${jobId}/custom-event`,
      customEvent
    );
    return response.data;
  },

  /**
   * Update an existing custom event in a draft job.
   * PUT /UFDR/draft/{job_id}/custom-event?event_id={event_id}
   */
  async updateCustomEvent(
    jobId: string,
    eventId: string,
    customEvent: Partial<CustomEvent>
  ): Promise<GenerationJob> {
    const response = await apiClient.put<GenerationJob>(
      `/draft/${jobId}/custom-event`,
      customEvent,
      { params: { event_id: eventId } }
    );
    return response.data;
  },

  /**
   * Delete a custom event from a draft job.
   * DELETE /UFDR/draft/{job_id}/custom-event?event_id={event_id}
   */
  async deleteCustomEvent(
    jobId: string,
    eventId: string
  ): Promise<GenerationJob> {
    const response = await apiClient.delete<GenerationJob>(
      `/draft/${jobId}/custom-event`,
      { params: { event_id: eventId } }
    );
    return response.data;
  },

  /**
   * Create a new task in a draft job.
   * POST /UFDR/draft/{job_id}/task
   */
  async createTask(
    jobId: string,
    task: CreateTaskRequest | GenerationTask
  ): Promise<DraftJobOperationResponse> {
    const response = await apiClient.post<DraftJobOperationResponse>(
      `/draft/${jobId}/task`,
      task
    );
    return response.data;
  },

  /**
   * Update an existing task in a draft job.
   * PUT /UFDR/draft/{job_id}/task?task_id={task_id}
   */
  async updateTask(
    jobId: string,
    taskId: string,
    task: Partial<GenerationTask>
  ): Promise<DraftJobOperationResponse> {
    const response = await apiClient.put<DraftJobOperationResponse>(
      `/draft/${jobId}/task`,
      task,
      { params: { task_id: taskId } }
    );
    return response.data;
  },

  /**
   * Delete a task from a draft job.
   * DELETE /UFDR/draft/{job_id}/task?task_id={task_id}
   */
  async deleteTask(jobId: string, taskId: string): Promise<GenerationJob> {
    const response = await apiClient.delete<GenerationJob>(
      `/draft/${jobId}/task`,
      { params: { task_id: taskId } }
    );
    return response.data;
  },

  /**
   * Create random events for a draft job.
   * POST /UFDR/draft/{job_id}/random-events
   */
  async createRandomEvents(
    jobId: string,
    request: { total_events: number; event_weights?: Record<string, number> }
  ): Promise<GenerationJob> {
    const response = await apiClient.post<GenerationJob>(
      `/draft/${jobId}/random-events`,
      request
    );
    return response.data;
  },
};
