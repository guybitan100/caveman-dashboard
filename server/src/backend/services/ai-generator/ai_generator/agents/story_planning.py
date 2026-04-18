"""Story planning agent - decides which stories to generate from timeline events."""

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from ai_generator.models import Entity, TimelineEvent, SelectedPhone
from ai_generator.models.story_planning import (
    EventStoryPlan,
    StoryGenerationPlan,
    PlannedStory,
)
from ai_generator.utils import get_model

if TYPE_CHECKING:
    from ai_generator.prompt_render import render_entities, render_timeline

logger = logging.getLogger(__name__)


class PlanningOutput(BaseModel):
    """Output schema for story planning."""

    event_plans: list[EventStoryPlan] = Field(
        description="Plans for each timeline event"
    )


# Load instructions from prompt file
_PROMPT_PATH = Path(__file__).parent / "prompts" / "story_planning.md"
_INSTRUCTIONS = _PROMPT_PATH.read_text()

story_planning_agent = Agent(
    name="story_planning_agent",
    model=get_model(),
    output_type=PlanningOutput,
    instructions=_INSTRUCTIONS,
)


async def plan_stories(
    timeline: list[TimelineEvent],
    selected_phones: list[SelectedPhone],
    entities: list[Entity],
) -> StoryGenerationPlan:
    """
    Plan which stories should be generated from timeline events.
    
    This is the PLANNING phase - it decides WHAT to generate,
    not the actual story data.
    
    Args:
        timeline: List of timeline events
        selected_phones: Phones to generate stories for
        entities: All entities for context
        
    Returns:
        StoryGenerationPlan with planned stories and sync information
        
    Raises:
        ValueError: If planning fails
    """
    logger.info(
        "Planning stories for %d timeline events across %d phones",
        len(timeline),
        len(selected_phones),
    )

    # Import here to avoid circular dependency
    from ai_generator.prompt_render import render_entities, render_timeline

    # Build entity lookup
    entity_map = {e.entity_id: e for e in entities}
    phone_entity_ids = {p.entity_id for p in selected_phones}
    
    # Build phone summaries
    phone_summaries = []
    for phone in selected_phones:
        entity = entity_map.get(phone.entity_id)
        summary = f"- {phone.entity_name} (ID: {phone.entity_id})"
        if phone.device_type:
            summary += f", Device: {phone.device_type.value}"
        if entity and entity.characteristics:
            if entity.characteristics.occupation:
                summary += f", {entity.characteristics.occupation}"
        phone_summaries.append(summary)
    
    phones_str = "\n".join(phone_summaries)
    
    # Use centralized rendering for entities and timeline
    entities_context = render_entities(entities, include_details=False)
    timeline_context = render_timeline(timeline, max_events=50)
    
    prompt = f"""Plan which stories should be generated from timeline events for the selected phones.

SELECTED PHONES FOR EXTRACTION:
{phones_str}

{entities_context}

{timeline_context}

For each event, determine:
1. Which phones should have stories from this event?
2. What story types should appear on each phone?
3. What perspective does each phone owner have?
4. Which stories need to be synced (same sync_group_id for communication between entities)?

Return a plan for ALL events, even if no stories should be generated for an event.
"""

    try:
        logger.debug("Sending story planning request to LLM")
        result = await story_planning_agent.run(prompt)
        
        plan = StoryGenerationPlan(event_plans=result.output.event_plans)
        
        # Log summary
        total_stories = plan.total_planned_stories
        sync_groups = plan.get_sync_groups()
        
        logger.info(
            "Story planning complete - %d total stories planned across %d events",
            total_stories,
            len(plan.event_plans),
        )
        
        if sync_groups:
            logger.info(
                "Sync groups: %d (for coordinated stories like calls/messages)",
                len(sync_groups),
            )
        
        # Log per-phone breakdown
        for phone in selected_phones:
            phone_stories = plan.get_stories_for_phone(phone.entity_id)
            logger.info(
                "  %s: %d stories planned",
                phone.entity_name,
                len(phone_stories),
            )
        
        return plan
        
    except Exception as e:
        logger.error("Story planning failed: %s", e, exc_info=True)
        raise ValueError(f"Failed to plan stories: {e}") from e


def incorporate_validation_feedback(
    plan: StoryGenerationPlan,
    validation_report: "ValidationReport",  # type: ignore - avoid circular import
) -> StoryGenerationPlan:
    """
    Incorporate validation feedback into the story plan by adding missing stories.
    
    Args:
        plan: The current story generation plan
        validation_report: Validation report with missing stories
        
    Returns:
        Updated plan with missing stories added
    """
    logger.info(
        "Incorporating validation feedback - adding %d missing stories",
        validation_report.total_missing_stories,
    )
    
    # Add missing stories to each event
    for event_validation in validation_report.event_validations:
        if not event_validation.missing_stories:
            continue
            
        event_id = event_validation.timeline_event_id
        
        # Convert missing stories to planned stories
        new_stories = []
        for missing in event_validation.missing_stories:
            new_stories.append(
                PlannedStory(
                    phone_entity_id=missing.phone_entity_id,
                    story_type=missing.story_type,
                    perspective=missing.perspective,
                    sync_group_id=missing.sync_group_id,
                    context=missing.context,
                )
            )
        
        # Add to plan
        plan.add_stories_to_event(event_id, new_stories)
        
        logger.info(
            "  Event %s: added %d stories (%s)",
            event_id,
            len(new_stories),
            ", ".join(f"{s.story_type}" for s in new_stories[:3]) + ("..." if len(new_stories) > 3 else ""),
        )
    
    logger.info(
        "Plan updated - now %d total stories (was %d)",
        plan.total_planned_stories,
        plan.total_planned_stories - validation_report.total_missing_stories,
    )
    
    return plan
