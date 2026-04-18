import { Box, Chip, Typography, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { styled } from '@mui/material/styles';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useState } from 'react';
import { Entity } from '../../types/cart';
import { CreateNewMenuItem } from '../shared/styledComponents';

const ParticipantsContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.custom.border.default}`,
    backgroundColor: theme.custom.surface.white5,
    flexWrap: 'wrap',
    minHeight: 48,
}));

const ParticipantsLabel = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.secondary,
    marginRight: theme.spacing(0.5),
}));

const ParticipantChip = styled(Chip)(({ theme }) => ({
    height: 26,
    fontSize: '0.75rem',
    backgroundColor: theme.custom.surface.primary15,
    color: theme.palette.text.primary,
    '& .MuiChip-deleteIcon': {
        fontSize: 16,
        color: theme.palette.text.secondary,
        '&:hover': {
            color: theme.palette.error.main,
        },
    },
}));

const AddParticipantButton = styled(IconButton)(({ theme }) => ({
    width: 26,
    height: 26,
    backgroundColor: theme.custom.surface.white10,
    color: theme.palette.text.secondary,
    '&:hover': {
        backgroundColor: theme.custom.surface.primary15,
        color: theme.palette.primary.main,
    },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
    fontSize: '0.875rem',
    '&:hover': {
        backgroundColor: theme.custom.surface.white10,
    },
}));

interface StoryChatParticipantsProps {
    participants: Entity[];
    availableEntities: Entity[];
    onAddParticipant: (entityId: string) => void;
    onRemoveParticipant: (entityId: string) => void;
    /** Called when user wants to create a new entity - opens dialog and adds to participants */
    onRequestCreateEntity?: () => void;
    getEntityDisplayName: (entityId: string) => string;
}

export function StoryChatParticipants({
    participants,
    availableEntities,
    onAddParticipant,
    onRemoveParticipant,
    onRequestCreateEntity,
    getEntityDisplayName,
}: StoryChatParticipantsProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
    };

    const handleSelectEntity = (entityId: string) => {
        onAddParticipant(entityId);
        handleCloseMenu();
    };

    const handleCreateNew = () => {
        handleCloseMenu();
        if (onRequestCreateEntity) {
            onRequestCreateEntity();
        }
    };

    // Filter out already-added participants
    const availableToAdd = availableEntities.filter(
        (e) => !participants.some((p) => p.uid === e.uid)
    );

    return (
        <ParticipantsContainer>
            <ParticipantsLabel>Participants:</ParticipantsLabel>

            {participants.length === 0 && (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                    No participants yet
                </Typography>
            )}

            {participants.map((participant) => (
                <ParticipantChip
                    key={participant.uid}
                    label={getEntityDisplayName(participant.uid)}
                    size="small"
                    icon={<PersonIcon sx={{ fontSize: 14 }} />}
                    onDelete={() => onRemoveParticipant(participant.uid)}
                    deleteIcon={<CloseIcon />}
                />
            ))}

            <AddParticipantButton size="small" onClick={handleOpenMenu} title="Add participant">
                <PersonAddIcon sx={{ fontSize: 16 }} />
            </AddParticipantButton>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleCloseMenu}
                slotProps={{
                    paper: {
                        sx: {
                            backgroundColor: 'background.paper',
                            minWidth: 200,
                            maxHeight: 300,
                        },
                    },
                }}
            >
                {availableToAdd.length === 0 && !onRequestCreateEntity && (
                    <MenuItem disabled>
                        <Typography variant="caption" color="text.secondary">
                            No more entities available
                        </Typography>
                    </MenuItem>
                )}

                {availableToAdd.map((entity) => (
                    <StyledMenuItem key={entity.uid} onClick={() => handleSelectEntity(entity.uid)}>
                        <ListItemIcon>
                            <PersonIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                            primary={getEntityDisplayName(entity.uid)}
                            secondary={entity.is_owner ? 'Device Owner' : undefined}
                        />
                    </StyledMenuItem>
                ))}

                {onRequestCreateEntity && (
                    <CreateNewMenuItem onClick={handleCreateNew}>
                        <ListItemIcon>
                            <AddIcon fontSize="small" sx={{ color: 'primary.main' }} />
                        </ListItemIcon>
                        <ListItemText primary="Create New Entity" />
                    </CreateNewMenuItem>
                )}
            </Menu>
        </ParticipantsContainer>
    );
}
