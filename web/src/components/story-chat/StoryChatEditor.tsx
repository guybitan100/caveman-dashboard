import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ChatIcon from '@mui/icons-material/Chat';
import { Entity, StoryType } from '../../types/cart';
import { ChatData } from './types';
import { useStoryChatEditor } from './useStoryChatEditor';
import { StoryChatParticipants } from './StoryChatParticipants';
import { StoryChatMessages } from './StoryChatMessages';
import { StoryChatInput } from './StoryChatInput';

const EditorContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    height: 450,
    backgroundColor: theme.custom.palette.background.elevated,
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px solid ${theme.custom.border.default}`,
    overflow: 'hidden',
}));

const EmptyState = styled(Box)(({ theme }) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    color: theme.palette.text.disabled,
    padding: theme.spacing(4),
}));

interface StoryChatEditorProps {
    /** Initial chat data (for editing existing chat) */
    initialData?: ChatData;
    /** Chat UID for linking messages to this chat */
    chatUid: string;
    /** Callback when chat data changes */
    onChange: (chat: ChatData) => void;
    /** Callback to open entity creation dialog - should return the created entity or null */
    onRequestCreateEntity?: () => Promise<Entity | null>;
    /** Callback to open story creation dialog */
    onRequestCreateStory?: (storyType: StoryType) => void;
}

export function StoryChatEditor({
    initialData,
    chatUid,
    onChange,
    onRequestCreateEntity,
    onRequestCreateStory,
}: StoryChatEditorProps) {
    const {
        chat,
        groupedMessages,
        selectedSender,
        newMessageText,
        messagesEndRef,
        addMessage,
        editMessage,
        deleteMessage,
        addParticipant,
        removeParticipant,
        setNewMessageText,
        setSender,
        handleKeyDown,
        getEntityDisplayName,
        isOwner,
        availableEntities,
        participantEntities,
    } = useStoryChatEditor({
        initialData,
        chatUid,
        onChange,
    });

    const hasMessages = chat.messages.length > 0;

    // Handle entity creation request - opens dialog and adds to participants
    const handleCreateEntityForParticipant = async () => {
        if (onRequestCreateEntity) {
            const newEntity = await onRequestCreateEntity();
            if (newEntity) {
                addParticipant(newEntity.uid);
            }
        }
    };

    // Handle entity creation request - opens dialog and sets as sender
    const handleCreateEntityForSender = async () => {
        if (onRequestCreateEntity) {
            const newEntity = await onRequestCreateEntity();
            if (newEntity) {
                setSender(newEntity);
            }
        }
    };

    return (
        <EditorContainer>
            <StoryChatParticipants
                participants={participantEntities}
                availableEntities={availableEntities}
                onAddParticipant={addParticipant}
                onRemoveParticipant={removeParticipant}
                onRequestCreateEntity={onRequestCreateEntity ? handleCreateEntityForParticipant : undefined}
                getEntityDisplayName={getEntityDisplayName}
            />

            {hasMessages ? (
                <StoryChatMessages
                    groupedMessages={groupedMessages}
                    messagesEndRef={messagesEndRef}
                    onEditMessage={editMessage}
                    onDeleteMessage={deleteMessage}
                    getEntityDisplayName={getEntityDisplayName}
                    isOwner={isOwner}
                    onCreateAttachment={onRequestCreateStory}
                />
            ) : (
                <EmptyState>
                    <ChatIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                    <Typography variant="body2">No messages yet</Typography>
                    <Typography variant="caption">
                        Select a sender and start typing to add messages
                    </Typography>
                </EmptyState>
            )}
            <StoryChatInput
                selectedSender={selectedSender}
                availableEntities={availableEntities}
                newMessageText={newMessageText}
                onSenderChange={setSender}
                onMessageChange={setNewMessageText}
                onSend={addMessage}
                onKeyDown={handleKeyDown}
                onRequestCreateEntity={onRequestCreateEntity ? handleCreateEntityForSender : undefined}
                getEntityDisplayName={getEntityDisplayName}
            />
        </EditorContainer>
    );
}
