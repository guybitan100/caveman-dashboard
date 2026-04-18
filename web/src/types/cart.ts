import { JobStatus } from './job';

export interface DeviceInfoMetadata {
  key: string;
  value: string;
}

export interface DeviceInfo {
  os: string | null;
  model: string | null;
  metadata: DeviceInfoMetadata[];
}

/**
 * Device model from backend - contains manufacturer, name, and os
 */
export interface DeviceModel {
  manufacturer: string;
  name: string;
  os: "ios" | "android";
}

export interface CountryInfo {
  name: string;
  alpha2: string;
  alpha3: string;
  timezones: string[];
  languages: string[];
}

export interface DeviceContext {
  device: DeviceModel;
  start_date: string | null;
  end_date: string | null;
  country_info: CountryInfo | null;
}

export interface Coordinate {
  lat: number;
  lon: number;
}

export interface Entity {
  uid: string;
  is_owner: boolean;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  is_male: boolean | null;
  time?: string | null;
  is_sub_event?: boolean;
  is_nested_data?: boolean;
  coordinate?: Coordinate | null;
  location_id?: string | null;
}

export type StoryType =
  | "location"
  | "image"
  | "document"
  | "video"
  | "audio"
  | "sms/mms"
  | "call"
  | "email"
  | "app"
  | "contact"
  | "powering event"
  | "web bookmarks"
  | "web history"
  | "cookie"
  | "chat"
  | "route"
  | "chat message";

export interface StoryData {
  story_id: string;
  story_type: StoryType;
  user_description: string | null;
  time: string;
  location_ref?: string | null;
  // Story types have additional fields based on story_type
  [key: string]: unknown;
}

export type ReportModelFieldType =
  | "field"
  | "multiField"
  | "modelField"
  | "multiModelField";

export interface CustomEventFieldValue {
  field_type: "field";
  value_type: string;
  value: string | null;
}

export interface CustomEventMultiFieldValue {
  field_type: "multiField";
  value_type: string;
  value: string[];
}

export interface CustomEventModelFieldValue {
  field_type: "modelField";
  value_type: string;
  fields: Record<string, CustomEventFieldValues>;
}

export interface CustomEventMultiModelFieldValue {
  field_type: "multiModelField";
  value_type: string;
  models: CustomEventModelFieldValue[];
}

export type CustomEventFieldValues =
  | CustomEventFieldValue
  | CustomEventMultiFieldValue
  | CustomEventModelFieldValue
  | CustomEventMultiModelFieldValue;

export interface CustomEvent {
  event_id: string;
  model_type: string;
  fields: Record<string, CustomEventFieldValues>;
}

export interface RandomEventsRequest {
  total_events: number;
  event_weights?: Partial<Record<EventType, number>>;
}

export type EventType =
  | "chat messages"
  | "contacts"
  | "images"
  | "videos"
  | "audios"
  | "calls"
  | "locations"
  | "cookies"
  | "passwords"
  | "web bookmarks"
  | "web history"
  | "emails"
  | "installed applications"
  | "documents"
  | "notifications"
  | "journeys"
  | "notes"
  | "carved strings"
  | "archives"
  | "sms/mms"
  | "calendar entry"
  | "cell tower"
  | "credit card"
  | "recognized device"
  | "user account"
  | "powering event"
  | "financial account";

export interface GenerationTask {
  task_id: string;
  event_type: EventType;
  quantity: number;
  parent_task_id?: string | null;
  root_task_id?: string | null;
  attachments?: GenerationTask[];
  [key: string]: unknown;
}

/**
 * Subtask extracted from a parent task's attachments
 */
export interface SubtaskInfo {
  task: GenerationTask;
  parentTask: GenerationTask;
  parentEventType: EventType;
}

/**
 * Extract all subtasks (attachments) from tasks, grouped by event type
 */
export function extractSubtasks(
  tasks: GenerationTask[]
): Map<EventType, SubtaskInfo[]> {
  const subtaskMap = new Map<EventType, SubtaskInfo[]>();

  for (const task of tasks) {
    const attachments = task.attachments;
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const attachment of attachments) {
        const eventType = attachment.event_type;
        if (!subtaskMap.has(eventType)) {
          subtaskMap.set(eventType, []);
        }
        subtaskMap.get(eventType)!.push({
          task: attachment,
          parentTask: task,
          parentEventType: task.event_type,
        });
      }
    }
  }

  return subtaskMap;
}

/**
 * Node in the stories graph - contains story data nested inside 'data' field
 */
export interface StoryNode {
  id: string;
  data: StoryData;
}

/**
 * Edge in the stories graph - connects stories (e.g., messages in a chat)
 */
export interface StoryEdge {
  source: string;
  target: string;
  [key: string]: unknown;
}

/**
 * Stories are stored as a directed graph (NetworkX format from backend)
 */
export interface StoriesGraph {
  directed: boolean;
  multigraph: boolean;
  graph: Record<string, unknown>;
  nodes: StoryNode[];
  edges: StoryEdge[];
}

export interface GenerationJob {
  job_id: string;
  name: string;
  status: JobStatus;
  tasks: GenerationTask[];
  context: DeviceContext;
  device_info: DeviceInfoMetadata[];
  custom_events: CustomEvent[];
  stories: StoriesGraph;
  owner_entity: Entity | null;
  entities: Entity[];
}

export type CartSectionKey =
  | "deviceContext"
  | "tasks"
  | "stories"
  | "entities"
  | "customEvents";

export interface CartSectionConfig {
  key: CartSectionKey;
  title: string;
  icon: string;
}

export const CART_SECTIONS: CartSectionConfig[] = [
  { key: "deviceContext", title: "Device Information", icon: "smartphone" },
  { key: "tasks", title: "Events & Files", icon: "calendar" },
  { key: "stories", title: "Stories", icon: "timeline" },
  { key: "entities", title: "Entities", icon: "people" },
  { key: "customEvents", title: "Custom Events", icon: "edit" },
];

export interface UpdateDeviceContextRequest {
  device?: Partial<DeviceModel>;
  start_date?: string;
  end_date?: string;
  country_info?: string | CountryInfo | null;
}

export interface CreateEntityRequest {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  is_male?: boolean | null;
}

export interface UpdateEntityRequest extends Partial<CreateEntityRequest> {
  uid?: string;
}

export interface CreateStoryRequest {
  story_type: StoryType;
  time: string;
  user_description?: string | null;
  location_ref?: string | null;
  [key: string]: unknown;
}

export interface UpdateStoryRequest extends Partial<CreateStoryRequest> {
  story_id?: string;
}

export interface CreateCustomEventRequest {
  model_type: string;
  fields: Record<string, CustomEventFieldValues>;
}

export interface UpdateCustomEventRequest
  extends Partial<CreateCustomEventRequest> {
  event_id?: string;
}

export interface CreateTaskRequest {
  event_type: EventType;
  quantity: number;
  [key: string]: unknown;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  task_id?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface DraftJobOperationResponse {
  job: GenerationJob | null;
  validation: ValidationResult | null;
}

export interface CartUIState {
  isOpen: boolean;
  expandedSections: Record<CartSectionKey, boolean>;
  isLoading: boolean;
  error: string | null;
}

export interface CartItemAction {
  type: "add" | "edit" | "delete";
  section: CartSectionKey;
  itemId?: string;
}
