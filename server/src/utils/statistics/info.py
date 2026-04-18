from datetime import timedelta
from pathlib import Path
from typing import Callable, Type, Optional, List, Iterable, Literal, ClassVar, Dict

from pydantic import BaseModel, validator, Field
from xsdata.utils.text import pascal_case

from model_types import ModelType


def _to_pascal(field_name: str) -> str:
    if field_name.startswith("num_"):  # if field starts with "num_" use the suffix as the alias
        field_name = field_name[4:]
    return pascal_case(field_name)


def _validate_len(field: str):
    return validator(field, pre=True, always=True, allow_reuse=True)(
        lambda values: len(values) if isinstance(values, Iterable) else values
    )


class SourceExtractionInfo(BaseModel):
    device_name: str
    full_name_md5: str


class BaseInfoModel(BaseModel):
    uid: str
    deleted: Optional[str]

    class Config:
        allow_population_by_field_name = True
        alias_generator = _to_pascal


class FileInfo(BaseInfoModel):
    category: Optional[str] = Field(alias="Tags", default=None)
    size: Optional[int] = None
    md5: Optional[str] = Field(alias="Md5", default=None)
    suffix: Optional[str]
    fs_dirpath: Path


class AudioVideoFileInfo(FileInfo):
    duration: Optional[float] = None


class ModelInfo(BaseInfoModel):
    model_type: str  # Overridden by custom implemented info subclasses, only used by dynamically created subclasses


_model_info_classes = {}


def register_info(model_type: str) -> Callable:
    def _register(model_info_class: Type[ModelInfo]) -> Type[ModelInfo]:
        if model_type in _model_info_classes:
            raise Exception(
                f'Model type "{model_type}" is already registered to class {_model_info_classes[model_type]}'
            )
        _model_info_classes[model_type] = model_info_class
        return model_info_class

    return _register


def get_model_info(model_type: str) -> Type[ModelInfo]:
    model_info_class = _model_info_classes.get(model_type)
    if model_info_class is None:
        print(f'No info class is registered to model type "{model_type}"')
        model_info_class = type(f"{model_type}Info", (ModelInfo,), {})  # Dynamically create empty ModelInfo subclass
        _model_info_classes[model_type] = model_info_class
    return model_info_class


class PartyInfo(BaseInfoModel):
    _identifiers: ClassVar[Dict[str, int]] = {}  # Lookup from Identifier value to unique integer ID

    identifier: Optional[int] = None  # Anonymized integer representation
    role: Optional[str] = None
    status: Optional[str] = None
    is_phone_owner: Optional[bool] = None

    # Party's "Identifier" field must be anonymized (e.g. phone number). Replace original with auto incremented integer.
    @validator("identifier", pre=True)
    def normalize_identifier(cls, identifier: str) -> Optional[int]:
        if not identifier:
            return None
        # Identifiers are not normalized (phone numbers, etc.) yet
        identifier_id = cls._identifiers.get(identifier)
        if identifier_id is None:
            identifier_id = cls._identifiers[identifier] = len(cls._identifiers)
        return identifier_id


@register_info(ModelType.CALL)
class CallInfo(ModelInfo):
    model_type: Literal[ModelType.CALL] = ModelType.CALL
    direction: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    duration: Optional[int] = None
    parties: Optional[List[PartyInfo]] = None
    video_call: Optional[bool] = None

    @validator("duration", pre=True)
    def validate_duration_float_format(cls, v):
        if isinstance(v, str):
            h, m, s = map(float, v.split(":"))
            return int(timedelta(hours=h, minutes=m, seconds=s).total_seconds())
        return v


class AttachmentInfo(BaseInfoModel):
    content_type: Optional[str] = None


class MessageInfo(BaseInfoModel):
    from_: Optional[PartyInfo] = Field(alias="From", default=None)
    to: Optional[List[PartyInfo]] = None
    len_body_chars: Optional[int] = Field(alias="Body", default=None)
    attachments: Optional[List[AttachmentInfo]] = None
    status: Optional[str] = None
    type: Optional[str] = None

    _len_body_chars = _validate_len("len_body_chars")


@register_info(ModelType.CHAT)
class ChatInfo(ModelInfo):
    model_type: Literal[ModelType.CHAT] = ModelType.CHAT
    participants: Optional[List[PartyInfo]] = None
    messages: Optional[List[MessageInfo]] = None


@register_info(ModelType.VISITED_PAGE)
class WebHistoryInfo(ModelInfo):
    model_type: Literal[ModelType.VISITED_PAGE] = ModelType.VISITED_PAGE
    visit_count: Optional[int] = None


class ContactEntryInfo(BaseInfoModel):
    pass


@register_info(ModelType.CONTACT)
class ContactInfo(ModelInfo):
    model_type: Literal[ModelType.CONTACT] = ModelType.CONTACT
    type: Optional[str] = None
    times_contacted: Optional[int] = None
    entries: Optional[List[ContactEntryInfo]] = None


@register_info(ModelType.EMAIL)
class EmailInfo(ModelInfo):
    model_type: Literal[ModelType.EMAIL] = ModelType.EMAIL
    status: Optional[str] = None
    from_: Optional[PartyInfo] = Field(alias="From", default=None)
    to: Optional[List[PartyInfo]] = None
    cc: Optional[List[PartyInfo]] = None
    bcc: Optional[List[PartyInfo]] = None
    len_body_chars: Optional[int] = Field(alias="Body", default=None)
    attachments: Optional[List[AttachmentInfo]] = None

    _len_body_chars = _validate_len("len_body_chars")
