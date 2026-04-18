import { useState, useCallback, useEffect, useRef } from "react";
import {
    Box,
    IconButton,
    Skeleton,
    Typography,
    Button,
    Paper,
    Dialog,
    DialogContent,
    DialogTitle,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import { metafinderApi, MetaFinderDataType, MetaFinderFile } from "../../../api/metafinderApi";
import { EmptyState } from "../../shared/styledComponents";

const Container = styled(Box)(() => ({
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minWidth: 0, // Prevent flex child from overflowing
}));

const MainPreview = styled(Box)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "100%",
    height: 200,
    backgroundColor: theme.custom?.surface?.white5 ?? "rgba(255,255,255,0.05)",
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
    overflow: "hidden",
}));

const PreviewImage = styled("img")({
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    cursor: "pointer",
});

const PreviewAudio = styled("audio")({
    width: "80%",
    maxWidth: "100%",
});

const PreviewVideo = styled("video")({
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
});

const FileIconWrapper = styled(Box)(({ theme }) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: theme.palette.text.secondary,
    cursor: "pointer",
}));

const NavButton = styled(IconButton)(({ theme }) => ({
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    backgroundColor: "rgba(0,0,0,0.5)",
    color: theme.palette.common.white,
    zIndex: 10,
    "&:hover": {
        backgroundColor: "rgba(0,0,0,0.7)",
    },
    "&.Mui-disabled": {
        opacity: 0.3,
        backgroundColor: "rgba(0,0,0,0.3)",
    },
}));

const ThumbnailGrid = styled(Box)(({ theme }) => ({
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: theme.spacing(2),
}));

const Thumbnail = styled(Paper, {
    shouldForwardProp: (prop) => prop !== "selected",
})<{ selected?: boolean }>(({ theme, selected }) => ({
    width: 56,
    height: 56,
    overflow: "hidden",
    cursor: "pointer",
    border: `2px solid ${selected ? theme.palette.primary.main : "transparent"}`,
    borderRadius: theme.shape.borderRadius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.custom?.surface?.white5 ?? "rgba(255,255,255,0.05)",
    transition: theme.transitions.create(["border-color", "transform"]),
    "&:hover": {
        borderColor: theme.palette.primary.light,
        transform: "scale(1.05)",
    },
}));

const ThumbnailImage = styled("img")({
    width: "100%",
    height: "100%",
    objectFit: "cover",
});

const ThumbnailPlaceholder = styled(Box)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.6rem",
    color: theme.palette.text.secondary,
    textAlign: "center",
    padding: 4,
}));

const ActionButton = styled(Button)(({ theme }) => ({
    textTransform: "none",
    fontWeight: 500,
    borderColor: theme.custom?.border?.default ?? "rgba(255,255,255,0.2)",
}));

interface MetaFinderGalleryProps {
    dataType: MetaFinderDataType;
    selectedKey?: string;
    onSelect: (file: MetaFinderFile) => void;
    disabled?: boolean;
}

export function MetaFinderGallery({
    dataType,
    selectedKey,
    onSelect,
    disabled = false,
}: MetaFinderGalleryProps) {
    const [files, setFiles] = useState<MetaFinderFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Use ref for onSelect to avoid triggering refetch when callback changes
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    // Use ref for selectedKey to avoid triggering refetch when selection changes
    const selectedKeyRef = useRef(selectedKey);

    // Only update ref on mount or when dataType changes (not on every selection)
    useEffect(() => {
        selectedKeyRef.current = selectedKey;
    }, [dataType]); // Only reset when dataType changes

    const fetchFiles = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await metafinderApi.getFiles(dataType, 10);
            setFiles(result);
            if (result.length > 0) {
                // Find previously selected file or default to first
                const prevIndex = selectedKeyRef.current
                    ? result.findIndex((f) => f.s3_key === selectedKeyRef.current)
                    : -1;
                setSelectedIndex(prevIndex >= 0 ? prevIndex : 0);
            }
        } catch (err) {
            setError("Failed to fetch files from MetaFinder");
            console.error("MetaFinder fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [dataType]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const handlePrev = useCallback(() => {
        if (selectedIndex > 0) {
            const newIndex = selectedIndex - 1;
            setSelectedIndex(newIndex);
            onSelectRef.current(files[newIndex]);
        }
    }, [selectedIndex, files]);

    const handleNext = useCallback(() => {
        if (selectedIndex < files.length - 1) {
            const newIndex = selectedIndex + 1;
            setSelectedIndex(newIndex);
            onSelectRef.current(files[newIndex]);
        }
    }, [selectedIndex, files]);

    const handleThumbnailClick = useCallback(
        (index: number) => {
            setSelectedIndex(index);
            onSelectRef.current(files[index]);
        },
        [files]
    );

    const selectedFile = files[selectedIndex];

    const renderPreview = (file: MetaFinderFile, isDialog = false) => {
        const height = isDialog ? "auto" : 200;
        const maxHeight = isDialog ? "70vh" : 200;

        switch (dataType) {
            case "image":
                return (
                    <PreviewImage
                        src={file.presigned_url}
                        alt={file.s3_key}
                        style={{ maxHeight }}
                        onClick={!isDialog ? () => setDialogOpen(true) : undefined}
                    />
                );
            case "audio":
                return (
                    <PreviewAudio controls preload="metadata">
                        <source src={file.presigned_url} />
                        Your browser does not support audio.
                    </PreviewAudio>
                );
            case "video":
                return (
                    <PreviewVideo
                        controls
                        preload="metadata"
                        style={{ maxHeight, height }}
                    >
                        <source src={file.presigned_url} />
                        Your browser does not support video.
                    </PreviewVideo>
                );
            case "document":
                return (
                    <FileIconWrapper onClick={() => setDialogOpen(true)}>
                        <Typography variant="h4">📄</Typography>
                        <Typography variant="caption" sx={{ mt: 1 }}>
                            {file.format?.toUpperCase() || "DOC"}
                        </Typography>
                    </FileIconWrapper>
                );
            default:
                return (
                    <FileIconWrapper>
                        <Typography variant="h4">📁</Typography>
                    </FileIconWrapper>
                );
        }
    };

    const renderThumbnail = (file: MetaFinderFile) => {
        switch (dataType) {
            case "image":
                return <ThumbnailImage src={file.presigned_url} alt={file.s3_key} />;
            case "audio":
                return (
                    <ThumbnailPlaceholder>
                        🎵
                        <br />
                        {file.format?.toUpperCase()}
                    </ThumbnailPlaceholder>
                );
            case "video":
                return (
                    <ThumbnailPlaceholder>
                        🎬
                        <br />
                        {file.format?.toUpperCase()}
                    </ThumbnailPlaceholder>
                );
            case "document":
                return (
                    <ThumbnailPlaceholder>
                        📄
                        <br />
                        {file.format?.toUpperCase()}
                    </ThumbnailPlaceholder>
                );
            default:
                return <ThumbnailPlaceholder>📁</ThumbnailPlaceholder>;
        }
    };

    if (error) {
        return (
            <EmptyState>
                <Typography color="error" gutterBottom>
                    {error}
                </Typography>
                <ActionButton
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={fetchFiles}
                >
                    Retry
                </ActionButton>
            </EmptyState>
        );
    }

    if (isLoading) {
        return (
            <Container>
                <MainPreview>
                    <Skeleton variant="rectangular" width={550} height="100%" />
                </MainPreview>
                <ThumbnailGrid>
                    {[...Array(10)].map((_, index) => (
                        <Skeleton
                            key={index}
                            variant="rounded"
                            width={56}
                            height={56}
                        />
                    ))}
                </ThumbnailGrid>
                <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
                    <Skeleton variant="rounded" width={160} height={36} />
                </Box>
            </Container>
        );
    }

    return (
        <Container>
            <MainPreview>
                {files.length === 0 ? (
                    <EmptyState>
                        <Typography gutterBottom>No files found</Typography>
                        <ActionButton
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={fetchFiles}
                        >
                            Refresh
                        </ActionButton>
                    </EmptyState>
                ) : (
                    <>
                        <NavButton
                            onClick={handlePrev}
                            disabled={disabled || selectedIndex === 0}
                            sx={{ left: 8 }}
                        >
                            <ChevronLeftIcon />
                        </NavButton>

                        {selectedFile && renderPreview(selectedFile)}

                        <NavButton
                            onClick={handleNext}
                            disabled={disabled || selectedIndex === files.length - 1}
                            sx={{ right: 8 }}
                        >
                            <ChevronRightIcon />
                        </NavButton>
                    </>
                )}
            </MainPreview>

            {files.length > 0 && (
                <ThumbnailGrid>
                    {files.map((file, index) => (
                        <Thumbnail
                            key={file.s3_key}
                            selected={index === selectedIndex}
                            onClick={() => !disabled && handleThumbnailClick(index)}
                        >
                            {renderThumbnail(file)}
                        </Thumbnail>
                    ))}
                </ThumbnailGrid>
            )}

            <Box sx={{ display: "flex", justifyContent: "center" }}>
                <ActionButton
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={fetchFiles}
                    disabled={disabled || isLoading}
                    size="small"
                >
                    Get More Files
                </ActionButton>
            </Box>

            {/* Full-size preview dialog */}
            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="lg"
            >
                <DialogTitle sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography>Preview</Typography>
                    <IconButton onClick={() => setDialogOpen(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {selectedFile && renderPreview(selectedFile, true)}
                </DialogContent>
            </Dialog>
        </Container>
    );
}
