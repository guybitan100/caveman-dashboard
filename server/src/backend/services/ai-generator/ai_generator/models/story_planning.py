
from enum import StrEnum

from model.stories import StoryType
from pydantic import BaseModel, Field


class StoryPerspective(StrEnum):
    SENDER = "sender"           # Phone owner sent this (outgoing call, sent message)
    RECEIVER = "receiver"       # Phone owner received this (incoming call, received message)
    CREATOR = "creator"         # Phone owner created content (took photo, recorded video)
    PARTICIPANT = "participant" # Phone owner was involved (group chat, meeting)
    OBSERVER = "observer"       # Phone owner has record but wasn't directly involved


class PlannedStory(BaseModel):
    
    phone_entity_id: str = Field(description="Which phone this story will appear on")
    story_type: StoryType = Field(
        description="Type of story to generate (call, sms/mms, location, etc.)"
    )
    perspective: StoryPerspective = Field(
        description="Phone owner's perspective on this story"
    )
    
    # Sync information for stories that appear on multiple phones
    sync_group_id: str | None = Field(
        default=None,
        description="ID linking stories that should be synced (e.g., both sides of a call)"
    )
    
    # Context for generation
    context: dict[str, str] = Field(
        default_factory=dict,
        description="Additional context for generating this story (direction, app, etc.)"
    )


class EventStoryPlan(BaseModel):
    
    timeline_event_id: str = Field(description="The timeline event this plan is for")
    
    planned_stories: list[PlannedStory] = Field(
        default_factory=list, #TODO: add type hint of story type
        description="All stories to generate from this event"
    )
    
    reasoning: str | None = Field(
        default=None,
        description="Why these stories were chosen"
    )


class StoryGenerationPlan(BaseModel):
    
    event_plans: list[EventStoryPlan] = Field(
        description="Plans for each timeline event"
    )
    
    @property
    def total_planned_stories(self) -> int:
        return sum(len(plan.planned_stories) for plan in self.event_plans)
    
    def get_stories_for_phone(self, phone_entity_id: str) -> list[PlannedStory]:
        stories = []
        for event_plan in self.event_plans:
            for story in event_plan.planned_stories:
                if story.phone_entity_id == phone_entity_id:
                    stories.append(story)
        return stories
    
    def get_sync_groups(self) -> dict[str, list[PlannedStory]]:
        sync_groups: dict[str, list[PlannedStory]] = {}
        for event_plan in self.event_plans:
            for story in event_plan.planned_stories:
                if story.sync_group_id:
                    if story.sync_group_id not in sync_groups:
                        sync_groups[story.sync_group_id] = []
                    sync_groups[story.sync_group_id].append(story)
        return sync_groups
    
    def get_event_plan(self, event_id: str) -> EventStoryPlan | None:
        for event_plan in self.event_plans:
            if event_plan.timeline_event_id == event_id:
                return event_plan
        return None
    
    def add_stories_to_event(self, event_id: str, stories: list[PlannedStory]) -> None:
        event_plan = self.get_event_plan(event_id)
        if event_plan:
            event_plan.planned_stories.extend(stories)
        else:
            # Create new event plan if it doesn't exist
            self.event_plans.append(
                EventStoryPlan(
                    timeline_event_id=event_id,
                    planned_stories=stories,
                )
            )
