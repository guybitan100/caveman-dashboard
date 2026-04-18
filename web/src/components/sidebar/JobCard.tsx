import { useState, MouseEvent } from 'react';
import { Box, Typography, Tooltip, Chip, keyframes, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Skeleton } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import BlockIcon from '@mui/icons-material/Block';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { JobSummary, JobStatus, JOB_STATUS_CONFIG } from '../../types/job.ts';

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
`;

interface CardContainerProps {
    isSelected: boolean;
}

const CardContainer = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'isSelected',
})<CardContainerProps>(({ theme, isSelected }) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative',
    backgroundColor: isSelected
        ? alpha(theme.palette.primary.main, 0.12)
        : theme.custom.surface.white5,
    border: isSelected
        ? `1px solid ${alpha(theme.palette.primary.main, 0.5)}`
        : `1px solid ${theme.custom.border.default}`,
    boxShadow: isSelected
        ? `0 0 12px ${alpha(theme.palette.primary.main, 0.2)}`
        : 'none',
    '&:hover': {
        backgroundColor: isSelected
            ? alpha(theme.palette.primary.main, 0.18)
            : theme.custom.surface.white8,
        borderColor: isSelected
            ? alpha(theme.palette.primary.main, 0.6)
            : theme.custom.border.light,
        boxShadow: isSelected
            ? `0 0 16px ${alpha(theme.palette.primary.main, 0.3)}`
            : `0 4px 12px rgba(0, 0, 0, 0.2)`,
    },
}));

const SelectionIndicator = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: theme.palette.primary.main,
}));

const ContentWrapper = styled(Box)({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
});

const TopRow = styled(Box)({
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
});

const JobName = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    fontWeight: 500,
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    minWidth: 0,
}));

interface StatusBadgeProps {
    statusColor: string;
    isAnimated?: boolean;
}

const StatusBadge = styled(Chip, {
    shouldForwardProp: (prop) => prop !== 'statusColor' && prop !== 'isAnimated',
})<StatusBadgeProps>(({ statusColor, isAnimated }) => ({
    height: 20,
    fontSize: '0.6rem',
    fontWeight: 600,
    backgroundColor: alpha(statusColor, 0.15),
    color: statusColor,
    border: `1px solid ${alpha(statusColor, 0.3)}`,
    flexShrink: 0,
    '& .MuiChip-label': {
        padding: '0 6px',
    },
    '& .MuiChip-icon': {
        fontSize: 12,
        marginLeft: 4,
        marginRight: -2,
        color: statusColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ...(isAnimated && {
        animation: `${pulse} 1.5s ease-in-out infinite`,
    }),
}));

const BottomRow = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
});

const Timestamp = styled(Typography)(({ theme }) => ({
    fontSize: '0.7rem',
    color: theme.custom.palette.text.placeholder,
}));

const MoreButton = styled(IconButton)(({ theme }) => ({
    padding: 4,
    marginRight: -4,
    color: theme.custom.palette.text.muted,
    opacity: 0,
    transition: 'opacity 0.2s ease',
    '.MuiBox-root:hover &': {
        opacity: 1,
    },
    '&:hover': {
        backgroundColor: theme.custom.surface.white10,
        color: theme.palette.text.primary,
    },
}));

const StyledMenu = styled(Menu)(({ theme }) => ({
    '& .MuiPaper-root': {
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.custom.border.light}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        minWidth: 160,
    },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
    fontSize: '0.8rem',
    padding: theme.spacing(1, 2),
    '&:hover': {
        backgroundColor: theme.custom.surface.white5,
    },
    '& .MuiListItemIcon-root': {
        minWidth: 32,
        color: theme.custom.palette.text.muted,
    },
}));

const DeleteMenuItem = styled(StyledMenuItem)(({ theme }) => ({
    color: theme.palette.error.main,
    '&:hover': {
        backgroundColor: alpha(theme.palette.error.main, 0.1),
    },
    '& .MuiListItemIcon-root': {
        color: theme.palette.error.main,
    },
}));

const SkeletonContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.white5,
    border: `1px solid ${theme.custom.border.default}`,
    minHeight: 66,
    height: '100%',
    boxSizing: 'border-box',
}));

const SkeletonContent = styled(Box)({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
});

// Map status to appropriate icon
function getStatusIcon(status: JobStatus) {
    switch (status) {
        case 'Draft':
            return <EditNoteIcon />;
        case 'Pending':
            return <HourglassEmptyIcon />;
        case 'Generating':
        case 'Converting':
        case 'Finalizing':
            return <AutorenewIcon />;
        case 'Done':
            return <CheckIcon />;
        case 'Failed':
            return <ErrorOutlineIcon />;
        case 'Cancelled':
            return <BlockIcon />;
        case 'Deleted':
            return <DeleteOutlineIcon />;
        default:
            return undefined;
    }
}


function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
        return 'Just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    }
}

/**
 * Get the most relevant date for display.
 */
function getDisplayDate(job: JobSummary): string | null {
    return job.timestamp;
}


interface JobCardProps {
    job: JobSummary;
    isSelected: boolean;
    isDeleting?: boolean;
    onClick: () => void;
    onDelete?: (jobId: string) => void;
    style?: React.CSSProperties;
}

export function JobCard({ job, isSelected, isDeleting = false, onClick, onDelete, style }: JobCardProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);

    const displayDate = getDisplayDate(job);
    const statusConfig = JOB_STATUS_CONFIG[job.status];
    const statusIcon = getStatusIcon(job.status);

    const handleMenuOpen = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = (event?: MouseEvent) => {
        event?.stopPropagation();
        setAnchorEl(null);
    };

    const handleDelete = (event: MouseEvent) => {
        event.stopPropagation();
        handleMenuClose();
        onDelete?.(job.id);
    };

    if (isDeleting) {
        return (
            <SkeletonContainer style={{ ...style, height: 66 }}>
                <SkeletonContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Skeleton variant="text" width="60%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                        <Skeleton variant="rounded" width={60} height={20} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                    </Box>
                    <Skeleton variant="text" width="40%" height={14} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                </SkeletonContent>
            </SkeletonContainer>
        );
    }

    return (
        <CardContainer
            isSelected={isSelected}
            onClick={onClick}
            style={style}
            data-testid={`job-card-${job.id}`}
        >
            {isSelected && (
                <SelectionIndicator data-testid="job-selection-indicator">
                    <CheckCircleIcon sx={{ fontSize: 20 }} />
                </SelectionIndicator>
            )}
            <ContentWrapper>
                <TopRow>
                    <Tooltip title={job.name} enterDelay={500} placement="top">
                        <JobName data-testid="job-name" aria-label={job.name}>{job.name}</JobName>
                    </Tooltip>
                    <StatusBadge
                        label={statusConfig.label.toUpperCase()}
                        size="small"
                        icon={statusIcon}
                        statusColor={statusConfig.color}
                        isAnimated={statusConfig.animated}
                        data-testid={`job-status-${job.status.toLowerCase()}`}
                    />
                </TopRow>
                <BottomRow>
                    {displayDate && <Timestamp data-testid="job-timestamp">{formatRelativeTime(displayDate)}</Timestamp>}
                    <MoreButton
                        size="small"
                        onClick={handleMenuOpen}
                        aria-label="Job options"
                        aria-controls={menuOpen ? 'job-menu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={menuOpen ? 'true' : undefined}
                        data-testid="job-options-button"
                    >
                        <MoreVertIcon sx={{ fontSize: 16 }} />
                    </MoreButton>
                </BottomRow>
            </ContentWrapper>

            <StyledMenu
                id="job-menu"
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={() => handleMenuClose()}
                onClick={(e) => e.stopPropagation()}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <DeleteMenuItem onClick={handleDelete} data-testid="delete-job-menu-item">
                    <ListItemIcon>
                        <DeleteOutlineIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Delete</ListItemText>
                </DeleteMenuItem>
            </StyledMenu>
        </CardContainer>
    );
}
