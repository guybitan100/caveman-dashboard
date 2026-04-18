
from enum import StrEnum

from pydantic import BaseModel, Field

from model.stories import StoryType


class ActivityCategory(StrEnum):

    SOCIAL_MEDIA = "social_media"
    COMMUNICATION = "communication"
    WORK = "work"
    ENTERTAINMENT = "entertainment"
    LOCATION = "location"
    SYSTEM = "system"
    PERSONAL_CARE = "personal_care"


class ActivityPriority(StrEnum):

    ESSENTIAL = "essential"  # Never skip (e.g., charging, commute)
    NORMAL = "normal"  # Skip 10-20% based on entity traits
    OPTIONAL = "optional"  # Skip 30-50% based on entity traits


class RoutineActivity(BaseModel):

    activity_id: str = Field(description="Unique ID for this activity in the pattern")
    time: str = Field(description="Time in HH:MM format (24h)")
    category: ActivityCategory = Field(description="High-level category of the activity")
    story_type: StoryType = Field(description="The type of story to generate")
    priority: ActivityPriority = Field(description="Priority level affecting skip probability")

    parameters: dict[str, str | int | float | bool | list] = Field(
        default_factory=dict,
        description="Parameters for story generation (story-type specific)",
    )

    description: str = Field(description="Human-readable description of the activity")


class DailyRoutinePattern(BaseModel):

    day_of_week: str = Field(
        description="Day name: monday, tuesday, wednesday, thursday, friday, saturday, sunday"
    )
    activities: list[RoutineActivity] = Field(
        description="List of routine activities for this day",
    )
    notes: str | None = Field(
        default=None,
        description="Optional notes about this day's routine",
    )


class WeeklyRoutinePattern(BaseModel):

    entity_id: str = Field(description="Entity ID of the phone owner")
    entity_name: str = Field(description="Name of the phone owner")
    patterns: dict[str, DailyRoutinePattern] = Field(
        description="Map of day_of_week -> DailyRoutinePattern",
    )

    generated_at: str = Field(description="ISO timestamp when the pattern was generated")
    date_range_start: str = Field(description="Start date of the timeline (YYYY-MM-DD)")
    date_range_end: str = Field(description="End date of the timeline (YYYY-MM-DD)")

    summary: str = Field(description="High-level summary of the person's routine")
