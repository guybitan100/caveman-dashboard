"""SMS thread generation agent - plans and generates SMS conversation threads."""

import logging
from pathlib import Path

from pydantic_ai import Agent

from ai_generator.models import Entity, TimelineEvent
from ai_generator.models.story_planning import PlannedStory
from ai_generator.models.thread_planning import SMSThreadPlan, SMSThreadPlans, SMSTimelineEntry
from ai_generator.utils import get_model
from model.stories import InstantMessageStoryData
from model.types import EntityID
from model.utils import str_uuid

logger = logging.getLogger(__name__)


# Load prompts
_PLANNING_PROMPT_PATH = Path(__file__).parent / "prompts" / "sms_thread_planning.md"
_GENERATION_PROMPT_PATH = Path(__file__).parent / "prompts" / "sms_story_generation.md"

_PLANNING_INSTRUCTIONS = _PLANNING_PROMPT_PATH.read_text()
_GENERATION_INSTRUCTIONS = _GENERATION_PROMPT_PATH.read_text()


# Thread planning agent
sms_thread_planning_agent = Agent(
    name="sms_thread_planning_agent",
    model=get_model(),
    output_type=SMSThreadPlans,
    instructions=_PLANNING_INSTRUCTIONS,
)


# Story generation agent
sms_story_generation_agent = Agent(
    name="sms_story_generation_agent",
    model=get_model("six/story-model"),
    output_type=InstantMessageStoryData,
    instructions=_GENERATION_INSTRUCTIONS,
)


async def plan_sms_threads(
    planned_stories: list[PlannedStory],
    timeline_events: list[TimelineEvent],
    entities: list[Entity],
    phone_entity_id: EntityID
) -> list[SMSThreadPlan]:
    """
    Phase 1: Plan all SMS threads.
    
    Analyzes all planned SMS stories across timeline events and organizes
    them into conversation threads.
    
    Args:
        planned_stories: All planned SMS stories across all events
        timeline_events: All timeline events for context
        entities: All entities for context
        phone_entity_id: Phone owner's entity ID
        
    Returns:
        List of SMS thread plans, each containing timeline of messages to generate
    """
    if not planned_stories:
        return []
    
    logger.info(
        "Planning SMS threads for phone %s with %d planned stories across %d events",
        phone_entity_id,
        len(planned_stories),
        len(timeline_events),
    )
    
    # Build entity lookup
    entity_map = {e.entity_id: e for e in entities}
    phone_entity = entity_map.get(phone_entity_id)
    phone_owner_name = phone_entity.name if phone_entity else phone_entity_id
    
    # Build prompt
    prompt = f"""Plan SMS conversation threads for all planned stories.

**PHONE OWNER:** {phone_owner_name} (ID: {phone_entity_id})

**PLANNED STORIES ({len(planned_stories)} total):**
"""
    
    for i, planned in enumerate(planned_stories, 1):
        prompt += f"\n{i}. Story ID: {planned.phone_entity_id}_{i}"
        prompt += f"\n   - Type: {planned.story_type}"
        prompt += f"\n   - Perspective: {planned.perspective}"
        if planned.context:
            prompt += f"\n   - Context: {planned.context}"
    
    prompt += f"\n\n**TIMELINE EVENTS ({len(timeline_events)} total):**\n"
    
    for event in timeline_events:
        primary_entity = entity_map.get(event.primary_entity)
        primary_name = primary_entity.name if primary_entity else event.primary_entity
        
        involved_names = [
            entity_map[eid].name
            for eid in event.involved_entities
            if eid in entity_map
        ]
        
        prompt += f"\n- Event ID: {event.event_id}"
        prompt += f"\n  Time: {event.timestamp}"
        prompt += f"\n  Category: {event.category}"
        prompt += f"\n  Description: {event.description}"
        prompt += f"\n  Primary Entity: {primary_name}"
        prompt += f"\n  Involved: {', '.join(involved_names)}"
        prompt += "\n"
    
    prompt += f"\n\n**ENTITIES ({len(entities)} total):**\n"
    for entity in entities:
        prompt += f"- {entity.name} (ID: {entity.entity_id})\n"
    
    prompt += "\n\nOrganize these planned stories into SMS conversation threads."
    
    try:
        logger.debug("Sending thread planning request to LLM")
        result = await sms_thread_planning_agent.run(prompt)
        
        threads = result.output.threads
        
        logger.info(
            "Planned %d SMS threads with %d total messages",
            len(threads),
            sum(len(thread.timeline) for thread in threads),
        )
        
        for thread in threads:
            logger.debug(
                "Thread '%s': %d messages across %d events",
                thread.thread_name,
                len(thread.timeline),
                len(thread.related_event_ids),
            )
        
        return threads
        
    except Exception as e:
        logger.error(
            "SMS thread planning failed for phone %s: %s",
            phone_entity_id,
            e,
            exc_info=True,
        )
        raise ValueError(f"Failed to plan SMS threads: {e}") from e


async def generate_sms_story_from_thread(
    thread_plan: SMSThreadPlan,
    timeline_entry: SMSTimelineEntry,
    timeline_events: list[TimelineEvent],
    entities: list[Entity],
    phone_entity_id: EntityID,
    previous_stories: list[InstantMessageStoryData]
) -> InstantMessageStoryData:
    """
    Phase 2: Generate single SMS from thread context.
    
    Generates one SMS story based on the timeline entry and previous messages
    in the thread for consistency.
    
    Args:
        thread_plan: The overall thread plan
        timeline_entry: The specific SMS message to generate
        timeline_events: All timeline events for context
        entities: All entities for context
        phone_entity_id: Phone owner's entity ID
        previous_stories: Previously generated SMS messages in this thread (for context)
        
    Returns:
        Complete SMSStoryData object
    """
    logger.info(
        "Generating SMS %d/%d in thread '%s' for phone %s",
        timeline_entry.sequence_number,
        len(thread_plan.timeline),
        thread_plan.thread_name,
        phone_entity_id,
    )
    
    # Build entity lookup
    entity_map = {e.entity_id: e for e in entities}
    
    # Get sender/recipient names
    from_entity = entity_map.get(timeline_entry.from_entity)
    from_name = from_entity.name if from_entity else timeline_entry.from_entity
    
    to_entity = entity_map.get(timeline_entry.to_entity)
    to_name = to_entity.name if to_entity else timeline_entry.to_entity
    
    # Build previous messages context
    previous_context = ""
    if previous_stories:
        previous_context = "\n\n**PREVIOUS MESSAGES IN THREAD:**\n"
        for prev in previous_stories[-5:]:  # Last 5 for context
            prev_sender = entity_map.get(prev.sender)
            prev_sender_name = prev_sender.name if prev_sender else prev.sender
            previous_context += f"\n- From: {prev_sender_name}"
            previous_context += f"\n  Time: {prev.time}"
            previous_context += f"\n  Message: {prev.text}"
            previous_context += "\n"
    
    # Build related events context
    events_context = ""
    if thread_plan.related_event_ids:
        related_events = [e for e in timeline_events if e.event_id in thread_plan.related_event_ids]
        if related_events:
            events_context = "\n\n**RELATED TIMELINE EVENTS:**\n"
            for event in related_events:
                events_context += f"\n- {event.description} ({event.timestamp})"
    
    prompt = f"""Generate an SMS message based on this timeline entry.

**THREAD:** {thread_plan.thread_name}

**TIMELINE ENTRY:**
- Sequence: {timeline_entry.sequence_number} of {len(thread_plan.timeline)}
- Time: {timeline_entry.timestamp}
- From: {from_name} (ID: {timeline_entry.from_entity})
- To: {to_name} (ID: {timeline_entry.to_entity})
- Context: {timeline_entry.context}

**PHONE OWNER:** {phone_entity_id}
{previous_context}
{events_context}

Generate a realistic SMS message that fits naturally into this conversation thread.
"""
    
    try:
        logger.debug("Sending SMS generation request to LLM")
        result = await sms_story_generation_agent.run(prompt)
        
        story = result.output
        
        # Always regenerate UID
        story.uid = str_uuid()
        
        logger.info(
            "Generated SMS story (uid=%s) from %s to %s",
            story.uid,
            from_name,
            to_name,
        )
        
        return story
        
    except Exception as e:
        logger.error(
            "SMS story generation failed for thread '%s' entry %d: %s",
            thread_plan.thread_name,
            timeline_entry.sequence_number,
            e,
            exc_info=True,
        )
        raise ValueError(f"Failed to generate SMS story: {e}") from e
