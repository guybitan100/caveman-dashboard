import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useCartStore } from "../../stores/cartStore";
import { Entity } from "../../types/cart";
import { formatDate } from "../../utils/date";
import { getEntityDisplayName as getDisplayName } from "../../utils/entity";
import {
  ChatMessageData,
  ChatData,
  GroupedMessages,
  createChatMessage,
  sortMessagesByTime,
} from "./types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

interface UseStoryChatEditorProps {
  /** Initial chat data (for editing existing chat) */
  initialData?: ChatData;
  /** Chat UID for linking messages */
  chatUid: string;
  /** Callback when chat data changes */
  onChange: (chat: ChatData) => void;
}

interface UseStoryChatEditorReturn {
  chat: ChatData;
  groupedMessages: GroupedMessages[];
  selectedSender: Entity | null;
  newMessageText: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  addMessage: () => void;
  editMessage: (
    messageIndex: number,
    updates: Partial<ChatMessageData>
  ) => void;
  deleteMessage: (messageIndex: number) => void;

  addParticipant: (entityId: string) => void;
  removeParticipant: (entityId: string) => void;

  setNewMessageText: (text: string) => void;
  setSender: (entity: Entity | null) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;

  getEntityById: (id: string) => Entity | undefined;
  getEntityDisplayName: (entityId: string) => string;
  isOwner: (entityId: string) => boolean;
  availableEntities: Entity[];
  participantEntities: Entity[];
  ownerEntity: Entity | null;
}

/**
 * Groups messages by date for display with date separators.
 */
function groupMessagesByDate(messages: ChatMessageData[]): GroupedMessages[] {
  const groups: GroupedMessages[] = [];
  const sortedMessages = sortMessagesByTime(messages);

  for (const message of sortedMessages) {
    const formattedDate = formatDate(message.time, "Unknown Date");

    const existingGroup = groups.find((g) => g.date === formattedDate);
    if (existingGroup) {
      existingGroup.messages.push(message);
    } else {
      groups.push({ date: formattedDate, messages: [message] });
    }
  }

  return groups;
}

/**
 * Generates a timestamp slightly after the last message.
 */
function getNextMessageTime(messages: ChatMessageData[]): string {
  if (messages.length === 0) {
    return new Date().toISOString();
  }

  const lastMessage = messages[messages.length - 1];
  const lastTime = new Date(lastMessage.time);
  // Add 1-5 minutes randomly
  const offsetMs = (1 + Math.random() * 4) * 60 * 1000;
  return new Date(lastTime.getTime() + offsetMs).toISOString();
}

export function useStoryChatEditor({
  initialData,
  chatUid,
  onChange,
}: UseStoryChatEditorProps): UseStoryChatEditorReturn {
  const { job } = useCartStore();

  // Local chat state
  const [chat, setChat] = useState<ChatData>(
    () => initialData ?? { participants: [], messages: [] }
  );
  const [selectedSender, setSelectedSender] = useState<Entity | null>(null);
  const [newMessageText, setNewMessageText] = useState("");

  // Ref for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get entities from job
  const allEntities = useMemo(() => job?.entities ?? [], [job?.entities]);
  const ownerEntity = useMemo(
    () => job?.owner_entity ?? null,
    [job?.owner_entity]
  );

  // Available entities (owner + all entities)
  const availableEntities = useMemo(() => {
    const entities: Entity[] = [];
    if (ownerEntity) {
      entities.push(ownerEntity);
    }
    entities.push(...allEntities.filter((e) => e.uid !== ownerEntity?.uid));
    return entities;
  }, [allEntities, ownerEntity]);

  // Participant entities
  const participantEntities = useMemo(() => {
    return chat.participants
      .map((id) => availableEntities.find((e) => e.uid === id))
      .filter((e): e is Entity => e !== undefined);
  }, [chat.participants, availableEntities]);

  // Grouped messages for display
  const groupedMessages = useMemo(
    () => groupMessagesByDate(chat.messages),
    [chat.messages]
  );

  // Set default sender to owner on mount
  useEffect(() => {
    if (!selectedSender && ownerEntity) {
      setSelectedSender(ownerEntity);
    }
  }, [ownerEntity, selectedSender]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [groupedMessages]);

  // Sync chat state when initialData changes (e.g., after fetching job)
  useEffect(() => {
    if (initialData) {
      setChat(initialData);
    }
  }, [initialData]);

  // Sync changes to parent
  const updateChat = useCallback(
    (updater: (prev: ChatData) => ChatData) => {
      setChat((prev) => {
        const updated = updater(prev);
        onChange(updated);
        return updated;
      });
    },
    [onChange]
  );

  // Helper: Get entity by ID
  const getEntityById = useCallback(
    (id: string): Entity | undefined => {
      return availableEntities.find((e) => e.uid === id);
    },
    [availableEntities]
  );

  // Helper: Get display name for entity
  const getEntityDisplayName = useCallback(
    (entityId: string): string => {
      const entity = getEntityById(entityId);
      return entity ? getDisplayName(entity) : "Unknown";
    },
    [getEntityById]
  );

  // Helper: Check if entity is owner
  const isOwner = useCallback(
    (entityId: string): boolean => {
      return ownerEntity?.uid === entityId;
    },
    [ownerEntity]
  );

  // Action: Add a new message
  const addMessage = useCallback(() => {
    if (!selectedSender || !newMessageText.trim()) return;

    const message = createChatMessage(
      chatUid,
      selectedSender.uid,
      newMessageText.trim(),
      getNextMessageTime(chat.messages)
    );

    // Generate a unique ID for the message
    message.story_id = generateId();

    updateChat((prev) => {
      // Auto-add sender to participants if not already there
      const participants = prev.participants.includes(selectedSender.uid)
        ? prev.participants
        : [...prev.participants, selectedSender.uid];

      return {
        ...prev,
        participants,
        messages: [...prev.messages, message],
      };
    });

    setNewMessageText("");
  }, [selectedSender, newMessageText, chatUid, chat.messages, updateChat]);

  // Action: Edit a message
  const editMessage = useCallback(
    (messageIndex: number, updates: Partial<ChatMessageData>) => {
      updateChat((prev) => {
        const messages = [...prev.messages];
        const sortedMessages = sortMessagesByTime(messages);

        if (messageIndex >= 0 && messageIndex < sortedMessages.length) {
          const originalMessage = sortedMessages[messageIndex];
          const originalIndex = messages.findIndex(
            (m) =>
              m.story_id === originalMessage.story_id ||
              m.time === originalMessage.time
          );
          if (originalIndex !== -1) {
            messages[originalIndex] = {
              ...messages[originalIndex],
              ...updates,
            };
          }
        }

        return { ...prev, messages };
      });
    },
    [updateChat]
  );

  // Action: Delete a message
  const deleteMessage = useCallback(
    (messageIndex: number) => {
      updateChat((prev) => {
        const sortedMessages = sortMessagesByTime(prev.messages);

        if (messageIndex >= 0 && messageIndex < sortedMessages.length) {
          const messageToDelete = sortedMessages[messageIndex];
          const messages = prev.messages.filter(
            (m) =>
              m.story_id !== messageToDelete.story_id &&
              m.time !== messageToDelete.time
          );
          return { ...prev, messages };
        }

        return prev;
      });
    },
    [updateChat]
  );

  // Action: Add participant
  const addParticipant = useCallback(
    (entityId: string) => {
      updateChat((prev) => {
        if (prev.participants.includes(entityId)) return prev;
        return { ...prev, participants: [...prev.participants, entityId] };
      });
    },
    [updateChat]
  );

  // Action: Remove participant
  const removeParticipant = useCallback(
    (entityId: string) => {
      updateChat((prev) => ({
        ...prev,
        participants: prev.participants.filter((id) => id !== entityId),
      }));
    },
    [updateChat]
  );

  // Handle Enter key to send
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        addMessage();
      }
    },
    [addMessage]
  );

  return {
    // State
    chat,
    groupedMessages,
    selectedSender,
    newMessageText,

    // Refs
    messagesEndRef,

    // Message actions
    addMessage,
    editMessage,
    deleteMessage,

    // Participant actions
    addParticipant,
    removeParticipant,

    // Input actions
    setNewMessageText,
    setSender: setSelectedSender,
    handleKeyDown,

    // Helpers
    getEntityById,
    getEntityDisplayName,
    isOwner,
    availableEntities,
    participantEntities,
    ownerEntity,
  };
}
