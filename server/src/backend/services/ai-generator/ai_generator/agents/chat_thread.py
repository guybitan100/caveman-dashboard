"""Chat thread generation agent - plans and generates chat conversation threads."""

import logging
from pathlib import Path

from pydantic_ai import Agent

from ai_generator.models import Entity, TimelineEvent
from ai_generator.models.story_planning import PlannedStory
from ai_generator.models.thread_planning import ChatThreadPlan, ChatThreadPlans
from ai_generator.utils import get_model
from model.stories import _ChatStoryData, StoryType, ChatStoryData, ChatMessageStoryData
from model.types import EntityID
from model.utils import str_uuid

logger = logging.getLogger(__name__)


# Load prompts
_PLANNING_PROMPT_PATH = Path(__file__).parent / "prompts" / "chat_thread_planning.md"
_GENERATION_PROMPT_PATH = Path(__file__).parent / "prompts" / "chat_messages_generation.md"

_PLANNING_INSTRUCTIONS = _PLANNING_PROMPT_PATH.read_text()
_GENERATION_INSTRUCTIONS = _GENERATION_PROMPT_PATH.read_text()


# Thread planning agent
chat_thread_planning_agent = Agent(
    name="chat_thread_planning_agent",
    model=get_model(),
    output_type=ChatThreadPlans,
    instructions=_PLANNING_INSTRUCTIONS,
)


# Messages generation agent (generates list of chat messages)
chat_messages_generation_agent = Agent(
    name="chat_messages_generation_agent",
    model=get_model("six/story-model"),
    output_type=list[ChatMessageStoryData],
    instructions=_GENERATION_INSTRUCTIONS,
)


async def plan_chat_threads(
    planned_stories: list[PlannedStory],
    timeline_events: list[TimelineEvent],
    entities: list[Entity],
    phone_entity_id: EntityID
) -> list[ChatThreadPlan]:
    """
    Phase 1: Plan all chat threads.
    
    Analyzes all planned chat stories across timeline events and organizes
    them into conversation threads (chat groups).
    
    Args:
        planned_stories: All planned chat stories across all events
        timeline_events: All timeline events for context
        entities: All entities for context
        phone_entity_id: Phone owner's entity ID
        
    Returns:
        List of chat thread plans, each containing timeline of messages to generate
    """
    if not planned_stories:
        return []
    
    logger.info(
        "Planning chat threads for phone %s with %d planned stories across %d events",
        phone_entity_id,
        len(planned_stories),
        len(timeline_events),
    )
    
    # Build entity lookup
    entity_map = {e.entity_id: e for e in entities}
    phone_entity = entity_map.get(phone_entity_id)
    phone_owner_name = phone_entity.name if phone_entity else phone_entity_id
    
    # Build prompt
    prompt = f"""Plan chat conversation threads for all planned stories.

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
    
    prompt += "\n\nOrganize these planned stories into chat conversation threads."
    
    try:
        logger.debug("Sending chat thread planning request to LLM")
        result = await chat_thread_planning_agent.run(prompt)
        
        threads = result.output.threads
        
        logger.info(
            "Planned %d chat threads with %d total messages",
            len(threads),
            sum(len(thread.timeline) for thread in threads),
        )
        
        for thread in threads:
            logger.debug(
                "Chat '%s': %d messages, %d participants, across %d events",
                thread.thread_name,
                len(thread.timeline),
                len(thread.participants),
                len(thread.related_event_ids),
            )
        
        return threads
        
    except Exception as e:
        logger.error(
            "Chat thread planning failed for phone %s: %s",
            phone_entity_id,
            e,
            exc_info=True,
        )
        raise ValueError(f"Failed to plan chat threads: {e}") from e


async def generate_chat_from_thread(
    thread_plan: ChatThreadPlan,
    timeline_events: list[TimelineEvent],
    entities: list[Entity],
    phone_entity_id: EntityID
) -> ChatStoryData:
    """
    Phase 2: Generate complete chat from thread plan.
    
    Generates ChatStoryData with all messages, processing in batches of 10.
    
    Args:
        thread_plan: The overall thread plan
        timeline_events: All timeline events for context
        entities: All entities for context
        phone_entity_id: Phone owner's entity ID
        
    Returns:
        Complete ChatStoryData object with all messages
    """
    logger.info(
        "Generating chat '%s' for phone %s (%d messages total)",
        thread_plan.thread_name,
        phone_entity_id,
        len(thread_plan.timeline),
    )
    
    # Build entity lookup
    entity_map = {e.entity_id: e for e in entities}
    
    # Related events context
    related_events = [e for e in timeline_events if e.event_id in thread_plan.related_event_ids]
    events_context = ""
    if related_events:
        events_context = "\n\n**RELATED TIMELINE EVENTS:**\n"
        for event in related_events:
            events_context += f"\n- {event.description} ({event.timestamp})"
    
    # Generate messages in batches of 10
    all_messages: list[ChatMessageStoryData] = []
    batch_size = 10
    
    for batch_start in range(0, len(thread_plan.timeline), batch_size):
        batch_end = min(batch_start + batch_size, len(thread_plan.timeline))
        batch_entries = thread_plan.timeline[batch_start:batch_end]
        
        logger.debug(
            "Generating chat messages batch %d-%d of %d",
            batch_start + 1,
            batch_end,
            len(thread_plan.timeline),
        )
        
        # Build previous messages context
        previous_context = ""
        if all_messages:
            previous_context = "\n\n**PREVIOUS MESSAGES IN CHAT:**\n"
            # Show last 5 messages for context
            for prev in all_messages[-5:]:
                prev_sender = entity_map.get(prev.sender)
                prev_sender_name = prev_sender.name if prev_sender else prev.sender
                previous_context += f"\n- {prev_sender_name} ({prev.time}): {prev.text}"
        
        # Build batch timeline description
        batch_desc = "\n\n**TIMELINE ENTRIES TO GENERATE:**\n"
        for entry in batch_entries:
            sender = entity_map.get(entry.sender)
            sender_name = sender.name if sender else entry.sender
            batch_desc += f"\n- Seq {entry.sequence_number}: {sender_name} at {entry.timestamp}"
            batch_desc += f"\n  Type: {entry.message_type}, Context: {entry.context}"
        
        prompt = f"""Generate chat messages for this batch.

**CHAT THREAD:** {thread_plan.thread_name}
**CHAT UID:** {thread_plan.chat_uid}
**PARTICIPANTS:** {', '.join([entity_map[p].name if p in entity_map else p for p in thread_plan.participants])}
**PHONE OWNER:** {phone_entity_id}

**BATCH:** Messages {batch_start + 1}-{batch_end} of {len(thread_plan.timeline)}
{batch_desc}
{events_context}
{previous_context}

Generate {len(batch_entries)} chat messages as a list that flows naturally from previous messages.
"""
        
        try:
            logger.debug("Sending chat messages batch generation request to LLM")
            result = await chat_messages_generation_agent.run(prompt)
            
            batch_messages = result.output
            
            # Regenerate UIDs for all messages in batch
            for msg in batch_messages:
                msg.uid = str_uuid()
            
            all_messages.extend(batch_messages)
            
            logger.debug(
                "Generated %d messages in batch (total: %d/%d)",
                len(batch_messages),
                len(all_messages),
                len(thread_plan.timeline),
            )
            
        except Exception as e:
            logger.error(
                "Chat messages batch generation failed for '%s' batch %d-%d: %s",
                thread_plan.thread_name,
                batch_start + 1,
                batch_end,
                e,
                exc_info=True,
            )
            raise ValueError(f"Failed to generate chat messages batch: {e}") from e
    
    # Create ChatStoryData container
    chat_story = ChatStoryData(
        story_type=StoryType.CHAT,
        time=None,  # Chat container doesn't have time
        location_ref=None,
        user_description=None,
        app_id=None,
        chat=_ChatStoryData(
            participants=thread_plan.participants,
            messages=all_messages
        )
    )
    
    # Regenerate main chat UID
    chat_story.uid = str_uuid()
    
    logger.info(
        "Generated complete chat '%s' (uid=%s) with %d messages",
        thread_plan.thread_name,
        chat_story.uid,
        len(all_messages),
    )
    
    return chat_story
