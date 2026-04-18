import { ReactNode } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CartSectionKey } from '../../types/cart.ts';
import { useCartStore } from '../../stores/cartStore.ts';


const SectionContainer = styled(Box)(({ theme }) => ({
    marginBottom: theme.spacing(1),
}));

interface SectionHeaderProps {
    isExpanded: boolean;
}

const SectionHeader = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'isExpanded',
})<SectionHeaderProps>(({ isExpanded, theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2.5),
    cursor: 'pointer',
    userSelect: 'none',
    background: isExpanded
        ? `linear-gradient(135deg, ${theme.custom.surface.white10} 0%, ${theme.custom.surface.white5} 100%)`
        : 'transparent',
    backdropFilter: isExpanded ? 'blur(12px)' : 'none',
    borderBottom: isExpanded ? `1px solid ${theme.custom.border.default}` : 'none',
    transition: 'all 0.2s ease',

    '&:hover': {
        backgroundColor: theme.custom.surface.primary8,
    },
}));

const IconWrapper = styled(Box)(({ theme }) => ({
    width: 32,
    height: 32,
    borderRadius: theme.shape.borderRadius,
    background: `linear-gradient(135deg, ${theme.custom.surface.primary15} 0%, ${theme.custom.surface.primary8} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
}));

const TitleWrapper = styled(Box)(({ theme }) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.primary,
}));

const ItemCount = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.custom.surface.primary15,
    color: theme.palette.primary.main,
    fontSize: '0.75rem',
    fontWeight: theme.typography.fontWeightBold,
    padding: '0 6px',
}));

interface ChevronIconProps {
    isExpanded: boolean;
}

const ChevronIcon = styled(ExpandMoreIcon, {
    shouldForwardProp: (prop) => prop !== 'isExpanded',
})<ChevronIconProps>(({ isExpanded, theme }) => ({
    color: theme.palette.text.disabled,
    fontSize: 20,
    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.2s ease',
}));

const SectionContent = styled(Box)(({ theme }) => ({
    padding: theme.spacing(1.5, 2.5),
}));

interface AccordionSectionProps {
    sectionKey: CartSectionKey;
    title: string;
    icon: ReactNode;
    itemCount: number;
    children: ReactNode;
    emptyMessage?: string;
    addButton?: ReactNode;
}

export function AccordionSection({
    sectionKey,
    title,
    icon,
    itemCount,
    children,
    emptyMessage = 'No items added',
    addButton,
}: AccordionSectionProps) {
    const { expandedSections, toggleSection } = useCartStore();
    const isExpanded = expandedSections[sectionKey];

    const handleToggle = () => {
        toggleSection(sectionKey);
    };

    return (
        <SectionContainer>
            <SectionHeader
                onClick={handleToggle}
                isExpanded={isExpanded}
                role="button"
                aria-expanded={isExpanded}
                aria-controls={`section-${sectionKey}-content`}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
            >
                <IconWrapper>{icon}</IconWrapper>
                <TitleWrapper>
                    <SectionTitle>{title}</SectionTitle>
                    {itemCount > 0 && <ItemCount>{itemCount}</ItemCount>}
                </TitleWrapper>
                <ChevronIcon isExpanded={isExpanded} />
            </SectionHeader>

            <Collapse
                in={isExpanded}
                timeout={200}
                id={`section-${sectionKey}-content`}
            >
                <SectionContent>
                    {itemCount === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                            <Typography
                                sx={{
                                    color: 'text.disabled',
                                    fontSize: '0.875rem',
                                    mb: addButton ? 2 : 0,
                                }}
                            >
                                {emptyMessage}
                            </Typography>
                            {addButton}
                        </Box>
                    ) : (
                        <>
                            {children}
                            {addButton && (
                                <Box sx={{ mt: 2, textAlign: 'center' }}>
                                    {addButton}
                                </Box>
                            )}
                        </>
                    )}
                </SectionContent>
            </Collapse>
        </SectionContainer>
    );
}
