import { Box, Typography, Chip } from "@mui/material";
import { styled } from "@mui/material/styles";
import EventIcon from "@mui/icons-material/Event";
import { useCartStore } from "../../../stores/cartStore";
import { AccordionSection } from "../AccordionSection";
import { EmptyStateCompact as EmptyState } from "../../shared/styledComponents";

const TaskItem = styled(Box)(({ theme }) => ({
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.surface.primary8,
    border: `1px solid ${theme.custom.surface.primary15}`,
    marginBottom: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    transition: theme.transitions.create(["background-color", "border-color"]),

    "&:hover": {
        backgroundColor: theme.custom.surface.primary10,
        borderColor: theme.palette.primary.main,
    },
}));

const TaskInfo = styled(Box)({
    flex: 1,
    minWidth: 0,
});

const TaskType = styled(Typography)(({ theme }) => ({
    fontSize: "0.9rem",
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.primary,
    textTransform: "capitalize",
}));

const CountChip = styled(Chip)(({ theme }) => ({
    height: 24,
    fontSize: "0.75rem",
    fontWeight: theme.typography.fontWeightMedium,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
}));

export function TasksSection() {
    const { job, getSectionItemCount } = useCartStore();
    const itemCount = getSectionItemCount("tasks");
    const tasks = job?.tasks ?? [];

    return (
        <AccordionSection
            title="Generation Tasks"
            icon={<EventIcon />}
            itemCount={itemCount}
            sectionKey="tasks"
        >
            {tasks.length === 0 ? (
                <EmptyState>
                    <Typography variant="body2" color="textSecondary">
                        No generation tasks added
                    </Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                        Tasks define what events to generate
                    </Typography>
                </EmptyState>
            ) : (
                <Box sx={{ p: 2 }}>
                    {tasks.map((task) => (
                        <TaskItem key={task.task_id}>
                            <TaskInfo>
                                <TaskType>{task.event_type}</TaskType>
                            </TaskInfo>
                            <CountChip label={`${task.quantity}`} size="small" />
                        </TaskItem>
                    ))}
                </Box>
            )}
        </AccordionSection>
    );
}
