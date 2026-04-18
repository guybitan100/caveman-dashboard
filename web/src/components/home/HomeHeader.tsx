import { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Button,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import LogoutIcon from "@mui/icons-material/Logout";
import BuildIcon from "@mui/icons-material/Build";
import { SmallLogo } from "../icons/logo/SmallLogo";
import { useAuth } from "../../contexts";
import { useAppView } from "../../App.tsx";

const HeaderContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 18px",
  margin: "14px 14px 0",
  position: "relative",
  zIndex: 1,
  borderRadius: 24,
  border: `1px solid ${theme.custom.border.default}`,
  background: "linear-gradient(180deg, rgba(18, 47, 72, 0.78), rgba(8, 18, 30, 0.9))",
  boxShadow: "0 18px 40px rgba(1, 12, 26, 0.22)",
  backdropFilter: "blur(18px)",
}));

const LogoSection = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 12,
});

const LogoWrapper = styled(Box)<{ size: number }>(({ size }) => ({
  width: size,
  height: size,
  display: "flex",
  alignItems: "center",
}));

const LogoText = styled(Typography)<{ fontSize: number }>(
  ({ theme, fontSize }) => ({
    fontSize: fontSize || 32,
    fontStyle: "normal",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${theme.palette.primary.main} 100%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    fontFamily: '"Manrope", "Space Grotesk", sans-serif',
    WebkitTextFillColor: "transparent",
  })
);

const UserSection = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 12,
});

const UserButton = styled(IconButton)(({ theme }) => ({
  padding: 4,
  borderRadius: 16,
  "&:hover": {
    backgroundColor: theme.custom.surface.white10,
  },
}));

const UserAvatar = styled(Avatar)(({ theme }) => ({
  width: 36,
  height: 36,
  fontSize: 12,
  fontWeight: 600,
  background: theme.custom.gradients.primaryButton,
  color: theme.palette.text.primary,
}));


const StyledMenu = styled(Menu)(({ theme }) => ({
  "& .MuiPaper-root": {
    background: "linear-gradient(180deg, rgba(18, 47, 72, 0.9), rgba(8, 18, 30, 0.96))",
    borderRadius: 18,
    border: `1px solid ${theme.custom.border.light}`,
    boxShadow: "0 20px 40px rgba(1, 12, 26, 0.3)",
    minWidth: 180,
  },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  color: theme.palette.text.secondary,
  padding: "12px 16px",
  "&:hover": {
    backgroundColor: theme.custom.surface.white5,
  },
  "& .MuiListItemIcon-root": {
    color: theme.custom.palette.text.tertiary,
    minWidth: 36,
  },
}));

export function HomeHeader() {
  const { user, logout } = useAuth();
  const { view, setView } = useAppView();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
  };

  const getInitials = () => {
    if (!user) return "?";
    const first = user.firstName.charAt(0).toUpperCase();
    const last = user.lastName ? user.lastName.charAt(0).toUpperCase() : "";
    return `${first}${last}`;
  };

  return (
    <HeaderContainer>
      <LogoSection>
        <LogoWrapper size={30}>
          <SmallLogo />
        </LogoWrapper>
        <LogoText fontSize={28}>Six</LogoText>
      </LogoSection>

      {user && (
        <UserSection>
          <Button
            size="small"
            startIcon={<BuildIcon />}
            onClick={() => setView(view === "runtime" ? "generate" : "runtime")}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.78rem",
              color: view === "runtime" ? "primary.light" : "text.secondary",
              border: 1,
              borderColor: view === "runtime" ? "primary.light" : "divider",
              borderRadius: 3,
              px: 1.5,
              "&:hover": { borderColor: "primary.light" },
            }}
          >
            {view === "runtime" ? "AI Generate" : "UFDR Runtime"}
          </Button>
          <UserButton
            onClick={handleClick}
            aria-controls={open ? "user-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
          >
            <UserAvatar>{getInitials()}</UserAvatar>
          </UserButton>
          <StyledMenu
            id="user-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
          >
            <StyledMenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { color: "#eef6ff" } }}>Sign Out</ListItemText>
            </StyledMenuItem>
          </StyledMenu>
        </UserSection>
      )}
    </HeaderContainer>
  );
}

