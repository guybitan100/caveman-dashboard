import { Box, Typography } from "@mui/material";
import { styled, keyframes } from "@mui/material/styles";
import {
    GenerationTaskStatus,
    TASK_STATUS_CONFIG,
} from "../../types/taskProgress";

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
`;

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

interface ChipContainerProps {
    status: GenerationTaskStatus;
    size?: "small" | "medium";
    clickable?: boolean;
}

const ChipContainer = styled(Box, {
    shouldForwardProp: (prop) =>
        prop !== "status" && prop !== "size" && prop !== "clickable",
})<ChipContainerProps>(({ theme, status, size = "medium", clickable }) => {
    const config = TASK_STATUS_CONFIG[status];
    const isSmall = size === "small";

    return {
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? 4 : 6,
        padding: isSmall ? "2px 6px" : "4px 10px",
        borderRadius: isSmall ? 8 : 12,
        backgroundColor: config.backgroundColor,
        border: `1px solid ${config.color}33`,
        transition: theme.transitions.create(
            ["background-color", "border-color", "transform"],
            {
                duration: theme.transitions.duration.short,
            }
        ),
        cursor: clickable ? "pointer" : "default",

        ...(clickable && {
            "&:hover": {
                backgroundColor: `${config.backgroundColor}dd`,
                borderColor: `${config.color}66`,
                transform: "translateY(-1px)",
            },
        }),
    };
});

interface StatusIconProps {
    status: GenerationTaskStatus;
    animated?: boolean;
}

const StatusIcon = styled(Box, {
    shouldForwardProp: (prop) => prop !== "status" && prop !== "animated",
})<StatusIconProps>(({ status, animated }) => {
    const config = TASK_STATUS_CONFIG[status];
    const isGenerating = status === "Generating";
    const isPending = status === "Pending";

    return {
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: config.color,
        flexShrink: 0,

        // Pulse animation for generating
        ...(isGenerating &&
            animated && {
            animation: `${pulse} 1s ease-in-out infinite`,
        }),

        // Subtle pulse for pending
        ...(isPending &&
            animated && {
            animation: `${pulse} 2s ease-in-out infinite`,
        }),
    };
});

interface StatusLabelProps {
    status: GenerationTaskStatus;
    size?: "small" | "medium";
}

const StatusLabel = styled(Typography, {
    shouldForwardProp: (prop) => prop !== "status" && prop !== "size",
})<StatusLabelProps>(({ theme, status, size = "medium" }) => {
    const config = TASK_STATUS_CONFIG[status];
    const isSmall = size === "small";

    return {
        fontSize: isSmall ? "0.65rem" : "0.75rem",
        fontWeight: theme.typography.fontWeightMedium,
        color: config.color,
        letterSpacing: "0.2px",
        lineHeight: 1.2,
    };
});

export interface TaskStatusChipProps {
    /** Current task status */
    status: GenerationTaskStatus;
    /** Size variant */
    size?: "small" | "medium";
    /** Whether to show animated indicators */
    animated?: boolean;
    /** Optional custom label (defaults to status name) */
    label?: string;
    /** Whether the chip is clickable */
    clickable?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Custom class name */
    className?: string;
}

export function TaskStatusChip({
    status,
    size = "medium",
    animated = true,
    label,
    clickable = false,
    onClick,
    className,
}: TaskStatusChipProps) {
    const config = TASK_STATUS_CONFIG[status];
    const displayLabel = label || config.label;

    return (
        <ChipContainer
            status={status}
            size={size}
            clickable={clickable}
            onClick={clickable ? onClick : undefined}
            className={className}
        >
            <StatusIcon status={status} animated={animated} />
            <StatusLabel status={status} size={size}>
                {displayLabel}
            </StatusLabel>
        </ChipContainer>
    );
}

/**
 * Minimal status indicator - just the dot with optional text.
 */
export interface StatusIndicatorProps {
    status: GenerationTaskStatus;
    showLabel?: boolean;
    animated?: boolean;
}

const IndicatorContainer = styled(Box)({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
});

const IndicatorLabel = styled(Typography, {
    shouldForwardProp: (prop) => prop !== "status",
})<{ status: GenerationTaskStatus }>(({ theme, status }) => {
    const config = TASK_STATUS_CONFIG[status];

    return {
        fontSize: "0.7rem",
        color: config.color,
        fontWeight: theme.typography.fontWeightMedium,
    };
});

export function StatusIndicator({
    status,
    showLabel = false,
    animated = true,
}: StatusIndicatorProps) {
    const config = TASK_STATUS_CONFIG[status];

    return (
        <IndicatorContainer>
            <StatusIcon status={status} animated={animated} />
            {showLabel && (
                <IndicatorLabel status={status}>{config.label}</IndicatorLabel>
            )}
        </IndicatorContainer>
    );
}

/**
 * Loading spinner for use during initial data fetch.
 */
const SpinnerContainer = styled(Box)(({ theme }) => ({
    width: 16,
    height: 16,
    border: `2px solid ${theme.custom.surface.white20}`,
    borderTopColor: theme.palette.primary.main,
    borderRadius: "50%",
    animation: `${spin} 0.8s linear infinite`,
}));

export function TaskStatusSpinner() {
    return <SpinnerContainer />;
}
