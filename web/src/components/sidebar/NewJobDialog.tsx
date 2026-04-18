import { useState, useCallback, KeyboardEvent } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    CircularProgress,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';

const StyledDialog = styled(Dialog)(({ theme }) => ({
    '& .MuiDialog-paper': {
        backgroundColor: theme.custom.palette.background.elevated,
        border: `1px solid ${theme.custom.border.light}`,
        borderRadius: theme.shape.borderRadius * 2,
        minWidth: 400,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
    color: theme.palette.text.primary,
    fontSize: '1.125rem',
    fontWeight: 600,
    padding: theme.spacing(2.5, 3),
    borderBottom: `1px solid ${theme.custom.border.default}`,
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
    padding: theme.spacing(3),
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    marginTop: theme.spacing(1),
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
    '& .MuiOutlinedInput-input': {
        color: theme.palette.text.primary,
    },
}));

const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
    padding: theme.spacing(2, 3),
    borderTop: `1px solid ${theme.custom.border.default}`,
    gap: theme.spacing(1),
}));

const CancelButton = styled(Button)(({ theme }) => ({
    color: theme.custom.palette.text.muted,
    textTransform: 'none',
    '&:hover': {
        backgroundColor: theme.custom.surface.white5,
    },
}));

const CreateButton = styled(Button)(({ theme }) => ({
    background: theme.custom.gradients.primaryButton,
    color: theme.palette.primary.contrastText,
    textTransform: 'none',
    fontWeight: 600,
    padding: theme.spacing(1, 2.5),
    '&:hover': {
        background: theme.custom.gradients.primaryButtonHover,
    },
    '&.Mui-disabled': {
        background: alpha(theme.palette.primary.main, 0.3),
        color: alpha(theme.palette.primary.contrastText, 0.5),
    },
}));

interface NewJobDialogProps {
    open: boolean;
    onClose: () => void;
    onCreate: (name: string) => Promise<void>;
    isCreating: boolean;
}

export function NewJobDialog({ open, onClose, onCreate, isCreating }: NewJobDialogProps) {
    const [jobName, setJobName] = useState('');

    const handleCreate = useCallback(async () => {
        await onCreate(jobName.trim());
        setJobName('');
    }, [jobName, onCreate]);

    const handleClose = useCallback(() => {
        if (!isCreating) {
            setJobName('');
            onClose();
        }
    }, [isCreating, onClose]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' && !isCreating) {
                handleCreate();
            }
        },
        [handleCreate, isCreating]
    );

    return (
        <StyledDialog open={open} onClose={handleClose} data-testid="new-job-dialog">
            <StyledDialogTitle>Create New Job</StyledDialogTitle>
            <StyledDialogContent>
                <StyledTextField
                    autoFocus
                    fullWidth
                    label="Job Name"
                    placeholder="Enter a name for your job (optional)"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isCreating}
                    variant="outlined"
                    size="small"
                    slotProps={{
                        htmlInput: {
                            'data-testid': 'job-name-input',
                        }
                    }}
                />
            </StyledDialogContent>
            <StyledDialogActions>
                <CancelButton onClick={handleClose} disabled={isCreating} data-testid="cancel-job-button">
                    Cancel
                </CancelButton>
                <CreateButton onClick={handleCreate} disabled={isCreating} data-testid="create-job-button">
                    {isCreating ? (
                        <>
                            <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />
                            Creating...
                        </>
                    ) : (
                        'Create'
                    )}
                </CreateButton>
            </StyledDialogActions>
        </StyledDialog>
    );
}
