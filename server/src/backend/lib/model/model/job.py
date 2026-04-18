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
    """
    context of the extraction's device.

    Will be added to the report.xml at the conversion phase.

    Events timestamp will be randomly distributed between start_date and end_date

    Attributes:
        device:         The device model.
        start_date:     Timestamp of the start of the extraction.
        end_date:       Timestamp of the end of the extraction.
        country_info:   Country info of device. If this is a string,
    """

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
        """Retrieves a random tzinfo object from the timezone list of the country (if provided)"""
        if self.country_info is not None:
            return pytz.timezone(random.choice(list(self.country_info.timezones)))
        return None

    @cached_property
    def languages(self) -> list[str] | None:
        """Retrieves languages codes corresponding to the country (if provided)"""
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
    """
    Custom event to be added to the report.xml at the conversion phase.

    Attributes:
        event_id:   Auto-generated event id.
        model_type: The event's report.xml model type.
        fields:     The custom event fields.
    """
    event_id: AutoUID
    model_type: str
    fields: dict[str, CustomEventFieldValues]


class GenerationJob(BaseModel):
    """
    Represents a generation job.

    Attributes:
        job_id:         The job id.
        name:           The job name.
        status:         The current job status.
        tasks:          List of tasks to be passed to the generation phase.
        context:        The device context for this job.
        device_info:    List of device info entries to be passed to the conversion phase.
        custom_events:  List of custom report.xml object to be passed to the conversion phase.
        stories:        Serialized graph of story data events.
        owner_entity:   Device owner entity
        entities:       List of additional entities to add to the device's social context
    """

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
