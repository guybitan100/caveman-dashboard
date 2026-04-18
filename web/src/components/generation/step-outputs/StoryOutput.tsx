import { useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import {
    Box,
    Typography,
    TextField,
    Chip,
    Collapse,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { StoryExpansion } from '../../../types/pipeline.ts';
import { ActionButton } from '../../shared/styledComponents';

const Container = styled(Box)({
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 20,
    border: '1px solid rgba(255, 255, 255, 0.08)',
});

const Header = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
});

const SectionTitle = styled(Typography)({
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 8,
});

const ContentText = styled(Typography)({
    fontSize: '0.95rem',
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
});

const EditableTextField = styled(TextField)({
    '& .MuiOutlinedInput-root': {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        color: '#fff',
        fontSize: '0.95rem',
        '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.15)',
        },
        '&:hover fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.3)',
        },
        '&.Mui-focused fieldset': {
            borderColor: '#ff5300',
        },
    },
});

const ChipsContainer = styled(Box)({
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
});

const ThemeChip = styled(Chip)({
    backgroundColor: 'rgba(255, 83, 0, 0.15)',
    color: '#ff5300',
    fontWeight: 500,
    borderRadius: 16,
    '& .MuiChip-deleteIcon': {
        color: 'rgba(255, 83, 0, 0.6)',
        '&:hover': {
            color: '#ff5300',
        },
    },
});

const Section = styled(Box)({
    marginBottom: 20,
    '&:last-child': {
        marginBottom: 0,
    },
});

const SettingBadge = styled(Box)({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: 'rgba(61, 108, 156, 0.2)',
    borderRadius: 8,
    color: '#3d6c9c',
    fontSize: '0.875rem',
    fontWeight: 500,
});

interface StoryOutputProps {
    data: StoryExpansion;
    isEditing?: boolean;
    onEdit?: (data: StoryExpansion) => void;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export function StoryOutput({
    data,
    isEditing = false,
    onEdit,
    isExpanded = false,
    onToggleExpand,
}: StoryOutputProps) {
    const [localData, setLocalData] = useState(data);
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        setLocalData(data);
    }, [data]);

    // Auto-enter edit mode when isEditing prop becomes true
    useEffect(() => {
        if (isEditing) {
            setEditMode(true);
        } else {
            setEditMode(false);
        }
    }, [isEditing]);

    const handleSave = () => {
        if (onEdit) {
            onEdit(localData);
        }
        setEditMode(false);
    };

    const handleCancel = () => {
        setLocalData(data);
        setEditMode(false);
    };

    const handleRemoveTheme = (themeToRemove: string) => {
        setLocalData({
            ...localData,
            key_themes: localData.key_themes.filter((t) => t !== themeToRemove),
        });
    };

    return (
        <Container>
            <Header>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                        sx={{ color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}
                    >
                        Expanded Story
                    </Typography>
                    {onToggleExpand && (
                        <ActionButton onClick={onToggleExpand} size="small">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </ActionButton>
                    )}
                </Box>
                {isEditing && !editMode && (
                    <ActionButton onClick={() => setEditMode(true)}>
                        <EditIcon fontSize="small" />
                    </ActionButton>
                )}
                {editMode && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <ActionButton onClick={handleSave} sx={{ color: '#4ade80' }}>
                            <CheckIcon fontSize="small" />
                        </ActionButton>
                        <ActionButton onClick={handleCancel} sx={{ color: '#f87171' }}>
                            <CloseIcon fontSize="small" />
                        </ActionButton>
                    </Box>
                )}
            </Header>

            <Collapse in={isExpanded}>
                <Section>
                    <SectionTitle>Original Description</SectionTitle>
                    <ContentText sx={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.6)' }}>
                        "{data.original_description}"
                    </ContentText>
                </Section>

                <Section>
                    <SectionTitle>Setting</SectionTitle>
                    {editMode ? (
                        <EditableTextField
                            fullWidth
                            size="small"
                            value={localData.setting}
                            onChange={(e) =>
                                setLocalData({ ...localData, setting: e.target.value })
                            }
                        />
                    ) : (
                        <SettingBadge>{data.setting}</SettingBadge>
                    )}
                </Section>

                <Section>
                    <SectionTitle>Narrative</SectionTitle>
                    {editMode ? (
                        <EditableTextField
                            fullWidth
                            multiline
                            rows={6}
                            value={localData.expanded_narrative}
                            onChange={(e) =>
                                setLocalData({ ...localData, expanded_narrative: e.target.value })
                            }
                        />
                    ) : (
                        <ContentText>{data.expanded_narrative}</ContentText>
                    )}
                </Section>

                <Section>
                    <SectionTitle>Key Themes</SectionTitle>
                    <ChipsContainer>
                        {(editMode ? localData : data).key_themes.map((theme) => (
                            <ThemeChip
                                key={theme}
                                label={theme}
                                onDelete={editMode ? () => handleRemoveTheme(theme) : undefined}
                            />
                        ))}
                    </ChipsContainer>
                </Section>
            </Collapse>
        </Container>
    );
}
