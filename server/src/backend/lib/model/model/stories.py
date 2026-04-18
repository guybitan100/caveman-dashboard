import typing
from abc import abstractmethod, ABC
from datetime import datetime
from enum import StrEnum
from inspect import isclass

from typing import Callable, Type, Dict, Literal, List, Union, TypeVar, ClassVar, Tuple, Any, Optional, Self, Annotated, override


from pydantic import Field, PositiveInt, field_validator, model_validator, ConfigDict, TypeAdapter
from pydantic.types import NonNegativeInt

from model.metafinder.data_types import DataType
from model.types import EntityID
from model.utils import AbstractData, AutoUID


class StoryType(StrEnum):
    """
    Enum representing Titan supported stories.
    """

    LOCATION = 'location'
    IMAGE = 'image'
    DOCUMENT = 'document'
    VIDEO = 'video'
    AUDIO = 'audio'
    INSTANT_MESSAGE = 'sms/mms'
    CALL = 'call'
    EMAIL = 'email'
    APP = 'app'
    CONTACT = 'contact'
    POWERING_EVENT = 'powering event'
    WEB_BOOKMARK = 'web bookmarks'
    WEB_HISTORY = 'web history'
    COOKIE = 'cookie'

    # Group stories
    CHAT = 'chat'
    ROUTE = 'route'

    # Hidden by GUI
    CHAT_MESSAGE = 'chat message'


FILE_STORY_TYPES = {StoryType.AUDIO, StoryType.IMAGE, StoryType.DOCUMENT, StoryType.VIDEO}


_STORY_TYPE_TO_DEFAULT_LOCATION_CATEGORY = {
    StoryType.IMAGE: 'Media Locations',
    StoryType.DOCUMENT: 'Media Locations',
    StoryType.AUDIO: 'Media Locations',
    StoryType.VIDEO: 'Media Locations'
}


def _handle_null_type_json_schema(property_schema: dict[str, Any]) -> dict[str, Any]:
    if property_schema.get("type") == "object":
        for k, v in property_schema.get("properties", {}).items():
            property_schema["properties"][k] = _handle_null_type_json_schema(v)
    type_options = property_schema.get("anyOf")
    if type_options and len(type_options) == 2 and {"type": "null"} in type_options:
        type_options.remove({"type": "null"})
        for k, v in type_options[0].items():
            property_schema[k] = v
        property_schema["nullable"] = True
        property_schema.pop("anyOf")
    return property_schema


def story_data_schema_extra(schema: dict[str, Any], params_class: type["StoryData"]) -> None:
    if hasattr(params_class, 'story_type'):
        excluded_story_type_titles = [StoryType.CHAT]
        # Capitalize event name for GUI display
        schema["title"] = params_class.story_type.value.title() \
            if params_class.story_type not in excluded_story_type_titles else ""
        
        # Remove class docstring description
        schema.pop("description", None)
        # Set empty descriptions (e.g., remove auto-set "An enumeration" for enum params) unless explicitly set
        for prop in schema["properties"].values():
            prop.setdefault("description", "")
        
        for field_name, field in params_class.model_fields.items():
            # Remove fields which have None types
            if field.annotation is None:
                schema['properties'].pop(field_name)
                continue
            # Handle Optional types
            schema['properties'][field_name] = _handle_null_type_json_schema(schema['properties'][field_name])
            
            # Remove StoryData from ref properties
            for annotation in typing.get_args(field.annotation):
                if isclass(annotation) and issubclass(annotation, StoryData):
                    if typing.get_origin(field.annotation) is list:  # list of story refs
                        schema['properties'][field_name]['type'] = 'array'
                        schema['properties'][field_name]['items'] = {'type': 'string'}
                    else:  # single story ref
                        schema['properties'][field_name].pop('anyOf', None)
                        schema['properties'][field_name]['type'] = 'string'
                        schema['properties'][field_name]["nullable"] = True
                
            # Set location's default category and move field to end (for display at bottom of UI config window)
            if field_name == 'location_ref':
                schema['properties']['location_ref']['default_category'] = \
                    _STORY_TYPE_TO_DEFAULT_LOCATION_CATEGORY.get(params_class.story_type, 'Unknown')
                schema['properties']['location_ref'] = schema['properties'].pop('location_ref')
                
        schema['properties'].pop("story_type", None)  # Remove story_stype field from GUI display


class StoryData(AbstractData, ABC):
    story_ref_fields: ClassVar[tuple[str]]       # Field names of references to StoryData objects (used by publisher)
    story_type: ClassVar[StoryType]

    story_id: AutoUID
    user_description: str | None = Field(title='Description', default=None,
                                         description='Description of event for display purposes only')
    time: datetime = Field(title='Event timestamp')
    location_ref: Optional['LocationStoryRef'] = Field(title='Location', default=None, json_schema_extra={"ui": {"field": "locationRef"}})
    
    model_config = ConfigDict(
        json_schema_extra=story_data_schema_extra
    )

    def get_story_ref_fields(self) -> dict[str, str | list[str] | None]:
        """
        Get all fields with StoryRef type and their values from a StoryData object.

        Returns:
            Dict mapping from the field name to the value(s) of each StoryRef field.
        """
        return {
            field_name: getattr(self, field_name)
            for field_name in self.story_ref_fields
        }


T = TypeVar('T', bound=StoryData)

StoryRef = T | str
LocationStoryRef = StoryRef['LocationStoryData']
AttachmentsStoryData = Union[
    'ImageStoryData', 'DocumentStoryData', 'VideoStoryData', 'AudioStoryData', 'LocationStoryData'
]
AttachmentsStoryRef = StoryRef[AttachmentsStoryData]


_story_data_registry: dict[StoryType, type[StoryData]] = {}


def _is_story_data(field_annotation: Any) -> bool:
    if isclass(field_annotation):
        return issubclass(field_annotation, StoryData)
    elif typing.get_origin(field_annotation) is Union:
        return any(isclass(lt) and issubclass(lt, StoryData) for lt in typing.get_args(field_annotation))
    return False



def story_data(story_type: StoryType) -> Callable:
    """
    Decorator method that globally registers a StoryData class to a StoryType

    Examples:
        >>> @story_data(story_type=StoryType.LOCATION)
        ... class LocationStoryData(StoryData):
        ...     ...
    """

    def _register(data_class: type[StoryData]) -> type[StoryData]:
        if story_type in _story_data_registry:
            raise Exception(f'Cannot register multiple data classes to the same story type ({story_type})')
        data_class.story_ref_fields = tuple(
            name
            for name, field in data_class.model_fields.items()
            if any(_is_story_data(t) for t in typing.get_args(field.annotation))
        )
        data_class.story_type = story_type
        _story_data_registry[story_type] = data_class
        return data_class

    return _register


def get_story_data_class(story_type: StoryType) -> type[StoryData]:
    """
    Get the data class by StoryType.

    Arguments:
        story_type: StoryType for the requested StoryData.

    Returns:
        StoryData inherited class for the StoryType.
    """
    data_class = _story_data_registry.get(story_type)
    if data_class is None:  # Corresponding data class does not exist, raise error
        raise Exception(f'Story type {story_type} does not have a corresponding StoryData subclass')
    return data_class


def _set_time_to_none(_) -> None: return None   # Time field validator for chat and group stories


DELETED_STATE_OPTIONS = ['Deleted', 'Intact', 'Unknown']
LOCATION_CATEGORY_OPTIONS = ['Mentioned', 'Network', 'WirelessNetwork', 'Events', 'External', 'Places',
                             'SearchedPlaces', 'Metadata', 'Journey', 'Synced', 'Suggested', 'Ride', 'Route',
                             'Reminder', 'Navigation', 'Recent', 'Frequent', 'PokemonGo', 'GpsFix', 'UserSpecified',
                             'Calculated', 'Carved', 'CellTower', 'Harvested', 'Other', 'Unknown']
MESSAGE_STATUS_OPTIONS = ['Sent', 'Read']
CALL_DIRECTION_OPTIONS = ['Incoming', 'Outgoing', 'Unknown']
CALL_TYPE_OPTIONS = ['Incoming', 'Outgoing', 'Missed', 'Rejected', 'Cancelled', 'Unknown']
EMAIL_FOLDER_OPTIONS = ['Inbox', 'Sent Items']
POWERING_EVENT_TYPE_OPTIONS = ['On', 'Off', 'Reset', 'Connect', 'Disconnect', 'TimeZoneChange']


class GroupStoryData[T: StoryData](StoryData, ABC):
    time: str | None = Field(default=None, json_schema_extra={"ui": {"widget": "hidden"}})
    location_ref: None = Field(default=None, json_schema_extra={"ui": {"widget": "hidden"}})

    _ignore_time = field_validator('time', mode="before")(_set_time_to_none)

    @abstractmethod
    def get_inner_stories(self) -> list[T]:
        raise NotImplementedError


class EventStoryData(StoryData, ABC):
    app_id: str | None = Field(title='Application', default=None, json_schema_extra={"ui": {"field": "appId"}})


class StoryFileTypes(StrEnum):
    METAFINDER = 'metafinder'
    UPLOAD = 'upload'


class StoryFileInfo(AbstractData):
    s3_key: str
    file_type: StoryFileTypes
    file_name: str | None = Field(default=None)
    size: PositiveInt
    presigned_url: str | None = Field(default=None)


class FileStoryData(StoryData, ABC):
    deleted_state: str = Field(title='Deleted', default='Intact', json_schema_extra={"options": DELETED_STATE_OPTIONS})
    file: StoryFileInfo


class Coordinate(AbstractData):
    latitude: float = Field(title='Latitude', ge=-90, le=90)
    longitude: float = Field(title='Longitude', ge=-180, le=180)


@story_data(story_type=StoryType.LOCATION)
class LocationStoryData(EventStoryData):
    story_type: Literal[StoryType.LOCATION] = StoryType.LOCATION
    location_ref: None = Field(default=None, json_schema_extra={"ui": {"widget": "hidden"}})
    coordinate: Coordinate = Field(title='Location coordinate', json_schema_extra={"ui": {"field": "coordinate"}})
    category: str = Field(title='Category', default='Unknown', json_schema_extra={"options": LOCATION_CATEGORY_OPTIONS})


@story_data(story_type=StoryType.IMAGE)
class ImageStoryData(FileStoryData):
    story_type: Literal[StoryType.IMAGE] = StoryType.IMAGE
    file: StoryFileInfo = Field(json_schema_extra={"ui": {"field": "imageGallery"}, "data_type": DataType.Image})


@story_data(story_type=StoryType.AUDIO)
class AudioStoryData(FileStoryData):
    story_type: Literal[StoryType.AUDIO] = StoryType.AUDIO
    file: StoryFileInfo = Field(json_schema_extra={"ui": {"field": "imageGallery"}, "data_type": DataType.Audio})


@story_data(story_type=StoryType.VIDEO)
class VideoStoryData(FileStoryData):
    story_type: Literal[StoryType.VIDEO] = StoryType.VIDEO
    file: StoryFileInfo = Field(json_schema_extra={"ui": {"field": "imageGallery"}, "data_type": DataType.Video})


@story_data(story_type=StoryType.DOCUMENT)
class DocumentStoryData(FileStoryData):
    story_type: Literal[StoryType.DOCUMENT] = StoryType.DOCUMENT
    file: StoryFileInfo = Field(json_schema_extra={"ui": {"field": "imageGallery"}, "data_type": DataType.Document})


@story_data(story_type=StoryType.CHAT_MESSAGE)
class ChatMessageStoryData(StoryData):
    story_type: Literal[StoryType.CHAT_MESSAGE] = StoryType.CHAT_MESSAGE
    chat_uid: str = Field(json_schema_extra={"ui": {"widget": "hidden"}})
    sender: EntityID = Field(title='Sender', json_schema_extra={"ui": {"field": "entities"}, "multiple": False})
    text: str = Field(title='Message body')
    status: str = Field(title='Status', default='Read', json_schema_extra={"options": MESSAGE_STATUS_OPTIONS})
    reply_msg_uid: str | None = Field(title='Reply To', default=None, json_schema_extra={"ui": {"field": "replyMsgUid"}})
    forwarded: bool = Field(title='Forwarded', default=False)
    attachments: list[AttachmentsStoryRef] = Field(title='Attachments', default_factory=list, json_schema_extra={"ui": {"field": "storyRef"}, "story_types": FILE_STORY_TYPES | {StoryType.CONTACT}})


class _ChatStoryData(AbstractData):
    participants: list[EntityID] = Field(default_factory=list, json_schema_extra={"ui": {"field": "entities"}, "multiple": True})
    messages: list[ChatMessageStoryData] = Field(default_factory=list)


@story_data(story_type=StoryType.CHAT)
class ChatStoryData(GroupStoryData[ChatMessageStoryData], EventStoryData):
    story_type: Literal[StoryType.CHAT] = StoryType.CHAT
    time: str | None = Field(default=None, json_schema_extra={"ui": {"widget": "hidden"}})
    location_ref: None = Field(default=None, json_schema_extra={"ui": {"widget": "hidden"}})
    chat: _ChatStoryData = Field(json_schema_extra={"ui": {"field": "chat"}})

    _ignore_time = field_validator('time', mode="before")(_set_time_to_none)

    @override
    def get_inner_stories(self) -> list[ChatMessageStoryData]:
        return self.chat.messages


@story_data(story_type=StoryType.INSTANT_MESSAGE)
class InstantMessageStoryData(EventStoryData):
    story_type: Literal[StoryType.INSTANT_MESSAGE] = StoryType.INSTANT_MESSAGE
    sender: EntityID = Field(json_schema_extra={"ui": {"field": "entities"}, "multiple": False})
    text: str = Field(title='Message body')
    status: str = Field(title='Status', default='Read', json_schema_extra={"options": MESSAGE_STATUS_OPTIONS})
    attachment: AttachmentsStoryRef | None = Field(title='MMS attachment', default=None, json_schema_extra={"ui": {"field": "storyRef"}, "story_types": FILE_STORY_TYPES})


@story_data(story_type=StoryType.CALL)
class CallStoryData(EventStoryData):
    story_type: Literal[StoryType.CALL] = StoryType.CALL
    participant: EntityID = Field(title='Participant', json_schema_extra={"ui": {"field": "entities"}, "multiple": False})
    direction: str = Field(title='Direction', json_schema_extra={"options": CALL_DIRECTION_OPTIONS})
    call_type: str | None = Field(title='Call type', default=None, json_schema_extra={"options": CALL_TYPE_OPTIONS})
    duration: NonNegativeInt | None = Field(title='Call duration (seconds)', default=None)


@story_data(story_type=StoryType.EMAIL)
class EmailStoryData(EventStoryData):
    story_type: Literal[StoryType.EMAIL] = StoryType.EMAIL
    from_: EntityID = Field(title='Sender', json_schema_extra={"ui": {"field": "entities"}, "multiple": False})
    to: list[EntityID] = Field(title='To', default_factory=list, validate_default=True, json_schema_extra={"ui": {"field": "entities"}, "multiple": True})
    # cc: list[EntityID] = Field(title='CC', default_factory=list, ui={'field': 'entities'}, multiple=True)
    # bcc: list[EntityID] = Field(title='BCC', default_factory=list, ui={'field': 'entities'}, multiple=True)
    subject: str | None = Field(title='Subject', default=None)
    body: str | None = Field(title='Body', default=None)
    folder: str = Field(title='Folder', default='Inbox', json_schema_extra={"options": EMAIL_FOLDER_OPTIONS, "editable": True})
    attachments: list[AttachmentsStoryRef] = Field(title='Attachments', default_factory=list, json_schema_extra={"ui": {"field": "storyRef"}, "story_types": FILE_STORY_TYPES})

    @field_validator('to')
    def validate_at_least_one_entity(cls, to: EntityID) -> EntityID:
        assert to, 'At least one recipient must be specified'
        return to


class _AppInfo(AbstractData):
    app_id: str = Field(title='Application ID')
    name: str | None = Field(title='Name', default=None)
    
    model_config = ConfigDict(
        json_schema_extra=_handle_null_type_json_schema
    )


@story_data(story_type=StoryType.APP)
class AppStoryData(EventStoryData):
    story_type: Literal[StoryType.APP] = StoryType.APP
    app_id: Any = Field(json_schema_extra={"ui": {"widget": "hidden"}}, default=None)
    app: _AppInfo = Field(json_schema_extra={"field": "appInfo"}, title="")


class _ContactInfo(AbstractData):
    first_name: str | None = Field(default=None)
    last_name: str | None = Field(default=None)
    phones: list[str] = Field(default_factory=list)
    emails: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    def validate_contact_info(cls, values: dict | Self):
        if isinstance(values, _ContactInfo):
            return values
        assert values['phones'] or values['emails'], 'At least one phone or email must be specified'
        return values


@story_data(story_type=StoryType.CONTACT)
class ContactStoryData(EventStoryData):
    story_type: Literal[StoryType.CONTACT] = StoryType.CONTACT
    contact: _ContactInfo = Field(json_schema_extra={"ui": {"field": "contactInfo"}})


@story_data(story_type=StoryType.POWERING_EVENT)
class PoweringEventStoryData(EventStoryData):
    story_type: Literal[StoryType.POWERING_EVENT] = StoryType.POWERING_EVENT
    event_name: str = Field(title='Event', json_schema_extra={"options": POWERING_EVENT_TYPE_OPTIONS})
    description: str | None = Field(title='Event description', default=None)


@story_data(story_type=StoryType.WEB_HISTORY)
class WebHistoryStoryData(EventStoryData):
    story_type: Literal[StoryType.WEB_HISTORY] = StoryType.WEB_HISTORY
    url: str = Field(title='URL')
    title: str | None = Field(title='Webpage title', default=None)
    uses: NonNegativeInt = Field(title='Number of visits', default=1)


@story_data(story_type=StoryType.WEB_BOOKMARK)
class WebBookmarkStoryData(EventStoryData):
    story_type: Literal[StoryType.WEB_BOOKMARK] = StoryType.WEB_BOOKMARK
    url: str = Field(title='URL')
    title: str | None = Field(title='Bookmark title', default=None)
    uses: NonNegativeInt = Field(title='Number of visits', default=1)
    folder: str | None = Field(title='Folder', default=None)


@story_data(story_type=StoryType.COOKIE)
class CookieStoryData(EventStoryData):
    story_type: Literal[StoryType.COOKIE] = StoryType.COOKIE
    domain: str = Field(title='Domain')
    name: str = Field(title='Name')
    value: str = Field(title='Value')


class _RouteStoryData(AbstractData):
    locations: list[LocationStoryData] = Field(default_factory=list)


@story_data(story_type=StoryType.ROUTE)
class RouteStoryData(GroupStoryData[LocationStoryData]):
    story_type: Literal[StoryType.ROUTE] = StoryType.ROUTE
    time: str | None = Field(default=None, json_schema_extra={"ui": {"widget": "hidden"}})
    location_ref: None = Field(default=None, json_schema_extra={"ui": {"widget": "hidden"}})
    locations: _RouteStoryData = Field(json_schema_extra={"ui": {"field": "route"}})

    _ignore_time = field_validator('time', mode="before")(_set_time_to_none)

    @override
    def get_inner_stories(self) -> list[LocationStoryData]:
        return self.locations.locations


Stories = LocationStoryData | ImageStoryData | DocumentStoryData | VideoStoryData | AudioStoryData | ChatMessageStoryData | ChatStoryData | InstantMessageStoryData | CallStoryData | EmailStoryData | AppStoryData | ContactStoryData | PoweringEventStoryData | WebHistoryStoryData | WebBookmarkStoryData | CookieStoryData | RouteStoryData


StoryDataUnion = Annotated[
    Union[tuple(_story_data_registry.values())],
    Field(discriminator='story_type')
]
StoryDataAdapter = TypeAdapter[StoryData](StoryDataUnion)
