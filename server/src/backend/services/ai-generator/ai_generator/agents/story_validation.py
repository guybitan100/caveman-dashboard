"""Story validation agent - validates that events are properly represented in the plan."""

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from ai_generator.models import Entity, TimelineEvent, SelectedPhone
from ai_generator.models.story_planning import StoryGenerationPlan
from ai_generator.models.story_validation import (
    EventValidation,
    ValidationReport,
)
from ai_generator.utils import get_model

if TYPE_CHECKING:
    from ai_generator.prompt_render import render_entities, render_timeline

logger = logging.getLogger(__name__)


class ValidationOutput(BaseModel):
    """Output schema for story validation."""

    event_validations: list[EventValidation] = Field(
        description="Validation results for each event"
    )


# Load instructions from prompt file
_PROMPT_PATH = Path(__file__).parent / "prompts" / "story_validation.md"
_INSTRUCTIONS = _PROMPT_PATH.read_text()

story_validation_agent = Agent(
    name="story_validation_agent",
    model=get_model(),
    output_type=ValidationOutput,
    instructions=_INSTRUCTIONS,
)


async def validate_story_plan(
    plan: StoryGenerationPlan,
    timeline: list[TimelineEvent],
    selected_phones: list[SelectedPhone],
    entities: list[Entity],
    iteration: int = 1,
) -> ValidationReport:
    """
    Validate that the story generation plan properly represents each event.
    
    This checks if events have sufficient stories and identifies gaps that
    need additional stories for realism.
    
    Args:
        plan: The story generation plan to validate
        timeline: List of timeline events
        selected_phones: Phones to generate stories for
        entities: All entities for context
        iteration: Which iteration of planning/validation this is
        
    Returns:
        ValidationReport with validation results and missing stories
        
    Raises:
        ValueError: If validation fails
    """
    logger.info(
        "Validating story plan (iteration %d) - %d events, %d planned stories",
        iteration,
        len(plan.event_plans),
        plan.total_planned_stories,
    )

    # Import here to avoid circular dependency
    from ai_generator.prompt_render import render_entities, render_timeline

    # Build entity lookup
    entity_map = {e.entity_id: e for e in entities}
    
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
    
    # Format current plan for validation
    plan_summary = []
    for event_plan in plan.event_plans:
        event = next((e for e in timeline if e.event_id == event_plan.timeline_event_id), None)
        event_desc = event.description if event else event_plan.timeline_event_id
        
        plan_summary.append(f"\nEvent: {event_plan.timeline_event_id}")
        plan_summary.append(f"Description: {event_desc}")
        plan_summary.append(f"Current Stories ({len(event_plan.planned_stories)}):")
        
        for story in event_plan.planned_stories:
            phone = next((p for p in selected_phones if p.entity_id == story.phone_entity_id), None)
            phone_name = phone.entity_name if phone else story.phone_entity_id
            sync_info = f", sync: {story.sync_group_id}" if story.sync_group_id else ""
            
            plan_summary.append(
                f"  - {phone_name}: {story.story_type} ({story.perspective}){sync_info}"
            )
    
    plan_str = "\n".join(plan_summary)
    
    prompt = f"""Validate the story generation plan to ensure each timeline event is properly represented.

SELECTED PHONES:
{phones_str}

{entities_context}

{timeline_context}

CURRENT PLAN:
{plan_str}

For each event:
1. Evaluate if the current stories properly represent the event
2. Identify missing stories that would enhance realism
3. Assign priority levels (critical, high, medium, low)
4. Recommend total story count for comprehensive coverage

Focus on:
- Are all key participants represented?
- Are story types appropriate and sufficient?
- Are there complementary stories that would naturally occur?
- Do communication events have proper sync groups?
- Is there enough variety and depth for realism?

Return validation for ALL events.
"""

    try:
        logger.debug("Sending validation request to LLM")
        result = await story_validation_agent.run(prompt)
        
        report = ValidationReport(
            event_validations=result.output.event_validations,
            iteration=iteration,
        )
        
        # Log summary
        logger.info(
            "Validation complete - %d events validated",
            len(report.event_validations),
        )
        
        events_needing_more = report.events_needing_more
        if events_needing_more:
            logger.info(
                "  %d events need additional stories (%d total missing)",
                len(events_needing_more),
                report.total_missing_stories,
            )
            
            if report.critical_gaps_count > 0:
                logger.warning(
                    "  %d CRITICAL gaps found that must be addressed",
                    report.critical_gaps_count,
                )
        else:
            logger.info("  All events are adequately represented ✓")
        
        # Log per-event summary
        for validation in report.event_validations:
            if validation.needs_additional_stories:
                logger.info(
                    "  %s: %s - %d missing (current: %d, recommended: %d)",
                    validation.timeline_event_id,
                    validation.validation_status,
                    len(validation.missing_stories),
                    validation.current_story_count,
                    validation.recommended_story_count,
                )
        
        return report
        
    except Exception as e:
        logger.error("Story validation failed: %s", e, exc_info=True)
        raise ValueError(f"Failed to validate story plan: {e}") from e
