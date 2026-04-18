import { Box, Typography, Button, LinearProgress, Chip } from "@mui/material";
import { styled } from "@mui/material/styles";
import TerminalIcon from "@mui/icons-material/Terminal";
import type { RuntimeJobSnapshot, FormState } from "../../types/ufdrRuntime.ts";
import {
  formatDate,
  buildCommandPreview,
  describeExecutionMode,
  describeOutputPolicy,
  describeDeliveryPolicy,
  describeSourceSummary,
} from "../../utils/ufdrRuntime.ts";
import { RUNTIME_STATUS_LABELS } from "../../types/ufdrRuntime.ts";
import { ConsolePanel } from "./ConsolePanel.tsx";

const SummaryGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: theme.spacing(1.5),
}));

const SummaryCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderRadius: 12,
  background: "rgba(10, 24, 40, 0.45)",
  border: `1px solid ${theme.custom.border.default}`,
  display: "flex",
  flexDirection: "column",
  gap: 2,
}));

const CommandPreview = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderRadius: 10,
  background: "rgba(5, 12, 22, 0.8)",
  border: `1px solid ${theme.custom.border.default}`,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.78rem",
  color: "#c8d8e8",
  wordBreak: "break-all",
}));

const statusColors: Record<string, string> = {
  idle: "#9db2ca",
  running: "#22d3ee",
  completed: "#4ade80",
  failed: "#ff6b7a",
  cancelled: "#f7c65f",
};

interface LaunchTabProps {
  job: RuntimeJobSnapshot;
  form: FormState;
  selectedFileDetails: { name: string; path: string; size: number } | null;
  isRunning: boolean;
  canSubmit: boolean;
  busyAction: "summary" | "run" | "cancel" | null;
  consoleVisible: boolean;
  consolePoppedOut: boolean;
  onPrimaryAction: () => void;
  onPreviewSummary: () => void;
  onCancelRun: () => void;
  onToggleConsole: () => void;
  onTogglePopout: () => void;
}

export function LaunchTab({
  job,
  form,
  selectedFileDetails,
  isRunning,
  canSubmit,
  busyAction,
  consoleVisible,
  consolePoppedOut,
  onPrimaryAction,
  onPreviewSummary,
  onCancelRun,
  onToggleConsole,
  onTogglePopout,
}: LaunchTabProps) {
  const statusLabel =
    job.cancellationRequested && job.status === "running"
      ? "Stopping"
      : RUNTIME_STATUS_LABELS[job.status] ?? job.status;
  const executionSummary = describeExecutionMode(
    form.executionMode,
    form.modelMode
  );
  const sourceSummary = describeSourceSummary(form, selectedFileDetails);
  const outputSummary = describeOutputPolicy(form);
  const deliverySummary = describeDeliveryPolicy(form);
  const commandPreview = job.commandLine || buildCommandPreview(form);
  const primaryLabel =
    form.executionMode === "summary"
      ? "Generate Summary"
      : form.executionMode === "upload-only"
        ? "Upload UFDR"
        : "Start Creation";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Launch
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            Launch Review
          </Typography>
        </Box>
        <Chip
          label={statusLabel}
          size="small"
          sx={{
            fontWeight: 700,
            color: statusColors[job.status] ?? "#9db2ca",
            borderColor: statusColors[job.status] ?? "#9db2ca",
          }}
          variant="outlined"
        />
      </Box>

      {isRunning && (
        <LinearProgress
          sx={{
            borderRadius: 4,
            height: 3,
            "& .MuiLinearProgress-bar": {
              background:
                "linear-gradient(90deg, #22d3ee, #6dbfff, #22d3ee)",
              backgroundSize: "200% 100%",
              animation: "gradient-shift 2s linear infinite",
            },
            "@keyframes gradient-shift": {
              "0%": { backgroundPosition: "200% 0" },
              "100%": { backgroundPosition: "-200% 0" },
            },
          }}
        />
      )}

      {/* Summary cards */}
      <SummaryGrid>
        {[
          {
            label: "Operation",
            value: executionSummary.value,
            note: executionSummary.note,
          },
          {
            label: "Source",
            value: sourceSummary.value,
            note: sourceSummary.note,
          },
          {
            label: "Output",
            value: outputSummary.value,
            note: outputSummary.note,
          },
          {
            label: "Delivery",
            value: deliverySummary.value,
            note: deliverySummary.note,
          },
        ].map((item) => (
          <SummaryCard key={item.label}>
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {item.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.note}
            </Typography>
          </SummaryCard>
        ))}
      </SummaryGrid>

      {/* Actions */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          onClick={onPrimaryAction}
          disabled={!canSubmit || busyAction !== null || isRunning}
          sx={{ textTransform: "none" }}
        >
          {busyAction === "run" || busyAction === "summary"
            ? "Working…"
            : primaryLabel}
        </Button>
        <Button
          variant="outlined"
          onClick={onPreviewSummary}
          disabled={!canSubmit || busyAction !== null || isRunning}
          sx={{ textTransform: "none" }}
        >
          Preview Summary
        </Button>
        <Button
          size="small"
          startIcon={<TerminalIcon />}
          onClick={onToggleConsole}
          sx={{
            textTransform: "none",
            color: consoleVisible || consolePoppedOut
              ? "primary.light"
              : "text.secondary",
          }}
        >
          {consoleVisible || consolePoppedOut ? "Close Log" : "Log"}
        </Button>
        <Button
          color="error"
          size="small"
          onClick={onCancelRun}
          disabled={!isRunning || busyAction === "cancel"}
          sx={{ textTransform: "none", ml: "auto" }}
        >
          {busyAction === "cancel" ? "Stopping…" : "Stop Active Run"}
        </Button>
      </Box>

      {/* Command preview */}
      <Box>
        <Typography variant="overline" color="text.secondary">
          Command preview
        </Typography>
        <CommandPreview>
          <code>{commandPreview}</code>
        </CommandPreview>
      </Box>

      {/* Meta */}
      <Box
        sx={{
          display: "flex",
          gap: 3,
          color: "text.secondary",
          fontSize: "0.75rem",
        }}
      >
        <span>Started: {formatDate(job.startedAt)}</span>
        <span>Finished: {formatDate(job.endedAt)}</span>
        <span>Exit: {job.exitCode ?? "—"}</span>
      </Box>

      {/* Console */}
      <ConsolePanel
        lines={job.logs}
        visible={consoleVisible}
        poppedOut={consolePoppedOut}
        onToggle={onToggleConsole}
        onPopout={onTogglePopout}
      />
    </Box>
  );
}
