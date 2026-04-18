import { useState } from "react";
import {
    Box,
    Paper,
    Typography,
    IconButton,
    Collapse,
    Badge,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DownloadIcon from "@mui/icons-material/Download";
import { useDownloadStore } from "../../stores/downloadStore";
import { DownloadProgress } from "./DownloadProgress";
import { downloadService } from "../../services/downloadService";

const IndicatorContainer = styled(Paper)(({ theme }) => ({
    position: "fixed",
    bottom: theme.spacing(3),
    right: theme.spacing(3),
    width: 380,
    maxWidth: "calc(100vw - 48px)",
    maxHeight: "calc(100vh - 100px)",
    display: "flex",
    flexDirection: "column",
    zIndex: theme.zIndex.snackbar,
    boxShadow: theme.shadows[8],
}));

const IndicatorHeader = styled(Box)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    cursor: "pointer",
    userSelect: "none",
}));

const HeaderContent = styled(Box)({
    display: "flex",
    alignItems: "center",
    gap: "12px",
});

const DownloadsContainer = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2),
    maxHeight: 400,
    overflowY: "auto",
}));

export function DownloadIndicator() {
    const [expanded, setExpanded] = useState(true);
    const { getActiveDownloads, removeDownload } =
        useDownloadStore();

    const activeDownloads = getActiveDownloads();

    if (activeDownloads.length === 0) {
        return null;
    }

    const handlePause = (downloadId: string) => {
        downloadService.pauseDownload(downloadId);
    };

    const handleResume = (downloadId: string) => {
        downloadService.resumeDownload(downloadId);
    };

    const handleCancel = async (downloadId: string) => {
        await downloadService.cancelDownload(downloadId);
        removeDownload(downloadId);
    };

    const totalProgress =
        activeDownloads.reduce(
            (sum, d) => sum + (d.downloadedBytes / d.totalBytes) * 100,
            0
        ) / activeDownloads.length;

    return (
        <IndicatorContainer>
            <IndicatorHeader onClick={() => setExpanded(!expanded)}>
                <HeaderContent>
                    <Badge badgeContent={activeDownloads.length} color="primary">
                        <DownloadIcon />
                    </Badge>
                    <Box>
                        <Typography variant="body2" fontWeight={500}>
                            {activeDownloads.length === 1
                                ? "1 Download"
                                : `${activeDownloads.length} Downloads`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {totalProgress.toFixed(0)}% complete
                        </Typography>
                    </Box>
                </HeaderContent>
                <IconButton size="small">
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
            </IndicatorHeader>

            <Collapse in={expanded}>
                <DownloadsContainer>
                    {activeDownloads.map((download) => (
                        <DownloadProgress
                            key={download.downloadId}
                            download={download}
                            onPause={() => handlePause(download.downloadId)}
                            onResume={() => handleResume(download.downloadId)}
                            onCancel={() => handleCancel(download.downloadId)}
                        />
                    ))}
                </DownloadsContainer>
            </Collapse>
        </IndicatorContainer>
    );
}
