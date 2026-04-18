import { useCallback, useState } from 'react';
import { Box, Typography, CircularProgress, Collapse, Divider } from '@mui/material';
import { styled } from '@mui/material/styles';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FolderIcon from '@mui/icons-material/Folder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { JobSummary } from '../../types/job.ts';
import { JobCard } from './JobCard.tsx';
import { EmptyState } from '../shared/styledComponents';


const ListContainer = styled(Box)(({ theme }) => ({
    flex: 1,
    minHeight: 0, // Required for flex children to properly shrink and scroll
    height: '100%',
    overflow: 'auto',
    position: 'relative',
    // Custom scrollbar styling
    '&::-webkit-scrollbar': {
        width: 6,
    },
    '&::-webkit-scrollbar-track': {
        backgroundColor: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
        backgroundColor: theme.custom.surface.white20,
        borderRadius: 3,
        '&:hover': {
            backgroundColor: theme.custom.surface.white30,
        },
    },
}));

const ItemsContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
});

const EmptyIcon = styled(Box)({
    fontSize: '2.5rem',
    marginBottom: 12,
    opacity: 0.6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
});

const EmptyTitle = styled(Typography)(({ theme }) => ({
    fontSize: '0.9rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginBottom: 6,
}));

const EmptyDescription = styled(Typography)(({ theme }) => ({
    fontSize: '0.8rem',
    color: theme.custom.palette.text.muted,
    textAlign: 'center',
}));

const LoadingMoreContainer = styled(Box)({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
});

// Simple section header components (non-card style)
interface SectionHeaderProps {
    isExpanded: boolean;
}

const SectionHeader = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'isExpanded',
})<SectionHeaderProps>(({ isExpanded, theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    cursor: 'pointer',
    userSelect: 'none',
    marginBottom: isExpanded ? theme.spacing(0.5) : 0,
    transition: 'opacity 0.2s ease',

    '&:hover': {
        opacity: 0.8,
    },
}));

const TitleWrapper = styled(Box)({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
});

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
}));

const ItemCount = styled(Typography)(({ theme }) => ({
    fontSize: '0.7rem',
    fontWeight: 500,
    color: theme.palette.text.disabled,
}));

interface ChevronIconProps {
    isExpanded: boolean;
}

const ChevronIcon = styled(ExpandMoreIcon, {
    shouldForwardProp: (prop) => prop !== 'isExpanded',
})<ChevronIconProps>(({ isExpanded, theme }) => ({
    color: theme.palette.text.disabled,
    fontSize: 18,
    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.2s ease',
}));

const SectionContainer = styled(Box)({
    marginBottom: 8,
});

const IconWrapper = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
}));

const SectionDivider = styled(Divider)(({ theme }) => ({
    margin: theme.spacing(1, 1.5),
    borderColor: theme.custom.border.default,
}));


interface VirtualJobsListProps {
    myDrafts: JobSummary[];
    allJobs: JobSummary[];
    myDraftsTotal: number;
    allJobsTotal: number;
    selectedJobId: string | null;
    onSelectJob: (job: JobSummary) => void;
    onDeleteJob?: (id: string) => void;
    deletingJobIds?: Set<string>;
    isSearching: boolean;
    searchQuery: string;
    isLoadingDrafts?: boolean;
    isLoadingAllJobs?: boolean;
    isLoadingMoreDrafts?: boolean;
    isLoadingMoreAllJobs?: boolean;
    hasMoreDrafts?: boolean;
    hasMoreAllJobs?: boolean;
    onLoadMoreDrafts?: () => void;
    onLoadMoreAllJobs?: () => void;
}

export function VirtualJobsList({
    myDrafts,
    allJobs,
    myDraftsTotal,
    allJobsTotal,
    selectedJobId,
    onSelectJob,
    onDeleteJob,
    deletingJobIds = new Set(),
    isSearching,
    searchQuery,
    isLoadingDrafts = false,
    isLoadingAllJobs = false,
    isLoadingMoreDrafts = false,
    isLoadingMoreAllJobs = false,
    hasMoreDrafts = false,
    hasMoreAllJobs = false,
    onLoadMoreDrafts,
    onLoadMoreAllJobs,
}: VirtualJobsListProps) {
    const [draftsExpanded, setDraftsExpanded] = useState(true);
    const [allJobsExpanded, setAllJobsExpanded] = useState(true);

    // Handle scroll for infinite loading
    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
        const threshold = 150;

        // When scrolling near bottom, load more from the appropriate section
        if (scrollBottom < threshold) {
            // If All Jobs section is expanded and has more, load more All Jobs
            if (hasMoreAllJobs && !isLoadingMoreAllJobs && onLoadMoreAllJobs && allJobsExpanded) {
                onLoadMoreAllJobs();
            }
            // If All Jobs section is collapsed/empty but Drafts has more, load more Drafts
            else if (hasMoreDrafts && !isLoadingMoreDrafts && onLoadMoreDrafts && draftsExpanded && (!allJobsExpanded || !hasMoreAllJobs)) {
                onLoadMoreDrafts();
            }
        }
    }, [hasMoreAllJobs, isLoadingMoreAllJobs, onLoadMoreAllJobs, allJobsExpanded, hasMoreDrafts, isLoadingMoreDrafts, onLoadMoreDrafts, draftsExpanded]);

    const renderSection = (
        title: string,
        icon: React.ReactNode,
        sectionJobs: JobSummary[],
        totalCount: number,
        isExpanded: boolean,
        onToggle: () => void,
        emptyMessage?: string,
        isLoading?: boolean,
        isLoadingMore?: boolean
    ) => {
        return (
            <SectionContainer key={title}>
                <SectionHeader
                    onClick={onToggle}
                    isExpanded={isExpanded}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggle();
                        }
                    }}
                >
                    <ChevronIcon isExpanded={isExpanded} />
                    <IconWrapper>{icon}</IconWrapper>
                    <TitleWrapper>
                        <SectionTitle>{title}</SectionTitle>
                        <ItemCount>({totalCount})</ItemCount>
                    </TitleWrapper>
                </SectionHeader>
                <Collapse in={isExpanded} timeout={200}>
                    <ItemsContainer>
                        {isLoading && sectionJobs.length === 0 ? (
                            <LoadingMoreContainer>
                                <CircularProgress size={20} sx={(theme) => ({ color: theme.custom.palette.text.placeholder })} />
                            </LoadingMoreContainer>
                        ) : sectionJobs.length === 0 ? (
                            <Box sx={{ py: 2, textAlign: 'center' }}>
                                <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>
                                    {emptyMessage || 'No jobs'}
                                </Typography>
                            </Box>
                        ) : (
                            <>
                                {sectionJobs.map((job) => (
                                    <JobCard
                                        key={job.id}
                                        job={job}
                                        isSelected={job.id === selectedJobId}
                                        isDeleting={deletingJobIds.has(job.id)}
                                        onClick={() => onSelectJob(job)}
                                        onDelete={onDeleteJob}
                                    />
                                ))}
                                {isLoadingMore && (
                                    <LoadingMoreContainer>
                                        <CircularProgress size={20} sx={(theme) => ({ color: theme.custom.palette.text.placeholder })} />
                                    </LoadingMoreContainer>
                                )}
                            </>
                        )}
                    </ItemsContainer>
                </Collapse>
            </SectionContainer>
        );
    };

    // Handle empty states
    const totalJobs = myDrafts.length + allJobs.length;
    const isLoading = isLoadingDrafts || isLoadingAllJobs;

    if (totalJobs === 0 && !isLoading) {
        if (isSearching && searchQuery) {
            return (
                <EmptyState>
                    <EmptyIcon>🔍</EmptyIcon>
                    <EmptyTitle>No jobs found</EmptyTitle>
                    <EmptyDescription>
                        No jobs match "{searchQuery}". Try a different search term.
                    </EmptyDescription>
                </EmptyState>
            );
        }

        return (
            <EmptyState>
                <EmptyIcon>📋</EmptyIcon>
                <EmptyTitle>No jobs yet</EmptyTitle>
                <EmptyDescription>
                    Create your first job to get started
                </EmptyDescription>
            </EmptyState>
        );
    }

    // Always render with section grouping
    return (
        <ListContainer onScroll={handleScroll}>
            {renderSection(
                'My Drafts',
                <EditNoteIcon fontSize="small" />,
                myDrafts,
                myDraftsTotal,
                draftsExpanded,
                () => setDraftsExpanded(!draftsExpanded),
                'No drafts yet',
                isLoadingDrafts,
                isLoadingMoreDrafts
            )}
            <SectionDivider />
            {renderSection(
                'All Jobs',
                <FolderIcon fontSize="small" />,
                allJobs,
                allJobsTotal,
                allJobsExpanded,
                () => setAllJobsExpanded(!allJobsExpanded),
                'No completed jobs yet',
                isLoadingAllJobs,
                isLoadingMoreAllJobs
            )}
        </ListContainer>
    );
}
