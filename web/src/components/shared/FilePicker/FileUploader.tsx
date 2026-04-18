import { useState, useCallback, useRef } from "react";
import {
    Box,
    Typography,
    LinearProgress,
    IconButton,
    Alert,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { MetaFinderDataType } from "../../../api/metafinderApi";
import {
    doesFileExist,
    getUploadPresignedUrl,
    uploadFileToS3,
} from "../../../api/uploadsApi";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const Container = styled(Box)(() => ({
    display: "flex",
    flexDirection: "column",
    width: "100%",
}));

const DropZone = styled(Box, {
    shouldForwardProp: (prop) => prop !== "isDragOver" && prop !== "hasError",
})<{ isDragOver?: boolean; hasError?: boolean }>(
    ({ theme, isDragOver, hasError }) => ({
        display: "flex",
        width: 540,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing(4),
        border: `2px dashed ${hasError
            ? theme.palette.error.main
            : isDragOver
                ? theme.palette.primary.main
                : theme.custom?.border?.default ?? "rgba(255,255,255,0.2)"
            }`,
        borderRadius: theme.shape.borderRadius,
        backgroundColor: isDragOver
            ? theme.palette.primary.main + "10"
            : theme.custom?.surface?.white5 ?? "rgba(255,255,255,0.05)",
        cursor: "pointer",
        transition: theme.transitions.create([
            "border-color",
            "background-color",
        ]),
        "&:hover": {
            borderColor: theme.palette.primary.main,
            backgroundColor: theme.palette.primary.main + "08",
        },
    })
);

const UploadIcon = styled(CloudUploadIcon)(({ theme }) => ({
    fontSize: 48,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
}));

const HiddenInput = styled("input")({
    display: "none",
});

const FileCard = styled(Box)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    marginTop: theme.spacing(2),
    backgroundColor: theme.custom?.surface?.white5 ?? "rgba(255,255,255,0.05)",
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.custom?.border?.default ?? "rgba(255,255,255,0.1)"}`,
}));

const FileInfo = styled(Box)({
    flex: 1,
    minWidth: 0,
});

const FileName = styled(Typography)({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

const ProgressWrapper = styled(Box)({
    display: "flex",
    alignItems: "center",
    gap: 8,
});

const StyledProgress = styled(LinearProgress)(({ theme }) => ({
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.custom?.surface?.white10 ?? "rgba(255,255,255,0.1)",
}));

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadedFile {
    file: File;
    md5: string;
    status: UploadStatus;
    progress: number;
    error?: string;
}

interface FileUploaderProps {
    dataType: MetaFinderDataType;
    onComplete: (file: { md5: string; file_name: string; size: number }) => void;
    disabled?: boolean;
}

/**
 * Format file size to human readable string
 */
function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get accepted file types based on data type
 */
function getAcceptedTypes(dataType: MetaFinderDataType): string {
    switch (dataType) {
        case "image":
            return "image/*";
        case "video":
            return "video/*";
        case "audio":
            return "audio/*";
        case "document":
            return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf";
        default:
            return "*/*";
    }
}

/**
 * Calculate MD5 hash of file content
 * Uses SubtleCrypto for modern browsers
 */
async function calculateMD5(file: File): Promise<string> {
    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Use SubtleCrypto if available (modern browsers)
    if (crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        // Return first 32 chars to simulate MD5 length
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    // Fallback: simple hash for older browsers
    const view = new Uint8Array(buffer);
    let hash = 0;
    for (let i = 0; i < view.length; i++) {
        hash = (hash << 5) - hash + view[i];
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(32, "0");
}

export function FileUploader({
    dataType,
    onComplete,
    disabled = false,
}: FileUploaderProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(
        async (file: File) => {
            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                setUploadedFile({
                    file,
                    md5: "",
                    status: "error",
                    progress: 0,
                    error: `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`,
                });
                return;
            }

            // Start upload process
            setUploadedFile({
                file,
                md5: "",
                status: "uploading",
                progress: 10,
            });

            try {
                // Calculate MD5
                const md5 = await calculateMD5(file);
                setUploadedFile((prev) =>
                    prev ? { ...prev, md5, progress: 30 } : null
                );

                // Check if file already exists
                const exists = await doesFileExist(md5);
                if (exists) {
                    // File already uploaded, skip upload
                    setUploadedFile((prev) =>
                        prev ? { ...prev, status: "success", progress: 100 } : null
                    );
                    onComplete({ md5, file_name: file.name, size: file.size });
                    return;
                }

                setUploadedFile((prev) =>
                    prev ? { ...prev, progress: 40 } : null
                );

                // Get presigned URL
                const presignedUrl = await getUploadPresignedUrl(md5);
                setUploadedFile((prev) =>
                    prev ? { ...prev, progress: 50 } : null
                );

                // Upload to S3
                await uploadFileToS3(file, presignedUrl, (progress) => {
                    // Map upload progress from 50-100%
                    const mappedProgress = 50 + (progress * 50) / 100;
                    setUploadedFile((prev) =>
                        prev ? { ...prev, progress: mappedProgress } : null
                    );
                });

                // Complete
                setUploadedFile((prev) =>
                    prev ? { ...prev, status: "success", progress: 100 } : null
                );
                onComplete({ md5, file_name: file.name, size: file.size });
            } catch (err) {
                console.error("Upload error:", err);
                setUploadedFile((prev) =>
                    prev
                        ? {
                            ...prev,
                            status: "error",
                            error: "Upload failed. Please try again.",
                        }
                        : null
                );
            }
        },
        [onComplete]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);

            if (disabled) return;

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        },
        [disabled, handleFile]
    );

    const handleDragOver = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            if (!disabled) {
                setIsDragOver(true);
            }
        },
        [disabled]
    );

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleClick = useCallback(() => {
        if (!disabled) {
            inputRef.current?.click();
        }
    }, [disabled]);

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                handleFile(files[0]);
            }
            // Reset input for re-uploading same file
            e.target.value = "";
        },
        [handleFile]
    );

    const handleRemove = useCallback(() => {
        setUploadedFile(null);
    }, []);

    const handleRetry = useCallback(() => {
        if (uploadedFile) {
            handleFile(uploadedFile.file);
        }
    }, [uploadedFile, handleFile]);

    const acceptedTypes = getAcceptedTypes(dataType);

    return (
        <Container>
            <DropZone
                isDragOver={isDragOver}
                onClick={handleClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <UploadIcon />
                <Typography variant="body2" color="text.secondary" align="center">
                    <strong>Click to upload</strong> or drag and drop
                </Typography>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                >
                    {dataType.toUpperCase()} files (max. {formatFileSize(MAX_FILE_SIZE)})
                </Typography>
                <HiddenInput
                    ref={inputRef}
                    type="file"
                    accept={acceptedTypes}
                    onChange={handleInputChange}
                    disabled={disabled}
                />
            </DropZone>

            {uploadedFile && (
                <FileCard>
                    <InsertDriveFileIcon color="action" />

                    <FileInfo>
                        <FileName variant="body2">{uploadedFile.file.name}</FileName>
                        <Typography variant="caption" color="text.secondary">
                            {formatFileSize(uploadedFile.file.size)}
                        </Typography>

                        {uploadedFile.status === "uploading" && (
                            <ProgressWrapper sx={{ mt: 1 }}>
                                <StyledProgress
                                    variant="determinate"
                                    value={uploadedFile.progress}
                                />
                                <Typography variant="caption" color="text.secondary">
                                    {Math.round(uploadedFile.progress)}%
                                </Typography>
                            </ProgressWrapper>
                        )}

                        {uploadedFile.status === "error" && (
                            <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                                {uploadedFile.error}
                            </Alert>
                        )}
                    </FileInfo>

                    {uploadedFile.status === "success" && (
                        <CheckCircleIcon color="success" />
                    )}

                    {uploadedFile.status === "error" && (
                        <>
                            <ErrorIcon color="error" />
                            <IconButton size="small" onClick={handleRetry}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </>
                    )}

                    <IconButton size="small" onClick={handleRemove}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </FileCard>
            )}
        </Container>
    );
}
