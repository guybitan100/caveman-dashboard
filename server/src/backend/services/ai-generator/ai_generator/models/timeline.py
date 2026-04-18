"""Timeline models - output of the timeline generation agent."""

import json
from datetime import datetime
from enum import StrEnum
from pydantic import BaseModel, Field, field_validator


class EventCategory(StrEnum):
    """High-level category of timeline events."""
    COMMUNICATION = "communication"  # Calls, messages, emails
    LOCATION = "location"  # Movement, presence at location
    MEDIA = "media"  # Photos, videos, audio
    SOCIAL = "social"  # Social media, interactions
    FINANCIAL = "financial"  # Transactions, purchases
    WORK = "work"  # Work-related activities
    MEETING = "meeting"  # In-person meetings
    DIGITAL_ACTIVITY = "digital_activity"  # Web browsing, app usage
    OTHER = "other"


class TimelineEvent(BaseModel):
    """
    Represents a high-level event in the story timeline.
    
    These events will later be translated into specific EventData and FileData
    instances for UFDR generation.
    """
    
    event_id: str = Field(
        description="Unique identifier for this event"
    )
    
    timestamp: datetime = Field(
        description="When the event occurred"
    )
    
    category: EventCategory = Field(
        description="High-level category of the event"
    )
    
    involved_entities: list[str] = Field(
        default_factory=list,
        description="Entity IDs of all entities involved in this event"
    )
    
    primary_entity: str = Field(
        description="Entity ID of the primary entity (whose phone this event would appear on)"
    )
    
    description: str = Field(
        description="Detailed description of what happened"
    )
    
    location: str | None = Field(
        default=None,
        description="Location where the event occurred, if applicable"
    )
    
    coordinates: tuple[float, float] | None = Field(
        default=None,
        description="GPS coordinates (latitude, longitude) if applicable"
    )
    
    metadata: dict[str, str | int | float | bool] = Field(
        default_factory=dict,
        description="Additional metadata specific to this event type (e.g., duration for calls, message content for texts)"
    )
    
    significance: int = Field(
        default=5,
        ge=1,
        le=10,
        description="How significant this event is to the story (1=background noise, 10=critical plot point)"
    )
    
    @field_validator("metadata", mode="before")
    @classmethod
    def sanitize_metadata(
        cls, v: dict | None
    ) -> dict[str, str | int | float | bool]:
        """
        Sanitize metadata to ensure all values are scalar types.
        
        Converts:
        - Lists to comma-separated strings
        - Nested dicts to JSON strings
        - None to empty string
        - Other types to string representation
        """
        if not isinstance(v, dict):
            return {}
        
        sanitized = {}
        for key, value in v.items():
            if isinstance(value, (str, int, float, bool)):
                sanitized[key] = value
            elif isinstance(value, list):
                # Convert list to comma-separated string
                sanitized[key] = ", ".join(str(item) for item in value)
            elif isinstance(value, dict):
                # Convert nested dict to JSON string
                sanitized[key] = json.dumps(value)
            elif value is None:
                sanitized[key] = ""
            else:
                sanitized[key] = str(value)
        
        return sanitized
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "event_id": "evt_001",
                "timestamp": "2025-11-15T09:30:00",
                "category": "communication",
                "involved_entities": ["ent_001", "ent_002"],
                "primary_entity": "ent_001",
                "description": "Sarah calls her partner Mike to discuss the case",
                "location": "Millbrook Police Station",
                "coordinates": [45.5231, -122.6765],
                "metadata": {
                    "call_duration_seconds": 180,
                    "call_type": "outgoing",
                    "contact_name": "Mike Rodriguez"
                },
                "significance": 7
            }
        }
    }
