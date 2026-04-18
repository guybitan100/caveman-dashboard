/**
 * API client for the AI generation pipeline.
 * Provides functions to call each pipeline stage endpoint.
 */

import {
  StoryExpansion,
  StoryExpansionRequest,
  AiGeneratedEntity,
  EntityExtractionRequest,
  SocialGraph,
  SocialGraphRequest,
  TimelineEvent,
  TimelineGenerationRequest,
  SelectedPhone,
  PhoneSelectionRequest,
  StoryGenerationRequest,
  JobGenerationResult,
  SubmitJobRequest,
} from "../types/pipeline.ts";

const API_BASE_URL = import.meta.env.VITE_AI_GENERATOR_URL;

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiCall<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      `API request failed: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  return response.json();
}

/**
 * Pipeline API client with methods for each stage.
 */
export const pipelineApi = {
  /**
   * Step 1: Expand a brief description into a full story narrative.
   */
  async expandStory(description: string): Promise<StoryExpansion> {
    const request: StoryExpansionRequest = { description };
    return apiCall<StoryExpansion>("/pipeline/1/story-expansion", request);
  },

  /**
   * Step 2: Extract entities from the expanded story.
   */
  async extractEntities(story: StoryExpansion): Promise<AiGeneratedEntity[]> {
    const request: EntityExtractionRequest = { story };
    return apiCall<AiGeneratedEntity[]>(
      "/pipeline/2/entity-extraction",
      request
    );
  },

  /**
   * Step 3: Generate social graph from story and entities.
   */
  async generateSocialGraph(
    story: StoryExpansion,
    entities: AiGeneratedEntity[]
  ): Promise<SocialGraph> {
    const request: SocialGraphRequest = { story, entities };
    return apiCall<SocialGraph>("/pipeline/3/social-graph", request);
  },

  /**
   * Step 4: Generate timeline of events.
   */
  async generateTimeline(
    story: StoryExpansion,
    entities: AiGeneratedEntity[],
    social_graph: SocialGraph
  ): Promise<TimelineEvent[]> {
    const request: TimelineGenerationRequest = {
      story,
      entities,
      social_graph,
    };
    return apiCall<TimelineEvent[]>("/pipeline/4/timeline-generation", request);
  },

  /**
   * Step 5: Select phones for extraction.
   */
  async selectPhones(
    entities: AiGeneratedEntity[],
    timeline: TimelineEvent[],
    social_graph: SocialGraph,
    pre_selected_phones?: SelectedPhone[]
  ): Promise<SelectedPhone[]> {
    const request: PhoneSelectionRequest = {
      entities,
      timeline,
      social_graph,
      pre_selected_phones,
    };
    return apiCall<SelectedPhone[]>("/pipeline/5/phone-selection", request);
  },

  /**
   * Step 6: Generate stories for selected phones.
   */
  async generateStories(
    selected_phones: SelectedPhone[],
    timeline: TimelineEvent[],
    entities: AiGeneratedEntity[]
  ): Promise<JobGenerationResult> {
    const request: StoryGenerationRequest = {
      selected_phones,
      timeline,
      entities,
    };
    return apiCall<JobGenerationResult>(
      "/pipeline/6/story-generation",
      request
    );
  },

  /**
   * Step 7: Submit the generated job to UFDR.
   */
  async submitJob(generation_result: JobGenerationResult): Promise<void> {
    const request: SubmitJobRequest = { generation_result };
    return apiCall<void>("/pipeline/7/submit-job", request);
  },
};

export { ApiError };
