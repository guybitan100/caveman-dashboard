import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { LeftSidebar } from '../sidebar/LeftSidebar.tsx';
import { HomeHeader } from '../home/HomeHeader.tsx';
import { FloatingCartButton } from '../cart/FloatingCartButton.tsx';
import { RightSidebar } from '../cart/RightSidebar.tsx';

const LayoutContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100vh',
    background: theme.custom.gradients.pageBackground,
    overflow: 'hidden',
    position: 'relative',
}));

const MainContainer = styled(Box)(({ theme }) => ({
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr)',
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(0, 1.75, 1.75, 1.75),
    gap: theme.spacing(1.75),
    overflow: 'hidden',
    '@media (max-width: 1200px)': {
        gridTemplateColumns: '250px minmax(0, 1fr)',
    },
    '@media (max-width: 900px)': {
        display: 'flex',
        flexDirection: 'column',
    },
}));

const SidebarPanel = styled(Box)(({ theme }) => ({
    width: 280,
    minWidth: 240,
    maxWidth: 280,
    height: '100%',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: 30,
    border: `1px solid ${theme.custom.border.default}`,
    background: 'linear-gradient(180deg, rgba(17, 48, 72, 0.48), rgba(9, 21, 33, 0.68))',
    boxShadow: '0 24px 48px rgba(1, 12, 26, 0.22)',
    backdropFilter: 'blur(18px)',
    '@media (max-width: 900px)': {
        width: '100%',
        minWidth: 0,
        maxWidth: 'none',
        minHeight: 280,
    },
}));

const ContentArea = styled(Box)(({ theme }) => ({
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    position: 'relative',
    borderRadius: 34,
    border: `1px solid ${theme.custom.border.default}`,
    background: 'linear-gradient(180deg, rgba(14, 35, 54, 0.52), rgba(8, 18, 30, 0.34))',
    boxShadow: '0 28px 60px rgba(1, 12, 26, 0.2)',
    backdropFilter: 'blur(18px)',
    '@media (max-width: 900px)': {
        minHeight: 860,
    },
}));


interface AppLayoutProps {
    children: ReactNode;
    onJobSelect?: (jobId: string) => void;
}

export function AppLayout({ children, onJobSelect }: AppLayoutProps) {
    return (
        <LayoutContainer>
            <HomeHeader />
            <MainContainer>
                <SidebarPanel>
                    <LeftSidebar onJobSelect={onJobSelect} />
                </SidebarPanel>
                <ContentArea>
                    {children}
                </ContentArea>
            </MainContainer>

            <FloatingCartButton />
            <RightSidebar />
        </LayoutContainer>
    );
}
