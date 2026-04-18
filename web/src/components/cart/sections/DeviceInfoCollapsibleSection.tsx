import { useState } from 'react';
import { Collapse } from '@mui/material';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { DeviceInfoSection } from './DeviceInfoSection';
import {
    CollapsibleSection,
    CollapsibleHeader,
    SectionLabel,
    SectionIcon,
    SectionTitle,
    ExpandButton,
} from './sharedStyles';

interface DeviceInfoCollapsibleSectionProps {
    defaultExpanded?: boolean;
}

export function DeviceInfoCollapsibleSection({ defaultExpanded = false }: DeviceInfoCollapsibleSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <CollapsibleSection>
            <CollapsibleHeader onClick={() => setIsExpanded(!isExpanded)}>
                <SectionLabel>
                    <SectionIcon>
                        <SmartphoneIcon sx={{ fontSize: 18 }} />
                    </SectionIcon>
                    <SectionTitle>Device Info</SectionTitle>
                </SectionLabel>
                <ExpandButton size="small">
                    {isExpanded ? (
                        <ExpandLessIcon sx={{ fontSize: 18 }} />
                    ) : (
                        <ExpandMoreIcon sx={{ fontSize: 18 }} />
                    )}
                </ExpandButton>
            </CollapsibleHeader>
            <Collapse in={isExpanded}>
                <DeviceInfoSection embedded />
            </Collapse>
        </CollapsibleSection>
    );
}
