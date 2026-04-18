
from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import TYPE_CHECKING

from model.job import GenerationJob
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from model.stories import Stories
    from ai_generator.storage import SessionMetadata


class DeviceTypeEnum(StrEnum):
    IPHONE = "iphone"
    ANDROID = "android"
    GENERIC = "generic"


class PhoneStoryMappingPhone(BaseModel):
    entity_id: str
    entity_name: str
    device_type: DeviceTypeEnum = DeviceTypeEnum.GENERIC
    phone_number: str | None = None
    email: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class PhoneStoryMapping(BaseModel):
    
    phone: PhoneStoryMappingPhone
    stories: list["Stories"] = Field(
        default_factory=list,
        description="List of StoryData instances for this phone"
    )
    
    # Tracking for debugging and validation
    event_to_story_map: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Maps timeline_event_id to list of generated story UIDs"
    )
    
    referenced_entity_ids: list[str] = Field(
        default_factory=list,
        description="All entity IDs referenced in the stories"
    )
    
    # Statistics
    story_type_counts: dict[str, int] = Field(
        default_factory=dict,
        description="Count of each StoryType generated"
    )
    
    class Config:
        arbitrary_types_allowed = True


class UFDRJobSubmission(BaseModel):
    
    job_id: str
    phone_entity_name: str
    success: bool
    message: str | None = None
    error: str | None = None


class JobGenerationResult(BaseModel):
    
    session_id: str
    phone_mappings: list[PhoneStoryMapping] = Field(default_factory=list)
    generation_jobs: list[GenerationJob] = Field(
        default_factory=list,
        description="List of GenerationJob dicts ready for submission"
    )
    total_stories_generated: int = Field(default=0)
    total_jobs_created: int = Field(default=0)
    
    # UFDR submission results (added in Stage 9)
    ufdr_submissions: list[UFDRJobSubmission] = Field(
        default_factory=list,
        description="Results of UFDR job submissions"
    )
    all_jobs_submitted: bool = Field(
        default=False,
        description="True if all jobs were successfully submitted to UFDR"
    )
    
    class Config:
        arbitrary_types_allowed = True


# Pipeline summary models
class StorySummary(BaseModel):
    setting: str
    themes: list[str]
    narrative_length: int


class EntitySummary(BaseModel):
    count: int
    names: list[str] = Field(description="First 5 entity names")


class GraphSummary(BaseModel):
    relationships: int


class TimelineSummary(BaseModel):
    events: int


class JobsSummary(BaseModel):
    count: int
    stories: int


class PipelineOutputs(BaseModel):
    story: StorySummary | None = None
    entities: EntitySummary | None = None
    graph: GraphSummary | None = None
    timeline: TimelineSummary | None = None
    jobs: JobsSummary | None = None


class PipelineSummary(BaseModel):
    session_id: str
    metadata: "SessionMetadata"
    outputs: PipelineOutputs


# Rebuild models with forward references after all models are defined
def _rebuild_forward_refs():
    try:
        from model.stories import Stories  # noqa: F401
        PhoneStoryMapping.model_rebuild()
    except ImportError:
        # StoryData might not be available in all contexts
        pass


_rebuild_forward_refs()
