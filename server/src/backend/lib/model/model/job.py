import random
from datetime import date, tzinfo
from enum import StrEnum
from functools import cached_property
from typing import Literal, Union, Annotated

from dateutil.relativedelta import relativedelta
from networkx import DiGraph
from networkx.readwrite import json_graph
from pydantic import BaseModel, Field, field_validator, model_validator, field_serializer, ConfigDict
import pytz

from model.country_info import COUNTRY_INFOS, CountryInfo
from model.device_models import DeviceModel
from model.tasks import GenerationTaskUnion
from model.status import JobStatus
from model.types import Entity, DeviceInfoEntry, OwnerEntity
from model.utils import AbstractData, AutoUID


def validate_country_info(country_info) -> CountryInfo | None:
    if isinstance(country_info, str):
        return COUNTRY_INFOS[country_info]
    return country_info


class DeviceContext(BaseModel):

    device: DeviceModel
    start_date: date
    end_date: date
    country_info: CountryInfo | None = Field(default=None, validate_default=True)
    
    @field_serializer('start_date', 'end_date', return_type=str)
    def serialize_dt(self, dt: date, _info) -> str:
        return dt.isoformat()

    @model_validator(mode="before")
    def validate_dates(cls, values):
        if not values:
            return values
        start_date = values.get('start_date')
        end_date = values.get('end_date')
        if start_date is not None and end_date is not None:
            if end_date <= start_date:
                raise ValueError(f'end_date ({end_date}) must be later than start_date ({start_date})')
        elif start_date is None and end_date is None:
            values['start_date'] = date.today() - relativedelta(years=1)
            values['end_date'] = date.today()
        elif start_date is None:
            values['start_date'] = end_date - relativedelta(years=1)
        elif end_date is None:
            values['end_date'] = date.today() if start_date < date.today() else start_date + relativedelta(years=1)
        return values

    _validate_country_info = field_validator('country_info', mode="before")(validate_country_info)

    @cached_property
    def timezone(self) -> tzinfo | None:
        if self.country_info is not None:
            return pytz.timezone(random.choice(list(self.country_info.timezones)))
        return None

    @cached_property
    def languages(self) -> list[str] | None:
        if self.country_info is not None:
            return list(self.country_info.languages)
        return None


class ReportModelFieldType(StrEnum):
    FIELD = 'field'
    MULTI_FIELD = 'multiField'
    MODEL_FIELD = 'modelField'
    MULTI_MODEL_FIELD = 'multiModelField'


class BaseCustomEventFieldValue(AbstractData):
    value_type: str


class CustomEventFieldValue(BaseCustomEventFieldValue):
    field_type: Literal[ReportModelFieldType.FIELD]
    value: str | None = None


class CustomEventMultiFieldValue(BaseCustomEventFieldValue):
    field_type: Literal[ReportModelFieldType.MULTI_FIELD]
    value: list[str] = Field(default_factory=list)


class CustomEventModelFieldValue(BaseCustomEventFieldValue):
    field_type: Literal[ReportModelFieldType.MODEL_FIELD]
    fields: dict[str, 'CustomEventFieldValues'] = Field(default_factory=dict)


class CustomEventMultiModelFieldValue(BaseCustomEventFieldValue):
    field_type: Literal[ReportModelFieldType.MULTI_MODEL_FIELD]
    models: list[CustomEventModelFieldValue] = Field(default_factory=list)


CustomEventFieldValues = Annotated[
    Union[tuple(BaseCustomEventFieldValue.__subclasses__())],
    Field(discriminator='field_type')
]

CustomEventModelFieldValue.model_rebuild()


class CustomEvent(BaseModel):
    event_id: AutoUID
    model_type: str
    fields: dict[str, CustomEventFieldValues]


class GenerationJob(BaseModel):

    job_id: str
    name: str
    status: JobStatus
    tasks: list[GenerationTaskUnion]
    context: DeviceContext
    device_info: list[DeviceInfoEntry]
    custom_events: list[CustomEvent]
    stories: DiGraph
    owner_entity: OwnerEntity
    entities: list[Entity]

    model_config = ConfigDict(arbitrary_types_allowed=True)

    @field_serializer('stories')
    def serialize_story_graph(self, value: DiGraph) -> dict:
        return json_graph.node_link_data(value)
