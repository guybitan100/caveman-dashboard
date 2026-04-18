import { keyframes } from "@mui/material/styles";

/**
 * Shimmer effect for progress bars - creates a moving highlight
 */
export const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

/**
 * Pulse effect for status indicators - scale and opacity
 */
export const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.85;
  }
`;

/**
 * Subtle pulse - opacity only, for pending states
 */
export const subtlePulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`;

/**
 * Spin animation for loading indicators
 */
export const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;
