import { useState } from 'react';
import {
    Box,
    TextField,
    IconButton,
    Select,
    MenuItem,
    FormControl,
    InputAdornment,
    Typography,
    Divider,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import AddIcon from '@mui/icons-material/Add';
import { Entity } from '../../types/cart';
import { CreateNewMenuItem } from '../shared/styledComponents';

const InputContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderTop: `1px solid ${theme.custom.border.default}`,
    backgroundColor: theme.custom.surface.white5,
}));

const InputRow = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing(1),
}));

const SenderSelect = styled(Select)(({ theme }) => ({
    minWidth: 140,
    height: 40,
    fontSize: '0.875rem',
    backgroundColor: theme.custom.surface.white8,
    '& .MuiSelect-select': {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
    },
    '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.custom.border.default,
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.custom.border.light,
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
    },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    flex: 1,
    '& .MuiOutlinedInput-root': {
        backgroundColor: theme.custom.surface.white8,
        fontSize: '0.875rem',
        '& fieldset': {
            borderColor: theme.custom.border.default,
        },
        '&:hover fieldset': {
            borderColor: theme.custom.border.light,
        },
        '&.Mui-focused fieldset': {
            borderColor: theme.palette.primary.main,
        },
    },
    '& .MuiInputBase-input::placeholder': {
        color: theme.palette.text.disabled,
        opacity: 1,
    },
}));

const SendButton = styled(IconButton)(({ theme }) => ({
    width: 40,
    height: 40,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderRadius: theme.shape.borderRadius,
    '&:hover': {
        backgroundColor: theme.palette.primary.dark,
    },
    '&.Mui-disabled': {
        backgroundColor: theme.custom.surface.white10,
        color: theme.palette.text.disabled,
    },
}));

interface StoryChatInputProps {
    selectedSender: Entity | null;
    availableEntities: Entity[];
    newMessageText: string;
    onSenderChange: (entity: Entity | null) => void;
    onMessageChange: (text: string) => void;
    onSend: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    /** Called when user wants to create a new entity - opens dialog and sets as sender */
    onRequestCreateEntity?: () => void;
    getEntityDisplayName: (entityId: string) => string;
}

export function StoryChatInput({
    selectedSender,
    availableEntities,
    newMessageText,
    onSenderChange,
    onMessageChange,
    onSend,
    onKeyDown,
    onRequestCreateEntity,
    getEntityDisplayName,
}: StoryChatInputProps) {
    const [senderSelectOpen, setSenderSelectOpen] = useState(false);

    const handleSenderChange = (event: any) => {
        const value = event.target.value;
        if (value === '__CREATE_NEW__') {
            handleCreateNewEntity();
            return;
        }
        const entity = availableEntities.find((e) => e.uid === value);
        onSenderChange(entity ?? null);
    };

    const handleCreateNewEntity = () => {
        setSenderSelectOpen(false);
        if (onRequestCreateEntity) {
            onRequestCreateEntity();
        }
    };

    const canSend = selectedSender && newMessageText.trim().length > 0;

    return (
        <InputContainer>
            <InputRow>
                <FormControl size="small">
                    <SenderSelect
                        value={selectedSender?.uid ?? ''}
                        onChange={handleSenderChange}
                        displayEmpty
                        open={senderSelectOpen}
                        onOpen={() => setSenderSelectOpen(true)}
                        onClose={() => setSenderSelectOpen(false)}
                        startAdornment={
                            <InputAdornment position="start">
                                <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            </InputAdornment>
                        }
                        renderValue={(selected) => {
                            if (!selected) {
                                return (
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'text.disabled', ml: -3.5 }}
                                    >
                                        Select sender
                                    </Typography>
                                );
                            }
                            return (
                                <Typography variant="body2" sx={{ ml: -3.5 }}>
                                    {getEntityDisplayName(selected as string)}
                                </Typography>
                            );
                        }}
                    >
                        {availableEntities.map((entity) => (
                            <MenuItem key={entity.uid} value={entity.uid}>
                                <ListItemIcon>
                                    <PersonIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={getEntityDisplayName(entity.uid)}
                                    secondary={entity.is_owner ? 'Device Owner' : undefined}
                                />
                            </MenuItem>
                        ))}

                        {onRequestCreateEntity && (
                            <>
                                <Divider />
                                <CreateNewMenuItem value="__CREATE_NEW__">
                                    <ListItemIcon>
                                        <AddIcon fontSize="small" sx={{ color: 'primary.main' }} />
                                    </ListItemIcon>
                                    <ListItemText primary="Create New Entity" />
                                </CreateNewMenuItem>
                            </>
                        )}
                    </SenderSelect>
                </FormControl>

                <StyledTextField
                    placeholder="Type a message..."
                    multiline
                    maxRows={3}
                    value={newMessageText}
                    onChange={(e) => onMessageChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={!selectedSender}
                    size="small"
                />

                <SendButton onClick={onSend} disabled={!canSend} title="Send message">
                    <SendIcon sx={{ fontSize: 20 }} />
                </SendButton>
            </InputRow>
        </InputContainer>
    );
}
