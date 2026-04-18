import { Box, Badge } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useCartStore } from '../../stores/cartStore.ts';


const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(139, 92, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
  }
`;

const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
`;

const FABContainer = styled(Box)(({ theme }) => ({
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: theme.zIndex.fab || 1050,
}));

interface FABButtonProps {
    hasItems: boolean;
}

const FABButton = styled('button', {
    shouldForwardProp: (prop) => prop !== 'hasItems',
})<FABButtonProps>(({ theme, hasItems }) => ({
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
    boxShadow: `0 8px 32px rgba(124, 58, 237, 0.4), 0 0 20px rgba(139, 92, 246, 0.2)`,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    overflow: 'visible',

    // Glow effect
    '&::before': {
        content: '""',
        position: 'absolute',
        inset: -4,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${theme.palette.primary.main}40 0%, ${theme.palette.primary.light}20 100%)`,
        filter: 'blur(8px)',
        opacity: 0.6,
        transition: 'opacity 0.3s ease',
        zIndex: -1,
    },

    '&:hover': {
        transform: 'scale(1.08)',
        boxShadow: `0 12px 40px rgba(124, 58, 237, 0.5), 0 0 30px rgba(139, 92, 246, 0.3)`,

        '&::before': {
            opacity: 1,
        },
    },

    '&:active': {
        transform: 'scale(0.98)',
    },

    '&:focus-visible': {
        outline: `3px solid ${theme.palette.primary.light}`,
        outlineOffset: 4,
    },

    // Pulse animation when has items
    ...(hasItems && {
        animation: `${pulse} 2s infinite`,
    }),
}));

const CartIcon = styled(ShoppingCartIcon)(({ theme }) => ({
    fontSize: 26,
    color: theme.palette.primary.contrastText,
    transition: 'transform 0.2s ease',

    'button:hover &': {
        transform: 'scale(1.1)',
    },
}));

const StyledBadge = styled(Badge)(({ theme }) => ({
    '& .MuiBadge-badge': {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        fontSize: '0.75rem',
        fontWeight: theme.typography.fontWeightBold,
        minWidth: 20,
        height: 20,
        padding: '0 6px',
        borderRadius: 10,
        boxShadow: theme.shadows[4],
        border: `2px solid ${theme.palette.background.default}`,
        animation: `${bounce} 0.5s ease`,

        '&.MuiBadge-invisible': {
            display: 'none',
        },
    },
}));

export function FloatingCartButton() {
    const { isOpen, toggleCart, getTotalItemCount } = useCartStore();
    const itemCount = getTotalItemCount();

    return (
        <FABContainer>
            <StyledBadge
                badgeContent={itemCount}
                max={99}
                invisible={itemCount === 0}
                overlap="circular"
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <FABButton
                    onClick={toggleCart}
                    hasItems={itemCount > 0}
                    aria-label={`Open data inputs cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
                    aria-expanded={isOpen}
                    aria-haspopup="dialog"
                >
                    <CartIcon />
                </FABButton>
            </StyledBadge>
        </FABContainer>
    );
}
