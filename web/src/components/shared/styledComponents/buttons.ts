import { Button, IconButton, MenuItem } from "@mui/material";
import { styled } from "@mui/material/styles";

/**
 * Small icon button for inline actions (edit, view, etc).
 * Use for action buttons in lists and cards.
 */
export const ActionButton = styled(IconButton)(({ theme }) => ({
  padding: theme.spacing(0.75),
  color: theme.custom.palette.text.muted,
  "&:hover": {
    backgroundColor: theme.custom.surface.white10,
    color: theme.palette.text.primary,
  },
}));

/**
 * Compact action button with smaller padding.
 */
export const ActionButtonCompact = styled(IconButton)(({ theme }) => ({
  padding: 4,
  color: theme.custom.palette.text.muted,
  "&:hover": {
    backgroundColor: theme.custom.surface.white10,
    color: theme.palette.text.primary,
  },
}));

/**
 * Delete action button with red hover state.
 * Use for delete/remove actions.
 */
export const DeleteButton = styled(IconButton)(({ theme }) => ({
  padding: theme.spacing(0.75),
  color: theme.custom.palette.text.muted,
  "&:hover": {
    backgroundColor: theme.custom.status.error.background,
    color: theme.palette.error.main,
  },
}));

/**
 * Compact delete button.
 */
export const DeleteButtonCompact = styled(IconButton)(({ theme }) => ({
  padding: 4,
  color: theme.palette.text.secondary,
  "&:hover": {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: theme.palette.error.main,
  },
}));

/**
 * Menu item for "Create New" actions in dropdowns.
 * Primary colored with separator border.
 */
export const CreateNewMenuItem = styled(MenuItem)(({ theme }) => ({
  color: theme.palette.primary.main,
  borderTop: `1px solid ${theme.custom.border.default}`,
  marginTop: theme.spacing(0.5),
  paddingTop: theme.spacing(1),
  "&:hover": {
    backgroundColor: theme.custom.surface.primary10,
  },
}));

/**
 * Primary action button.
 * Use for main actions in dialogs and forms.
 */
export const PrimaryButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  "&:hover": {
    backgroundColor: theme.palette.primary.dark,
  },
  "&:disabled": {
    backgroundColor: theme.custom.surface.white10,
  },
}));

/**
 * Secondary/cancel button.
 * Use for secondary actions and cancel buttons.
 */
export const SecondaryButton = styled(Button)(({ theme }) => ({
  color: theme.palette.text.secondary,
  "&:hover": {
    backgroundColor: theme.custom.surface.white10,
  },
}));

/**
 * Outlined button with theme border.
 * Use for secondary actions that need more emphasis.
 */
export const OutlinedButton = styled(Button)(({ theme }) => ({
  borderColor: theme.custom.border.default,
  color: theme.palette.text.secondary,
  "&:hover": {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.custom.surface.primary15,
    color: theme.palette.primary.main,
  },
}));

/**
 * Expand/collapse button.
 */
export const ExpandButton = styled(IconButton)(({ theme }) => ({
  padding: 4,
  color: theme.custom.palette.text.hint,
}));
