import { MessageStatus } from "../../types/storyParams";

/**
 * A single chat message within a chat story.
 * Maps to ChatMessageStoryData in backend.
 */
export interface ChatMessageData {
  /** Optional story ID (assigned when saved) */
  story_id?: string;
  /** Always 'chat message' for messages */
  story_type: "chat message";
  /** UID of the parent chat story */
  chat_uid: string;
  /** Entity UID of the sender */
  sender: string;
  /** Message text content */
  text: string;
  /** Message delivery status */
  status: MessageStatus;
  /** Whether this message was forwarded */
  forwarded: boolean;
  /** Array of story reference IDs for attachments */
  attachments: string[];
  /** ISO timestamp of when the message was sent */
  time: string;
}

/**
 * The chat data structure containing participants and messages.
 * Maps to _ChatStoryData in backend.
 */
export interface ChatData {
  /** Array of entity UIDs participating in the chat */
  participants: string[];
  /** Array of chat messages */
  messages: ChatMessageData[];
}

/**
 * Messages grouped by date for display purposes.
 */
export interface GroupedMessages {
  /** Formatted date string (e.g., "Dec 24, 2025") */
  date: string;
  /** Messages for this date */
  messages: ChatMessageData[];
}

/**
 * Creates an empty chat data structure.
 */
export function createEmptyChatData(): ChatData {
  return {
    participants: [],
    messages: [],
  };
}

/**
 * Creates a new chat message with default values.
 */
export function createChatMessage(
  chatUid: string,
  sender: string,
  text: string,
  time?: string
): ChatMessageData {
  return {
    story_type: "chat message",
    chat_uid: chatUid,
    sender,
    text,
    status: "Read",
    forwarded: false,
    attachments: [],
    time: time ?? new Date().toISOString(),
  };
}

/**
 * Sorts messages by time (oldest first).
 */
export function sortMessagesByTime(
  messages: ChatMessageData[]
): ChatMessageData[] {
  return [...messages].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
}
