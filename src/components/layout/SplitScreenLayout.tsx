import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { ChatPanel } from '../chat/ChatPanel.tsx';
import { GenerationPanel } from '../generation/GenerationPanel.tsx';

const ContentContainer = styled(Box)(({ theme }) => ({
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 0.38fr) minmax(0, 1fr)',
    flex: 1,
    gap: theme.spacing(1.75),
    height: '100%',
    overflow: 'hidden',
    padding: theme.spacing(1.75),
    '@media (max-width: 1100px)': {
        gridTemplateColumns: '1fr',
        overflowY: 'auto',
    },
}));

const LeftPanel = styled(Box)(({ theme }) => ({
    minWidth: 0,
    height: '100%',
    flexShrink: 0,
    borderRadius: 26,
    border: `1px solid ${theme.custom.border.default}`,
    background: 'linear-gradient(180deg, rgba(16, 41, 63, 0.72), rgba(8, 18, 30, 0.82))',
    boxShadow: '0 18px 40px rgba(1, 12, 26, 0.18)',
    overflow: 'hidden',
    '@media (max-width: 1100px)': {
        minHeight: 420,
    },
}));

const RightPanel = styled(Box)(({ theme }) => ({
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    borderRadius: 26,
    border: `1px solid ${theme.custom.border.default}`,
    background: 'linear-gradient(180deg, rgba(16, 41, 63, 0.72), rgba(8, 18, 30, 0.82))',
    boxShadow: '0 18px 40px rgba(1, 12, 26, 0.18)',
    '@media (max-width: 1100px)': {
        minHeight: 760,
    },
}));

export function SplitScreenLayout() {
    return (
        <ContentContainer>
            <LeftPanel>
                <ChatPanel />
            </LeftPanel>
            <RightPanel>
                <GenerationPanel />
            </RightPanel>
        </ContentContainer>
    );
}
