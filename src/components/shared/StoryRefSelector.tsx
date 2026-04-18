import { useCallback, useMemo } from "react";
import {
    FormControl,
    InputLabel,
    OutlinedInput,
    Box,
    Chip,
    Typography,
    MenuItem,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import { StoryType, StoryData } from "../../types/cart";
import { useCartStore } from "../../stores/cartStore";
import { getStoryIcon, getStoryTypeName } from "../../utils/storyIcons";
import { StyledSelect, CreateNewMenuItem } from "./styledComponents";

const StoryMenuItem = styled(MenuItem)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
}));

const StoryChip = styled(Chip)(({ theme }) => ({
    height: 28,
    fontSize: "0.75rem",
    backgroundColor: theme.custom?.surface?.primary15 ?? "rgba(99,102,241,0.15)",
    color: theme.palette.text.primary,
}));

const EmptyMessage = styled(Typography)(({ theme }) => ({
    padding: theme.spacing(1, 2),
    color: theme.palette.text.secondary,
    fontStyle: "italic",
}));

/** Prefix for create-new option values to distinguish from real story IDs */
const CREATE_NEW_PREFIX = '__create_new__';

interface StoryRefSelectorProps {
    /** Field label */
    label: string;
    /** Current selected story ID(s) */
    value: string | string[] | null;
    /** Callback when selection changes */
    onChange: (value: string | string[] | null) => void;
    /** Story types that can be selected */
    storyRefTypes: StoryType[];
    /** Allow multiple selections */
    multiple?: boolean;
    /** Is field required */
    required?: boolean;
    /** Placeholder text */
    placeholder?: string;
    /** Error message */
    error?: string;
    /** Disabled state */
    disabled?: boolean;
    /** Current story ID to exclude from selection */
    excludeStoryId?: string;
    /** Callback to create a new story of the given type */
    onCreateNew?: (storyType: StoryType) => void;
}

/**
 * Get display label for a story
 */
function getStoryLabel(story: StoryData): string {
    // Try user description first
    if (story.user_description) {
        return story.user_description;
    }

    // For location stories, try to get category
    if (story.story_type === "location" && story.category) {
        return `${story.category} Location`;
    }

    // For file stories, try to get file name
    if (story.file && typeof story.file === "object") {
        const file = story.file as { file_name?: string; s3_key?: string };
        if (file.file_name) return file.file_name;
        if (file.s3_key) return file.s3_key.substring(0, 20) + "...";
    }

    // Fallback to story ID
    return story.story_id;
}

export function StoryRefSelector({
    label,
    value,
    onChange,
    storyRefTypes,
    multiple = false,
    required = false,
    placeholder: _placeholder,
    error,
    disabled = false,
    excludeStoryId,
    onCreateNew,
}: StoryRefSelectorProps) {
    const { job } = useCartStore();

    // Filter stories by allowed types - extract data from StoryNode
    const availableStories = useMemo(() => {
        const nodes = job?.stories?.nodes ?? [];
        return nodes
            .map((node) => node.data)
            .filter(
                (story) =>
                    storyRefTypes.includes(story.story_type) &&
                    story.story_id !== excludeStoryId
            );
    }, [job?.stories?.nodes, storyRefTypes, excludeStoryId]);

    // Group stories by type for better organization
    const groupedStories = useMemo(() => {
        const groups: Partial<Record<StoryType, StoryData[]>> = {};
        for (const story of availableStories) {
            if (!groups[story.story_type]) {
                groups[story.story_type] = [];
            }
            groups[story.story_type]!.push(story);
        }
        return groups;
    }, [availableStories]);

    const handleChange = useCallback(
        (event: { target: { value: unknown } }) => {
            const newValue = event.target.value;
            if (multiple) {
                const values = newValue as string[]; const createNewValue = values.find((v) => v?.startsWith(CREATE_NEW_PREFIX));
                if (createNewValue && onCreateNew) {
                    const storyType = createNewValue.replace(CREATE_NEW_PREFIX, '') as StoryType;
                    onCreateNew(storyType);
                    return;
                }
                const filteredValues = values.filter((v) => v != null && !v.startsWith(CREATE_NEW_PREFIX));
                onChange(filteredValues.length > 0 ? filteredValues : null);
            } else {
                const value = newValue as string;
                if (value?.startsWith(CREATE_NEW_PREFIX) && onCreateNew) {
                    const storyType = value.replace(CREATE_NEW_PREFIX, '') as StoryType;
                    onCreateNew(storyType);
                    return;
                }
                onChange(value === "" ? null : value);
            }
        },
        [multiple, onChange, onCreateNew]
    );

    // Get story by ID for rendering chips
    const getStoryById = useCallback(
        (storyId: string) => {
            return availableStories.find((s) => s.story_id === storyId);
        },
        [availableStories]
    );

    const renderValue = useCallback(
        (selected: unknown) => {
            if (multiple) {
                const selectedIds = selected as string[];
                if (!selectedIds || selectedIds.length === 0) {
                    return null; // Don't show placeholder - label handles empty state
                }
                return (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selectedIds.map((storyId) => {
                            const story = getStoryById(storyId);
                            return (
                                <StoryChip
                                    key={storyId}
                                    icon={story ? getStoryIcon(story.story_type) : undefined}
                                    label={story ? getStoryLabel(story) : storyId}
                                    size="small"
                                />
                            );
                        })}
                    </Box>
                );
            } else {
                const selectedId = selected as string;
                if (!selectedId) {
                    return null; // Don't show placeholder - label handles empty state
                }
                const story = getStoryById(selectedId);
                if (story) {
                    return (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            {getStoryIcon(story.story_type)}
                            {getStoryLabel(story)}
                        </Box>
                    );
                }
                return selectedId;
            }
        },
        [multiple, getStoryById]
    );

    const inputLabel = label + (required ? " *" : "");

    // Determine if label should shrink (when there's a value)
    const hasValue = multiple
        ? Array.isArray(value) && value.length > 0
        : !!value;

    return (
        <FormControl fullWidth size="small" error={!!error} disabled={disabled}>
            <InputLabel shrink={hasValue}>{inputLabel}</InputLabel>
            <StyledSelect
                multiple={multiple}
                value={multiple ? (value as string[]) || [] : value || ""}
                notched={hasValue}
                onChange={handleChange}
                input={<OutlinedInput label={inputLabel} />}
                renderValue={renderValue}
                displayEmpty
            >
                {!multiple && (
                    <MenuItem value="">
                        <em>None</em>
                    </MenuItem>
                )}

                {availableStories.length === 0 && !onCreateNew && (
                    <EmptyMessage>
                        No {storyRefTypes.join(" / ")} stories available.
                    </EmptyMessage>
                )}

                {availableStories.length > 0 &&
                    Object.entries(groupedStories).map(([storyType, stories]) => [
                        // Group header
                        <MenuItem
                            key={`header-${storyType}`}
                            disabled
                            sx={{ opacity: 0.7, fontWeight: 600, fontSize: "0.75rem" }}
                        >
                            {storyType.toUpperCase()} STORIES
                        </MenuItem>,
                        // Stories in group
                        ...stories.map((story) => (
                            <StoryMenuItem key={story.story_id} value={story.story_id}>
                                {getStoryIcon(story.story_type)}
                                <Box>
                                    <Typography variant="body2">
                                        {getStoryLabel(story)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {story.story_id}
                                    </Typography>
                                </Box>
                            </StoryMenuItem>
                        )),
                    ])}

                {/* Create new story options */}
                {onCreateNew && storyRefTypes.map((storyType) => (
                    <CreateNewMenuItem
                        key={`create-${storyType}`}
                        value={`${CREATE_NEW_PREFIX}${storyType}`}
                    >
                        <AddIcon fontSize="small" />
                        <Typography variant="body2">
                            Create New {getStoryTypeName(storyType)}
                        </Typography>
                    </CreateNewMenuItem>
                ))}
            </StyledSelect>
            {error && (
                <Typography
                    variant="caption"
                    color="error"
                    sx={{ mt: 0.5, ml: 1.5 }}
                >
                    {error}
                </Typography>
            )}
        </FormControl>
    );
}
