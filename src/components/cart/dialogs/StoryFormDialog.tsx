import { useState, useEffect, useCallback } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    Chip,
    CircularProgress,
    Alert,
    OutlinedInput,
    Typography,
    IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { StoryType, StoryData, CreateStoryRequest, Entity } from '../../../types/cart';
import {
    getStoryFieldConfig,
    createDefaultStoryParams,
    StoryFieldConfig,
    Coordinate,
    ContactInfo,
    AppInfo,
    StoryFileInfo,
} from '../../../types/storyParams';
import { useCartStore } from '../../../stores/cartStore';
import { LocationPicker } from '../../shared/LocationPicker';
import { FilePicker } from '../../shared/FilePicker';
import { StoryRefSelector } from '../../shared/StoryRefSelector';
import { getStoryIcon } from '../../../utils/storyIcons';
import { getEntityDisplayName } from '../../../utils/entity';
import { EntityFormDialog } from './EntityFormDialog';
import { CreateEntityRequest } from '../../../types/cart';
import { StoryChatEditor, ChatData } from '../../story-chat';

/**
 * Generates a simple unique ID for chat stories.
 */
function generateChatId(): string {
    return `chat-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
import {
    WideDialog,
    DialogHeader,
    HeaderContent,
    BackButton,
    HeaderTitle,
    HeaderSubtitle,
    CloseButton,
    TallDialogContent,
    FormSection,
    SectionLabel,
    FieldRow,
    StyledTextField,
    StyledSelect,
    StyledDialogActions,
    SecondaryButton,
    PrimaryButton,
} from '../../shared/styledComponents';

// Special value for "Create New Entity" option
const CREATE_NEW_ENTITY = '__CREATE_NEW_ENTITY__';

const StoryIcon = styled(Box)(({ theme }) => ({
    width: 36,
    height: 36,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.primary15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.custom.status.info.main,
}));

const ContactSection = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.custom.border.default}`,
}));

const ListItem = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

const AddButton = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: 'transparent',
    color: theme.palette.primary.main,
    fontSize: '0.75rem',
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
    '&:hover': {
        backgroundColor: theme.custom.surface.primary10,
    },
}));

const EntityChip = styled(Chip)(({ theme }) => ({
    height: 28,
    fontSize: '0.75rem',
    backgroundColor: theme.custom.surface.primary15,
    color: theme.palette.text.primary,
}));

interface StoryFormDialogProps {
    open: boolean;
    storyType: StoryType;
    storyIcon: React.ReactNode;
    editingStory: StoryData | null;
    onClose: () => void;
}

interface FormState {
    time: string;
    user_description: string;
    location_ref: string | null;
    params: Record<string, unknown>;
}

export function StoryFormDialog({
    open,
    storyType,
    storyIcon,
    editingStory,
    onClose,
}: StoryFormDialogProps) {
    const { addStory, updateStory, addEntity, currentJobId, job } = useCartStore();
    const fieldConfig = getStoryFieldConfig(storyType);
    const entities = job?.entities ?? [];
    const [isCreatingEntity, setIsCreatingEntity] = useState(false);

    // State for entity creation dialog
    const [entityDialogOpen, setEntityDialogOpen] = useState(false);
    const [pendingEntityField, setPendingEntityField] = useState<string | null>(null);
    const [pendingEntityIsMultiple, setPendingEntityIsMultiple] = useState(false);
    // Callback to resolve a promise when entity is created from chat editor
    const [chatEntityResolver, setChatEntityResolver] = useState<((entity: Entity | null) => void) | null>(null);

    const [formState, setFormState] = useState<FormState>({
        time: new Date().toISOString().slice(0, 16),
        user_description: '',
        location_ref: null,
        params: {},
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // State for nested story creation dialog
    const [nestedDialogOpen, setNestedDialogOpen] = useState(false);
    const [nestedStoryType, setNestedStoryType] = useState<StoryType | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_pendingRefField, setPendingRefField] = useState<string | null>(null);

    // Handler for creating a new referenced story
    const handleCreateRefStory = useCallback((targetStoryType: StoryType, fieldName?: string) => {
        setNestedStoryType(targetStoryType);
        setPendingRefField(fieldName ?? null);
        setNestedDialogOpen(true);
    }, []);

    // Close nested dialog
    const handleNestedDialogClose = useCallback(() => {
        setNestedDialogOpen(false);
        setNestedStoryType(null);
        setPendingRefField(null);
    }, []);

    // Initialize form state when dialog opens
    useEffect(() => {
        if (open) {
            if (editingStory) {
                const {
                    story_id,
                    story_type,
                    time,
                    user_description,
                    location_ref,
                    ...params
                } = editingStory;

                const defaultParams = createDefaultStoryParams(storyType);
                setFormState({
                    time: time?.slice(0, 16) || new Date().toISOString().slice(0, 16),
                    user_description: user_description || '',
                    location_ref: location_ref as string | null,
                    params: { ...defaultParams, ...params },
                });
            } else {
                setFormState({
                    time: new Date().toISOString().slice(0, 16),
                    user_description: '',
                    location_ref: null,
                    params: createDefaultStoryParams(storyType),
                });
            }
            setErrors({});
            setSaveError(null);
        }
    }, [open, editingStory, storyType]);

    const formatStoryType = (type: StoryType): string => {
        return type
            .split(/[\s/]/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const handleParamChange = useCallback((fieldName: string, value: unknown) => {
        setFormState((prev) => ({
            ...prev,
            params: {
                ...prev.params,
                [fieldName]: value,
            },
        }));
        setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[fieldName];
            return newErrors;
        });
    }, []);

    // Handler for creating a new entity - opens the dialog
    const handleOpenEntityDialog = useCallback((fieldName: string, isMultiple = false) => {
        setPendingEntityField(fieldName);
        setPendingEntityIsMultiple(isMultiple);
        setEntityDialogOpen(true);
    }, []);

    // Handler when entity is saved from dialog
    const handleEntitySave = useCallback(async (entityData: CreateEntityRequest) => {
        setIsCreatingEntity(true);
        try {
            const newEntity = await addEntity(entityData);

            // If this was triggered from chat editor, resolve the promise
            if (chatEntityResolver && newEntity) {
                chatEntityResolver(newEntity);
                setChatEntityResolver(null);
            } else if (newEntity && pendingEntityField) {
                if (pendingEntityIsMultiple) {
                    setFormState((prev) => {
                        const currentValue = (prev.params[pendingEntityField] as string[]) || [];
                        return {
                            ...prev,
                            params: {
                                ...prev.params,
                                [pendingEntityField]: [...currentValue, newEntity.uid],
                            },
                        };
                    });
                } else {
                    setFormState((prev) => ({
                        ...prev,
                        params: {
                            ...prev.params,
                            [pendingEntityField]: newEntity.uid,
                        },
                    }));
                }
            }
            setEntityDialogOpen(false);
            setPendingEntityField(null);
            setPendingEntityIsMultiple(false);
        } catch (error) {
            console.error('Failed to create entity:', error);
            // Reject the promise if from chat
            if (chatEntityResolver) {
                chatEntityResolver(null);
                setChatEntityResolver(null);
            }
            throw error;
        } finally {
            setIsCreatingEntity(false);
        }
    }, [addEntity, pendingEntityField, pendingEntityIsMultiple, chatEntityResolver]);

    const handleEntityDialogClose = useCallback(() => {
        setEntityDialogOpen(false);
        setPendingEntityField(null);
        setPendingEntityIsMultiple(false); if (chatEntityResolver) {
            chatEntityResolver(null);
            setChatEntityResolver(null);
        }
    }, [chatEntityResolver]);
    const handleChatRequestCreateEntity = useCallback((): Promise<Entity | null> => {
        return new Promise((resolve) => {
            setChatEntityResolver(() => resolve);
            setEntityDialogOpen(true);
        });
    }, []);
    const handleChatRequestCreateStory = useCallback((targetStoryType: StoryType) => {
        setNestedStoryType(targetStoryType);
        setNestedDialogOpen(true);
    }, []);

    const handleBaseFieldChange = useCallback((field: keyof FormState, value: unknown) => {
        setFormState((prev) => ({
            ...prev,
            [field]: value,
        }));
    }, []);

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Helper to get nested values like 'chat.participants'
        const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
            const parts = path.split('.');
            let current: unknown = obj;
            for (const part of parts) {
                if (current === null || current === undefined || typeof current !== 'object') {
                    return undefined;
                }
                current = (current as Record<string, unknown>)[part];
            }
            return current;
        };

        // For chat stories, validate the chat data directly
        if (storyType === 'chat') {
            const chatData = formState.params.chat as ChatData | undefined;
            if (!chatData || !chatData.participants || chatData.participants.length === 0) {
                newErrors['chat'] = 'At least one participant is required';
            }
            if (!chatData || !chatData.messages || chatData.messages.length === 0) {
                newErrors['chat'] = 'At least one message is required';
            }
            setErrors(newErrors);
            return Object.keys(newErrors).length === 0;
        }

        // Validate required fields for other story types
        for (const field of fieldConfig) {
            if (field.required) {
                const value = getNestedValue(formState.params, field.name);
                if (value === undefined || value === null || value === '') {
                    newErrors[field.name] = `${field.label} is required`;
                } else if (field.type === 'entities' && Array.isArray(value) && value.length === 0) {
                    newErrors[field.name] = `At least one ${field.label.toLowerCase()} is required`;
                } else if (field.type === 'coordinate') {
                    const coord = value as Coordinate;
                    if (!coord || (coord.latitude === 0 && coord.longitude === 0)) {
                        newErrors[field.name] = 'Please enter valid coordinates';
                    }
                } else if (field.type === 'contact') {
                    const contact = value as ContactInfo;
                    if (!contact || (contact.phones.length === 0 && contact.emails.length === 0)) {
                        newErrors[field.name] = 'At least one phone or email is required';
                    }
                } else if (field.type === 'file') {
                    const fileInfo = value as StoryFileInfo;
                    if (!fileInfo || !fileInfo.s3_key) {
                        newErrors[field.name] = `Please select or upload a ${field.label.toLowerCase()}`;
                    }
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        const isValid = validateForm();
        if (!isValid) {
            return;
        }

        if (!currentJobId) {
            setSaveError('No job selected - cannot add story');
            return;
        }

        const storyData: CreateStoryRequest = {
            story_type: storyType,
            time: formState.time,
            user_description: formState.user_description || null,
            location_ref: formState.location_ref,
            ...formState.params,
        };

        setIsSaving(true);
        setSaveError(null);

        try {
            if (editingStory) {
                await updateStory(editingStory.story_id, storyData);
            } else {
                await addStory(storyData);
            }
            onClose();
        } catch (error) {
            console.error('Failed to save story:', error);
            let message = 'Failed to save story. Please try again.';
            if (error instanceof Error) {
                // Check if it's an axios error with response data
                const axiosError = error as { response?: { data?: { detail?: string; message?: string } } };
                if (axiosError.response?.data?.detail) {
                    message = axiosError.response.data.detail;
                } else if (axiosError.response?.data?.message) {
                    message = axiosError.response.data.message;
                } else {
                    message = error.message;
                }
            }
            setSaveError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const renderEntitySelector = (field: StoryFieldConfig) => {
        const value = formState.params[field.name] as string | undefined;
        const error = errors[field.name];

        const handleChange = (selectedValue: string) => {
            if (selectedValue === CREATE_NEW_ENTITY) {
                handleOpenEntityDialog(field.name, false);
            } else {
                handleParamChange(field.name, selectedValue);
            }
        };

        return (
            <FormControl key={field.name} fullWidth size="small" error={!!error}>
                <InputLabel>{field.label}{field.required ? ' *' : ''}</InputLabel>
                <StyledSelect
                    value={value || ''}
                    onChange={(e) => handleChange(e.target.value as string)}
                    input={<OutlinedInput label={field.label + (field.required ? ' *' : '')} />}
                    disabled={isCreatingEntity}
                >
                    <MenuItem value={CREATE_NEW_ENTITY} sx={{ color: 'primary.main', fontWeight: 600 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonAddIcon fontSize="small" />
                            Create New Entity
                        </Box>
                    </MenuItem>
                    {entities.length > 0 && <MenuItem divider disabled sx={{ my: 0.5 }} />}
                    {entities.map((entity: Entity) => (
                        <MenuItem key={entity.uid} value={entity.uid}>
                            {getEntityDisplayName(entity)}
                        </MenuItem>
                    ))}
                </StyledSelect>
                {error && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                        {error}
                    </Typography>
                )}
            </FormControl>
        );
    };

    const renderMultiEntitySelector = (field: StoryFieldConfig) => {
        const value = (formState.params[field.name] as string[]) || [];
        const error = errors[field.name];

        const handleChange = (selectedValues: string[]) => {
            // Check if "Create New Entity" was selected
            if (selectedValues.includes(CREATE_NEW_ENTITY)) {
                // Remove the special value from selection and open entity dialog
                const filteredValues = selectedValues.filter(v => v !== CREATE_NEW_ENTITY);
                handleParamChange(field.name, filteredValues);
                handleOpenEntityDialog(field.name, true);
            } else {
                handleParamChange(field.name, selectedValues);
            }
        };

        return (
            <FormControl key={field.name} fullWidth size="small" error={!!error}>
                <InputLabel>{field.label}{field.required ? ' *' : ''}</InputLabel>
                <StyledSelect
                    multiple
                    value={value}
                    onChange={(e) => handleChange(e.target.value as string[])}
                    input={<OutlinedInput label={field.label + (field.required ? ' *' : '')} />}
                    disabled={isCreatingEntity}
                    renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((uid) => {
                                const entity = entities.find((e: Entity) => e.uid === uid);
                                const label = entity ? getEntityDisplayName(entity) : uid;
                                return <EntityChip key={uid} label={label} size="small" />;
                            })}
                        </Box>
                    )}
                >
                    <MenuItem value={CREATE_NEW_ENTITY} sx={{ color: 'primary.main', fontWeight: 600 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonAddIcon fontSize="small" />
                            Create New Entity
                        </Box>
                    </MenuItem>
                    {entities.length > 0 && <MenuItem divider disabled sx={{ my: 0.5 }} />}
                    {entities.map((entity: Entity) => (
                        <MenuItem key={entity.uid} value={entity.uid}>
                            {getEntityDisplayName(entity)}
                        </MenuItem>
                    ))}
                </StyledSelect>
                {error && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                        {error}
                    </Typography>
                )}
            </FormControl>
        );
    };

    const renderCoordinateField = (field: StoryFieldConfig) => {
        const value = (formState.params[field.name] as Coordinate) || { latitude: 0, longitude: 0 };
        const error = errors[field.name];

        return (
            <Box key={field.name}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    {field.label}{field.required ? ' *' : ''}
                </Typography>
                <LocationPicker
                    value={value}
                    onChange={(newValue) => handleParamChange(field.name, newValue)}
                    error={error}
                />
            </Box>
        );
    };

    const renderContactField = (field: StoryFieldConfig) => {
        const value = (formState.params[field.name] as ContactInfo) || {
            first_name: null,
            last_name: null,
            phones: [],
            emails: [],
        };
        const error = errors[field.name];

        const handleAddPhone = () => {
            handleParamChange(field.name, {
                ...value,
                phones: [...value.phones, ''],
            });
        };

        const handleAddEmail = () => {
            handleParamChange(field.name, {
                ...value,
                emails: [...value.emails, ''],
            });
        };

        const handlePhoneChange = (index: number, phone: string) => {
            const newPhones = [...value.phones];
            newPhones[index] = phone;
            handleParamChange(field.name, { ...value, phones: newPhones });
        };

        const handleEmailChange = (index: number, email: string) => {
            const newEmails = [...value.emails];
            newEmails[index] = email;
            handleParamChange(field.name, { ...value, emails: newEmails });
        };

        const handleRemovePhone = (index: number) => {
            handleParamChange(field.name, {
                ...value,
                phones: value.phones.filter((_, i) => i !== index),
            });
        };

        const handleRemoveEmail = (index: number) => {
            handleParamChange(field.name, {
                ...value,
                emails: value.emails.filter((_, i) => i !== index),
            });
        };

        return (
            <ContactSection key={field.name}>
                <Typography variant="caption" color="text.secondary">
                    {field.label}{field.required ? ' *' : ''}
                </Typography>

                <FieldRow>
                    <StyledTextField
                        label="First Name"
                        size="small"
                        fullWidth
                        value={value.first_name || ''}
                        onChange={(e) => handleParamChange(field.name, {
                            ...value,
                            first_name: e.target.value || null,
                        })}
                    />
                    <StyledTextField
                        label="Last Name"
                        size="small"
                        fullWidth
                        value={value.last_name || ''}
                        onChange={(e) => handleParamChange(field.name, {
                            ...value,
                            last_name: e.target.value || null,
                        })}
                    />
                </FieldRow>

                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Phone Numbers
                    </Typography>
                    {value.phones.map((phone, index) => (
                        <ListItem key={index} sx={{ mb: 0.5 }}>
                            <StyledTextField
                                size="small"
                                fullWidth
                                value={phone}
                                onChange={(e) => handlePhoneChange(index, e.target.value)}
                                placeholder="+1234567890"
                            />
                            <IconButton size="small" onClick={() => handleRemovePhone(index)}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </ListItem>
                    ))}
                    <AddButton onClick={handleAddPhone}>
                        <AddIcon sx={{ fontSize: 16 }} />
                        Add Phone
                    </AddButton>
                </Box>

                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Email Addresses
                    </Typography>
                    {value.emails.map((email, index) => (
                        <ListItem key={index} sx={{ mb: 0.5 }}>
                            <StyledTextField
                                size="small"
                                fullWidth
                                value={email}
                                onChange={(e) => handleEmailChange(index, e.target.value)}
                                placeholder="email@example.com"
                            />
                            <IconButton size="small" onClick={() => handleRemoveEmail(index)}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </ListItem>
                    ))}
                    <AddButton onClick={handleAddEmail}>
                        <AddIcon sx={{ fontSize: 16 }} />
                        Add Email
                    </AddButton>
                </Box>

                {error && (
                    <Typography variant="caption" color="error">
                        {error}
                    </Typography>
                )}
            </ContactSection>
        );
    };

    const renderAppField = (field: StoryFieldConfig) => {
        const value = (formState.params[field.name] as AppInfo) || { app_id: '', name: null };
        const error = errors[field.name];

        return (
            <Box key={field.name}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    {field.label}{field.required ? ' *' : ''}
                </Typography>
                <FieldRow>
                    <StyledTextField
                        label="App ID"
                        size="small"
                        fullWidth
                        value={value.app_id}
                        onChange={(e) => handleParamChange(field.name, {
                            ...value,
                            app_id: e.target.value,
                        })}
                        error={!!error}
                        required={field.required}
                    />
                    <StyledTextField
                        label="App Name"
                        size="small"
                        fullWidth
                        value={value.name || ''}
                        onChange={(e) => handleParamChange(field.name, {
                            ...value,
                            name: e.target.value || null,
                        })}
                    />
                </FieldRow>
                {error && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                        {error}
                    </Typography>
                )}
            </Box>
        );
    };

    const renderFileField = (field: StoryFieldConfig) => {
        const value = formState.params[field.name] as StoryFileInfo | undefined;
        const error = errors[field.name];
        const dataType = field.fileDataType ?? 'document';

        return (
            <Box key={field.name}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    {field.label}{field.required ? ' *' : ''}
                </Typography>
                <FilePicker
                    dataType={dataType}
                    value={value ?? null}
                    onChange={(fileInfo) => handleParamChange(field.name, fileInfo)}
                />
                {error && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                        {error}
                    </Typography>
                )}
            </Box>
        );
    };

    const renderField = (field: StoryFieldConfig) => {
        const value = formState.params[field.name];
        const error = errors[field.name];

        switch (field.type) {
            case 'entity':
                return renderEntitySelector(field);

            case 'entities':
                return renderMultiEntitySelector(field);

            case 'coordinate':
                return renderCoordinateField(field);

            case 'contact':
                return renderContactField(field);

            case 'app':
                return renderAppField(field);

            case 'file':
                return renderFileField(field);

            case 'select':
                return (
                    <FormControl key={field.name} fullWidth size="small" error={!!error}>
                        <InputLabel>{field.label}{field.required ? ' *' : ''}</InputLabel>
                        <StyledSelect
                            value={value ?? field.defaultValue ?? ''}
                            onChange={(e) => handleParamChange(field.name, e.target.value)}
                            input={<OutlinedInput label={field.label + (field.required ? ' *' : '')} />}
                        >
                            {field.options?.map((option) => (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            ))}
                        </StyledSelect>
                    </FormControl>
                );

            case 'textarea':
                return (
                    <StyledTextField
                        key={field.name}
                        label={field.label + (field.required ? ' *' : '')}
                        size="small"
                        fullWidth
                        multiline
                        rows={field.rows || 3}
                        value={value ?? ''}
                        onChange={(e) => handleParamChange(field.name, e.target.value)}
                        error={!!error}
                        helperText={error}
                        placeholder={field.placeholder}
                    />
                );

            case 'number':
                return (
                    <StyledTextField
                        key={field.name}
                        label={field.label + (field.required ? ' *' : '')}
                        type="number"
                        size="small"
                        fullWidth
                        value={value ?? field.defaultValue ?? ''}
                        onChange={(e) => handleParamChange(field.name, parseFloat(e.target.value) || undefined)}
                        error={!!error}
                        helperText={error}
                        placeholder={field.placeholder}
                        slotProps={{
                            htmlInput: { min: field.min, max: field.max },
                        }}
                    />
                );

            case 'story_ref':
                return (
                    <StoryRefSelector
                        key={field.name}
                        label={field.label}
                        value={value as string | null}
                        onChange={(newValue) => handleParamChange(field.name, newValue)}
                        storyRefTypes={field.storyRefTypes ?? ['location']}
                        required={field.required}
                        placeholder={field.placeholder}
                        error={error}
                        excludeStoryId={editingStory?.story_id}
                        onCreateNew={(targetType) => handleCreateRefStory(targetType, field.name)}
                    />
                );

            case 'story_refs':
                return (
                    <StoryRefSelector
                        key={field.name}
                        label={field.label}
                        value={value as string[] | null}
                        onChange={(newValue) => handleParamChange(field.name, newValue)}
                        storyRefTypes={field.storyRefTypes ?? ['location']}
                        multiple
                        required={field.required}
                        placeholder={field.placeholder}
                        error={error}
                        excludeStoryId={editingStory?.story_id}
                        onCreateNew={(targetType) => handleCreateRefStory(targetType, field.name)}
                    />
                );

            case 'text':
            default:
                return (
                    <StyledTextField
                        key={field.name}
                        label={field.label + (field.required ? ' *' : '')}
                        size="small"
                        fullWidth
                        value={value ?? ''}
                        onChange={(e) => handleParamChange(field.name, e.target.value)}
                        error={!!error}
                        helperText={error}
                        placeholder={field.placeholder}
                    />
                );
        }
    };

    return (
        <>
            <WideDialog open={open} onClose={onClose} disableEnforceFocus>
                <DialogHeader>
                    <HeaderContent>
                        <BackButton onClick={onClose} aria-label="Go back">
                            <ArrowBackIcon fontSize="small" />
                        </BackButton>
                        <StoryIcon>{storyIcon}</StoryIcon>
                        <Box>
                            <HeaderTitle>
                                {editingStory ? 'Edit Story' : 'Add Story'}
                            </HeaderTitle>
                            <HeaderSubtitle>{formatStoryType(storyType)}</HeaderSubtitle>
                        </Box>
                    </HeaderContent>
                    <CloseButton onClick={onClose} aria-label="Close dialog">
                        <CloseIcon fontSize="small" />
                    </CloseButton>
                </DialogHeader>

                <TallDialogContent>
                    {/* Common fields */}
                    <FormSection>
                        <SectionLabel>Basic Info</SectionLabel>
                        {/* Hide time field for chat stories - time is set per message */}
                        {storyType !== 'chat' && (
                            <FieldRow>
                                <StyledTextField
                                    label="Time"
                                    type="datetime-local"
                                    size="small"
                                    fullWidth
                                    value={formState.time}
                                    onChange={(e) => handleBaseFieldChange('time', e.target.value)}
                                    slotProps={{
                                        inputLabel: { shrink: true },
                                    }}
                                />
                            </FieldRow>
                        )}
                        <FieldRow>
                            <StyledTextField
                                label="Description (optional)"
                                size="small"
                                fullWidth
                                multiline
                                rows={2}
                                value={formState.user_description}
                                onChange={(e) => handleBaseFieldChange('user_description', e.target.value)}
                                placeholder="Optional description for this story..."
                                slotProps={{
                                    htmlInput: {
                                        'data-testid': 'story-description-input'
                                    }
                                }}
                            />
                        </FieldRow>
                    </FormSection>

                    {/* Story-specific fields */}
                    {fieldConfig.length > 0 && storyType !== 'chat' && (
                        <FormSection>
                            <SectionLabel>{formatStoryType(storyType)} Details</SectionLabel>
                            {fieldConfig.map((field) => (
                                <FieldRow key={field.name}>
                                    {renderField(field)}
                                </FieldRow>
                            ))}
                        </FormSection>
                    )}

                    {storyType === 'chat' && (
                        <FormSection>
                            <SectionLabel>Chat Conversation</SectionLabel>
                            <StoryChatEditor
                                initialData={formState.params.chat as ChatData | undefined}
                                chatUid={editingStory?.story_id ?? generateChatId()}
                                onChange={(chatData: ChatData) => handleParamChange('chat', chatData)}
                                onRequestCreateEntity={handleChatRequestCreateEntity}
                                onRequestCreateStory={handleChatRequestCreateStory}
                            />
                            {errors['chat'] && (
                                <Alert severity="error" sx={{ mt: 2 }}>
                                    {errors['chat']}
                                </Alert>
                            )}
                        </FormSection>
                    )}

                    {/* Location reference (for non-location stories) */}
                    {storyType !== 'location' && storyType !== 'chat' && storyType !== 'route' && (
                        <FormSection>
                            <SectionLabel>Location</SectionLabel>
                            <FieldRow>
                                <StoryRefSelector
                                    label="Location Reference (optional)"
                                    value={formState.location_ref}
                                    onChange={(value) => handleBaseFieldChange('location_ref', value)}
                                    storyRefTypes={['location']}
                                    placeholder="Select a location story"
                                    excludeStoryId={editingStory?.story_id}
                                    onCreateNew={(targetType) => handleCreateRefStory(targetType, 'location_ref')}
                                />
                            </FieldRow>
                        </FormSection>
                    )}

                    {saveError && (
                        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSaveError(null)}>
                            {saveError}
                        </Alert>
                    )}
                </TallDialogContent>

                <StyledDialogActions>
                    <SecondaryButton onClick={onClose} data-testid="cancel-story-button">Cancel</SecondaryButton>
                    <PrimaryButton onClick={handleSave} disabled={isSaving} data-testid="save-story-button">
                        {isSaving ? (
                            <>
                                <CircularProgress size={16} color="inherit" />
                                Saving...
                            </>
                        ) : (
                            editingStory ? 'Save Changes' : 'Add Story'
                        )}
                    </PrimaryButton>
                </StyledDialogActions>
            </WideDialog>

            {/* Nested dialog for creating referenced stories */}
            {nestedStoryType && (
                <StoryFormDialog
                    open={nestedDialogOpen}
                    storyType={nestedStoryType}
                    storyIcon={getStoryIcon(nestedStoryType)}
                    editingStory={null}
                    onClose={handleNestedDialogClose}
                />
            )}

            {/* Entity creation dialog */}
            <EntityFormDialog
                open={entityDialogOpen}
                onClose={handleEntityDialogClose}
                onSave={handleEntitySave}
                isSaving={isCreatingEntity}
            />
        </>
    );
}
