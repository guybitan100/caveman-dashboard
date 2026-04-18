import { useCallback, useState, useEffect } from 'react';
import { Box, InputBase, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useDebounce } from '../../hooks/useJobs.ts';

const SearchContainer = styled(Box)({
    width: '100%',
});

const SearchInputWrapper = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.white8,
    border: `1px solid ${theme.custom.border.default}`,
    transition: 'all 0.2s ease',
    '&:focus-within': {
        backgroundColor: theme.custom.surface.white10,
        borderColor: theme.custom.border.focus,
        boxShadow: `0 0 12px ${theme.custom.surface.primary15}`,
    },
}));

const StyledSearchIcon = styled(SearchIcon)(({ theme }) => ({
    color: theme.palette.text.disabled,
    fontSize: '1.25rem',
}));

const StyledInput = styled(InputBase)(({ theme }) => ({
    flex: 1,
    color: theme.palette.text.primary,
    fontSize: '0.875rem',
    '& input': {
        padding: 0,
        '&::placeholder': {
            color: theme.palette.text.disabled,
            opacity: 1,
        },
    },
}));

const ClearButton = styled(IconButton)(({ theme }) => ({
    padding: 4,
    color: theme.palette.text.disabled,
    '&:hover': {
        color: theme.custom.palette.text.tertiary,
        backgroundColor: theme.custom.surface.white10,
    },
}));

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
}

export function SearchBar({
    value,
    onChange,
    placeholder = 'Search jobs...',
    debounceMs = 300,
}: SearchBarProps) {
    const [localValue, setLocalValue] = useState(value);
    const debouncedValue = useDebounce(localValue, debounceMs);

    // Sync debounced value to parent
    useEffect(() => {
        onChange(debouncedValue);
    }, [debouncedValue, onChange]);

    // Sync external value changes
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            setLocalValue(event.target.value);
        },
        []
    );

    const handleClear = useCallback(() => {
        setLocalValue('');
        onChange('');
    }, [onChange]);

    return (
        <SearchContainer data-testid="search-bar">
            <SearchInputWrapper>
                <StyledSearchIcon />
                <StyledInput
                    value={localValue}
                    onChange={handleChange}
                    placeholder={placeholder}
                    inputProps={{
                        'aria-label': 'Search jobs',
                        'data-testid': 'search-input',
                    }}
                />
                {localValue && (
                    <ClearButton
                        size="small"
                        onClick={handleClear}
                        aria-label="Clear search"
                        data-testid="clear-search-button"
                    >
                        <ClearIcon sx={{ fontSize: '1rem' }} />
                    </ClearButton>
                )}
            </SearchInputWrapper>
        </SearchContainer>
    );
}
