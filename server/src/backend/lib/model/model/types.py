import inspect
from abc import ABC
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Callable, ClassVar, Literal, NamedTuple, Annotated, Union

from pydantic import BaseModel, Field, model_validator, field_validator, ConfigDict
from pydantic.types import constr, NonNegativeInt
from pydantic_core.core_schema import ValidationInfo

from model.utils import AutoUID


class EventType(StrEnum):

    CHAT = 'chat messages'
    CONTACT = 'contacts'
    IMAGE = 'images'
    VIDEO = 'videos'
    AUDIO = 'audios'
    CALL = 'calls'
    LOCATION = 'locations'
    COOKIE = 'cookies'
    PASSWORD = 'passwords'
    WEB_BOOKMARK = 'web bookmarks'
    WEB_HISTORY = 'web history'
    EMAIL = 'emails'
    APP = 'installed applications'
    DOCUMENT = 'documents'
    NOTIFICATION = 'notifications'
    JOURNEY = 'journeys'
    NOTE = 'notes'
    CARVED_STRING = 'carved strings'
    ARCHIVE = 'archives'
    INSTANT_MESSAGE = 'sms/mms'
    CALENDAR_ENTRY = 'calendar entry'
    CELL_TOWER = 'cell tower'
    CREDIT_CARD = 'credit card'
    RECOGNIZED_DEVICE = 'recognized device'
    USER_ACCOUNT = 'user account'
    POWERING_EVENT = 'powering event'
    FINANCIAL_ACCOUNT = 'financial account'


FILE_EVENT_TYPES = {
    EventType.ARCHIVE,
    EventType.AUDIO,
    EventType.DOCUMENT,
    EventType.IMAGE,
    EventType.VIDEO
}

# EventType that should be executed first
FIRST_PRIORITY_EVENT_TYPES = {
    *FILE_EVENT_TYPES, EventType.LOCATION
}


# EventTypes that the user can not generate
DISABLED_EVENT_TYPES = {EventType.ARCHIVE}


class Coordinate(BaseModel):
    lat: float
    lon: float


class GeneratedData(ABC, BaseModel):

    event_type: ClassVar[EventType] = None

    uid: AutoUID
    time: datetime | None = None
    is_sub_event: bool = False
    is_nested_data: bool = False
    coordinate: Coordinate | None = None
    location_id: str | None = None
    foreign_fields: ClassVar[set[str]]

    def model_dump(self, exclude_none=True, **kwargs):
        return super().model_dump(exclude_none=True, **kwargs)
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True
    )


_generated_data_event_type_registry: dict[EventType, type[GeneratedData]] = {}


def generated_data(event_type: EventType) -> Callable:

    def _register(data_class: type[GeneratedData]) -> type[GeneratedData]:
        if event_type in _generated_data_event_type_registry:
            raise Exception(f'Cannot register multiple data classes to the same event type ({event_type})')
        data_class.event_type = event_type
        _generated_data_event_type_registry[event_type] = data_class
        return data_class

    return _register


class GeneratedDataClassNotFoundError(Exception):
    def __init__(self, event_type: EventType):
        super().__init__(f'Generated data class for event type "{event_type}" not found')


def get_generated_data_class(event_type: EventType) -> type[GeneratedData]:
    data_class = _generated_data_event_type_registry.get(event_type)
    if data_class is None:
        raise GeneratedDataClassNotFoundError(event_type=event_type)
    return data_class


EntityID = str


class Entity(GeneratedData):

    is_owner: Literal[False] = False
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    email: str | None = None
    is_male: bool | None = None


class OwnerEntity(Entity):

    is_owner: Literal[True] = True


class EventData(GeneratedData, ABC):
    event_data_type: EventType
    app_uid: str | None = None
    
    
class FileData(GeneratedData, ABC):

    format: str | None = None
    s3_key: str | None = None
    data_type: str | None = None
    filename: str | None = None
    size: NonNegativeInt | None = None
    is_attachment: bool = False
    is_uploaded: bool = False
    md5: constr(min_length=32, max_length=32, to_lower=True)
    s3_bucket: str | None =  None
    deleted_state: str
    path: Path | None = Field(default=None, validate_default=True)

    @field_validator('path', mode="after")
    def construct_path(cls, path: Path | None, validation_info: ValidationInfo) -> Path:
        if path is not None:  # Some weird future case where non-conventional path is given. Path shouldn't be passed.
            return path
        values = validation_info.data
        filename = values.get('filename')
        if filename is None:  # Created from MetaFinder record, not uploaded
            format = values.get('format')  # Format must be given to construct path
            assert format is not None, 'FileData "format" is required'
            filename = Path(values['uid']).with_suffix(f'.{format}')  # Filename = <uid>.<format>
        data_type = values.get('data_type', '')  # If absent, there will be no category sub-directory
        path = Path('files', data_type, filename)
        return path


class DeviceInfoEntry(BaseModel):
    key: str
    value: str


class DeviceInfo(GeneratedData):
    entries: list[DeviceInfoEntry]


@generated_data(event_type=EventType.APP)
class InstalledApplication(EventData):
    event_data_type: Literal[EventType.APP] = EventType.APP
    app_uid: Literal[None] = None   # An app event cannot reference itself as the app source
    app_id: str
    name: str | None= None
    category: str | None = None
    event_types: list[EventType] | None = None
    

class ChatMessage(EventData):
    event_data_type: Literal[EventType.INSTANT_MESSAGE] = EventType.INSTANT_MESSAGE
    chat_uid: str | None = None
    sender: EntityID
    text: str | None = None
    status: str | None = None
    reply_msg_uid: str | None = None
    forwarded: bool | None = None
    categories: list[str] | None = None
    attachments: list["Attachable"] | None = Field(default=None, json_schema_extra={"is_attachable": True})


@generated_data(event_type=EventType.INSTANT_MESSAGE)
class InstantMessage(ChatMessage):
    pass


@generated_data(event_type=EventType.CHAT)
class Chat(EventData):
    event_data_type: Literal[EventType.CHAT] = EventType.CHAT
    participants: list[EntityID]
    messages: list[ChatMessage] = Field(default_factory=list)

    @field_validator('messages', mode="after")
    def _assign_chat_id_to_messages(cls, messages: list[ChatMessage], validation_info: ValidationInfo) -> list[ChatMessage]:
        chat_uid = validation_info.data['uid']
        for message in messages:
            message.chat_uid = chat_uid
        return messages


@generated_data(event_type=EventType.CALL)
class PhoneCall(EventData):
    event_data_type: Literal[EventType.CALL] = EventType.CALL
    participant: EntityID
    direction: str
    call_type: str | None = None
    duration: int | None = None


@generated_data(event_type=EventType.IMAGE)
class Image(FileData):
    event_data_type: Literal[EventType.IMAGE] = EventType.IMAGE
    data_type: Literal['Image'] = 'Image'


@generated_data(event_type=EventType.AUDIO)
class Audio(FileData):
    event_data_type: Literal[EventType.AUDIO] = EventType.AUDIO
    data_type: Literal['Audio'] = 'Audio'


@generated_data(event_type=EventType.DOCUMENT)
class Document(FileData):
    event_data_type: Literal[EventType.DOCUMENT] = EventType.DOCUMENT
    data_type: str | None = Field(default='Document', validate_default=True)

    @field_validator('data_type')
    def set_default_data_type(cls, data_type: str) -> str:
        return data_type or 'Document'


@generated_data(event_type=EventType.ARCHIVE)
class Archive(FileData):
    event_data_type: Literal[EventType.ARCHIVE] = EventType.ARCHIVE
    data_type: Literal['Archives'] = 'Archives'


@generated_data(event_type=EventType.CONTACT)
class Contact(EventData):
    
    class ContactEntry(NamedTuple):
        value: str | None
        category: str | None
    
    event_data_type: Literal[EventType.CONTACT] = EventType.CONTACT
    phones: list[ContactEntry]
    first_name: str | None = None
    last_name: str | None = None
    emails: list[ContactEntry] = Field(default_factory=list)
    is_attachment: bool = False


@generated_data(event_type=EventType.LOCATION)
class Location(EventData):
    event_data_type: Literal[EventType.LOCATION] = EventType.LOCATION
    latitude: float
    longitude: float
    is_attachment: bool = False
    thumbnail: Image | None = Field(default=None, json_schema_extra={"is_attachable": True})
    category: str


@generated_data(event_type=EventType.PASSWORD)
class Password(EventData):
    event_data_type: Literal[EventType.PASSWORD] = EventType.PASSWORD
    data: str
    account: str


@generated_data(event_type=EventType.VIDEO)
class Video(FileData):
    event_data_type: Literal[EventType.VIDEO] = EventType.VIDEO
    data_type: Literal['Video'] = 'Video'


@generated_data(event_type=EventType.COOKIE)
class Cookie(EventData):
    event_data_type: Literal[EventType.COOKIE] = EventType.COOKIE
    domain: str
    name: str
    value: str


@generated_data(event_type=EventType.WEB_BOOKMARK)
class WebBookmark(EventData):
    event_data_type: Literal[EventType.WEB_BOOKMARK] = EventType.WEB_BOOKMARK
    url: str
    title: str | None = None
    uses: int
    folder: str | None = None


@generated_data(event_type=EventType.WEB_HISTORY)
class WebHistory(EventData):
    event_data_type: Literal[EventType.WEB_HISTORY] = EventType.WEB_HISTORY
    url: str
    title: str | None = None
    uses: int


@generated_data(event_type=EventType.NOTIFICATION)
class Notification(EventData):
    event_data_type: Literal[EventType.NOTIFICATION] = EventType.NOTIFICATION
    body: str


@generated_data(event_type=EventType.JOURNEY)
class Journey(EventData):
    event_data_type: Literal[EventType.JOURNEY] = EventType.JOURNEY
    start_time: datetime
    end_time: datetime
    from_lat: float
    from_long: float
    to_lat: float
    to_long: float


@generated_data(event_type=EventType.NOTE)
class Note(EventData):
    event_data_type: Literal[EventType.NOTE] = EventType.NOTE
    title: str
    body: str
    last_modified: datetime


@generated_data(event_type=EventType.CARVED_STRING)
class CarvedString(EventData):
    event_data_type: Literal[EventType.CARVED_STRING] = EventType.CARVED_STRING
    body: str


@generated_data(event_type=EventType.EMAIL)
class Email(EventData):
    event_data_type: Literal[EventType.EMAIL] = EventType.EMAIL
    subject: str | None = None
    body: str | None = None
    from_entity: EntityID
    to_entities: list[EntityID]
    folder: str
    attachments: list["Attachable"] | None = Field(default=None, json_schema_extra={"is_attachable": True})


@generated_data(event_type=EventType.CALENDAR_ENTRY)
class CalendarEntry(EventData):
    event_data_type: Literal[EventType.CALENDAR_ENTRY] = EventType.CALENDAR_ENTRY
    start_date: datetime
    end_date: datetime
    subject: str | None = None
    category: str | None = None
    details: str | None = None
    reminders: list[datetime] | None = None
    attachments: list["Attachable"] | None = Field(default=None, json_schema_extra={"is_attachable": True})
    repeat_rule: str | None = None
    repeat_interval: str | None = None
    repeat_day: str | None = None
    availability: str | None = None
    from_entity: EntityID | None = None
    to_entities: list[EntityID] | None = None
    status: str | None = None
    event_class: str | None = None
    location: str | None = None

    @model_validator(mode="before")
    def validate_dates(cls, values):
        start_date = values['start_date']
        end_date = values['end_date']
        if end_date <= start_date:
            raise ValueError(f'end_date ({end_date}) must be later than start_date ({start_date})')
        return values
    
    model_config = ConfigDict(
        coerce_numbers_to_str=True,
    )


@generated_data(event_type=EventType.CELL_TOWER)
class CellTower(EventData):
    event_data_type: Literal[EventType.CELL_TOWER] = EventType.CELL_TOWER
    lac: int
    lat: float
    long: float
    cid: int
    mcc: int
    radio: str
    mnc: int


@generated_data(event_type=EventType.CREDIT_CARD)
class CreditCard(EventData):
    event_data_type: Literal[EventType.CREDIT_CARD] = EventType.CREDIT_CARD
    company: str
    owner_name: str
    number: str
    expiration_date: datetime
    last_used_date: datetime


@generated_data(event_type=EventType.RECOGNIZED_DEVICE)
class RecognizedDevice(EventData):
    event_data_type: Literal[EventType.RECOGNIZED_DEVICE] = EventType.RECOGNIZED_DEVICE
    source: str = 'Bluetooth Devices'
    type: str
    name: str | None = None
    model: str
    identifiers: list[tuple[str, str]] | None = Field(default_factory=list)
    serial_number: str | None = None


@generated_data(event_type=EventType.USER_ACCOUNT)
class UserAccount(EventData):
    event_data_type: Literal[EventType.USER_ACCOUNT] = EventType.USER_ACCOUNT
    type: str
    user_name: str | None = None
    password: str | None = None
    creation_date: datetime | None = None
    name: str | None = None
    address: str | None = None


@generated_data(event_type=EventType.POWERING_EVENT)
class PoweringEvent(EventData):
    event_data_type: Literal[EventType.POWERING_EVENT] = EventType.POWERING_EVENT
    event_name: str
    description: str | None = None


@generated_data(event_type=EventType.FINANCIAL_ACCOUNT)
class FinancialAccount(EventData):
    event_data_type: Literal[EventType.FINANCIAL_ACCOUNT] = EventType.FINANCIAL_ACCOUNT
    account_id: str
    account_type: str
    assets: list[str] | None = None


def _annotate_foreign_fields_to_data_classes(data_class: type[GeneratedData]) -> None:
    data_class.foreign_fields = {
        attr.name
        for attr in data_class.model_fields.values()
        if inspect.isclass(attr.annotation) and issubclass(attr.annotation, GeneratedData)
    }
    for sub_class in data_class.__subclasses__():
        _annotate_foreign_fields_to_data_classes(data_class=sub_class)

Attachable = Annotated[
    Union[Image, Video, Audio, Document, Archive, Location, Contact],
    Field(discriminator="event_data_type")]

_annotate_foreign_fields_to_data_classes(data_class=GeneratedData)
