import { Box, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { GroupedMessages, ChatMessageData } from './types';
import { StoryChatMessage } from './StoryChatMessage';
import { StoryType } from '../../types/cart';

const MessagesContainer = styled(Box)(({ theme }) => ({
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
}));

const DateChipContainer = styled(Box)({
    display: 'flex',
    justifyContent: 'center',
    margin: '8px 0',
});

const DateChip = styled(Chip)(({ theme }) => ({
    height: 24,
    fontSize: '0.7rem',
    fontWeight: theme.typography.fontWeightMedium,
    backgroundColor: theme.custom.surface.white10,
    color: theme.palette.text.secondary,
}));

const MessagesEndAnchor = styled('div')({
    height: 1,
});

interface StoryChatMessagesProps {
    groupedMessages: GroupedMessages[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onEditMessage: (messageIndex: number, updates: Partial<ChatMessageData>) => void;
    onDeleteMessage: (messageIndex: number) => void;
    getEntityDisplayName: (entityId: string) => string;
    isOwner: (entityId: string) => boolean;
    /** Callback to open create attachment dialog */
    onCreateAttachment?: (storyType: StoryType) => void;
}

export function StoryChatMessages({
    groupedMessages,
    messagesEndRef,
    onEditMessage,
    onDeleteMessage,
    getEntityDisplayName,
    isOwner,
    onCreateAttachment,
}: StoryChatMessagesProps) {
    // Calculate global message index across all groups
    let globalIndex = 0;

    return (
        <MessagesContainer>
            {groupedMessages.map((group) => (
                <Box key={group.date}>
                    <DateChipContainer>
                        <DateChip label={group.date} size="small" />
                    </DateChipContainer>

                    {group.messages.map((message) => {
                        const currentIndex = globalIndex++;
                        return (
                            <StoryChatMessage
                                key={message.story_id ?? `${message.time}-${message.sender}`}
                                message={message}
                                messageIndex={currentIndex}
                                isOutgoing={isOwner(message.sender)}
                                senderName={getEntityDisplayName(message.sender)}
                                onEdit={onEditMessage}
                                onDelete={onDeleteMessage}
                                onCreateAttachment={onCreateAttachment}
                            />
                        );
                    })}
                </Box>
            ))}
            <MessagesEndAnchor ref={messagesEndRef} />
        </MessagesContainer>
    );
}
