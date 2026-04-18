/**
 * JobStatusIndicator component.
 * Displays a visual indicator for job status with appropriate icon and color.
 */

import { Box, keyframes } from '@mui/material';
import { styled } from '@mui/material/styles';
import { JobStatus, JOB_STATUS_CONFIG } from '../../types/job.ts';

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

interface StatusDotProps {
    statusColor: string;
    backgroundColor: string;
    isAnimated?: boolean;
}

const StatusContainer = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
});

const StatusDot = styled(Box, {
    shouldForwardProp: (prop) =>
        prop !== 'statusColor' && prop !== 'backgroundColor' && prop !== 'isAnimated',
})<StatusDotProps>(({ statusColor, isAnimated }) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: statusColor,
    boxShadow: `0 0 8px ${statusColor}`,
    ...(isAnimated && {
        animation: `${pulse} 1.5s ease-in-out infinite`,
    }),
}));

const StatusLabel = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'statusColor',
})<{ statusColor: string }>(({ statusColor }) => ({
    fontSize: '0.7rem',
    fontWeight: 500,
    color: statusColor,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
}));

interface JobStatusIndicatorProps {
    status: JobStatus;
    showLabel?: boolean;
    size?: 'small' | 'medium';
}

export function JobStatusIndicator({
    status,
    showLabel = false,
    size = 'small',
}: JobStatusIndicatorProps) {
    const config = JOB_STATUS_CONFIG[status];

    const dotSize = size === 'small' ? 8 : 10;

    return (
        <StatusContainer>
            <StatusDot
                statusColor={config.color}
                backgroundColor={config.backgroundColor}
                isAnimated={config.animated}
                sx={{
                    width: dotSize,
                    height: dotSize,
                }}
            />
            {showLabel && (
                <StatusLabel statusColor={config.color}>
                    {config.label}
                </StatusLabel>
            )}
        </StatusContainer>
    );
}
