"""Models for thread planning - organizing stories into conversation threads."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from model.types import EntityID


# ==================== Email Thread Models ====================

class EmailTimelineEntry(BaseModel):
    """A single email in a thread timeline."""
    
    sequence_number: int = Field(
        description="Order in thread (1-based)"
    )
    timestamp: datetime = Field(
        description="When this email was sent"
    )
    from_entity: EntityID = Field(
        description="Who sends this email"
    )
    to_entities: list[EntityID] = Field(
        description="Who receives this email"
    )
    email_type: Literal["initial", "reply", "forward"] = Field(
        description="Type of email"
    )
    subject_preview: str = Field(
        description="Subject line for this email"
    )
    context: str = Field(
        description="What this email should be about (guidance for generation)"
    )
    planned_story_id: str = Field(
        description="Links to original PlannedStory"
    )


class EmailThreadPlan(BaseModel):
    """Plan for a single email conversation thread."""
    
    thread_id: str = Field(
        description="Unique identifier for this thread"
    )
    thread_name: str = Field(
        description="Human-readable name (e.g., 'Project X Discussion')"
    )
    related_event_ids: list[str] = Field(
        description="Timeline events this thread relates to"
    )
    timeline: list[EmailTimelineEntry] = Field(
        description="All emails in this thread, in chronological order"
    )


class EmailThreadPlans(BaseModel):
    """Output type for email thread planning agent."""
    
    threads: list[EmailThreadPlan] = Field(
        description="All email threads to generate"
    )


# ==================== Chat Thread Models ====================

class ChatTimelineEntry(BaseModel):
    """A single message in a chat thread timeline."""
    
    sequence_number: int = Field(
        description="Order in chat (1-based)"
    )
    timestamp: datetime = Field(
        description="When this message was sent"
    )
    sender: EntityID = Field(
        description="Who sends this message"
    )
    message_type: Literal["text", "reply", "forwarded"] = Field(
        description="Type of message"
    )
    has_attachments: bool = Field(
        default=False,
        description="Whether this message has attachments"
    )
    context: str = Field(
        description="What this message should be about (guidance for generation)"
    )
    planned_story_id: str = Field(
        description="Links to original PlannedStory"
    )


class ChatThreadPlan(BaseModel):
    """Plan for a single chat conversation."""
    
    thread_id: str = Field(
        description="Unique identifier for this thread"
    )
    thread_name: str = Field(
        description="Human-readable name (e.g., 'Team Standup Chat')"
    )
    chat_uid: str = Field(
        description="Chat container UID (all messages share this)"
    )
    participants: list[EntityID] = Field(
        description="All participants in this chat"
    )
    related_event_ids: list[str] = Field(
        description="Timeline events this chat relates to"
    )
    timeline: list[ChatTimelineEntry] = Field(
        description="All messages in this chat, in chronological order"
    )


class ChatThreadPlans(BaseModel):
    """Output type for chat thread planning agent."""
    
    threads: list[ChatThreadPlan] = Field(
        description="All chat threads to generate"
    )


# ==================== SMS Thread Models ====================

class SMSTimelineEntry(BaseModel):
    """A single SMS/MMS message in a thread timeline."""
    
    sequence_number: int = Field(
        description="Order in conversation (1-based)"
    )
    timestamp: datetime = Field(
        description="When this message was sent"
    )
    sender: EntityID = Field(
        description="Who sends this message"
    )
    receiver: EntityID = Field(
        description="Who receives this message"
    )
    direction: Literal["incoming", "outgoing"] = Field(
        description="Direction from phone owner's perspective"
    )
    context: str = Field(
        description="What this message should be about (guidance for generation)"
    )
    planned_story_id: str = Field(
        description="Links to original PlannedStory"
    )


class SMSThreadPlan(BaseModel):
    """Plan for a single SMS/MMS conversation."""
    
    thread_id: str = Field(
        description="Unique identifier for this thread"
    )
    thread_name: str = Field(
        description="Human-readable name (e.g., 'Conversation with Sarah')"
    )
    participants: list[EntityID] = Field(
        description="Phone owner and other person (should be 2)"
    )
    related_event_ids: list[str] = Field(
        description="Timeline events this conversation relates to"
    )
    timeline: list[SMSTimelineEntry] = Field(
        description="All messages in this conversation, in chronological order"
    )


class SMSThreadPlans(BaseModel):
    """Output type for SMS thread planning agent."""
    
    threads: list[SMSThreadPlan] = Field(
        description="All SMS threads to generate"
    )
