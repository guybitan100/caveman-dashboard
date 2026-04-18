import { Box, Typography, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import EventNoteIcon from '@mui/icons-material/EventNote';
import { AccordionSection } from '../AccordionSection.tsx';
import { useCartStore } from '../../../stores/cartStore.ts';
import { CustomEvent, CustomEventFieldValues } from '../../../types/cart.ts';
import { EmptyStateCompact as EmptyState } from '../../shared/styledComponents';

const EventsList = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
}));

const EventCard = styled(Box)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius * 1.5,
    padding: theme.spacing(1.75),
    border: `1px solid ${theme.custom.border.default}`,
    transition: theme.transitions.create(['background-color', 'border-color']),

    '&:hover': {
        backgroundColor: theme.custom.surface.white8,
        borderColor: theme.custom.surface.primary20,
    },
}));

const EventHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
}));

const EventId = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    color: theme.palette.text.disabled,
}));

const ModelTypeChip = styled(Chip)(({ theme }) => ({
    height: 22,
    fontSize: '0.7rem',
    fontWeight: theme.typography.fontWeightMedium,
    backgroundColor: theme.custom.surface.primary15,
    color: theme.palette.primary.light,
    border: `1px solid ${theme.custom.surface.primary20}`,
}));

const FieldsList = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(1),
}));

const FieldRow = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    fontSize: '0.8125rem',
}));

const FieldName = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    color: theme.palette.text.disabled,
    minWidth: 80,
    flexShrink: 0,
}));

const FieldValue = styled(Typography)(({ theme }) => ({
    fontSize: '0.8125rem',
    color: theme.palette.text.primary,
    wordBreak: 'break-word',
}));

/**
 * Extracts a display value from a CustomEventFieldValues object
 */
function getFieldDisplayValue(fieldValue: CustomEventFieldValues): string {
    switch (fieldValue.field_type) {
        case 'field':
            return fieldValue.value ?? '-';
        case 'multiField':
            return fieldValue.value.length > 0 ? fieldValue.value.join(', ') : '-';
        case 'modelField':
            return `[${fieldValue.value_type}]`;
        case 'multiModelField':
            return `[${fieldValue.models.length} ${fieldValue.value_type}(s)]`;
        default:
            return '-';
    }
}

/**
 * Truncates text to a maximum length
 */
function truncateText(text: string, maxLength: number = 50): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}


export function CustomEventsSection() {
    const { job, getSectionItemCount } = useCartStore();

    const customEvents = job?.custom_events ?? [];
    const itemCount = getSectionItemCount('customEvents');

    return (
        <AccordionSection
            sectionKey="customEvents"
            title="Custom Events"
            icon={<EventNoteIcon sx={{ fontSize: 18 }} />}
            itemCount={itemCount}
            emptyMessage="No custom events defined"
        >
            {customEvents.length === 0 ? (
                <EmptyState>
                    <EventNoteIcon sx={{ fontSize: 32, opacity: 0.4 }} />
                    <Typography variant="body2">No custom events</Typography>
                </EmptyState>
            ) : (
                <EventsList>
                    {customEvents.map((event: CustomEvent) => (
                        <EventCard key={event.event_id}>
                            <EventHeader>
                                <ModelTypeChip label={event.model_type} size="small" />
                                <EventId>{truncateText(event.event_id, 20)}</EventId>
                            </EventHeader>

                            <FieldsList>
                                {Object.entries(event.fields).slice(0, 5).map(([fieldName, fieldValue]) => (
                                    <FieldRow key={fieldName}>
                                        <FieldName>{fieldName}:</FieldName>
                                        <FieldValue>{truncateText(getFieldDisplayValue(fieldValue))}</FieldValue>
                                    </FieldRow>
                                ))}
                                {Object.keys(event.fields).length > 5 && (
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}
                                    >
                                        +{Object.keys(event.fields).length - 5} more fields
                                    </Typography>
                                )}
                            </FieldsList>
                        </EventCard>
                    ))}
                </EventsList>
            )}
        </AccordionSection>
    );
}
