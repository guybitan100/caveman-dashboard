import { createTheme } from "@mui/material/styles";

import { palette } from "./palette";
import { typography } from "./typography";
import { shadows } from "./shadows";
import { components } from "./components";
import "./augmentation";

// Re-export all modules for external use
export { palette, type Palette } from "./palette";
export { typography } from "./typography";
export { shadows, shadowTokens } from "./shadows";
export { components } from "./components";
export { colors } from "./legacy";

const baseTheme = createTheme({
  palette: {
    mode: "dark",

    primary: {
      main: palette.primary.main,
      light: palette.primary.light,
      dark: palette.primary.dark,
      contrastText: palette.primary.contrastText,
    },

    secondary: {
      main: palette.secondary.main,
      light: palette.secondary.light,
      dark: palette.secondary.dark,
      contrastText: palette.secondary.contrastText,
    },

    background: {
      default: palette.background.default,
      paper: palette.background.paper,
    },

    text: {
      primary: palette.text.primary,
      secondary: palette.text.secondary,
      disabled: palette.text.disabled,
    },

    success: {
      main: palette.status.success.main,
      dark: palette.status.success.dark,
      light: palette.status.success.light,
    },

    warning: {
      main: palette.status.warning.main,
      dark: palette.status.warning.dark,
      light: palette.status.warning.light,
    },

    error: {
      main: palette.status.error.main,
      dark: palette.status.error.dark,
      light: palette.status.error.light,
    },

    info: {
      main: palette.status.info.main,
      dark: palette.status.info.dark,
      light: palette.status.info.light,
    },

    divider: palette.border.default,

    action: {
      hover: palette.surface.white8,
      selected: palette.surface.primary15,
      disabled: palette.text.disabled,
      focus: palette.surface.primary20,
    },
  },

  typography,
  shadows,
  components,

  shape: {
    borderRadius: 16,
  },
});

// Add custom properties to theme
const theme = createTheme(baseTheme, {
  custom: {
    palette,
    gradients: palette.gradients,
    status: palette.status,
    surface: palette.surface,
    border: palette.border,
    eventCategory: palette.eventCategory,
    relationship: palette.relationship,
  },
});

export default theme;
