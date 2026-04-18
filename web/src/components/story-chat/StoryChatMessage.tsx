import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ForwardIcon from '@mui/icons-material/Forward';
import { ChatMessageData } from './types';
import { MessageEditDialog } from './MessageEditDialog';
import { StoryType } from '../../types/cart';
import { ActionButtonCompact, DeleteButtonCompact } from '../shared/styledComponents';
import { formatTime } from '../../utils/date';

const MessageRow = styled(Box)<{ isOutgoing: boolean }>(({ isOutgoing }) => ({
    display: 'flex',
    justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
    marginBottom: 4,
}));

const MessageBubble = styled(Box)<{ isOutgoing: boolean }>(({ theme, isOutgoing }) => ({
    position: 'relative',
    maxWidth: '75%',
    padding: theme.spacing(1.25, 1.5),
    borderRadius: 12,
    backgroundColor: isOutgoing ? theme.custom.surface.primary15 : theme.custom.surface.white8,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',

    '&:hover': {
        backgroundColor: isOutgoing ? theme.custom.surface.primary20 : theme.custom.surface.white15,

        '& .message-actions': {
            opacity: 1,
        },
    },
}));

const SenderName = styled(Typography)(({ theme }) => ({
    fontSize: '0.7rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.primary.main,
    marginBottom: 2,
}));

const MessageText = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    lineHeight: 1.4,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
}));

const MessageMeta = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
});

const MessageTime = styled(Typography)(({ theme }) => ({
    fontSize: '0.65rem',
    color: theme.palette.text.disabled,
}));

const StatusIcon = styled(Box)<{ isRead: boolean }>(({ theme, isRead }) => ({
    display: 'flex',
    alignItems: 'center',
    color: isRead ? theme.palette.info.main : theme.palette.text.disabled,
    '& svg': {
        fontSize: 14,
    },
}));

const ForwardedLabel = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    fontSize: '0.65rem',
    color: theme.palette.text.disabled,
    fontStyle: 'italic',
    marginBottom: 4,
}));

const MessageActions = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: -8,
    right: -8,
    display: 'flex',
    gap: 2,
    opacity: 0,
    transition: 'opacity 0.2s ease',
    backgroundColor: theme.palette.background.paper,
    borderRadius: 8,
    padding: 2,
    boxShadow: theme.shadows[2],
}));

interface StoryChatMessageProps {
    message: ChatMessageData;
    messageIndex: number;
    isOutgoing: boolean;
    senderName: string;
    onEdit: (messageIndex: number, updates: Partial<ChatMessageData>) => void;
    onDelete: (messageIndex: number) => void;
    /** Callback to open create attachment dialog */
    onCreateAttachment?: (storyType: StoryType) => void;
}

export function StoryChatMessage({
    message,
    messageIndex,
    isOutgoing,
    senderName,
    onEdit,
    onDelete,
    onCreateAttachment,
}: StoryChatMessageProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    const formattedTime = formatTime(message.time);
    const isRead = message.status === 'Read';

    const handleBubbleClick = () => {
        setEditDialogOpen(true);
    };

    const handleEditSave = (updates: Partial<ChatMessageData>) => {
        onEdit(messageIndex, updates);
        setEditDialogOpen(false);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(messageIndex);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditDialogOpen(true);
    };

    return (
        <>
            <MessageRow isOutgoing={isOutgoing}>
                <MessageBubble isOutgoing={isOutgoing} onClick={handleBubbleClick}>
                    <MessageActions className="message-actions">
                        <ActionButtonCompact
                            size="small"
                            onClick={handleEditClick}
                            title="Edit message"
                            sx={{ width: 24, height: 24 }}
                        >
                            <EditIcon sx={{ fontSize: 14 }} />
                        </ActionButtonCompact>
                        <DeleteButtonCompact
                            size="small"
                            onClick={handleDeleteClick}
                            title="Delete message"
                            sx={{ width: 24, height: 24 }}
                        >
                            <DeleteIcon sx={{ fontSize: 14 }} />
                        </DeleteButtonCompact>
                    </MessageActions>

                    {!isOutgoing && <SenderName>{senderName}</SenderName>}

                    {message.forwarded && (
                        <ForwardedLabel>
                            <ForwardIcon sx={{ fontSize: 12 }} />
                            Forwarded
                        </ForwardedLabel>
                    )}

                    <MessageText>{message.text}</MessageText>

                    <MessageMeta>
                        <MessageTime>{formattedTime}</MessageTime>
                        {isOutgoing && (
                            <StatusIcon isRead={isRead}>
                                {isRead ? <DoneAllIcon /> : <CheckIcon />}
                            </StatusIcon>
                        )}
                    </MessageMeta>
                </MessageBubble>
            </MessageRow>

            <MessageEditDialog
                open={editDialogOpen}
                message={message}
                onClose={() => setEditDialogOpen(false)}
                onSave={handleEditSave}
                onCreateAttachment={onCreateAttachment}
            />
        </>
    );
}
