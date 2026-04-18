import {
  Box,
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { scrollbarStyles } from "./scrollbar";

/**
 * Base dialog with dark theme styling.
 * Use for all modal dialogs in the application.
 */
export const StyledDialog = styled(Dialog)(({ theme }) => ({
  "& .MuiDialog-paper": {
    backgroundColor: theme.palette.background.paper,
    backgroundImage: "none",
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.custom.border.light}`,
    minWidth: 480,
    maxWidth: 560,
  },
}));

/**
 * Wide dialog variant for forms that need more space.
 */
export const WideDialog = styled(Dialog)(({ theme }) => ({
  "& .MuiDialog-paper": {
    backgroundColor: theme.palette.background.paper,
    backgroundImage: "none",
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.custom.border.light}`,
    width: 600,
    maxWidth: 600,
  },
}));

/**
 * Narrow dialog variant for simple confirmations.
 */
export const NarrowDialog = styled(Dialog)(({ theme }) => ({
  "& .MuiDialog-paper": {
    backgroundColor: theme.palette.background.paper,
    backgroundImage: "none",
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.custom.border.light}`,
    width: 450,
    maxWidth: 450,
  },
}));

/**
 * Dialog header with space-between layout.
 * Contains HeaderContent on left and CloseButton on right.
 */
export const DialogHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.custom.border.default}`,
}));

/**
 * Left side of DialogHeader containing icon and title.
 */
export const HeaderContent = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

/**
 * Icon wrapper for dialog header.
 * Provides consistent sizing and background.
 */
export const HeaderIconWrapper = styled(Box)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.custom.surface.primary15,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: theme.palette.primary.main,
}));

/**
 * Dialog title text.
 */
export const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontSize: "1rem",
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.primary,
}));

/**
 * Optional subtitle below the header title.
 */
export const HeaderSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: "0.75rem",
  color: theme.custom.palette.text.muted,
}));

/**
 * Close button for dialogs.
 * Positioned in the top-right of DialogHeader.
 */
export const CloseButton = styled(IconButton)(({ theme }) => ({
  color: theme.custom.palette.text.muted,
  "&:hover": {
    backgroundColor: theme.custom.surface.white10,
    color: theme.palette.text.primary,
  },
}));

/**
 * Back navigation button.
 * Used when dialogs have multi-step flows.
 */
export const BackButton = styled(IconButton)(({ theme }) => ({
  color: theme.custom.palette.text.muted,
  marginRight: theme.spacing(0.5),
  "&:hover": {
    backgroundColor: theme.custom.surface.white10,
    color: theme.palette.text.primary,
  },
}));

/**
 * Scrollable dialog content area with custom scrollbar.
 */
export const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(2.5, 3),
  maxHeight: 480,
  overflowY: "auto",
  ...scrollbarStyles(theme),
}));

/**
 * Taller dialog content for forms with more fields.
 */
export const TallDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(2.5, 3),
  maxHeight: 520,
  overflowY: "auto",
  ...scrollbarStyles(theme),
}));

/**
 * Dialog footer with action buttons.
 * Has top border and consistent spacing.
 */
export const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.custom.border.default}`,
  gap: theme.spacing(1),
}));
