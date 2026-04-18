import { StoryType } from "./cart";

export const DELETED_STATE_OPTIONS = ["Deleted", "Intact", "Unknown"] as const;
export type DeletedState = (typeof DELETED_STATE_OPTIONS)[number];

export const LOCATION_CATEGORY_OPTIONS = [
  "Mentioned",
  "Network",
  "WirelessNetwork",
  "Events",
  "External",
  "Places",
  "SearchedPlaces",
  "Metadata",
  "Journey",
  "Synced",
  "Suggested",
  "Ride",
  "Route",
  "Reminder",
  "Navigation",
  "Recent",
  "Frequent",
  "PokemonGo",
  "GpsFix",
  "UserSpecified",
  "Calculated",
  "Carved",
  "CellTower",
  "Harvested",
  "Other",
  "Unknown",
] as const;
export type LocationCategory = (typeof LOCATION_CATEGORY_OPTIONS)[number];

export const MESSAGE_STATUS_OPTIONS = ["Sent", "Read"] as const;
export type MessageStatus = (typeof MESSAGE_STATUS_OPTIONS)[number];

export const CALL_DIRECTION_OPTIONS = [
  "Incoming",
  "Outgoing",
  "Unknown",
] as const;
export type CallDirection = (typeof CALL_DIRECTION_OPTIONS)[number];

export const CALL_TYPE_OPTIONS = [
  "Incoming",
  "Outgoing",
  "Missed",
  "Rejected",
  "Cancelled",
  "Unknown",
] as const;
export type CallType = (typeof CALL_TYPE_OPTIONS)[number];

export const EMAIL_FOLDER_OPTIONS = ["Inbox", "Sent Items"] as const;
export type EmailFolder = (typeof EMAIL_FOLDER_OPTIONS)[number];

export const POWERING_EVENT_TYPE_OPTIONS = [
  "On",
  "Off",
  "Reset",
  "Connect",
  "Disconnect",
  "TimeZoneChange",
] as const;
export type PoweringEventType = (typeof POWERING_EVENT_TYPE_OPTIONS)[number];

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export type StoryFileType = "metafinder" | "upload";

/**
 * Information about a file attached to a story
 * Matches backend StoryFileInfo model
 */
export interface StoryFileInfo {
  s3_key: string;
  file_type: StoryFileType;
  file_name?: string | null;
  size: number;
  presigned_url?: string | null;
}

export interface ContactInfo {
  first_name?: string | null;
  last_name?: string | null;
  phones: string[];
  emails: string[];
}

export interface AppInfo {
  app_id: string;
  name?: string | null;
}

export interface BaseStoryParams {
  user_description?: string | null;
  time: string;
  location_ref?: string | null;
}

/**
 * Location story data
 */
export interface LocationStoryParams extends BaseStoryParams {
  story_type: "location";
  coordinate: Coordinate;
  category: LocationCategory;
  app_id?: string | null;
}

/**
 * Call story data
 */
export interface CallStoryParams extends BaseStoryParams {
  story_type: "call";
  participant: string; // EntityID
  direction: CallDirection;
  call_type?: CallType | null;
  duration?: number | null;
  app_id?: string | null;
}

/**
 * Instant Message (SMS/MMS) story data
 */
export interface InstantMessageStoryParams extends BaseStoryParams {
  story_type: "sms/mms";
  sender: string; // EntityID
  text: string;
  status: MessageStatus;
  attachment?: string | null; // StoryRef
  app_id?: string | null;
}

/**
 * Email story data
 */
export interface EmailStoryParams extends BaseStoryParams {
  story_type: "email";
  from_: string; // EntityID
  to: string[]; // EntityID[]
  subject?: string | null;
  body?: string | null;
  folder: EmailFolder;
  attachments: string[]; // StoryRef[]
  app_id?: string | null;
}

/**
 * Contact story data
 */
export interface ContactStoryParams extends BaseStoryParams {
  story_type: "contact";
  contact: ContactInfo;
  app_id?: string | null;
}

/**
 * Web History story data
 */
export interface WebHistoryStoryParams extends BaseStoryParams {
  story_type: "web history";
  url: string;
  title?: string | null;
  uses: number;
  app_id?: string | null;
}

/**
 * Web Bookmark story data
 */
export interface WebBookmarkStoryParams extends BaseStoryParams {
  story_type: "web bookmarks";
  url: string;
  title?: string | null;
  uses: number;
  folder?: string | null;
  app_id?: string | null;
}

/**
 * Cookie story data
 */
export interface CookieStoryParams extends BaseStoryParams {
  story_type: "cookie";
  domain: string;
  name: string;
  value: string;
  app_id?: string | null;
}

/**
 * Powering Event story data
 */
export interface PoweringEventStoryParams extends BaseStoryParams {
  story_type: "powering event";
  event_name: PoweringEventType;
  description?: string | null;
  app_id?: string | null;
}

/**
 * App story data
 */
export interface AppStoryParams extends BaseStoryParams {
  story_type: "app";
  app: AppInfo;
}

export interface ImageStoryParams extends BaseStoryParams {
  story_type: "image";
  deleted_state: DeletedState;
  file: StoryFileInfo;
}

export interface AudioStoryParams extends BaseStoryParams {
  story_type: "audio";
  deleted_state: DeletedState;
  file: StoryFileInfo;
}

export interface VideoStoryParams extends BaseStoryParams {
  story_type: "video";
  deleted_state: DeletedState;
  file: StoryFileInfo;
}

export interface DocumentStoryParams extends BaseStoryParams {
  story_type: "document";
  deleted_state: DeletedState;
  file: StoryFileInfo;
}

/**
 * Chat message data (used within chat stories)
 */
export interface ChatMessageData {
  story_id?: string;
  story_type: "chat message";
  chat_uid: string;
  sender: string; // EntityID
  text: string;
  status: MessageStatus;
  forwarded: boolean;
  attachments: string[]; // StoryRef[]
  time: string;
}

/**
 * Chat story data (group story containing messages)
 */
export interface ChatStoryParams {
  story_type: "chat";
  user_description?: string | null;
  app_id?: string | null;
  chat: {
    participants: string[]; // EntityID[]
    messages: ChatMessageData[];
  };
}

/**
 * Route story data (group story containing locations)
 */
export interface RouteStoryParams {
  story_type: "route";
  user_description?: string | null;
  locations: {
    locations: LocationStoryParams[];
  };
}

/**
 * All simple story params (non-group, non-file)
 */
export type SimpleStoryParams =
  | LocationStoryParams
  | CallStoryParams
  | InstantMessageStoryParams
  | EmailStoryParams
  | ContactStoryParams
  | WebHistoryStoryParams
  | WebBookmarkStoryParams
  | CookieStoryParams
  | PoweringEventStoryParams
  | AppStoryParams;

/**
 * All file-based story params
 */
export type FileStoryParams =
  | ImageStoryParams
  | AudioStoryParams
  | VideoStoryParams
  | DocumentStoryParams;

/**
 * All group story params
 */
export type GroupStoryParams = ChatStoryParams | RouteStoryParams;

/**
 * Union of all story params
 */
export type StoryParams =
  | SimpleStoryParams
  | FileStoryParams
  | GroupStoryParams;

/**
 * Field types for story forms
 */
export type StoryFieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "datetime"
  | "coordinate"
  | "entity" // Single entity selector from job entities
  | "entities" // Multiple entity selector from job entities
  | "textarea"
  | "contact" // Contact info (first_name, last_name, phones, emails)
  | "app" // App info (app_id, name)
  | "story_ref" // Single story reference selector
  | "story_refs" // Multiple story references selector
  | "file"; // File picker (MetaFinder or upload)

/**
 * Configuration for a single story form field
 */
export interface StoryFieldConfig {
  name: string;
  label: string;
  type: StoryFieldType;
  required?: boolean;
  defaultValue?: unknown;
  options?: readonly string[];
  placeholder?: string;
  helperText?: string;
  min?: number;
  max?: number;
  rows?: number;
  /** File data type for 'file' field type */
  fileDataType?: "image" | "video" | "audio" | "document";
  /** Story types that can be referenced for 'story_ref' / 'story_refs' field types */
  storyRefTypes?: StoryType[];
}

/**
 * Story types that are currently supported (including file types)
 */
export const SUPPORTED_STORY_TYPES: StoryType[] = [
  "location",
  "call",
  "sms/mms",
  "email",
  "contact",
  "web history",
  "web bookmarks",
  "cookie",
  "powering event",
  "app",
  "chat",
  "route",
  "image",
  "audio",
  "video",
  "document",
];

/**
 * Story types that require file picker
 */
export const FILE_STORY_TYPES: StoryType[] = [
  "image",
  "audio",
  "video",
  "document",
];

/**
 * Story types that are group/complex types
 * These require special UI for managing sub-items (messages, waypoints)
 */
export const GROUP_STORY_TYPES: StoryType[] = ["chat", "route"];

export const STORY_FIELD_CONFIGS: Partial<
  Record<StoryType, StoryFieldConfig[]>
> = {
  location: [
    {
      name: "coordinate",
      label: "Location",
      type: "coordinate",
      required: true,
      // TODO: Implement map-based location picker component
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      options: LOCATION_CATEGORY_OPTIONS,
      defaultValue: "Unknown",
    },
    {
      name: "app_id",
      label: "Application",
      type: "text", // TODO: Could be app selector in future
      placeholder: "Optional app ID",
    },
  ],

  call: [
    {
      name: "participant",
      label: "Participant",
      type: "entity",
      required: true,
    },
    {
      name: "direction",
      label: "Direction",
      type: "select",
      options: CALL_DIRECTION_OPTIONS,
      required: true,
    },
    {
      name: "call_type",
      label: "Call Type",
      type: "select",
      options: CALL_TYPE_OPTIONS,
    },
    {
      name: "duration",
      label: "Duration (seconds)",
      type: "number",
      min: 0,
      placeholder: "Call duration",
    },
    {
      name: "app_id",
      label: "Application",
      type: "text",
      placeholder: "Optional app ID",
    },
  ],

  "sms/mms": [
    {
      name: "sender",
      label: "Sender",
      type: "entity",
      required: true,
    },
    {
      name: "text",
      label: "Message",
      type: "textarea",
      required: true,
      rows: 3,
      placeholder: "Enter message text...",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: MESSAGE_STATUS_OPTIONS,
      defaultValue: "Read",
    },
    {
      name: "attachment",
      label: "Attachment",
      type: "story_ref",
      storyRefTypes: ["image", "audio", "video", "document"],
      placeholder: "Optional attachment reference",
    },
    {
      name: "app_id",
      label: "Application",
      type: "text",
      placeholder: "Optional app ID",
    },
  ],

  email: [
    {
      name: "from_",
      label: "From",
      type: "entity",
      required: true,
    },
    {
      name: "to",
      label: "To",
      type: "entities",
      required: true,
    },
    {
      name: "subject",
      label: "Subject",
      type: "text",
      placeholder: "Email subject",
    },
    {
      name: "body",
      label: "Body",
      type: "textarea",
      rows: 4,
      placeholder: "Email body...",
    },
    {
      name: "folder",
      label: "Folder",
      type: "select",
      options: EMAIL_FOLDER_OPTIONS,
      defaultValue: "Inbox",
    },
    {
      name: "attachments",
      label: "Attachments",
      type: "story_refs",
      storyRefTypes: ["image", "audio", "video", "document"],
      placeholder: "Select file attachments",
    },
  ],

  contact: [
    {
      name: "contact",
      label: "Contact Info",
      type: "contact",
      required: true,
    },
    {
      name: "app_id",
      label: "Application",
      type: "text",
      placeholder: "Optional app ID",
    },
  ],

  "web history": [
    {
      name: "url",
      label: "URL",
      type: "text",
      required: true,
      placeholder: "https://example.com",
    },
    {
      name: "title",
      label: "Page Title",
      type: "text",
      placeholder: "Optional page title",
    },
    {
      name: "uses",
      label: "Visit Count",
      type: "number",
      defaultValue: 1,
      min: 1,
    },
    {
      name: "app_id",
      label: "Application",
      type: "text",
      placeholder: "Optional app ID (browser)",
    },
  ],

  "web bookmarks": [
    {
      name: "url",
      label: "URL",
      type: "text",
      required: true,
      placeholder: "https://example.com",
    },
    {
      name: "title",
      label: "Bookmark Title",
      type: "text",
      placeholder: "Optional bookmark title",
    },
    {
      name: "uses",
      label: "Visit Count",
      type: "number",
      defaultValue: 1,
      min: 1,
    },
    {
      name: "folder",
      label: "Folder",
      type: "text",
      placeholder: "Optional folder path",
    },
    {
      name: "app_id",
      label: "Application",
      type: "text",
      placeholder: "Optional app ID (browser)",
    },
  ],

  cookie: [
    {
      name: "domain",
      label: "Domain",
      type: "text",
      required: true,
      placeholder: "example.com",
    },
    {
      name: "name",
      label: "Cookie Name",
      type: "text",
      required: true,
      placeholder: "session_id",
    },
    {
      name: "value",
      label: "Cookie Value",
      type: "text",
      required: true,
      placeholder: "cookie value",
    },
    {
      name: "app_id",
      label: "Application",
      type: "text",
      placeholder: "Optional app ID",
    },
  ],

  "powering event": [
    {
      name: "event_name",
      label: "Event Type",
      type: "select",
      options: POWERING_EVENT_TYPE_OPTIONS,
      required: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      rows: 2,
      placeholder: "Optional event description",
    },
  ],

  app: [
    {
      name: "app",
      label: "Application",
      type: "app",
      required: true,
    },
  ],

  // Group stories have special handling
  chat: [
    {
      name: "chat.participants",
      label: "Participants",
      type: "entities",
      required: true,
    },
    // Messages are handled separately in the UI
  ],

  // Chat message fields (used in MessageEditDialog)
  "chat message": [
    {
      name: "text",
      label: "Message",
      type: "textarea",
      required: true,
      rows: 3,
      placeholder: "Enter message text...",
    },
    {
      name: "time",
      label: "Timestamp",
      type: "datetime",
      required: true,
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: MESSAGE_STATUS_OPTIONS,
      defaultValue: "Read",
    },
    {
      name: "attachments",
      label: "Attachments",
      type: "story_refs",
      storyRefTypes: ["image", "audio", "video", "document", "contact"],
      placeholder: "Select attachments (optional)",
    },
    {
      name: "forwarded",
      label: "Forwarded message",
      type: "boolean",
      defaultValue: false,
    },
  ],

  route: [
    // Locations are handled separately in the UI
  ],

  image: [
    {
      name: "file",
      label: "Image",
      type: "file",
      fileDataType: "image",
      required: true,
    },
    {
      name: "deleted_state",
      label: "Deleted State",
      type: "select",
      options: DELETED_STATE_OPTIONS,
      defaultValue: "Intact",
    },
  ],

  audio: [
    {
      name: "file",
      label: "Audio",
      type: "file",
      fileDataType: "audio",
      required: true,
    },
    {
      name: "deleted_state",
      label: "Deleted State",
      type: "select",
      options: DELETED_STATE_OPTIONS,
      defaultValue: "Intact",
    },
  ],

  video: [
    {
      name: "file",
      label: "Video",
      type: "file",
      fileDataType: "video",
      required: true,
    },
    {
      name: "deleted_state",
      label: "Deleted State",
      type: "select",
      options: DELETED_STATE_OPTIONS,
      defaultValue: "Intact",
    },
  ],

  document: [
    {
      name: "file",
      label: "Document",
      type: "file",
      fileDataType: "document",
      required: true,
    },
    {
      name: "deleted_state",
      label: "Deleted State",
      type: "select",
      options: DELETED_STATE_OPTIONS,
      defaultValue: "Intact",
    },
  ],
};

/**
 * Get field configuration for a story type
 */
export function getStoryFieldConfig(storyType: StoryType): StoryFieldConfig[] {
  return STORY_FIELD_CONFIGS[storyType] ?? [];
}

/**
 * Create default params for a story type
 */
export function createDefaultStoryParams(
  storyType: StoryType
): Record<string, unknown> {
  const fieldConfig = getStoryFieldConfig(storyType);
  const defaults: Record<string, unknown> = {};

  for (const field of fieldConfig) {
    if (field.defaultValue !== undefined) {
      defaults[field.name] = field.defaultValue;
    } else if (field.type === "entities") {
      defaults[field.name] = [];
    } else if (field.type === "contact") {
      defaults[field.name] = {
        first_name: null,
        last_name: null,
        phones: [],
        emails: [],
      };
    } else if (field.type === "app") {
      defaults[field.name] = {
        app_id: "",
        name: null,
      };
    } else if (field.type === "coordinate") {
      defaults[field.name] = {
        latitude: 0,
        longitude: 0,
      };
    }
  }

  return defaults;
}

/**
 * Check if a story type requires a file picker
 */
export function isFileStoryType(storyType: StoryType): boolean {
  return FILE_STORY_TYPES.includes(storyType);
}

/**
 * Check if a story type is a group/complex type
 */
export function isGroupStoryType(storyType: StoryType): boolean {
  return GROUP_STORY_TYPES.includes(storyType);
}
