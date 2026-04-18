import { palette } from "./palette";

// Extend MUI theme with custom properties
declare module "@mui/material/styles" {
  interface Theme {
    custom: {
      palette: typeof palette;
      gradients: typeof palette.gradients;
      status: typeof palette.status;
      surface: typeof palette.surface;
      border: typeof palette.border;
      eventCategory: typeof palette.eventCategory;
      relationship: typeof palette.relationship;
    };
  }
  interface ThemeOptions {
    custom?: {
      palette?: typeof palette;
      gradients?: typeof palette.gradients;
      status?: typeof palette.status;
      surface?: typeof palette.surface;
      border?: typeof palette.border;
      eventCategory?: typeof palette.eventCategory;
      relationship?: typeof palette.relationship;
    };
  }

  // Extend palette background to include custom properties
  interface TypeBackground {
    card?: string;
    input?: string;
    elevated?: string;
    overlay?: string;
  }

  // Extend palette text to include custom properties
  interface TypeText {
    tertiary?: string;
    muted?: string;
    placeholder?: string;
    hint?: string;
  }
}

// Empty export to make this a module
export {};
