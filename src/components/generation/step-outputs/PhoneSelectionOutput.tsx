import { useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import {
    Box,
    Typography,
    Chip,
    Collapse,
    Checkbox,
    Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import AndroidIcon from '@mui/icons-material/Android';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import { SelectedPhone, DeviceType, AiGeneratedEntity } from '../../../types/pipeline.ts';
import PersonIcon from '@mui/icons-material/Person';
import { formatDate } from '../../../utils/date';
import { ActionButton } from '../../shared/styledComponents';

const Container = styled(Box)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white5,
    borderRadius: 12,
    padding: 20,
    border: `1px solid ${theme.custom.border.default}`,
}));

const Header = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
});

const PhoneCard = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: theme.custom.surface.white5,
    borderRadius: 10,
    border: `1px solid ${theme.custom.surface.white8}`,
    marginBottom: 12,
    '&:last-child': {
        marginBottom: 0,
    },
}));

const DeviceIcon = styled(Box)<{ deviceType: DeviceType }>(({ theme, deviceType }) => ({
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor:
        deviceType === 'iphone'
            ? theme.custom.status.draft.background
            : deviceType === 'android'
                ? theme.custom.status.success.background
                : theme.custom.status.info.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color:
        deviceType === 'iphone'
            ? theme.custom.status.draft.main
            : deviceType === 'android'
                ? theme.custom.status.success.main
                : theme.palette.info.light,
    '& svg': {
        fontSize: 24,
    },
}));

const PhoneInfo = styled(Box)({
    flex: 1,
});

const PhoneName = styled(Typography)(({ theme }) => ({
    fontSize: '1rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    marginBottom: 4,
}));

const ContactInfo = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: theme.custom.palette.text.muted,
    fontSize: '0.8rem',
    '& svg': {
        fontSize: 14,
    },
}));

const DateRange = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
});

const DateLabel = styled(Typography)(({ theme }) => ({
    fontSize: '0.65rem',
    color: theme.palette.text.disabled,
    textTransform: 'uppercase',
}));

const DateValue = styled(Typography)(({ theme }) => ({
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
}));

const EntitySelectionCard = styled(Box)<{ isSelected: boolean }>(({ theme, isSelected }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: isSelected ? theme.custom.surface.orange10 : 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    border: isSelected ? `1px solid ${theme.custom.border.orange}` : `1px solid ${theme.custom.surface.white8}`,
    marginBottom: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
        backgroundColor: isSelected ? theme.custom.surface.orange20 : theme.custom.surface.white5,
    },
    '&:last-child': {
        marginBottom: 0,
    },
}));

const EntityIcon = styled(Box)(({ theme }) => ({
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.custom.status.info.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.info.light,
    '& svg': {
        fontSize: 20,
    },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontSize: '0.85rem',
    fontWeight: 600,
    color: theme.custom.palette.text.tertiary,
    marginBottom: 12,
    marginTop: 8,
}));

const deviceIcons: Record<DeviceType, React.ReactElement> = {
    iphone: <PhoneIphoneIcon />,
    android: <AndroidIcon />,
    generic: <SmartphoneIcon />,
};

interface PhoneSelectionOutputProps {
    data: SelectedPhone[];
    entities?: AiGeneratedEntity[];
    isEditing?: boolean;
    onEdit?: (data: SelectedPhone[]) => void;
    onSelectionChange?: (selectedEntityIds: string[]) => void;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export function PhoneSelectionOutput({
    data,
    entities = [],
    isExpanded = false,
    onToggleExpand,
    onSelectionChange,
}: PhoneSelectionOutputProps) {
    // Track which entities are selected for phone generation
    const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(() => {
        // Initialize with already selected phones
        return new Set(data.map(phone => phone.entity_id));
    });

    // Update selection when data changes
    useEffect(() => {
        setSelectedEntityIds(new Set(data.map(phone => phone.entity_id)));
    }, [data]);

    const handleEntityToggle = (entityId: string) => {
        setSelectedEntityIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(entityId)) {
                newSet.delete(entityId);
            } else {
                newSet.add(entityId);
            }
            onSelectionChange?.(Array.from(newSet));
            return newSet;
        });
    };

    // Get entities that don't have a phone yet
    const availableEntities = entities.filter(
        entity => !data.some(phone => phone.entity_id === entity.entity_id)
    );

    return (
        <Container>
            <Header>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={(theme) => ({ color: theme.palette.text.primary, fontWeight: 600, fontSize: '1.1rem' })}>
                        Phone Selection
                    </Typography>
                    <Chip
                        label={`${selectedEntityIds.size} selected`}
                        size="small"
                        sx={(theme) => ({
                            backgroundColor: theme.custom.surface.orange20,
                            color: theme.palette.secondary.main,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                        })}
                    />
                    {onToggleExpand && (
                        <ActionButton onClick={onToggleExpand} size="small">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </ActionButton>
                    )}
                </Box>
            </Header>

            <Collapse in={isExpanded}>
                <Box>
                    {/* Already selected phones */}
                    {data.length > 0 && (
                        <>
                            <SectionTitle>Selected Phones</SectionTitle>
                            {data.map((phone, index) => (
                                <PhoneCard key={`${phone.entity_id}-${index}`}>
                                    <Checkbox
                                        checked={selectedEntityIds.has(phone.entity_id)}
                                        onChange={() => handleEntityToggle(phone.entity_id)}
                                        sx={(theme) => ({
                                            color: theme.palette.text.disabled,
                                            '&.Mui-checked': {
                                                color: theme.palette.secondary.main,
                                            },
                                        })}
                                    />
                                    <DeviceIcon deviceType={phone.device_type}>
                                        {deviceIcons[phone.device_type]}
                                    </DeviceIcon>

                                    <PhoneInfo>
                                        <PhoneName>{phone.entity_name}</PhoneName>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            {phone.phone_number && (
                                                <ContactInfo>
                                                    <PhoneIcon />
                                                    {phone.phone_number}
                                                </ContactInfo>
                                            )}
                                            {phone.email && (
                                                <ContactInfo>
                                                    <EmailIcon />
                                                    {phone.email}
                                                </ContactInfo>
                                            )}
                                        </Box>
                                    </PhoneInfo>

                                    <Chip
                                        label={phone.device_type.toUpperCase()}
                                        size="small"
                                        sx={(theme) => ({
                                            backgroundColor:
                                                phone.device_type === 'iphone'
                                                    ? theme.custom.status.draft.background
                                                    : phone.device_type === 'android'
                                                        ? theme.custom.status.success.background
                                                        : theme.custom.status.info.background,
                                            color:
                                                phone.device_type === 'iphone'
                                                    ? theme.custom.status.draft.main
                                                    : phone.device_type === 'android'
                                                        ? theme.custom.status.success.main
                                                        : theme.palette.info.light,
                                            fontWeight: 600,
                                            fontSize: '0.65rem',
                                        })}
                                    />

                                    {(phone.start_date || phone.end_date) && (
                                        <DateRange>
                                            <Box>
                                                <DateLabel>From</DateLabel>
                                                <DateValue>{formatDate(phone.start_date)}</DateValue>
                                            </Box>
                                            <Box>
                                                <DateLabel>To</DateLabel>
                                                <DateValue>{formatDate(phone.end_date)}</DateValue>
                                            </Box>
                                        </DateRange>
                                    )}
                                </PhoneCard>
                            ))}
                        </>
                    )}

                    {/* Available entities to select */}
                    {availableEntities.length > 0 && (
                        <>
                            {data.length > 0 && <Divider sx={(theme) => ({ my: 2, borderColor: theme.custom.border.default })} />}
                            <SectionTitle>
                                Available Entities ({availableEntities.length})
                            </SectionTitle>
                            <Typography sx={(theme) => ({ color: theme.custom.palette.text.placeholder, fontSize: '0.8rem', mb: 1.5 })}>
                                Select entities to generate phones for
                            </Typography>
                            {availableEntities.map((entity) => (
                                <EntitySelectionCard
                                    key={entity.entity_id}
                                    isSelected={selectedEntityIds.has(entity.entity_id)}
                                    onClick={() => handleEntityToggle(entity.entity_id)}
                                >
                                    <Checkbox
                                        checked={selectedEntityIds.has(entity.entity_id)}
                                        sx={(theme) => ({
                                            color: theme.palette.text.disabled,
                                            '&.Mui-checked': {
                                                color: theme.palette.secondary.main,
                                            },
                                            padding: 0,
                                        })}
                                    />
                                    <EntityIcon>
                                        <PersonIcon />
                                    </EntityIcon>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography sx={(theme) => ({ color: theme.palette.text.primary, fontWeight: 500, fontSize: '0.9rem' })}>
                                            {entity.name}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                            {entity.characteristics?.occupation && (
                                                <Typography sx={(theme) => ({ color: theme.custom.palette.text.placeholder, fontSize: '0.75rem' })}>
                                                    {entity.characteristics.occupation}
                                                </Typography>
                                            )}
                                            {entity.phone_numbers?.length > 0 && (
                                                <Chip
                                                    size="small"
                                                    label={entity.phone_numbers[0]}
                                                    sx={(theme) => ({
                                                        height: 18,
                                                        fontSize: '0.65rem',
                                                        backgroundColor: theme.custom.surface.white8,
                                                        color: theme.custom.palette.text.tertiary,
                                                    })}
                                                />
                                            )}
                                        </Box>
                                    </Box>
                                </EntitySelectionCard>
                            ))}
                        </>
                    )}

                    {data.length === 0 && availableEntities.length === 0 && (
                        <Typography
                            sx={(theme) => ({
                                color: theme.palette.text.disabled,
                                textAlign: 'center',
                                py: 4,
                            })}
                        >
                            No entities available for phone generation
                        </Typography>
                    )}
                </Box>
            </Collapse>
        </Container>
    );
}
