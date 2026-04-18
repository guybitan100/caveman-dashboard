import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  InputLabel,
  FormControl,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import type {
  ExecutionMode,
  ModelMode,
  FormState,
  LocalUfdrFile,
} from "../../types/ufdrRuntime.ts";
import { formatFileSize } from "../../utils/ufdrRuntime.ts";

const Section = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  padding: theme.spacing(2.5),
  borderRadius: 16,
  background: "rgba(10, 24, 40, 0.45)",
  border: `1px solid ${theme.custom.border.default}`,
}));

const StepHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(1.5),
}));

const StepIndex = styled(Box)(({ theme }) => ({
  width: 28,
  height: 28,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: theme.palette.primary.dark,
  color: theme.palette.primary.light,
  fontWeight: 700,
  fontSize: "0.8rem",
  flexShrink: 0,
}));

const ChoiceGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1),
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
}));

const ChoiceCard = styled(Button, {
  shouldForwardProp: (prop) => prop !== "isSelected",
})<{ isSelected?: boolean }>(({ theme, isSelected }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  padding: theme.spacing(1.5, 2),
  borderRadius: 12,
  textTransform: "none",
  textAlign: "left",
  border: `1px solid ${isSelected ? theme.palette.primary.light : theme.custom.border.default}`,
  background: isSelected
    ? "rgba(34, 211, 238, 0.08)"
    : "rgba(255,255,255,0.02)",
  color: theme.palette.text.primary,
  transition: "all 0.15s ease",
  "&:hover": {
    background: isSelected
      ? "rgba(34, 211, 238, 0.12)"
      : "rgba(255,255,255,0.05)",
    borderColor: theme.palette.primary.light,
  },
}));

const FieldGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: theme.spacing(2),
}));

const ToggleGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: theme.spacing(1.5),
}));

const SourceContextCard = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: theme.spacing(1.5, 2),
  borderRadius: 10,
  background: "rgba(34, 211, 238, 0.04)",
  border: `1px solid rgba(34, 211, 238, 0.15)`,
}));

const ModeNoteCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: 12,
  background: "rgba(255, 255, 255, 0.03)",
  border: `1px solid ${theme.custom.border.default}`,
  display: "flex",
  flexDirection: "column",
  gap: 4,
}));

interface BuilderTabProps {
  form: FormState;
  localFiles: LocalUfdrFile[];
  onUpdateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onRefreshSources: () => void;
  sourceSummary: { value: string; note: string };
}

export function BuilderTab({
  form,
  localFiles,
  onUpdateField,
  onRefreshSources,
  sourceSummary,
}: BuilderTabProps) {
  const showDuplicationControls = form.executionMode === "duplicate";
  const showOutputPathField = form.executionMode === "duplicate";
  const showDuplicateDeliveryControls = form.executionMode === "duplicate";
  const showUploadOnlyControls = form.executionMode === "upload-only";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Request builder
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            Prepare the UFDR request
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Choose the operation, point it at a source, then adjust only the
            controls that matter for this mode.
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={onRefreshSources}
          sx={{ textTransform: "none" }}
        >
          Refresh sources
        </Button>
      </Box>

      {/* Step 1: Execution mode */}
      <Section>
        <StepHeader>
          <StepIndex>1</StepIndex>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              Execution mode
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Start by picking the kind of work this request should perform.
            </Typography>
          </Box>
        </StepHeader>
        <ChoiceGrid>
          {(
            [
              {
                id: "duplicate",
                label: "Duplicate",
                copy: "Create a new UFDR by expanding models and media.",
              },
              {
                id: "summary",
                label: "Summary",
                copy: "Inspect the source UFDR before deciding what to run.",
              },
              {
                id: "upload-only",
                label: "Upload Only",
                copy: "Send an existing local UFDR to S3 without cloning it.",
              },
            ] as const
          ).map((opt) => (
            <ChoiceCard
              key={opt.id}
              isSelected={form.executionMode === opt.id}
              onClick={() =>
                onUpdateField("executionMode", opt.id as ExecutionMode)
              }
            >
              <Typography variant="subtitle2" fontWeight={700}>
                {opt.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {opt.copy}
              </Typography>
            </ChoiceCard>
          ))}
        </ChoiceGrid>
      </Section>

      {/* Step 2: Source */}
      <Section>
        <StepHeader>
          <StepIndex>2</StepIndex>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              Source
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Pick where the runtime should read the UFDR from.
            </Typography>
          </Box>
        </StepHeader>
        <ChoiceGrid sx={{ gridTemplateColumns: "1fr 1fr" }}>
          <ChoiceCard
            isSelected={form.sourceMode === "local"}
            onClick={() => onUpdateField("sourceMode", "local")}
          >
            <Typography variant="subtitle2" fontWeight={700}>
              Local UFDR
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Choose a file from the runtime workspace.
            </Typography>
          </ChoiceCard>
          <ChoiceCard
            isSelected={form.sourceMode === "s3"}
            onClick={() => onUpdateField("sourceMode", "s3")}
          >
            <Typography variant="subtitle2" fontWeight={700}>
              S3 Evidence
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Stream the source from S3 using an evidence id.
            </Typography>
          </ChoiceCard>
        </ChoiceGrid>

        {form.sourceMode === "local" ? (
          <FormControl fullWidth size="small">
            <InputLabel>Local input</InputLabel>
            <Select
              value={form.selectedLocalFile}
              label="Local input"
              onChange={(e) =>
                onUpdateField("selectedLocalFile", e.target.value)
              }
            >
              {localFiles.length === 0 && (
                <MenuItem value="">No UFDR files found</MenuItem>
              )}
              {localFiles.map((f) => (
                <MenuItem key={f.path} value={f.path}>
                  {f.name} · {formatFileSize(f.size)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <TextField
            size="small"
            label="S3 evidence id"
            value={form.s3EvidenceId}
            onChange={(e) => onUpdateField("s3EvidenceId", e.target.value)}
            placeholder="e2e-integration-testing36/testing"
          />
        )}

        {showOutputPathField && (
          <TextField
            size="small"
            label="Output path"
            value={form.outputPath}
            onChange={(e) => onUpdateField("outputPath", e.target.value)}
            placeholder="outputs/seed_chat_heavy.ufdr"
            helperText="Optional destination for the generated UFDR."
          />
        )}

        <SourceContextCard>
          <Typography variant="caption" color="text.secondary">
            Active source
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {sourceSummary.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {sourceSummary.note}
          </Typography>
        </SourceContextCard>
      </Section>

      {/* Step 3/4: Model duplication + transforms or mode note */}
      {showDuplicationControls ? (
        <>
          <Section>
            <StepHeader>
              <StepIndex>3</StepIndex>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  Model duplication
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Pick how aggressive the runtime should be when cloning.
                </Typography>
              </Box>
            </StepHeader>
            <ChoiceGrid>
              {(
                [
                  {
                    id: "copies",
                    label: "Copies per original",
                    copy: "Multiply every model by the same amount.",
                  },
                  {
                    id: "uniform",
                    label: "Uniform target",
                    copy: "One shared total across all model types.",
                  },
                  {
                    id: "explicit",
                    label: "Explicit per type",
                    copy: "Set exact totals for each model family.",
                  },
                ] as const
              ).map((opt) => (
                <ChoiceCard
                  key={opt.id}
                  isSelected={form.modelMode === opt.id}
                  onClick={() =>
                    onUpdateField("modelMode", opt.id as ModelMode)
                  }
                >
                  <Typography variant="subtitle2" fontWeight={700}>
                    {opt.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {opt.copy}
                  </Typography>
                </ChoiceCard>
              ))}
            </ChoiceGrid>
            <FieldGrid>
              <TextField
                size="small"
                label="Model copies"
                type="number"
                value={form.modelCopies}
                disabled={form.modelMode !== "copies"}
                onChange={(e) => onUpdateField("modelCopies", e.target.value)}
                slotProps={{ htmlInput: { min: 0 } }}
              />
              <TextField
                size="small"
                label="Uniform target per type"
                type="number"
                value={form.uniformModelCount}
                disabled={form.modelMode !== "uniform"}
                onChange={(e) =>
                  onUpdateField("uniformModelCount", e.target.value)
                }
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <TextField
                size="small"
                label="Explicit type counts"
                value={form.explicitModelCounts}
                disabled={form.modelMode !== "explicit"}
                onChange={(e) =>
                  onUpdateField("explicitModelCounts", e.target.value)
                }
                placeholder="Chat=10,Contact=3"
                sx={{ gridColumn: "1 / -1" }}
              />
              <TextField
                size="small"
                label="Exclude model types"
                value={form.excludeModelTypes}
                disabled={form.modelMode !== "uniform"}
                onChange={(e) =>
                  onUpdateField("excludeModelTypes", e.target.value)
                }
                placeholder="Chat,Email"
                sx={{ gridColumn: "1 / -1" }}
              />
            </FieldGrid>
          </Section>

          <Section>
            <StepHeader>
              <StepIndex>4</StepIndex>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  Files and content transforms
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Optional media and text adjustments applied during
                  duplication.
                </Typography>
              </Box>
            </StepHeader>
            <FieldGrid>
              <TextField
                size="small"
                label="Tagged file copies"
                type="number"
                value={form.fileCopies}
                onChange={(e) => onUpdateField("fileCopies", e.target.value)}
                slotProps={{ htmlInput: { min: 0 } }}
              />
              <TextField
                size="small"
                label="Image scale"
                type="number"
                value={form.scale}
                onChange={(e) => onUpdateField("scale", e.target.value)}
                slotProps={{ htmlInput: { min: 0.01, step: 0.1 } }}
              />
              <TextField
                size="small"
                label="Audio sample rate"
                type="number"
                value={form.audioSr}
                onChange={(e) => onUpdateField("audioSr", e.target.value)}
                placeholder="48000"
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <TextField
                size="small"
                label="String repeat"
                type="number"
                value={form.strDataRepeat}
                onChange={(e) =>
                  onUpdateField("strDataRepeat", e.target.value)
                }
                placeholder="2"
                slotProps={{ htmlInput: { min: 2 } }}
              />
            </FieldGrid>
          </Section>
        </>
      ) : (
        <Section>
          <ModeNoteCard>
            <Typography variant="subtitle2" fontWeight={600}>
              {form.executionMode === "summary"
                ? "Summary mode is read-only."
                : "Upload-only sends the selected UFDR to S3 as-is."}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {form.executionMode === "summary"
                ? "Duplication settings are skipped until you switch back to Duplicate."
                : "Media transforms and generated-output settings are hidden because this mode reuses the source file."}
            </Typography>
          </ModeNoteCard>
        </Section>
      )}

      {/* Output and retention */}
      <Section>
        <StepHeader>
          <StepIndex>{showDuplicationControls ? "5" : "3"}</StepIndex>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              {showUploadOnlyControls
                ? "Upload behavior"
                : "Output and retention"}
            </Typography>
          </Box>
        </StepHeader>
        {showDuplicateDeliveryControls ? (
          <ToggleGrid>
            {(
              [
                {
                  key: "uploadToS3" as const,
                  label: "Upload generated UFDR",
                  copy: "Push the new UFDR to S3 after the run completes.",
                },
                {
                  key: "deleteExisting" as const,
                  label: "Replace existing object",
                  copy: "Delete existing S3 object when the key already exists.",
                },
                {
                  key: "keepExtracted" as const,
                  label: "Keep extracted folder",
                  copy: "Preserve extracted workspace after completion.",
                },
                {
                  key: "noUpload" as const,
                  label: "Keep local only",
                  copy: "Skip S3 upload even if upload options are enabled.",
                },
              ] as const
            ).map((toggle) => (
              <FormControlLabel
                key={toggle.key}
                control={
                  <Checkbox
                    size="small"
                    checked={form[toggle.key]}
                    onChange={(e) =>
                      onUpdateField(toggle.key, e.target.checked)
                    }
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {toggle.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {toggle.copy}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", m: 0 }}
              />
            ))}
          </ToggleGrid>
        ) : showUploadOnlyControls ? (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={form.deleteExisting}
                onChange={(e) =>
                  onUpdateField("deleteExisting", e.target.checked)
                }
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Replace existing object
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Delete existing S3 object when the key already exists.
                </Typography>
              </Box>
            }
            sx={{ alignItems: "flex-start", m: 0 }}
          />
        ) : (
          <ModeNoteCard>
            <Typography variant="subtitle2" fontWeight={600}>
              Summary mode stops before file creation.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              No output file or upload settings are applied.
            </Typography>
          </ModeNoteCard>
        )}
      </Section>
    </Box>
  );
}
