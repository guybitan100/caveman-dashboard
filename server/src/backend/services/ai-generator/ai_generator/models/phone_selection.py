
from datetime import date
from enum import StrEnum
from pydantic import BaseModel, Field


class DeviceType(StrEnum):
    IPHONE = "iphone"
    ANDROID = "android"
    GENERIC = "generic"


class PhoneCandidate(BaseModel):
    
    entity_id: str = Field(description="Entity ID from the entity extraction stage")
    entity_name: str = Field(description="Full name of the entity")
    
    # Statistics for informed selection
    total_event_count: int = Field(
        default=0,
        description="Total timeline events this entity appears in"
    )
    primary_event_count: int = Field(
        default=0,
        description="Events where this entity is the primary actor"
    )
    
    # Relationship context
    connection_count: int = Field(
        default=0,
        description="Number of other entities this entity is connected to"
    )
    
    # AI recommendation
    recommended: bool = Field(
        default=False,
        description="Whether AI recommends this entity for extraction"
    )
    recommendation_reason: str | None = Field(
        default=None,
        description="Why this entity is/isn't recommended"
    )


class SelectedPhone(BaseModel):
    
    entity_id: str = Field(description="Entity whose phone this is")
    entity_name: str = Field(description="Name of the entity")
    device_type: DeviceType = Field(default=DeviceType.GENERIC)
    phone_number: str | None = Field(default=None)
    email: str | None = Field(default=None)
    
    # Device context configuration
    start_date: date | None = Field(
        default=None,
        description="Start of extraction time range"
    )
    end_date: date | None = Field(
        default=None,
        description="End of extraction time range"
    )


class PhoneSelectionRequest(BaseModel):
    session_id: str


class PhoneSelectionResponse(BaseModel):
    session_id: str
    candidates: list[PhoneCandidate] = Field(default_factory=list)


class PhoneSelectionConfirmation(BaseModel):
    session_id: str
    selected_phones: list[SelectedPhone] = Field(default_factory=list)
