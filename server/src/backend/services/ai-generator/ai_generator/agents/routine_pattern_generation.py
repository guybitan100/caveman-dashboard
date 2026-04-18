"""Routine pattern generation agent - generates weekly routine patterns via LLM."""

import logging
from datetime import date, datetime
from pathlib import Path

from pydantic_ai import Agent

from ai_generator.models import Entity
from ai_generator.models.phone_selection import SelectedPhone
from ai_generator.models.routine_pattern import WeeklyRoutinePattern
from ai_generator.models.timeline import TimelineEvent
from ai_generator.utils import get_model

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent / "prompts" / "routine_pattern_generation.md"
_INSTRUCTIONS = _PROMPT_PATH.read_text()

routine_pattern_agent = Agent(
    name="routine_pattern_generation_agent",
    model=get_model(),
    output_type=WeeklyRoutinePattern,
    instructions=_INSTRUCTIONS,
)


async def generate_routine_pattern(
    phone: SelectedPhone,
    entity: Entity,
    timeline_events: list[TimelineEvent],
    start_date: date | None = None,
    end_date: date | None = None,
) -> WeeklyRoutinePattern:
    """
    Generate a weekly routine pattern for one phone.

    This pattern will be repeated across all weeks with randomization
    to create realistic ambient phone activity data.

    Args:
        phone: The selected phone
        entity: The entity who owns the phone
        timeline_events: Timeline events for context (to understand story and avoid conflicts)
        start_date: Override start date (uses phone.start_date if not provided)
        end_date: Override end date (uses phone.end_date if not provided)

    Returns:
        WeeklyRoutinePattern with 7 daily patterns (Monday-Sunday)
    """
    logger.info(f"Generating routine pattern for {entity.name} ({entity.entity_id})")

    # Resolve dates - use provided dates, or phone dates, or derive from timeline
    effective_start = start_date or phone.start_date
    effective_end = end_date or phone.end_date

    # If still no dates, derive from timeline events
    if effective_start is None or effective_end is None:
        if timeline_events:
            event_dates = [e.timestamp.date() for e in timeline_events]
            effective_start = effective_start or min(event_dates)
            effective_end = effective_end or max(event_dates)
        else:
            # Fallback to reasonable defaults
            effective_start = effective_start or date.today()
            effective_end = effective_end or date.today()

    duration_days = (effective_end - effective_start).days + 1

    # Build the prompt with entity and context info
    prompt = f"""Generate a weekly routine pattern for this person:

## ENTITY INFORMATION
- **Name**: {entity.name}
- **Age**: {entity.characteristics.age or "Unknown"}
- **Gender**: {entity.characteristics.gender.value}
- **Occupation**: {entity.characteristics.occupation or "Unknown"}
- **Tech Savviness**: {entity.characteristics.tech_savviness}/10
- **Social Activity**: {entity.characteristics.social_activity}/10
- **Personality Traits**: {", ".join(entity.characteristics.personality_traits) if entity.characteristics.personality_traits else "Not specified"}
- **Background**: {entity.characteristics.background or "Not specified"}

## DEVICE INFORMATION
- **Device Type**: {phone.device_type.value}
- **Phone Number**: {phone.phone_number or "Not specified"}

## DATE RANGE
- **Start Date**: {effective_start.isoformat()}
- **End Date**: {effective_end.isoformat()}
- **Duration**: {duration_days} days

## STORYLINE CONTEXT
The following significant events occur during this time period. Generate routines that would realistically coexist with these events (the routine activities will be adjusted to avoid conflicts):

{_summarize_timeline(timeline_events, entity.entity_id)}

## INSTRUCTIONS
Generate a complete 7-day weekly routine pattern (Monday through Sunday) that represents this person's typical digital activity.

Based on the tech_savviness of {entity.characteristics.tech_savviness}/10:
- Target approximately {_calculate_target_activities(entity.characteristics.tech_savviness)} activities per day
- {"Include varied apps, social media, and frequent phone usage" if entity.characteristics.tech_savviness >= 7 else "Focus on essential activities and common apps" if entity.characteristics.tech_savviness >= 4 else "Keep activities minimal and basic"}

Based on the social_activity of {entity.characteristics.social_activity}/10:
- {"Include frequent communication, social media engagement, and varied locations" if entity.characteristics.social_activity >= 7 else "Include regular communication with close contacts" if entity.characteristics.social_activity >= 4 else "Minimal social interaction, focus on individual activities"}

Remember to:
1. Make weekday patterns similar (work routine consistency)
2. Make weekend patterns different from weekdays
3. Include charging patterns (overnight, sometimes midday)
4. Include location patterns appropriate for occupation
5. Spread activities throughout waking hours
6. Use realistic timing for the person's lifestyle
"""

    result = await routine_pattern_agent.run(prompt)

    # Add metadata
    pattern = result.output
    pattern.entity_id = entity.entity_id
    pattern.entity_name = entity.name
    pattern.generated_at = datetime.now().isoformat()
    pattern.date_range_start = effective_start.isoformat()
    pattern.date_range_end = effective_end.isoformat()

    logger.info(
        f"Generated routine pattern for {entity.name}: "
        f"{sum(len(p.activities) for p in pattern.patterns.values())} total activities across 7 days"
    )

    return pattern


def _filter_events_by_significance(events: list[TimelineEvent], given_significance: int) -> list[TimelineEvent]:
    return [e for e in events if e.significance >= given_significance]


def _summarize_timeline(events: list[TimelineEvent], entity_id: str) -> str:
    """Create a summary of timeline events involving this entity for context."""
    # Filter events involving this entity
    relevant_events = [e for e in events if entity_id in e.involved_entities]

    if not relevant_events:
        return "No significant storyline events involving this person."

    summary_lines = []
    final_num_events = 15

    if len(relevant_events) > final_num_events:
        for i in range(1, 10):
            significant_events = _filter_events_by_significance(relevant_events, i)
            if len(significant_events) >= final_num_events:
                relevant_events = significant_events[:final_num_events]
                break


    for event in relevant_events:
        day_of_week = event.timestamp.strftime("%A")
        time_str = event.timestamp.strftime("%H:%M")
        date_str = event.timestamp.strftime("%Y-%m-%d")
        summary_lines.append(f"- {date_str} ({day_of_week}) {time_str}: {event.description[:30]}")

    result = "\n".join(summary_lines)

    return result


def _calculate_target_activities(tech_savviness: int) -> str:
    """Calculate target activities per day based on tech savviness."""
    if tech_savviness >= 8:
        return "45-50"
    elif tech_savviness >= 6:
        return "35-45"
    elif tech_savviness >= 4:
        return "25-35"
    elif tech_savviness >= 2:
        return "15-25"
    else:
        return "10-15"
