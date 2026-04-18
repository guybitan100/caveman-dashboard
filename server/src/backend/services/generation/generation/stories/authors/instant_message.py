from generation.stories.authors.author import Author, register_author
from model.stories import InstantMessageStoryData, StoryType
from model.types import InstantMessage, EventType, EventData


@register_author(story_type=StoryType.INSTANT_MESSAGE, event_type=EventType.INSTANT_MESSAGE)
class InstantMessageAuthor(Author[InstantMessageStoryData, InstantMessage]):
    def translate(self, story_data: InstantMessageStoryData, event_context: dict[str, EventData]) -> InstantMessage:
        return InstantMessage(
            **self._get_base_generated_data_fields(story_data=story_data),
            sender=story_data.sender,
            text=story_data.text,
            status=None,
            forwarded=False
        )
