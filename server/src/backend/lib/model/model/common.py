from datetime import datetime
import re

from pydantic import BaseModel, field_validator

from model.job import GenerationJob
from model.status import JobStatus
from model.tasks import ValidationResult

# Email regex for @cellebrite.com emails - allows letters, dots, and hyphens in the local part
_email_regex = re.compile(r'^[a-zA-Z][a-zA-Z._-]*[a-zA-Z]@cellebrite\.com$')


class JobSummary(BaseModel):
	"""Simplified job model for list views - contains only essential fields."""
	id: str
	name: str
	status: JobStatus
	timestamp: datetime | None = None
	user: str


class CreateDraftJobRequest(BaseModel):
	"""Request model for creating a new draft job."""
	user: str
	name: str | None = None

	@field_validator('user')
	def validate_email(cls, value: str):
		if not _email_regex.fullmatch(value):
			raise ValueError('Invalid email address')
		return value


class CreateDraftJobResponse(BaseModel):
	"""Response model for draft job creation operations."""
	job_id: str
	name: str


class DraftJobOperationResponse(BaseModel):
	"""Response model for draft job operations. Holds either a job and/or validation result."""
	job: GenerationJob | None = None
	validation: ValidationResult | None = None      # validation of the (task) operation
