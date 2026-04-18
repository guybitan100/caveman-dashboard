import { Box, IconButton, styled } from "@mui/material";
import { ButtonIcon } from "../icons/ButtonIcon";

const Button = styled(IconButton)(({ theme }) => ({
  background: theme.custom.gradients.goButton,
  color: theme.palette.text.primary,
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  "&:hover": {
    opacity: 0.8,
  },
  "&:disabled": {
    background: theme.custom.surface.white10,
    color: theme.custom.palette.text.hint,
  },
}));

const GoButtonLabel = styled(Box)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 600,
  marginLeft: 4,
  color: theme.palette.text.primary,
  display: "flex",
  alignItems: "center",
  borderRadius: "6px",
  gap: "4px",
}));

interface GoButtonProps {
  size?: "small" | "medium" | "large";
  onClick: () => void;
  disabled?: boolean;
}

export function GoButton({ size, onClick, disabled }: GoButtonProps) {
  return (
    <Button size={size} onClick={onClick} disabled={disabled}>
      <GoButtonLabel>
        <ButtonIcon />
        <span>Generate UFDR</span>
      </GoButtonLabel>
    </Button>
  );
}
