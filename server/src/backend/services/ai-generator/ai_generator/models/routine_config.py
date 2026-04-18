
from typing import Literal

from pydantic import BaseModel, Field


class RoutineGenerationConfig(BaseModel):

    enabled: bool = Field(
        default=True,
        description="Enable routine generation",
    )

    density: Literal["light", "medium", "heavy"] = Field(
        default="heavy",
        description="Target density of routine activities per day. "
        "light: 10-15 activities/day, medium: 20-30 activities/day, heavy: 35-50 activities/day",
    )

    timing_variation_minutes: int = Field(
        default=30,
        description="Max time variation in minutes (±)",
    )

    duration_variation_pct: float = Field(
        default=0.5,
        description="Max duration variation as percentage (0.5 = ±50%)",
    )

    entity_aware_skip: bool = Field(
        default=True,
        description="Use entity traits to determine skip probability",
    )

    adjust_for_timeline_events: bool = Field(
        default=True,
        description="Pause/adjust routines around significant timeline events",
    )

    timeline_event_buffer_minutes: int = Field(
        default=60,
        description="Buffer time before/after timeline events (minutes)",
    )
