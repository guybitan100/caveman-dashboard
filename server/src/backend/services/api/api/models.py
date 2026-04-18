from pydantic import BaseModel, Field, field_validator

from model.common import JobSummary
from model.country_info import CountryInfo
from model.job import validate_country_info
from model.status import GenerationTaskStatus


class JobsListResponse(BaseModel):
    jobs: list[JobSummary]
    total: int


class TaskProgressResponse(BaseModel):
    task_id: str
    status: GenerationTaskStatus
    progress: float = Field(ge=0.0, le=1.0)


class GenerateEntityRequest(BaseModel):
    country_info: CountryInfo | None = Field(default=None, validate_default=True)
    count: int

    _validate_country_info = field_validator('country_info', mode="before")(validate_country_info)
