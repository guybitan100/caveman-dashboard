import { useState } from 'react';
import {
    Box,
    Typography,
    Dialog,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { pulse } from '../../../theme/animations';
import AddIcon from '@mui/icons-material/Add';
import CasinoIcon from '@mui/icons-material/Casino';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PhoneIcon from '@mui/icons-material/Phone';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import ChatIcon from '@mui/icons-material/Chat';
import ContactsIcon from '@mui/icons-material/Contacts';
import CookieIcon from '@mui/icons-material/Cookie';
import EmailIcon from '@mui/icons-material/Email';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PasswordIcon from '@mui/icons-material/Password';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import HistoryIcon from '@mui/icons-material/History';
import AppsIcon from '@mui/icons-material/Apps';
import DescriptionIcon from '@mui/icons-material/Description';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RouteIcon from '@mui/icons-material/Route';
import NoteIcon from '@mui/icons-material/Note';
import ArchiveIcon from '@mui/icons-material/Archive';
import SmsIcon from '@mui/icons-material/Sms';
import CellTowerIcon from '@mui/icons-material/CellTower';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import DevicesIcon from '@mui/icons-material/Devices';
import PersonIcon from '@mui/icons-material/Person';
import PowerIcon from '@mui/icons-material/Power';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useCartStore } from '../../../stores/cartStore';
import { useJobStore } from '../../../stores/jobStore';
import { useTaskProgress } from '../../../hooks/useTaskProgress';
import { EventType, extractSubtasks } from '../../../types/cart';
import { TASK_STATUS_CONFIG } from '../../../types/taskProgress';
import { TaskListDialog } from '../dialogs/TaskListDialog';
import { TaskFormDialog } from '../dialogs/TaskFormDialog';
import { RandomEventsDialog } from '../dialogs/RandomEventsDialog';

const GridContainer = styled(Box)(({ theme }) => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
}));

const EventCard = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: theme.spacing(1.5, 1.25),
    backgroundColor: theme.custom.surface.white8,
    borderRadius: theme.shape.borderRadius + 2,
    border: `1px solid ${theme.custom.border.default}`,
    cursor: 'pointer',
    transition: theme.transitions.create(['background-color', 'border-color', 'transform'], {
        duration: theme.transitions.duration.short,
    }),
    position: 'relative',
    minHeight: 70,
    overflow: 'hidden',

    '&:hover': {
        backgroundColor: theme.custom.surface.white15,
        borderColor: theme.custom.palette.status.finalizing.main,
        transform: 'translateY(-2px)',

        '& .action-buttons': {
            opacity: 1,
        },
    },
}));

// Progress border overlay - wraps around the card
interface ProgressBorderProps {
    progress: number;
    color: string;
    isAnimated?: boolean;
}

const ProgressBorder = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'progress' && prop !== 'color' && prop !== 'isAnimated',
})<ProgressBorderProps>(({ theme, progress, color, isAnimated }) => {
    // Create a conic gradient that shows progress around the border
    // Full 360deg sweep around the card
    const progressPercent = Math.min(progress * 100, 100);
    const progressDeg = progressPercent * 3.6; // 360deg for full border
    const borderRadius = theme.shape.borderRadius + 2;

    // Create gradient color stops with a visible start (20%) and bright leading edge
    const gradientStops = `
        ${color}44 0deg,
        ${color}66 ${progressDeg * 0.25}deg,
        ${color}99 ${progressDeg * 0.5}deg,
        ${color}cc ${progressDeg * 0.75}deg,
        ${color} ${progressDeg}deg,
        transparent ${progressDeg}deg
    `;

    return {
        position: 'absolute',
        inset: 0,
        borderRadius,
        padding: 3,
        background: `conic-gradient(from 225deg, ${gradientStops})`,
        WebkitMask: `
            linear-gradient(#fff 0 0) content-box, 
            linear-gradient(#fff 0 0)
        `,
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        pointerEvents: 'none',
        transition: 'background 0.3s ease-out',
        ...(isAnimated && {
            '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                borderRadius,
                padding: 3,
                background: `conic-gradient(
                    from 225deg,
                    transparent 0deg,
                    ${color}60 ${Math.max(0, progressDeg - 40)}deg,
                    ${color}ff ${Math.max(0, progressDeg - 15)}deg,
                    ${color} ${progressDeg}deg,
                    transparent ${progressDeg}deg
                )`,
                WebkitMask: `
                    linear-gradient(#fff 0 0) content-box, 
                    linear-gradient(#fff 0 0)
                `,
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                animation: `${pulse} 1.5s ease-in-out infinite`,
                opacity: 0.6,
            },
        }),
    };
});


const ProgressBadge = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ theme, color }) => ({
    position: 'absolute',
    bottom: 4,
    right: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: `${color}20`,
    backdropFilter: 'blur(4px)',
}));

interface ProgressBadgeDotProps {
    color: string;
    isAnimated?: boolean;
}

const ProgressBadgeDot = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'color' && prop !== 'isAnimated',
})<ProgressBadgeDotProps>(({ color, isAnimated }) => ({
    width: 5,
    height: 5,
    borderRadius: '50%',
    backgroundColor: color,
    ...(isAnimated && {
        animation: `${pulse} 1s ease-in-out infinite`,
    }),
}));

const ProgressBadgeText = styled(Typography, {
    shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ theme, color }) => ({
    fontSize: '0.55rem',
    fontWeight: theme.typography.fontWeightBold,
    color: color,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
}));

const EventIconWrapper = styled(Box)(({ theme }) => ({
    color: theme.custom.palette.status.finalizing.main,
    marginBottom: theme.spacing(0.5),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
}));

const EventLabel = styled(Typography)(({ theme }) => ({
    fontSize: theme.typography.caption.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.custom.palette.text.placeholder,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    textAlign: 'center',
    marginBottom: theme.spacing(0.25),
}));

const EventCount = styled(Typography)(({ theme }) => ({
    fontSize: '1.5rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.primary,
    lineHeight: 1,
}));

const TaskCountBadge = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: theme.spacing(0.5),
    right: theme.spacing(0.5),
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.custom.surface.primary40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(0, 0.5),
}));

const TaskCountText = styled(Typography)(({ theme }) => ({
    fontSize: '0.65rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.primary,
}));

const AddEventCard = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(1.5, 1.25),
    backgroundColor: 'transparent',
    borderRadius: theme.shape.borderRadius + 2,
    border: `2px dashed ${theme.custom.border.medium}`,
    cursor: 'pointer',
    transition: theme.transitions.create(['border-color', 'background-color'], {
        duration: theme.transitions.duration.short,
    }),
    minHeight: 70,

    '&:hover': {
        borderColor: theme.custom.palette.status.finalizing.main,
        backgroundColor: theme.custom.surface.white5,
    },
}));

const AddLabel = styled(Typography)(({ theme }) => ({
    fontSize: theme.typography.caption.fontSize,
    color: theme.custom.palette.text.placeholder,
    marginTop: theme.spacing(1),
}));

const SectionHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0, 2.5),
    marginBottom: theme.spacing(1),
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontSize: theme.typography.caption.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: theme.custom.palette.text.placeholder,
}));

const EVENT_TYPE_ICONS: Record<EventType, React.ReactNode> = {
    'chat messages': <ChatIcon sx={{ fontSize: 20 }} />,
    'contacts': <ContactsIcon sx={{ fontSize: 20 }} />,
    'images': <ImageIcon sx={{ fontSize: 20 }} />,
    'videos': <VideoFileIcon sx={{ fontSize: 20 }} />,
    'audios': <AudioFileIcon sx={{ fontSize: 20 }} />,
    'calls': <PhoneIcon sx={{ fontSize: 20 }} />,
    'locations': <LocationOnIcon sx={{ fontSize: 20 }} />,
    'cookies': <CookieIcon sx={{ fontSize: 20 }} />,
    'passwords': <PasswordIcon sx={{ fontSize: 20 }} />,
    'web bookmarks': <BookmarkIcon sx={{ fontSize: 20 }} />,
    'web history': <HistoryIcon sx={{ fontSize: 20 }} />,
    'emails': <EmailIcon sx={{ fontSize: 20 }} />,
    'installed applications': <AppsIcon sx={{ fontSize: 20 }} />,
    'documents': <DescriptionIcon sx={{ fontSize: 20 }} />,
    'notifications': <NotificationsIcon sx={{ fontSize: 20 }} />,
    'journeys': <RouteIcon sx={{ fontSize: 20 }} />,
    'notes': <NoteIcon sx={{ fontSize: 20 }} />,
    'carved strings': <TextSnippetIcon sx={{ fontSize: 20 }} />,
    'archives': <ArchiveIcon sx={{ fontSize: 20 }} />,
    'sms/mms': <SmsIcon sx={{ fontSize: 20 }} />,
    'calendar entry': <CalendarMonthIcon sx={{ fontSize: 20 }} />,
    'cell tower': <CellTowerIcon sx={{ fontSize: 20 }} />,
    'credit card': <CreditCardIcon sx={{ fontSize: 20 }} />,
    'recognized device': <DevicesIcon sx={{ fontSize: 20 }} />,
    'user account': <PersonIcon sx={{ fontSize: 20 }} />,
    'powering event': <PowerIcon sx={{ fontSize: 20 }} />,
    'financial account': <AccountBalanceIcon sx={{ fontSize: 20 }} />,
};

const ALL_EVENT_TYPES: EventType[] = [
    'chat messages',
    'contacts',
    'images',
    'videos',
    'audios',
    'calls',
    'locations',
    'cookies',
    'passwords',
    'web bookmarks',
    'web history',
    'emails',
    'installed applications',
    'documents',
    'notifications',
    'journeys',
    'notes',
    'carved strings',
    'archives',
    'sms/mms',
    'calendar entry',
    'cell tower',
    'credit card',
    'recognized device',
    'user account',
    'powering event',
    'financial account',
];

interface EventTypeData {
    eventType: EventType;
    taskCount: number;
    totalItems: number;
    subtaskCount: number;
    subtaskItems: number;
    taskIds: string[];
}


const GENERATING_STATUSES = ['Generating', 'Converting', 'Finalizing'];

export function EventsGrid() {
    const { job } = useCartStore();
    const { getSelectedJob } = useJobStore();
    const selectedJob = getSelectedJob();

    const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
    const [newEventType, setNewEventType] = useState<EventType | null>(null);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [randomDialogOpen, setRandomDialogOpen] = useState(false);

    const tasks = job?.tasks ?? [];
    const subtaskMap = extractSubtasks(tasks);

    // Determine if we should show progress (job is generating)
    const jobStatus = selectedJob?.status ?? null;
    const isGenerating = jobStatus && GENERATING_STATUSES.includes(jobStatus);

    // Use task progress hook for polling
    const { getEventTypeProgress } = useTaskProgress(
        job?.job_id ?? null,
        jobStatus,
        tasks,
        { enabled: isGenerating ?? false }
    );

    const eventTypeData: EventTypeData[] = ALL_EVENT_TYPES.map((eventType) => {
        const typeTasks = tasks.filter((t) => t.event_type === eventType);
        const subtasks = subtaskMap.get(eventType) ?? [];
        return {
            eventType,
            taskCount: typeTasks.length,
            totalItems: typeTasks.reduce((sum, t) => sum + t.quantity, 0),
            subtaskCount: subtasks.length,
            subtaskItems: subtasks.reduce((sum, s) => sum + s.task.quantity, 0),
            taskIds: typeTasks.map((t) => t.task_id),
        };
    });

    const eventTypesWithTasks = eventTypeData.filter((d) => d.taskCount > 0 || d.subtaskCount > 0);
    const eventTypesWithoutTasks = eventTypeData.filter((d) => d.taskCount === 0 && d.subtaskCount === 0);

    const formatEventType = (type: EventType): string => {
        return type
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const handleCardClick = (eventType: EventType) => {
        setSelectedEventType(eventType);
    };

    const handleCloseDialog = () => {
        setSelectedEventType(null);
    };

    const handleAddNewEventType = () => {
        setAddDialogOpen(true);
    };

    return (
        <>
            <SectionHeader>
                <SectionTitle>Events & Files</SectionTitle>
            </SectionHeader>

            <GridContainer>
                {eventTypesWithTasks.map(({ eventType, taskCount, totalItems, subtaskCount, subtaskItems, taskIds }) => {
                    const combinedTaskCount = taskCount + subtaskCount;
                    const combinedItems = totalItems + subtaskItems;

                    // Get progress for this event type's tasks
                    const typeTasks = tasks.filter((t) => t.event_type === eventType);
                    const progressData = isGenerating
                        ? getEventTypeProgress(eventType, typeTasks)
                        : null;

                    const showProgress = isGenerating && progressData && taskIds.length > 0;
                    const progressPercent = progressData ? Math.round(progressData.progress * 100) : 0;

                    return (
                        <EventCard
                            key={eventType}
                            onClick={() => handleCardClick(eventType)}
                        >
                            {/* Progress border when job is generating */}
                            {showProgress && progressData && (
                                <>
                                    <ProgressBorder
                                        progress={progressData.progress}
                                        color={TASK_STATUS_CONFIG[progressData.status].color}
                                        isAnimated={progressData.status === 'Generating'}
                                    />
                                    <ProgressBadge color={TASK_STATUS_CONFIG[progressData.status].color}>
                                        <ProgressBadgeDot
                                            color={TASK_STATUS_CONFIG[progressData.status].color}
                                            isAnimated={progressData.status === 'Generating'}
                                        />
                                        <ProgressBadgeText color={TASK_STATUS_CONFIG[progressData.status].color}>
                                            {progressPercent}%
                                        </ProgressBadgeText>
                                    </ProgressBadge>
                                </>
                            )}
                            {combinedTaskCount > 1 && (
                                <TaskCountBadge>
                                    <TaskCountText>{combinedTaskCount}</TaskCountText>
                                </TaskCountBadge>
                            )}
                            <EventIconWrapper>
                                {EVENT_TYPE_ICONS[eventType]}
                            </EventIconWrapper>
                            <EventLabel>{formatEventType(eventType)}</EventLabel>
                            <EventCount>{combinedItems}</EventCount>
                        </EventCard>
                    );
                })}
                <AddEventCard onClick={handleAddNewEventType}>
                    <AddIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                    <AddLabel>Add Event</AddLabel>
                </AddEventCard>
                <AddEventCard onClick={() => setRandomDialogOpen(true)}>
                    <CasinoIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                    <AddLabel>Generate Random</AddLabel>
                </AddEventCard>
            </GridContainer>

            {selectedEventType && (
                <TaskListDialog
                    open={!!selectedEventType}
                    eventType={selectedEventType}
                    eventIcon={EVENT_TYPE_ICONS[selectedEventType]}
                    onClose={handleCloseDialog}
                />
            )}

            <AddEventTypeDialog
                open={addDialogOpen}
                availableEventTypes={eventTypesWithoutTasks.map((d) => d.eventType)}
                onClose={() => setAddDialogOpen(false)}
                onSelect={(eventType) => {
                    setAddDialogOpen(false);
                    setNewEventType(eventType);
                }}
            />
            {newEventType && (
                <TaskFormDialog
                    open={!!newEventType}
                    eventType={newEventType}
                    eventIcon={EVENT_TYPE_ICONS[newEventType]}
                    editingTask={null}
                    onClose={() => setNewEventType(null)}
                />
            )}

            <RandomEventsDialog
                open={randomDialogOpen}
                onClose={() => setRandomDialogOpen(false)}
            />
        </>
    );
}

const AddEventTypeDialogStyled = styled(Dialog)(({ theme }) => ({
    '& .MuiDialog-paper': {
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
        borderRadius: theme.shape.borderRadius * 2,
        border: `1px solid ${theme.custom.border.light}`,
        minWidth: 400,
        maxWidth: 480,
    },
}));

const DialogHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2.5, 3),
    borderBottom: `1px solid ${theme.custom.border.default}`,
}));

const DialogTitle = styled(Typography)(({ theme }) => ({
    fontSize: '1.125rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.primary,
}));

const EventTypeList = styled(Box)(({ theme }) => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    maxHeight: 360,
    overflowY: 'auto',
    '&::-webkit-scrollbar': {
        width: 6,
    },
    '&::-webkit-scrollbar-track': {
        backgroundColor: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
        backgroundColor: theme.custom.surface.white15,
        borderRadius: 3,
    },
}));

const EventTypeOption = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(1.5, 1),
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.custom.border.default}`,
    cursor: 'pointer',
    transition: theme.transitions.create(['background-color', 'border-color', 'transform'], {
        duration: theme.transitions.duration.short,
    }),
    minHeight: 70,
    '&:hover': {
        backgroundColor: theme.custom.surface.white10,
        borderColor: theme.custom.status.finalizing.main,
        transform: 'translateY(-2px)',
    },
}));

const EventTypeOptionIcon = styled(Box)(({ theme }) => ({
    color: theme.custom.status.finalizing.main,
    marginBottom: theme.spacing(0.5),
}));

const EventTypeOptionLabel = styled(Typography)(({ theme }) => ({
    fontSize: '0.65rem',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.custom.palette.text.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    textAlign: 'center',
}));

interface AddEventTypeDialogProps {
    open: boolean;
    availableEventTypes: EventType[];
    onClose: () => void;
    onSelect: (eventType: EventType) => void;
}

function AddEventTypeDialog({
    open,
    availableEventTypes,
    onClose,
    onSelect,
}: AddEventTypeDialogProps) {
    const formatEventType = (type: EventType): string => {
        return type
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    return (
        <AddEventTypeDialogStyled open={open} onClose={onClose}>
            <DialogHeader>
                <DialogTitle>Add Event Type</DialogTitle>
            </DialogHeader>
            <EventTypeList>
                {availableEventTypes.map((eventType) => (
                    <EventTypeOption
                        key={eventType}
                        onClick={() => onSelect(eventType)}
                    >
                        <EventTypeOptionIcon>
                            {EVENT_TYPE_ICONS[eventType]}
                        </EventTypeOptionIcon>
                        <EventTypeOptionLabel>
                            {formatEventType(eventType)}
                        </EventTypeOptionLabel>
                    </EventTypeOption>
                ))}
            </EventTypeList>
        </AddEventTypeDialogStyled>
    );
}
