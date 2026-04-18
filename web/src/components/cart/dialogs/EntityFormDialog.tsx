import { useState, useEffect, useRef } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    CircularProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { CreateEntityRequest } from '../../../types/cart';
import { generateMockEntity } from '../../../utils/mockEntityGenerator';
import {
    NarrowDialog,
    DialogHeader,
    HeaderContent,
    HeaderTitle,
    CloseButton,
    StyledDialogActions,
    FormSectionPadded,
    StyledTextField,
    StyledSelect,
    PrimaryButton,
    SecondaryButton,
    OutlinedButton,
} from '../../shared/styledComponents';

const EntityIcon = styled(Box)(({ theme }) => ({
    width: 36,
    height: 36,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.primary15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.custom.status.info.main,
}));

interface EntityFormDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (entity: CreateEntityRequest) => Promise<void>;
    isSaving?: boolean;
    /** Initial data for editing mode */
    initialData?: CreateEntityRequest | null;
    /** Custom title for the dialog */
    title?: string;
    /** Custom save button text */
    saveButtonText?: string;
}

export function EntityFormDialog({
    open,
    onClose,
    onSave,
    isSaving = false,
    initialData = null,
    title,
    saveButtonText,
}: EntityFormDialogProps) {
    const isEditMode = !!initialData;
    const dialogTitle = title || (isEditMode ? 'Edit Entity' : 'Create New Entity');
    const buttonText = saveButtonText || (isEditMode ? 'Save' : 'Create Entity');
    const buttonLoadingText = isEditMode ? 'Saving...' : 'Creating...';

    const [formData, setFormData] = useState<CreateEntityRequest>({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        is_male: null,
    });

    // Track if we've initialized for this dialog session
    const hasInitialized = useRef(false);

    // Only reset form when dialog opens (not on every initialData change)
    useEffect(() => {
        if (open && !hasInitialized.current) {
            hasInitialized.current = true;
            if (initialData) {
                setFormData({
                    first_name: initialData.first_name || '',
                    last_name: initialData.last_name || '',
                    phone: initialData.phone || '',
                    email: initialData.email || '',
                    is_male: initialData.is_male ?? null,
                });
            } else {
                setFormData({
                    first_name: '',
                    last_name: '',
                    phone: '',
                    email: '',
                    is_male: null,
                });
            }
        } else if (!open) {
            // Reset the flag when dialog closes
            hasInitialized.current = false;
        }
    }, [open, initialData]);

    const handleChange = (field: keyof CreateEntityRequest, value: string | boolean | null) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleGenerateRandom = () => {
        const mockData = generateMockEntity();
        setFormData(mockData);
    };

    const handleSave = async () => {
        await onSave(formData);
    };

    const isFormValid = formData.first_name || formData.last_name || formData.phone || formData.email;

    return (
        <NarrowDialog open={open} onClose={onClose} maxWidth="sm">
            <DialogHeader>
                <HeaderContent>
                    <EntityIcon>
                        <PersonAddIcon />
                    </EntityIcon>
                    <HeaderTitle>{dialogTitle}</HeaderTitle>
                </HeaderContent>
                <CloseButton onClick={onClose} size="small">
                    <CloseIcon fontSize="small" />
                </CloseButton>
            </DialogHeader>

            <FormSectionPadded>
                <OutlinedButton
                    variant="outlined"
                    startIcon={<AutoFixHighIcon />}
                    onClick={handleGenerateRandom}
                    fullWidth
                >
                    Generate Random Data
                </OutlinedButton>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <StyledTextField
                        label="First Name"
                        value={formData.first_name || ''}
                        onChange={(e) => handleChange('first_name', e.target.value)}
                        fullWidth
                        size="small"
                    />
                    <StyledTextField
                        label="Last Name"
                        value={formData.last_name || ''}
                        onChange={(e) => handleChange('last_name', e.target.value)}
                        fullWidth
                        size="small"
                    />
                </Box>

                <StyledTextField
                    label="Phone"
                    value={formData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="+1 234 567 8900"
                />

                <StyledTextField
                    label="Email"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    fullWidth
                    size="small"
                    type="email"
                    placeholder="email@example.com"
                />

                <FormControl fullWidth size="small">
                    <InputLabel>Gender</InputLabel>
                    <StyledSelect
                        value={formData.is_male === null ? '' : formData.is_male ? 'male' : 'female'}
                        onChange={(e) => {
                            const value = e.target.value;
                            handleChange('is_male', value === '' ? null : value === 'male');
                        }}
                        label="Gender"
                    >
                        <MenuItem value="">
                            <em>Not specified</em>
                        </MenuItem>
                        <MenuItem value="male">Male</MenuItem>
                        <MenuItem value="female">Female</MenuItem>
                    </StyledSelect>
                </FormControl>
            </FormSectionPadded>

            <StyledDialogActions>
                <SecondaryButton onClick={onClose} disabled={isSaving}>
                    Cancel
                </SecondaryButton>
                <PrimaryButton
                    onClick={handleSave}
                    disabled={!isFormValid || isSaving}
                    startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
                >
                    {isSaving ? buttonLoadingText : buttonText}
                </PrimaryButton>
            </StyledDialogActions>
        </NarrowDialog>
    );
}
