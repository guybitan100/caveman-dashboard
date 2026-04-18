"""Email thread generation agent - plans and generates email conversation threads."""

import logging
from pathlib import Path

from pydantic_ai import Agent

from ai_generator.models import Entity, TimelineEvent
from ai_generator.models.story_planning import PlannedStory
from ai_generator.models.thread_planning import EmailThreadPlan, EmailThreadPlans, EmailTimelineEntry
from ai_generator.utils import get_model
from model.stories import EmailStoryData
from model.types import EntityID
from model.utils import str_uuid

logger = logging.getLogger(__name__)


# Load prompts
_PLANNING_PROMPT_PATH = Path(__file__).parent / "prompts" / "email_thread_planning.md"
_GENERATION_PROMPT_PATH = Path(__file__).parent / "prompts" / "email_story_generation.md"

_PLANNING_INSTRUCTIONS = _PLANNING_PROMPT_PATH.read_text()
_GENERATION_INSTRUCTIONS = _GENERATION_PROMPT_PATH.read_text()


# Thread planning agent
email_thread_planning_agent = Agent(
    name="email_thread_planning_agent",
    model=get_model(),
    output_type=EmailThreadPlans,
    instructions=_PLANNING_INSTRUCTIONS,
)


# Story generation agent
email_story_generation_agent = Agent(
    name="email_story_generation_agent",
    model=get_model("six/story-model"),
    output_type=EmailStoryData,
    instructions=_GENERATION_INSTRUCTIONS,
)


async def plan_email_threads(
    planned_stories: list[PlannedStory],
    timeline_events: list[TimelineEvent],
    entities: list[Entity],
    phone_entity_id: EntityID
) -> list[EmailThreadPlan]:
    """
    Phase 1: Plan all email threads.
    
    Analyzes all planned email stories across timeline events and organizes
    them into conversation threads.
    
    Args:
        planned_stories: All planned email stories across all events
        timeline_events: All timeline events for context
        entities: All entities for context
        phone_entity_id: Phone owner's entity ID
        
    Returns:
        List of email thread plans, each containing timeline of emails to generate
    """
    if not planned_stories:
        return []
    
    logger.info(
        "Planning email threads for phone %s with %d planned stories across %d events",
        phone_entity_id,
        len(planned_stories),
        len(timeline_events),
    )
    
    # Build entity lookup
    entity_map = {e.entity_id: e for e in entities}
    phone_entity = entity_map.get(phone_entity_id)
    phone_owner_name = phone_entity.name if phone_entity else phone_entity_id
    
    # Build prompt
    prompt = f"""Plan email conversation threads for all planned stories.

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
    
    prompt += "\n\nOrganize these planned stories into email conversation threads."
    
    try:
        logger.debug("Sending thread planning request to LLM")
        result = await email_thread_planning_agent.run(prompt)
        
        threads = result.output.threads
        
        logger.info(
            "Planned %d email threads with %d total emails",
            len(threads),
            sum(len(thread.timeline) for thread in threads),
        )
        
        for thread in threads:
            logger.debug(
                "Thread '%s': %d emails across %d events",
                thread.thread_name,
                len(thread.timeline),
                len(thread.related_event_ids),
            )
        
        return threads
        
    except Exception as e:
        logger.error(
            "Email thread planning failed for phone %s: %s",
            phone_entity_id,
            e,
            exc_info=True,
        )
        raise ValueError(f"Failed to plan email threads: {e}") from e


async def generate_email_story_from_thread(
    thread_plan: EmailThreadPlan,
    timeline_entry: EmailTimelineEntry,
    timeline_events: list[TimelineEvent],
    entities: list[Entity],
    phone_entity_id: EntityID,
    previous_stories: list[EmailStoryData]
) -> EmailStoryData:
    """
    Phase 2: Generate single email from thread context.
    
    Generates one email story based on the timeline entry and previous emails
    in the thread for consistency.
    
    Args:
        thread_plan: The overall thread plan
        timeline_entry: The specific email to generate
        timeline_events: All timeline events for context
        entities: All entities for context
        phone_entity_id: Phone owner's entity ID
        previous_stories: Previously generated emails in this thread (for context)
        
    Returns:
        Complete EmailStoryData object
    """
    logger.info(
        "Generating email %d/%d in thread '%s' for phone %s",
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
    
    to_names = [
        entity_map[eid].name if eid in entity_map else eid
        for eid in timeline_entry.to_entities
    ]
    
    # Build previous emails context
    previous_context = ""
    if previous_stories:
        previous_context = "\n\n**PREVIOUS EMAILS IN THREAD:**\n"
        for prev in previous_stories[-3:]:  # Last 3 for context
            prev_from = entity_map.get(prev.from_)
            prev_from_name = prev_from.name if prev_from else prev.from_
            previous_context += f"\n- From: {prev_from_name}"
            previous_context += f"\n  Time: {prev.time}"
            previous_context += f"\n  Subject: {prev.subject}"
            body_preview = (prev.body or "")[:200]
            previous_context += f"\n  Body: {body_preview}..."  # First 200 chars
            previous_context += "\n"
    
    # Build related events context
    events_context = ""
    if thread_plan.related_event_ids:
        related_events = [e for e in timeline_events if e.event_id in thread_plan.related_event_ids]
        if related_events:
            events_context = "\n\n**RELATED TIMELINE EVENTS:**\n"
            for event in related_events:
                events_context += f"\n- {event.description} ({event.timestamp})"
    
    prompt = f"""Generate an email story based on this timeline entry.

**THREAD:** {thread_plan.thread_name}

**TIMELINE ENTRY:**
- Sequence: {timeline_entry.sequence_number} of {len(thread_plan.timeline)}
- Time: {timeline_entry.timestamp}
- From: {from_name} (ID: {timeline_entry.from_entity})
- To: {', '.join(to_names)} (IDs: {', '.join(timeline_entry.to_entities)})
- Type: {timeline_entry.email_type}
- Subject Preview: {timeline_entry.subject_preview}
- Context: {timeline_entry.context}

**PHONE OWNER:** {phone_entity_id}
{previous_context}
{events_context}

Generate a complete, realistic email with full body content that fits naturally into this conversation thread.
"""
    
    try:
        logger.debug("Sending email generation request to LLM")
        result = await email_story_generation_agent.run(prompt)
        
        story = result.output
        
        # Always regenerate UID
        story.uid = str_uuid()
        
        logger.info(
            "Generated email story (uid=%s) from %s to %s",
            story.uid,
            from_name,
            ', '.join(to_names),
        )
        
        return story
        
    except Exception as e:
        logger.error(
            "Email story generation failed for thread '%s' entry %d: %s",
            thread_plan.thread_name,
            timeline_entry.sequence_number,
            e,
            exc_info=True,
        )
        raise ValueError(f"Failed to generate email story: {e}") from e
