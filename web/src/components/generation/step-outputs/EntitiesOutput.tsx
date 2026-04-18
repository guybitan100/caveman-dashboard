import { useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import {
    Box,
    Typography,
    Chip,
    Collapse,
    Avatar,
    Grid,
    Tooltip,
    TextField,
    MenuItem,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PersonIcon from '@mui/icons-material/Person';
import WorkIcon from '@mui/icons-material/Work';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { AiGeneratedEntity, Gender } from '../../../types/pipeline.ts';
import { StyledSelect, ActionButton } from '../../shared/styledComponents';

const Container = styled(Box)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius * 1.5,
    padding: theme.spacing(2.5),
    border: `1px solid ${theme.custom.border.default}`,
}));

const Header = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
}));

const EntityCard = styled(Box)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius * 1.25,
    padding: theme.spacing(2),
    border: `1px solid ${theme.custom.border.default}`,
    transition: 'all 0.2s ease',
    '&:hover': {
        backgroundColor: theme.custom.surface.white10,
        borderColor: theme.custom.border.medium,
    },
}));

const EntityAvatar = styled(Avatar)<{ gender: Gender }>(({ gender, theme }) => ({
    width: 48,
    height: 48,
    backgroundColor:
        gender === 'female'
            ? theme.custom.status.error.background
            : gender === 'male'
                ? theme.custom.status.info.background
                : theme.custom.status.draft.background,
    color:
        gender === 'female'
            ? theme.custom.status.error.main
            : gender === 'male'
                ? theme.custom.status.info.main
                : theme.custom.status.draft.main,
}));

const EntityName = styled(Typography)(({ theme }) => ({
    fontSize: '1rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.primary,
    marginBottom: 4,
}));

const EntityRole = styled(Typography)(({ theme }) => ({
    fontSize: '0.8rem',
    color: theme.palette.text.disabled,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
}));

const TraitChip = styled(Chip)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white8,
    color: theme.palette.text.secondary,
    fontSize: '0.7rem',
    height: 24,
    borderRadius: 12,
}));

const InfoRow = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
    '& svg': {
        fontSize: 14,
    },
}));

const StatBox = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: theme.spacing(1, 1.5),
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius,
    minWidth: 60,
}));

const StatValue = styled(Typography)(({ theme }) => ({
    fontSize: '1rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.secondary.main,
}));

const StatLabel = styled(Typography)(({ theme }) => ({
    fontSize: '0.65rem',
    color: theme.palette.text.disabled,
    textTransform: 'uppercase',
}));

const EditableTextField = styled(TextField)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        backgroundColor: theme.custom.surface.white10,
        borderRadius: theme.shape.borderRadius,
        color: theme.palette.text.primary,
        fontSize: '0.9rem',
        '& fieldset': {
            borderColor: theme.custom.border.light,
        },
        '&:hover fieldset': {
            borderColor: theme.custom.border.medium,
        },
        '&.Mui-focused fieldset': {
            borderColor: theme.palette.secondary.main,
        },
    },
    '& .MuiInputLabel-root': {
        color: theme.palette.text.disabled,
        fontSize: '0.8rem',
    },
}));

const AddEntityCard = styled(Box)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius * 1.25,
    padding: theme.spacing(2),
    border: `2px dashed ${theme.custom.border.light}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
        backgroundColor: theme.custom.surface.white8,
        borderColor: theme.custom.border.orange,
    },
}));

interface EntitiesOutputProps {
    data: AiGeneratedEntity[];
    isEditing?: boolean;
    onEdit?: (data: AiGeneratedEntity[]) => void;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export function EntitiesOutput({
    data,
    isEditing = false,
    onEdit,
    isExpanded = true,
    onToggleExpand,
}: EntitiesOutputProps) {
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

    const updateEntity = (entityId: string, updates: Partial<AiGeneratedEntity>) => {
        setLocalData(prev => prev.map(entity =>
            entity.entity_id === entityId
                ? { ...entity, ...updates }
                : entity
        ));
    };

    const updateEntityCharacteristics = (entityId: string, updates: Partial<AiGeneratedEntity['characteristics']>) => {
        setLocalData(prev => prev.map(entity =>
            entity.entity_id === entityId
                ? { ...entity, characteristics: { ...entity.characteristics, ...updates } }
                : entity
        ));
    };

    const deleteEntity = (entityId: string) => {
        setLocalData(prev => prev.filter(entity => entity.entity_id !== entityId));
    };

    const addNewEntity = () => {
        const newEntity: AiGeneratedEntity = {
            entity_id: `entity-${Date.now()}`,
            name: 'New Entity',
            characteristics: {
                gender: 'unknown',
                personality_traits: [],
                tech_savviness: 5,
                social_activity: 5,
            },
            languages: [],
            phone_numbers: [],
            emails: [],
        };
        setLocalData(prev => [...prev, newEntity]);
    };

    // Render entities based on editMode
    const displayData = editMode ? localData : data;

    return (
        <Container>
            <Header>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ color: 'text.primary', fontWeight: 'fontWeightBold', fontSize: '1.1rem' }}>
                        Entities
                    </Typography>
                    <Chip
                        label={`${data.length} found`}
                        size="small"
                        sx={{
                            backgroundColor: (theme) => theme.custom.status.success.background,
                            color: (theme) => theme.custom.status.success.main,
                            fontWeight: 'fontWeightBold',
                            fontSize: '0.7rem',
                        }}
                    />
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
                        <ActionButton onClick={handleSave} sx={{ color: 'success.main' }}>
                            <CheckIcon fontSize="small" />
                        </ActionButton>
                        <ActionButton onClick={handleCancel} sx={{ color: 'error.main' }}>
                            <CloseIcon fontSize="small" />
                        </ActionButton>
                    </Box>
                )}
            </Header>

            <Collapse in={isExpanded}>
                <Grid container spacing={2}>
                    {displayData.map((entity) => (
                        <Grid item xs={12} sm={6} key={entity.entity_id}>
                            <EntityCard sx={editMode ? { border: (theme) => `1px solid ${theme.custom.border.orange}` } : {}}>
                                {/* Delete button in edit mode */}
                                {editMode && (
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                                        <ActionButton
                                            onClick={() => deleteEntity(entity.entity_id)}
                                            sx={{ color: 'error.main' }}
                                            size="small"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </ActionButton>
                                    </Box>
                                )}

                                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                    <EntityAvatar gender={entity.characteristics.gender}>
                                        <PersonIcon />
                                    </EntityAvatar>
                                    <Box sx={{ flex: 1 }}>
                                        {editMode ? (
                                            <EditableTextField
                                                fullWidth
                                                size="small"
                                                label="Name"
                                                value={entity.name}
                                                onChange={(e) => updateEntity(entity.entity_id, { name: e.target.value })}
                                                sx={{ mb: 1 }}
                                            />
                                        ) : (
                                            <EntityName>{entity.name}</EntityName>
                                        )}
                                        {editMode ? (
                                            <EditableTextField
                                                fullWidth
                                                size="small"
                                                label="Occupation"
                                                value={entity.characteristics.occupation || ''}
                                                onChange={(e) => updateEntityCharacteristics(entity.entity_id, { occupation: e.target.value })}
                                            />
                                        ) : (
                                            entity.characteristics.occupation && (
                                                <EntityRole>
                                                    <WorkIcon sx={{ fontSize: 12 }} />
                                                    {entity.characteristics.occupation}
                                                </EntityRole>
                                            )
                                        )}
                                    </Box>
                                    {editMode ? (
                                        <EditableTextField
                                            size="small"
                                            label="Age"
                                            type="number"
                                            value={entity.characteristics.age || ''}
                                            onChange={(e) => updateEntityCharacteristics(entity.entity_id, { age: parseInt(e.target.value) || undefined })}
                                            sx={{ width: 80 }}
                                        />
                                    ) : (
                                        entity.characteristics.age && (
                                            <Tooltip title="Age">
                                                <StatBox>
                                                    <StatValue>{entity.characteristics.age}</StatValue>
                                                    <StatLabel>Age</StatLabel>
                                                </StatBox>
                                            </Tooltip>
                                        )
                                    )}
                                </Box>

                                {/* Gender selector in edit mode */}
                                {editMode && (
                                    <Box sx={{ mb: 2 }}>
                                        <Typography sx={{ color: 'text.disabled', fontSize: '0.75rem', mb: 0.5 }}>
                                            Gender
                                        </Typography>
                                        <StyledSelect
                                            size="small"
                                            fullWidth
                                            value={entity.characteristics.gender}
                                            onChange={(e) => updateEntityCharacteristics(entity.entity_id, { gender: e.target.value as Gender })}
                                        >
                                            <MenuItem value="male">Male</MenuItem>
                                            <MenuItem value="female">Female</MenuItem>
                                            <MenuItem value="unknown">Unknown</MenuItem>
                                        </StyledSelect>
                                    </Box>
                                )}

                                {/* Personality traits */}
                                {editMode ? (
                                    <Box sx={{ mb: 2 }}>
                                        <EditableTextField
                                            fullWidth
                                            size="small"
                                            label="Personality Traits (comma separated)"
                                            value={entity.characteristics.personality_traits.join(', ')}
                                            onChange={(e) => updateEntityCharacteristics(entity.entity_id, {
                                                personality_traits: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                                            })}
                                        />
                                    </Box>
                                ) : (
                                    entity.characteristics.personality_traits.length > 0 && (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                            {entity.characteristics.personality_traits.slice(0, 3).map((trait) => (
                                                <TraitChip key={trait} label={trait} size="small" />
                                            ))}
                                            {entity.characteristics.personality_traits.length > 3 && (
                                                <TraitChip
                                                    label={`+${entity.characteristics.personality_traits.length - 3}`}
                                                    size="small"
                                                />
                                            )}
                                        </Box>
                                    )
                                )}

                                {/* Contact info */}
                                {editMode ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                                        <EditableTextField
                                            fullWidth
                                            size="small"
                                            label="Phone Number"
                                            value={entity.phone_numbers[0] || ''}
                                            onChange={(e) => updateEntity(entity.entity_id, {
                                                phone_numbers: e.target.value ? [e.target.value] : []
                                            })}
                                        />
                                        <EditableTextField
                                            fullWidth
                                            size="small"
                                            label="Email"
                                            value={entity.emails[0] || ''}
                                            onChange={(e) => updateEntity(entity.entity_id, {
                                                emails: e.target.value ? [e.target.value] : []
                                            })}
                                        />
                                    </Box>
                                ) : (
                                    <>
                                        {entity.phone_numbers.length > 0 && (
                                            <InfoRow>
                                                <PhoneIcon />
                                                {entity.phone_numbers[0]}
                                            </InfoRow>
                                        )}
                                        {entity.emails.length > 0 && (
                                            <InfoRow>
                                                <EmailIcon />
                                                {entity.emails[0]}
                                            </InfoRow>
                                        )}
                                    </>
                                )}

                                {/* Stats */}
                                {editMode ? (
                                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                        <EditableTextField
                                            size="small"
                                            label="Tech (1-10)"
                                            type="number"
                                            value={entity.characteristics.tech_savviness}
                                            onChange={(e) => updateEntityCharacteristics(entity.entity_id, {
                                                tech_savviness: Math.min(10, Math.max(1, parseInt(e.target.value) || 1))
                                            })}
                                            sx={{ flex: 1 }}
                                            inputProps={{ min: 1, max: 10 }}
                                        />
                                        <EditableTextField
                                            size="small"
                                            label="Social (1-10)"
                                            type="number"
                                            value={entity.characteristics.social_activity}
                                            onChange={(e) => updateEntityCharacteristics(entity.entity_id, {
                                                social_activity: Math.min(10, Math.max(1, parseInt(e.target.value) || 1))
                                            })}
                                            sx={{ flex: 1 }}
                                            inputProps={{ min: 1, max: 10 }}
                                        />
                                    </Box>
                                ) : (
                                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                        <Tooltip title="Tech Savviness">
                                            <StatBox>
                                                <StatValue>{entity.characteristics.tech_savviness}</StatValue>
                                                <StatLabel>Tech</StatLabel>
                                            </StatBox>
                                        </Tooltip>
                                        <Tooltip title="Social Activity">
                                            <StatBox>
                                                <StatValue>{entity.characteristics.social_activity}</StatValue>
                                                <StatLabel>Social</StatLabel>
                                            </StatBox>
                                        </Tooltip>
                                    </Box>
                                )}
                            </EntityCard>
                        </Grid>
                    ))}

                    {/* Add new entity card in edit mode */}
                    {editMode && (
                        <Grid item xs={12} sm={6}>
                            <AddEntityCard onClick={addNewEntity}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                    <AddIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                                    <Typography sx={{ color: 'text.disabled', fontSize: '0.9rem' }}>
                                        Add New Entity
                                    </Typography>
                                </Box>
                            </AddEntityCard>
                        </Grid>
                    )}
                </Grid>
            </Collapse>
        </Container>
    );
}
