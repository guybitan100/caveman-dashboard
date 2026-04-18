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
    """
    Enum representing SiX supported events.
    """

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
    """
    Abstract class of all SiX generated data.

    Attributes:
        uid:            Id of the event.
        time:           Timestamp of the event.
        is_sub_event:   Event is sub-event of another event (as report.xml model type or only within parent event)
        is_nested_data: Data that will be serialized as nested data in the report.xml. (e.g. shared Contacts)
        coordinate:     Coordinate of the event.
    """

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
    """
    Decorator method that globally registers a GeneratedData class to an EventType
    """

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
    """
    Get the data class for the EventType contractor.

    Arguments:
        event_type: EventType for the requested GeneratedData.

    Returns:
        GeneratedData inherited class for the EventType.
    """
    data_class = _generated_data_event_type_registry.get(event_type)
    if data_class is None:
        raise GeneratedDataClassNotFoundError(event_type=event_type)
    return data_class


EntityID = str


class Entity(GeneratedData):
    """
    Representing an entity object.

    Attributes:
        uid:        Id of the entity.
        is_owner:   Indicates entity is device owner (False).
        first name: First name of the entity.
        last_name:  Last name of the entity.
        phone:      Phone number of the entity.
        email:      Email address of the entity.
        is_male:    Indicates entity is male, else female.
    """

    is_owner: Literal[False] = False
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    email: str | None = None
    is_male: bool | None = None


class OwnerEntity(Entity):
    """
    Representing the device owner entity object.

    Attributes:
        uid:        Id of the entity.
        is_owner:   Indicates entity is device owner (True).
        first name: First name of the device owner.
        last_name:  Last name of the device owner.
        phone:      Phone number of the device owner.
        email:      Email address of the device owner.
        is_male:    Indicates device owner is male, else female.
    """

    is_owner: Literal[True] = True


class EventData(GeneratedData, ABC):
    """
    Represents a device event that will be present in the UFDR report
    """
    event_data_type: EventType
    app_uid: str | None = None
    
    
class FileData(GeneratedData, ABC):
    """
    Represents a physical file that will be present in the UFDR and its report event

    Attributes:
        format:         File extension.
        s3_key:         File s3_key, supplied by MetaFinder.
        data_type:      e.g. Audio, Image, Video, Document (used as files' sub-directory name).
        filename:       Custom filename used for uploaded files.
        path:           Local path (EFS in case of uploaded files), same as file's relative path within UFDR.
        size:           Size in bytes.
        is_attachment:  Indicates if the event is created as an attachment for other event.
        is_uploaded:    Indicates if the event is created from a file uploaded by the user.
        md5:            MD5 hash
        s3_bucket:      Name of S3 bucket of the file, if not specified s3_bucket is 'METAFINDER_BUCKET'.
        deleted_state:  File deleted state, e.g. 'Intact', 'Deleted', etc.
    """

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
    """
    Key-value pair entry to be added to the report.xml device info section at the conversion phase.

    Attributes:
        key:     The device info key.
        value:   The device info value.
    """
    key: str
    value: str


class DeviceInfo(GeneratedData):
    entries: list[DeviceInfoEntry]


@generated_data(event_type=EventType.APP)
class InstalledApplication(EventData):
    """
    Represents an installed application on the device.

    Attributes:
        uid:            Id of the event.
        app_id:         Installed_Application event of the event source app.
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        name:           Application name.
        category:       Category associated with the application, supplied by MetaFinder.
        event_types:    List of EventType associated with the application, supplied by MetaFinder.
    """
    event_data_type: Literal[EventType.APP] = EventType.APP
    app_uid: Literal[None] = None   # An app event cannot reference itself as the app source
    app_id: str
    name: str | None= None
    category: str | None = None
    event_types: list[EventType] | None = None
    

class ChatMessage(EventData):
    """
    Represents a chat message event.

    Attributes:
        uid:            Id of the event.
        app_uid:        Uid of the event's app (InstalledApplication UID).
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        chat_uid:       Id of the chat.
        sender:         Entity of the sender of the message.
        text:           Message body
        status:         Status of the message, e.g. 'Read', 'Sent'.
        reply_msg_uid:  Index (in the list of Chat messages) that this message replies to.
        forwarded:      Flag indicating if the message is forwarded
        categories:     List of message analytics topics that characterize the message
        attachments:    List of GeneratedData representing the message attachments.
    """
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
    """
    Represents a chat thread model.

    Attributes:
        uid:                Id of the event.
        app_uid:            Uid of the event's app (InstalledApplication UID).
        time:               Timestamp of the event.
        is_sub_event:       Indicates if event is sub-event of another event
        coordinate:         Coordinate of the event.
        participants:       List of Entities representing the participants of the chat.
        messages:           List of ChatMessage representing the messages of the chat.
    """
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
    """
    Represents a call event.

    Attributes:
        uid:                Id of the event.
        app_uid:            Uid of the event's app (InstalledApplication UID).
        time:               Timestamp of the event.
        is_sub_event:       Indicates if event is sub-event of another event
        coordinate:         Coordinate of the event.
        participant:        Entity representing the participant of the call.
        direction:          Direction of the call, e.g. Incoming', 'Outgoing', 'Unknown'.
        call_type:          Type of the call, e.g. 'Incoming', 'Outgoing', 'Missed', 'Rejected', 'Cancelled', 'Unknown'.
        duration:           Duration of the call.
    """
    event_data_type: Literal[EventType.CALL] = EventType.CALL
    participant: EntityID
    direction: str
    call_type: str | None = None
    duration: int | None = None


@generated_data(event_type=EventType.IMAGE)
class Image(FileData):
    """
    Represents an image file event.

    Attributes:
        uid:            Id of the event.
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        format:         File extension.
        s3_key:         File s3_key, supplied by MetaFinder.
        data_type:      'Image' (used as files' sub-directory name).
        filename:       Custom filename used for uploaded files.
        path:           Local path (EFS in case of uploaded files), same as file's relative path within UFDR.
        size:           Size in bytes.
    """
    event_data_type: Literal[EventType.IMAGE] = EventType.IMAGE
    data_type: Literal['Image'] = 'Image'


@generated_data(event_type=EventType.AUDIO)
class Audio(FileData):
    """
    Represents an audio file event.
    Attributes:
        uid:            Id of the event.
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        format:         File extension.
        s3_key:         File s3_key, supplied by MetaFinder.
        data_type:      'Audio' (used as files' sub-directory name).
        filename:       Custom filename used for uploaded files.
        path:           Local path (EFS in case of uploaded files), same as file's relative path within UFDR.
        size:           Size in bytes.
    """
    event_data_type: Literal[EventType.AUDIO] = EventType.AUDIO
    data_type: Literal['Audio'] = 'Audio'


@generated_data(event_type=EventType.DOCUMENT)
class Document(FileData):
    """
    Represents a document event.

    Attributes:
        uid:            Id of the event.
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        format:         File extension.
        s3_key:         File s3_key, supplied by MetaFinder.
        data_type:      'Document' or other document category (used as files' sub-directory name).
        filename:       Custom filename used for uploaded files.
        path:           Local path (EFS in case of uploaded files), same as file's relative path within UFDR.
        size:           Size in bytes.
    """
    event_data_type: Literal[EventType.DOCUMENT] = EventType.DOCUMENT
    data_type: str | None = Field(default='Document', validate_default=True)

    @field_validator('data_type')
    def set_default_data_type(cls, data_type: str) -> str:
        return data_type or 'Document'


@generated_data(event_type=EventType.ARCHIVE)
class Archive(FileData):
    """
    Represents an audio file event.
    Attributes:
        uid:            Id of the event.
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        format:         File extension.
        s3_key:         File s3_key, supplied by MetaFinder (Not used by Archive).
        data_type:      'Archives' (used as files' sub-directory name).
        filename:       Custom filename used for uploaded files.
        path:           Local path (EFS in case of uploaded files), same as file's relative path within UFDR.
        size:           Size in bytes.
    """
    event_data_type: Literal[EventType.ARCHIVE] = EventType.ARCHIVE
    data_type: Literal['Archives'] = 'Archives'


@generated_data(event_type=EventType.CONTACT)
class Contact(EventData):
    """
    Represents a contact event.
    Attributes:
        uid:            Id of the event.
        app_uid:        Uid of the event's app (InstalledApplication UID).
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        phones:         Phone number entries of the contact.
        first_name:     First name of the contact.
        last_name:      Last name of the contact.
        emails:         Email address entries of the contact.
        is_attachment:  Indicates if the event is created as an attachment for other event.
    """
    
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
    """
    Represents a location event.

    Attributes:
        uid:            Id of the event.
        app_uid:        Uid of the event's app (InstalledApplication UID).
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        latitude:       Latitude of the location.
        longitude:      Longitude of the location.
        is_attachment:  Indicates if the event is created as an attachment for other event.
        thumbnail:      Image object representing the location thumbnail.
        category:       String that will be added to the Location xml 'category' property.
    """
    event_data_type: Literal[EventType.LOCATION] = EventType.LOCATION
    latitude: float
    longitude: float
    is_attachment: bool = False
    thumbnail: Image | None = Field(default=None, json_schema_extra={"is_attachable": True})
    category: str


@generated_data(event_type=EventType.PASSWORD)
class Password(EventData):
    """
    Represents a password event.

    Attributes:
        uid:            Id of the event.
        app_uid:        Uid of the event's app (InstalledApplication UID).
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        data:           Actual data of the password event.
        account:        Account associated with the password.
    """
    event_data_type: Literal[EventType.PASSWORD] = EventType.PASSWORD
    data: str
    account: str


@generated_data(event_type=EventType.VIDEO)
class Video(FileData):
    """
    Represents a video file event.
    Attributes:
        uid:            Id of the event.
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        format:         File extension.
        s3_key:         File s3_key, supplied by MetaFinder.
        data_type:      'Video' (used as files' sub-directory name).
        filename:       Custom filename used for uploaded files.
        path:           Local path (EFS in case of uploaded files), same as file's relative path within UFDR.
        size:           Size in bytes.
    """
    event_data_type: Literal[EventType.VIDEO] = EventType.VIDEO
    data_type: Literal['Video'] = 'Video'


@generated_data(event_type=EventType.COOKIE)
class Cookie(EventData):
    """
    Represents a cookie event.

    Attributes:
        uid:            Id of the event.
        app_uid:        Uid of the event's app (InstalledApplication UID).
        time:           Timestamp of the event.
        coordinate:     Coordinate of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        domain:         Domain associated with the coolie event.
        name:           Name of the cookie event.
        value:          Value of the cookie event.
    """
    event_data_type: Literal[EventType.COOKIE] = EventType.COOKIE
    domain: str
    name: str
    value: str


@generated_data(event_type=EventType.WEB_BOOKMARK)
class WebBookmark(EventData):
    """
    Represents a web bookmark event.

    Attributes:
        uid:            Id of the event.
        app_uid:        Uid of the event's app (InstalledApplication UID).
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        url:            Url of the web bookmark.
        title:          Title of the web bookmark.
        uses:           Number of visits to the web bookmark.
        folder:         Folder name of the web bookmark.
    """
    event_data_type: Literal[EventType.WEB_BOOKMARK] = EventType.WEB_BOOKMARK
    url: str
    title: str | None = None
    uses: int
    folder: str | None = None


@generated_data(event_type=EventType.WEB_HISTORY)
class WebHistory(EventData):
    """
    Represents a web history event.

    Attributes:
        uid:            Id of the event.
        app_uid:        Uid of the event's app (InstalledApplication UID).
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        url:            Url of the web history.
        title:          Title of the web history.
        uses:           Number of visits to the web history.
    """
    event_data_type: Literal[EventType.WEB_HISTORY] = EventType.WEB_HISTORY
    url: str
    title: str | None = None
    uses: int


@generated_data(event_type=EventType.NOTIFICATION)
class Notification(EventData):
    """
    Represents a notification event.

    Attributes:
            uid:            Id of the event.
            app_uid:        Uid of the event's app (InstalledApplication UID).
            time:           Timestamp of the event.
            is_sub_event:   Indicates if event is sub-event of another event
            coordinate:     Coordinate of the event.
            body:           Actual body of the notification event.
    """
    event_data_type: Literal[EventType.NOTIFICATION] = EventType.NOTIFICATION
    body: str


@generated_data(event_type=EventType.JOURNEY)
class Journey(EventData):
    """
    Represents a journey event.

    Attributes:
        uid:            Id of the event.
        app_uid:        Uid of the event's app (InstalledApplication UID).
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        start_time:     Timestamp of the start of the journey event.
        end_time:       Timestamp of the end of the journey event.
        from_lat:       Latitude of the location of the start of the journey event.
        from_long:      Longitude of the location of the start of the journey event.
        to_lat:         Latitude of the location of the end of the journey event.
        to_long:        Longitude of the location of the end of the journey event.
    """
    event_data_type: Literal[EventType.JOURNEY] = EventType.JOURNEY
    start_time: datetime
    end_time: datetime
    from_lat: float
    from_long: float
    to_lat: float
    to_long: float


@generated_data(event_type=EventType.NOTE)
class Note(EventData):
    """
    Represents a note event.

    Attributes:
        uid:            Id of the event.
        app_uid:        Uid of the event's app (InstalledApplication UID).
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        title:          Title of the note event.
        body:           Body of the note event.
        last_modified:  Timestamp of the last modification of the note.
    """
    event_data_type: Literal[EventType.NOTE] = EventType.NOTE
    title: str
    body: str
    last_modified: datetime


@generated_data(event_type=EventType.CARVED_STRING)
class CarvedString(EventData):
    """
    Represents a carved string event.

    Attributes:
            uid:            Id of the event.
            app_uid:        Uid of the event's app (InstalledApplication UID).
            time:           Timestamp of the event.
            is_sub_event:   Indicates if event is sub-event of another event
            coordinate:     Coordinate of the event.
            body:           Body of the carved string event.
    """
    event_data_type: Literal[EventType.CARVED_STRING] = EventType.CARVED_STRING
    body: str


@generated_data(event_type=EventType.EMAIL)
class Email(EventData):
    """
    Represents an email event.

    Attributes:
            uid:            Id of the event.
            app_uid:        Uid of the event's app (InstalledApplication UID).
            time:           Timestamp of the event.
            is_sub_event:   Indicates if event is sub-event of another event
            coordinate:     Coordinate of the event.
            subject:        Subject of the email event.
            body:           Body of the email event.
            from_entity:    Entity of the sender of the email event.
            to_entities:    List of Entity representing the recipients of the email event.
            folder:         Folder name of the email event.
            attachments:    List of GeneratedData representing the email attachments.
    """
    event_data_type: Literal[EventType.EMAIL] = EventType.EMAIL
    subject: str | None = None
    body: str | None = None
    from_entity: EntityID
    to_entities: list[EntityID]
    folder: str
    attachments: list["Attachable"] | None = Field(default=None, json_schema_extra={"is_attachable": True})


@generated_data(event_type=EventType.CALENDAR_ENTRY)
class CalendarEntry(EventData):
    """
    Represents an CalendarEntry event.

    Attributes:
            uid:                Id of the event.
            app_uid:            Uid of the event's app (InstalledApplication UID).
            time:               Timestamp of the event.
            is_sub_event:       Indicates if event is sub-event of another event
            coordinate:         Coordinate of the event.
            start_date:         Start datetime of the CalendarEntry event.
            end_date:           End datetime of the CalendarEntry event.
            subject:            Subject of the CalendarEntry event.
            category:           Category of the CalendarEntry event.
            details:            Details of the CalendarEntry event, can be text or HTML.
            reminders:          Datetime objects representing reminders of the CalendarEntry event.
            attachments:        List of GeneratedData representing the CalendarEntry attachments.
            repeat_rule:        CalendarEntry repeat rule.
            repeat_interval:    CalendarEntry repeat rule interval.
            repeat_day:         CalendarEntry repeat rule day.
            availability:       Availability status of the device owner.
            from_entity:        Entity of the sender of the CalendarEntry event.
            to_entities:        List of Entity representing the recipients of the CalendarEntry event.
            status:             Status of the calendar entry.
            event_class:        Represents CalendarEntry Class field of the report.xml.
            location:           Position of the calendar entry.
    """
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
    """
    Representing an CellTower event.

    Attributes:
        uid:            Id of the event.
        app_uid:        Uid of the event's app.
        time:           Timestamp of the event.
        is_sub_event:   Indicates if event is sub-event of another event
        coordinate:     Coordinate of the event.
        lac:            Location Area Code (LAC)
        lat:            Latitude of the cell tower
        long:           Longitude of the cell tower
        cid:            Cell tower code (CID)
        mcc:            Mobile Country Code
        radio:          The generation of broadband cellular network technology
        mnc:            Mobile Network Code
    """
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
    """
    Represents a credit card event.

    Attributes:
            uid:                Id of the event.
            app_uid:            Uid of the event's app (InstalledApplication UID).
            time:               Timestamp of the event.
            is_sub_event:   Indicates if event is sub-event of another event
            coordinate:     Coordinate of the event.
            company:            Company name of the card.
            owner_name:         Owner name of the card.
            number:             Card number.
            expiration_date:    Card expiration date.
            last_used_date:     Card last activity date.
    """
    event_data_type: Literal[EventType.CREDIT_CARD] = EventType.CREDIT_CARD
    company: str
    owner_name: str
    number: str
    expiration_date: datetime
    last_used_date: datetime


@generated_data(event_type=EventType.RECOGNIZED_DEVICE)
class RecognizedDevice(EventData):
    """
        Represents a RecognizedDevice event.

        Attributes:
                uid:            Id of the event.
                app_uid:        Uid of the event's app (InstalledApplication UID).
                time:           Timestamp of the event.
                is_sub_event:   Indicates if event is sub-event of another event
                coordinate:     Coordinate of the event.
                source:         Source of the event, defaults is 'Bluetooth Devices'.
                type:           Type of the recognized device, e.g. 'Computer', 'Phone', 'Watch'.
                name:           Name of the device.
                model:          Model of the device.
                identifiers:    List of device Identifiers.
                serial_number:  Serial number of the device.
        """
    event_data_type: Literal[EventType.RECOGNIZED_DEVICE] = EventType.RECOGNIZED_DEVICE
    source: str = 'Bluetooth Devices'
    type: str
    name: str | None = None
    model: str
    identifiers: list[tuple[str, str]] | None = Field(default_factory=list)
    serial_number: str | None = None


@generated_data(event_type=EventType.USER_ACCOUNT)
class UserAccount(EventData):
    """
    Represents a user account event.

    Attributes:
            uid:            Id of the event.
            app_uid:        Uid of the event's app (InstalledApplication UID).
            time:           Timestamp of the event.
            is_sub_event:   Indicates if event is sub-event of another event
            coordinate:     Coordinate of the event.
            type:           Type of the user account, e.g. 'Local', 'Microsoft', 'Google'.
            user_name:      Username of the account.
            password:       Password of the account.
            creation_date:  Creation date of the account.
            name:           Name of the account.
            address:        Address of the account.
    """
    event_data_type: Literal[EventType.USER_ACCOUNT] = EventType.USER_ACCOUNT
    type: str
    user_name: str | None = None
    password: str | None = None
    creation_date: datetime | None = None
    name: str | None = None
    address: str | None = None


@generated_data(event_type=EventType.POWERING_EVENT)
class PoweringEvent(EventData):
    """
        Represents an PoweringEvent event.

        Attributes:
            uid:            Id of the event.
            app_uid:        Uid of the event's app (InstalledApplication UID).
            time:           Timestamp of the event.
            is_sub_event:   Indicates if event is sub-event of another event
            coordinate:     Coordinate of the event.
            event_name:     Type of the PoweringEvent, e.g. on, off, reset.
            description:    Description of the event, e.g. 'battery critically low'.
    """
    event_data_type: Literal[EventType.POWERING_EVENT] = EventType.POWERING_EVENT
    event_name: str
    description: str | None = None


@generated_data(event_type=EventType.FINANCIAL_ACCOUNT)
class FinancialAccount(EventData):
    """
    Represents a financial account event.

    Attributes:
            uid:            Id of the event.
            app_uid:        Installed_Application event of the event source app.
            time:           Timestamp of the event.
            is_sub_event:   Indicates if event is sub-event of another event
            coordinate:     Coordinate of the event.
            account_id:     Id of the account.
            account_type:   Type of the account, e.g. 'Bank', 'Credit Card'.
            assets:         List of assets associated with the account, e.g. 'Dollar', 'Euro' 'Bitcoin'.
    """
    event_data_type: Literal[EventType.FINANCIAL_ACCOUNT] = EventType.FINANCIAL_ACCOUNT
    account_id: str
    account_type: str
    assets: list[str] | None = None


def _annotate_foreign_fields_to_data_classes(data_class: type[GeneratedData]) -> None:
    """Add nested fields that contains GeneratedData object(s) for reference by the DB writing mechanism"""
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
