// =============================================================================
// Titan COMPONENT OVERRIDES
// =============================================================================
// MUI component style overrides for the Titan application.
// =============================================================================

import { Components, Theme, alpha } from "@mui/material/styles";
import { palette } from "./palette";

/**
 * Component style overrides
 */
export const components: Components<Omit<Theme, "components">> = {
  // ---------------------------------------------------------------------------
  // Base
  // ---------------------------------------------------------------------------
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        background: palette.gradients.pageBackground,
        color: palette.text.primary,
        backgroundAttachment: "fixed",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Buttons
  // ---------------------------------------------------------------------------
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: "none",
        fontWeight: 700,
        borderRadius: 16,
        minHeight: 44,
        letterSpacing: "0.02em",
      },
      contained: {
        boxShadow: `0 12px 24px ${alpha(palette.primary.main, 0.2)}`,
        "&:hover": {
          boxShadow: `0 16px 28px ${alpha(palette.primary.main, 0.24)}`,
          transform: "translateY(-1px)",
        },
      },
      containedPrimary: {
        background: palette.gradients.primaryButton,
        color: palette.primary.contrastText,
        "&:hover": {
          background: palette.gradients.primaryButtonHover,
        },
        "&.Mui-disabled": {
          background: palette.surface.white10,
          color: palette.text.hint,
          boxShadow: "none",
        },
      },
      containedSecondary: {
        background: `linear-gradient(135deg, ${palette.secondary.main} 0%, ${palette.secondary.light} 100%)`,
        color: palette.secondary.contrastText,
        "&:hover": {
          background: `linear-gradient(135deg, ${palette.secondary.dark} 0%, ${palette.secondary.main} 100%)`,
        },
      },
      outlinedPrimary: {
        borderColor: palette.border.medium,
        color: palette.text.primary,
        background: palette.surface.white5,
        "&:hover": {
          borderColor: palette.primary.main,
          backgroundColor: palette.surface.primary8,
        },
      },
      text: {
        color: palette.text.secondary,
        "&:hover": {
          backgroundColor: palette.surface.white8,
        },
      },
    },
  },

  MuiIconButton: {
    styleOverrides: {
      root: {
        color: palette.text.placeholder,
        borderRadius: 14,
        "&:hover": {
          color: palette.text.tertiary,
          backgroundColor: palette.surface.white10,
        },
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Surfaces
  // ---------------------------------------------------------------------------
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: "none",
        background: `linear-gradient(180deg, ${alpha("#16344f", 0.72)}, ${alpha("#0a1628", 0.92)})`,
        border: `1px solid ${palette.border.default}`,
        backdropFilter: "blur(18px)",
        boxShadow: `0 18px 40px rgba(1, 12, 26, 0.26)`,
      },
    },
  },

  MuiCard: {
    styleOverrides: {
      root: {
        background: `linear-gradient(180deg, ${alpha("#173754", 0.76)}, ${alpha("#0b1d31", 0.9)})`,
        border: `1px solid ${palette.border.default}`,
        borderRadius: 18,
        boxShadow: `0 16px 34px rgba(1, 12, 26, 0.2)`,
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Chips
  // ---------------------------------------------------------------------------
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        fontWeight: 700,
        backgroundColor: palette.surface.white5,
        color: palette.text.secondary,
      },
      colorSuccess: {
        backgroundColor: palette.status.success.background,
        color: palette.status.success.main,
      },
      colorError: {
        backgroundColor: palette.status.error.background,
        color: palette.status.error.main,
      },
      colorWarning: {
        backgroundColor: palette.status.warning.background,
        color: palette.status.warning.main,
      },
      colorInfo: {
        backgroundColor: palette.status.info.background,
        color: palette.status.info.main,
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Inputs
  // ---------------------------------------------------------------------------
  MuiTextField: {
    styleOverrides: {
      root: {
        "& .MuiOutlinedInput-root": {
          borderRadius: 14,
          background: "linear-gradient(180deg, rgba(12, 25, 40, 0.92), rgba(8, 18, 30, 0.84))",
          color: palette.text.primary,
          transition: "all 0.3s ease",
          "& fieldset": {
            borderColor: palette.border.light,
            borderWidth: 1,
            transition: "all 0.3s ease",
          },
          "&:hover fieldset": {
            borderColor: palette.border.focus,
          },
          "&.Mui-focused fieldset": {
            borderColor: palette.primary.main,
            borderWidth: 1,
            boxShadow: `0 0 0 3px ${alpha(palette.primary.main, 0.08)}`,
          },
          "&.Mui-error fieldset": {
            borderColor: palette.border.error,
          },
          // Override browser autofill styles
          "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active":
            {
              WebkitBoxShadow: "0 0 0 30px transparent inset !important",
              WebkitBackgroundClip: "text !important",
              WebkitTextFillColor: `${palette.text.primary} !important`,
              caretColor: palette.text.primary,
              transition: "background-color 5000s ease-in-out 0s",
            },
        },
        "& .MuiInputLabel-root": {
          color: palette.text.placeholder,
          "&.Mui-focused": {
            color: palette.primary.light,
          },
          "&.Mui-error": {
            color: palette.status.error.main,
          },
        },
        "& .MuiFormHelperText-root": {
          marginLeft: 0,
          marginTop: 8,
          fontSize: 13,
          "&.Mui-error": {
            color: palette.status.error.main,
          },
        },
        "& .MuiInputAdornment-root": {
          color: palette.text.disabled,
        },
      },
    },
  },

  MuiInputBase: {
    styleOverrides: {
      root: {
        color: palette.text.primary,
        "& .MuiInputBase-input::placeholder": {
          color: palette.text.placeholder,
          opacity: 1,
        },
      },
    },
  },

  MuiSelect: {
    styleOverrides: {
      icon: {
        color: palette.text.placeholder,
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  MuiDrawer: {
    styleOverrides: {
      paper: {
        background: `linear-gradient(180deg, ${alpha("#14324d", 0.74)}, ${alpha("#0b1c2f", 0.94)})`,
        color: palette.text.primary,
        borderRight: `1px solid ${palette.border.default}`,
      },
    },
  },

  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 14,
        margin: "4px 8px",
        "&:hover": {
          backgroundColor: palette.surface.white10,
        },
        "&.Mui-selected": {
          backgroundColor: palette.surface.primary15,
          borderLeft: `3px solid ${palette.primary.main}`,
          "&:hover": {
            backgroundColor: palette.surface.primary20,
          },
        },
      },
    },
  },

  MuiTabs: {
    styleOverrides: {
      indicator: {
        backgroundColor: palette.primary.main,
      },
    },
  },

  MuiTab: {
    styleOverrides: {
      root: {
        color: palette.text.muted,
        textTransform: "none",
        fontWeight: 500,
        "&.Mui-selected": {
          color: palette.text.primary,
        },
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Menus & Dialogs
  // ---------------------------------------------------------------------------
  MuiMenu: {
    styleOverrides: {
      paper: {
        background: `linear-gradient(180deg, ${alpha("#14324d", 0.9)}, ${alpha("#091521", 0.96)})`,
        border: `1px solid ${palette.border.light}`,
        borderRadius: 18,
        boxShadow: `0 22px 44px rgba(1, 12, 26, 0.34)`,
        backdropFilter: "blur(18px)",
      },
    },
  },

  MuiMenuItem: {
    styleOverrides: {
      root: {
        "&:hover": {
          backgroundColor: palette.surface.white8,
        },
        "&.Mui-selected": {
          backgroundColor: palette.surface.primary15,
          "&:hover": {
            backgroundColor: palette.surface.primary20,
          },
        },
      },
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: {
        background: `linear-gradient(180deg, ${alpha("#14324d", 0.9)}, ${alpha("#091521", 0.96)})`,
        border: `1px solid ${palette.border.light}`,
        borderRadius: 22,
        backdropFilter: "blur(20px)",
      },
    },
  },

  MuiDialogTitle: {
    styleOverrides: {
      root: {
        color: palette.text.primary,
        fontWeight: 600,
      },
    },
  },

  MuiDialogContent: {
    styleOverrides: {
      root: {
        color: palette.text.secondary,
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Feedback
  // ---------------------------------------------------------------------------
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: alpha("#091521", 0.96),
        color: palette.text.primary,
        border: `1px solid ${palette.border.light}`,
        borderRadius: 12,
        fontSize: "0.75rem",
      },
      arrow: {
        color: palette.background.elevated,
      },
    },
  },

  MuiAlert: {
    styleOverrides: {
      standardSuccess: {
        backgroundColor: palette.status.success.background,
        color: palette.status.success.main,
      },
      standardError: {
        backgroundColor: palette.status.error.background,
        color: palette.status.error.main,
      },
      standardWarning: {
        backgroundColor: palette.status.warning.background,
        color: palette.status.warning.main,
      },
      standardInfo: {
        backgroundColor: palette.status.info.background,
        color: palette.status.info.main,
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Progress
  // ---------------------------------------------------------------------------
  MuiCircularProgress: {
    styleOverrides: {
      colorPrimary: {
        color: palette.primary.light,
      },
      colorSecondary: {
        color: palette.secondary.main,
      },
    },
  },

  MuiLinearProgress: {
    styleOverrides: {
      root: {
        backgroundColor: palette.surface.white10,
        borderRadius: 4,
      },
      barColorPrimary: {
        backgroundColor: palette.primary.main,
      },
      barColorSecondary: {
        backgroundColor: palette.secondary.main,
      },
    },
  },

  MuiSkeleton: {
    styleOverrides: {
      root: {
        backgroundColor: palette.surface.white10,
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Sliders & Switches
  // ---------------------------------------------------------------------------
  MuiSlider: {
    styleOverrides: {
      root: {
        color: palette.secondary.main,
      },
      track: {
        backgroundColor: palette.secondary.main,
      },
      rail: {
        backgroundColor: palette.surface.white20,
      },
      thumb: {
        backgroundColor: palette.secondary.main,
        "&:hover": {
          boxShadow: `0 0 0 8px ${alpha(palette.secondary.main, 0.16)}`,
        },
      },
    },
  },

  MuiSwitch: {
    styleOverrides: {
      track: {
        backgroundColor: palette.surface.white20,
      },
      switchBase: {
        "&.Mui-checked": {
          color: palette.primary.main,
          "& + .MuiSwitch-track": {
            backgroundColor: palette.primary.main,
          },
        },
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Divider
  // ---------------------------------------------------------------------------
  MuiDivider: {
    styleOverrides: {
      root: {
        borderColor: palette.border.default,
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Accordion
  // ---------------------------------------------------------------------------
  MuiAccordion: {
    styleOverrides: {
      root: {
        background: `linear-gradient(180deg, ${alpha("#173754", 0.74)}, ${alpha("#0b1d31", 0.9)})`,
        border: `1px solid ${palette.border.default}`,
        borderRadius: "18px !important",
        "&:before": {
          display: "none",
        },
        "&.Mui-expanded": {
          margin: 0,
        },
      },
    },
  },

  MuiAccordionSummary: {
    styleOverrides: {
      root: {
        color: palette.text.primary,
      },
      expandIconWrapper: {
        color: palette.text.muted,
      },
    },
  },

  MuiAccordionDetails: {
    styleOverrides: {
      root: {
        color: palette.text.secondary,
      },
    },
  },
};
