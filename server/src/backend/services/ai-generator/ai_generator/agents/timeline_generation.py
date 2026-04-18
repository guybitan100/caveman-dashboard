"""Timeline generation agent - creates chronological event timeline."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field, ValidationError
from pydantic_ai import Agent

from core.six_logger import logger

from ai_generator.models.timeline import TimelineEvent, EventCategory
from ai_generator.utils import get_model

if TYPE_CHECKING:
    from ai_generator.models.entity import Entity
    from ai_generator.models.social_graph import SocialGraph
    from ai_generator.models.story import StoryExpansion


class RawTimelineEvent(BaseModel):
    """
    LLM-friendly output schema for a single timeline event.
    
    Uses simpler types that LLMs handle well, then converts to TimelineEvent.
    """
    
    event_id: str | None = Field(
        default=None,
        description="Unique identifier for this event (optional, will be auto-generated)"
    )
    
    timestamp: str = Field(
        description="When the event occurred in ISO format (e.g., '2025-11-15T09:30:00')"
    )
    
    category: str = Field(
        description="Event category: communication, location, media, social, financial, work, meeting, digital_activity, or other"
    )
    
    involved_entities: list[str] = Field(
        default_factory=list,
        description="Entity IDs of all entities involved in this event"
    )
    
    primary_entity: str = Field(
        description="Entity ID of the primary entity (whose phone this event would appear on)"
    )
    
    description: str = Field(
        description="Detailed description of what happened"
    )
    
    location: str | None = Field(
        default=None,
        description="Location where the event occurred, if applicable"
    )
    
    coordinates: list[float] | None = Field(
        default=None,
        description="GPS coordinates as [latitude, longitude] if applicable"
    )
    
    metadata: dict[str, str | int | float | bool] = Field(
        default_factory=dict,
        description="Additional metadata (all values must be scalar: string, number, or boolean)"
    )
    
    significance: int = Field(
        default=5,
        ge=1,
        le=10,
        description="How significant this event is to the story (1=background noise, 10=critical plot point)"
    )
    
    def to_timeline_event(self, idx: int) -> TimelineEvent:
        """Convert to a proper TimelineEvent model."""
        # Generate event_id if not provided
        event_id = self.event_id or f"evt_{idx + 1:03d}"
        
        # Parse timestamp
        timestamp = datetime.fromisoformat(self.timestamp.replace("Z", "+00:00"))
        
        # Convert coordinates to tuple
        coordinates = tuple(self.coordinates) if self.coordinates and len(self.coordinates) == 2 else None
        
        # Parse category
        try:
            category = EventCategory(self.category.lower())
        except ValueError:
            category = EventCategory.OTHER
        
        return TimelineEvent(
            event_id=event_id,
            timestamp=timestamp,
            category=category,
            involved_entities=self.involved_entities,
            primary_entity=self.primary_entity,
            description=self.description,
            location=self.location,
            coordinates=coordinates,
            metadata=self.metadata,
            significance=self.significance,
        )


class TimelineOutput(BaseModel):
    """Output schema for timeline generation."""

    events: list[RawTimelineEvent] = Field(description="List of timeline events")


class FixedEventOutput(BaseModel):
    """Output schema for the error recovery agent."""

    fixed_event: RawTimelineEvent = Field(description="The corrected event")


# Load instructions from prompt files
_PROMPT_PATH = Path(__file__).parent / "prompts" / "timeline_generation.md"
_INSTRUCTIONS = _PROMPT_PATH.read_text()

_FIX_PROMPT_PATH = Path(__file__).parent / "prompts" / "timeline_fix.md"
_FIX_INSTRUCTIONS = _FIX_PROMPT_PATH.read_text()

timeline_generation_agent = Agent(
    name="timeline_generation_agent",
    model=get_model(),
    output_type=TimelineOutput,
    instructions=_INSTRUCTIONS,
)

event_fix_agent = Agent(
    name="event_fix_agent",
    model=get_model(),
    output_type=FixedEventOutput,
    instructions=_FIX_INSTRUCTIONS,
)


async def _fix_event_with_llm(
    raw_event: RawTimelineEvent,
    validation_error: Exception,
) -> RawTimelineEvent:
    """Use LLM to fix a malformed event.

    Args:
        raw_event: The original malformed event
        validation_error: The validation error

    Returns:
        Fixed RawTimelineEvent
    """
    prompt = f"""Fix this event so it validates correctly.

ORIGINAL EVENT:
{raw_event.model_dump_json(indent=2)}

VALIDATION ERROR:
{str(validation_error)}

Remember:
- metadata values must be scalar (string, int, float, bool) - NOT lists or objects
- Convert any lists to comma-separated strings
- Convert any nested objects to JSON strings
- category must be one of: communication, location, media, social, financial, work, meeting, digital_activity, other

Return the fixed event."""

    result = await event_fix_agent.run(prompt)
    return result.output.fixed_event


async def _parse_event(
    raw_event: RawTimelineEvent,
    idx: int,
    max_retries: int = 2,
) -> TimelineEvent:
    """
    Parse and validate a single event, with error recovery.

    Args:
        raw_event: Raw event from LLM
        idx: Index for generating event ID
        max_retries: Maximum LLM fix attempts

    Returns:
        Validated TimelineEvent
    """
    try:
        return raw_event.to_timeline_event(idx)
    except (ValidationError, ValueError) as e:
        logger.warn(
            f"Event validation failed, attempting fix",
            event_id=raw_event.event_id or f"evt_{idx + 1:03d}",
            error=str(e),
        )

        # Try LLM-based fix
        current_event = raw_event
        for attempt in range(max_retries):
            try:
                fixed_event = await _fix_event_with_llm(current_event, e)
                event = fixed_event.to_timeline_event(idx)
                logger.info(
                    f"Event fixed successfully",
                    event_id=event.event_id,
                    attempt=attempt + 1,
                )
                return event

            except (ValidationError, ValueError) as retry_error:
                if attempt < max_retries - 1:
                    logger.warn(
                        f"Fix attempt failed, retrying",
                        attempt=attempt + 1,
                        error=str(retry_error),
                    )
                    current_event = fixed_event if 'fixed_event' in dir() else current_event
                else:
                    raise ValueError(
                        f"Failed to fix event after {max_retries} attempts: {retry_error}"
                    ) from retry_error

        # This should never be reached, but satisfy type checker
        raise ValueError(f"Failed to fix event after {max_retries} attempts")


async def generate_timeline(
    story: StoryExpansion,
    entities: list[Entity],
    social_graph: SocialGraph,
) -> list[TimelineEvent]:
    """
    Generate timeline of events from story.

    Args:
        story: StoryExpansion containing the narrative
        entities: List of Entity models
        social_graph: SocialGraph with relationships

    Returns:
        List of TimelineEvent models in chronological order

    Raises:
        ValueError: If the agent fails to generate valid output
    """
    # Create entity summary
    entity_summary = "\n".join([f"- {e.entity_id}: {e.name})" for e in entities])

    # Create relationship summary
    rel_summary = "\n".join(
        [
            f"- {r.entity_id_1} <-> {r.entity_id_2}: {r.relationship_type} (strength: {r.strength}, frequency: {r.communication_frequency})"
            for r in social_graph.relationships[:10]  # Limit to first 10 for context
        ]
    )

    prompt = f"""Create a detailed timeline of events for this story:

SETTING: {story.setting}

ENTITIES:
{entity_summary}

KEY RELATIONSHIPS:
{rel_summary}

STORY:
{story.expanded_narrative}

Generate a comprehensive timeline with 20-50 events.

IMPORTANT: All metadata values must be scalar types (string, number, boolean).
Do NOT use lists or objects as metadata values. If you need to represent multiple items,
use a comma-separated string like "item1, item2, item3"."""

    result = await timeline_generation_agent.run(prompt)

    # Convert to TimelineEvent models with error recovery
    parsed_events: list[TimelineEvent] = []
    failed_count = 0

    for idx, raw_event in enumerate(result.output.events):
        try:
            event = await _parse_event(raw_event, idx)
            parsed_events.append(event)
        except ValueError as e:
            logger.error(f"Skipping event", index=idx, error=str(e))
            failed_count += 1

    if failed_count > 0:
        logger.warn(f"Events skipped due to parsing errors", count=failed_count)

    # Sort by timestamp
    parsed_events.sort(key=lambda e: e.timestamp)

    return parsed_events
