import { Box, Typography, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";

export const CollapsibleSection = styled(Box)(({ theme }) => ({
  borderBottom: `1px solid ${theme.custom.border.default}`,
}));

export const CollapsibleHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1.5, 2.5),
  cursor: "pointer",
  transition: "background-color 0.2s ease",

  "&:hover": {
    backgroundColor: theme.custom.surface.white5,
  },
}));

export const SectionLabel = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.25),
}));

export const SectionIcon = styled(Box)(({ theme }) => ({
  color: theme.palette.info.main,
  display: "flex",
  alignItems: "center",
}));

export const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.primary,
}));

export const SectionCount = styled(Typography)(({ theme }) => ({
  fontSize: "0.75rem",
  color: theme.custom.palette.text.hint,
  marginLeft: theme.spacing(1),
}));

export const ExpandButton = styled(IconButton)(({ theme }) => ({
  padding: 4,
  color: theme.custom.palette.text.hint,
}));

export const ContentScroll = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",

  "&::-webkit-scrollbar": {
    width: 6,
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: theme.custom.surface.primary40,
    borderRadius: 3,
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: theme.palette.primary.light,
  },
}));

export const EmptyState = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(5, 2.5),
  color: theme.custom.palette.text.hint,
  textAlign: "center",
}));

export const InfoRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

export const InfoLabel = styled(Typography)(({ theme }) => ({
  fontSize: "0.75rem",
  color: theme.palette.text.disabled,
  minWidth: 80,
}));

export const InfoValue = styled(Typography)(({ theme }) => ({
  fontSize: "0.8125rem",
  color: theme.palette.text.primary,
  flex: 1,
}));
