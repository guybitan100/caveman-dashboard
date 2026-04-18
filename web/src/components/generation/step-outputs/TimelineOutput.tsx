/**
 * TimelineOutput Component
 * Displays timeline events as a vertical timeline
 */

import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CallIcon from "@mui/icons-material/Call";
import ComputerIcon from "@mui/icons-material/Computer";
import EventIcon from "@mui/icons-material/Event";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupIcon from "@mui/icons-material/Group";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import ShareIcon from "@mui/icons-material/Share";
import WorkIcon from "@mui/icons-material/Work";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Typography,
} from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import { useState } from "react";
import { AiGeneratedEntity, EventCategory, TimelineEvent } from "../../../types/pipeline.ts";
import { formatTimestamp } from "../../../utils/date";
import { ActionButton } from "../../shared/styledComponents";

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.custom.surface.white5,
  borderRadius: 12,
  padding: 20,
  border: `1px solid ${theme.custom.border.default}`,
}));

const Header = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
});

const TimelineContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  paddingLeft: 34,
  "&::before": {
    content: '""',
    position: "absolute",
    left: 8,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.custom.border.light,
    borderRadius: 1,
  },
}));

const TimelineItem = styled(Box)({
  position: "relative",
  paddingBottom: 20,
  "&:last-child": {
    paddingBottom: 0,
  },
});

const TimelineDot = styled(Box)<{ category: EventCategory }>(({ theme, category }) => ({
  position: "absolute",
  left: -40,
  top: 4,
  width: 30,
  height: 30,
  borderRadius: "50%",
  backgroundColor: theme.custom.eventCategory[category] || "#6b7280",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid #020b20",
  "& svg": {
    fontSize: 16,
    color: "#fff",
  },
}));

const EventCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.custom.surface.white5,
  borderRadius: 10,
  padding: 14,
  border: `1px solid ${theme.custom.surface.white8}`,
}));

const EventTime = styled(Typography)(({ theme }) => ({
  fontSize: "0.7rem",
  color: theme.palette.text.disabled,
  fontFamily: "monospace",
  marginBottom: 4,
}));

const EventDescription = styled(Typography)(({ theme }) => ({
  fontSize: "0.9rem",
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
  marginBottom: 8,
}));

const EventMeta = styled(Box)({
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
});

const categoryIcons: Record<EventCategory, React.ReactElement> = {
  communication: <CallIcon />,
  location: <LocationOnIcon />,
  media: <PhotoCameraIcon />,
  social: <ShareIcon />,
  financial: <AttachMoneyIcon />,
  work: <WorkIcon />,
  meeting: <GroupIcon />,
  digital_activity: <ComputerIcon />,
  other: <EventIcon />,
};

interface TimelineOutputProps {
  data: TimelineEvent[];
  entities?: AiGeneratedEntity[];
  isEditing?: boolean;
  onEdit?: (data: TimelineEvent[]) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function TimelineOutput({
  data,
  entities = [],
  isExpanded = false,
  onToggleExpand,
}: TimelineOutputProps) {
  const theme = useTheme();
  const [visibleCount, setVisibleCount] = useState(data.length);

  const getCategoryColor = (category: EventCategory): string => {
    return theme.custom.eventCategory[category] || "#6b7280";
  };

  const getEntityName = (entityId: string): string => {
    const entity = entities.find((e) => e.entity_id === entityId);
    return entity?.name || entityId;
  };

  const formatCategory = (category: EventCategory): string => {
    return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Sort events by timestamp
  const sortedEvents = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <Container>
      <Header>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={(theme) => ({ color: theme.palette.text.primary, fontWeight: 600, fontSize: "1.1rem" })}>
            Timeline
          </Typography>
          <Chip
            label={`${data.length} events`}
            size="small"
            sx={(theme) => ({
              backgroundColor: theme.custom.status.finalizing.background,
              color: "#22d3ee",
              fontWeight: 600,
              fontSize: "0.7rem",
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
        <TimelineContainer>
          {sortedEvents.slice(0, visibleCount).map((event) => (
            <TimelineItem key={event.event_id}>
              <TimelineDot category={event.category}>
                {categoryIcons[event.category]}
              </TimelineDot>
              <EventCard>
                <EventTime>{formatTimestamp(event.timestamp)}</EventTime>
                <EventDescription>{event.description}</EventDescription>
                <EventMeta>
                  <Chip
                    label={formatCategory(event.category)}
                    size="small"
                    sx={{
                      backgroundColor: `${getCategoryColor(event.category)}20`,
                      color: getCategoryColor(event.category),
                      fontWeight: 500,
                      fontSize: "0.65rem",
                      height: 20,
                    }}
                  />
                  {event.location && (
                    <Chip
                      icon={
                        <LocationOnIcon sx={{ fontSize: "12px !important" }} />
                      }
                      label={event.location}
                      size="small"
                      sx={(theme) => ({
                        backgroundColor: theme.custom.surface.white8,
                        color: theme.custom.palette.text.tertiary,
                        fontSize: "0.65rem",
                        height: 20,
                        "& .MuiChip-icon": {
                          color: "inherit",
                        },
                      })}
                    />
                  )}
                  {event.involved_entities.length > 0 && (
                    <Typography
                      sx={(theme) => ({
                        fontSize: "0.7rem",
                        color: theme.custom.palette.text.placeholder,
                      })}
                    >
                      {event.involved_entities.map(getEntityName).join(", ")}
                    </Typography>
                  )}
                  {event.significance >= 7 && (
                    <Chip
                      label="Important"
                      size="small"
                      sx={(theme) => ({
                        backgroundColor: theme.custom.surface.orange20,
                        color: theme.palette.secondary.main,
                        fontWeight: 600,
                        fontSize: "0.6rem",
                        height: 18,
                      })}
                    />
                  )}
                </EventMeta>
              </EventCard>
            </TimelineItem>
          ))}
        </TimelineContainer>

        {data.length > visibleCount && (
          <Button
            onClick={() =>
              setVisibleCount((prev) => Math.min(prev + 20, data.length))
            }
            sx={(theme) => ({
              display: "block",
              margin: "16px auto 0",
              color: theme.custom.palette.text.muted,
              textTransform: "none",
              fontSize: "0.85rem",
              "&:hover": {
                color: theme.palette.text.primary,
                backgroundColor: theme.custom.surface.white8,
              },
            })}
          >
            + {data.length - visibleCount} more events
          </Button>
        )}

        {data.length === 0 && (
          <Typography
            sx={(theme) => ({
              color: theme.palette.text.disabled,
              textAlign: "center",
              py: 4,
            })}
          >
            No timeline events generated
          </Typography>
        )}
      </Collapse>
    </Container>
  );
}
