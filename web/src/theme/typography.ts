// =============================================================================
// SiX TYPOGRAPHY
// =============================================================================
// Typography configuration for the SiX application.
// =============================================================================

import { TypographyOptions } from "@mui/material/styles/createTypography";
import { palette } from "./palette";

/**
 * Typography configuration
 */
export const typography: TypographyOptions = {
  fontFamily: '"Space Grotesk", "Soehne", "Helvetica Neue", sans-serif',

  h1: {
    fontFamily: '"Manrope", "Space Grotesk", sans-serif',
    fontSize: "2.75rem",
    fontWeight: 800,
    color: palette.text.primary,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
  },

  h2: {
    fontFamily: '"Manrope", "Space Grotesk", sans-serif',
    fontSize: "2.15rem",
    fontWeight: 800,
    color: palette.text.primary,
    lineHeight: 1.15,
    letterSpacing: "-0.025em",
  },

  h3: {
    fontFamily: '"Manrope", "Space Grotesk", sans-serif',
    fontSize: "1.5rem",
    fontWeight: 700,
    color: palette.text.primary,
    lineHeight: 1.25,
  },

  h4: {
    fontFamily: '"Manrope", "Space Grotesk", sans-serif',
    fontSize: "1.25rem",
    fontWeight: 700,
    color: palette.text.primary,
    lineHeight: 1.3,
  },

  h5: {
    fontFamily: '"Manrope", "Space Grotesk", sans-serif',
    fontSize: "1.1rem",
    fontWeight: 700,
    color: palette.text.primary,
    lineHeight: 1.5,
  },

  h6: {
    fontFamily: '"Manrope", "Space Grotesk", sans-serif',
    fontSize: "1rem",
    fontWeight: 700,
    color: palette.text.primary,
    lineHeight: 1.5,
  },

  subtitle1: {
    fontSize: "1rem",
    fontWeight: 600,
    color: palette.text.secondary,
    lineHeight: 1.5,
  },

  subtitle2: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: palette.text.secondary,
    lineHeight: 1.5,
  },

  body1: {
    fontSize: "1rem",
    color: palette.text.primary,
    lineHeight: 1.6,
  },

  body2: {
    fontSize: "0.875rem",
    color: palette.text.secondary,
    lineHeight: 1.6,
  },

  caption: {
    fontSize: "0.75rem",
    color: palette.text.muted,
    lineHeight: 1.5,
  },

  overline: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: palette.text.muted,
    lineHeight: 1.5,
  },

  button: {
    fontSize: "0.875rem",
    fontWeight: 700,
    textTransform: "none",
    lineHeight: 1.5,
  },
};
