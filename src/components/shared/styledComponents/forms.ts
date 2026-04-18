import {
  Box,
  TextField,
  Select,
  Typography,
  Autocomplete,
} from "@mui/material";
import { styled } from "@mui/material/styles";

/**
 * Themed text field with dark background.
 * Use for all text inputs in forms.
 */
export const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    backgroundColor: theme.custom.surface.white5,
    "& fieldset": {
      borderColor: theme.custom.border.default,
    },
    "&:hover fieldset": {
      borderColor: theme.custom.border.light,
    },
    "&.Mui-focused fieldset": {
      borderColor: theme.palette.primary.main,
    },
  },
  "& .MuiInputLabel-root": {
    color: theme.custom.palette.text.muted,
  },
  "& .MuiOutlinedInput-input": {
    color: theme.palette.text.primary,
  },
}));

/**
 * Themed select dropdown with dark background.
 * Use for all select elements in forms.
 */
export const StyledSelect = styled(Select)(({ theme }) => ({
  backgroundColor: theme.custom.surface.white5,
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.custom.border.default,
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.custom.border.light,
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.palette.primary.main,
  },
  "& .MuiSelect-select": {
    color: theme.palette.text.primary,
  },
}));

/**
 * Form section container with bottom margin.
 * Use to group related form fields.
 */
export const FormSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2.5),
}));

/**
 * Form section with column layout and padding.
 * Alternative to FormSection for dialogs with different padding needs.
 */
export const FormSectionPadded = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2.5),
  padding: theme.spacing(3),
}));

/**
 * Uppercase label for form sections.
 * Use as a heading above groups of fields.
 */
export const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: "0.7rem",
  fontWeight: theme.typography.fontWeightBold,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: theme.custom.palette.text.placeholder,
  marginBottom: theme.spacing(1.5),
}));

/**
 * Horizontal row of form fields with gap.
 * Use for side-by-side field layouts.
 */
export const FieldRow = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(1.5),
}));

/**
 * Field row without bottom margin.
 * Use when fields are tightly grouped.
 */
export const FieldRowCompact = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1.5),
}));

/**
 * Info row for displaying label-value pairs.
 */
export const InfoRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

/**
 * Label in an info row.
 */
export const InfoLabel = styled(Typography)(({ theme }) => ({
  fontSize: "0.75rem",
  color: theme.palette.text.disabled,
  minWidth: 80,
}));

/**
 * Value in an info row.
 */
export const InfoValue = styled(Typography)(({ theme }) => ({
  fontSize: "0.8125rem",
  color: theme.palette.text.primary,
  flex: 1,
}));

/**
 * Themed autocomplete with dark background.
 * Use for autocomplete inputs in forms.
 */
export const StyledAutocomplete = styled(Autocomplete)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    backgroundColor: theme.custom.surface.white5,
    "& fieldset": {
      borderColor: theme.custom.border.default,
    },
    "&:hover fieldset": {
      borderColor: theme.custom.border.light,
    },
    "&.Mui-focused fieldset": {
      borderColor: theme.palette.primary.main,
    },
  },
}));
