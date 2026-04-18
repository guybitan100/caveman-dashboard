import { useState } from 'react';
import {
    Box,
    Typography,
    Tabs,
    Tab,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import { useCartStore } from '../../../stores/cartStore.ts';
import { EventsSection } from './EventsSection.tsx';
import { StoriesCollapsibleSection } from './StoriesCollapsibleSection.tsx';
import { DeviceInfoCollapsibleSection } from './DeviceInfoCollapsibleSection.tsx';
import { ContentScroll, EmptyState } from './sharedStyles.ts';

const PanelContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
});

const ExtractionTabs = styled(Tabs)(({ theme }) => ({
    minHeight: 40,
    backgroundColor: theme.custom.surface.white10,
    borderBottom: `1px solid ${theme.custom.border.default}`,

    '& .MuiTabs-indicator': {
        backgroundColor: theme.palette.info.main,
        height: 2,
    },
}));

const ExtractionTab = styled(Tab)(({ theme }) => ({
    minHeight: 40,
    minWidth: 80,
    padding: theme.spacing(1, 2),
    fontSize: '0.75rem',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.disabled,
    textTransform: 'none',

    '&.Mui-selected': {
        color: theme.palette.info.main,
    },
}));


interface ExtractionPanelProps {
    extractions?: Array<{ id: string; name: string }>;
}

export function ExtractionPanel({ extractions }: ExtractionPanelProps) {
    const { job } = useCartStore();
    const [activeTab, setActiveTab] = useState(0);

    const context = job?.context;
    const device = context?.device;
    const deviceModel = device ? `${device.manufacturer} ${device.name}` : null;

    // For now, we simulate a single extraction from the job
    // In the future, this could support multiple extractions
    const currentExtractions = extractions ?? [
        { id: 'main', name: deviceModel || 'Device' },
    ];

    if (!job) {
        return (
            <EmptyState>
                <SmartphoneIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                <Typography>No extraction data</Typography>
                <Typography variant="caption" sx={{ mt: 1 }}>
                    Select a job to view extraction details
                </Typography>
            </EmptyState>
        );
    }

    return (
        <PanelContainer>
            {currentExtractions.length > 1 && (
                <ExtractionTabs
                    value={activeTab}
                    onChange={(_, newValue) => setActiveTab(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    {currentExtractions.map((ext) => (
                        <ExtractionTab key={ext.id} label={ext.name} />
                    ))}
                </ExtractionTabs>
            )}

            <ContentScroll>
                <EventsSection defaultExpanded />
                <StoriesCollapsibleSection />
                <DeviceInfoCollapsibleSection />
            </ContentScroll>
        </PanelContainer>
    );
}
