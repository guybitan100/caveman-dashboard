/**
 * TypeScript types for the AI generation pipeline.
 * These types mirror the Pydantic models from the ai-generator service.
 */

import { JobStatus } from "./job";

export interface StoryExpansion {
  original_description: string;
  expanded_narrative: string;
  setting: string;
  key_themes: string[];
  generated_at: string;
}

export interface StoryExpansionRequest {
  description: string;
}

export type Gender = "male" | "female" | "unknown";

export interface VoiceCharacteristics {
  voice_id?: string;
  language_code: string;
  speaking_style?: "calm" | "excited" | "professional" | "casual" | "urgent";
}

export interface EntityCharacteristics {
  age?: number;
  gender: Gender;
  occupation?: string;
  personality_traits: string[];
  background?: string;
  tech_savviness: number;
  social_activity: number;
  voice?: VoiceCharacteristics;
}

export interface Language {
  name: string;
  is_native: boolean;
  proficiency: string;
}

export interface AiGeneratedEntity {
  entity_id: string;
  name: string;
  characteristics: EntityCharacteristics;
  languages: Language[];
  phone_numbers: string[];
  emails: string[];
}

export interface EntityExtractionRequest {
  story: StoryExpansion;
}

export type RelationshipType =
  | "family"
  | "romantic"
  | "friend"
  | "colleague"
  | "acquaintance"
  | "neighbor"
  | "rival"
  | "enemy"
  | "professional"
  | "stranger"
  | "service_provider"
  | "other";

export interface Relationship {
  entity_id_1: string;
  entity_id_2: string;
  relationship_type: RelationshipType;
  strength: number;
  description: string;
  is_bidirectional: boolean;
  communication_frequency: number;
}

export interface SocialGraph {
  relationships: Relationship[];
}

export interface SocialGraphRequest {
  story: StoryExpansion;
  entities: AiGeneratedEntity[];
}

export type EventCategory =
  | "communication"
  | "location"
  | "media"
  | "social"
  | "financial"
  | "work"
  | "meeting"
  | "digital_activity"
  | "other";

export interface TimelineEvent {
  event_id: string;
  timestamp: string;
  category: EventCategory;
  involved_entities: string[];
  primary_entity: string;
  description: string;
  location?: string;
  coordinates?: [number, number];
  metadata: Record<string, string | number | boolean>;
  significance: number;
}

export interface TimelineGenerationRequest {
  story: StoryExpansion;
  entities: AiGeneratedEntity[];
  social_graph: SocialGraph;
}

export type DeviceType = "iphone" | "android" | "generic";

export interface PhoneCandidate {
  entity_id: string;
  entity_name: string;
  total_event_count: number;
  primary_event_count: number;
  connection_count: number;
  recommended: boolean;
  recommendation_reason?: string;
}

export interface SelectedPhone {
  entity_id: string;
  entity_name: string;
  device_type: DeviceType;
  phone_number?: string;
  email?: string;
  start_date?: string;
  end_date?: string;
}

export interface PhoneSelectionRequest {
  entities: AiGeneratedEntity[];
  timeline: TimelineEvent[];
  social_graph: SocialGraph;
  pre_selected_phones?: SelectedPhone[];
}

export interface StoryGenerationRequest {
  selected_phones: SelectedPhone[];
  timeline: TimelineEvent[];
  entities: AiGeneratedEntity[];
}

export interface PhoneStoryMappingPhone {
  entity_id: string;
  entity_name: string;
  device_type: DeviceType;
  phone_number?: string;
  email?: string;
  start_date?: string;
  end_date?: string;
}

export interface PhoneStoryMapping {
  phone: PhoneStoryMappingPhone;
  stories: unknown[];
  event_to_story_map: Record<string, string[]>;
  referenced_entity_ids: string[];
  story_type_counts: Record<string, number>;
}

export interface UFDRJobSubmission {
  job_id: string;
  phone_entity_name: string;
  success: boolean;
  message?: string;
  error?: string;
}

export interface JobGenerationResult {
  session_id: string;
  phone_mappings: PhoneStoryMapping[];
  generation_jobs: AiGenerationJob[];
  total_stories_generated: number;
  total_jobs_created: number;
  ufdr_submissions: UFDRJobSubmission[];
  all_jobs_submitted: boolean;
}

export interface SubmitJobRequest {
  generation_result: JobGenerationResult;
}

export interface AiGenerationJob {
  job_id: string;
  name?: string;
  tasks: unknown[];
  context: unknown;
  custom_events: unknown[];
  stories: unknown[];
  owner_entity?: unknown;
  entities: unknown[];
  cart_state?: unknown;
}

export interface JobStatusResponse {
  job_id: string;
  name: string;
  status: JobStatus;
  created_at?: string;
  updated_at?: string;
}

export interface SubmittedJob {
  job_id: string;
  phone_entity_name: string;
  status: JobStatus;
  submitted_at: Date;
}

export type PipelineStepKey =
  | "story-expansion"
  | "entity-extraction"
  | "social-graph"
  | "timeline"
  | "phone-selection"
  | "story-generation"
  | "submit-job";

export type StepStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "error"
  | "editing";

export interface PipelineStepConfig {
  key: PipelineStepKey;
  label: string;
  description: string;
  endpoint: string;
}

export const PIPELINE_STEPS: PipelineStepConfig[] = [
  {
    key: "story-expansion",
    label: "Story Expansion",
    description: "Expanding your brief description into a rich narrative",
    endpoint: "/pipeline/1/story-expansion",
  },
  {
    key: "entity-extraction",
    label: "Entity Extraction",
    description: "Identifying characters and their attributes",
    endpoint: "/pipeline/2/entity-extraction",
  },
  {
    key: "social-graph",
    label: "Social Graph",
    description: "Mapping relationships between entities",
    endpoint: "/pipeline/3/social-graph",
  },
  {
    key: "timeline",
    label: "Timeline Generation",
    description: "Creating the event timeline",
    endpoint: "/pipeline/4/timeline-generation",
  },
  {
    key: "phone-selection",
    label: "Phone Selection",
    description: "Selecting devices for extraction",
    endpoint: "/pipeline/5/phone-selection",
  },
  {
    key: "story-generation",
    label: "Story Generation",
    description: "Generating detailed stories for each device",
    endpoint: "/pipeline/6/story-generation",
  },
  {
    key: "submit-job",
    label: "Submit Job",
    description: "Submitting the generation job to UFDR",
    endpoint: "/pipeline/7/submit-job",
  },
];

export type StepOutput =
  | { step: "story-expansion"; data: StoryExpansion }
  | { step: "entity-extraction"; data: AiGeneratedEntity[] }
  | { step: "social-graph"; data: SocialGraph }
  | { step: "timeline"; data: TimelineEvent[] }
  | { step: "phone-selection"; data: SelectedPhone[] }
  | { step: "story-generation"; data: JobGenerationResult }
  | { step: "submit-job"; data: void };
