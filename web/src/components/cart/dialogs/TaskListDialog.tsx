import { useState } from 'react';
import {
    Box,
    Typography,
    Chip,
    Dialog,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { shimmer, pulse } from '../../../theme/animations';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { EventType, GenerationTask, extractSubtasks, SubtaskInfo } from '../../../types/cart';
import { getFieldConfig, hasConfigurableParams } from '../../../types/taskParams';
import { TaskFormDialog } from './TaskFormDialog';
import { useCartStore } from '../../../stores/cartStore';
import { useJobStore } from '../../../stores/jobStore';
import { useTaskProgressReader } from '../../../hooks/useTaskProgress';
import { GenerationTaskStatus, TASK_STATUS_CONFIG } from '../../../types/taskProgress';
import {
    StyledDialog,
    DialogHeader,
    HeaderContent,
    HeaderTitle,
    CloseButton,
    StyledDialogContent,
    ActionButton,
    DeleteButton,
    EmptyState,
} from '../../shared/styledComponents';

const EventIcon = styled(Box)(({ theme }) => ({
    width: 40,
    height: 40,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.primary15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.custom.status.finalizing.main,
}));

const TaskList = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
}));

const TaskCard = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.custom.border.default}`,
    transition: theme.transitions.create(['background-color', 'border-color'], {
        duration: theme.transitions.duration.short,
    }),
    '&:hover': {
        backgroundColor: theme.custom.surface.white8,
        borderColor: theme.custom.border.light,
    },
}));

const TaskInfo = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
});

const TaskQuantity = styled(Typography)(({ theme }) => ({
    fontSize: '1rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.primary,
}));

const TaskParamsPreview = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
}));

const ParamChip = styled(Chip)(({ theme }) => ({
    height: 20,
    fontSize: '0.7rem',
    backgroundColor: theme.custom.surface.white10,
    color: theme.custom.palette.text.muted,
    border: 'none',
    '& .MuiChip-label': {
        padding: theme.spacing(0, 0.75),
    },
}));

const TaskActions = styled(Box)(({ theme }) => ({
    display: 'flex',
    gap: theme.spacing(0.5),
    marginLeft: theme.spacing(1),
}));

const SubtaskCard = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius,
    border: `1px dashed ${theme.custom.border.default}`,
    opacity: 0.8,
}));

const SubtaskBadge = styled(Chip)(({ theme }) => ({
    height: 20,
    fontSize: '0.65rem',
    backgroundColor: theme.custom.surface.primary15,
    color: theme.custom.palette.status.finalizing.main,
    border: 'none',
    '& .MuiChip-label': {
        padding: theme.spacing(0, 0.75),
    },
}));

const SubtaskParentInfo = styled(Typography)(({ theme }) => ({
    fontSize: '0.7rem',
    color: theme.custom.palette.text.placeholder,
    fontStyle: 'italic',
}));

const AddTaskButton = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    backgroundColor: 'transparent',
    borderRadius: theme.shape.borderRadius,
    border: `2px dashed ${theme.custom.border.medium}`,
    cursor: 'pointer',
    transition: theme.transitions.create(['border-color', 'background-color'], {
        duration: theme.transitions.duration.short,
    }),
    '&:hover': {
        borderColor: theme.custom.status.finalizing.main,
        backgroundColor: theme.custom.surface.white5,
    },
}));

const AddButtonText = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.custom.palette.text.muted,
}));

const TaskProgressContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    marginTop: 8,
});

const TaskProgressBarWrapper = styled(Box)(({ theme }) => ({
    width: '100%',
    height: 6,
    backgroundColor: theme.custom.surface.white10,
    borderRadius: 3,
    overflow: 'hidden',
}));

interface TaskProgressBarFillProps {
    progress: number;
    status: GenerationTaskStatus;
}

const TaskProgressBarFill = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'progress' && prop !== 'status',
})<TaskProgressBarFillProps>(({ progress, status }) => {
    const config = TASK_STATUS_CONFIG[status];
    const isGenerating = status === 'Generating';

    return {
        height: '100%',
        width: `${Math.min(progress * 100, 100)}%`,
        backgroundColor: config.color,
        borderRadius: 'inherit',
        transition: 'width 0.3s ease-out',
        ...(isGenerating && {
            background: `linear-gradient(
                90deg,
                ${config.color} 0%,
                ${config.color}dd 25%,
                ${config.color}ff 50%,
                ${config.color}dd 75%,
                ${config.color} 100%
            )`,
            backgroundSize: '200% 100%',
            animation: `${shimmer} 1.5s ease-in-out infinite`,
        }),
    };
});

const TaskProgressInfo = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
});

interface TaskStatusIndicatorProps {
    status: GenerationTaskStatus;
}

const TaskStatusDot = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'status',
})<TaskStatusIndicatorProps>(({ status }) => {
    const config = TASK_STATUS_CONFIG[status];
    const isGenerating = status === 'Generating';

    return {
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: config.color,
        flexShrink: 0,
        ...(isGenerating && {
            animation: `${pulse} 1s ease-in-out infinite`,
        }),
    };
});

const TaskStatusLabel = styled(Typography, {
    shouldForwardProp: (prop) => prop !== 'status',
})<TaskStatusIndicatorProps>(({ theme, status }) => {
    const config = TASK_STATUS_CONFIG[status];

    return {
        fontSize: '0.7rem',
        fontWeight: theme.typography.fontWeightMedium,
        color: config.color,
    };
});

const TaskProgressPercent = styled(Typography, {
    shouldForwardProp: (prop) => prop !== 'status',
})<TaskStatusIndicatorProps>(({ theme, status }) => {
    const config = TASK_STATUS_CONFIG[status];

    return {
        fontSize: '0.75rem',
        fontWeight: theme.typography.fontWeightBold,
        color: config.color,
        fontVariantNumeric: 'tabular-nums',
    };
});

const TaskStatusChipContainer = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
});

const EmptyText = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    color: theme.custom.palette.text.placeholder,
    marginBottom: theme.spacing(2),
}));

const ConfirmDialog = styled(Dialog)(({ theme }) => ({
    '& .MuiDialog-paper': {
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
        borderRadius: theme.shape.borderRadius * 1.5,
        border: `1px solid ${theme.custom.border.light}`,
        padding: theme.spacing(2.5),
        minWidth: 320,
    },
}));

const ConfirmTitle = styled(Typography)(({ theme }) => ({
    fontSize: '1rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(1),
}));

const ConfirmText = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    color: theme.custom.palette.text.muted,
    marginBottom: theme.spacing(2.5),
}));

const ConfirmActions = styled(Box)(({ theme }) => ({
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
}));

const CancelButton = styled(Box)(({ theme }) => ({
    padding: theme.spacing(0.75, 2),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: 'transparent',
    color: theme.custom.palette.text.muted,
    fontSize: '0.875rem',
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
    transition: theme.transitions.create(['background-color', 'color'], {
        duration: theme.transitions.duration.short,
    }),
    '&:hover': {
        backgroundColor: theme.custom.surface.white10,
        color: theme.palette.text.primary,
    },
}));

const ConfirmDeleteButton = styled(Box)(({ theme }) => ({
    padding: theme.spacing(0.75, 2),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.status.error.background,
    color: theme.palette.error.main,
    fontSize: '0.875rem',
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
    transition: theme.transitions.create(['background-color'], {
        duration: theme.transitions.duration.short,
    }),
    '&:hover': {
        backgroundColor: theme.palette.error.dark,
        color: theme.palette.text.primary,
    },
}));

interface TaskListDialogProps {
    open: boolean;
    eventType: EventType;
    eventIcon: React.ReactNode;
    onClose: () => void;
}

// Job statuses that indicate active generation
const GENERATING_STATUSES = ['Generating', 'Converting', 'Finalizing'];

export function TaskListDialog({
    open,
    eventType,
    eventIcon,
    onClose,
}: TaskListDialogProps) {
    const { job, deleteTask } = useCartStore();
    const { getSelectedJob } = useJobStore();
    const { getProgress: getTaskProgressData } = useTaskProgressReader();
    const selectedJob = getSelectedJob();

    const [formDialogOpen, setFormDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<GenerationTask | null>(null);
    const [deleteConfirmTask, setDeleteConfirmTask] = useState<GenerationTask | null>(null);

    const allTasks = job?.tasks ?? [];
    const tasks = allTasks.filter((t) => t.event_type === eventType);

    // Determine if we should show progress
    const jobStatus = selectedJob?.status ?? null;
    const isGenerating = jobStatus && GENERATING_STATUSES.includes(jobStatus);

    // Extract subtasks for this event type from parent tasks
    const subtaskMap = extractSubtasks(allTasks);
    const subtasks: SubtaskInfo[] = subtaskMap.get(eventType) ?? [];

    const fieldConfig = getFieldConfig(eventType);
    const showParams = hasConfigurableParams(eventType) && fieldConfig.length > 0;

    const formatEventType = (type: EventType): string => {
        return type
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const handleAddTask = () => {
        setEditingTask(null);
        setFormDialogOpen(true);
    };

    const handleEditTask = (task: GenerationTask) => {
        setEditingTask(task);
        setFormDialogOpen(true);
    };

    const handleDeleteTask = async () => {
        if (deleteConfirmTask) {
            await deleteTask(deleteConfirmTask.task_id);
            setDeleteConfirmTask(null);
        }
    };

    const handleFormClose = () => {
        setFormDialogOpen(false);
        setEditingTask(null);
    };

    const renderParamsPreview = (task: GenerationTask) => {
        const previewParams: string[] = [];

        // Check for attachments (subtasks) - these are stored directly on the task, not in params
        const attachments = task.attachments as Array<unknown> | undefined;
        if (Array.isArray(attachments) && attachments.length > 0) {
            previewParams.push(`Attachments: ${attachments.length}`);
        }

        if (!showParams) {
            if (previewParams.length === 0) return null;
            return (
                <TaskParamsPreview>
                    {previewParams.map((param) => (
                        <ParamChip key={param} label={param} size="small" />
                    ))}
                </TaskParamsPreview>
            );
        }

        const params = (task.params ?? task) as Record<string, unknown>;

        for (const field of fieldConfig.slice(0, 4)) {
            // Skip attachments field since we handle it above
            if (field.type === 'subtasks') continue;

            const value = params[field.name];
            if (value !== undefined && value !== null && value !== '') {
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        previewParams.push(`${field.label}: ${value.length}`);
                    }
                } else if (typeof value === 'number') {
                    previewParams.push(`${field.label}: ${value}`);
                }
            }
        }

        if (previewParams.length === 0) return null;

        return (
            <TaskParamsPreview>
                {previewParams.map((param) => (
                    <ParamChip key={param} label={param} size="small" />
                ))}
            </TaskParamsPreview>
        );
    };

    return (
        <>
            <StyledDialog open={open} onClose={onClose}>
                <DialogHeader>
                    <HeaderContent>
                        <EventIcon>{eventIcon}</EventIcon>
                        <HeaderTitle>{formatEventType(eventType)}</HeaderTitle>
                    </HeaderContent>
                    <CloseButton onClick={onClose} aria-label="Close dialog">
                        <CloseIcon fontSize="small" />
                    </CloseButton>
                </DialogHeader>

                <StyledDialogContent>
                    <TaskList>
                        {tasks.length === 0 && subtasks.length === 0 ? (
                            <EmptyState>
                                <EmptyText>No {formatEventType(eventType).toLowerCase()} tasks yet</EmptyText>
                                {!isGenerating && (
                                    <AddTaskButton onClick={handleAddTask}>
                                        <AddIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
                                        <AddButtonText>Add First Task</AddButtonText>
                                    </AddTaskButton>
                                )}
                            </EmptyState>
                        ) : (
                            <>
                                {/* Regular tasks */}
                                {tasks.map((task) => {
                                    // Get progress data for this task
                                    const progressData = isGenerating
                                        ? getTaskProgressData(task.task_id)
                                        : null;
                                    const showProgress = isGenerating && progressData;
                                    const progressPercent = progressData
                                        ? Math.round(progressData.progress * 100)
                                        : 0;

                                    return (
                                        <TaskCard key={task.task_id}>
                                            <TaskInfo>
                                                <TaskQuantity>{task.quantity} items</TaskQuantity>
                                                {renderParamsPreview(task)}

                                                {/* Task progress display */}
                                                {showProgress && progressData && (
                                                    <TaskProgressContainer>
                                                        <TaskProgressBarWrapper>
                                                            <TaskProgressBarFill
                                                                progress={progressData.progress}
                                                                status={progressData.status}
                                                            />
                                                        </TaskProgressBarWrapper>
                                                        <TaskProgressInfo>
                                                            <TaskStatusChipContainer>
                                                                <TaskStatusDot status={progressData.status} />
                                                                <TaskStatusLabel status={progressData.status}>
                                                                    {TASK_STATUS_CONFIG[progressData.status].label}
                                                                </TaskStatusLabel>
                                                            </TaskStatusChipContainer>
                                                            <TaskProgressPercent status={progressData.status}>
                                                                {progressPercent}%
                                                            </TaskProgressPercent>
                                                        </TaskProgressInfo>
                                                    </TaskProgressContainer>
                                                )}
                                            </TaskInfo>
                                            {!isGenerating && (
                                                <TaskActions>
                                                    <ActionButton
                                                        onClick={() => handleEditTask(task)}
                                                        aria-label="Edit task"
                                                    >
                                                        <EditIcon sx={{ fontSize: 18 }} />
                                                    </ActionButton>
                                                    <DeleteButton
                                                        onClick={() => setDeleteConfirmTask(task)}
                                                        aria-label="Delete task"
                                                    >
                                                        <DeleteIcon sx={{ fontSize: 18 }} />
                                                    </DeleteButton>
                                                </TaskActions>
                                            )}
                                        </TaskCard>
                                    );
                                })}

                                {/* Subtasks from parent tasks (read-only) */}
                                {subtasks.map((subtaskInfo) => {
                                    // Get progress data for subtask
                                    const progressData = isGenerating
                                        ? getTaskProgressData(subtaskInfo.task.task_id)
                                        : null;
                                    const showProgress = isGenerating && progressData;
                                    const progressPercent = progressData
                                        ? Math.round(progressData.progress * 100)
                                        : 0;

                                    return (
                                        <SubtaskCard key={subtaskInfo.task.task_id}>
                                            <TaskInfo>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <TaskQuantity>{subtaskInfo.task.quantity} items</TaskQuantity>
                                                    <SubtaskBadge label="Attachment" size="small" />
                                                </Box>
                                                <SubtaskParentInfo>
                                                    From: {formatEventType(subtaskInfo.parentEventType)} task
                                                </SubtaskParentInfo>

                                                {/* Subtask progress display */}
                                                {showProgress && progressData && (
                                                    <TaskProgressContainer>
                                                        <TaskProgressBarWrapper>
                                                            <TaskProgressBarFill
                                                                progress={progressData.progress}
                                                                status={progressData.status}
                                                            />
                                                        </TaskProgressBarWrapper>
                                                        <TaskProgressInfo>
                                                            <TaskStatusChipContainer>
                                                                <TaskStatusDot status={progressData.status} />
                                                                <TaskStatusLabel status={progressData.status}>
                                                                    {TASK_STATUS_CONFIG[progressData.status].label}
                                                                </TaskStatusLabel>
                                                            </TaskStatusChipContainer>
                                                            <TaskProgressPercent status={progressData.status}>
                                                                {progressPercent}%
                                                            </TaskProgressPercent>
                                                        </TaskProgressInfo>
                                                    </TaskProgressContainer>
                                                )}
                                            </TaskInfo>
                                        </SubtaskCard>
                                    );
                                })}

                                {!isGenerating && (
                                    <AddTaskButton onClick={handleAddTask}>
                                        <AddIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
                                        <AddButtonText>Add Another Task</AddButtonText>
                                    </AddTaskButton>
                                )}
                            </>
                        )}
                    </TaskList>
                </StyledDialogContent>
            </StyledDialog>

            <TaskFormDialog
                open={formDialogOpen}
                eventType={eventType}
                eventIcon={eventIcon}
                editingTask={editingTask}
                onClose={handleFormClose}
            />

            <ConfirmDialog
                open={!!deleteConfirmTask}
                onClose={() => setDeleteConfirmTask(null)}
            >
                <ConfirmTitle>Delete Task?</ConfirmTitle>
                <ConfirmText>
                    This will remove {deleteConfirmTask?.quantity} {formatEventType(eventType).toLowerCase()} from your generation.
                </ConfirmText>
                <ConfirmActions>
                    <CancelButton onClick={() => setDeleteConfirmTask(null)}>
                        Cancel
                    </CancelButton>
                    <ConfirmDeleteButton onClick={handleDeleteTask}>
                        Delete
                    </ConfirmDeleteButton>
                </ConfirmActions>
            </ConfirmDialog>
        </>
    );
}
