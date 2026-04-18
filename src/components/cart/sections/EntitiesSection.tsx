import { Box, Typography, Avatar, Chip } from "@mui/material";
import { styled } from "@mui/material/styles";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import StarIcon from "@mui/icons-material/Star";
import { useCartStore } from "../../../stores/cartStore";
import { AccordionSection } from "../AccordionSection";
import { getEntityDisplayName, getEntityInitials } from "../../../utils/entity";
import { EmptyStateCompact as EmptyState } from "../../shared/styledComponents";


const EntityItem = styled(Box)(({ theme }) => ({
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.primary8,
    border: `1px solid ${theme.custom.surface.primary15}`,
    marginBottom: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    transition: theme.transitions.create(["background-color", "border-color"]),

    "&:hover": {
        backgroundColor: theme.custom.surface.primary10,
        borderColor: theme.palette.primary.main,
    },
}));

const EntityAvatar = styled(Avatar)(({ theme }) => ({
    width: 36,
    height: 36,
    backgroundColor: theme.palette.primary.main,
    fontSize: "0.875rem",
}));

const EntityInfo = styled(Box)({
    flex: 1,
    minWidth: 0,
});

const EntityName = styled(Typography)(({ theme }) => ({
    fontSize: "0.9rem",
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.primary,
}));

const EntityDetails = styled(Typography)(({ theme }) => ({
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
}));

const OwnerChip = styled(Chip)(({ theme }) => ({
    height: 20,
    fontSize: "0.65rem",
    fontWeight: theme.typography.fontWeightMedium,
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
    "& .MuiChip-icon": {
        fontSize: "0.75rem",
    },
}));


export function EntitiesSection() {
    const { job, getSectionItemCount } = useCartStore();
    const itemCount = getSectionItemCount("entities");
    const entities = job?.entities ?? [];
    const ownerEntity = job?.owner_entity;

    return (
        <AccordionSection
            title="Entities"
            icon={<PeopleIcon />}
            itemCount={itemCount}
            sectionKey="entities"
        >
            {entities.length === 0 && !ownerEntity ? (
                <EmptyState>
                    <PersonIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                    <Typography variant="body2" color="textSecondary">
                        No entities added
                    </Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                        Entities represent people in the device&apos;s social context
                    </Typography>
                </EmptyState>
            ) : (
                <Box sx={{ p: 2 }}>
                    {/* Owner Entity */}
                    {ownerEntity && (
                        <EntityItem sx={(theme) => ({ borderColor: theme.palette.warning.main })}>
                            <EntityAvatar sx={(theme) => ({ backgroundColor: theme.palette.warning.main, color: theme.palette.warning.contrastText })}>
                                {getEntityInitials(ownerEntity)}
                            </EntityAvatar>
                            <EntityInfo>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <EntityName>{getEntityDisplayName(ownerEntity)}</EntityName>
                                    <OwnerChip
                                        icon={<StarIcon />}
                                        label="Owner"
                                        size="small"
                                    />
                                </Box>
                                <EntityDetails>
                                    {[ownerEntity.phone, ownerEntity.email].filter(Boolean).join(" • ")}
                                </EntityDetails>
                            </EntityInfo>
                        </EntityItem>
                    )}

                    {entities.map((entity) => (
                        <EntityItem key={entity.uid}>
                            <EntityAvatar>{getEntityInitials(entity)}</EntityAvatar>
                            <EntityInfo>
                                <EntityName>{getEntityDisplayName(entity)}</EntityName>
                                <EntityDetails>
                                    {[entity.phone, entity.email].filter(Boolean).join(" • ") || "No contact info"}
                                </EntityDetails>
                            </EntityInfo>
                        </EntityItem>
                    ))}
                </Box>
            )}
        </AccordionSection>
    );
}
