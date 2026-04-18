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
    """Ignore the value and use the DB value if loading from DB"""
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
    """
    Raw request representation of draft event generation task.

    Attributes:
        task_id:            Unique identifier of the task.
        parent_task_id:     Identifier of the parent task, if this is a sub-task.
        root_task_id:       Identifier of the root task in the hierarchy.
        event_type:         Event type of the task.
        quantity:           Desired quantity for the event type.
    """

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
        """Return an iterator over all immediate sub-tasks (GenerationTask)."""
        for field_name, field_info in self.model_fields.items():
            field_value = getattr(self, field_name)
            if isinstance(field_value, GenerationTask):
                yield field_value
            elif isinstance(field_value, (list, tuple, set, frozenset)):
                for item in field_value:
                    if isinstance(item, GenerationTask):
                        yield item

    def flatten_tasks(self) -> Iterator['GenerationTask']:
        """Return an iterator over self task and all its sub-tasks (GenerationTask), recursively."""
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
    """
    Parameters for crypto enrichment.
    This is a parent class for all params classes that can be used for crypto enrichment.

    Attributes:
        add_crypto_artifacts: Boolean value that indicates whether to add crypto artifacts to the data.
    """
    add_crypto_artifacts: bool = Field(default=False, title='Add crypto artifacts')
    crypto_prob: float = Field(default=0.02, json_schema_extra={"ui": {"widget": "hidden"}})


class EventTask(GenerationTask, ABC):
    """
    Abstract class for all task classes for event generation.

    Attributes:
        app_id:     Source app identifier to assign all task events
    """

    app_id: str | None = Field(default=None, json_schema_extra={"nullable": True, "ui": {"widget": "appId"}})


class FileTask(GenerationTask, ABC):
    """
    Abstract class for all task classes for file generation (events in FILE_EVENT_TYPES)

    Attributes:
        is_upload:   Indicates task referring to uploaded file.
    """

    is_upload: bool


class GeneratedFileTask(FileTask, ABC):
    """
    Abstract class for all task classes for generated file tasks (not upload).

    Attributes:
        is_upload:   Indicates task referring to generated file.
    """

    is_upload: Literal[False] = False


class UploadedFileTask(FileTask, ABC):
    """
    Abstract class for all task classes for uploaded file tasks.

    Attributes:
        is_upload:   Indicates task referring to uploaded file.
    """

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
    """
    DraftTask class for EventType.AUDIO

    Attributes:
        min_duration:     Minimum value for the duration range of the audio file to be passed to MetaFinder audio query.
        max_duration:     Maximum value for the duration range of the audio file to be passed to MetaFinder audio query.
        formats:          Audio file format of the audio files.
        categories:       List of analytic categories to be passed to MetaFinder audio query.
        is_categories_and_op: Boolean value that indicates which operator to apply to the categories query. True means
                              operator is AND False means OR.
    """

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
    """
    DraftTask class for EventType.IMAGE

    Attributes:
        min_width:     Minimum value for the width range of the image file to be passed to MetaFinder image query.
        max_width:     Maximum value for the width range of the image file to be passed to MetaFinder image query.
        min_height:    Minimum value for the height range of the image file to be passed to MetaFinder image query.
        max_height:    Maximum value for the height range of the image file to be passed to MetaFinder image query.
        formats:       Image file format of the image files.
        categories:    List of analytic categories to be passed to MetaFinder image query.
        is_categories_and_op: Boolean value that indicates which operator to apply to the categories query. True means
                              operator  is AND False means OR.
    """

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
    """
    DraftTask class for EventType.DOCUMENT

    Attributes:
        min_size:     Minimum value for the size range of the audio file to be passed to MetaFinder document query.
        max_size:     Maximum value for the size range of the audio file to be passed to MetaFinder document query.
        formats:       File format of the documents to be passed to MetaFinder document query.
    """

    event_type: Literal[EventType.DOCUMENT] = EventType.DOCUMENT
    min_size: NonNegativeInt | None = Field(title='Minimum size (KB)', default=None)
    max_size: NonNegativeInt | None = Field(title='Maximum size (KB)', default=None)
    formats: list[DocumentFormat] = Field(title='Document format', default_factory=list,
                                          json_schema_extra={"metafinder_key": 'format'})

    _validate_max_size = _validate_max_ge_min(min_field_name="min_size", max_field_name="max_size")


class VideoTask(GeneratedFileTask):
    """
    DraftTask class for EventType.VIDEO

    Attributes:
        min_duration:     Minimum value for the duration range of the video file to be passed to MetaFinder video query.
        max_duration:     Maximum value for the duration range of the video file to be passed to MetaFinder video query.
        formats:          Video file format of the video files.
        categories:       List of analytic categories to be passed to MetaFinder video query.
        is_categories_and_op: Boolean value that indicates which operator to apply to the categories query. True means
                              operator is AND False means OR.
    """

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
    """
    DraftTask class for EventType.ARCHIVE

    Not yet implemented
    """
    event_type: Literal[EventType.ARCHIVE] = EventType.ARCHIVE


class InstalledAppTask(EventTask):
    event_type: Literal[EventType.APP] = EventType.APP
    app_id: str | None = Field(default=None, json_schema_extra={"ui": {"widget": "hidden"}})


class LocationTask(EventTask):
    """
    DraftTask class for EventType.LOCATION

    Attributes:
        latitude:           Float indicating the latitude of the center location for the location events.
        longitude:          Float indicating the longitude of the center location for the location events.
        radius:             Radius from center in which locations will be randomly distributed.
        category:           Custom or pre-defined location category (will appear in PF facet)
    """

    event_type: Literal[EventType.LOCATION] = EventType.LOCATION
    latitude: float | None = Field(ge=-90, le=90, title="Central latitude", default=None)
    longitude: float | None = Field(ge=-180, le=180, title="Central longitude", default=None)
    radius: NonNegativeInt = Field(default=20, title="Radius of locations around center")
    category: str | None = Field(default=None, title='Location category')


class ContactTask(EventTask):
    """
    DraftTask class for EventType.CONTACT

    Attributes:
        min_phone_numbers:      Minimum phone numbers per contact
        max_phone_numbers:      Maximum phone numbers per contact
        min_email_addresses:    Minimum email addresses per contact
        max_email_addresses:    Maximum email addresses per contact
    """
    
    event_type: Literal[EventType.CONTACT] = EventType.CONTACT
    min_phone_numbers: NonNegativeInt = Field(default=1, title="Minimum phone numbers per contact")
    max_phone_numbers: NonNegativeInt = Field(default=2, title="Maximum phone numbers per contact")
    min_email_addresses: NonNegativeInt = Field(default=1, title="Minimum email addresses per contact")
    max_email_addresses: NonNegativeInt = Field(default=2, title="Maximum email addresses per contact")

    _validate_max_phones = _validate_max_ge_min(min_field_name="min_phone_numbers", max_field_name="max_phone_numbers")
    _validate_max_emails = _validate_max_ge_min(min_field_name="min_email_addresses",
                                                max_field_name="max_email_addresses")


class CallTask(EventTask):
    """
    DraftTask class for EventType.CALL

    Attributes:
        min_duration_sec:   Minimum value for the duration range of the call events. Must be less than 86400 (24 hours).
        max_duration_sec:   Maximum value for the duration range of the call events. Must be less than 86400 (24 hours).
    """

    event_type: Literal[EventType.CALL] = EventType.CALL
    min_duration_sec: int | None = Field(title="Minimum duration (in seconds) per call", ge=0, lt=86400, default=None)
    max_duration_sec: int | None = Field(title="Maximum duration (in seconds) per call", ge=0, lt=86400, default=None)

    _validate_max_duration = _validate_max_ge_min(min_field_name="min_duration_sec", max_field_name="max_duration_sec")


class ChatTask(EventTask, CryptoEnrichmentParams):
    """
    DraftTask class for EventType.CHAT

    Attributes:
        voice_messages_quantity:        Number of voice messages.
        voice_messages_task:            Task for voice messages.
        num_chats:                      Number of chat threads.
        min_num_other_participants:     Minimum value for the num_participants range of the chat events.
        max_num_other_participants:     Maximum value for the num_participants range of the chat events.
        languages:                      Language codes to be passed to MetaFinder sentences query.
        categories:                     List of analytic categories to be passed to MetaFinder sentences query.
        is_categories_and_op: Boolean value that indicates which operator to apply to the categories query. True means
                              operator is AND False means OR.
        attachments:                    List of GenerationTask representing the event attachments.
    """

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
    """
    DraftTask class for EventType.CARVED_STRING

    Attributes:
        min_words:      Minimum value for the words length range of the carved strings events.
        max_words:      Maximum value for the words length range of the carved strings events.
    """

    event_type: Literal[EventType.CARVED_STRING] = EventType.CARVED_STRING
    min_words: PositiveInt = Field(default=10, title="Minimum string length in words")
    max_words: PositiveInt = Field(default=20, title="Maximum string length in words")

    _validate_max_words = _validate_max_ge_min(min_field_name="min_words", max_field_name="max_words")


class CookieTask(EventTask):
    """
    DraftTask class for EventType.COOKIE

    Attributes:
        min_name_len:           Minimum value for the name characters length range of the cookie events.
        max_name_len:           Maximum value for the name characters length range of the cookie events.
        min_value_len:      Minimum value for the value characters length range of the cookie events.
        max_value_len:      Maximum value for the value characters length range of the cookie events.
    """

    event_type: Literal[EventType.COOKIE] = EventType.COOKIE
    min_name_len: NonNegativeInt = Field(default=3, title="Minimum name length in characters")
    max_name_len: NonNegativeInt = Field(default=7, title="Maximum name length in characters")
    min_value_len: NonNegativeInt = Field(default=4, title="Minimum value length in characters")
    max_value_len: NonNegativeInt = Field(default=10, title="Minimum value length in characters")

    _validate_name_lens = _validate_max_ge_min(min_field_name="min_name_len", max_field_name="max_name_len")
    _validate_value_lens = _validate_max_ge_min(min_field_name="min_value_len", max_field_name="max_value_len")


class JourneyTask(EventTask):
    """
    DraftTask class for EventType.JOURNEY

    Attributes:
        start_time:     Timestamp of the start of the journey.
        end_time:       Timestamp of the end of the journey.
        radius:         Radius of the journey, in which locations will be randomly distributed.
    """

    event_type: Literal[EventType.JOURNEY] = EventType.JOURNEY
    start_time: datetime | None = Field(title="Start time", default=None)
    end_time: datetime | None = Field(title="End time", default=None)
    radius: NonNegativeInt = Field(default=20, title="Radius of journey")

    _validate_times = _validate_max_ge_min(min_field_name="start_time", max_field_name="end_time")


class NoteTask(EventTask, CryptoEnrichmentParams):
    """
    DraftTask class for EventType.NOTE

    Attributes:
        max_words:            Maximum value for the note length range of the note events.
        languages:            Language code to be passed to MetaFinder sentences query.
        categories:           List of analytic categories to be passed to MetaFinder sentences query.
        is_categories_and_op: Boolean value that indicates which operator to apply to the categories query. True means
                              operator is AND False means OR.
    """

    event_type: Literal[EventType.NOTE] = EventType.NOTE
    max_words: PositiveInt = Field(default=20, title="Maximum note length in words")
    languages: list[str] = Field(default_factory=list, title='Note language', json_schema_extra={"metafinder_key": 'language'})
    categories: list[str] = Field(default_factory=list, title='Note text analytics topics', json_schema_extra={"metafinder_key": 'categories'})
    is_categories_and_op: bool = Field(default=False, json_schema_extra={"operator": True})


class NotificationTask(EventTask):
    """
    DraftTask class for EventType.NOTIFICATION

    Attributes:
        min_words:      Minimum value for the notification length range of the notification events.
        max_words:      Maximum value for the notification length range of the notification events.
    """

    event_type: Literal[EventType.NOTIFICATION] = EventType.NOTIFICATION
    min_words: PositiveInt = Field(default=10, title="Minimum notification length in words")
    max_words: PositiveInt = Field(default=20, title="Maximum notification length in words")

    _validate_max_words = _validate_max_ge_min(min_field_name="min_words", max_field_name="max_words")


class WebBookmarkTask(EventTask):
    """
    DraftTask class for EventType.WEB_BOOKMARK

    Attributes:
        min_visit_counts:     Minimum value for the visit_counts value range of the web bookmark events.
        max_visit_counts:     Maximum value for the visit_counts value range of the web bookmark events.
        min_folder_dirs:      Minimum value for the folder length range of the web bookmark events.
        max_folder_dirs:      Maximum value for the folder length range of the web bookmark events.
        categories:           List of categories to be passed to MetaFinder url query.
        is_categories_and_op: Boolean value that indicates which operator to apply to the categories query. True means
                              operator  is AND False means OR.
    """

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
    """
    DraftTask class for EventType.WEB_HISTORY

    Attributes:
        min_visit_counts:     Minimum value for the visit_counts value range of the web history events.
        max_visit_counts:     Maximum value for the visit_counts value range of the web history events.
        categories:           List of categories to be passed to MetaFinder url query.
        is_categories_and_op: Boolean value that indicates which operator to apply to the categories query. True means
                              operator  is AND False means OR.
    """

    event_type: Literal[EventType.WEB_HISTORY] = EventType.WEB_HISTORY
    min_visit_counts: NonNegativeInt = Field(default=1, title="Minimum visit counts")
    max_visit_counts: NonNegativeInt = Field(default=50, title="Maximum visit counts")
    categories: list[str] = Field(default_factory=list, title='URL category', json_schema_extra={"metafinder_key": 'categories'})
    is_categories_and_op: bool = Field(default=False, json_schema_extra={"operator": True})

    _validate_max_visits = _validate_max_ge_min(min_field_name="min_visit_counts", max_field_name="max_visit_counts")


class EmailTask(EventTask, CryptoEnrichmentParams):
    """
    DraftTask class for EventType.EMAIL

    Attributes:
        min_recipients:         Minimum recipients of each email.
        max_recipients:         Maximum recipients of each email.
        min_characters:         Minimum length of each email body in characters.
        max_characters:         Maximum length of each email body in characters.
        max_folder_amount:      Number of email folders.
        attachments             List of GenerationTask representing the event attachments.
    """

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
    """
    DraftTask class for EventType.INSTANT_MESSAGE

    Attributes:
        min_num_other_participants:     Minimum value for the num_participants range of the message events.
        max_num_other_participants:     Maximum value for the num_participants range of the message events.
    """

    event_type: Literal[EventType.INSTANT_MESSAGE] = EventType.INSTANT_MESSAGE
    min_num_other_participants: Literal[1] = Field(default=1, json_schema_extra={"readOnly": True},
                                                   title='Min. participants per chat thread (excluding device owner)')
    max_num_other_participants: Literal[1] = Field(default=1, json_schema_extra={"readOnly": True},
                                                   title='Max. participants per chat thread (excluding device owner)')


class CalendarEntryTask(EventTask):
    """
    DraftTask class for EventType.CALENDAR_ENTRY

    Attributes:
        events_categories:         List of strings that will be randomly selected as the calendar entry category.
        max_subject_words:         Maximum value for the subject words range of the calendar entry.
        max_details_sentences:     Maximum value for the details sentences range of the calendar entry.
        max_reminders:             Maximum value of calendar entry reminders per event.
        max_attendees:             Maximum value of calendar entry attendees per event.
        attachments:               List of GenerationTask representing the event attachments.
        languages:                 Language code to be passed to MetaFinder sentences query.
        categories:                List of analytic categories to be passed to MetaFinder sentences query.
        is_categories_and_op:      Boolean value that indicates which operator to apply to the categories query.
                                    True means operator is AND False means OR.
    """

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
    """
    DraftTask class for EventType.CELL_TOWER

    Attributes:
        latitude:           Float indicating the latitude of the center location for the cell tower events.
        longitude:          Float indicating the longitude of the center location for the cell tower events.
    """

    event_type: Literal[EventType.CELL_TOWER] = EventType.CELL_TOWER
    latitude: float | None = Field(default=None, ge=-90, le=90, title="Central latitude")
    longitude: float | None = Field(default=None, ge=-180, le=180, title="Central longitude")


class CreditCardTask(EventTask):
    """
    DraftTask class for EventType.CREDIT_CARD
    """
    event_type: Literal[EventType.CREDIT_CARD] = EventType.CREDIT_CARD


class PasswordTask(EventTask, CryptoEnrichmentParams):
    """
    DraftTask class for EventType.PASSWORD
    """
    event_type: Literal[EventType.PASSWORD] = EventType.PASSWORD


class PoweringEventTask(EventTask):
    """
    DraftTask class for EventType.POWERING_EVENT
    """
    event_type: Literal[EventType.POWERING_EVENT] = EventType.POWERING_EVENT


class RecognizedDeviceTask(EventTask):
    """
    DraftTask class for EventType.RECOGNIZED_DEVICE
    """
    event_type: Literal[EventType.RECOGNIZED_DEVICE] = EventType.RECOGNIZED_DEVICE


class UserAccountTask(EventTask):
    """
    DraftTask class for EventType.USER_ACCOUNT
    """
    event_type: Literal[EventType.USER_ACCOUNT] = EventType.USER_ACCOUNT


class FinancialAccountTask(EventTask):
    """
    DraftTask class for EventType.FINANCIAL_ACCOUNT

    Attributes:
        min_account_assets: Minimum number of account assets.
        max_account_assets: Maximum number of account assets.
    """

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
