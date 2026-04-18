import { Box, LinearProgress, Typography, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CloseIcon from "@mui/icons-material/Close";
import { DownloadProgress as DownloadProgressType } from "../../services/downloadService";

const ProgressContainer = styled(Box)(({ theme }) => ({
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1),
    boxShadow: theme.shadows[2],
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
}));

const ProgressHeader = styled(Box)({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
});

const ProgressControls = styled(Box)({
    display: "flex",
    gap: "4px",
});

const ProgressDetails = styled(Box)(({ theme }) => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: theme.palette.text.secondary,
    fontSize: "0.875rem",
}));

interface DownloadProgressProps {
    download: DownloadProgressType;
    onPause: () => void;
    onResume: () => void;
    onCancel: () => void;
}

export function DownloadProgress({
    download,
    onPause,
    onResume,
    onCancel,
}: DownloadProgressProps) {
    const percentage =
        download.totalBytes > 0
            ? (download.downloadedBytes / download.totalBytes) * 100
            : 0;

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    const formatSpeed = (bytesPerSecond: number): string => {
        return `${formatBytes(bytesPerSecond)}/s`;
    };

    const formatETA = (seconds: number): string => {
        if (!isFinite(seconds) || seconds < 0 || download.speed === 0) return "Calculating...";

        if (seconds < 1) return "Less than 1s remaining";

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m remaining`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s remaining`;
        } else {
            return `${secs}s remaining`;
        }
    };

    const getStatusText = (): string => {
        switch (download.status) {
            case "pending":
                return "Starting...";
            case "downloading":
                return formatSpeed(download.speed);
            case "paused":
                return "Paused";
            case "completed":
                return "Completed";
            case "failed":
                return `Failed: ${download.error || "Unknown error"}`;
            default:
                return "";
        }
    };

    const handleCancelClick = () => {
        if (
            window.confirm(
                "Are you sure you want to cancel this download? Progress will be lost."
            )
        ) {
            onCancel();
        }
    };

    return (
        <ProgressContainer>
            <ProgressHeader>
                <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1 }}>
                    {download.fileName}
                </Typography>
                <ProgressControls>
                    {download.status === "downloading" && (
                        <IconButton
                            size="small"
                            onClick={onPause}
                            aria-label="Pause"
                            data-testid="download-pause-btn"
                        >
                            <PauseIcon fontSize="small" />
                        </IconButton>
                    )}
                    {download.status === "paused" && (
                        <IconButton
                            size="small"
                            onClick={onResume}
                            aria-label="Resume"
                            data-testid="download-resume-btn"
                        >
                            <PlayArrowIcon fontSize="small" />
                        </IconButton>
                    )}
                    {download.status !== "completed" && (
                        <IconButton
                            size="small"
                            onClick={handleCancelClick}
                            aria-label="Cancel"
                            data-testid="download-cancel-btn"
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </ProgressControls>
            </ProgressHeader>

            <LinearProgress
                variant="determinate"
                value={percentage}
                sx={{ height: 6, borderRadius: 3 }}
                data-testid="download-progress-bar"
            />

            <ProgressDetails>
                <Typography variant="caption">
                    {formatBytes(download.downloadedBytes)} /{" "}
                    {formatBytes(download.totalBytes)} ({percentage.toFixed(1)}%)
                </Typography>
                <Typography variant="caption">
                    {download.status === "downloading" && formatETA(download.eta)}
                    {download.status !== "downloading" && getStatusText()}
                </Typography>
            </ProgressDetails>
        </ProgressContainer>
    );
}
