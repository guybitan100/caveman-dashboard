"""Output models for story generation - typed Pydantic schemas for all story types."""

from datetime import datetime
from typing import Literal

from model.stories import StoryType
from pydantic import BaseModel, Field, field_validator


# ==================== File Story Components ====================

class StoryFileInfo(BaseModel):
    """File information for file-based stories."""
    s3_key: str = Field(description="S3 key path for the file")
    file_type: Literal["upload", "metafinder"] = Field(description="File source type")
    file_name: str = Field(description="Original filename with extension")
    size: int = Field(description="File size in bytes", gt=0)
    presigned_url: str | None = Field(default=None, description="Optional presigned URL")


class Coordinate(BaseModel):
    """Geographic coordinate."""
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ContactInfo(BaseModel):
    """Contact information."""
    first_name: str | None = None
    last_name: str | None = None
    phones: list[str] = Field(default_factory=list)
    emails: list[str] = Field(default_factory=list)
    
    @field_validator("phones", "emails")
    @classmethod
    def validate_at_least_one(cls, v: list[str], info) -> list[str]:
        """Ensure at least one phone or email is provided."""
        # This will be checked at model validation level
        return v


class AppInfo(BaseModel):
    """Application information."""
    app_id: str = Field(description="Application identifier")
    name: str | None = Field(default=None, description="Application name")


# ==================== Story Data Outputs ====================

class BaseStoryOutput(BaseModel):
    """Base output for all story types.
    
    Note: uid is intentionally NOT included here. UIDs are always generated
    server-side after LLM response to ensure uniqueness and prevent duplicates.
    """
    story_type: StoryType
    time: datetime = Field(description="Event timestamp")
    user_description: str | None = Field(default=None, description="Human-readable description")
    location_ref: str | None = Field(default=None, description="Reference to LocationStoryData UID")


class CallStoryOutput(BaseStoryOutput):
    """Output for call stories."""
    story_type: Literal[StoryType.CALL] = StoryType.CALL
    app_id: str | None = None
    participant: str = Field(description="Entity ID of the other participant")
    direction: Literal["Incoming", "Outgoing", "Unknown"] = Field(description="Call direction")
    call_type: Literal["Voice", "Video", "FaceTime", "WhatsApp"] | None = None
    duration: int | None = Field(default=None, ge=0, description="Call duration in seconds")


class InstantMessageStoryOutput(BaseStoryOutput):
    """Output for SMS/MMS stories."""
    story_type: Literal[StoryType.INSTANT_MESSAGE] = StoryType.INSTANT_MESSAGE
    app_id: str | None = None
    sender: str = Field(description="Entity ID of sender")
    text: str = Field(description="Message text content")
    status: Literal["Sent", "Read", "Delivered", "Failed"] = "Read"
    attachment: str | None = Field(default=None, description="UID reference to attachment story")


class EmailStoryOutput(BaseStoryOutput):
    """Output for email stories."""
    story_type: Literal[StoryType.EMAIL] = StoryType.EMAIL
    app_id: str | None = None
    from_: str = Field(description="Entity ID of sender", alias="from")
    to: list[str] = Field(description="List of recipient entity IDs", min_length=1)
    subject: str | None = None
    body: str | None = None
    folder: str = Field(default="Inbox", description="Email folder")
    attachments: list[str] = Field(default_factory=list, description="List of attachment story UIDs")
    
    class Config:
        populate_by_name = True  # Allow both 'from' and 'from_'


class ChatMessageStoryOutput(BaseStoryOutput):
    """Output for individual chat message stories."""
    story_type: Literal[StoryType.CHAT_MESSAGE] = StoryType.CHAT_MESSAGE
    chat_uid: str = Field(description="Group chat identifier")
    sender: str = Field(description="Entity ID of sender")
    text: str = Field(description="Message text")
    status: Literal["Sent", "Read", "Delivered"] = "Read"
    reply_msg_uid: str | None = Field(default=None, description="UID of message being replied to")
    forwarded: bool = False
    attachments: list[str] = Field(default_factory=list, description="List of attachment story UIDs")


class ChatInfoOutput(BaseModel):
    """Chat information for chat stories."""
    participants: list[str] = Field(description="List of participant entity IDs")
    messages: list[ChatMessageStoryOutput] = Field(default_factory=list)


class ChatStoryOutput(BaseModel):
    """Output for group chat stories (container for messages).
    
    Note: uid is intentionally NOT included. UIDs are always generated
    server-side after LLM response to ensure uniqueness.
    """
    story_type: Literal[StoryType.CHAT] = StoryType.CHAT
    app_id: str | None = None
    chat: ChatInfoOutput
    user_description: str | None = None


class LocationStoryOutput(BaseStoryOutput):
    """Output for location stories."""
    story_type: Literal[StoryType.LOCATION] = StoryType.LOCATION
    app_id: str | None = None
    coordinate: Coordinate
    category: str = Field(default="Unknown", description="Location category")
    location_ref: None = None  # Location stories don't reference themselves


class RouteStoryOutput(BaseModel):
    """Output for route stories (sequence of locations).
    
    Note: uid is intentionally NOT included. UIDs are always generated
    server-side after LLM response to ensure uniqueness.
    """
    story_type: Literal[StoryType.ROUTE] = StoryType.ROUTE
    locations: list[LocationStoryOutput] = Field(description="Ordered list of location points")
    user_description: str | None = None


class ImageStoryOutput(BaseStoryOutput):
    """Output for image stories."""
    story_type: Literal[StoryType.IMAGE] = StoryType.IMAGE
    file: StoryFileInfo
    deleted_state: Literal["Intact", "Deleted", "Unknown"] = "Intact"


class VideoStoryOutput(BaseStoryOutput):
    """Output for video stories."""
    story_type: Literal[StoryType.VIDEO] = StoryType.VIDEO
    file: StoryFileInfo
    deleted_state: Literal["Intact", "Deleted", "Unknown"] = "Intact"


class AudioStoryOutput(BaseStoryOutput):
    """Output for audio stories."""
    story_type: Literal[StoryType.AUDIO] = StoryType.AUDIO
    file: StoryFileInfo
    deleted_state: Literal["Intact", "Deleted", "Unknown"] = "Intact"


class DocumentStoryOutput(BaseStoryOutput):
    """Output for document stories."""
    story_type: Literal[StoryType.DOCUMENT] = StoryType.DOCUMENT
    file: StoryFileInfo
    deleted_state: Literal["Intact", "Deleted", "Unknown"] = "Intact"


class WebHistoryStoryOutput(BaseStoryOutput):
    """Output for web history stories."""
    story_type: Literal[StoryType.WEB_HISTORY] = StoryType.WEB_HISTORY
    app_id: str | None = None
    url: str = Field(description="Full URL")
    title: str | None = Field(default=None, description="Page title")
    uses: int = Field(default=1, ge=1, description="Visit count")


class WebBookmarkStoryOutput(BaseStoryOutput):
    """Output for web bookmark stories."""
    story_type: Literal[StoryType.WEB_BOOKMARK] = StoryType.WEB_BOOKMARK
    app_id: str | None = None
    url: str = Field(description="Full URL")
    title: str | None = Field(default=None, description="Bookmark title")
    uses: int = Field(default=1, ge=0, description="Usage count")
    folder: str = Field(default="Favorites", description="Bookmark folder")


class CookieStoryOutput(BaseStoryOutput):
    """Output for cookie stories."""
    story_type: Literal[StoryType.COOKIE] = StoryType.COOKIE
    app_id: str | None = None
    name: str = Field(description="Cookie name")
    value: str = Field(description="Cookie value")
    domain: str = Field(description="Cookie domain (e.g., .example.com)")
    path: str = Field(default="/", description="Cookie path")
    expiry: datetime | None = Field(default=None, description="Cookie expiration time")


class ContactStoryOutput(BaseStoryOutput):
    """Output for contact stories."""
    story_type: Literal[StoryType.CONTACT] = StoryType.CONTACT
    app_id: str | None = None
    contact: ContactInfo


class AppStoryOutput(BaseStoryOutput):
    """Output for app stories."""
    story_type: Literal[StoryType.APP] = StoryType.APP
    app: AppInfo


class PoweringEventStoryOutput(BaseStoryOutput):
    """Output for powering event stories."""
    story_type: Literal[StoryType.POWERING_EVENT] = StoryType.POWERING_EVENT
    app_id: str | None = None
    event_name: Literal["On", "Off", "Charging", "Unplugged"] = Field(description="Power event type")
    description: str | None = None


# Union type for any story output
StoryOutput = (
    CallStoryOutput
    | InstantMessageStoryOutput
    | EmailStoryOutput
    | ChatMessageStoryOutput
    | ChatStoryOutput
    | LocationStoryOutput
    | RouteStoryOutput
    | ImageStoryOutput
    | VideoStoryOutput
    | AudioStoryOutput
    | DocumentStoryOutput
    | WebHistoryStoryOutput
    | WebBookmarkStoryOutput
    | CookieStoryOutput
    | ContactStoryOutput
    | AppStoryOutput
    | PoweringEventStoryOutput
)


def get_story_output_class(story_type: StoryType) -> type[BaseStoryOutput]:
    """Get the appropriate output class for a story type."""
    mapping = {
        StoryType.CALL: CallStoryOutput,
        StoryType.INSTANT_MESSAGE: InstantMessageStoryOutput,
        StoryType.EMAIL: EmailStoryOutput,
        StoryType.CHAT_MESSAGE: ChatMessageStoryOutput,
        StoryType.CHAT: ChatStoryOutput,
        StoryType.LOCATION: LocationStoryOutput,
        StoryType.ROUTE: RouteStoryOutput,
        StoryType.IMAGE: ImageStoryOutput,
        StoryType.VIDEO: VideoStoryOutput,
        StoryType.AUDIO: AudioStoryOutput,
        StoryType.DOCUMENT: DocumentStoryOutput,
        StoryType.WEB_HISTORY: WebHistoryStoryOutput,
        StoryType.WEB_BOOKMARK: WebBookmarkStoryOutput,
        StoryType.COOKIE: CookieStoryOutput,
        StoryType.CONTACT: ContactStoryOutput,
        StoryType.APP: AppStoryOutput,
        StoryType.POWERING_EVENT: PoweringEventStoryOutput,
    }
    return mapping[story_type]
