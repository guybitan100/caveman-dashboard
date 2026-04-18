import { useState, useEffect } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import {
    Box,
    Typography,
    Chip,
    Collapse,
    LinearProgress,
    TextField,
    MenuItem,
    Slider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LinkIcon from '@mui/icons-material/Link';
import FavoriteIcon from '@mui/icons-material/Favorite';
import GroupsIcon from '@mui/icons-material/Groups';
import WorkIcon from '@mui/icons-material/Work';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { SocialGraph, Relationship, RelationshipType, AiGeneratedEntity } from '../../../types/pipeline.ts';
import { StyledSelect, ActionButton } from '../../shared/styledComponents';

const Container = styled(Box)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white5,
    borderRadius: 12,
    padding: 20,
    border: `1px solid ${theme.custom.border.default}`,
}));

const Header = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
});

const RelationshipCard = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    backgroundColor: theme.custom.surface.white5,
    borderRadius: 10,
    border: `1px solid ${theme.custom.surface.white8}`,
    marginBottom: 8,
    '&:last-child': {
        marginBottom: 0,
    },
}));

const EntityBadge = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    backgroundColor: theme.custom.surface.white8,
    borderRadius: 8,
    color: theme.palette.text.primary,
    fontSize: '0.85rem',
    fontWeight: 500,
}));

const RelationshipArrow = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    minWidth: 100,
    padding: '0 8px',
});

const StrengthBar = styled(LinearProgress)(({ theme }) => ({
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.custom.surface.white10,
    '& .MuiLinearProgress-bar': {
        backgroundColor: theme.palette.secondary.main,
        borderRadius: 2,
    },
}));

const EditableTextField = styled(TextField)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        backgroundColor: theme.custom.surface.white8,
        borderRadius: 8,
        color: theme.palette.text.primary,
        fontSize: '0.8rem',
        '& fieldset': {
            borderColor: theme.custom.border.light,
        },
        '&:hover fieldset': {
            borderColor: theme.custom.surface.white20,
        },
        '&.Mui-focused fieldset': {
            borderColor: theme.palette.secondary.main,
        },
    },
}));

const AddRelationshipCard = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '16px',
    backgroundColor: theme.custom.surface.white5,
    borderRadius: 10,
    border: `2px dashed ${theme.custom.border.light}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
        backgroundColor: theme.custom.surface.white5,
        borderColor: theme.custom.border.orange,
    },
}));

const relationshipIcons: Record<RelationshipType, React.ReactElement> = {
    family: <GroupsIcon sx={{ fontSize: 14 }} />,
    romantic: <FavoriteIcon sx={{ fontSize: 14 }} />,
    friend: <PersonIcon sx={{ fontSize: 14 }} />,
    colleague: <WorkIcon sx={{ fontSize: 14 }} />,
    acquaintance: <PersonIcon sx={{ fontSize: 14 }} />,
    neighbor: <PersonIcon sx={{ fontSize: 14 }} />,
    rival: <PersonIcon sx={{ fontSize: 14 }} />,
    enemy: <PersonIcon sx={{ fontSize: 14 }} />,
    professional: <WorkIcon sx={{ fontSize: 14 }} />,
    stranger: <PersonIcon sx={{ fontSize: 14 }} />,
    service_provider: <WorkIcon sx={{ fontSize: 14 }} />,
    other: <LinkIcon sx={{ fontSize: 14 }} />,
};

interface SocialGraphOutputProps {
    data: SocialGraph;
    entities?: AiGeneratedEntity[];
    isEditing?: boolean;
    onEdit?: (data: SocialGraph) => void;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export function SocialGraphOutput({
    data,
    entities = [],
    isEditing = false,
    isExpanded = false,
    onToggleExpand,
}: SocialGraphOutputProps) {
    const theme = useTheme();
    const [localData, setLocalData] = useState<SocialGraph>(data);
    const [editMode, setEditMode] = useState(false);

    const getRelationshipColor = (type: RelationshipType): string => {
        return theme.custom.relationship[type] || "#6b7280";
    };

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

    const getEntityName = (entityId: string): string => {
        const entity = entities.find((e) => e.entity_id === entityId);
        return entity?.name || entityId;
    };

    const formatRelationshipType = (type: RelationshipType): string => {
        return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const updateRelationship = (index: number, updates: Partial<Relationship>) => {
        setLocalData(prev => ({
            ...prev,
            relationships: prev.relationships.map((rel, i) =>
                i === index ? { ...rel, ...updates } : rel
            )
        }));
    };

    const deleteRelationship = (index: number) => {
        setLocalData(prev => ({
            ...prev,
            relationships: prev.relationships.filter((_, i) => i !== index)
        }));
    };

    const addNewRelationship = () => {
        const newRelationship: Relationship = {
            entity_id_1: entities[0]?.entity_id || '',
            entity_id_2: entities[1]?.entity_id || entities[0]?.entity_id || '',
            relationship_type: 'acquaintance',
            strength: 5,
            description: '',
            is_bidirectional: true,
            communication_frequency: 5,
        };
        setLocalData(prev => ({
            ...prev,
            relationships: [...prev.relationships, newRelationship]
        }));
    };

    const displayData = editMode ? localData : data;
    const relationshipTypes: RelationshipType[] = [
        'family', 'romantic', 'friend', 'colleague', 'acquaintance',
        'neighbor', 'rival', 'enemy', 'professional', 'stranger',
        'service_provider', 'other'
    ];

    return (
        <Container>
            <Header>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={(theme) => ({ color: theme.palette.text.primary, fontWeight: 600, fontSize: '1.1rem' })}>
                        Social Graph
                    </Typography>
                    <Chip
                        label={`${displayData.relationships.length} relationships`}
                        size="small"
                        sx={(theme) => ({
                            backgroundColor: theme.custom.status.converting.background,
                            color: theme.palette.primary.light,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                        })}
                    />
                    {onToggleExpand && (
                        <ActionButton onClick={onToggleExpand} size="small">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </ActionButton>
                    )}
                </Box>
            </Header>

            <Collapse in={isExpanded}>
                <Box>
                    {displayData.relationships.map((rel: Relationship, index: number) => (
                        <RelationshipCard key={index} sx={(theme) => (editMode ? { border: `1px solid ${theme.custom.border.orange}` } : {})}>
                            {editMode ? (
                                // Edit mode layout
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <ActionButton
                                            onClick={() => deleteRelationship(index)}
                                            sx={(theme) => ({ color: theme.palette.error.main })}
                                            size="small"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </ActionButton>
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                        {/* Entity 1 selector */}
                                        <StyledSelect
                                            size="small"
                                            value={rel.entity_id_1}
                                            onChange={(e) => updateRelationship(index, { entity_id_1: e.target.value as string })}
                                        >
                                            {entities.map(entity => (
                                                <MenuItem key={entity.entity_id} value={entity.entity_id}>
                                                    {entity.name}
                                                </MenuItem>
                                            ))}
                                        </StyledSelect>

                                        {/* Relationship type selector */}
                                        <StyledSelect
                                            size="small"
                                            value={rel.relationship_type}
                                            onChange={(e) => updateRelationship(index, { relationship_type: e.target.value as RelationshipType })}
                                        >
                                            {relationshipTypes.map(type => (
                                                <MenuItem key={type} value={type}>
                                                    {formatRelationshipType(type)}
                                                </MenuItem>
                                            ))}
                                        </StyledSelect>

                                        {/* Entity 2 selector */}
                                        <StyledSelect
                                            size="small"
                                            value={rel.entity_id_2}
                                            onChange={(e) => updateRelationship(index, { entity_id_2: e.target.value as string })}
                                        >
                                            {entities.map(entity => (
                                                <MenuItem key={entity.entity_id} value={entity.entity_id}>
                                                    {entity.name}
                                                </MenuItem>
                                            ))}
                                        </StyledSelect>
                                    </Box>

                                    {/* Strength slider */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Typography sx={(theme) => ({ color: theme.custom.palette.text.muted, fontSize: '0.8rem', minWidth: 70 })}>
                                            Strength:
                                        </Typography>
                                        <Slider
                                            value={rel.strength}
                                            onChange={(_, value) => updateRelationship(index, { strength: value as number })}
                                            min={1}
                                            max={10}
                                            step={1}
                                            valueLabelDisplay="auto"
                                            sx={(theme) => ({
                                                flex: 1,
                                                color: theme.palette.secondary.main,
                                                '& .MuiSlider-thumb': {
                                                    backgroundColor: theme.palette.secondary.main,
                                                },
                                                '& .MuiSlider-track': {
                                                    backgroundColor: theme.palette.secondary.main,
                                                },
                                                '& .MuiSlider-rail': {
                                                    backgroundColor: theme.custom.surface.white20,
                                                },
                                            })}
                                        />
                                        <Typography sx={(theme) => ({ color: theme.palette.secondary.main, fontSize: '0.9rem', fontWeight: 600, minWidth: 30 })}>
                                            {rel.strength}/10
                                        </Typography>
                                    </Box>

                                    {/* Description */}
                                    <EditableTextField
                                        fullWidth
                                        size="small"
                                        placeholder="Description (optional)"
                                        value={rel.description}
                                        onChange={(e) => updateRelationship(index, { description: e.target.value })}
                                    />
                                </Box>
                            ) : (
                                // View mode layout (original)
                                <>
                                    <EntityBadge>
                                        <PersonIcon sx={{ fontSize: 16 }} />
                                        {getEntityName(rel.entity_id_1)}
                                    </EntityBadge>

                                    <RelationshipArrow>
                                        <Chip
                                            icon={relationshipIcons[rel.relationship_type]}
                                            label={formatRelationshipType(rel.relationship_type)}
                                            size="small"
                                            sx={{
                                                backgroundColor: `${getRelationshipColor(rel.relationship_type)}20`,
                                                color: getRelationshipColor(rel.relationship_type),
                                                fontWeight: 500,
                                                fontSize: '0.7rem',
                                                '& .MuiChip-icon': {
                                                    color: 'inherit',
                                                },
                                            }}
                                        />
                                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <StrengthBar
                                                variant="determinate"
                                                value={rel.strength * 10}
                                            />
                                            <Typography
                                                sx={(theme) => ({
                                                    fontSize: '0.65rem',
                                                    color: theme.custom.palette.text.placeholder,
                                                    minWidth: 20,
                                                })}
                                            >
                                                {rel.strength}/10
                                            </Typography>
                                        </Box>
                                    </RelationshipArrow>

                                    <EntityBadge>
                                        <PersonIcon sx={{ fontSize: 16 }} />
                                        {getEntityName(rel.entity_id_2)}
                                    </EntityBadge>
                                </>
                            )}
                        </RelationshipCard>
                    ))}

                    {/* Add new relationship button in edit mode */}
                    {editMode && (
                        <AddRelationshipCard onClick={addNewRelationship}>
                            <AddIcon sx={(theme) => ({ fontSize: 20, color: theme.palette.text.disabled })} />
                            <Typography sx={(theme) => ({ color: theme.custom.palette.text.placeholder, fontSize: '0.85rem' })}>
                                Add New Relationship
                            </Typography>
                        </AddRelationshipCard>
                    )}

                    {displayData.relationships.length === 0 && !editMode && (
                        <Typography
                            sx={(theme) => ({
                                color: theme.palette.text.disabled,
                                textAlign: 'center',
                                py: 4,
                            })}
                        >
                            No relationships defined
                        </Typography>
                    )}
                </Box>
            </Collapse>
        </Container>
    );
}
