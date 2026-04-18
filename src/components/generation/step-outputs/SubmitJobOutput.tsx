import { styled } from '@mui/material/styles';
import {
    Box,
    Typography,
    Chip,
    Collapse,
    LinearProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { JobStatus, SubmittedJob } from '@/types';
import { ActionButton } from '../../shared/styledComponents';

const Container = styled(Box)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius * 1.5,
    padding: theme.spacing(2.5),
    border: `1px solid ${theme.custom.border.default}`,
}));

const Header = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
}));

const SuccessBanner = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2.5),
    backgroundColor: theme.custom.status.success.background,
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px solid ${theme.palette.success.main}30`,
    marginBottom: theme.spacing(2.5),
}));

const SuccessIcon = styled(Box)(({ theme }) => ({
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: theme.custom.status.success.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& svg': {
        fontSize: 28,
        color: theme.palette.success.main,
    },
}));

const SubmissionList = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
}));

const SubmissionCard = styled(Box)<{ success: boolean }>(({ theme, success }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.75),
    backgroundColor: success ? theme.custom.status.success.background : theme.custom.status.error.background,
    borderRadius: theme.shape.borderRadius * 1.25,
    border: success ? `1px solid ${theme.palette.success.main}30` : `1px solid ${theme.palette.error.main}30`,
}));

const StatusIcon = styled(Box)<{ success: boolean }>(({ theme, success }) => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: success ? theme.custom.status.success.background : theme.custom.status.error.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& svg': {
        fontSize: 18,
        color: success ? theme.palette.success.main : theme.palette.error.dark,
    },
}));

const SubmissionInfo = styled(Box)({
    flex: 1,
});

const JobIdText = styled(Typography)(({ theme }) => ({
    fontSize: '0.9rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
}));

const EntityName = styled(Typography)(({ theme }) => ({
    fontSize: '0.8rem',
    color: theme.custom.palette.text.placeholder,
}));

const SummaryStats = styled(Box)({
    display: 'flex',
    gap: 12,
    marginBottom: 20,
});

const StatChip = styled(Chip)<{ statusVariant: 'success' | 'error' }>(({ theme, statusVariant }) => ({
    backgroundColor: statusVariant === 'success' ? theme.custom.status.success.background : theme.custom.status.error.background,
    color: statusVariant === 'success' ? theme.palette.success.main : theme.palette.error.dark,
    border: statusVariant === 'success' ? `1px solid ${theme.palette.success.main}30` : `1px solid ${theme.palette.error.dark}30`,
    fontWeight: 600,
}));

interface SubmitJobOutputProps {
    submittedJobs?: SubmittedJob[];
    isSubmitted: boolean;
    isEditing?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

function isJobSuccess(status: JobStatus): boolean {
    return status === 'Done';
}

function isJobInProgress(status: JobStatus): boolean {
    return ['Pending', 'Generating', 'Converting', 'Finalizing'].includes(status);
}

function getStatusColor(status: JobStatus): { bg: string; border: string; text: string } {
    // These colors are theme-dependent, but we use static values for the lookup
    // The actual colors will be applied via theme in components
    if (isJobSuccess(status)) {
        return { bg: 'rgba(74, 222, 128, 0.05)', border: 'rgba(74, 222, 128, 0.2)', text: '#4ade80' };
    }
    if (isJobInProgress(status)) {
        return { bg: 'rgba(251, 191, 36, 0.05)', border: 'rgba(251, 191, 36, 0.2)', text: '#fbbf24' };
    }
    return { bg: 'rgba(239, 68, 68, 0.05)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' };
}

export function SubmitJobOutput({
    submittedJobs = [],
    isSubmitted,
    isExpanded = false,
    onToggleExpand,
}: SubmitJobOutputProps) {
    const jobs = submittedJobs.length > 0 ? submittedJobs : [];
    const successCount = jobs.filter(j => isJobSuccess(j.status)).length;
    const failedCount = jobs.filter(j => !isJobSuccess(j.status) && !isJobInProgress(j.status)).length;
    const inProgressCount = jobs.filter(j => isJobInProgress(j.status)).length;
    const allSuccess = jobs.length > 0 && jobs.every(j => isJobSuccess(j.status));

    const renderSubmission = (job: SubmittedJob) => {
        const colors = getStatusColor(job.status);
        const isSuccess = isJobSuccess(job.status);
        const inProgress = isJobInProgress(job.status);

        return (
            <SubmissionCard key={job.job_id} success={isSuccess}>
                <StatusIcon success={isSuccess}>
                    {isSuccess ? <CheckCircleIcon /> : inProgress ? <HourglassEmptyIcon /> : <ErrorIcon />}
                </StatusIcon>
                <SubmissionInfo>
                    <JobIdText>{job.job_id}</JobIdText>
                    <EntityName>{job.phone_entity_name}</EntityName>
                </SubmissionInfo>
                <Chip
                    label={job.status}
                    size="small"
                    sx={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        fontSize: '0.7rem',
                    }}
                />
            </SubmissionCard>
        );
    };

    return (
        <Container>
            <Header>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CloudUploadIcon sx={(theme) => ({ color: theme.palette.secondary.main, fontSize: 20 })} />
                    <Typography sx={(theme) => ({ fontWeight: 600, color: theme.palette.text.primary })}>
                        Job Submission Status
                    </Typography>
                </Box>
                {onToggleExpand && (
                    <ActionButton onClick={onToggleExpand} size="small">
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ActionButton>
                )}
            </Header>

            <Collapse in={isExpanded}>
                {isSubmitted && allSuccess && (
                    <SuccessBanner>
                        <SuccessIcon>
                            <CheckCircleIcon />
                        </SuccessIcon>
                        <Box>
                            <Typography sx={(theme) => ({ fontWeight: 600, color: theme.palette.success.main, fontSize: '1.1rem' })}>
                                All Jobs Completed Successfully!
                            </Typography>
                            <Typography sx={(theme) => ({ color: `${theme.palette.success.main}b3`, fontSize: '0.875rem' })}>
                                Your UFDR files have been generated.
                            </Typography>
                        </Box>
                    </SuccessBanner>
                )}

                {!isSubmitted && jobs.length === 0 && (
                    <Box sx={{ marginBottom: 3 }}>
                        <Typography sx={(theme) => ({ color: theme.custom.palette.text.muted, marginBottom: 2 })}>
                            Preparing to submit jobs...
                        </Typography>
                        <LinearProgress
                            sx={(theme) => ({
                                backgroundColor: theme.custom.surface.orange20,
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: theme.palette.secondary.main,
                                },
                            })}
                        />
                    </Box>
                )}

                {inProgressCount > 0 && (
                    <Box sx={{ marginBottom: 3 }}>
                        <Typography sx={(theme) => ({ color: theme.custom.palette.text.muted, marginBottom: 2 })}>
                            {inProgressCount} job{inProgressCount > 1 ? 's' : ''} in progress...
                        </Typography>
                        <LinearProgress
                            sx={(theme) => ({
                                backgroundColor: `${theme.palette.warning.light}33`,
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: theme.palette.warning.light,
                                },
                            })}
                        />
                    </Box>
                )}

                {jobs.length > 0 && (
                    <>
                        <SummaryStats>
                            <StatChip
                                statusVariant="success"
                                icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                                label={`${successCount} Done`}
                            />
                            {failedCount > 0 && (
                                <StatChip
                                    statusVariant="error"
                                    icon={<ErrorIcon sx={{ fontSize: 16 }} />}
                                    label={`${failedCount} Failed`}
                                />
                            )}
                            {inProgressCount > 0 && (
                                <Chip
                                    icon={<HourglassEmptyIcon sx={{ fontSize: 16 }} />}
                                    label={`${inProgressCount} In Progress`}
                                    sx={(theme) => ({
                                        backgroundColor: theme.custom.status.warning.background,
                                        color: theme.palette.warning.light,
                                        border: `1px solid ${theme.palette.warning.light}30`,
                                        fontWeight: 600,
                                    })}
                                />
                            )}
                        </SummaryStats>

                        <Typography
                            sx={(theme) => ({
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                color: theme.custom.palette.text.tertiary,
                                marginBottom: 2,
                            })}
                        >
                            Job Details
                        </Typography>

                        <SubmissionList>
                            {jobs.map(renderSubmission)}
                        </SubmissionList>
                    </>
                )}

                {jobs.length === 0 && isSubmitted && (
                    <Box
                        sx={(theme) => ({
                            textAlign: 'center',
                            padding: 4,
                            color: theme.custom.palette.text.placeholder,
                        })}
                    >
                        <CloudUploadIcon sx={{ fontSize: 48, marginBottom: 2, opacity: 0.5 }} />
                        <Typography>No jobs to display</Typography>
                    </Box>
                )}
            </Collapse>
        </Container>
    );
}
