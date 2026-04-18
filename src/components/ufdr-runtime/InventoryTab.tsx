import { Box, Typography, Button, Chip, Alert } from "@mui/material";
import { styled } from "@mui/material/styles";
import FolderIcon from "@mui/icons-material/Folder";
import type { LocalUfdrFile, FormState } from "../../types/ufdrRuntime.ts";
import { formatFileSize, formatDate } from "../../utils/ufdrRuntime.ts";

const FileCard = styled(Button, {
  shouldForwardProp: (prop) => prop !== "isActive",
})<{ isActive?: boolean }>(({ theme, isActive }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  padding: theme.spacing(1.5, 2),
  borderRadius: 12,
  textTransform: "none",
  textAlign: "left",
  border: `1px solid ${isActive ? theme.palette.primary.light : theme.custom.border.default}`,
  background: isActive
    ? "rgba(34, 211, 238, 0.06)"
    : "rgba(255,255,255,0.02)",
  color: theme.palette.text.primary,
  transition: "all 0.15s ease",
  "&:hover": {
    background: isActive
      ? "rgba(34, 211, 238, 0.1)"
      : "rgba(255,255,255,0.04)",
    borderColor: theme.palette.primary.light,
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(1.5),
  padding: theme.spacing(6),
  color: theme.palette.text.secondary,
}));

interface InventoryTabProps {
  localFiles: LocalUfdrFile[];
  selectedLocalFile: string;
  inventoryError: string | null;
  onSelectFile: (path: string) => void;
  onUpdateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

export function InventoryTab({
  localFiles,
  selectedLocalFile,
  inventoryError,
  onSelectFile,
  onUpdateField,
}: InventoryTabProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Runtime inventory
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            Local UFDR Library
          </Typography>
        </Box>
        <Chip
          label={`${localFiles.length} files`}
          size="small"
          variant="outlined"
        />
      </Box>

      <Typography variant="body2" color="text.secondary">
        Click a file to make it the active local source for the request
        builder.
      </Typography>

      {inventoryError && <Alert severity="error">{inventoryError}</Alert>}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {localFiles.length === 0 ? (
          <EmptyState>
            <FolderIcon sx={{ fontSize: 40, opacity: 0.3 }} />
            <Typography variant="body2" fontWeight={600}>
              No UFDR files found
            </Typography>
            <Typography variant="caption" color="text.secondary">
              No UFDR files were found in the runtime workspace.
            </Typography>
          </EmptyState>
        ) : (
          localFiles.map((file) => (
            <FileCard
              key={file.path}
              isActive={selectedLocalFile === file.path}
              onClick={() => {
                onUpdateField("sourceMode", "local");
                onSelectFile(file.path);
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body2" fontWeight={600}>
                  {file.name}
                </Typography>
                {selectedLocalFile === file.path && (
                  <Chip
                    label="Selected"
                    size="small"
                    color="primary"
                    sx={{ height: 20, fontSize: "0.65rem" }}
                  />
                )}
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {file.path}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  mt: 0.5,
                  color: "text.secondary",
                  fontSize: "0.7rem",
                }}
              >
                <span>{formatFileSize(file.size)}</span>
                <span>{formatDate(file.modifiedAt)}</span>
              </Box>
            </FileCard>
          ))
        )}
      </Box>
    </Box>
  );
}
