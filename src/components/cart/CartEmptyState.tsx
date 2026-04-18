
import { Box, Typography, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

const Container = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(6, 3),
    textAlign: 'center',
}));

const IllustrationContainer = styled(Box)(({ theme }) => ({
    width: 120,
    height: 120,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${theme.custom.surface.primary10} 0%, ${theme.custom.surface.primary8} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(3),
    position: 'relative',

    '&::before': {
        content: '""',
        position: 'absolute',
        inset: -4,
        borderRadius: '50%',
        border: `2px dashed ${theme.custom.surface.primary20}`,
    },
}));

const CartEmoji = styled(Typography)({
    fontSize: '3rem',
});

const Title = styled(Typography)(({ theme }) => ({
    fontSize: '1.125rem',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(1),
}));

const Description = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3),
    maxWidth: 260,
    lineHeight: 1.5,
}));

const AddButton = styled(Button)(({ theme }) => ({
    textTransform: 'none',
    fontWeight: theme.typography.fontWeightBold,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1.25, 3),
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
    boxShadow: theme.shadows[8],

    '&:hover': {
        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
        boxShadow: theme.shadows[12],
    },
}));

export function CartEmptyState() {
    return (
        <Container>
            <IllustrationContainer>
                <CartEmoji>🛒</CartEmoji>
            </IllustrationContainer>

            <Title>Your cart is empty</Title>

            <Description>
                Add device information, events, files, stories, or custom events to get started with your generation.
            </Description>

            <AddButton
                variant="contained"
                startIcon={<AddCircleOutlineIcon />}
            >
                Add Data
            </AddButton>
        </Container>
    );
}
