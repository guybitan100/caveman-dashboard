import { styled } from '@mui/material/styles';
import {
    Box,
    Typography,
    Chip,
    Collapse,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import AndroidIcon from '@mui/icons-material/Android';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { JobGenerationResult, PhoneStoryMapping, DeviceType } from '../../../types/pipeline.ts';
import { useState } from 'react';
import { ActionButton } from '../../shared/styledComponents';

const Container = styled(Box)(({ theme }) => ({
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius * 1.5,
    padding: theme.spacing(2.5),
    border: `1px solid ${theme.custom.border.default}`,
}));

const Header = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
}));

const SummaryStats = styled(Box)(({ theme }) => ({
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2.5),
}));

const StatCard = styled(Box)(({ theme }) => ({
    flex: 1,
    padding: theme.spacing(2),
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius * 1.25,
    border: `1px solid ${theme.custom.border.light}`,
    textAlign: 'center',
}));

const StatValue = styled(Typography)(({ theme }) => ({
    fontSize: '1.5rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.secondary.main,
    marginBottom: theme.spacing(0.5),
}));

const StatLabel = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    color: theme.palette.text.disabled,
    textTransform: 'uppercase',
}));

const PhoneMappingCard = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2),
    backgroundColor: theme.custom.surface.white5,
    borderRadius: theme.shape.borderRadius * 1.25,
    border: `1px solid ${theme.custom.border.light}`,
    marginBottom: theme.spacing(1.5),
    '&:last-child': {
        marginBottom: 0,
    },
}));

const PhoneMappingHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    cursor: 'pointer',
}));

const DeviceIcon = styled(Box)<{ deviceType: DeviceType }>(({ deviceType, theme }) => ({
    width: 40,
    height: 40,
    borderRadius: theme.shape.borderRadius * 1.25,
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
                : theme.custom.status.info.main,
    '& svg': {
        fontSize: 22,
    },
}));

const PhoneInfo = styled(Box)({
    flex: 1,
});

const PhoneName = styled(Typography)(({ theme }) => ({
    fontSize: '1rem',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.primary,
}));

const StoryCount = styled(Typography)(({ theme }) => ({
    fontSize: '0.8rem',
    color: theme.palette.text.disabled,
}));

const StoryTypeList = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    paddingTop: theme.spacing(1.5),
    borderTop: `1px solid ${theme.custom.border.light}`,
}));

const deviceIcons: Record<DeviceType, React.ReactElement> = {
    iphone: <PhoneIphoneIcon />,
    android: <AndroidIcon />,
    generic: <SmartphoneIcon />,
};

interface StoryGenerationOutputProps {
    data: JobGenerationResult;
    isEditing?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export function StoryGenerationOutput({
    data,
    isExpanded = false,
    onToggleExpand,
}: StoryGenerationOutputProps) {
    const [expandedMappings, setExpandedMappings] = useState<Set<string>>(new Set());

    const toggleMapping = (entityId: string) => {
        setExpandedMappings(prev => {
            const newSet = new Set(prev);
            if (newSet.has(entityId)) {
                newSet.delete(entityId);
            } else {
                newSet.add(entityId);
            }
            return newSet;
        });
    };

    const getTotalStoryTypes = () => {
        const types = new Set<string>();
        data.phone_mappings.forEach(mapping => {
            Object.keys(mapping.story_type_counts).forEach(type => types.add(type));
        });
        return types.size;
    };

    const renderPhoneMapping = (mapping: PhoneStoryMapping) => {
        const isExpanded = expandedMappings.has(mapping.phone.entity_id);
        const storyCount = mapping.stories.length;

        return (
            <PhoneMappingCard key={mapping.phone.entity_id}>
                <PhoneMappingHeader onClick={() => toggleMapping(mapping.phone.entity_id)}>
                    <DeviceIcon deviceType={mapping.phone.device_type}>
                        {deviceIcons[mapping.phone.device_type]}
                    </DeviceIcon>
                    <PhoneInfo>
                        <PhoneName>{mapping.phone.entity_name}</PhoneName>
                        <StoryCount>
                            {storyCount} {storyCount === 1 ? 'story' : 'stories'} generated
                        </StoryCount>
                    </PhoneInfo>
                    <ActionButton size="small">
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ActionButton>
                </PhoneMappingHeader>

                <Collapse in={isExpanded}>
                    <StoryTypeList>
                        {Object.entries(mapping.story_type_counts).map(([type, count]) => (
                            <Chip
                                key={type}
                                icon={<AutoStoriesIcon sx={{ fontSize: 14 }} />}
                                label={`${type}: ${count}`}
                                size="small"
                                sx={{
                                    backgroundColor: 'rgba(255, 83, 0, 0.15)',
                                    color: '#ff8c4d',
                                    border: '1px solid rgba(255, 83, 0, 0.3)',
                                    '& .MuiChip-icon': {
                                        color: '#ff8c4d',
                                    },
                                }}
                            />
                        ))}
                    </StoryTypeList>
                </Collapse>
            </PhoneMappingCard>
        );
    };

    return (
        <Container>
            <Header>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoStoriesIcon sx={{ color: '#ff5300', fontSize: 20 }} />
                    <Typography sx={{ fontWeight: 600, color: '#fff' }}>
                        Story Generation Results
                    </Typography>
                </Box>
                {onToggleExpand && (
                    <ActionButton onClick={onToggleExpand} size="small">
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ActionButton>
                )}
            </Header>

            <Collapse in={isExpanded}>
                <SummaryStats>
                    <StatCard>
                        <StatValue>{data.total_stories_generated}</StatValue>
                        <StatLabel>Stories Generated</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatValue>{data.total_jobs_created}</StatValue>
                        <StatLabel>Jobs Created</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatValue>{getTotalStoryTypes()}</StatValue>
                        <StatLabel>Story Types</StatLabel>
                    </StatCard>
                </SummaryStats>

                <Typography
                    sx={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.7)',
                        marginBottom: 2,
                    }}
                >
                    Phone Mappings ({data.phone_mappings.length})
                </Typography>

                {data.phone_mappings.map(renderPhoneMapping)}

                {data.all_jobs_submitted && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            marginTop: 2,
                            padding: 1.5,
                            backgroundColor: 'rgba(74, 222, 128, 0.1)',
                            borderRadius: 2,
                            border: '1px solid rgba(74, 222, 128, 0.3)',
                        }}
                    >
                        <CheckCircleIcon sx={{ color: '#4ade80', fontSize: 20 }} />
                        <Typography sx={{ color: '#4ade80', fontSize: '0.875rem' }}>
                            All jobs ready for submission
                        </Typography>
                    </Box>
                )}
            </Collapse>
        </Container>
    );
}
