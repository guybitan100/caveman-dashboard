"""Story generation orchestration - coordinates specialized agents for different story types."""

import asyncio
import logging
from collections import defaultdict
from typing import Any, Dict, List, cast

from ai_generator.agents.email_thread import plan_email_threads, generate_email_story_from_thread
from ai_generator.agents.chat_thread import plan_chat_threads, generate_chat_from_thread
from ai_generator.agents.sms_thread import plan_sms_threads, generate_sms_story_from_thread
from ai_generator.agents.simple_story import generate_simple_story
from ai_generator.agents.multi_phone_utils import create_multi_phone_stories
from ai_generator.models import Entity, TimelineEvent, StoryGenerationPlan
from ai_generator.models.story_planning import PlannedStory
from ai_generator.models.thread_planning import EmailThreadPlan, EmailTimelineEntry, ChatThreadPlan, SMSThreadPlan, SMSTimelineEntry
from model.stories import StoryData, StoryType, EmailStoryData, InstantMessageStoryData

logger = logging.getLogger(__name__)

# Batch size for parallel generation - minimum 15 concurrent stories
PARALLEL_BATCH_SIZE = 15


async def generate_stories_from_plan(
    plan: StoryGenerationPlan,
    timeline: list[TimelineEvent],
    entities: list[Entity],
) -> Dict[str, List[StoryData]]:
    """
    Generate all stories from a StoryGenerationPlan using specialized agents.
    
    This is the new orchestration function that replaces the old monolithic approach.
    It groups stories by type and delegates to specialized agents:
    - Email → Email Thread Agent (two-phase: planning + generation)
    - Chat → Chat Thread Agent (two-phase: planning + generation)
    - SMS → SMS Thread Agent (two-phase: planning + generation)
    - Others → Simple Story Agent (direct generation)
    
    Multi-phone duplication is handled after generation for communication stories.
    Stories are generated in parallel batches of at least 15.
    
    Args:
        plan: Complete story generation plan
        timeline: All timeline events
        entities: All entities
        
    Returns:
        Dictionary mapping phone entity IDs to lists of generated stories
    """
    logger.info("Starting story generation orchestration")
    
    # Build event lookup
    event_map = {e.event_id: e for e in timeline}
    
    # Track stories by phone (thread-safe for concurrent access)
    phone_stories: Dict[str, List[StoryData]] = defaultdict(list)
    
    # Group planned stories by type AND phone
    # Structure: {StoryType: {phone_entity_id: [PlannedStory, ...]}}
    stories_by_type_and_phone: Dict[StoryType, Dict[str, List[PlannedStory]]] = defaultdict(
        lambda: defaultdict(list)
    )
    
    # Track which event each planned story belongs to (for simple stories)
    planned_to_event: Dict[int, TimelineEvent] = {}
    
    for event_plan in plan.event_plans:
        event = event_map.get(event_plan.timeline_event_id)
        if not event:
            logger.warning("Event %s not found in timeline", event_plan.timeline_event_id)
            continue
        
        for planned in event_plan.planned_stories:
            stories_by_type_and_phone[planned.story_type][planned.phone_entity_id].append(planned)
            planned_to_event[id(planned)] = event
    
    # Count total planned stories
    total_planned = sum(
        len(planned_list) 
        for phone_dict in stories_by_type_and_phone.values() 
        for planned_list in phone_dict.values()
    )
    logger.info(
        "Grouped %d planned stories into %d story types across phones",
        total_planned,
        len(stories_by_type_and_phone),
    )
    
    # Process each story type with parallelization
    for story_type, phone_planned_map in stories_by_type_and_phone.items():
        logger.info(
            "Processing story type: %s (%d phones)",
            story_type.value,
            len(phone_planned_map),
        )
        
        if story_type == StoryType.EMAIL:
            await _generate_email_threads_parallel(
                phone_planned_map,
                timeline,
                entities,
                phone_stories,
            )
        
        elif story_type == StoryType.CHAT:
            await _generate_chat_threads_parallel(
                phone_planned_map,
                timeline,
                entities,
                phone_stories,
            )
        
        elif story_type == StoryType.INSTANT_MESSAGE:
            await _generate_sms_threads_parallel(
                phone_planned_map,
                timeline,
                entities,
                phone_stories,
            )
        
        else:
            # Simple story types (calls, locations, media, etc.)
            await _generate_simple_stories_parallel(
                phone_planned_map,
                planned_to_event,
                entities,
                phone_stories,
            )
    
    logger.info(
        "Story generation complete: %d phones with stories",
        len(phone_stories),
    )
    
    for phone_id, stories in phone_stories.items():
        logger.info("Phone %s: %d stories", phone_id, len(stories))
    
    return dict(phone_stories)


async def _generate_email_threads_parallel(
    phone_planned_map: Dict[str, List[PlannedStory]],
    timeline: list[TimelineEvent],
    entities: list[Entity],
    phone_stories: Dict[str, List[StoryData]],
) -> None:
    """Generate email threads for all phones with parallel story generation."""
    logger.info("Generating email threads for %d phones", len(phone_planned_map))
    
    # Phase 1: Plan all threads for all phones in parallel
    planning_tasks = []
    phone_ids = []
    
    for phone_entity_id, planned_stories in phone_planned_map.items():
        planning_tasks.append(
            plan_email_threads(
                planned_stories=planned_stories,
                timeline_events=timeline,
                entities=entities,
                phone_entity_id=phone_entity_id,
            )
        )
        phone_ids.append(phone_entity_id)
    
    planning_results = await asyncio.gather(*planning_tasks, return_exceptions=True)
    
    # Collect all thread plans
    all_thread_plans: List[tuple[str, EmailThreadPlan]] = []
    for phone_id, result in zip(phone_ids, planning_results):
        if isinstance(result, BaseException):
            logger.error("Email thread planning failed for phone %s: %s", phone_id, result)
            continue
        for thread_plan in result:
            all_thread_plans.append((phone_id, thread_plan))
    
    logger.info("Planned %d email threads across all phones", len(all_thread_plans))
    
    # Phase 2: Collect ALL email generation tasks across all threads
    # Each task is (phone_id, thread_plan, timeline_entry, previous_stories_in_thread)
    # We need to maintain order within threads, so we process thread by thread but batch across threads
    
    # For emails, we need sequential generation within a thread (for context)
    # But we can parallelize across different threads
    
    # Process in waves: each wave generates one email per thread in parallel
    max_depth = max((len(tp.timeline) for _, tp in all_thread_plans), default=0)
    
    for depth in range(max_depth):
        # Collect tasks for this depth level across all threads
        generation_tasks = []
        task_info: List[tuple[str, EmailThreadPlan, EmailTimelineEntry, list[EmailStoryData]]] = []
        
        for phone_id, thread_plan in all_thread_plans:
            if depth < len(thread_plan.timeline):
                timeline_entry = thread_plan.timeline[depth]
                # Get previous stories for this thread (already generated)
                prev_stories = [
                    s for s in phone_stories[phone_id]
                    if isinstance(s, EmailStoryData) and 
                    getattr(s, 'subject', '').startswith(thread_plan.thread_name.split()[0] if thread_plan.thread_name else '')
                ]
                
                generation_tasks.append(
                    generate_email_story_from_thread(
                        thread_plan=thread_plan,
                        timeline_entry=timeline_entry,
                        timeline_events=timeline,
                        entities=entities,
                        phone_entity_id=phone_id,
                        previous_stories=prev_stories[-3:],  # Last 3 for context
                    )
                )
                task_info.append((phone_id, thread_plan, timeline_entry, prev_stories))
        
        if not generation_tasks:
            continue
            
        logger.info("Generating email depth %d: %d emails in parallel", depth + 1, len(generation_tasks))
        
        results = await asyncio.gather(*generation_tasks, return_exceptions=True)
        
        # Process results
        for (phone_id, thread_plan, timeline_entry, _), result in zip(task_info, results):
            if isinstance(result, BaseException):
                logger.error("Failed to generate email in thread '%s': %s", thread_plan.thread_name, result)
                continue
            
            email_story = cast(EmailStoryData, result)
            phone_stories[phone_id].append(email_story)
            
            # Multi-phone duplication
            _add_email_to_other_phones(email_story, phone_id, phone_stories)


async def _generate_chat_threads_parallel(
    phone_planned_map: Dict[str, List[PlannedStory]],
    timeline: list[TimelineEvent],
    entities: list[Entity],
    phone_stories: Dict[str, List[StoryData]],
) -> None:
    """Generate chat threads for all phones with parallel generation."""
    logger.info("Generating chat threads for %d phones", len(phone_planned_map))
    
    # Phase 1: Plan all threads for all phones in parallel
    planning_tasks = []
    phone_ids = []
    
    for phone_entity_id, planned_stories in phone_planned_map.items():
        planning_tasks.append(
            plan_chat_threads(
                planned_stories=planned_stories,
                timeline_events=timeline,
                entities=entities,
                phone_entity_id=phone_entity_id,
            )
        )
        phone_ids.append(phone_entity_id)
    
    planning_results = await asyncio.gather(*planning_tasks, return_exceptions=True)
    
    # Collect all thread plans
    all_thread_plans: List[tuple[str, ChatThreadPlan]] = []
    for phone_id, result in zip(phone_ids, planning_results):
        if isinstance(result, BaseException):
            logger.error("Chat thread planning failed for phone %s: %s", phone_id, result)
            continue
        for thread_plan in result:
            all_thread_plans.append((phone_id, thread_plan))
    
    logger.info("Planned %d chat threads across all phones", len(all_thread_plans))
    
    # Phase 2: Generate all chats in parallel (each chat is generated as a complete unit)
    # Process in batches of PARALLEL_BATCH_SIZE
    for i in range(0, len(all_thread_plans), PARALLEL_BATCH_SIZE):
        batch = all_thread_plans[i:i + PARALLEL_BATCH_SIZE]
        
        generation_tasks = [
            generate_chat_from_thread(
                thread_plan=thread_plan,
                timeline_events=timeline,
                entities=entities,
                phone_entity_id=phone_id,
            )
            for phone_id, thread_plan in batch
        ]
        
        logger.info("Generating chat batch %d-%d of %d", i + 1, i + len(batch), len(all_thread_plans))
        
        results = await asyncio.gather(*generation_tasks, return_exceptions=True)
        
        for (phone_id, thread_plan), result in zip(batch, results):
            if isinstance(result, BaseException):
                logger.error("Failed to generate chat thread '%s': %s", thread_plan.thread_name, result)
                continue
            
            chat_story = result
            phone_stories[phone_id].append(chat_story)
            
            # Multi-phone duplication
            _add_chat_to_other_phones(chat_story, phone_id, phone_stories)


async def _generate_sms_threads_parallel(
    phone_planned_map: Dict[str, List[PlannedStory]],
    timeline: list[TimelineEvent],
    entities: list[Entity],
    phone_stories: Dict[str, List[StoryData]],
) -> None:
    """Generate SMS threads for all phones with parallel story generation."""
    logger.info("Generating SMS threads for %d phones", len(phone_planned_map))
    
    # Phase 1: Plan all threads for all phones in parallel
    planning_tasks = []
    phone_ids = []
    
    for phone_entity_id, planned_stories in phone_planned_map.items():
        planning_tasks.append(
            plan_sms_threads(
                planned_stories=planned_stories,
                timeline_events=timeline,
                entities=entities,
                phone_entity_id=phone_entity_id,
            )
        )
        phone_ids.append(phone_entity_id)
    
    planning_results = await asyncio.gather(*planning_tasks, return_exceptions=True)
    
    # Collect all thread plans
    all_thread_plans: List[tuple[str, SMSThreadPlan]] = []
    for phone_id, result in zip(phone_ids, planning_results):
        if isinstance(result, BaseException):
            logger.error("SMS thread planning failed for phone %s: %s", phone_id, result)
            continue
        for thread_plan in result:
            all_thread_plans.append((phone_id, thread_plan))
    
    logger.info("Planned %d SMS threads across all phones", len(all_thread_plans))
    
    # Phase 2: Generate SMS messages in waves (like email, need context within thread)
    max_depth = max((len(tp.timeline) for _, tp in all_thread_plans), default=0)
    
    for depth in range(max_depth):
        generation_tasks = []
        task_info: List[tuple[str, SMSThreadPlan, SMSTimelineEntry]] = []
        
        for phone_id, thread_plan in all_thread_plans:
            if depth < len(thread_plan.timeline):
                timeline_entry = thread_plan.timeline[depth]
                # Get previous stories for this thread
                prev_stories = [
                    s for s in phone_stories[phone_id]
                    if isinstance(s, InstantMessageStoryData)
                ]
                
                generation_tasks.append(
                    generate_sms_story_from_thread(
                        thread_plan=thread_plan,
                        timeline_entry=timeline_entry,
                        timeline_events=timeline,
                        entities=entities,
                        phone_entity_id=phone_id,
                        previous_stories=prev_stories[-5:],  # Last 5 for context
                    )
                )
                task_info.append((phone_id, thread_plan, timeline_entry))
        
        if not generation_tasks:
            continue
            
        logger.info("Generating SMS depth %d: %d messages in parallel", depth + 1, len(generation_tasks))
        
        results = await asyncio.gather(*generation_tasks, return_exceptions=True)
        
        for (phone_id, thread_plan, timeline_entry), result in zip(task_info, results):
            if isinstance(result, BaseException):
                logger.error("Failed to generate SMS in thread '%s': %s", thread_plan.thread_name, result)
                continue
            
            sms_story = cast(InstantMessageStoryData, result)
            phone_stories[phone_id].append(sms_story)
            
            # Multi-phone duplication
            _add_sms_to_other_phone(sms_story, timeline_entry, phone_id, phone_stories)


async def _generate_simple_stories_parallel(
    phone_planned_map: Dict[str, List[PlannedStory]],
    planned_to_event: Dict[int, TimelineEvent],
    entities: list[Entity],
    phone_stories: Dict[str, List[StoryData]],
) -> None:
    """Generate simple (non-thread) stories in parallel batches."""
    total_stories = sum(len(planned_list) for planned_list in phone_planned_map.values())
    logger.info("Generating %d simple stories across %d phones", total_stories, len(phone_planned_map))
    
    # Flatten all planned stories with their phone IDs
    all_simple_stories: List[tuple[str, PlannedStory, TimelineEvent]] = []
    
    for phone_entity_id, planned_stories in phone_planned_map.items():
        for planned in planned_stories:
            event = planned_to_event.get(id(planned))
            if event:
                all_simple_stories.append((phone_entity_id, planned, event))
            else:
                logger.warning(
                    "No event found for planned story %s on phone %s",
                    planned.story_type.value,
                    phone_entity_id,
                )
    
    if not all_simple_stories:
        logger.info("No simple stories to generate")
        return
    
    # Generate in parallel batches of PARALLEL_BATCH_SIZE (at least 15)
    for i in range(0, len(all_simple_stories), PARALLEL_BATCH_SIZE):
        batch = all_simple_stories[i:i + PARALLEL_BATCH_SIZE]
        batch_num = (i // PARALLEL_BATCH_SIZE) + 1
        total_batches = (len(all_simple_stories) + PARALLEL_BATCH_SIZE - 1) // PARALLEL_BATCH_SIZE
        
        logger.info(
            "Generating simple story batch %d/%d (%d stories in parallel)",
            batch_num,
            total_batches,
            len(batch),
        )
        
        tasks = [
            generate_simple_story(
                planned_story=planned,
                timeline_event=event,
                entities=entities,
                phone_entity_id=phone_id,
            )
            for phone_id, planned, event in batch
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for (phone_id, planned, event), result in zip(batch, results):
            if isinstance(result, BaseException):
                logger.error(
                    "Failed to generate %s story for phone %s: %s",
                    planned.story_type.value,
                    phone_id,
                    result,
                )
                continue
            
            story = cast(StoryData, result)
            phone_stories[phone_id].append(story)
            
            # Multi-phone: Calls need duplication
            if planned.story_type == StoryType.CALL:
                _add_call_to_other_phone(story, phone_id, phone_stories)


# ==================== Multi-phone helper functions ====================

def _add_email_to_other_phones(
    email_story: EmailStoryData,
    original_phone_id: str,
    phone_stories: Dict[str, List[StoryData]],
) -> None:
    """Add email copies to other participants' phones."""
    story_from = getattr(email_story, 'from_', None)
    story_to = getattr(email_story, 'to', [])
    
    if not story_from:
        return
    
    involved_entities = [story_from] + list(story_to)
    all_stories = create_multi_phone_stories(
        original_story=email_story,
        involved_entity_ids=involved_entities,
        original_phone_entity_id=original_phone_id,
    )
    
    for story in all_stories:
        if story is not email_story:
            other_from = getattr(story, 'from_', None)
            other_to = getattr(story, 'to', [])
            other_folder = getattr(story, 'folder', '')
            
            if other_folder == 'Sent' and other_from and other_from != original_phone_id:
                phone_stories[other_from].append(story)
            elif other_folder == 'Inbox':
                for recipient in other_to:
                    if recipient != original_phone_id:
                        phone_stories[recipient].append(story)
                        break


def _add_chat_to_other_phones(
    chat_story: StoryData,
    original_phone_id: str,
    phone_stories: Dict[str, List[StoryData]],
) -> None:
    """Add chat copies to other participants' phones."""
    chat_data = getattr(chat_story, 'chat', None)
    if not chat_data:
        return
    
    participant_entities = getattr(chat_data, 'participants', [])
    if not participant_entities:
        return
    
    all_stories = create_multi_phone_stories(
        original_story=chat_story,
        involved_entity_ids=participant_entities,
        original_phone_entity_id=original_phone_id,
    )
    
    for story in all_stories:
        if story is not chat_story:
            for participant_id in participant_entities:
                if participant_id != original_phone_id:
                    phone_stories[participant_id].append(story)
                    break


def _add_sms_to_other_phone(
    sms_story: InstantMessageStoryData,
    timeline_entry: SMSTimelineEntry,
    original_phone_id: str,
    phone_stories: Dict[str, List[StoryData]],
) -> None:
    """Add SMS copy to the other party's phone."""
    sender_id = timeline_entry.sender
    receiver_id = timeline_entry.receiver
    involved_entities = [sender_id, receiver_id]
    
    all_stories = create_multi_phone_stories(
        original_story=sms_story,
        involved_entity_ids=involved_entities,
        original_phone_entity_id=original_phone_id,
    )
    
    for story in all_stories:
        if story is not sms_story:
            other_entity_id = receiver_id if sender_id == original_phone_id else sender_id
            phone_stories[other_entity_id].append(story)


def _add_call_to_other_phone(
    call_story: StoryData,
    original_phone_id: str,
    phone_stories: Dict[str, List[StoryData]],
) -> None:
    """Add call copy to the other participant's phone."""
    participant = getattr(call_story, 'participant', None)
    if not participant or participant == original_phone_id:
        return
    
    involved_entities = [participant, original_phone_id]
    all_stories = create_multi_phone_stories(
        original_story=call_story,
        involved_entity_ids=involved_entities,
        original_phone_entity_id=original_phone_id,
    )
    
    for story in all_stories:
        if story is not call_story:
            phone_stories[participant].append(story)
