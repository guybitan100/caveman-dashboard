/**
 * ErrorState component.
 * Connection error display with retry button.
 */

import { Box, Typography, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';


const ErrorContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4, 3),
    textAlign: 'center',
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.custom.border.default}`,
}));

const ErrorIconWrapper = styled(Box)({
    marginBottom: 12,
});

const StyledErrorIcon = styled(ErrorOutlineIcon)(({ theme }) => ({
    fontSize: '2.5rem',
    color: theme.palette.error.main,
    opacity: 0.8,
}));

const ErrorTitle = styled(Typography)(({ theme }) => ({
    fontSize: '0.9rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginBottom: 6,
}));

const ErrorDescription = styled(Typography)(({ theme }) => ({
    fontSize: '0.8rem',
    color: theme.custom.palette.text.muted,
    marginBottom: 20,
}));

const RetryButton = styled(Button)(({ theme }) => ({
    padding: '8px 16px',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.white8,
    color: theme.palette.text.primary,
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'none',
    border: `1px solid ${theme.custom.border.default}`,
    '&:hover': {
        backgroundColor: theme.custom.surface.white15,
        borderColor: theme.custom.border.light,
    },
}));


interface ErrorStateProps {
    message?: string;
    onRetry: () => void;
}

export function ErrorState({
    message = 'Failed to load jobs',
    onRetry,
}: ErrorStateProps) {
    return (
        <ErrorContainer>
            <ErrorIconWrapper>
                <StyledErrorIcon />
            </ErrorIconWrapper>
            <ErrorTitle>Connection Error</ErrorTitle>
            <ErrorDescription>{message}</ErrorDescription>
            <RetryButton onClick={onRetry} startIcon={<RefreshIcon />}>
                Retry
            </RetryButton>
        </ErrorContainer>
    );
}
