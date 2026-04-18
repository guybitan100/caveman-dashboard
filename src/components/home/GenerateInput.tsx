import { styled } from '@mui/material/styles';
import { Box, TextField } from '@mui/material';
import { GoButton } from '../shared/GoButton.tsx';

interface GenerateInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    placeholder?: string;
    buttonLabel?: string;
}

const InputCard = styled(Box)(({ theme }) => ({
    width: '100%',
    maxWidth: 600,
    backgroundColor: theme.custom.palette.background.input,
    backdropFilter: 'blur(16px)',
    borderRadius: 16,
    // border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: 24,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    marginBottom: 16,
    '& .MuiOutlinedInput-root': {
        backgroundColor: theme.custom.palette.background.input,
        borderRadius: 12,
        color: theme.palette.text.primary,
        fontSize: '0.95rem',
        '& fieldset': {
            border: "none"
        },
        '&:hover fieldset': {
            // borderColor: 'rgba(255, 255, 255, 0.15)',
        },
        '&.Mui-focused fieldset': {
            borderColor: theme.custom.surface.orange20,
            borderWidth: 1,
        },
    },
    '& .MuiInputBase-input::placeholder': {
        color: theme.custom.palette.text.muted,
        opacity: 1,
    },
}));

const BottomRow = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
});



export function GenerateInput({
    value,
    onChange,
    onSubmit,
    placeholder = "Describe a scenario and I'll build the UFDR for you.",
}: GenerateInputProps) {


    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    return (
        <InputCard>
            <StyledTextField
                fullWidth
                multiline
                rows={3}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <BottomRow>
                <Box />
                <GoButton size="large" onClick={onSubmit} />
            </BottomRow>
        </InputCard>
    );
}
