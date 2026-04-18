"""Models for story plan validation - ensuring events are properly represented."""

from enum import StrEnum

from model.stories import StoryType
from pydantic import BaseModel, Field

from ai_generator.models.story_planning import StoryPerspective


class ValidationStatus(StrEnum):
    """Status of event representation in the plan."""
    PASS = "pass"  # Event is well-represented
    NEEDS_MORE_STORIES = "needs_more_stories"  # Event needs additional stories
    MISSING_CRITICAL = "missing_critical"  # Event is missing critical stories


class StoryPriority(StrEnum):
    """Priority level for missing stories."""
    CRITICAL = "critical"  # Story must exist for realism
    HIGH = "high"  # Story should exist for good coverage
    MEDIUM = "medium"  # Story would enhance realism
    LOW = "low"  # Story is optional but adds depth


class MissingStory(BaseModel):
    """A story that should be added to the plan."""
    
    phone_entity_id: str = Field(description="Which phone needs this story")
    story_type: StoryType = Field(description="Type of story to add")
    perspective: StoryPerspective = Field(description="Perspective for this story")
    reason: str = Field(description="Why this story is needed")
    priority: StoryPriority = Field(description="How important this story is")
    
    sync_group_id: str | None = Field(
        default=None,
        description="Sync group ID if this story should be synced with others"
    )
    
    context: dict[str, str] = Field(
        default_factory=dict,
        description="Additional context for generating this story"
    )


class EventValidation(BaseModel):
    """Validation result for a single timeline event."""
    
    timeline_event_id: str = Field(description="The event being validated")
    
    validation_status: ValidationStatus = Field(
        description="Overall validation status for this event"
    )
    
    missing_stories: list[MissingStory] = Field(
        default_factory=list,
        description="Stories that should be added to the plan"
    )
    
    current_story_count: int = Field(
        description="Number of stories currently planned for this event"
    )
    
    recommended_story_count: int = Field(
        description="Recommended total number of stories"
    )
    
    overall_coverage: str = Field(
        description="Assessment of coverage: minimal, adequate, good, excellent"
    )
    
    feedback: str = Field(
        description="Detailed feedback about the event representation"
    )
    
    @property
    def needs_additional_stories(self) -> bool:
        """Check if this event needs more stories."""
        return self.validation_status in (
            ValidationStatus.NEEDS_MORE_STORIES,
            ValidationStatus.MISSING_CRITICAL,
        )
    
    @property
    def critical_missing_count(self) -> int:
        """Count of critical missing stories."""
        return sum(
            1 for s in self.missing_stories if s.priority == StoryPriority.CRITICAL
        )


class ValidationReport(BaseModel):
    """Complete validation report for the story generation plan."""
    
    event_validations: list[EventValidation] = Field(
        description="Validation results for each event"
    )
    
    iteration: int = Field(
        default=1,
        description="Which iteration of planning/validation this is"
    )
    
    @property
    def total_missing_stories(self) -> int:
        """Total number of missing stories across all events."""
        return sum(len(v.missing_stories) for v in self.event_validations)
    
    @property
    def events_needing_more(self) -> list[EventValidation]:
        """Events that need additional stories."""
        return [v for v in self.event_validations if v.needs_additional_stories]
    
    @property
    def critical_gaps_count(self) -> int:
        """Count of critical missing stories across all events."""
        return sum(v.critical_missing_count for v in self.event_validations)
    
    @property
    def validation_passed(self) -> bool:
        """Check if validation passed overall (no critical gaps)."""
        return self.critical_gaps_count == 0
    
    def get_validation_for_event(self, event_id: str) -> EventValidation | None:
        """Get validation result for a specific event."""
        for validation in self.event_validations:
            if validation.timeline_event_id == event_id:
                return validation
        return None
