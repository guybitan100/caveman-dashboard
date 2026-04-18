import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  Typography,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import TerminalIcon from "@mui/icons-material/Terminal";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloseIcon from "@mui/icons-material/Close";
import type { LogFilter } from "../../types/ufdrRuntime.ts";
import { classifyLogLine, classifyLogFilter } from "../../utils/ufdrRuntime.ts";

const LOG_TAIL_LINES = 1000;

const logLevelColors: Record<string, string> = {
  error: "#ff6b7a",
  warning: "#f7c65f",
  success: "#4ade80",
  debug: "#9db2ca",
  info: "#22d3ee",
  trace: "#7c8fa0",
  plain: "#c8d8e8",
};

const ConsoleRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== "poppedOut",
})<{ poppedOut?: boolean }>(({ theme, poppedOut }) => ({
  display: "flex",
  flexDirection: "column",
  background: "rgba(5, 12, 22, 0.92)",
  border: `1px solid ${theme.custom.border.default}`,
  borderRadius: poppedOut ? 20 : 16,
  overflow: "hidden",
  ...(poppedOut && {
    width: "80vw",
    maxWidth: 1100,
    height: "70vh",
    boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
  }),
}));

const ConsoleHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1.5, 2),
  borderBottom: `1px solid ${theme.custom.border.default}`,
  background: "rgba(10, 22, 38, 0.6)",
  gap: theme.spacing(1),
  flexWrap: "wrap",
}));

const ConsoleTitle = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

const ConsoleToolbar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

const LogOutput = styled("pre")(({ theme }) => ({
  flex: 1,
  margin: 0,
  padding: theme.spacing(2),
  overflow: "auto",
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: "0.8rem",
  lineHeight: 1.7,
  color: "#c8d8e8",
  minHeight: 120,
  maxHeight: 500,
  "&::-webkit-scrollbar": {
    width: 6,
  },
  "&::-webkit-scrollbar-thumb": {
    background: "rgba(255,255,255,0.15)",
    borderRadius: 3,
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(4),
  color: theme.palette.text.secondary,
  minHeight: 120,
}));

const PopoutOverlay = styled(Box)({
  position: "fixed",
  inset: 0,
  zIndex: 1300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(6px)",
});

interface ConsolePanelProps {
  lines: string[];
  visible: boolean;
  poppedOut: boolean;
  onToggle: () => void;
  onPopout: () => void;
}

export function ConsolePanel({
  lines,
  visible,
  poppedOut,
  onToggle,
  onPopout,
}: ConsolePanelProps) {
  const ref = useRef<HTMLPreElement>(null);
  const [filter, setFilter] = useState<LogFilter>("all");
  const tail =
    lines.length > LOG_TAIL_LINES ? lines.slice(-LOG_TAIL_LINES) : lines;
  const filtered =
    filter === "all"
      ? tail
      : tail.filter((line) => classifyLogFilter(line) === filter);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [filtered]);

  if (!visible && !poppedOut) return null;

  const content = (
    <ConsoleRoot poppedOut={poppedOut}>
      <ConsoleHeader>
        <ConsoleTitle>
          <TerminalIcon sx={{ fontSize: 18, color: "primary.light" }} />
          <Box>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", display: "block" }}
            >
              Runtime Console
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              Live Log Stream
            </Typography>
          </Box>
        </ConsoleTitle>
        <ConsoleToolbar>
          <Select
            size="small"
            value={filter}
            onChange={(e) => setFilter(e.target.value as LogFilter)}
            sx={{
              fontSize: "0.75rem",
              height: 30,
              minWidth: 90,
              "& .MuiSelect-select": { py: 0.5 },
            }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="error">Errors</MenuItem>
            <MenuItem value="warning">Warnings</MenuItem>
            <MenuItem value="info">Info</MenuItem>
          </Select>
          <Typography variant="caption" color="text.secondary">
            {filtered.length} lines
          </Typography>
          <Tooltip title={poppedOut ? "Dock log" : "Pop out log"}>
            <IconButton size="small" onClick={onPopout}>
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Hide log">
            <IconButton size="small" onClick={onToggle}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </ConsoleToolbar>
      </ConsoleHeader>

      {filtered.length > 0 ? (
        <LogOutput ref={ref}>
          {filtered.map((line, i) => {
            const level = classifyLogLine(line);
            return (
              <span key={i} style={{ color: logLevelColors[level] }}>
                {line + "\n"}
              </span>
            );
          })}
        </LogOutput>
      ) : (
        <EmptyState>
          <TerminalIcon sx={{ fontSize: 32, opacity: 0.4 }} />
          <Typography variant="body2" fontWeight={600}>
            Awaiting stream
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Workflow output appears here once a preview or creation action
            starts
          </Typography>
        </EmptyState>
      )}
    </ConsoleRoot>
  );

  if (poppedOut) {
    return createPortal(
      <PopoutOverlay onClick={(e) => e.target === e.currentTarget && onPopout()}>
        {content}
      </PopoutOverlay>,
      document.body
    );
  }

  return content;
}
