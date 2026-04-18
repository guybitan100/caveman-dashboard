/**
 * Core brand color palette
 */
export const palette = {
  primary: {
    main: "#22d3ee",
    light: "#67e8f9",
    lighter: "#baf6ff",
    dark: "#0ea5c6",
    contrastText: "#042334",
  },
  secondary: {
    main: "#ff9f6b",
    light: "#ffc29c",
    dark: "#f67b44",
    contrastText: "#1c130d",
  },
  background: {
    default: "#07121f",
    paper: "rgba(11, 28, 47, 0.92)",
    card: "rgba(15, 34, 54, 0.88)",
    input: "#08131f",
    elevated: "rgba(9, 23, 37, 0.96)",
    overlay: "rgba(2, 10, 18, 0.58)",
  },
  gradients: {
    deepPurple: "#07121f",
    midPurple: "#0b1c2f",
    navy: "#123048",
    darkNavy: "#0a1628",
    space: "#07121f",
    primaryButton: "linear-gradient(135deg, #22d3ee 0%, #58e7c3 100%)",
    primaryButtonHover: "linear-gradient(135deg, #67e8f9 0%, #7cf0d5 100%)",
    goButton: "linear-gradient(180deg, #22d3ee 0%, #1194bb 100%)",
    pageBackground:
      "radial-gradient(circle at 0% 0%, rgba(34, 211, 238, 0.1), transparent 28%), radial-gradient(circle at 100% 0%, rgba(255, 159, 107, 0.08), transparent 24%), linear-gradient(160deg, #07121f 0%, #0b1c2f 44%, #091521 100%)",
    panelGlow:
      "radial-gradient(circle at 12% 0%, rgba(34, 211, 238, 0.1) 0%, rgba(7, 18, 31, 0) 34%), linear-gradient(180deg, rgba(14, 35, 54, 0.78), rgba(8, 19, 30, 0.92))",
    purpleGlow:
      "radial-gradient(circle, rgba(34, 211, 238, 0.16) 0%, transparent 70%)",
  },
  text: {
    primary: "#eef6ff",
    secondary: "#c5d7e8",
    tertiary: "#9db2ca",
    muted: "#7e94ac",
    placeholder: "#8ca3ba",
    disabled: "#5f768d",
    hint: "#4c6178",
  },
  status: {
    success: {
      main: "#bef264",
      dark: "#84cc16",
      light: "#d9f99d",
      background: "rgba(190, 242, 100, 0.14)",
    },
    error: {
      main: "#f87171",
      dark: "#ef4444",
      light: "#fca5a5",
      background: "rgba(239, 68, 68, 0.15)",
    },
    warning: {
      main: "#f7c65f",
      dark: "#f59e0b",
      light: "#fbbf24",
      background: "rgba(245, 158, 11, 0.15)",
    },
    info: {
      main: "#22d3ee",
      dark: "#0ea5c6",
      light: "#67e8f9",
      background: "rgba(34, 211, 238, 0.14)",
    },
    converting: {
      main: "#67e8f9",
      background: "rgba(103, 232, 249, 0.14)",
    },
    finalizing: {
      main: "#58e7c3",
      background: "rgba(88, 231, 195, 0.15)",
    },
    draft: {
      main: "#9CA3AF",
      background: "rgba(156, 163, 175, 0.15)",
    },
    cancelled: {
      main: "#6B7280",
      background: "rgba(107, 114, 128, 0.15)",
    },
    deleted: {
      main: "#374151",
      background: "rgba(55, 65, 81, 0.15)",
    },
  },
  border: {
    default: "rgba(151, 220, 255, 0.12)",
    light: "rgba(151, 220, 255, 0.16)",
    medium: "rgba(151, 220, 255, 0.22)",
    focus: "rgba(34, 211, 238, 0.45)",
    error: "#f87171",
    active: "#22d3ee",
    orange: "rgba(255, 159, 107, 0.3)",
  },
  surface: {
    white5: "rgba(255, 255, 255, 0.04)",
    white8: "rgba(255, 255, 255, 0.07)",
    white10: "rgba(255, 255, 255, 0.1)",
    white15: "rgba(255, 255, 255, 0.14)",
    white20: "rgba(255, 255, 255, 0.18)",
    white30: "rgba(255, 255, 255, 0.28)",
    primary8: "rgba(34, 211, 238, 0.08)",
    primary10: "rgba(34, 211, 238, 0.1)",
    primary15: "rgba(34, 211, 238, 0.14)",
    primary20: "rgba(34, 211, 238, 0.2)",
    primary40: "rgba(34, 211, 238, 0.4)",
    orange8: "rgba(255, 159, 107, 0.08)",
    orange10: "rgba(255, 159, 107, 0.1)",
    orange20: "rgba(255, 159, 107, 0.2)",
  },

  icon: {
    star: "#BDC3C8",
    starGradient: "#435363",
  },
  eventCategory: {
    communication: "#3b82f6",
    location: "#10b981",
    media: "#f59e0b",
    social: "#ec4899",
    financial: "#22c55e",
    work: "#6366f1",
    meeting: "#8b5cf6",
    digital_activity: "#06b6d4",
    other: "#6b7280",
  },
  relationship: {
    family: "#f59e0b",
    romantic: "#ec4899",
    friend: "#10b981",
    colleague: "#3b82f6",
    acquaintance: "#6b7280",
    neighbor: "#8b5cf6",
    rival: "#ef4444",
    enemy: "#dc2626",
    professional: "#0891b2",
    stranger: "#475569",
    service_provider: "#14b8a6",
    other: "#6b7280",
  },
} as const;

// Type export for the palette
export type Palette = typeof palette;
