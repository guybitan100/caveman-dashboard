import { useCallback } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    OutlinedInput,
    Chip,
    Autocomplete,
    Skeleton,
    Alert,
    TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { FieldConfig, SubtaskData } from '../../../types/taskParams';
import { useMetaFinderOptions, useMetaFinderStatus } from '../../../hooks';
import { LocationPicker } from '../../shared/LocationPicker';
import {
    FieldRow,
    StyledTextField,
    StyledSelect,
} from '../../shared/styledComponents';

const FormContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
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

interface SubtaskParamsFormProps {
    subtask: SubtaskData;
    fieldConfig: FieldConfig[];
    onChange: (updates: Partial<SubtaskData>) => void;
    disabled?: boolean;
}

export function SubtaskParamsForm({
    subtask,
    fieldConfig,
    onChange,
    disabled = false,
}: SubtaskParamsFormProps) {
    // MetaFinder options for this event type
    const { options: metafinderOptions, isLoading: metafinderLoading } = useMetaFinderOptions(subtask.event_type);
    const { error: metafinderError } = useMetaFinderStatus();

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

    const handleQuantityChange = (value: number) => {
        onChange({ quantity: Math.max(1, value) });
    };

    const handleParamChange = (fieldName: string, value: unknown) => {
        onChange({
            params: {
                ...subtask.params,
                [fieldName]: value,
            },
        });
    };

    // Filter out subtask fields from the form (we don't support nested subtasks)
    const filteredFieldConfig = fieldConfig.filter((field) => field.type !== 'subtasks');

    const renderField = (field: FieldConfig) => {
        const value = subtask.params[field.name];
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
                        onChange={(e) =>
                            handleParamChange(field.name, parseFloat(e.target.value) || undefined)
                        }
                        placeholder={field.placeholder}
                        disabled={disabled}
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
                            disabled={disabled}
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
                        disabled={disabled}
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
                                placeholder={
                                    value && (value as string[]).length > 0
                                        ? ''
                                        : field.placeholder
                                }
                            />
                        )}
                    />
                );

            case 'location':
                const locationValue = {
                    latitude: (subtask.params.latitude as number) ?? 0,
                    longitude: (subtask.params.longitude as number) ?? 0,
                };
                return (
                    <Box key={field.name}>
                        <LocationPicker
                            value={locationValue}
                            onChange={(newValue) => {
                                handleParamChange('latitude', newValue.latitude);
                                handleParamChange('longitude', newValue.longitude);
                            }}
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
                        onChange={(e) =>
                            handleParamChange(field.name, e.target.value || undefined)
                        }
                        placeholder={field.placeholder}
                        disabled={disabled}
                    />
                );
        }
    };

    // Group paired fields together
    const groupedFields = (): FieldConfig[][] => {
        const groups: FieldConfig[][] = [];
        let i = 0;

        while (i < filteredFieldConfig.length) {
            const field = filteredFieldConfig[i];
            const nextField = filteredFieldConfig[i + 1];

            if (
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

    return (
        <FormContainer>
            {/* Quantity field */}
            <StyledTextField
                label="Quantity"
                type="number"
                size="small"
                fullWidth
                value={subtask.quantity}
                onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                disabled={disabled}
                slotProps={{
                    htmlInput: {
                        min: 1,
                    },
                }}
            />

            {/* Other params */}
            {groupedFields().map((group, idx) => (
                <FieldRow key={idx}>
                    {group.map((field) => renderField(field))}
                </FieldRow>
            ))}
        </FormContainer>
    );
}
