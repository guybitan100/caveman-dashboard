from metafinder_client.client import DataType
from model.types import EventType

event_to_metafinder_type = {
    EventType.APP: DataType.Application,
    EventType.AUDIO: DataType.Audio,
    EventType.CHAT: DataType.Chat,
    EventType.IMAGE: DataType.Image,
    EventType.DOCUMENT: DataType.Document,
    EventType.VIDEO: DataType.Video,
    EventType.INSTANT_MESSAGE: DataType.Chat,
    EventType.NOTE: DataType.Chat,
    EventType.CALENDAR_ENTRY: DataType.Chat,
    EventType.WEB_HISTORY: DataType.URL,
    EventType.WEB_BOOKMARK: DataType.URL
}

story_to_metafinder_type = {
    # StoryEventType.IMAGE: MDataType.Image
}


def map_event_to_metafinder_type(event_type: EventType) -> DataType:
    try:
        return event_to_metafinder_type[event_type]
    except KeyError:
        raise ValueError(f'Event type: {event_type} does not map to a Metafinder DataType')
