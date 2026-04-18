from pydantic import BaseModel, Field, field_validator, ValidationInfo, model_validator, ConfigDict
from pydantic.types import confloat

from core.config import SETTINGS
from core.s3_client import TitanS3Client
from model.job import ReportModelFieldType
from model.utils import str_uuid

s3_client = TitanS3Client()

def IdField(**kwargs):
	return Field(alias="id", **kwargs)


def validate_list(cls, v):
	if v and isinstance(v, str):
		if v == "[]":
			return []
		return [i.strip() for i in v[1:-1].split(",")]
	return v


def validate_dict(cls, v):
	if v and isinstance(v, str):
		if v == "{}":
			return {}
		return {i.split("=")[0].strip(): i.split("=")[1].strip() for i in v[1:-1].split(",")}
	return v


class MetafinderModel(BaseModel):
	id: str = Field(default_factory=str_uuid)
	
	model_config = ConfigDict(
		populate_by_name=True
	)
	

class AnalyticsModel(MetafinderModel):
	categories: list[str] = Field(default_factory=list)
	md5: str = IdField()
	
	_validate_categories = field_validator("categories", mode="before")(validate_list)


class FileModel(MetafinderModel):
	s3_key: str
	size: int = Field(default=0)
	format: str
	md5: str = IdField()
	presigned_url: str | None = Field(default=None, validate_default=True)
	
	@field_validator("presigned_url", mode="before")
	def validate_presigned_url(cls, presigned_url: str | None, validation_info: ValidationInfo):
		if presigned_url:
			return presigned_url
		values = validation_info.data
		if values.get('s3_key'):
			presigned_url = s3_client.get_download_presigned_url(
				bucket_name=SETTINGS.METAFINDER_S3_BUCKET_NAME,
				file_name=values['s3_key']
			)
			return presigned_url


class GeoLocation(BaseModel):
	lon: float
	lat: float


class ImageModel(FileModel, AnalyticsModel):
	
	s3_key: str
	width: int
	height: int
	format: str
	md5: str = IdField()
	categories: list[str] | None = Field(default=None)
	size: int = Field(default=0)


class VideoModel(FileModel, AnalyticsModel):
	
	s3_key: str
	format: str
	md5: str = IdField()
	categories: list[str] | None = Field(default=None)
	size: int = Field(default=0)
	duration: int = Field(default=0)


class AudioModel(FileModel, AnalyticsModel):
	
	s3_key: str
	format: str
	md5: str = IdField()
	categories: list[str] | None = Field(default=None)
	size: int = Field(default=0)
	duration: int = Field(default=0)
	
	


class DocumentModel(FileModel):
	
	s3_key: str
	format: str
	md5: str = IdField()
	size: int = Field(default=0)


class ChatModel(AnalyticsModel):
	
	text: str
	language: str


class TextModel(AnalyticsModel):
	
	text: str
	size: int


class AppModel(MetafinderModel):
	
	app_id: str = IdField()
	name: str | None
	os: str
	category: str | None = Field(default=None)
	event_types: list[str] | None = Field(default=None)
	icon: str | None = Field(default=None)
	
	_validate_event_types = field_validator("event_types", mode="before")(validate_list)
	
	@field_validator('category', mode='before')
	def _validate_category(cls, v):
		v = validate_list(cls, v)
		if isinstance(v, list):
			if v:
				return v[0]
			return None
		return v


class EntityModel(MetafinderModel):
	
	id: str = IdField()
	first_name: str
	last_name: str
	phone: str
	gender: str
	country: str
	ip_address: str
	email: str


class ReportModelField(MetafinderModel):
	version: str
	model_type: str
	field_type: ReportModelFieldType
	name: str
	value_type: str
	is_sub_field: bool
	multi_model_types: tuple[str, ...] | None = Field(default=None)
	values: list[str] | None = Field(default=None)
	
	_validate_values = field_validator('values', mode='before')(validate_list)
	
	@field_validator('multi_model_types', 'values', mode='before')
	def _validate_multi_model_types(cls, v):
		if not v:
			return None
		if isinstance(v, str):
			return [v]
		return v


class CellTowerModel(MetafinderModel):
	id: str = IdField()
	area: int
	range: int
	location: GeoLocation
	cell: int
	mcc: int
	radio: str
	net: int
	
	@field_validator("location", mode="before")
	def validate_location(cls, location):
		location = validate_dict(cls, location)
		if location:
			if isinstance(location, list):
				return GeoLocation(lon=location[0], lat=location[1])
			return location
		
	@model_validator(mode="before")
	def validate_model(cls, values):
		if not values.get("location"):
			lat = values.get("lat")
			lon = values.get("lon")
			if lat and lon:
				values["location"] = GeoLocation(lon=lon, lat=lat)
			else:
				raise ValueError("Either location or lat and lon must be provided.")
		return values


class UrlModel(AnalyticsModel):
	
	cctld: str | None = Field(default=None)
	url: str
	categories: str
	
	@field_validator('categories', mode='before')
	def _validate_categories(cls, v):
		if v and isinstance(v, list):
			return v[0]
		return v


class LocalizedNameModel(MetafinderModel):
	name: str
	is_surname: bool
	male_prob: confloat(ge=0.0, le=1.0)
	country_code: str
	alphabet: str
	id: str | None = IdField(validate_default=True)
	
	@field_validator('id', mode='before')
	def _validate_id(cls, v, validation_info: ValidationInfo):
		if v:
			return v
		values = validation_info.data
		return f'{values["name"]}|{values["is_surname"]}|{values["country_code"]}'


class CryptoModel(MetafinderModel):
	type: str
	coin: str
	value: str = IdField()
	language: str | None = Field(default=None)
