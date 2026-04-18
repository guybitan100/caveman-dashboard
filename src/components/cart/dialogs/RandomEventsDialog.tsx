import { useState } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CasinoIcon from '@mui/icons-material/Casino';
import { useCart } from '../../../hooks/useCart';
import {
    NarrowDialog,
    DialogHeader,
    HeaderContent,
    HeaderIconWrapper,
    HeaderTitle,
    CloseButton,
    StyledDialogContent,
    StyledDialogActions,
    PrimaryButton,
    SecondaryButton,
    StyledTextField,
} from '../../shared/styledComponents';

const MAX_EVENTS = 10000;

const FormContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
}));

const HelpText = styled(Typography)(({ theme }) => ({
    fontSize: '0.8125rem',
    color: theme.custom.palette.text.muted,
    marginTop: theme.spacing(0.5),
}));

interface RandomEventsDialogProps {
    open: boolean;
    onClose: () => void;
}

export function RandomEventsDialog({
    open,
    onClose,
}: RandomEventsDialogProps) {
    const [totalEvents, setTotalEvents] = useState<string>('100');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const { createRandomEvents } = useCart();

    const parsedValue = parseInt(totalEvents, 10);
    const isValidInput = !isNaN(parsedValue) && parsedValue > 0 && parsedValue <= MAX_EVENTS;

    const handleClose = () => {
        if (isLoading) return;
        setTotalEvents('100');
        setError(null);
        onClose();
    };

    const handleGenerate = async () => {
        if (!isValidInput) return;

        setIsLoading(true);
        setError(null);

        try {
            await createRandomEvents(parsedValue);
            handleClose();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to generate events. Please try again.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Allow empty string or numbers only
        if (value === '' || /^\d+$/.test(value)) {
            setTotalEvents(value);
        }
    };

    return (
        <NarrowDialog open={open} onClose={handleClose}>
            <DialogHeader>
                <HeaderContent>
                    <HeaderIconWrapper sx={{ color: 'status.finalizing.main' }}>
                        <CasinoIcon sx={{ fontSize: 20 }} />
                    </HeaderIconWrapper>
                    <HeaderTitle>Generate Random Events</HeaderTitle>
                </HeaderContent>
                <CloseButton onClick={handleClose} disabled={isLoading}>
                    <CloseIcon sx={{ fontSize: 20 }} />
                </CloseButton>
            </DialogHeader>

            <StyledDialogContent>
                <FormContainer>
                    <Box>
                        <StyledTextField
                            label="Total Events"
                            type="text"
                            inputMode="numeric"
                            value={totalEvents}
                            onChange={handleInputChange}
                            fullWidth
                            disabled={isLoading}
                            error={totalEvents !== '' && !isValidInput}
                            helperText={
                                totalEvents !== '' && !isValidInput
                                    ? `Enter a number between 1 and ${MAX_EVENTS.toLocaleString()}`
                                    : undefined
                            }
                            autoFocus
                        />
                        <HelpText>
                            Events will be distributed across types using realistic proportions
                        </HelpText>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mt: 1 }}>
                            {error}
                        </Alert>
                    )}
                </FormContainer>
            </StyledDialogContent>

            <StyledDialogActions>
                <SecondaryButton onClick={handleClose} disabled={isLoading}>
                    Cancel
                </SecondaryButton>
                <PrimaryButton
                    onClick={handleGenerate}
                    disabled={!isValidInput || isLoading}
                    startIcon={
                        isLoading ? (
                            <CircularProgress size={16} color="inherit" />
                        ) : undefined
                    }
                >
                    {isLoading ? 'Generating...' : 'Generate'}
                </PrimaryButton>
            </StyledDialogActions>
        </NarrowDialog>
    );
}
