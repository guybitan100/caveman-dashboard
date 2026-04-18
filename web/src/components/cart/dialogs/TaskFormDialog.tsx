import { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    FormControl,
    InputLabel,
    MenuItem,
    Chip,
    Autocomplete,
    OutlinedInput,
    CircularProgress,
    Alert,
    Skeleton,
    TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { EventType, GenerationTask, CreateTaskRequest } from '../../../types/cart';
import {
    getFieldConfig,
    createDefaultParams,
    FieldConfig,
    SubtaskData,
    FILE_EVENT_TYPES,
} from '../../../types/taskParams';
import { useCartStore } from '../../../stores/cartStore';
import {
    useMetaFinderOptions,
    useMetaFinderStatus,
} from '../../../hooks';
import { LocationPicker } from '../../shared/LocationPicker';
import { SubtaskField } from './SubtaskField';
import {
    StyledDialog,
    DialogHeader,
    HeaderContent,
    HeaderTitle,
    HeaderSubtitle,
    CloseButton,
    BackButton,
    StyledDialogContent,
    StyledDialogActions,
    FormSection,
    SectionLabel,
    FieldRow,
    StyledTextField,
    StyledSelect,
    PrimaryButton,
    SecondaryButton,
} from '../../shared/styledComponents';

const EventIcon = styled(Box)(({ theme }) => ({
    width: 36,
    height: 36,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.primary15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.custom.status.finalizing.main,
}));

const StyledAutocomplete = styled(Autocomplete)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        backgroundColor: theme.custom.surface.white5,
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
    '& .MuiInputLabel-root': {
        color: theme.custom.palette.text.muted,
    },
    '& .MuiAutocomplete-tag': {
        backgroundColor: theme.custom.surface.primary15,
        color: theme.palette.text.primary,
    },
})) as typeof Autocomplete;

interface TaskFormDialogProps {
    open: boolean;
    eventType: EventType;
    eventIcon: React.ReactNode;
    editingTask: GenerationTask | null;
    onClose: () => void;
}

interface FormState {
    quantity: number;
    params: Record<string, unknown>;
}


export function TaskFormDialog({
    open,
    eventType,
    eventIcon,
    editingTask,
    onClose,
}: TaskFormDialogProps) {
    const { addTask, updateTask, currentJobId } = useCartStore();
    const fieldConfig = getFieldConfig(eventType);

    // MetaFinder options for this event type
    const { options: metafinderOptions, isLoading: metafinderLoading } = useMetaFinderOptions(eventType);
    const { error: metafinderError } = useMetaFinderStatus();

    const [formState, setFormState] = useState<FormState>({
        quantity: 10,
        params: {},
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Helper to get options for a field based on its metafinderKey
    const getFieldOptions = useCallback((field: FieldConfig): string[] => {
        if (!field.metafinderKey || !metafinderOptions) {
            return field.options ?? [];
        }

        switch (field.metafinderKey) {
            case 'formats':
                return metafinderOptions.formats ?? [];
            case 'categories':
                return metafinderOptions.categories ?? [];
            case 'languages':
                return metafinderOptions.languages?.map(l => l.code) ?? [];
            default:
                return field.options ?? [];
        }
    }, [metafinderOptions]);

    // Helper to get display label for a value (especially for languages)
    const getDisplayLabel = useCallback((field: FieldConfig, value: string): string => {
        if (field.metafinderKey === 'languages' && metafinderOptions?.languages) {
            const lang = metafinderOptions.languages.find(l => l.code === value);
            return lang?.displayName ?? value;
        }
        return value;
    }, [metafinderOptions]);

    /**
     * Transform backend attachments to SubtaskData format for editing
     */
    const transformAttachmentsFromBackend = (params: Record<string, unknown>): Record<string, unknown> => {
        const transformed: Record<string, unknown> = { ...params };

        if (Array.isArray(params.attachments)) {
            transformed.attachments = (params.attachments as Array<Record<string, unknown>>).map(
                (attachment, index) => {
                    const { event_type, quantity, task_id, parent_task_id, root_task_id, ...rest } = attachment;
                    return {
                        id: (task_id as string) || `subtask_${index}_${Date.now()}`,
                        event_type: event_type as EventType,
                        quantity: (quantity as number) || 1,
                        params: rest,
                    } as SubtaskData;
                }
            );
        }

        return transformed;
    };

    useEffect(() => {
        if (open) {
            if (editingTask) {
                const {
                    task_id,
                    event_type,
                    quantity,
                    parent_task_id,
                    root_task_id,
                    ...params
                } = editingTask;

                // Transform attachments from backend format
                const transformedParams = transformAttachmentsFromBackend(params as Record<string, unknown>);

                setFormState({
                    quantity: quantity,
                    params: transformedParams,
                });
            } else {
                setFormState({
                    quantity: 10,
                    params: createDefaultParams(eventType),
                });
            }
            setErrors({});
            setSaveError(null);
        }
    }, [open, editingTask, eventType]);

    const formatEventType = (type: EventType): string => {
        return type
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const handleQuantityChange = useCallback((value: number) => {
        setFormState((prev) => ({
            ...prev,
            quantity: Math.max(1, value),
        }));
    }, []);

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

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (formState.quantity < 1) {
            newErrors.quantity = 'Quantity must be at least 1';
        }

        for (const field of fieldConfig) {
            if (field.pairedWith) {
                const minValue = formState.params[field.pairedWith] as number | undefined;
                const maxValue = formState.params[field.name] as number | undefined;
                if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) {
                    newErrors[field.name] = `Must be ≥ ${field.pairedWith.replace(/_/g, ' ')}`;
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    /**
     * Transform subtask data to backend format
     */
    const transformSubtasksForBackend = (params: Record<string, unknown>): Record<string, unknown> => {
        const transformed: Record<string, unknown> = { ...params };

        // Transform attachments field from SubtaskData[] to backend task format
        if (Array.isArray(params.attachments)) {
            transformed.attachments = (params.attachments as SubtaskData[]).map((subtask) => {
                const isFileType = FILE_EVENT_TYPES.includes(subtask.event_type);
                return {
                    event_type: subtask.event_type,
                    quantity: subtask.quantity,
                    // File types need is_upload: false for backend discriminator
                    ...(isFileType ? { is_upload: false } : {}),
                    ...subtask.params,
                };
            });
        }

        return transformed;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        if (!currentJobId) {
            setSaveError('No job selected - cannot add task');
            return;
        }

        // Transform subtask data to backend format
        const transformedParams = transformSubtasksForBackend(formState.params);

        const taskData: CreateTaskRequest = {
            event_type: eventType,
            quantity: formState.quantity,
            ...transformedParams,
        };

        setIsSaving(true);
        setSaveError(null);

        try {
            if (editingTask) {
                await updateTask(editingTask.task_id, taskData);
            } else {
                await addTask(taskData);
            }
            onClose();
        } catch (error) {
            console.error('Failed to save task:', error);
            let message = 'Failed to save task. Please try again.';
            if (error instanceof Error) {
                // Check if it's an axios error with response data
                const axiosError = error as { response?: { data?: { detail?: unknown; message?: string } } };
                const detail = axiosError.response?.data?.detail;
                if (detail) {
                    // Handle array of validation errors from FastAPI
                    if (Array.isArray(detail)) {
                        message = detail
                            .map((err: { msg?: string; loc?: string[] }) => {
                                const location = err.loc?.slice(1).join('.') || 'unknown field';
                                return `${location}: ${err.msg || 'validation error'}`;
                            })
                            .join('; ');
                    } else if (typeof detail === 'string') {
                        message = detail;
                    }
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

    const renderField = (field: FieldConfig) => {
        const value = formState.params[field.name];
        const error = errors[field.name];
        const options = getFieldOptions(field);
        const isLoadingOptions = field.metafinderKey && metafinderLoading;

        switch (field.type) {
            case 'number':
                return (
                    <StyledTextField
                        key={field.name}
                        label={field.label}
                        type="number"
                        size="small"
                        fullWidth
                        value={value ?? ''}
                        onChange={(e) => handleParamChange(field.name, parseFloat(e.target.value) || undefined)}
                        error={!!error}
                        helperText={error || field.helperText}
                        placeholder={field.placeholder}
                        slotProps={{
                            htmlInput: {
                                min: field.min,
                                max: field.max,
                            },
                        }}
                    />
                );

            case 'multiselect':
                if (isLoadingOptions) {
                    return (
                        <FormControl key={field.name} fullWidth size="small">
                            <Skeleton variant="rounded" height={40} />
                        </FormControl>
                    );
                }
                if (metafinderError && field.metafinderKey) {
                    return (
                        <FormControl key={field.name} fullWidth size="small">
                            <Alert severity="error" sx={{ py: 0.5 }}>
                                Failed to load {field.label.toLowerCase()}
                            </Alert>
                        </FormControl>
                    );
                }
                return (
                    <FormControl key={field.name} fullWidth size="small">
                        <InputLabel>{field.label}</InputLabel>
                        <StyledSelect
                            multiple
                            value={(value as string[]) ?? []}
                            onChange={(e) => handleParamChange(field.name, e.target.value)}
                            input={<OutlinedInput label={field.label} />}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {(selected as string[]).map((val) => (
                                        <Chip
                                            key={val}
                                            label={getDisplayLabel(field, val).toUpperCase()}
                                            size="small"
                                            sx={(theme) => ({
                                                height: 20,
                                                fontSize: '0.7rem',
                                                backgroundColor: theme.custom.surface.primary15,
                                            })}
                                        />
                                    ))}
                                </Box>
                            )}
                            MenuProps={{
                                PaperProps: {
                                    sx: {
                                        maxHeight: 300,
                                        minWidth: 400,
                                    },
                                },
                            }}
                        >
                            {options.map((option) => (
                                <MenuItem key={option} value={option}>
                                    {getDisplayLabel(field, option).toUpperCase()}
                                </MenuItem>
                            ))}
                        </StyledSelect>
                    </FormControl>
                );

            case 'autocomplete':
                if (isLoadingOptions) {
                    return (
                        <Box key={field.name} sx={{ width: '100%' }}>
                            <Skeleton variant="rounded" height={40} />
                        </Box>
                    );
                }
                if (metafinderError && field.metafinderKey) {
                    return (
                        <Box key={field.name} sx={{ width: '100%' }}>
                            <Alert severity="error" sx={{ py: 0.5 }}>
                                Failed to load {field.label.toLowerCase()}
                            </Alert>
                        </Box>
                    );
                }
                return (
                    <StyledAutocomplete
                        key={field.name}
                        multiple
                        size="small"
                        options={options}
                        value={(value as string[]) ?? []}
                        onChange={(_, newValue) => handleParamChange(field.name, newValue)}
                        getOptionLabel={(option) => getDisplayLabel(field, option as string)}
                        filterSelectedOptions
                        renderTags={(value, getTagProps) =>
                            (value as string[]).map((option, index) => {
                                const tagProps = getTagProps({ index });
                                return (
                                    <Chip
                                        {...tagProps}
                                        key={option}
                                        label={getDisplayLabel(field, option)}
                                        size="small"
                                        sx={(theme) => ({
                                            height: 22,
                                            fontSize: '0.75rem',
                                            backgroundColor: theme.custom.surface.primary15,
                                        })}
                                    />
                                );
                            })
                        }
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={field.label}
                                sx={{ minWidth: 400 }}
                                placeholder={value && (value as string[]).length > 0 ? '' : field.placeholder}
                            />
                        )}
                        ListboxProps={{
                            sx: {
                                maxHeight: 250,
                                minWidth: 400,
                            },
                        }}
                        slotProps={{
                            popper: {
                                sx: {
                                    minWidth: 400,
                                },
                            },
                        }}
                    />
                );

            case 'location':
                const locationValue = {
                    latitude: (formState.params.latitude as number) ?? 0,
                    longitude: (formState.params.longitude as number) ?? 0,
                };
                return (
                    <Box key={field.name}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            {field.label}
                        </Typography>
                        <LocationPicker
                            value={locationValue}
                            onChange={(newValue) => {
                                handleParamChange('latitude', newValue.latitude);
                                handleParamChange('longitude', newValue.longitude);
                            }}
                            error={error}
                        />
                    </Box>
                );

            case 'datetime':
                return (
                    <StyledTextField
                        key={field.name}
                        label={field.label}
                        type="datetime-local"
                        size="small"
                        fullWidth
                        value={value ?? ''}
                        onChange={(e) => handleParamChange(field.name, e.target.value || undefined)}
                        slotProps={{
                            inputLabel: {
                                shrink: true,
                            },
                        }}
                    />
                );

            case 'subtasks':
                return (
                    <Box key={field.name} sx={{ width: '100%' }}>
                        <SubtaskField
                            field={field}
                            value={(value as SubtaskData[]) ?? []}
                            onChange={(subtasks) => handleParamChange(field.name, subtasks)}
                            disabled={isSaving}
                        />
                    </Box>
                );

            default:
                return (
                    <StyledTextField
                        key={field.name}
                        label={field.label}
                        size="small"
                        fullWidth
                        value={value ?? ''}
                        onChange={(e) => handleParamChange(field.name, e.target.value || undefined)}
                        placeholder={field.placeholder}
                    />
                );
        }
    };

    const groupedFields = (): FieldConfig[][] => {
        const groups: FieldConfig[][] = [];
        let i = 0;

        while (i < fieldConfig.length) {
            const field = fieldConfig[i];
            const nextField = fieldConfig[i + 1];

            // Subtask fields are always rendered in their own group
            if (field.type === 'subtasks') {
                groups.push([field]);
                i++;
            } else if (
                field.type === 'number' &&
                nextField?.type === 'number' &&
                nextField?.pairedWith === field.name
            ) {
                groups.push([field, nextField]);
                i += 2;
            } else {
                groups.push([field]);
                i++;
            }
        }

        return groups;
    };

    // Separate regular fields from subtask fields for different rendering
    const regularFieldGroups = groupedFields().filter(
        (group) => group[0].type !== 'subtasks'
    );
    const subtaskFields = fieldConfig.filter((field) => field.type === 'subtasks');

    return (
        <StyledDialog open={open} onClose={onClose}>
            <DialogHeader>
                <HeaderContent>
                    <BackButton onClick={onClose} aria-label="Go back">
                        <ArrowBackIcon fontSize="small" />
                    </BackButton>
                    <EventIcon>{eventIcon}</EventIcon>
                    <Box>
                        <HeaderTitle>
                            {editingTask ? 'Edit Task' : 'Add Task'}
                        </HeaderTitle>
                        <HeaderSubtitle>{formatEventType(eventType)}</HeaderSubtitle>
                    </Box>
                </HeaderContent>
                <CloseButton onClick={onClose} aria-label="Close dialog">
                    <CloseIcon fontSize="small" />
                </CloseButton>
            </DialogHeader>

            <StyledDialogContent>
                <FormSection>
                    <SectionLabel>Quantity</SectionLabel>
                    <StyledTextField
                        label="Number of items"
                        type="number"
                        size="small"
                        fullWidth
                        value={formState.quantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                        error={!!errors.quantity}
                        helperText={errors.quantity}
                        slotProps={{
                            htmlInput: {
                                min: 1,
                            },
                        }}
                    />
                </FormSection>

                {regularFieldGroups.length > 0 && (
                    <FormSection>
                        <SectionLabel>Parameters</SectionLabel>
                        {regularFieldGroups.map((group, idx) => (
                            <FieldRow key={idx}>
                                {group.map((field) => renderField(field))}
                            </FieldRow>
                        ))}
                    </FormSection>
                )}

                {subtaskFields.length > 0 && (
                    <FormSection>
                        <SectionLabel>Attachments</SectionLabel>
                        {subtaskFields.map((field) => renderField(field))}
                    </FormSection>
                )}

                {saveError && (
                    <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSaveError(null)}>
                        {saveError}
                    </Alert>
                )}
            </StyledDialogContent>

            <StyledDialogActions>
                <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                <PrimaryButton onClick={handleSave} disabled={isSaving} sx={{ minWidth: 120 }}>
                    {isSaving ? (
                        <>
                            <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                            Saving...
                        </>
                    ) : (
                        editingTask ? 'Save Changes' : 'Add Task'
                    )}
                </PrimaryButton>
            </StyledDialogActions>
        </StyledDialog>
    );
}
