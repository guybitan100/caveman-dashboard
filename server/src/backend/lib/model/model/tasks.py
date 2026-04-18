import inspect
from abc import ABC
from datetime import datetime
from enum import StrEnum
from typing import Any, Callable, Literal, Annotated, Union, Iterator

from pydantic import BaseModel, Field, field_validator, model_validator, ValidationInfo, ConfigDict, BeforeValidator, \
    TypeAdapter
from pydantic.types import NonNegativeInt, PositiveInt, Discriminator, Tag

from model.status import ValidationStatus
from model.types import EventType, FILE_EVENT_TYPES
from model.utils import AbstractData, AutoUID

_MAX_ENTITIES = 100_000


def Param(
        *args,
        is_param: bool = False,
        json_schema_extra: dict[str, Any] | None = None,
        **kwargs
):
    json_schema_extra = json_schema_extra or {}
    json_schema_extra['_is_param'] = is_param
    return Field(*args, json_schema_extra=json_schema_extra, **kwargs)


def _handle_null_type_json_schema(property_schema: dict[str, Any]) -> dict[str, Any]:
    type_options = property_schema.get("anyOf")
    if type_options and len(type_options) == 2 and {"type": "null"} in type_options:
        if property_schema.get("ui", {}).get("widget") == "hidden":
            property_schema["type"] = "null"
        else:
            type_options.remove({"type": "null"})
            for k, v in type_options[0].items():
                property_schema[k] = v
        property_schema["nullable"] = True
        property_schema.pop("anyOf")
    return property_schema


def generation_task_schema_extra(schema: dict[str, Any], task_class: type['GenerationTask']) -> None:
    if hasattr(task_class, 'event_type'):
        for prop_name, prop_schema in schema["properties"].items():
            schema["properties"][prop_name] = _handle_null_type_json_schema(prop_schema)

        # Capitalize event name for GUI display
        schema["title"] = task_class.event_type.value.title()

        # Make quantity property required, except for ChatTask
        if task_class.event_type not in {EventType.CHAT, EventType.INSTANT_MESSAGE}:
            required = schema.get("required", [])
            required.append("quantity")
            schema["required"] = list(set(required))
        # Set quantity property title
        schema["properties"]["quantity"]["title"] = (
            f"Number of {task_class.event_type.value} "
            f'{"files" if task_class.event_type in FILE_EVENT_TYPES else "events"}'
        )
        # Remove class docstring description
        schema.pop("description", None)
        # Set empty descriptions (e.g., to remove auto-set "An enumeration" for enum params) unless explicitly set
        for param in schema["properties"].values():
            param.setdefault("description", "")


def _ignore_and_use_db_value(value, info: ValidationInfo):
    ctx = info.context
    if ctx and ctx.get('source') == 'db':
        return value    # ID from DB
    return None


RefID = Annotated[
    str | None,
    BeforeValidator(_ignore_and_use_db_value),
    Field(default=None, validate_default=True)
]


class GenerationTask(ABC, BaseModel):

    task_id: AutoUID
    parent_task_id: RefID
    root_task_id: RefID
    event_type: EventType
    quantity: PositiveInt

    model_config = ConfigDict(
        json_schema_extra=generation_task_schema_extra
    )

    @property
    def is_sub_task(self) -> bool:
        return self.parent_task_id is not None

    def get_sub_tasks(self) -> Iterator['GenerationTask']:
        for field_name, field_info in self.model_fields.items():
            field_value = getattr(self, field_name)
            if isinstance(field_value, GenerationTask):
                yield field_value
            elif isinstance(field_value, (list, tuple, set, frozenset)):
                for item in field_value:
                    if isinstance(item, GenerationTask):
                        yield item

    def flatten_tasks(self) -> Iterator['GenerationTask']:
        yield self
        for sub_task in self.get_sub_tasks():
            yield from sub_task.flatten_tasks()

    @classmethod
    def get_param_fields(cls) -> set[str]:
        return {
            field_name
            for field_name, field_info in cls.model_fields.items()
            if (field_info.json_schema_extra or {}).get('_is_param')
        }


class CryptoEnrichmentParams(AbstractData):
    add_crypto_artifacts: bool = Field(default=False, title='Add crypto artifacts')
    crypto_prob: float = Field(default=0.02, json_schema_extra={"ui": {"widget": "hidden"}})


class EventTask(GenerationTask, ABC):

    app_id: str | None = Field(default=None, json_schema_extra={"nullable": True, "ui": {"widget": "appId"}})


class FileTask(GenerationTask, ABC):

    is_upload: bool


class GeneratedFileTask(FileTask, ABC):

    is_upload: Literal[False] = False


class UploadedFileTask(FileTask, ABC):

    is_upload: Literal[True] = True
    quantity: Literal[1] = 1
    file_name: str
    md5: str
    file_size: int


def _validate_max_ge_min(min_field_name: str, max_field_name: str) -> Callable:
    @field_validator(max_field_name)
    def validate_max_ge_min(max_value: int, validation_info: ValidationInfo):
        min_value = validation_info.data[min_field_name]
        if max_value is not None and min_value is not None:
            assert max_value >= min_value
        return max_value

    return validate_max_ge_min


class AudioTask(GeneratedFileTask):

    event_type: Literal[EventType.AUDIO] = EventType.AUDIO
    min_duration: NonNegativeInt | None = Field(title='Minimum duration (in seconds)', default=None)
    max_duration: NonNegativeInt | None = Field(title='Maximum duration (in seconds)', default=None)
    formats: list[str] = Field(title='Audio format', default_factory=list,
                               json_schema_extra={"metafinder_key": 'format'})
    categories: list[str] = Field(title='Media analytics categories', default_factory=list,
                                  json_schema_extra={"metafinder_key": 'categories'})
    is_categories_and_op: bool = Field(default=False, json_schema_extra={"operator": True})

    _validate_max_duration = _validate_max_ge_min(min_field_name="min_duration", max_field_name="max_duration")


class ImageTask(GeneratedFileTask):

    event_type: Literal[EventType.IMAGE] = EventType.IMAGE
    min_width: NonNegativeInt | None = Field(title='Minimum width', default=None)
    max_width: NonNegativeInt | None = Field(title='Maximum width', default=None)
    min_height: NonNegativeInt | None = Field(title='Minimum height', default=None)
    max_height: NonNegativeInt | None = Field(title='Maximum height', default=None)
    formats: list[str] = Field(title='Image format', default_factory=list,
                               json_schema_extra={"metafinder_key": 'format'})
    categories: list[str] = Field(title='Media analytics categories', default_factory=list,
                                  json_schema_extra={"metafinder_key": 'categories'})
    is_categories_and_op: bool = Field(default=False, json_schema_extra={"operator": True})

    _validate_max_width = _validate_max_ge_min(min_field_name="min_width", max_field_name="max_width")
    _validate_max_height = _validate_max_ge_min(min_field_name="min_height", max_field_name="max_height")


class DocumentFormat(StrEnum):
    PDF = "pdf"
    DOCX = "docx"
    DOC = "doc"
    TXT = "txt"
    TEXT = "text"
    XLSX = "xlsx"
    XLS = "xls"
    PPTX = "pptx"
    PPT = "ppt"


class DocumentTask(GeneratedFileTask):

    event_type: Literal[EventType.DOCUMENT] = EventType.DOCUMENT
    min_size: NonNegativeInt | None = Field(title='Minimum size (KB)', default=None)
    max_size: NonNegativeInt | None = Field(title='Maximum size (KB)', default=None)
    formats: list[DocumentFormat] = Field(title='Document format', default_factory=list,
                                          json_schema_extra={"metafinder_key": 'format'})

    _validate_max_size = _validate_max_ge_min(min_field_name="min_size", max_field_name="max_size")


class VideoTask(GeneratedFileTask):

    event_type: Literal[EventType.VIDEO] = EventType.VIDEO
    min_duration: NonNegativeInt | None = Field(title='Minimum duration (in seconds)', default=None)
    max_duration: NonNegativeInt | None = Field(title='Maximum duration (in seconds)', default=None)
    formats: list[str] = Field(title='Video format', default_factory=list,
                               json_schema_extra={"metafinder_key": 'format'})
    categories: list[str] = Field(title='Media analytics categories', default_factory=list,
                                  json_schema_extra={"metafinder_key": 'categories'})
    is_categories_and_op: bool = Field(default=False, json_schema_extra={"operator": True})

    _validate_max_duration = _validate_max_ge_min(min_field_name="min_duration", max_field_name="max_duration")


class ArchiveTask(GeneratedFileTask):
    event_type: Literal[EventType.ARCHIVE] = EventType.ARCHIVE


class InstalledAppTask(EventTask):
    event_type: Literal[EventType.APP] = EventType.APP
    app_id: str | None = Field(default=None, json_schema_extra={"ui": {"widget": "hidden"}})


class LocationTask(EventTask):

    event_type: Literal[EventType.LOCATION] = EventType.LOCATION
    latitude: float | None = Field(ge=-90, le=90, title="Central latitude", default=None)
    longitude: float | None = Field(ge=-180, le=180, title="Central longitude", default=None)
    radius: NonNegativeInt = Field(default=20, title="Radius of locations around center")
    category: str | None = Field(default=None, title='Location category')


class ContactTask(EventTask):
    
    event_type: Literal[EventType.CONTACT] = EventType.CONTACT
    min_phone_numbers: NonNegativeInt = Field(default=1, title="Minimum phone numbers per contact")
    max_phone_numbers: NonNegativeInt = Field(default=2, title="Maximum phone numbers per contact")
    min_email_addresses: NonNegativeInt = Field(default=1, title="Minimum email addresses per contact")
    max_email_addresses: NonNegativeInt = Field(default=2, title="Maximum email addresses per contact")

    _validate_max_phones = _validate_max_ge_min(min_field_name="min_phone_numbers", max_field_name="max_phone_numbers")
    _validate_max_emails = _validate_max_ge_min(min_field_name="min_email_addresses",
                                                max_field_name="max_email_addresses")


class CallTask(EventTask):

    event_type: Literal[EventType.CALL] = EventType.CALL
    min_duration_sec: int | None = Field(title="Minimum duration (in seconds) per call", ge=0, lt=86400, default=None)
    max_duration_sec: int | None = Field(title="Maximum duration (in seconds) per call", ge=0, lt=86400, default=None)

    _validate_max_duration = _validate_max_ge_min(min_field_name="min_duration_sec", max_field_name="max_duration_sec")


class ChatTask(EventTask, CryptoEnrichmentParams):

    event_type: Literal[EventType.CHAT] = EventType.CHAT
    quantity: NonNegativeInt  # Added to allow the user to specify 0 for messages quantity
    voice_messages_quantity: NonNegativeInt  = Field(default=0, title='Number of voice messages')
    voice_messages_task: AudioTask | None = Field(default=None, json_schema_extra={"ui": {"widget": "hidden"}})
    num_chats: PositiveInt | None = Field(title='Number of chat threads', default=None)
    min_num_other_participants: PositiveInt = Field(default=1,
                                                    title='Min. participants per chat thread (excluding device owner)')
    max_num_other_participants: int = Field(default=100, gt=0, le=_MAX_ENTITIES,
                                            title='Max. participants per chat thread (excluding device owner)')
    languages: list[str] = Field(default_factory=list, title='Messages language',json_schema_extra={"metafinder_key": 'language'})
    categories: list[str] = Field(default_factory=list, title='Message analytics topics', json_schema_extra={"metafinder_key": 'categories'})
    is_categories_and_op: bool = Field(default=False, json_schema_extra={"operator": True})
    attachments: list['_ChatAttachmentTask'] = Field(default_factory=list, title='Attachments', validate_default=True,
                                                     json_schema_extra={"event_types": FILE_EVENT_TYPES | {EventType.CONTACT, EventType.LOCATION}})
                                    

    _validate_max_participants = _validate_max_ge_min(min_field_name='min_num_other_participants',
                                                      max_field_name='max_num_other_participants')

    @field_validator('voice_messages_task', mode="before")
    @classmethod
    def validate_voice_messages_task(cls, value, validation_info: ValidationInfo):
        if isinstance(value, (dict, AudioTask)):
            return value
        voice_messages_quantity = validation_info.data.get('voice_messages_quantity')
        if voice_messages_quantity:
            return AudioTask(quantity=voice_messages_quantity)
        return None

    @model_validator(mode="before")
    @classmethod
    def validate_quantity(cls, values: dict):
        quantity = values.get('quantity')
        voice_messages_quantity = values.get('voice_messages_quantity')
        if not quantity and not voice_messages_quantity:
            raise ValueError('At least one of quantity or voice_messages_quantity must be set')
        return values


class CarvedStringTask(EventTask, CryptoEnrichmentParams):

    event_type: Literal[EventType.CARVED_STRING] = EventType.CARVED_STRING
    min_words: PositiveInt = Field(default=10, title="Minimum string length in words")
    max_words: PositiveInt = Field(default=20, title="Maximum string length in words")

    _validate_max_words = _validate_max_ge_min(min_field_name="min_words", max_field_name="max_words")


class CookieTask(EventTask):

    event_type: Literal[EventType.COOKIE] = EventType.COOKIE
    min_name_len: NonNegativeInt = Field(default=3, title="Minimum name length in characters")
    max_name_len: NonNegativeInt = Field(default=7, title="Maximum name length in characters")
    min_value_len: NonNegativeInt = Field(default=4, title="Minimum value length in characters")
    max_value_len: NonNegativeInt = Field(default=10, title="Minimum value length in characters")

    _validate_name_lens = _validate_max_ge_min(min_field_name="min_name_len", max_field_name="max_name_len")
    _validate_value_lens = _validate_max_ge_min(min_field_name="min_value_len", max_field_name="max_value_len")


class JourneyTask(EventTask):

    event_type: Literal[EventType.JOURNEY] = EventType.JOURNEY
    start_time: datetime | None = Field(title="Start time", default=None)
    end_time: datetime | None = Field(title="End time", default=None)
    radius: NonNegativeInt = Field(default=20, title="Radius of journey")

    _validate_times = _validate_max_ge_min(min_field_name="start_time", max_field_name="end_time")


class NoteTask(EventTask, CryptoEnrichmentParams):

    event_type: Literal[EventType.NOTE] = EventType.NOTE
    max_words: PositiveInt = Field(default=20, title="Maximum note length in words")
    languages: list[str] = Field(default_factory=list, title='Note language', json_schema_extra={"metafinder_key": 'language'})
    categories: list[str] = Field(default_factory=list, title='Note text analytics topics', json_schema_extra={"metafinder_key": 'categories'})
    is_categories_and_op: bool = Field(default=False, json_schema_extra={"operator": True})


class NotificationTask(EventTask):

    event_type: Literal[EventType.NOTIFICATION] = EventType.NOTIFICATION
    min_words: PositiveInt = Field(default=10, title="Minimum notification length in words")
    max_words: PositiveInt = Field(default=20, title="Maximum notification length in words")

    _validate_max_words = _validate_max_ge_min(min_field_name="min_words", max_field_name="max_words")


class WebBookmarkTask(EventTask):

    event_type: Literal[EventType.WEB_BOOKMARK] = EventType.WEB_BOOKMARK
    min_visit_counts: NonNegativeInt = Field(default=1, title="Minimum visit counts")
    max_visit_counts: NonNegativeInt = Field(default=50, title="Maximum visit counts")
    min_folder_dirs: NonNegativeInt = Field(default=1, title="Minimum folders")
    max_folder_dirs: NonNegativeInt = Field(default=1, title="Maximum folders")
    categories: list[str] = Field(default_factory=list, title='URL category', json_schema_extra={"metafinder_key": 'categories'})
    is_categories_and_op: bool = Field(default=False, json_schema_extra={"operator": True})

    _validate_max_visits = _validate_max_ge_min(min_field_name="min_visit_counts", max_field_name="max_visit_counts")
    _validate_max_folders = _validate_max_ge_min(min_field_name="min_folder_dirs", max_field_name="max_folder_dirs")


class VisitedPageTask(EventTask):

    event_type: Literal[EventType.WEB_HISTORY] = EventType.WEB_HISTORY
    min_visit_counts: NonNegativeInt = Field(default=1, title="Minimum visit counts")
    max_visit_counts: NonNegativeInt = Field(default=50, title="Maximum visit counts")
    categories: list[str] = Field(default_factory=list, title='URL category', json_schema_extra={"metafinder_key": 'categories'})
    is_categories_and_op: bool = Field(default=False, json_schema_extra={"operator": True})

    _validate_max_visits = _validate_max_ge_min(min_field_name="min_visit_counts", max_field_name="max_visit_counts")


class EmailTask(EventTask, CryptoEnrichmentParams):

    event_type: Literal[EventType.EMAIL] = EventType.EMAIL
    min_recipients: PositiveInt = Field(default=1, title="Minimum recipients per email")
    max_recipients: int = Field(default=10, gt=0, le=_MAX_ENTITIES, title="Maximum recipients per email")
    min_characters: NonNegativeInt = Field(default=100, title="Minimum length of each email body in characters")
    max_characters: NonNegativeInt = Field(default=300, title="Maximum length of each email body in characters")
    max_folder_amount: PositiveInt = Field(default=5, title="Maximum number of email folders")
    attachments: list['_FileTaskUnion'] = Field(default_factory=list, title='Attachments',
                                                json_schema_extra={"event_types": FILE_EVENT_TYPES})

    _validate_max_recipients = _validate_max_ge_min(min_field_name='min_recipients', max_field_name='max_recipients')
    _validate_max_sentences = _validate_max_ge_min(min_field_name='min_characters', max_field_name='max_characters')


class InstantMessageTask(ChatTask):

    event_type: Literal[EventType.INSTANT_MESSAGE] = EventType.INSTANT_MESSAGE
    min_num_other_participants: Literal[1] = Field(default=1, json_schema_extra={"readOnly": True},
                                                   title='Min. participants per chat thread (excluding device owner)')
    max_num_other_participants: Literal[1] = Field(default=1, json_schema_extra={"readOnly": True},
                                                   title='Max. participants per chat thread (excluding device owner)')


class CalendarEntryTask(EventTask):

    event_type: Literal[EventType.CALENDAR_ENTRY] = EventType.CALENDAR_ENTRY
    events_categories: list[str] = Field(default=['Holidays', 'Work', 'Family'],
                                         title='Calender event`s categories pool')
    max_subject_words: NonNegativeInt = Field(default=4, title='Max. words count for event subject')
    max_details_sentences: NonNegativeInt = Field(default=5, title='Max. sentences count for event details')
    max_reminders: NonNegativeInt = Field(default=5, title='Max. reminders per calendar entry')
    max_attendees: int = Field(default=10, ge=0, le=_MAX_ENTITIES, title='Max. attendees per calendar entry')
    attachments: list['_FileTaskUnion'] = Field(default_factory=list, title='Attachments',
                                                json_schema_extra={"event_types": FILE_EVENT_TYPES})
    languages: list[str] = Field(default_factory=list, title='Calendar language', json_schema_extra={"metafinder_key": 'language'})
    categories: list[str] = Field(default_factory=list, title='Calendar text analytics topics', json_schema_extra={"metafinder_key": 'categories'})
    is_categories_and_op: bool = Field(default=False, json_schema_extra={"operator": True})


class CellTowerTask(EventTask):

    event_type: Literal[EventType.CELL_TOWER] = EventType.CELL_TOWER
    latitude: float | None = Field(default=None, ge=-90, le=90, title="Central latitude")
    longitude: float | None = Field(default=None, ge=-180, le=180, title="Central longitude")


class CreditCardTask(EventTask):
    event_type: Literal[EventType.CREDIT_CARD] = EventType.CREDIT_CARD


class PasswordTask(EventTask, CryptoEnrichmentParams):
    event_type: Literal[EventType.PASSWORD] = EventType.PASSWORD


class PoweringEventTask(EventTask):
    event_type: Literal[EventType.POWERING_EVENT] = EventType.POWERING_EVENT


class RecognizedDeviceTask(EventTask):
    event_type: Literal[EventType.RECOGNIZED_DEVICE] = EventType.RECOGNIZED_DEVICE


class UserAccountTask(EventTask):
    event_type: Literal[EventType.USER_ACCOUNT] = EventType.USER_ACCOUNT


class FinancialAccountTask(EventTask):

    event_type: Literal[EventType.FINANCIAL_ACCOUNT] = EventType.FINANCIAL_ACCOUNT
    min_account_assets: NonNegativeInt = Field(default=0, title='Minimum account assets')
    max_account_assets: NonNegativeInt = Field(default=10, title='Maximum account assets')


class ValidationResult(BaseModel):
    status: ValidationStatus
    count: int


GenerationTask.model_rebuild()


def _gather_draft_task_subclasses(clazz: type[GenerationTask]) -> Iterator[type[GenerationTask]]:
    for sub_clazz in clazz.__subclasses__():
        if not inspect.isabstract(sub_clazz):
            yield sub_clazz
        yield from _gather_draft_task_subclasses(sub_clazz)


_EventTaskUnion = Annotated[
    Union[tuple(_gather_draft_task_subclasses(EventTask))],
    Field(discriminator='event_type')
]
_GeneratedFileTaskUnion = Annotated[
    Union[tuple(_gather_draft_task_subclasses(GeneratedFileTask))],
    Field(discriminator='event_type')
]
_FileTaskUnion = Annotated[
    Union[_GeneratedFileTaskUnion, UploadedFileTask],
    Field(discriminator='is_upload')
]


def _discriminate_task_type(data: dict | BaseModel) -> str:
    if isinstance(data, EventTask):
        return 'event'
    elif isinstance(data, FileTask):
        if isinstance(data, GeneratedFileTask):
            return 'file'
        elif isinstance(data, UploadedFileTask):
            return 'upload'
    elif isinstance(data, dict):
        if 'is_upload' in data:
            if data['is_upload']:
                return 'upload'
            else:
                return 'file'
        elif 'event_type' in data:
            event_type = data["event_type"]
            if isinstance(event_type, str):
                event_type = EventType(event_type)
            if event_type in FILE_EVENT_TYPES:
                return "file"
            return "event"
    raise ValueError('Cannot discriminate task type')


_ChatAttachmentTask = Annotated[
    Annotated[ContactTask | LocationTask, Tag('event')] |
    Annotated[_GeneratedFileTaskUnion, Tag('file')] |
    Annotated[UploadedFileTask, Tag('upload')],
    Discriminator(_discriminate_task_type)
]


GenerationTaskUnion = Annotated[
    Annotated[_EventTaskUnion, Tag('event')] |
    Annotated[_GeneratedFileTaskUnion, Tag('file')] |
    Annotated[UploadedFileTask, Tag('upload')],
    Discriminator(_discriminate_task_type)
]
GenerationTaskAdapter = TypeAdapter[GenerationTask](GenerationTaskUnion)
