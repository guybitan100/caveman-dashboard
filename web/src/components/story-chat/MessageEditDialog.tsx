import { useState, useEffect } from 'react';
import {
    Button,
    FormControl,
    MenuItem,
    FormControlLabel,
    Switch,
    Typography,
    InputLabel,
    OutlinedInput,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ChatMessageData } from './types';
import { MESSAGE_STATUS_OPTIONS, getStoryFieldConfig } from '../../types/storyParams';
import { StoryRefSelector } from '../shared/StoryRefSelector';
import { StoryType } from '../../types/cart';
import {
    WideDialog,
    DialogHeader,
    HeaderTitle,
    CloseButton,
    StyledDialogContent,
    StyledDialogActions,
    StyledTextField,
    StyledSelect,
} from '../shared/styledComponents';

const ATTACHMENT_STORY_TYPES: StoryType[] = ['image', 'audio', 'video', 'document', 'contact', 'location'];

interface MessageEditDialogProps {
    open: boolean;
    message: ChatMessageData;
    onClose: () => void;
    onSave: (updates: Partial<ChatMessageData>) => void;
    onCreateAttachment?: (storyType: StoryType) => void;
}

export function MessageEditDialog({
    open,
    message,
    onClose,
    onSave,
    onCreateAttachment,
}: MessageEditDialogProps) {
    const fieldConfig = getStoryFieldConfig('chat message');

    const [text, setText] = useState(message.text);
    const [status, setStatus] = useState(message.status);
    const [forwarded, setForwarded] = useState(message.forwarded);
    const [time, setTime] = useState(message.time.slice(0, 16));
    const [attachments, setAttachments] = useState<string[]>(message.attachments ?? []);

    useEffect(() => {
        if (open) {
            setText(message.text);
            setStatus(message.status);
            setForwarded(message.forwarded);
            setTime(message.time.slice(0, 16));
            setAttachments(message.attachments ?? []);
        }
    }, [open, message]);

    const handleSave = () => {
        onSave({
            text,
            status,
            forwarded,
            time: new Date(time).toISOString(),
            attachments,
        });
    };

    const attachmentsChanged = JSON.stringify(attachments) !== JSON.stringify(message.attachments ?? []);

    const hasChanges =
        text !== message.text ||
        status !== message.status ||
        forwarded !== message.forwarded ||
        time !== message.time.slice(0, 16) ||
        attachmentsChanged;

    const getFieldLabel = (name: string) => {
        const field = fieldConfig.find(f => f.name === name);
        return field?.label ?? name;
    };

    return (
        <WideDialog open={open} onClose={onClose} disableEnforceFocus>
            <DialogHeader>
                <HeaderTitle>Edit Message</HeaderTitle>
                <CloseButton size="small" onClick={onClose}>
                    <CloseIcon fontSize="small" />
                </CloseButton>
            </DialogHeader>

            <StyledDialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <StyledTextField
                    label={getFieldLabel('text') + ' *'}
                    fullWidth
                    multiline
                    rows={3}
                    size="small"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter message text..."
                />

                <StyledTextField
                    label={getFieldLabel('time')}
                    fullWidth
                    type="datetime-local"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    size="small"
                    slotProps={{
                        inputLabel: { shrink: true },
                    }}
                />

                <FormControl fullWidth size="small">
                    <InputLabel>{getFieldLabel('status')}</InputLabel>
                    <StyledSelect
                        value={status}
                        onChange={(e) => setStatus(e.target.value as typeof status)}
                        input={<OutlinedInput label={getFieldLabel('status')} />}
                    >
                        {MESSAGE_STATUS_OPTIONS.map((option) => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </StyledSelect>
                </FormControl>

                <StoryRefSelector
                    label={getFieldLabel('attachments')}
                    value={attachments}
                    onChange={(value) => setAttachments((value as string[]) ?? [])}
                    storyRefTypes={ATTACHMENT_STORY_TYPES}
                    multiple
                    placeholder="Select attachments (optional)"
                    onCreateNew={onCreateAttachment}
                />

                <FormControlLabel
                    control={
                        <Switch
                            checked={forwarded}
                            onChange={(e) => setForwarded(e.target.checked)}
                            color="primary"
                        />
                    }
                    label={
                        <Typography variant="body2" color="text.secondary">
                            {getFieldLabel('forwarded')}
                        </Typography>
                    }
                />
            </StyledDialogContent>

            <StyledDialogActions>
                <Button onClick={onClose} color="inherit">
                    Cancel
                </Button>
                <Button onClick={handleSave} variant="contained" disabled={!hasChanges || !text.trim()}>
                    Save Changes
                </Button>
            </StyledDialogActions>
        </WideDialog>
    );
}
