from __future__ import annotations

from datetime import datetime
from typing import Literal, TypedDict, Union

from pydantic import BaseModel, Field, model_validator

from model.stories import ChatStoryData
from model.types import Entity
	

class UploadedData(BaseModel):
	pass


class UploadedEntityParams(Entity):
	
	@model_validator(mode="before")
	def check_entity(cls, values):
		first_name = values.get('first_name')
		last_name = values.get('last_name')
		if not first_name and not last_name:
			raise ValueError('first_name or last_name must be provided')
		return values
	

class UploadedMessage(UploadedData):
	sender_id: str # this will not be the entity_id, but the full name of the sender
	text: str
	time: datetime
	status: Literal['Sent', 'Read'] = Field(default='Read')
	forwarded: bool = Field(default=False)


class UploadedChatStory(UploadedData):
	participants: list[UploadedEntityParams]
	messages: list[UploadedMessage]


class UploadedStoryResult(BaseModel):
	entities: list[Entity]
	story: Union[ChatStoryData] = Field(discriminator='story_type')
	

class UploadedFilePresignedUrl(TypedDict):
	url: str
	fields: dict[str, str]
	