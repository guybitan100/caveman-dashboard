import { useState } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Avatar,
    Chip,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import { useCartStore } from '../../../stores/cartStore.ts';
import { CreateEntityRequest, Entity } from '../../../types/cart.ts';
import { getEntityDisplayName, getEntityInitials } from '../../../utils/entity';
import { EntityFormDialog } from '../dialogs/EntityFormDialog.tsx';
import { EmptyStateCompact as EmptyState } from '../../shared/styledComponents';

const SectionContainer = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2, 2.5),
    borderBottom: `1px solid ${theme.custom.border.default}`,
}));

const EntitiesHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1.5),
}));

const EntitiesTitle = styled(Typography)(({ theme }) => ({
    fontSize: '0.8125rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.secondary,
}));

const EntitiesList = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
}));

const EntityCard = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25, 1.5),
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.custom.border.default}`,
    transition: 'all 0.2s ease',

    '&:hover': {
        backgroundColor: theme.custom.surface.white10,
        borderColor: theme.custom.surface.primary20,
    },
}));

const EntityAvatar = styled(Avatar)(({ theme }) => ({
    width: 32,
    height: 32,
    backgroundColor: theme.custom.surface.primary20,
    color: theme.palette.primary.light,
    fontSize: '0.875rem',
}));

const EntityInfo = styled(Box)({
    flex: 1,
    minWidth: 0,
});

const EntityName = styled(Typography)(({ theme }) => ({
    fontSize: '0.8125rem',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}));

const EntityDetail = styled(Typography)(({ theme }) => ({
    fontSize: '0.6875rem',
    color: theme.palette.text.disabled,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}));

const OwnerChip = styled(Chip)(({ theme }) => ({
    height: 18,
    fontSize: '0.6rem',
    fontWeight: theme.typography.fontWeightBold,
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
    '& .MuiChip-icon': {
        fontSize: '0.65rem',
    },
}));

const ActionButton = styled(IconButton)(({ theme }) => ({
    padding: 4,
    color: theme.custom.palette.text.hint,
    opacity: 0,
    transition: 'opacity 0.2s ease',

    '.MuiBox-root:hover &': {
        opacity: 1,
    },

    '&:hover': {
        color: theme.palette.primary.light,
        backgroundColor: theme.custom.surface.primary10,
    },
}));

const DeleteButton = styled(IconButton)(({ theme }) => ({
    padding: 4,
    color: theme.custom.palette.text.hint,
    opacity: 0,
    transition: 'opacity 0.2s ease',

    '.MuiBox-root:hover &': {
        opacity: 1,
    },

    '&:hover': {
        color: theme.palette.error.main,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
}));

const AddButton = styled(Button)(({ theme }) => ({
    textTransform: 'none',
    fontSize: '0.75rem',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.primary.light,
    padding: theme.spacing(0.5, 1),

    '&:hover': {
        backgroundColor: theme.custom.surface.primary10,
    },
}));

export function CaseDataSection() {
    const { job, addEntity, updateEntity, deleteEntity, updateOwnerEntity } = useCartStore();

    const [entityDialogOpen, setEntityDialogOpen] = useState(false);
    const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const entities = job?.entities ?? [];
    const ownerEntity = job?.owner_entity;

    const handleOpenAddEntity = () => {
        setEditingEntity(null);
        setEntityDialogOpen(true);
    };

    const handleOpenEditEntity = (entity: Entity) => {
        setEditingEntity(entity);
        setEntityDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setEntityDialogOpen(false);
        setEditingEntity(null);
    };

    const handleSaveEntity = async (formData: CreateEntityRequest) => {
        setIsSaving(true);
        try {
            if (editingEntity) {
                // Merge form data with original entity to preserve uid, is_owner, etc.
                const updatedEntity = {
                    ...editingEntity,
                    first_name: formData.first_name ?? null,
                    last_name: formData.last_name ?? null,
                    phone: formData.phone ?? null,
                    email: formData.email ?? null,
                    is_male: formData.is_male ?? null,
                };
                if (editingEntity.is_owner) {
                    await updateOwnerEntity(updatedEntity);
                } else {
                    await updateEntity(editingEntity.uid, updatedEntity);
                }
            } else {
                await addEntity(formData);
            }
            handleCloseDialog();
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEntity = async (entityId: string) => {
        await deleteEntity(entityId);
        setDeleteConfirmId(null);
    };

    const allEntities = ownerEntity ? [ownerEntity, ...entities] : entities;

    return (
        <>
            <SectionContainer>
                <EntitiesHeader>
                    <EntitiesTitle>Entities ({allEntities.length})</EntitiesTitle>
                    <AddButton startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={handleOpenAddEntity}>
                        Add
                    </AddButton>
                </EntitiesHeader>

                {allEntities.length === 0 ? (
                    <EmptyState>No entities defined</EmptyState>
                ) : (
                    <EntitiesList>
                        {allEntities.map((entity) => (
                            <EntityCard key={entity.uid}>
                                <EntityAvatar>
                                    {entity.is_owner ? (
                                        <StarIcon sx={{ fontSize: 16 }} />
                                    ) : (
                                        getEntityInitials(entity)
                                    )}
                                </EntityAvatar>
                                <EntityInfo>
                                    <EntityName>{getEntityDisplayName(entity)}</EntityName>
                                    <EntityDetail>
                                        {entity.phone || entity.email || 'No contact info'}
                                    </EntityDetail>
                                </EntityInfo>
                                {entity.is_owner && (
                                    <OwnerChip
                                        label="Owner"
                                        size="small"
                                        icon={<StarIcon />}
                                    />
                                )}
                                <ActionButton
                                    size="small"
                                    onClick={() => handleOpenEditEntity(entity)}
                                    aria-label="Edit entity"
                                >
                                    <EditIcon sx={{ fontSize: 14 }} />
                                </ActionButton>
                                {!entity.is_owner && (
                                    <DeleteButton
                                        size="small"
                                        onClick={() => setDeleteConfirmId(entity.uid)}
                                        aria-label="Delete entity"
                                    >
                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                    </DeleteButton>
                                )}
                            </EntityCard>
                        ))}
                    </EntitiesList>
                )}
            </SectionContainer>

            <EntityFormDialog
                open={entityDialogOpen}
                onClose={handleCloseDialog}
                onSave={handleSaveEntity}
                isSaving={isSaving}
                initialData={editingEntity ? {
                    first_name: editingEntity.first_name || '',
                    last_name: editingEntity.last_name || '',
                    phone: editingEntity.phone || '',
                    email: editingEntity.email || '',
                    is_male: editingEntity.is_male ?? null,
                } : null}
            />

            <Dialog
                open={!!deleteConfirmId}
                onClose={() => setDeleteConfirmId(null)}
                slotProps={{
                    paper: {
                        sx: {
                            backgroundColor: 'background.paper',
                            color: 'text.primary',
                        },
                    }
                }}
            >
                <DialogTitle>Delete Entity?</DialogTitle>
                <DialogContent>
                    <Typography>Are you sure you want to delete this entity?</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                    <Button
                        onClick={() => deleteConfirmId && handleDeleteEntity(deleteConfirmId)}
                        color="error"
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
