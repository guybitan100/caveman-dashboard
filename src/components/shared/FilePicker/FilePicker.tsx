import { useState, useCallback } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { MetaFinderGallery } from "./MetaFinderGallery";
import { FileUploader } from "./FileUploader";
import { StoryFileInfo, StoryFileType } from "../../../types/storyParams";
import { MetaFinderDataType } from "../../../api/metafinderApi";

const Container = styled(Box)(() => ({
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minWidth: 0,
    overflow: "hidden",
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
    borderBottom: `1px solid ${theme.custom?.border?.default ?? "rgba(255,255,255,0.1)"}`,
    minHeight: 40,
    "& .MuiTabs-indicator": {
        backgroundColor: theme.palette.primary.main,
    },
}));

const StyledTab = styled(Tab)(({ theme }) => ({
    minHeight: 40,
    textTransform: "none",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: theme.palette.text.secondary,
    "&.Mui-selected": {
        color: theme.palette.primary.main,
    },
}));

const TabPanel = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2, 0),
    width: "100%",
}));

const SelectedFileInfo = styled(Box)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    marginTop: theme.spacing(2),
    backgroundColor: theme.custom?.surface?.white5 ?? "rgba(255,255,255,0.05)",
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.custom?.border?.default ?? "rgba(255,255,255,0.1)"}`,
}));

const FileName = styled(Typography)(({ theme }) => ({
    fontSize: "0.8rem",
    color: theme.palette.text.primary,
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
}));

const FileSize = styled(Typography)(({ theme }) => ({
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
}));

const FileSource = styled(Typography)(({ theme }) => ({
    fontSize: "0.7rem",
    padding: "2px 6px",
    borderRadius: 4,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    textTransform: "uppercase",
}));

export interface FilePickerProps {
    dataType: MetaFinderDataType;
    value: StoryFileInfo | null;
    onChange: (file: StoryFileInfo | null) => void;
    error?: string;
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

export function FilePicker({
    dataType,
    value,
    onChange,
    error,
    disabled = false,
}: FilePickerProps) {
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = useCallback(
        (_: React.SyntheticEvent, newValue: number) => {
            setActiveTab(newValue);
        },
        []
    );

    const handleMetaFinderSelect = useCallback(
        (file: {
            s3_key: string;
            size: number;
            presigned_url: string;
            format: string;
        }) => {
            onChange({
                s3_key: file.s3_key,
                file_type: "metafinder" as StoryFileType,
                size: file.size,
                presigned_url: file.presigned_url,
            });
        },
        [onChange]
    );

    const handleUploadComplete = useCallback(
        (file: { md5: string; file_name: string; size: number }) => {
            onChange({
                s3_key: file.md5,
                file_type: "upload" as StoryFileType,
                file_name: file.file_name,
                size: file.size,
            });
        },
        [onChange]
    );

    const capitalizedDataType =
        dataType.charAt(0).toUpperCase() + dataType.slice(1);

    return (
        <Container>
            <StyledTabs value={activeTab} onChange={handleTabChange}>
                <StyledTab label={`MetaFinder ${capitalizedDataType}s`} />
                <StyledTab label="Upload File" />
            </StyledTabs>

            <TabPanel hidden={activeTab !== 0}>
                {activeTab === 0 && (
                    <MetaFinderGallery
                        dataType={dataType}
                        selectedKey={value?.s3_key}
                        onSelect={handleMetaFinderSelect}
                        disabled={disabled}
                    />
                )}
            </TabPanel>

            <TabPanel hidden={activeTab !== 1}>
                {activeTab === 1 && (
                    <FileUploader
                        dataType={dataType}
                        onComplete={handleUploadComplete}
                        disabled={disabled}
                    />
                )}
            </TabPanel>

            {value && (
                <SelectedFileInfo>
                    <FileSource>{value.file_type}</FileSource>
                    <FileName>
                        {value.file_name || value.s3_key.substring(0, 20) + "..."}
                    </FileName>
                    <FileSize>{formatFileSize(value.size)}</FileSize>
                </SelectedFileInfo>
            )}

            {error && (
                <Typography
                    variant="caption"
                    color="error"
                    sx={{ mt: 1, display: "block" }}
                >
                    {error}
                </Typography>
            )}
        </Container>
    );
}
