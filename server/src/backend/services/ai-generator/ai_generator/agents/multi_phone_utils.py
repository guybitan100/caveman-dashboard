"""Utilities for creating multi-phone story variations.

When stories involve communication between entities (calls, emails, SMS, chats), they 
need to appear on multiple phones from different perspectives (sender vs receiver).

This module provides utilities to transform a single generated story into multiple
perspective-specific copies.
"""

import logging
from copy import deepcopy
from typing import TypeVar

from model.stories import (
    CallStoryData,
    EmailStoryData,
    InstantMessageStoryData,
    ChatStoryData,
    StoryData,
)
from model.types import EntityID
from model.utils import str_uuid

logger = logging.getLogger(__name__)

StoryT = TypeVar('StoryT', bound=StoryData)


def create_call_for_other_phone(
    original_call: CallStoryData,
    other_phone_entity_id: EntityID,
) -> CallStoryData:
    """
    Create a call story for the other participant's phone.
    
    If original is outgoing from Phone A → Phone B, create incoming call for Phone B.
    If original is incoming to Phone A from Phone B, create outgoing call for Phone B.
    
    Args:
        original_call: The original call story
        other_phone_entity_id: The entity ID of the other phone
        
    Returns:
        New call story from the other phone's perspective
    """
    new_call = deepcopy(original_call)
    new_call.uid = str_uuid()
    
    # Flip the direction
    direction_map = {
        "Outgoing": "Incoming",
        "Incoming": "Outgoing",
        "Missed": "Cancelled",  # If A missed it, B cancelled/didn't answer
        "Rejected": "Cancelled",  # If A rejected it, B's attempt was cancelled
        "Cancelled": "Missed",  # If A cancelled, B missed it
    }
    
    if new_call.direction in direction_map:
        new_call.direction = direction_map[new_call.direction]
    
    logger.debug(
        "Created call story for phone %s with direction %s (original: %s)",
        other_phone_entity_id,
        new_call.direction,
        original_call.direction,
    )
    
    return new_call


def create_email_for_other_phone(
    original_email: EmailStoryData,
    phone_entity_id: EntityID,
) -> EmailStoryData:
    """
    Create an email story for another phone involved in the conversation.
    
    Changes folder perspective:
    - If original is in "Sent" folder, create copy in "Inbox" folder for recipient
    - If original is in "Inbox" folder, create copy in "Sent" folder for sender
    
    Args:
        original_email: The original email story
        phone_entity_id: The entity ID whose phone we're creating this for
        
    Returns:
        New email story from the other phone's perspective
    """
    new_email = deepcopy(original_email)
    new_email.uid = str_uuid()
    
    # Determine folder based on who owns this phone
    if phone_entity_id == original_email.from_:
        # This phone belongs to the sender
        new_email.folder = "Sent"
    elif phone_entity_id in original_email.to:
        # This phone belongs to a recipient
        new_email.folder = "Inbox"
    else:
        # CC or BCC - typically inbox
        new_email.folder = "Inbox"
    
    logger.debug(
        "Created email story for phone %s in folder %s",
        phone_entity_id,
        new_email.folder,
    )
    
    return new_email


def create_sms_for_other_phone(
    original_sms: InstantMessageStoryData,
    other_phone_entity_id: EntityID,
) -> InstantMessageStoryData:
    """
    Create an SMS story for the other participant's phone.
    
    Changes sender and status:
    - Original sender becomes the message sender
    - Status flips: "Sent" → "Read", "Read" → "Sent"
    
    Args:
        original_sms: The original SMS story
        other_phone_entity_id: The entity ID of the other phone
        
    Returns:
        New SMS story from the other phone's perspective
    """
    new_sms = deepcopy(original_sms)
    new_sms.uid = str_uuid()
    
    # Flip the status
    status_map = {
        "Sent": "Read",
        "Delivered": "Read",
        "Read": "Sent",
        "Unread": "Sent",
    }
    
    if new_sms.status in status_map:
        new_sms.status = status_map[new_sms.status]
    
    logger.debug(
        "Created SMS story for phone %s with status %s (original: %s)",
        other_phone_entity_id,
        new_sms.status,
        original_sms.status,
    )
    
    return new_sms


def create_chat_message_for_other_phones(
    original_chat: ChatStoryData,
    participant_phone_entities: list[EntityID],
) -> list[ChatStoryData]:
    """
    Create chat story copies for all other participants.
    
    Chats are group conversations, so the same ChatStoryData (with multiple messages)
    appears on all participant phones. Each copy gets a new UID.
    
    Args:
        original_chat: The original chat story
        participant_phone_entities: List of all participant entity IDs
        
    Returns:
        List of chat story copies, one for each participant (including original sender)
    """
    chat_copies = []
    
    for phone_entity_id in participant_phone_entities:
        new_chat = deepcopy(original_chat)
        new_chat.uid = str_uuid()
        
        # Chat content is identical across all phones
        # Only the UID changes for database purposes
        
        chat_copies.append(new_chat)
        
        logger.debug(
            "Created chat story copy for phone %s with %d messages",
            phone_entity_id,
            len(new_chat.chat.messages),
        )
    
    return chat_copies


def create_multi_phone_stories(
    original_story: StoryData,
    involved_entity_ids: list[EntityID],
    original_phone_entity_id: EntityID,
) -> list[StoryData]:
    """
    Create story copies for all involved phones.
    
    This is the main entry point for multi-phone story generation.
    
    For communication stories (calls, emails, SMS, chats), creates perspective-specific
    copies for each involved entity. For other story types, returns only the original.
    
    Args:
        original_story: The story to duplicate
        involved_entity_ids: All entity IDs involved (sender, receivers, participants)
        original_phone_entity_id: The phone entity ID the original was generated for
        
    Returns:
        List of stories - original plus copies for other involved phones
    """
    # Filter out the original phone since we already have that story
    other_entity_ids = [eid for eid in involved_entity_ids if eid != original_phone_entity_id]
    
    if not other_entity_ids:
        # Only one phone involved, no copies needed
        return [original_story]
    
    stories = [original_story]
    
    # Handle different story types
    if isinstance(original_story, CallStoryData):
        # Calls are 1-to-1
        if len(other_entity_ids) == 1:
            other_call = create_call_for_other_phone(
                original_story,
                other_entity_ids[0],
            )
            stories.append(other_call)
        else:
            logger.warning(
                "Call story has %d other participants, expected 1. Skipping multi-phone.",
                len(other_entity_ids),
            )
    
    elif isinstance(original_story, EmailStoryData):
        # Emails can have multiple recipients
        for entity_id in other_entity_ids:
            other_email = create_email_for_other_phone(
                original_story,
                entity_id,
            )
            stories.append(other_email)
    
    elif isinstance(original_story, InstantMessageStoryData):
        # SMS is 1-to-1
        if len(other_entity_ids) == 1:
            other_sms = create_sms_for_other_phone(
                original_story,
                other_entity_ids[0],
            )
            stories.append(other_sms)
        else:
            logger.warning(
                "SMS story has %d other participants, expected 1. Skipping multi-phone.",
                len(other_entity_ids),
            )
    
    elif isinstance(original_story, ChatStoryData):
        # Chats involve multiple participants
        chat_copies = create_chat_message_for_other_phones(
            original_story,
            other_entity_ids,
        )
        stories.extend(chat_copies)
    
    else:
        # Other story types (location, media, etc.) don't get duplicated
        logger.debug(
            "Story type %s doesn't support multi-phone, returning original only",
            original_story.story_type,
        )
    
    logger.info(
        "Created %d total stories from 1 original (type: %s)",
        len(stories),
        original_story.story_type,
    )
    
    return stories


def get_involved_entities_from_story(story: StoryData) -> list[EntityID]:
    """
    Extract all entity IDs involved in a story.
    
    This helper determines which entities should receive copies of a story.
    
    Args:
        story: The story to analyze
        
    Returns:
        List of entity IDs involved in this story
    """
    entities = []
    
    if isinstance(story, CallStoryData):
        # Calls: participant + implicitly the phone owner
        entities.append(story.participant)
    
    elif isinstance(story, EmailStoryData):
        # Emails: sender + all recipients (cc/bcc are commented out in model)
        entities.append(story.from_)
        entities.extend(story.to)
    
    elif isinstance(story, InstantMessageStoryData):
        # SMS: sender + implicitly the other party (need to infer from context)
        entities.append(story.sender)
        # Note: SMS doesn't have a "to" field in the model, 
        # so caller needs to provide involved entities
    
    elif isinstance(story, ChatStoryData):
        # Chats: all participants
        entities.extend(story.chat.participants)
    
    # Remove duplicates
    return list(set(entities))
