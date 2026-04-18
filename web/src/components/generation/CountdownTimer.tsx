/**
 * CountdownTimer Component
 * Displays a 15-second countdown with visual progress indicator
 */

import { useEffect, useRef } from 'react';
import { styled } from '@mui/material/styles';
import { Box, Typography, Button, LinearProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { useConversationStore } from '../../stores/conversationStore.ts';

const Container = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    backgroundColor: theme.custom.surface.orange8,
    borderRadius: 10,
    border: `1px solid ${theme.custom.surface.orange20}`,
}));

const TimerDisplay = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 120,
});

const TimerValue = styled(Typography)(({ theme }) => ({
    fontSize: '1.5rem',
    fontWeight: 700,
    color: theme.palette.secondary.main,
    fontFamily: 'monospace',
    minWidth: 40,
    textAlign: 'center',
}));

const TimerLabel = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    color: theme.custom.palette.text.muted,
}));

const ProgressContainer = styled(Box)({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
});

const StyledProgress = styled(LinearProgress)(({ theme }) => ({
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.custom.surface.white10,
    '& .MuiLinearProgress-bar': {
        backgroundColor: theme.palette.secondary.main,
        borderRadius: 3,
        transition: 'transform 0.1s linear',
    },
}));

const ProgressText = styled(Typography)(({ theme }) => ({
    fontSize: '0.7rem',
    color: theme.custom.palette.text.placeholder,
}));

const ActionButton = styled(Button)({
    minWidth: 100,
    textTransform: 'none',
    fontWeight: 600,
    borderRadius: 8,
});

const ContinueButton = styled(ActionButton)(({ theme }) => ({
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.text.primary,
    '&:hover': {
        backgroundColor: theme.palette.secondary.dark,
    },
}));

const PauseButton = styled(ActionButton)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white10,
    color: theme.palette.text.secondary,
    border: `1px solid ${theme.custom.surface.white20}`,
    '&:hover': {
        backgroundColor: theme.custom.surface.white15,
    },
}));

const TOTAL_SECONDS = 15;

interface CountdownTimerProps {
    onContinue?: () => void;
    onPause?: () => void;
}

export function CountdownTimer({ onContinue, onPause }: CountdownTimerProps) {
    const { autoContinue, tickAutoContinue, stopAutoContinue, continueToNextStep } =
        useConversationStore();

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (autoContinue.isActive) {
            intervalRef.current = setInterval(() => {
                tickAutoContinue();
            }, 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [autoContinue.isActive, tickAutoContinue]);

    const handleContinue = () => {
        if (onContinue) {
            onContinue();
        } else {
            continueToNextStep();
        }
    };

    const handlePause = () => {
        stopAutoContinue();
        if (onPause) {
            onPause();
        }
    };

    if (!autoContinue.isActive && !autoContinue.stepKey) {
        return null;
    }

    const progress = ((TOTAL_SECONDS - autoContinue.remainingSeconds) / TOTAL_SECONDS) * 100;

    return (
        <Container>
            <TimerDisplay>
                <TimerValue>{autoContinue.remainingSeconds}</TimerValue>
                <TimerLabel>seconds until<br />auto-continue</TimerLabel>
            </TimerDisplay>

            <ProgressContainer>
                <StyledProgress variant="determinate" value={progress} />
                <ProgressText>
                    {autoContinue.isActive
                        ? 'Edit or add instructions to pause'
                        : 'Timer paused - click Continue when ready'}
                </ProgressText>
            </ProgressContainer>

            {autoContinue.isActive ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <PauseButton
                        size="small"
                        startIcon={<PauseIcon />}
                        onClick={handlePause}
                    >
                        Pause
                    </PauseButton>
                    <ContinueButton
                        size="small"
                        startIcon={<PlayArrowIcon />}
                        onClick={handleContinue}
                    >
                        Continue
                    </ContinueButton>
                </Box>
            ) : (
                <ContinueButton
                    size="small"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleContinue}
                >
                    Continue
                </ContinueButton>
            )}
        </Container>
    );
}
