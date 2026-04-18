"""Data models for the AI story generation pipeline."""

# Phase 1: Story generation models
from ai_generator.models.story import StoryExpansion
from ai_generator.models.entity import Entity, EntityCharacteristics, Gender
from ai_generator.models.social_graph import SocialGraph, Relationship, RelationshipType
from ai_generator.models.timeline import TimelineEvent, EventCategory

# Phase 2: Phone extraction models
from ai_generator.models.phone_selection import (
    DeviceType,
    PhoneCandidate,
    SelectedPhone,
    PhoneSelectionRequest,
    PhoneSelectionResponse,
    PhoneSelectionConfirmation,
)
from ai_generator.models.story_planning import (
    StoryPerspective,
    PlannedStory,
    EventStoryPlan,
    StoryGenerationPlan,
)
from ai_generator.models.story_validation import (
    ValidationStatus,
    StoryPriority,
    MissingStory,
    EventValidation,
    ValidationReport,
)
from ai_generator.models.thread_planning import (
    EmailTimelineEntry,
    EmailThreadPlan,
    EmailThreadPlans,
    ChatTimelineEntry,
    ChatThreadPlan,
    ChatThreadPlans,
    SMSTimelineEntry,
    SMSThreadPlan,
    SMSThreadPlans,
)

# Story models - use canonical StoryData from model library
from model.stories import (
    StoryData,
    CallStoryData,
    InstantMessageStoryData,
    EmailStoryData,
    ChatMessageStoryData,
    ChatStoryData,
    LocationStoryData,
    RouteStoryData,
    ImageStoryData,
    VideoStoryData,
    AudioStoryData,
    DocumentStoryData,
    WebHistoryStoryData,
    WebBookmarkStoryData,
    CookieStoryData,
    ContactStoryData,
    AppStoryData,
    PoweringEventStoryData,
    get_story_data_class,
    StoryType,
    Coordinate,
    StoryFileInfo,
)

from ai_generator.models.phone_stories import (
    PhoneStoryMapping,
    PhoneStoryMappingPhone,
    JobGenerationResult,
    UFDRJobSubmission,
    StorySummary,
    EntitySummary,
    GraphSummary,
    TimelineSummary,
    JobsSummary,
    PipelineOutputs,
    PipelineSummary,
)
from ai_generator.models.app_registry import (
    AppCategory,
    AppInfo,
    AppRegistry,
    get_app_registry,
)

# Routine generation models
from ai_generator.models.routine_config import RoutineGenerationConfig
from ai_generator.models.routine_pattern import (
    ActivityCategory,
    ActivityPriority,
    RoutineActivity,
    DailyRoutinePattern,
    WeeklyRoutinePattern,
)

__all__ = [
    # Phase 1
    "StoryExpansion",
    "Entity",
    "EntityCharacteristics",
    "Gender",
    "SocialGraph",
    "Relationship",
    "RelationshipType",
    "TimelineEvent",
    "EventCategory",
    # Phase 2 - Phone selection
    "DeviceType",
    "PhoneCandidate",
    "SelectedPhone",
    "PhoneSelectionRequest",
    "PhoneSelectionResponse",
    "PhoneSelectionConfirmation",
    # Phase 2 - Story planning
    "StoryPerspective",
    "PlannedStory",
    "EventStoryPlan",
    "StoryGenerationPlan",
    # Phase 2 - Story validation
    "ValidationStatus",
    "StoryPriority",
    "MissingStory",
    "EventValidation",
    "ValidationReport",
    # Phase 2 - Thread planning
    "EmailTimelineEntry",
    "EmailThreadPlan",
    "EmailThreadPlans",
    "ChatTimelineEntry",
    "ChatThreadPlan",
    "ChatThreadPlans",
    "SMSTimelineEntry",
    "SMSThreadPlan",
    "SMSThreadPlans",
    # Story models from model library
    "StoryData",
    "CallStoryData",
    "InstantMessageStoryData",
    "EmailStoryData",
    "ChatMessageStoryData",
    "ChatStoryData",
    "LocationStoryData",
    "RouteStoryData",
    "ImageStoryData",
    "VideoStoryData",
    "AudioStoryData",
    "DocumentStoryData",
    "WebHistoryStoryData",
    "WebBookmarkStoryData",
    "CookieStoryData",
    "ContactStoryData",
    "AppStoryData",
    "PoweringEventStoryData",
    "get_story_data_class",
    "StoryType",
    "Coordinate",
    "StoryFileInfo",
    # Phase 2 - Story mapping
    "PhoneStoryMapping",
    "PhoneStoryMappingPhone",
    "JobGenerationResult",
    "UFDRJobSubmission",
    # Pipeline summary models
    "StorySummary",
    "EntitySummary",
    "GraphSummary",
    "TimelineSummary",
    "JobsSummary",
    "PipelineOutputs",
    "PipelineSummary",
    # Phase 2 - App registry
    "AppCategory",
    "AppInfo",
    "AppRegistry",
    "get_app_registry",
    # Routine generation models
    "RoutineGenerationConfig",
    "ActivityCategory",
    "ActivityPriority",
    "RoutineActivity",
    "DailyRoutinePattern",
    "WeeklyRoutinePattern",
]

