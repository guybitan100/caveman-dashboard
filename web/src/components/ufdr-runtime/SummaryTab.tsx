import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import DescriptionIcon from "@mui/icons-material/Description";

const CommandBlock = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderRadius: 10,
  background: "rgba(5, 12, 22, 0.8)",
  border: `1px solid ${theme.custom.border.default}`,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.78rem",
  color: "#c8d8e8",
  wordBreak: "break-all",
}));

const SummaryPre = styled("pre")(({ theme }) => ({
  margin: 0,
  padding: theme.spacing(2),
  borderRadius: 14,
  background: "rgba(5, 12, 22, 0.85)",
  border: `1px solid ${theme.custom.border.default}`,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: "0.8rem",
  lineHeight: 1.7,
  color: "#c8d8e8",
  overflow: "auto",
  maxHeight: 500,
  "&::-webkit-scrollbar": { width: 6 },
  "&::-webkit-scrollbar-thumb": {
    background: "rgba(255,255,255,0.15)",
    borderRadius: 3,
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

interface SummaryTabProps {
  summaryOutput: string;
  summaryCommand: string;
}

export function SummaryTab({ summaryOutput, summaryCommand }: SummaryTabProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          Inspection
        </Typography>
        <Typography variant="h6" fontWeight={700}>
          Summary Output
        </Typography>
      </Box>

      {summaryCommand && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            Last summary command
          </Typography>
          <CommandBlock>
            <code>{summaryCommand}</code>
          </CommandBlock>
        </Box>
      )}

      {summaryOutput ? (
        <SummaryPre>{summaryOutput}</SummaryPre>
      ) : (
        <EmptyState>
          <DescriptionIcon sx={{ fontSize: 40, opacity: 0.3 }} />
          <Typography variant="body2" fontWeight={600}>
            No summary yet
          </Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Preview the source before you launch when you want a quick read on
            model counts, file totals, and type distribution.
          </Typography>
        </EmptyState>
      )}
    </Box>
  );
}
