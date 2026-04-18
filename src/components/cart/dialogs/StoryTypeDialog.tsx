import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import VideocamIcon from '@mui/icons-material/Videocam';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import SmsIcon from '@mui/icons-material/Sms';
import CallIcon from '@mui/icons-material/Call';
import EmailIcon from '@mui/icons-material/Email';
import AppsIcon from '@mui/icons-material/Apps';
import ContactsIcon from '@mui/icons-material/Contacts';
import PowerIcon from '@mui/icons-material/Power';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import HistoryIcon from '@mui/icons-material/History';
import CookieIcon from '@mui/icons-material/Cookie';
import ChatIcon from '@mui/icons-material/Chat';
import RouteIcon from '@mui/icons-material/Route';
import { StoryType } from '../../../types/cart';
import {
    WideDialog,
    DialogHeader,
    HeaderTitle,
    CloseButton,
    StyledDialogContent,
    SectionLabel,
} from '../../shared/styledComponents';

const StoryTypeGrid = styled(Box)(({ theme }) => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(1),
}));

const StoryTypeItem = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.white5,
    border: `1px solid ${theme.custom.border.default}`,
    cursor: 'pointer',
    transition: theme.transitions.create(['background-color', 'border-color', 'transform'], {
        duration: theme.transitions.duration.short,
    }),
    '&:hover': {
        backgroundColor: theme.custom.surface.white10,
        borderColor: theme.custom.border.light,
        transform: 'translateY(-1px)',
    },
    '&:active': {
        transform: 'translateY(0)',
    },
}));

const StoryTypeIcon = styled(Box)(({ theme }) => ({
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(0.75),
    backgroundColor: theme.custom.surface.primary15,
    color: theme.custom.status.info.main,
    '& svg': {
        fontSize: 18,
    },
}));

const StoryTypeName = styled(Typography)(({ theme }) => ({
    fontSize: '0.7rem',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.primary,
    textAlign: 'center',
    lineHeight: 1.2,
}));

interface StoryTypeConfig {
    type: StoryType;
    label: string;
    icon: React.ReactNode;
    category: 'location' | 'media' | 'communication' | 'web' | 'group';
}

const STORY_TYPES: StoryTypeConfig[] = [
    // Location
    { type: 'location', label: 'Location', icon: <LocationOnIcon />, category: 'location' },

    // Media (file-based - show coming soon)
    { type: 'image', label: 'Image', icon: <ImageIcon />, category: 'media' },
    { type: 'document', label: 'Document', icon: <DescriptionIcon />, category: 'media' },
    { type: 'video', label: 'Video', icon: <VideocamIcon />, category: 'media' },
    { type: 'audio', label: 'Audio', icon: <AudiotrackIcon />, category: 'media' },

    // Communication
    { type: 'sms/mms', label: 'SMS/MMS', icon: <SmsIcon />, category: 'communication' },
    { type: 'call', label: 'Call', icon: <CallIcon />, category: 'communication' },
    { type: 'email', label: 'Email', icon: <EmailIcon />, category: 'communication' },
    { type: 'app', label: 'App', icon: <AppsIcon />, category: 'communication' },
    { type: 'contact', label: 'Contact', icon: <ContactsIcon />, category: 'communication' },
    { type: 'powering event', label: 'Powering', icon: <PowerIcon />, category: 'communication' },

    // Web
    { type: 'web bookmarks', label: 'Bookmarks', icon: <BookmarksIcon />, category: 'web' },
    { type: 'web history', label: 'History', icon: <HistoryIcon />, category: 'web' },
    { type: 'cookie', label: 'Cookie', icon: <CookieIcon />, category: 'web' },

    // Group stories
    { type: 'chat', label: 'Chat', icon: <ChatIcon />, category: 'group' },
    { type: 'route', label: 'Route', icon: <RouteIcon />, category: 'group' },
];

interface StoryTypeDialogProps {
    open: boolean;
    onClose: () => void;
    onSelectType: (type: StoryType, icon: React.ReactNode) => void;
}

export function StoryTypeDialog({ open, onClose, onSelectType }: StoryTypeDialogProps) {
    const categories = [
        { key: 'location', label: 'Location' },
        { key: 'communication', label: 'Communication' },
        { key: 'web', label: 'Web Activity' },
        { key: 'media', label: 'Media' },
        { key: 'group', label: 'Group Stories' },
    ];

    return (
        <WideDialog open={open} onClose={onClose} data-testid="story-type-dialog">
            <DialogHeader>
                <HeaderTitle>Select Story Type</HeaderTitle>
                <CloseButton onClick={onClose} aria-label="Close dialog">
                    <CloseIcon fontSize="small" />
                </CloseButton>
            </DialogHeader>
            <StyledDialogContent>
                {categories.map(({ key, label }) => {
                    const typesInCategory = STORY_TYPES.filter((t) => t.category === key);
                    if (typesInCategory.length === 0) return null;

                    return (
                        <Box key={key} sx={{ mb: 2 }}>
                            <SectionLabel sx={{ mt: key === 'location' ? 0 : 2 }}>{label}</SectionLabel>
                            <StoryTypeGrid>
                                {typesInCategory.map((storyType) => (
                                    <StoryTypeItem
                                        key={storyType.type}
                                        onClick={() => onSelectType(storyType.type, storyType.icon)}
                                        data-testid={`story-type-option-${storyType.type}`}
                                    >
                                        <StoryTypeIcon>{storyType.icon}</StoryTypeIcon>
                                        <StoryTypeName>{storyType.label}</StoryTypeName>
                                    </StoryTypeItem>
                                ))}
                            </StoryTypeGrid>
                        </Box>
                    );
                })}
            </StyledDialogContent>
        </WideDialog>
    );
}

// Export helper to get icon for a story type
export function getStoryTypeIcon(type: StoryType): React.ReactNode {
    const config = STORY_TYPES.find((t) => t.type === type);
    return config?.icon || <DescriptionIcon />;
}
