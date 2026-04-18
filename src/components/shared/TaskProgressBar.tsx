import { Box, Typography } from "@mui/material";
import { styled, keyframes } from "@mui/material/styles";
import { GenerationTaskStatus, TASK_STATUS_CONFIG } from "../../types/taskProgress";

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`;

interface ProgressContainerProps {
    size?: "small" | "medium" | "large";
}

const ProgressContainer = styled(Box, {
    shouldForwardProp: (prop) => prop !== "size",
})<ProgressContainerProps>(({ theme, size = "medium" }) => {
    const heights = {
        small: 4,
        medium: 6,
        large: 8,
    };

    return {
        width: "100%",
        height: heights[size],
        backgroundColor: theme.custom.surface.white10,
        borderRadius: heights[size] / 2,
        overflow: "hidden",
        position: "relative",
    };
});

interface ProgressFillProps {
    progress: number;
    status: GenerationTaskStatus;
    animated?: boolean;
}

const ProgressFill = styled(Box, {
    shouldForwardProp: (prop) =>
        prop !== "progress" && prop !== "status" && prop !== "animated",
})<ProgressFillProps>(({ progress, status, animated }) => {
    const config = TASK_STATUS_CONFIG[status];
    const isGenerating = status === "Generating";

    return {
        height: "100%",
        width: `${Math.min(progress * 100, 100)}%`,
        backgroundColor: config.color,
        borderRadius: "inherit",
        transition: "width 0.3s ease-out",
        position: "relative",

        // Shimmer effect for generating status
        ...(isGenerating &&
            animated && {
            background: `linear-gradient(
          90deg,
          ${config.color} 0%,
          ${config.color}dd 25%,
          ${config.color}ff 50%,
          ${config.color}dd 75%,
          ${config.color} 100%
        )`,
            backgroundSize: "200% 100%",
            animation: `${shimmer} 1.5s ease-in-out infinite`,
        }),

        // Pulse effect for pending
        ...(status === "Pending" &&
            animated && {
            animation: `${pulse} 1.5s ease-in-out infinite`,
        }),
    };
});

const ProgressWrapper = styled(Box)({
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: "100%",
});

const ProgressInfo = styled(Box)({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
});

const ProgressLabel = styled(Typography)(({ theme }) => ({
    fontSize: "0.7rem",
    color: theme.custom.palette.text.muted,
    fontWeight: theme.typography.fontWeightMedium,
}));

interface ProgressPercentageProps {
    status: GenerationTaskStatus;
}

const ProgressPercentage = styled(Typography, {
    shouldForwardProp: (prop) => prop !== "status",
})<ProgressPercentageProps>(({ theme, status }) => {
    const config = TASK_STATUS_CONFIG[status];

    return {
        fontSize: "0.75rem",
        fontWeight: theme.typography.fontWeightBold,
        color: config.color,
        fontVariantNumeric: "tabular-nums",
    };
});

export interface TaskProgressBarProps {
    /** Progress value from 0 to 1 */
    progress: number;
    /** Current task status */
    status: GenerationTaskStatus;
    /** Size variant */
    size?: "small" | "medium" | "large";
    /** Whether to show percentage text */
    showPercentage?: boolean;
    /** Optional label */
    label?: string;
    /** Whether to animate */
    animated?: boolean;
    /** Custom class name */
    className?: string;
}

export function TaskProgressBar({
    progress,
    status,
    size = "medium",
    showPercentage = false,
    label,
    animated = true,
    className,
}: TaskProgressBarProps) {
    const percentage = Math.round(progress * 100);

    if (!showPercentage && !label) {
        return (
            <ProgressContainer size={size} className={className}>
                <ProgressFill progress={progress} status={status} animated={animated} />
            </ProgressContainer>
        );
    }

    return (
        <ProgressWrapper className={className}>
            {(label || showPercentage) && (
                <ProgressInfo>
                    {label && <ProgressLabel>{label}</ProgressLabel>}
                    {showPercentage && (
                        <ProgressPercentage status={status}>{percentage}%</ProgressPercentage>
                    )}
                </ProgressInfo>
            )}
            <ProgressContainer size={size}>
                <ProgressFill progress={progress} status={status} animated={animated} />
            </ProgressContainer>
        </ProgressWrapper>
    );
}

/**
 * Compact inline progress bar for use in cards and list items.
 */
export interface CompactProgressBarProps {
    progress: number;
    status: GenerationTaskStatus;
    showPercentage?: boolean;
}

const CompactContainer = styled(Box)({
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
});

const CompactBarWrapper = styled(Box)({
    flex: 1,
    minWidth: 0,
});

const CompactPercentage = styled(Typography, {
    shouldForwardProp: (prop) => prop !== "status",
})<ProgressPercentageProps>(({ theme, status }) => {
    const config = TASK_STATUS_CONFIG[status];

    return {
        fontSize: "0.7rem",
        fontWeight: theme.typography.fontWeightBold,
        color: config.color,
        minWidth: 32,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
    };
});

export function CompactProgressBar({
    progress,
    status,
    showPercentage = true,
}: CompactProgressBarProps) {
    const percentage = Math.round(progress * 100);

    return (
        <CompactContainer>
            <CompactBarWrapper>
                <ProgressContainer size="small">
                    <ProgressFill progress={progress} status={status} animated />
                </ProgressContainer>
            </CompactBarWrapper>
            {showPercentage && (
                <CompactPercentage status={status}>{percentage}%</CompactPercentage>
            )}
        </CompactContainer>
    );
}
