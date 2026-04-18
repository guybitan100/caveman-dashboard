import { useState, useCallback, useRef, useEffect } from 'react';
import {
    Box,
    Typography,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Chip,
    Collapse,
    Button,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import ChatIcon from '@mui/icons-material/Chat';
import ContactsIcon from '@mui/icons-material/Contacts';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DescriptionIcon from '@mui/icons-material/Description';
import { EventType } from '../../../types/cart';
import {
    FieldConfig,
    getFieldConfig,
    createDefaultParams,
    SubtaskData,
} from '../../../types/taskParams';
import { SubtaskParamsForm } from './SubtaskParamsForm';
import { ActionButtonCompact as ActionButton, DeleteButtonCompact as DeleteButton } from '../../shared/styledComponents';

const Container = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
}));

const Header = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
});

const Label = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.primary,
}));

const HelperText = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    color: theme.custom.palette.text.muted,
    marginTop: theme.spacing(0.25),
}));

const AddButton = styled(Button)(({ theme }) => ({
    minWidth: 'auto',
    padding: theme.spacing(0.5, 1.5),
    fontSize: '0.75rem',
    textTransform: 'none',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.white10,
    color: theme.palette.text.secondary,
    '&:hover': {
        backgroundColor: theme.custom.surface.white15,
        color: theme.palette.text.primary,
    },
}));

const SubtasksList = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
}));

const SubtaskCard = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.custom.border.default}`,
    overflow: 'hidden',
}));

const SubtaskHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 1.5),
    backgroundColor: theme.custom.surface.white8,
    cursor: 'pointer',
    '&:hover': {
        backgroundColor: theme.custom.surface.white10,
    },
}));

const SubtaskInfo = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

const SubtaskIcon = styled(Box)(({ theme }) => ({
    width: 28,
    height: 28,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.primary15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.custom.status.finalizing.main,
    '& svg': {
        fontSize: 16,
    },
}));

const SubtaskTitle = styled(Typography)(({ theme }) => ({
    fontSize: '0.8125rem',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.primary,
}));

const QuantityChip = styled(Chip)(({ theme }) => ({
    height: 20,
    fontSize: '0.7rem',
    backgroundColor: theme.custom.surface.primary15,
    color: theme.custom.status.finalizing.main,
    '& .MuiChip-label': {
        padding: theme.spacing(0, 0.75),
    },
}));

const SubtaskActions = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
}));

const SubtaskContent = styled(Box)(({ theme }) => ({
    padding: theme.spacing(1.5, 2),
    borderTop: `1px solid ${theme.custom.border.default}`,
}));

const EmptyState = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2),
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius,
    border: `2px dashed ${theme.custom.border.medium}`,
}));

const EmptyText = styled(Typography)(({ theme }) => ({
    fontSize: '0.8125rem',
    color: theme.custom.palette.text.placeholder,
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
    padding: theme.spacing(1, 2),
    '& .MuiListItemIcon-root': {
        minWidth: 32,
        color: theme.custom.status.finalizing.main,
    },
}));

/**
 * Event type icons mapping
 */
const EVENT_TYPE_ICONS: Partial<Record<EventType, React.ReactNode>> = {
    'chat messages': <ChatIcon />,
    'contacts': <ContactsIcon />,
    'images': <ImageIcon />,
    'videos': <VideoFileIcon />,
    'audios': <AudioFileIcon />,
    'locations': <LocationOnIcon />,
    'documents': <DescriptionIcon />,
};

/**
 * Format event type for display
 */
const formatEventType = (type: EventType): string => {
    return type
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Generate a unique ID
 */
const generateId = (): string => {
    return `subtask_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

interface SubtaskFieldProps {
    field: FieldConfig;
    value: SubtaskData[];
    onChange: (value: SubtaskData[]) => void;
    disabled?: boolean;
}

export function SubtaskField({
    field,
    value = [],
    onChange,
    disabled = false,
}: SubtaskFieldProps) {
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
    const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
    const subtaskRefs = useRef<Map<string, HTMLElement>>(new Map());

    const allowedEventTypes = field.allowedEventTypes ?? [];

    // Scroll to newly added subtask after it renders
    useEffect(() => {
        if (newlyAddedId) {
            // Small delay to ensure the element is rendered and expanded
            const timeoutId = setTimeout(() => {
                const element = subtaskRefs.current.get(newlyAddedId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                setNewlyAddedId(null);
            }, 100);

            return () => clearTimeout(timeoutId);
        }
    }, [newlyAddedId]);

    const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        setMenuAnchor(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
    };

    const handleAddSubtask = (eventType: EventType) => {
        const newSubtask: SubtaskData = {
            id: generateId(),
            event_type: eventType,
            quantity: 1,
            params: createDefaultParams(eventType),
        };

        const updatedValue = [...value, newSubtask];
        onChange(updatedValue);

        // Expand the newly added subtask and trigger scroll
        setExpandedSubtasks((prev) => new Set([...prev, newSubtask.id]));
        setNewlyAddedId(newSubtask.id);
        handleCloseMenu();
    };

    const handleRemoveSubtask = (id: string) => {
        const updatedValue = value.filter((subtask) => subtask.id !== id);
        onChange(updatedValue);
        setExpandedSubtasks((prev) => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
    };

    const handleToggleExpand = (id: string) => {
        setExpandedSubtasks((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSubtaskChange = useCallback((id: string, updates: Partial<SubtaskData>) => {
        const updatedValue = value.map((subtask) =>
            subtask.id === id ? { ...subtask, ...updates } : subtask
        );
        onChange(updatedValue);
    }, [value, onChange]);

    return (
        <Container>
            <Header>
                <Box>
                    <Label>{field.label}</Label>
                    {field.helperText && <HelperText>{field.helperText}</HelperText>}
                </Box>
                <AddButton
                    startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                    onClick={handleOpenMenu}
                    disabled={disabled}
                    size="small"
                >
                    Add
                </AddButton>
            </Header>

            {value.length === 0 ? (
                <EmptyState>
                    <EmptyText>No attachments added yet</EmptyText>
                </EmptyState>
            ) : (
                <SubtasksList>
                    {value.map((subtask) => {
                        const isExpanded = expandedSubtasks.has(subtask.id);
                        const subtaskFieldConfig = getFieldConfig(subtask.event_type);

                        return (
                            <div
                                key={subtask.id}
                                ref={(el) => {
                                    if (el) {
                                        subtaskRefs.current.set(subtask.id, el);
                                    } else {
                                        subtaskRefs.current.delete(subtask.id);
                                    }
                                }}
                            >
                                <SubtaskCard>
                                    <SubtaskHeader onClick={() => handleToggleExpand(subtask.id)}>
                                        <SubtaskInfo>
                                            <SubtaskIcon>
                                                {EVENT_TYPE_ICONS[subtask.event_type] || <DescriptionIcon />}
                                            </SubtaskIcon>
                                            <SubtaskTitle>
                                                {formatEventType(subtask.event_type)}
                                            </SubtaskTitle>
                                            <QuantityChip
                                                label={`×${subtask.quantity}`}
                                                size="small"
                                            />
                                        </SubtaskInfo>
                                        <SubtaskActions>
                                            <DeleteButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveSubtask(subtask.id);
                                                }}
                                                disabled={disabled}
                                                aria-label="Remove subtask"
                                            >
                                                <DeleteIcon sx={{ fontSize: 16 }} />
                                            </DeleteButton>
                                            <ActionButton size="small">
                                                {isExpanded ? (
                                                    <ExpandLessIcon sx={{ fontSize: 18 }} />
                                                ) : (
                                                    <ExpandMoreIcon sx={{ fontSize: 18 }} />
                                                )}
                                            </ActionButton>
                                        </SubtaskActions>
                                    </SubtaskHeader>

                                    <Collapse in={isExpanded}>
                                        <SubtaskContent>
                                            <SubtaskParamsForm
                                                subtask={subtask}
                                                fieldConfig={subtaskFieldConfig}
                                                onChange={(updates: Partial<SubtaskData>) =>
                                                    handleSubtaskChange(subtask.id, updates)
                                                }
                                                disabled={disabled}
                                            />
                                        </SubtaskContent>
                                    </Collapse>
                                </SubtaskCard>
                            </div>
                        );
                    })}
                </SubtasksList>
            )}

            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleCloseMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            minWidth: 180,
                            backgroundColor: 'background.paper',
                            border: 1,
                            borderColor: 'divider',
                        },
                    },
                }}
            >
                {allowedEventTypes.map((eventType) => (
                    <StyledMenuItem
                        key={eventType}
                        onClick={() => handleAddSubtask(eventType)}
                    >
                        <ListItemIcon>
                            {EVENT_TYPE_ICONS[eventType] || <DescriptionIcon />}
                        </ListItemIcon>
                        <ListItemText>{formatEventType(eventType)}</ListItemText>
                    </StyledMenuItem>
                ))}
            </Menu>
        </Container>
    );
}
