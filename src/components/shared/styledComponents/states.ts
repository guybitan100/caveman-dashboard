import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

/**
 * Empty state container.
 * Centered content with muted text color.
 * Use when there's no data to display.
 */
export const EmptyState = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(5, 2.5),
  color: theme.custom.palette.text.hint,
  textAlign: "center",
}));

/**
 * Compact empty state with less padding.
 */
export const EmptyStateCompact = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(3, 2),
  color: theme.custom.palette.text.hint,
  textAlign: "center",
}));

/**
 * Loading state container.
 * Centered layout for spinner/skeleton.
 */
export const LoadingState = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 20px",
  gap: 16,
});

/**
 * Error state container.
 * Similar to empty state but for errors.
 */
export const ErrorState = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(5, 2.5),
  color: theme.palette.error.main,
  textAlign: "center",
}));

/**
 * Scrollable content area with custom scrollbar.
 * Use for lists and content that may overflow.
 */
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
