import { EventType } from "./cart";

/**
 * MetaFinder key types for dynamic field options
 */
export type MetaFinderKey = "formats" | "categories" | "languages";

/**
 * Base interface for all task params
 */
interface BaseTaskParams {
  quantity: number;
}

/**
 * Params for image generation tasks
 */
export interface ImageTaskParams extends BaseTaskParams {
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
  formats?: string[];
  categories?: string[];
  is_categories_and_op?: boolean;
}

/**
 * Params for audio generation tasks
 */
export interface AudioTaskParams extends BaseTaskParams {
  min_duration?: number;
  max_duration?: number;
  formats?: string[];
  categories?: string[];
  is_categories_and_op?: boolean;
}

/**
 * Params for video generation tasks
 */
export interface VideoTaskParams extends BaseTaskParams {
  min_duration?: number;
  max_duration?: number;
  formats?: string[];
  categories?: string[];
  is_categories_and_op?: boolean;
}

/**
 * Params for document generation tasks
 */
export interface DocumentTaskParams extends BaseTaskParams {
  min_size?: number;
  max_size?: number;
  formats?: string[];
}

/**
 * Params for archive generation tasks
 */
export interface ArchiveTaskParams extends BaseTaskParams {
  formats?: string[];
}

/**
 * Params for chat message generation tasks
 */
export interface ChatTaskParams extends BaseTaskParams {
  voice_messages_quantity?: number;
  num_chats?: number;
  min_num_other_participants?: number;
  max_num_other_participants?: number;
  languages?: string[];
  categories?: string[];
  is_categories_and_op?: boolean;
}

/**
 * Params for call generation tasks
 */
export interface CallTaskParams extends BaseTaskParams {
  min_duration_sec?: number;
  max_duration_sec?: number;
}

/**
 * Params for contact generation tasks
 */
export interface ContactTaskParams extends BaseTaskParams {
  min_phone_numbers?: number;
  max_phone_numbers?: number;
  min_email_addresses?: number;
  max_email_addresses?: number;
}

/**
 * Params for location generation tasks
 */
export interface LocationTaskParams extends BaseTaskParams {
  latitude?: number;
  longitude?: number;
  radius?: number;
  category?: string;
}

/**
 * Params for email generation tasks
 */
export interface EmailTaskParams extends BaseTaskParams {
  min_recipients?: number;
  max_recipients?: number;
  min_characters?: number;
  max_characters?: number;
  max_folder_amount?: number;
}

/**
 * Params for note generation tasks
 */
export interface NoteTaskParams extends BaseTaskParams {
  max_words?: number;
  languages?: string[];
  categories?: string[];
  is_categories_and_op?: boolean;
}

/**
 * Params for notification generation tasks
 */
export interface NotificationTaskParams extends BaseTaskParams {
  min_words?: number;
  max_words?: number;
}

/**
 * Params for web bookmark generation tasks
 */
export interface WebBookmarkTaskParams extends BaseTaskParams {
  min_visit_counts?: number;
  max_visit_counts?: number;
  min_folder_dirs?: number;
  max_folder_dirs?: number;
  categories?: string[];
  is_categories_and_op?: boolean;
}

/**
 * Params for web history generation tasks
 */
export interface WebHistoryTaskParams extends BaseTaskParams {
  min_visit_counts?: number;
  max_visit_counts?: number;
  categories?: string[];
  is_categories_and_op?: boolean;
}

/**
 * Params for journey generation tasks
 */
export interface JourneyTaskParams extends BaseTaskParams {
  start_time?: string;
  end_time?: string;
  radius?: number;
}

/**
 * Params for carved string generation tasks
 */
export interface CarvedStringTaskParams extends BaseTaskParams {
  min_words?: number;
  max_words?: number;
}

/**
 * Params for cookie generation tasks
 */
export interface CookieTaskParams extends BaseTaskParams {
  min_name_len?: number;
  max_name_len?: number;
  min_value_len?: number;
  max_value_len?: number;
}

/**
 * Params for calendar entry generation tasks
 */
export interface CalendarEntryTaskParams extends BaseTaskParams {
  events_categories?: string[];
  max_subject_words?: number;
  max_details_sentences?: number;
  max_reminders?: number;
  max_attendees?: number;
  languages?: string[];
  categories?: string[];
  is_categories_and_op?: boolean;
}

/**
 * Params for cell tower generation tasks
 */
export interface CellTowerTaskParams extends BaseTaskParams {
  latitude?: number;
  longitude?: number;
}

/**
 * Params for financial account generation tasks
 */
export interface FinancialAccountTaskParams extends BaseTaskParams {
  min_account_assets?: number;
  max_account_assets?: number;
}

/**
 * Params for simple tasks with no additional config
 */
export interface SimpleTaskParams extends BaseTaskParams {}

/**
 * Union of all possible task params
 */
export type TaskParams =
  | ImageTaskParams
  | AudioTaskParams
  | VideoTaskParams
  | DocumentTaskParams
  | ArchiveTaskParams
  | ChatTaskParams
  | CallTaskParams
  | ContactTaskParams
  | LocationTaskParams
  | EmailTaskParams
  | NoteTaskParams
  | NotificationTaskParams
  | WebBookmarkTaskParams
  | WebHistoryTaskParams
  | JourneyTaskParams
  | CarvedStringTaskParams
  | CookieTaskParams
  | CalendarEntryTaskParams
  | CellTowerTaskParams
  | FinancialAccountTaskParams
  | SimpleTaskParams;

/**
 * Field type definitions for dynamic form rendering
 */
export type FieldType =
  | "number"
  | "text"
  | "multiselect"
  | "autocomplete"
  | "datetime"
  | "boolean"
  | "coordinates"
  | "location"
  | "subtasks";

/**
 * Subtask data structure for attachments and nested tasks
 */
export interface SubtaskData {
  id: string;
  event_type: EventType;
  quantity: number;
  params: Record<string, unknown>;
}

/**
 * Event types that can be used as subtasks/attachments
 */
export const FILE_EVENT_TYPES: EventType[] = [
  "images",
  "videos",
  "audios",
  "documents",
];

/**
 * Event types that can be chat attachments (files + contacts + locations)
 */
export const CHAT_ATTACHMENT_EVENT_TYPES: EventType[] = [
  ...FILE_EVENT_TYPES,
  "contacts",
  "locations",
];

/**
 * Configuration for a single form field
 */
export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  /** Static options (for fields not using MetaFinder) */
  options?: string[];
  /** MetaFinder key for dynamic options - when set, options are fetched from MetaFinder */
  metafinderKey?: MetaFinderKey;
  placeholder?: string;
  helperText?: string;
  pairedWith?: string;
  /** Allowed event types for subtasks field type */
  allowedEventTypes?: EventType[];
}

/**
 * Mapping of event types to their field configurations
 */
export const TASK_FIELD_CONFIGS: Partial<Record<EventType, FieldConfig[]>> = {
  images: [
    {
      name: "min_width",
      label: "Min Width (px)",
      type: "number",
      defaultValue: 100,
      min: 1,
    },
    {
      name: "max_width",
      label: "Max Width (px)",
      type: "number",
      defaultValue: 1920,
      min: 1,
      pairedWith: "min_width",
    },
    {
      name: "min_height",
      label: "Min Height (px)",
      type: "number",
      defaultValue: 100,
      min: 1,
    },
    {
      name: "max_height",
      label: "Max Height (px)",
      type: "number",
      defaultValue: 1080,
      min: 1,
      pairedWith: "min_height",
    },
    {
      name: "formats",
      label: "Formats",
      type: "multiselect",
      metafinderKey: "formats",
    },
    {
      name: "categories",
      label: "Categories",
      type: "autocomplete",
      metafinderKey: "categories",
      placeholder: "Add categories...",
    },
  ],

  audios: [
    {
      name: "min_duration",
      label: "Min Duration (sec)",
      type: "number",
      defaultValue: 10,
      min: 1,
    },
    {
      name: "max_duration",
      label: "Max Duration (sec)",
      type: "number",
      defaultValue: 300,
      min: 1,
      pairedWith: "min_duration",
    },
    {
      name: "formats",
      label: "Formats",
      type: "multiselect",
      metafinderKey: "formats",
    },
    {
      name: "categories",
      label: "Categories",
      type: "autocomplete",
      metafinderKey: "categories",
      placeholder: "Add categories...",
    },
  ],

  videos: [
    {
      name: "min_duration",
      label: "Min Duration (sec)",
      type: "number",
      defaultValue: 10,
      min: 1,
    },
    {
      name: "max_duration",
      label: "Max Duration (sec)",
      type: "number",
      defaultValue: 300,
      min: 1,
      pairedWith: "min_duration",
    },
    {
      name: "formats",
      label: "Formats",
      type: "multiselect",
      metafinderKey: "formats",
    },
    {
      name: "categories",
      label: "Categories",
      type: "autocomplete",
      metafinderKey: "categories",
      placeholder: "Add categories...",
    },
  ],

  documents: [
    {
      name: "min_size",
      label: "Min Size (KB)",
      type: "number",
      defaultValue: 1,
      min: 1,
    },
    {
      name: "max_size",
      label: "Max Size (KB)",
      type: "number",
      defaultValue: 1000,
      min: 1,
      pairedWith: "min_size",
    },
    {
      name: "formats",
      label: "Formats",
      type: "multiselect",
      metafinderKey: "formats",
    },
  ],

  archives: [
    {
      name: "formats",
      label: "Formats",
      type: "multiselect",
      options: ["zip", "rar", "7z", "tar", "gz"],
    },
  ],

  "chat messages": [
    {
      name: "num_chats",
      label: "Number of Chats",
      type: "number",
      defaultValue: 5,
      min: 1,
    },
    {
      name: "min_num_other_participants",
      label: "Min Participants",
      type: "number",
      defaultValue: 1,
      min: 1,
    },
    {
      name: "max_num_other_participants",
      label: "Max Participants",
      type: "number",
      defaultValue: 10,
      min: 1,
      pairedWith: "min_num_other_participants",
    },
    {
      name: "voice_messages_quantity",
      label: "Voice Messages",
      type: "number",
      defaultValue: 0,
      min: 0,
    },
    {
      name: "languages",
      label: "Languages",
      type: "autocomplete",
      metafinderKey: "languages",
      placeholder: "Add languages...",
    },
    {
      name: "categories",
      label: "Message Topics",
      type: "autocomplete",
      metafinderKey: "categories",
      placeholder: "Add topics...",
    },
    {
      name: "attachments",
      label: "Attachments",
      type: "subtasks",
      allowedEventTypes: CHAT_ATTACHMENT_EVENT_TYPES,
      helperText:
        "Add images, videos, audio, documents, contacts, or locations",
    },
  ],

  "sms/mms": [
    {
      name: "num_chats",
      label: "Number of Threads",
      type: "number",
      defaultValue: 5,
      min: 1,
    },
    {
      name: "voice_messages_quantity",
      label: "Voice Messages",
      type: "number",
      defaultValue: 0,
      min: 0,
    },
    {
      name: "languages",
      label: "Languages",
      type: "autocomplete",
      metafinderKey: "languages",
      placeholder: "Add languages...",
    },
    {
      name: "categories",
      label: "Message Topics",
      type: "autocomplete",
      metafinderKey: "categories",
      placeholder: "Add topics...",
    },
    {
      name: "attachments",
      label: "Attachments",
      type: "subtasks",
      allowedEventTypes: CHAT_ATTACHMENT_EVENT_TYPES,
      helperText:
        "Add images, videos, audio, documents, contacts, or locations",
    },
  ],

  calls: [
    {
      name: "min_duration_sec",
      label: "Min Duration (sec)",
      type: "number",
      defaultValue: 10,
      min: 0,
    },
    {
      name: "max_duration_sec",
      label: "Max Duration (sec)",
      type: "number",
      defaultValue: 600,
      min: 0,
      pairedWith: "min_duration_sec",
    },
  ],

  contacts: [
    {
      name: "min_phone_numbers",
      label: "Min Phone Numbers",
      type: "number",
      defaultValue: 1,
      min: 0,
    },
    {
      name: "max_phone_numbers",
      label: "Max Phone Numbers",
      type: "number",
      defaultValue: 3,
      min: 0,
      pairedWith: "min_phone_numbers",
    },
    {
      name: "min_email_addresses",
      label: "Min Email Addresses",
      type: "number",
      defaultValue: 0,
      min: 0,
    },
    {
      name: "max_email_addresses",
      label: "Max Email Addresses",
      type: "number",
      defaultValue: 2,
      min: 0,
      pairedWith: "min_email_addresses",
    },
  ],

  locations: [
    {
      name: "location",
      label: "Location",
      type: "location",
    },
    {
      name: "radius",
      label: "Radius (km)",
      type: "number",
      defaultValue: 10,
      min: 0,
    },
    {
      name: "category",
      label: "Category",
      type: "autocomplete",
      placeholder: "Location category...",
    },
  ],

  emails: [
    {
      name: "min_recipients",
      label: "Min Recipients",
      type: "number",
      defaultValue: 1,
      min: 1,
    },
    {
      name: "max_recipients",
      label: "Max Recipients",
      type: "number",
      defaultValue: 5,
      min: 1,
      pairedWith: "min_recipients",
    },
    {
      name: "min_characters",
      label: "Min Body Length",
      type: "number",
      defaultValue: 100,
      min: 0,
    },
    {
      name: "max_characters",
      label: "Max Body Length",
      type: "number",
      defaultValue: 500,
      min: 0,
      pairedWith: "min_characters",
    },
    {
      name: "max_folder_amount",
      label: "Max Folders",
      type: "number",
      defaultValue: 5,
      min: 1,
    },
    {
      name: "attachments",
      label: "Attachments",
      type: "subtasks",
      allowedEventTypes: FILE_EVENT_TYPES,
      helperText: "Add images, videos, audio, or documents",
    },
  ],

  notes: [
    {
      name: "max_words",
      label: "Max Words",
      type: "number",
      defaultValue: 100,
      min: 1,
    },
    {
      name: "languages",
      label: "Languages",
      type: "autocomplete",
      metafinderKey: "languages",
      placeholder: "Add languages...",
    },
    {
      name: "categories",
      label: "Topics",
      type: "autocomplete",
      metafinderKey: "categories",
      placeholder: "Add topics...",
    },
  ],

  notifications: [
    {
      name: "min_words",
      label: "Min Words",
      type: "number",
      defaultValue: 5,
      min: 1,
    },
    {
      name: "max_words",
      label: "Max Words",
      type: "number",
      defaultValue: 20,
      min: 1,
      pairedWith: "min_words",
    },
  ],

  "web bookmarks": [
    {
      name: "min_visit_counts",
      label: "Min Visit Count",
      type: "number",
      defaultValue: 1,
      min: 0,
    },
    {
      name: "max_visit_counts",
      label: "Max Visit Count",
      type: "number",
      defaultValue: 50,
      min: 0,
      pairedWith: "min_visit_counts",
    },
    {
      name: "min_folder_dirs",
      label: "Min Folders",
      type: "number",
      defaultValue: 1,
      min: 0,
    },
    {
      name: "max_folder_dirs",
      label: "Max Folders",
      type: "number",
      defaultValue: 5,
      min: 0,
      pairedWith: "min_folder_dirs",
    },
    {
      name: "categories",
      label: "URL Categories",
      type: "autocomplete",
      metafinderKey: "categories",
      placeholder: "Add categories...",
    },
  ],

  "web history": [
    {
      name: "min_visit_counts",
      label: "Min Visit Count",
      type: "number",
      defaultValue: 1,
      min: 0,
    },
    {
      name: "max_visit_counts",
      label: "Max Visit Count",
      type: "number",
      defaultValue: 50,
      min: 0,
      pairedWith: "min_visit_counts",
    },
    {
      name: "categories",
      label: "URL Categories",
      type: "autocomplete",
      metafinderKey: "categories",
      placeholder: "Add categories...",
    },
  ],

  journeys: [
    { name: "start_time", label: "Start Time", type: "datetime" },
    {
      name: "end_time",
      label: "End Time",
      type: "datetime",
      pairedWith: "start_time",
    },
    {
      name: "radius",
      label: "Radius (km)",
      type: "number",
      defaultValue: 20,
      min: 0,
    },
  ],

  "carved strings": [
    {
      name: "min_words",
      label: "Min Words",
      type: "number",
      defaultValue: 10,
      min: 1,
    },
    {
      name: "max_words",
      label: "Max Words",
      type: "number",
      defaultValue: 50,
      min: 1,
      pairedWith: "min_words",
    },
  ],

  cookies: [
    {
      name: "min_name_len",
      label: "Min Name Length",
      type: "number",
      defaultValue: 3,
      min: 0,
    },
    {
      name: "max_name_len",
      label: "Max Name Length",
      type: "number",
      defaultValue: 20,
      min: 0,
      pairedWith: "min_name_len",
    },
    {
      name: "min_value_len",
      label: "Min Value Length",
      type: "number",
      defaultValue: 5,
      min: 0,
    },
    {
      name: "max_value_len",
      label: "Max Value Length",
      type: "number",
      defaultValue: 100,
      min: 0,
      pairedWith: "min_value_len",
    },
  ],

  "calendar entry": [
    {
      name: "max_subject_words",
      label: "Max Subject Words",
      type: "number",
      defaultValue: 10,
      min: 1,
    },
    {
      name: "max_details_sentences",
      label: "Max Details Sentences",
      type: "number",
      defaultValue: 5,
      min: 0,
    },
    {
      name: "max_reminders",
      label: "Max Reminders",
      type: "number",
      defaultValue: 3,
      min: 0,
    },
    {
      name: "max_attendees",
      label: "Max Attendees",
      type: "number",
      defaultValue: 10,
      min: 0,
    },
    {
      name: "events_categories",
      label: "Event Categories",
      type: "autocomplete",
      placeholder: "e.g., Work, Personal...",
    },
    {
      name: "languages",
      label: "Languages",
      type: "autocomplete",
      metafinderKey: "languages",
      placeholder: "Add languages...",
    },
    {
      name: "categories",
      label: "Topics",
      type: "autocomplete",
      metafinderKey: "categories",
      placeholder: "Add topics...",
    },
    {
      name: "attachments",
      label: "Attachments",
      type: "subtasks",
      allowedEventTypes: FILE_EVENT_TYPES,
      helperText: "Add images, videos, audio, or documents",
    },
  ],

  "cell tower": [
    {
      name: "latitude",
      label: "Latitude",
      type: "number",
      min: -90,
      max: 90,
      placeholder: "-90 to 90",
    },
    {
      name: "longitude",
      label: "Longitude",
      type: "number",
      min: -180,
      max: 180,
      placeholder: "-180 to 180",
    },
  ],

  "financial account": [
    {
      name: "min_account_assets",
      label: "Min Assets",
      type: "number",
      defaultValue: 0,
      min: 0,
    },
    {
      name: "max_account_assets",
      label: "Max Assets",
      type: "number",
      defaultValue: 10,
      min: 0,
      pairedWith: "min_account_assets",
    },
  ],
};

/**
 * Event types that have no configurable params beyond quantity
 */
export const SIMPLE_EVENT_TYPES: EventType[] = [
  "passwords",
  "installed applications",
  "credit card",
  "recognized device",
  "user account",
  "powering event",
];

/**
 * Returns whether an event type has configurable params
 */
export function hasConfigurableParams(eventType: EventType): boolean {
  return !SIMPLE_EVENT_TYPES.includes(eventType);
}

/**
 * Gets the field configuration for an event type
 */
export function getFieldConfig(eventType: EventType): FieldConfig[] {
  return TASK_FIELD_CONFIGS[eventType] ?? [];
}

/**
 * Creates default params object for an event type
 */
export function createDefaultParams(
  eventType: EventType
): Record<string, unknown> {
  const fields = getFieldConfig(eventType);
  const params: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      params[field.name] = field.defaultValue;
    }
  }

  return params;
}
