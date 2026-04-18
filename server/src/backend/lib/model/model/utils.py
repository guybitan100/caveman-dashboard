from abc import ABC
from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import uuid4

from pydantic import BaseModel, Field, TypeAdapter
from pydantic.functional_validators import BeforeValidator
from pydantic_core.core_schema import ValidationInfo


class AbstractData(ABC, BaseModel):
    def model_dump_json(self, exclude_none=True, **kwargs):
        return super().model_dump_json(exclude_none=exclude_none, **kwargs)

    def model_dump(self, exclude_none=True, **kwargs):
        return super().model_dump(exclude_none=exclude_none, **kwargs)


def str_uuid() -> str:
    return str(uuid4())


def ignore_and_generate_uid(value, info: ValidationInfo):
    """Generate a new UUID string unless the value is being loaded from the database"""
    ctx = info.context
    if ctx and ctx.get('source') == 'db':
        return value    # ID from DB
    return str_uuid()   # new ID


# AutoUID is a string field that automatically generates a UUID if not provided
AutoUID = Annotated[
    str,
    BeforeValidator(ignore_and_generate_uid),
    Field(default_factory=str_uuid)
]


def deserialize[T: BaseModel, U: Any](data: dict[str, Any], model: type[T] | TypeAdapter[U]) -> T | U:
    """Deserialize a dictionary into a Pydantic model using either a model class or TypeAdapter"""
    context = {'source': 'db'}
    if isinstance(model, TypeAdapter):
        return model.validate_python(data, context=context)
    elif issubclass(model, BaseModel):
        return model.model_validate(data, context=context)
    else:
        raise TypeError('model must be a Pydantic BaseModel subclass or TypeAdapter')


def now() -> datetime:
    """Get the current UTC datetime"""
    return datetime.now(tz=timezone.utc)    #TODO why UTC?
