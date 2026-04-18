from generation.stories.authors.author import Author, register_author
from model.stories import PoweringEventStoryData, StoryType
from model.types import PoweringEvent, EventType, EventData


@register_author(story_type=StoryType.POWERING_EVENT, event_type=EventType.POWERING_EVENT)
class PoweringEventAuthor(Author[PoweringEventStoryData, PoweringEvent]):
    def translate(self, story_data: PoweringEventStoryData, event_context: dict[str, EventData]) -> PoweringEvent:
        return PoweringEvent(
            **self._get_base_generated_data_fields(story_data=story_data),
            event_name=story_data.event_name,
            description=story_data.description
        )
