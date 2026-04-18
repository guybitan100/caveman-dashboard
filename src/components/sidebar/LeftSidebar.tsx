import { useCallback, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useJobs } from '../../hooks/useJobs.ts';
import { useSidebarJobs } from '../../hooks/useSidebarJobs.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { SearchBar } from './SearchBar.tsx';
import { NewJobButton } from './NewJobButton.tsx';
import { NewJobDialog } from './NewJobDialog.tsx';
import { VirtualJobsList } from './VirtualJobsList.tsx';
import { JobSummary } from '../../types/job.ts';
import { LoadingState } from './LoadingState.tsx';
import { ErrorState } from './ErrorState.tsx';

const SidebarContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.custom.palette.background.elevated,
    borderRadius: theme.shape.borderRadius * 2,
    overflow: 'hidden',
    border: `1px solid ${theme.custom.border.default}`,
}));

const Header = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.custom.border.default}`,
    background: theme.custom.surface.white5,
    backdropFilter: 'blur(12px)',
}));

const ContentArea = styled(Box)(({ theme }) => ({
    flex: 1,
    minHeight: 0, // Required for flex children to properly shrink and scroll
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: theme.spacing(2),
}));

const DeleteErrorMessage = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    color: theme.palette.error.main,
    backgroundColor: alpha(theme.palette.error.main, 0.1),
    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1, 1.5),
    textAlign: 'center',
}));


interface LeftSidebarProps {
    onJobSelect?: (jobId: string) => void;
}

export function LeftSidebar({ onJobSelect }: LeftSidebarProps) {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');

    // Use the sidebar-specific hook for two separate API calls
    const {
        myDrafts,
        allJobs,
        myDraftsTotal,
        allJobsTotal,
        isLoadingDrafts,
        isLoadingAllJobs,
        isLoadingMoreDrafts,
        isLoadingMoreAllJobs,
        hasMoreDrafts,
        hasMoreAllJobs,
        isError,
        refresh,
        loadMoreDrafts,
        loadMoreAllJobs,
    } = useSidebarJobs(searchQuery);

    // Still use useJobs for job operations (select, create, delete)
    const {
        selectedJob,
        selectJob,
        createJob,
        deleteJob,
    } = useJobs();

    const [isCreating, setIsCreating] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deletingJobIds, setDeletingJobIds] = useState<Set<string>>(new Set());
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleSelectJob = useCallback(
        (job: JobSummary) => {
            selectJob(job);
            onJobSelect?.(job.id);
        },
        [selectJob, onJobSelect]
    );

    const handleDeleteJob = useCallback(
        async (id: string) => {
            setDeleteError(null);
            setDeletingJobIds(prev => new Set(prev).add(id));

            const success = await deleteJob(id);

            if (!success) {
                setDeleteError('Failed to delete job. Please try again.');
                setDeletingJobIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });

                // Auto-clear error after 3 seconds
                setTimeout(() => setDeleteError(null), 3000);
            }
        },
        [deleteJob]
    );

    const handleCreateJob = useCallback(async (name?: string) => {
        if (!user?.email) {
            console.error('User email not available');
            return;
        }
        setIsCreating(true);
        try {
            // Pass name to createJob if provided
            const newJob = await createJob(user.email, name || undefined);
            if (newJob) {
                onJobSelect?.(newJob.id);
                setIsDialogOpen(false);
            }
        } finally {
            setIsCreating(false);
        }
    }, [createJob, onJobSelect, user?.email]);

    const handleOpenDialog = useCallback(() => {
        setIsDialogOpen(true);
    }, []);

    const handleCloseDialog = useCallback(() => {
        setIsDialogOpen(false);
    }, []);

    const handleSearchChange = useCallback(
        (value: string) => {
            setSearchQuery(value);
        },
        [setSearchQuery]
    );

    const renderContent = () => {
        if (isError) {
            return <ErrorState message="Failed to load jobs" onRetry={refresh} />;
        }

        const isInitialLoading = isLoadingDrafts && isLoadingAllJobs && myDrafts.length === 0 && allJobs.length === 0;
        if (isInitialLoading) {
            return <LoadingState />;
        }

        return (
            <VirtualJobsList
                myDrafts={myDrafts}
                allJobs={allJobs}
                myDraftsTotal={myDraftsTotal}
                allJobsTotal={allJobsTotal}
                selectedJobId={selectedJob?.id || null}
                onSelectJob={handleSelectJob}
                onDeleteJob={handleDeleteJob}
                deletingJobIds={deletingJobIds}
                isSearching={searchQuery.length > 0}
                searchQuery={searchQuery}
                isLoadingDrafts={isLoadingDrafts}
                isLoadingAllJobs={isLoadingAllJobs}
                isLoadingMoreDrafts={isLoadingMoreDrafts}
                isLoadingMoreAllJobs={isLoadingMoreAllJobs}
                hasMoreDrafts={hasMoreDrafts}
                hasMoreAllJobs={hasMoreAllJobs}
                onLoadMoreDrafts={loadMoreDrafts}
                onLoadMoreAllJobs={loadMoreAllJobs}
            />
        );
    };

    return (
        <SidebarContainer data-testid="left-sidebar">
            <Header>
                <SearchBar
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search jobs..."
                />
                <NewJobButton onClick={handleOpenDialog} isLoading={isCreating} />
                {deleteError && (
                    <DeleteErrorMessage data-testid="delete-error-message">
                        {deleteError}
                    </DeleteErrorMessage>
                )}
            </Header>
            <ContentArea>{renderContent()}</ContentArea>
            <NewJobDialog
                open={isDialogOpen}
                onClose={handleCloseDialog}
                onCreate={handleCreateJob}
                isCreating={isCreating}
            />
        </SidebarContainer>
    );
}
