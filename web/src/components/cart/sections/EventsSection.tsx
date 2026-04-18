import { useState } from 'react';
import { Collapse } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useCartStore } from '../../../stores/cartStore';
import { EventsGrid } from './EventsGrid';
import {
    CollapsibleSection,
    CollapsibleHeader,
    SectionLabel,
    SectionIcon,
    SectionTitle,
    SectionCount,
    ExpandButton,
} from './sharedStyles';

interface EventsSectionProps {
    defaultExpanded?: boolean;
}

export function EventsSection({ defaultExpanded = true }: EventsSectionProps) {
    const { job } = useCartStore();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const tasks = job?.tasks ?? [];

    return (
        <CollapsibleSection>
            <CollapsibleHeader onClick={() => setIsExpanded(!isExpanded)}>
                <SectionLabel>
                    <SectionIcon>
                        <EventIcon sx={{ fontSize: 18 }} />
                    </SectionIcon>
                    <SectionTitle>Events</SectionTitle>
                    <SectionCount>({tasks.length})</SectionCount>
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
                <EventsGrid />
            </Collapse>
        </CollapsibleSection>
    );
}
