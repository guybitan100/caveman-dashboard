import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Skeleton, CircularProgress, Button } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import { useCartStore } from '../../stores/cartStore.ts';
import { useJobStore, useSelectedJobStatus } from '../../stores/jobStore.ts';
import { jobsApi } from '../../api/jobsApi.ts';
import { CaseDataSection } from './sections/CaseDataSection.tsx';
import { ExtractionPanel } from './sections/ExtractionPanel.tsx';
import { downloadService } from '../../services/downloadService.ts';
import { useDownloadStore } from '../../stores/downloadStore.ts';
import { BrowserWarning } from '../download/BrowserWarning.tsx';


const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

interface SidebarContainerProps {
    isClosing: boolean;
}

const SidebarContainer = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'isClosing',
})<SidebarContainerProps>(({ theme, isClosing }) => ({
    position: 'fixed',
    top: 0,
    right: 0,
    width: 400,
    height: '100vh',
    backgroundColor: theme.palette.background.paper,
    zIndex: 1100, // Below modal level so it doesn't block other UI
    display: 'flex',
    flexDirection: 'column',
    boxShadow: theme.shadows[24],
    animation: `${isClosing ? slideOut : slideIn} 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
    borderLeft: `1px solid ${theme.custom.border.default}`,

    [theme.breakpoints.down('sm')]: {
        width: '100%',
    },
}));

const SidebarHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2, 2.5),
    borderBottom: `1px solid ${theme.custom.border.default}`,
    background: theme.custom.surface.white5,
    backdropFilter: 'blur(12px)',
    position: 'relative',
    zIndex: 1,
}));

const HeaderTitle = styled(Typography)(({ theme }) => ({
    fontSize: '1.125rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.primary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
    color: theme.palette.text.disabled,
    padding: theme.spacing(1),

    '&:hover': {
        backgroundColor: theme.custom.surface.primary10,
        color: theme.palette.primary.light,
    },
}));

const HeaderActions = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

const ActionButton = styled(Button)(({ theme }) => ({
    minWidth: 'auto',
    padding: theme.spacing(0.75, 1.5),
    fontSize: '0.75rem',
    fontWeight: theme.typography.fontWeightBold,
    textTransform: 'none',
    borderRadius: theme.shape.borderRadius,
}));

const GenerateButton = styled(ActionButton)(({ theme }) => ({
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
        backgroundColor: theme.palette.primary.dark,
    },
}));

const DownloadButton = styled(ActionButton)(({ theme }) => ({
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
    '&:hover': {
        backgroundColor: theme.palette.success.dark,
    },
}));

const ProcessingIndicator = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.white10,
    fontSize: '0.7rem',
    color: theme.custom.palette.text.muted,
}));

const SidebarContent = styled(Box)({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
});

const SectionDivider = styled(Box)(({ theme }) => ({
    height: 1,
    backgroundColor: theme.custom.border.default,
}));

const SkeletonContainer = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
}));

const SkeletonSection = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
}));

function CartSkeleton() {
    return (
        <SkeletonContainer>
            <SkeletonSection>
                <Skeleton variant="text" width="40%" height={24} />
                <Skeleton variant="rounded" height={80} />
            </SkeletonSection>

            <SkeletonSection>
                <Skeleton variant="text" width="30%" height={20} />
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                    <Skeleton variant="rounded" height={70} />
                    <Skeleton variant="rounded" height={70} />
                    <Skeleton variant="rounded" height={70} />
                    <Skeleton variant="rounded" height={70} />
                </Box>
            </SkeletonSection>

            <SkeletonSection>
                <Skeleton variant="text" width="25%" height={20} />
                <Skeleton variant="rounded" height={60} />
            </SkeletonSection>
            <SkeletonSection>
                <Skeleton variant="text" width="35%" height={20} />
                <Skeleton variant="rounded" height={60} />
            </SkeletonSection>
        </SkeletonContainer>
    );
}

export function RightSidebar() {
    const { isOpen, closeCart, isLoading, job, error, syncFromJob } = useCartStore();
    const { updateJobStatus } = useJobStore();
    const jobStatus = useSelectedJobStatus();
    const { addDownload, updateProgress, getActiveDownloads } = useDownloadStore();
    const [isClosing, setIsClosing] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [showBrowserWarning, setShowBrowserWarning] = useState(false);

    const isEmpty = !job && !isLoading && !error;
    const hasError = !!error && !isLoading;

    const activeDownloads = getActiveDownloads();
    const hasActiveDownload = activeDownloads.some(d =>
        job?.name && d.fileName.includes(job.name)
    );

    const isProcessing = ['Pending', 'Generating', 'Converting', 'Finalizing'].includes(jobStatus);
    const isDone = jobStatus === 'Done';
    const isDraft = jobStatus === 'Draft';

    const handleGenerate = useCallback(async () => {
        if (!job?.job_id) return;

        setIsActionLoading(true);
        try {
            const updatedJob = await jobsApi.runJob(job.job_id);
            syncFromJob(updatedJob);
            updateJobStatus(job.job_id, updatedJob.status);
        } catch (error) {
            console.error('Failed to start generation:', error);
        } finally {
            setIsActionLoading(false);
        }
    }, [job?.job_id, syncFromJob, updateJobStatus]);

    const handleDownload = useCallback(async () => {
        if (!job?.job_id) return;

        if (!downloadService.isSupported()) {
            setShowBrowserWarning(true);
            return;
        }

        setIsActionLoading(true);
        try {
            const fileName = `${job.name || job.job_id}.ufdr`;

            await downloadService.startDownload(
                job.job_id,
                fileName,
                (progress) => {
                    if (progress.status === 'pending') {
                        addDownload(progress);
                    } else {
                        updateProgress(progress.downloadId, progress);
                    }
                }
            );

        } catch (error) {
            if (error instanceof Error && error.message !== 'Download canceled by user') {
                console.error('Failed to download UFDR:', error);
            }
        } finally {
            setIsActionLoading(false);
        }
    }, [job?.job_id, job?.name, addDownload, updateProgress]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            closeCart();
            setIsClosing(false);
        }, 280); // Slightly less than animation duration
    }, [closeCart]);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleClose]);

    if (!isOpen && !isClosing) {
        return null;
    }

    return (
        <SidebarContainer
            role="complementary"
            aria-label="Data inputs panel"
            isClosing={isClosing}
            data-testid="cart-sidebar"
        >
            <SidebarHeader>
                <HeaderTitle sx={{ textTransform: 'capitalize' }} data-testid="cart-job-name">
                    {job?.name}
                </HeaderTitle>
                <HeaderActions>
                    {job && (
                        <>
                            {isDraft && (
                                <GenerateButton
                                    onClick={handleGenerate}
                                    disabled={isActionLoading}
                                    startIcon={isActionLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
                                    data-testid="generate-button"
                                >
                                    Generate
                                </GenerateButton>
                            )}
                            {isProcessing && (
                                <ProcessingIndicator data-testid="processing-indicator">
                                    <CircularProgress size={12} color="inherit" />
                                    {jobStatus}...
                                </ProcessingIndicator>
                            )}
                            {isDone && (
                                <DownloadButton
                                    onClick={handleDownload}
                                    disabled={isActionLoading || hasActiveDownload}
                                    startIcon={isActionLoading ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 16 }} />}
                                    data-testid="download-button"
                                >
                                    {hasActiveDownload ? 'Downloading...' : 'Download'}
                                </DownloadButton>
                            )}
                        </>
                    )}
                    <CloseButton
                        onClick={handleClose}
                        aria-label="Close cart"
                        data-testid="close-cart-button"
                    >
                        <CloseIcon />
                    </CloseButton>
                </HeaderActions>
            </SidebarHeader>

            <SidebarContent>
                {isLoading ? (
                    <CartSkeleton />
                ) : hasError ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="error" sx={{ mb: 1 }}>⚠️ Failed to load job</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {error}
                        </Typography>
                        <Typography variant="body2" sx={(theme) => ({ mt: 2, color: theme.custom.palette.text.hint })}>
                            Try selecting the job again or refresh the page
                        </Typography>
                    </Box>
                ) : isEmpty ? (
                    <Box sx={{ p: 4, textAlign: 'center', color: 'text.disabled' }}>
                        <Typography color="inherit">No job selected</Typography>
                        <Typography variant="body2" sx={(theme) => ({ mt: 1, color: theme.custom.palette.text.hint })}>
                            Select a draft job to edit its data inputs
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <CaseDataSection />
                        <SectionDivider />
                        <ExtractionPanel />
                    </>
                )}
            </SidebarContent>

            <BrowserWarning
                open={showBrowserWarning}
                onClose={() => setShowBrowserWarning(false)}
            />
        </SidebarContainer>
    );
}
