from datetime import datetime
import re

from pydantic import BaseModel, field_validator

from model.job import GenerationJob
from model.status import JobStatus
from model.tasks import ValidationResult

# Email regex for @cellebrite.com emails - allows letters, dots, and hyphens in the local part
_email_regex = re.compile(r'^[a-zA-Z][a-zA-Z._-]*[a-zA-Z]@cellebrite\.com$')


class JobSummary(BaseModel):
	id: str
	name: str
	status: JobStatus
	timestamp: datetime | None = None
	user: str


class CreateDraftJobRequest(BaseModel):
	user: str
	name: str | None = None

	@field_validator('user')
	def validate_email(cls, value: str):
		if not _email_regex.fullmatch(value):
			raise ValueError('Invalid email address')
		return value


class CreateDraftJobResponse(BaseModel):
	job_id: str
	name: str


class DraftJobOperationResponse(BaseModel):
	job: GenerationJob | None = None
	validation: ValidationResult | None = None      # validation of the (task) operation
