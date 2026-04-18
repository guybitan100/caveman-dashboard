import { useState, useCallback, FormEvent } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  InputAdornment,
  Fade,
} from "@mui/material";
import { styled, keyframes } from "@mui/material/styles";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useAuth } from "../contexts/AuthContext";
import {
  isValidCellebriteEmail,
  isValidEmailFormat,
} from "../utils/userStorage";
import { SmallLogo } from "../components/icons/logo/SmallLogo";

// Animations
const gradientShift = keyframes`
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
`;

const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 32px rgba(34, 211, 238, 0.22);
  }
  50% {
    box-shadow: 0 0 56px rgba(34, 211, 238, 0.34);
  }
`;


const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: theme.custom.gradients.pageBackground,
  backgroundSize: "400% 400%",
  animation: `${gradientShift} 15s ease infinite`,
  position: "relative",
  overflow: "hidden",
}));


const BackgroundOrb = styled(Box)<{ size: number; top: string; left: string; delay: number }>(
  ({ size, top, left, delay }) => ({
    position: "absolute",
    width: size,
    height: size,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(34, 211, 238, 0.22) 0%, rgba(255, 159, 107, 0.08) 35%, transparent 70%)",
    top,
    left,
    filter: "blur(40px)",
    animation: `${glowPulse} 4s ease-in-out ${delay}s infinite`,
  })
);

const LoginCard = styled(Paper)(({ theme }) => ({
  maxWidth: 420,
  width: "100%",
  margin: "0 24px",
  padding: "48px 40px",
  borderRadius: 28,
  background: "linear-gradient(180deg, rgba(18, 47, 72, 0.78), rgba(8, 18, 30, 0.92))",
  backdropFilter: "blur(20px)",
  border: `1px solid ${theme.custom.border.default}`,
  boxShadow: "0 25px 50px -12px rgba(1, 12, 26, 0.5)",
}));

const LogoContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  marginBottom: 40,
});

const LogoWrapper = styled(Box)({
  width: 48,
  height: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const LogoText = styled(Typography)(({ theme }) => ({
  fontSize: 48,
  height: 62,
  fontWeight: 800,
  fontFamily: '"Manrope", "Space Grotesk", sans-serif',
  letterSpacing: "-0.04em",
  background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${theme.palette.primary.main} 100%)`,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
}));

const Subtitle = styled(Typography)(({ theme }) => ({
  color: theme.custom.palette.text.placeholder,
  fontSize: 14,
  textAlign: "center",
  marginTop: -32,
  marginBottom: 32,
  fontWeight: 700,
  letterSpacing: 3,
  textTransform: "uppercase",
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    backgroundColor: theme.custom.surface.white5,
    borderRadius: 12,
    color: theme.palette.text.primary,
    transition: "all 0.3s ease",
    "& fieldset": {
      borderColor: theme.custom.border.light,
      borderWidth: 1,
      transition: "all 0.3s ease",
    },
    "&:hover fieldset": {
      borderColor: theme.custom.border.focus,
    },
    "&.Mui-focused fieldset": {
      borderColor: theme.palette.primary.light,
      borderWidth: 2,
      boxShadow: `0 0 20px ${theme.custom.surface.primary20}`,
    },
    "&.Mui-error fieldset": {
      borderColor: theme.palette.error.main,
    },
    // Override browser autofill styles
    "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active": {
      WebkitBoxShadow: "0 0 0 30px transparent inset !important",
      WebkitBackgroundClip: "text !important",
      WebkitTextFillColor: `${theme.palette.text.primary} !important`,
      caretColor: theme.palette.text.primary,
      transition: "background-color 5000s ease-in-out 0s",
    },
  },
  "& .MuiInputLabel-root": {
    color: theme.custom.palette.text.placeholder,
    "&.Mui-focused": {
      color: theme.palette.primary.light,
    },
    "&.Mui-error": {
      color: theme.palette.error.main,
    },
  },
  "& .MuiFormHelperText-root": {
    marginLeft: 0,
    marginTop: 8,
    fontSize: 13,
    "&.Mui-error": {
      color: theme.palette.error.main,
    },
  },
  "& .MuiInputAdornment-root": {
    color: theme.palette.text.disabled,
  },
}));

const SubmitButton = styled(Button)(({ theme }) => ({
  marginTop: 24,
  padding: "14px 24px",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: 700,
  textTransform: "none",
  background: theme.custom.gradients.primaryButton,
  boxShadow: `0 4px 15px ${theme.custom.surface.primary40}`,
  transition: "all 0.3s ease",
  "&:hover": {
    background: theme.custom.gradients.primaryButtonHover,
    boxShadow: `0 6px 20px ${theme.custom.surface.primary40}`,
    transform: "translateY(-1px)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
  "&.Mui-disabled": {
    background: theme.custom.surface.white10,
    color: theme.custom.palette.text.hint,
    boxShadow: "none",
  },
}));

type ValidationError = "invalid_format" | "invalid_domain" | null;

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<ValidationError>(null);
  const [touched, setTouched] = useState(false);

  const validateEmail = useCallback((value: string): ValidationError => {
    if (!value.trim()) return null;
    if (!isValidEmailFormat(value)) return "invalid_format";
    if (!isValidCellebriteEmail(value)) return "invalid_domain";
    return null;
  }, []);

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);
      if (touched) {
        setError(validateEmail(value));
      }
    },
    [touched, validateEmail]
  );

  const handleBlur = useCallback(() => {
    setTouched(true);
    setError(validateEmail(email));
  }, [email, validateEmail]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setTouched(true);

      const validationError = validateEmail(email);
      if (validationError) {
        setError(validationError);
        return;
      }

      login(email.trim());
    },
    [email, validateEmail, login]
  );

  const getErrorMessage = (err: ValidationError): string => {
    switch (err) {
      case "invalid_format":
        return "Please enter a valid email address";
      case "invalid_domain":
        return "Please use your Cellebrite email address";
      default:
        return "";
    }
  };

  const isValid = email.trim() !== "" && !validateEmail(email);

  return (
    <PageContainer>
      {/* Decorative background orbs */}
      <BackgroundOrb size={400} top="-10%" left="-10%" delay={0} />
      <BackgroundOrb size={300} top="60%" left="80%" delay={1} />
      <BackgroundOrb size={200} top="30%" left="60%" delay={2} />

      <Fade in timeout={600}>
        <LoginCard elevation={0}>
          <LogoContainer>
            <LogoWrapper>
              <SmallLogo height={48} width={48} />
            </LogoWrapper>
            <LogoText>Six</LogoText>
          </LogoContainer>

          <Subtitle>Cellebrite AI</Subtitle>

          <Box component="form" onSubmit={handleSubmit}>
            <Typography
              variant="body1"
              sx={(theme) => ({
                color: theme.palette.text.secondary,
                marginBottom: 2,
                fontWeight: 500,
              })}
            >
              Enter your Cellebrite email
            </Typography>

            <StyledTextField
              fullWidth
              type="email"
              placeholder="your.name@cellebrite.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleBlur}
              error={!!error}
              helperText={error ? getErrorMessage(error) : " "}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlinedIcon />
                    </InputAdornment>
                  ),
                }
              }}
              autoComplete="email"
              autoFocus
            />

            <SubmitButton
              type="submit"
              variant="contained"
              fullWidth
              disabled={!isValid}
              endIcon={<ArrowForwardIcon />}
            >
              Continue
            </SubmitButton>
          </Box>
        </LoginCard>
      </Fade>
    </PageContainer>
  );
}
