// =============================================================================
// Titan SHADOWS
// =============================================================================
// Shadow configuration for the Titan application.
// =============================================================================

import { Shadows } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import { palette } from "./palette";

/**
 * Custom shadows array for MUI theme
 * MUI requires exactly 25 shadow values (indices 0-24)
 */
export const shadows: Shadows = [
  // 0 - none
  "none",
  // 1-12 - Standard elevation shadows (dark theme optimized)
  `0 2px 6px rgba(1, 12, 26, 0.18)`,
  `0 6px 14px rgba(1, 12, 26, 0.22)`,
  `0 10px 20px rgba(1, 12, 26, 0.26)`,
  `0 12px 24px rgba(1, 12, 26, 0.3)`,
  `0 14px 28px rgba(1, 12, 26, 0.34)`,
  `0 18px 34px rgba(1, 12, 26, 0.38)`,
  `0 22px 40px rgba(1, 12, 26, 0.42)`,
  `0 24px 44px rgba(1, 12, 26, 0.46)`,
  `0 26px 48px rgba(1, 12, 26, 0.5)`,
  `0 28px 52px rgba(1, 12, 26, 0.54)`,
  `0 30px 56px rgba(1, 12, 26, 0.58)`,
  `0 34px 60px rgba(1, 12, 26, 0.62)`,
  // 13-15 - Primary glow shadows
  `0 0 20px ${alpha(palette.primary.main, 0.1)}`, // Light glow
  `0 0 20px ${alpha(palette.primary.main, 0.15)}`, // Medium glow
  `0 0 20px ${alpha(palette.primary.main, 0.2)}`, // Strong glow
  // 16-18 - Secondary (orange) glow shadows
  `0 0 20px ${alpha(palette.secondary.main, 0.1)}`,
  `0 0 20px ${alpha(palette.secondary.main, 0.15)}`,
  `0 0 20px ${alpha(palette.secondary.main, 0.2)}`,
  // 19-20 - Button shadows
  `0 4px 15px ${alpha(palette.primary.main, 0.4)}`, // Button shadow
  `0 6px 20px ${alpha(palette.primary.main, 0.5)}`, // Button hover shadow
  // 21-24 - Special purpose shadows
  `0 25px 50px -12px rgba(1, 12, 26, 0.5)`,
  `0 10px 40px rgba(1, 12, 26, 0.4)`,
  `0 4px 24px rgba(1, 12, 26, 0.18)`,
  `0 0 30px rgba(34, 211, 238, 0.24)`,
];

/**
 * Named shadow tokens for easier access
 */
export const shadowTokens = {
  none: shadows[0],
  // Elevation
  elevation1: shadows[1],
  elevation2: shadows[2],
  elevation3: shadows[3],
  elevation4: shadows[4],
  elevation5: shadows[5],
  elevation6: shadows[6],
  elevation8: shadows[8],
  elevation12: shadows[12],
  // Primary glow
  primaryGlowLight: shadows[13],
  primaryGlowMedium: shadows[14],
  primaryGlowStrong: shadows[15],
  // Secondary glow
  secondaryGlowLight: shadows[16],
  secondaryGlowMedium: shadows[17],
  secondaryGlowStrong: shadows[18],
  // Button
  button: shadows[19],
  buttonHover: shadows[20],
  // Special
  card: shadows[21],
  dropdown: shadows[22],
  subtle: shadows[23],
  purpleGlow: shadows[24],
} as const;
