from datetime import datetime
from typing import Any, Callable

from model.types import Entity
from model.utils import str_uuid
from generation.conversion.report import EmptyEventFieldValue, EventFieldValue, EventField, Event, EventModelField


EMPTY_VALUE = EmptyEventFieldValue()


def Field(name: str, type: str, value: Any | None = EMPTY_VALUE, func: Callable[[Any], str] = str):
    if value is None:
        value = EMPTY_VALUE
    elif value is not EMPTY_VALUE:
        value = EventFieldValue(value=str(func(value)), type=type)

    if value is EMPTY_VALUE:
        field = EventField(name=name, type=type, empty_value=EMPTY_VALUE)
    else:
        field = EventField(name=name, type=type, field_value=value)

    return field


def StrField(**kwargs):
    return Field(type="String", **kwargs)


def DoubleField(**kwargs):
    return Field(type="Double", **kwargs)


def TimeField(name="TimeStamp", **kwargs):
    return Field(name=name, type="TimeStamp", func=datetime.isoformat, **kwargs)


def Int32Field(**kwargs):
    return Field(type="Int32", **kwargs)


def formulate_entity_name(entity: Entity) -> str:
    return " ".join(name for name in [entity.first_name, entity.last_name] if name)


def create_coordinate_model_field(name: str, latitude: float, longitude: float) -> EventModelField:
    longitude = DoubleField(name="Longitude", value=longitude)
    latitude = DoubleField(name="Latitude", value=latitude)
    coordinate = Event(id=str_uuid(), type="Coordinate", fields=[longitude, latitude])
    coordinate_model_field = EventModelField(name=name, type="Coordinate", event=coordinate)
    return coordinate_model_field


def convert_coordinate_to_deg_min_sec(coord: float) -> tuple[int, int, int]:
    degree = int(coord)
    minute = int((coord - degree) * 60)
    second = int((((coord - degree) * 60) - minute) * 60)
    return degree, minute, second
