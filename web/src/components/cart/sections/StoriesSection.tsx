import { useState } from "react";
import {
    Box,
    Typography,
    Chip,
    IconButton,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import TimelineIcon from "@mui/icons-material/Timeline";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { AccordionSection } from "../AccordionSection.tsx";
import { useCartStore } from "../../../stores/cartStore.ts";
import { StoryType, StoryData, StoryNode } from "../../../types/cart.ts";
import { StoryTypeDialog, getStoryTypeIcon } from "../dialogs/StoryTypeDialog.tsx";
import { StoryFormDialog } from "../dialogs/StoryFormDialog.tsx";
import { formatFullTimestamp } from "../../../utils/date";
import { EmptyStateCompact as EmptyState } from "../../shared/styledComponents";
import type { Theme } from "@mui/material/styles";

const TimelineContainer = styled(Box)(({ theme }) => ({
    position: "relative",
    paddingLeft: 24,
    padding: theme.spacing(1, 2, 2, 4),

    "&::before": {
        content: '""',
        position: "absolute",
        left: 24,
        top: 8,
        bottom: 16,
        width: 2,
        backgroundColor: theme.custom.surface.primary20,
        borderRadius: 1,
    },
}));

const TimelineItem = styled(Box)(({ theme }) => ({
    position: "relative",
    marginBottom: theme.spacing(2),

    "&::before": {
        content: '""',
        position: "absolute",
        left: -12,
        top: 12,
        width: 10,
        height: 10,
        backgroundColor: theme.palette.info.main,
        borderRadius: "50%",
        border: `2px solid ${theme.palette.background.paper}`,
        zIndex: 1,
    },

    "&:last-child": {
        marginBottom: 0,
    },
}));

const StoryCard = styled(Box)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white8,
    borderRadius: theme.shape.borderRadius * 1.5,
    padding: theme.spacing(1.75),
    border: `1px solid ${theme.custom.border.default}`,
    transition: "all 0.2s ease",
    position: "relative",

    "&:hover": {
        backgroundColor: theme.custom.surface.white15,
        borderColor: theme.custom.surface.primary40,

        "& .story-actions": {
            opacity: 1,
        },
    },
}));

const StoryActions = styled(Box)(({ theme }) => ({
    position: "absolute",
    top: theme.spacing(1),
    right: theme.spacing(1),
    display: "flex",
    gap: 2,
    opacity: 0,
    transition: "opacity 0.2s ease",
}));

const SmallIconButton = styled(IconButton)(({ theme }) => ({
    padding: 4,
    color: theme.palette.text.secondary,

    "&:hover": {
        backgroundColor: theme.custom.surface.white10,
        color: theme.palette.text.primary,
    },
}));

const DeleteIconButton = styled(IconButton)(({ theme }) => ({
    padding: 4,
    color: theme.palette.text.secondary,

    "&:hover": {
        backgroundColor: "rgba(239, 68, 68, 0.2)",
        color: theme.palette.error.main,
    },
}));

const StoryTypeChip = styled(Chip)<{ storytype: StoryType }>(({ storytype, theme }) => ({
    height: 22,
    fontSize: "0.6875rem",
    fontWeight: theme.typography.fontWeightBold,
    backgroundColor: getStoryTypeBackground(storytype, theme),
    color: getStoryTypeColor(storytype, theme),
    textTransform: "capitalize",

    "& .MuiChip-label": {
        padding: "0 8px",
    },
}));

const StoryDescription = styled(Typography)(({ theme }) => ({
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1),
    lineHeight: 1.5,
}));

const StoryTimestamp = styled(Typography)(({ theme }) => ({
    fontSize: "0.6875rem",
    color: theme.custom.palette.text.hint,
    marginTop: theme.spacing(1),
}));

const AddStoryButton = styled(Button)(({ theme }) => ({
    margin: theme.spacing(1, 2, 2),
    textTransform: "none",
    fontSize: "0.75rem",
    color: theme.palette.info.main,
    borderColor: theme.custom.surface.primary40,

    "&:hover": {
        borderColor: theme.palette.info.main,
        backgroundColor: theme.custom.surface.primary10,
    },
}));


function getStoryTypeBackground(type: StoryType, theme: Theme): string {
    switch (type) {
        case "location":
            return theme.custom.status.warning.background;
        case "image":
        case "video":
        case "audio":
            return theme.custom.status.info.background;
        case "chat":
        case "chat message":
            return theme.custom.status.success.background;
        case "call":
            return theme.custom.status.converting.background;
        case "email":
            return "rgba(236, 72, 153, 0.1)";
        default:
            return theme.custom.status.draft.background;
    }
}

function getStoryTypeColor(type: StoryType, theme: Theme): string {
    switch (type) {
        case "location":
            return theme.custom.status.warning.main;
        case "image":
        case "video":
        case "audio":
            return theme.custom.status.info.main;
        case "chat":
        case "chat message":
            return theme.custom.status.success.main;
        case "call":
            return theme.custom.status.converting.main;
        case "email":
            return "#EC4899";
        default:
            return theme.custom.status.draft.main;
    }
}

interface StoriesSectionProps {
    embedded?: boolean;
}

export function StoriesSection({ embedded = false }: StoriesSectionProps) {
    const { job, getSectionItemCount, deleteStory } = useCartStore();
    const itemCount = getSectionItemCount("stories");

    // Dialog states
    const [typeDialogOpen, setTypeDialogOpen] = useState(false);
    const [formDialogOpen, setFormDialogOpen] = useState(false);
    const [selectedStoryType, setSelectedStoryType] = useState<StoryType>("location");
    const [selectedStoryIcon, setSelectedStoryIcon] = useState<React.ReactNode>(null);
    const [editingStory, setEditingStory] = useState<StoryData | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Stories are stored as a graph with nodes
    const storyNodes = job?.stories?.nodes ?? [];

    const handleOpenAdd = () => {
        setEditingStory(null);
        setTypeDialogOpen(true);
    };

    const handleSelectType = (type: StoryType, icon: React.ReactNode) => {
        setSelectedStoryType(type);
        setSelectedStoryIcon(icon);
        setTypeDialogOpen(false);
        setFormDialogOpen(true);
    };

    const handleOpenEdit = (story: StoryData) => {
        setEditingStory(story);
        setSelectedStoryType(story.story_type);
        setSelectedStoryIcon(getStoryTypeIcon(story.story_type));
        setFormDialogOpen(true);
    };

    const handleCloseFormDialog = () => {
        setFormDialogOpen(false);
        setEditingStory(null);
    };

    const handleDelete = async (storyId: string) => {
        await deleteStory(storyId);
        setDeleteConfirmId(null);
    };

    const renderContent = () => (
        <>
            {storyNodes.length === 0 ? (
                <EmptyState>
                    <TimelineIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2">No stories added</Typography>
                    <Typography variant="caption" sx={{ mt: 0.5, display: "block" }}>
                        Stories define structured sequences of events
                    </Typography>
                </EmptyState>
            ) : (
                <TimelineContainer>
                    {storyNodes.map((node: StoryNode, index) => {
                        // Story data is nested inside node.data
                        const story = node.data;
                        if (!story) return null;

                        const storyType = story.story_type || "chat";
                        const description = story.user_description;
                        const time = story.time;
                        const storyId = String(story.story_id || `story-${index}`);

                        return (
                            <TimelineItem key={storyId} data-testid={`story-item-${storyId}`}>
                                <StoryCard>
                                    <StoryActions className="story-actions">
                                        <SmallIconButton
                                            size="small"
                                            onClick={() => handleOpenEdit(story)}
                                            aria-label="Edit story"
                                            data-testid={`edit-story-${storyId}`}
                                        >
                                            <EditIcon sx={{ fontSize: 14 }} />
                                        </SmallIconButton>
                                        <DeleteIconButton
                                            size="small"
                                            onClick={() => setDeleteConfirmId(storyId)}
                                            aria-label="Delete story"
                                            data-testid={`delete-story-${storyId}`}
                                        >
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                        </DeleteIconButton>
                                    </StoryActions>
                                    <StoryTypeChip
                                        label={storyType.replace("_", " ")}
                                        storytype={storyType}
                                        size="small"
                                        data-testid={`story-type-${storyType}`}
                                    />

                                    {description && (
                                        <StoryDescription data-testid="story-description">{description}</StoryDescription>
                                    )}

                                    {time && (
                                        <StoryTimestamp data-testid="story-timestamp">{formatFullTimestamp(time)}</StoryTimestamp>
                                    )}
                                </StoryCard>
                            </TimelineItem>
                        );
                    })}
                </TimelineContainer>
            )}

            <AddStoryButton
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleOpenAdd}
                fullWidth
                data-testid="add-story-button"
            >
                Add Story
            </AddStoryButton>

            {/* Story Type Selection Dialog */}
            <StoryTypeDialog
                open={typeDialogOpen}
                onClose={() => setTypeDialogOpen(false)}
                onSelectType={handleSelectType}
            />

            {/* Story Form Dialog */}
            <StoryFormDialog
                open={formDialogOpen}
                storyType={selectedStoryType}
                storyIcon={selectedStoryIcon}
                editingStory={editingStory}
                onClose={handleCloseFormDialog}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={!!deleteConfirmId}
                onClose={() => setDeleteConfirmId(null)}
                slotProps={{
                    paper: {
                        sx: {
                            backgroundColor: "background.paper",
                            color: "text.primary",
                        },
                    }
                }}
            >
                <DialogTitle>Delete Story?</DialogTitle>
                <DialogContent>
                    <Typography>Are you sure you want to delete this story?</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                    <Button
                        onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                        color="error"
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
    if (embedded) {
        return <Box sx={{ pb: 1 }}>{renderContent()}</Box>;
    }

    return (
        <AccordionSection
            sectionKey="stories"
            title="Stories"
            icon={<TimelineIcon />}
            itemCount={itemCount}
        >
            {renderContent()}
        </AccordionSection>
    );
}
