import { Box, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';

const LoadingContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
});

const SkeletonCard = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.white5,
    border: `1px solid ${theme.custom.border.default}`,
}));

const SkeletonContent = styled(Box)({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
});

interface LoadingStateProps {
    count?: number;
}

export function LoadingState({ count = 12 }: LoadingStateProps) {
    return (
        <LoadingContainer>
            {Array.from({ length: count }).map((_, index) => (
                <SkeletonCard key={index}>
                    <SkeletonContent>
                        <Skeleton
                            variant="text"
                            width="70%"
                            height={20}
                            sx={(theme) => ({ bgcolor: theme.custom.surface.white10 })}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Skeleton
                                variant="text"
                                width="40%"
                                height={16}
                                sx={(theme) => ({ bgcolor: theme.custom.surface.white10 })}
                            />
                            <Skeleton
                                variant="text"
                                width="20%"
                                height={16}
                                sx={(theme) => ({ bgcolor: theme.custom.surface.white10 })}
                            />
                        </Box>
                    </SkeletonContent>
                </SkeletonCard>
            ))}
        </LoadingContainer>
    );
}
