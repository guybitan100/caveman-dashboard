from generation.stories.authors.author import Author, register_author
from model.stories import LocationStoryData, StoryType
from model.types import Location, EventType, EventData


@register_author(story_type=StoryType.LOCATION, event_type=EventType.LOCATION)
class LocationAuthor(Author[LocationStoryData, Location]):
    def translate(self, story_data: LocationStoryData, event_context: dict[str, EventData]) -> Location:
        return Location(
            **self._get_base_generated_data_fields(story_data=story_data),
            latitude=story_data.coordinate.latitude,
            longitude=story_data.coordinate.longitude,
            category=story_data.category
        )
