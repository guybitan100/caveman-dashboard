import type { Theme } from "@mui/material/styles";

/**
 * Standard scrollbar styles using theme colors.
 * Width: 6px, transparent track, themed thumb.
 */
export const scrollbarStyles = (theme: Theme) => ({
  "&::-webkit-scrollbar": {
    width: 6,
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: theme.custom.surface.white15,
    borderRadius: 3,
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor:
      theme.custom.surface.white20 ?? theme.custom.surface.white15,
  },
});

/**
 * Primary-colored scrollbar for content areas.
 */
export const primaryScrollbarStyles = (theme: Theme) => ({
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
});

/**
 * Thin scrollbar variant (4px width).
 */
export const thinScrollbarStyles = (theme: Theme) => ({
  "&::-webkit-scrollbar": {
    width: 4,
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: theme.custom.surface.white15,
    borderRadius: 2,
  },
});

/**
 * Hidden scrollbar that still allows scrolling.
 */
export const hiddenScrollbarStyles = () => ({
  "&::-webkit-scrollbar": {
    display: "none",
  },
  scrollbarWidth: "none" as const,
  msOverflowStyle: "none" as const,
});
