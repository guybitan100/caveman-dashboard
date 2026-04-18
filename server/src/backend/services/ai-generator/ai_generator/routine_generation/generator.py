"""Main orchestrator for routine story generation.

This module coordinates the entire routine generation process:
1. Generate weekly routine pattern via LLM (once per phone)
2. Iterate through date range, applying the pattern to each day
3. Apply randomization (timing, duration, skip probability)
4. Check for timeline event conflicts
5. Generate concrete StoryData objects
6. Return stories to be merged with storyline stories
"""

import logging
from collections.abc import Sequence
from datetime import date, timedelta

from ai_generator.agents.routine_pattern_generation import generate_routine_pattern
from ai_generator.models import Entity
from ai_generator.models.phone_selection import SelectedPhone
from ai_generator.models.routine_config import RoutineGenerationConfig
from ai_generator.models.routine_pattern import WeeklyRoutinePattern
from ai_generator.models.timeline import TimelineEvent
from ai_generator.routine_generation.conflict_resolver import ConflictResolver
from ai_generator.routine_generation.randomizer import RoutineRandomizer
from ai_generator.routine_generation.story_generator import RoutineStoryGenerator
from model.stories import StoryData

logger = logging.getLogger(__name__)

# Day name mapping for pattern lookup
DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


async def generate_routine_stories(
    phone: SelectedPhone,
    entity: Entity,
    timeline_events: list[TimelineEvent],
    config: RoutineGenerationConfig | None = None,
    existing_stories: list[StoryData] | None = None,
) -> list[StoryData]:
    """
    Generate routine/ambient stories for a phone.

    This is the main entry point for routine generation. It:
    1. Generates a personalized weekly routine pattern via LLM
    2. Iterates through the phone's date range
    3. Applies the appropriate daily pattern for each day
    4. Randomizes timing and duration
    5. Skips activities based on entity traits and timeline conflicts
    6. Generates concrete StoryData objects

    Args:
        phone: The selected phone to generate routines for
        entity: The entity who owns the phone
        timeline_events: Timeline events from the storyline
        config: Routine generation configuration (optional, uses defaults)
        existing_stories: Existing stories to avoid duplicating times

    Returns:
        List of StoryData objects representing routine activities
    """
    config = config or RoutineGenerationConfig()

    if not config.enabled:
        logger.info(f"Routine generation disabled for {entity.name}")
        return []

    logger.info(f"Generating routine stories for {entity.name}")

    # Resolve date range
    start_date = phone.start_date
    end_date = phone.end_date

    if start_date is None or end_date is None:
        if timeline_events:
            event_dates = [e.timestamp.date() for e in timeline_events]
            start_date = start_date or min(event_dates)
            end_date = end_date or max(event_dates)
        else:
            logger.warning(f"No date range for {entity.name}, skipping routine generation")
            return []

    # Step 1: Generate weekly pattern via LLM
    logger.info(f"Generating weekly routine pattern for {entity.name}")
    pattern = await generate_routine_pattern(
        phone=phone,
        entity=entity,
        timeline_events=timeline_events,
        start_date=start_date,
        end_date=end_date,
    )

    # Step 2: Initialize components
    randomizer = RoutineRandomizer(
        config=config,
        entity=entity,
        seed=hash(entity.entity_id) % (2**31),  # Consistent seed per entity
    )

    conflict_resolver = ConflictResolver(
        timeline_events=timeline_events,
        entity_id=entity.entity_id,
        config=config,
    )

    story_generator = RoutineStoryGenerator(
        entity=entity,
        device_type=phone.device_type,
        seed=hash(entity.entity_id) % (2**31),
    )

    # Step 3: Generate stories for each day in the date range
    all_stories: list[StoryData] = []
    current_date = start_date

    total_days = (end_date - start_date).days + 1
    logger.info(f"Processing {total_days} days for {entity.name}")

    while current_date <= end_date:
        day_stories = _generate_day_stories(
            current_date=current_date,
            pattern=pattern,
            randomizer=randomizer,
            conflict_resolver=conflict_resolver,
            story_generator=story_generator,
        )
        all_stories.extend(day_stories)
        current_date += timedelta(days=1)

    logger.info(
        f"Generated {len(all_stories)} routine stories for {entity.name} "
        f"over {total_days} days (avg {len(all_stories) / max(total_days, 1):.1f}/day)"
    )

    return all_stories


def _generate_day_stories(
    current_date: date,
    pattern: WeeklyRoutinePattern,
    randomizer: RoutineRandomizer,
    conflict_resolver: ConflictResolver,
    story_generator: RoutineStoryGenerator,
) -> list[StoryData]:
    """Generate routine stories for a single day.

    Args:
        current_date: The date to generate stories for
        pattern: The weekly routine pattern
        randomizer: Randomizer for timing/duration/skip
        conflict_resolver: For checking timeline conflicts
        story_generator: For creating StoryData objects

    Returns:
        List of stories for this day
    """
    # Get the day of week (0=Monday, 6=Sunday)
    day_of_week = current_date.weekday()
    day_name = DAY_NAMES[day_of_week]

    # Get the daily pattern for this day of week
    daily_pattern = pattern.patterns.get(day_name)

    if not daily_pattern:
        logger.debug(f"No pattern for {day_name}, skipping")
        return []

    day_stories: list[StoryData] = []

    # Set day-specific seed for consistent but varied randomization
    day_seed = randomizer.get_day_seed(current_date)
    randomizer.rng.seed(day_seed)

    for activity in daily_pattern.activities:
        # Step 1: Check if activity should be skipped (entity-aware)
        if randomizer.should_skip_activity(activity):
            continue

        # Step 2: Randomize the time
        activity_time = randomizer.randomize_time(current_date, activity.time)

        # Step 3: Check for timeline event conflicts
        if conflict_resolver.should_skip_routine(activity_time):
            continue

        # Step 4: Randomize duration if applicable
        base_duration = activity.parameters.get("duration_minutes", 5)
        if isinstance(base_duration, int):
            duration = randomizer.randomize_duration(base_duration)
        else:
            duration = 5

        # Step 5: Generate the story
        result = story_generator.generate_story(
            activity=activity,
            activity_time=activity_time,
            duration_minutes=duration,
        )

        if result is None:
            continue

        # Handle both single stories and sequences (routes)
        if isinstance(result, Sequence) and not isinstance(result, StoryData):
            day_stories.extend(result)
        else:
            day_stories.append(result)

    return day_stories


async def generate_routine_stories_for_phones(
    phones: list[SelectedPhone],
    entities: list[Entity],
    timeline_events: list[TimelineEvent],
    config: RoutineGenerationConfig | None = None,
) -> dict[str, list[StoryData]]:
    """
    Generate routine stories for multiple phones.

    Args:
        phones: List of selected phones
        entities: List of all entities
        timeline_events: Timeline events from the storyline
        config: Routine generation configuration

    Returns:
        Dict mapping entity_id to list of routine stories
    """
    config = config or RoutineGenerationConfig()

    if not config.enabled:
        logger.info("Routine generation disabled")
        return {}

    entity_map = {e.entity_id: e for e in entities}
    results: dict[str, list[StoryData]] = {}

    for phone in phones:
        entity = entity_map.get(phone.entity_id)
        if not entity:
            logger.warning(f"Entity not found for phone {phone.entity_id}")
            continue

        stories = await generate_routine_stories(
            phone=phone,
            entity=entity,
            timeline_events=timeline_events,
            config=config,
        )

        results[phone.entity_id] = stories

    total_stories = sum(len(s) for s in results.values())
    logger.info(f"Generated {total_stories} total routine stories for {len(phones)} phones")

    return results
