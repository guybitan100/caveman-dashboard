// =============================================================================
// LEGACY COLORS
// =============================================================================
// These colors are kept for backwards compatibility with existing code.
// Prefer using the new palette tokens instead.
// =============================================================================

/**
 * @deprecated Use `palette` from './palette' instead
 */
export const colors = {
  // Primary brand colors
  orange: "#ff9f6b",
  darkBlue: "#0b1c2f",
  darkBlue2: "#123048",

  // Blues
  blue1: "#22d3ee",
  blue2: "#67e8f9",

  // Grays
  grey1: "#8ca3ba",
  grey2: "#5f768d",
  darkGrey1: "#123048",
  darkGrey2: "#20374e",
  lightGrey1: "#d9e7f4",
  lightGrey2: "#eef6ff",
  lightGrey3: "#f6fbff",
  lightGrey4: "#d2dfec",

  // Status colors
  success: "#84cc16",
  warning: "#f7c65f",
  error: "#ef4444",
  running: "#22d3ee",
  queued: "#00897b",
  cancelled: "#9a9a9a",

  // Light status backgrounds
  lightGreen: "#ecfccb",
  lightTurquoise: "#d9fbff",
  lightRed: "#fee2e2",
  lightOrange: "#ffedd5",
  lightYellow: "#fef3c7",

  // Base
  white: "#ffffff",
  black: "#000000",
} as const;
