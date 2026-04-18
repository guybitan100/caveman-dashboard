import { Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';

const StyledButton = styled(Button)(({ theme }) => ({
    width: '100%',
    padding: '10px 16px',
    borderRadius: theme.shape.borderRadius,
    background: theme.custom.gradients.primaryButton,
    color: theme.palette.primary.contrastText,
    fontSize: '0.875rem',
    fontWeight: 600,
    textTransform: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: `1px solid ${theme.custom.border.default}`,
    transition: 'all 0.2s ease',
    '&:hover': {
        background: theme.custom.gradients.primaryButtonHover,
        boxShadow: `0 0 20px ${theme.custom.surface.primary40}`,
        transform: 'translateY(-1px)',
    },
    '&:active': {
        transform: 'translateY(0)',
    },
    '&.Mui-disabled': {
        background: theme.custom.surface.white10,
        color: theme.custom.palette.text.placeholder,
    },
}));

interface NewJobButtonProps {
    onClick: () => void;
    isLoading?: boolean;
}

export function NewJobButton({ onClick, isLoading = false }: NewJobButtonProps) {
    return (
        <StyledButton
            onClick={onClick}
            disabled={isLoading}
            startIcon={<AddIcon />}
            data-testid="new-job-button"
        >
            {isLoading ? 'Creating...' : 'New Job'}
        </StyledButton>
    );
}
