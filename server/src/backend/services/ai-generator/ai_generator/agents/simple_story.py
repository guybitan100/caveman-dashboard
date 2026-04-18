"""Simple story generation agent - generates non-thread story types."""

import logging
from pathlib import Path
from typing import Union

from pydantic_ai import Agent

from ai_generator.models import Entity, TimelineEvent
from ai_generator.models.story_planning import PlannedStory
from ai_generator.utils import get_model
from model.stories import (
    CallStoryData,
    LocationStoryData,
    RouteStoryData,
    ImageStoryData,
    VideoStoryData,
    AudioStoryData,
    DocumentStoryData,
    WebHistoryStoryData,
    WebBookmarkStoryData,
    CookieStoryData,
    AppStoryData,
    ContactStoryData,
    PoweringEventStoryData,
    StoryType,
)
from model.types import EntityID
from model.utils import str_uuid

logger = logging.getLogger(__name__)


# Load prompt
_PROMPT_PATH = Path(__file__).parent / "prompts" / "simple_story_generation.md"
_GENERATION_INSTRUCTIONS = _PROMPT_PATH.read_text()


# Type alias for all simple story types
SimpleStoryData = Union[
    CallStoryData,
    LocationStoryData,
    RouteStoryData,
    ImageStoryData,
    VideoStoryData,
    AudioStoryData,
    DocumentStoryData,
    WebHistoryStoryData,
    WebBookmarkStoryData,
    CookieStoryData,
    AppStoryData,
    ContactStoryData,
    PoweringEventStoryData,
]


# Map story types to their data classes
STORY_TYPE_MAP = {
    StoryType.CALL: CallStoryData,
    StoryType.LOCATION: LocationStoryData,
    StoryType.ROUTE: RouteStoryData,
    StoryType.IMAGE: ImageStoryData,
    StoryType.VIDEO: VideoStoryData,
    StoryType.AUDIO: AudioStoryData,
    StoryType.DOCUMENT: DocumentStoryData,
    StoryType.WEB_HISTORY: WebHistoryStoryData,
    StoryType.WEB_BOOKMARK: WebBookmarkStoryData,
    StoryType.COOKIE: CookieStoryData,
    StoryType.APP: AppStoryData,
    StoryType.CONTACT: ContactStoryData,
    StoryType.POWERING_EVENT: PoweringEventStoryData,
}


async def generate_simple_story(
    planned_story: PlannedStory,
    timeline_event: TimelineEvent,
    entities: list[Entity],
    phone_entity_id: EntityID,
) -> SimpleStoryData:
    """
    Generate a single non-thread story.
    
    This function handles all simple story types that don't involve threading/conversations:
    - Call logs
    - Location points
    - Routes
    - Media files (Image, Video, Audio, Document)
    - Web history and bookmarks
    - Cookies
    - Apps
    - Contacts
    - Power events
    
    Args:
        planned_story: The planned story to generate
        timeline_event: The timeline event this story relates to
        entities: All entities for context
        phone_entity_id: Phone owner's entity ID
        
    Returns:
        Complete story data object of the appropriate type
    """
    story_type = planned_story.story_type
    
    if story_type not in STORY_TYPE_MAP:
        raise ValueError(
            f"Story type '{story_type}' is not a simple story type. "
            f"Use thread agents for email, chat, or SMS."
        )
    
    output_type = STORY_TYPE_MAP[story_type]
    
    logger.info(
        "Generating %s story for phone %s from event %s",
        story_type.value,
        phone_entity_id,
        timeline_event.event_id,
    )
    
    # Create agent with specific output type
    agent = Agent(
        name=f"{story_type.value.replace(' ', '_')}_generation_agent",
        model=get_model("six/story-model"),
        output_type=output_type,
        instructions=_GENERATION_INSTRUCTIONS,
    )
    
    # Build entity lookup
    entity_map = {e.entity_id: e for e in entities}
    
    # Get primary entity name
    primary_entity = entity_map.get(timeline_event.primary_entity)
    primary_name = primary_entity.name if primary_entity else timeline_event.primary_entity
    
    # Get involved entity names
    involved_names = [
        entity_map[eid].name if eid in entity_map else eid
        for eid in timeline_event.involved_entities
    ]
    
    # Build prompt
    prompt = f"""Generate a {story_type.value} story based on this planned story and timeline event.

**STORY TYPE:** {story_type.value}

**PLANNED STORY:**
- Perspective: {planned_story.perspective}
- Context: {planned_story.context if planned_story.context else "N/A"}

**TIMELINE EVENT:**
- Event ID: {timeline_event.event_id}
- Time: {timeline_event.timestamp}
- Category: {timeline_event.category}
- Description: {timeline_event.description}
- Primary Entity: {primary_name} (ID: {timeline_event.primary_entity})
- Involved Entities: {', '.join(involved_names)}

**PHONE OWNER:** {phone_entity_id}

**ENTITIES:**
"""
    
    for entity in entities:
        prompt += f"- {entity.name} (ID: {entity.entity_id})\n"
    
    prompt += f"\n\nGenerate a realistic, complete {story_type.value} story that fits this event and context."
    
    try:
        logger.debug("Sending story generation request to LLM for %s", story_type.value)
        result = await agent.run(prompt)
        
        story = result.output
        
        # Always regenerate UID for stories that have uid field
        if hasattr(story, 'uid'):
            story.uid = str_uuid()
        
        logger.info(
            "Generated %s story for event %s",
            story_type.value,
            timeline_event.event_id,
        )
        
        return story
        
    except Exception as e:
        logger.error(
            "%s story generation failed for event %s: %s",
            story_type.value,
            timeline_event.event_id,
            e,
            exc_info=True,
        )
        raise ValueError(f"Failed to generate {story_type.value} story: {e}") from e
