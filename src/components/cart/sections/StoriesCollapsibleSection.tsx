import { useState } from 'react';
import { Collapse } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useCartStore } from '../../../stores/cartStore';
import { StoriesSection } from './StoriesSection';
import {
    CollapsibleSection,
    CollapsibleHeader,
    SectionLabel,
    SectionIcon,
    SectionTitle,
    SectionCount,
    ExpandButton,
} from './sharedStyles';

interface StoriesCollapsibleSectionProps {
    defaultExpanded?: boolean;
}

export function StoriesCollapsibleSection({ defaultExpanded = false }: StoriesCollapsibleSectionProps) {
    const { job } = useCartStore();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const stories = job?.stories?.nodes ?? [];

    return (
        <CollapsibleSection>
            <CollapsibleHeader onClick={() => setIsExpanded(!isExpanded)}>
                <SectionLabel>
                    <SectionIcon>
                        <TimelineIcon sx={{ fontSize: 18 }} />
                    </SectionIcon>
                    <SectionTitle>Stories Timeline</SectionTitle>
                    <SectionCount>({stories.length})</SectionCount>
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
                <StoriesSection embedded />
            </Collapse>
        </CollapsibleSection>
    );
}
