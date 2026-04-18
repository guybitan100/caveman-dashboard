from generation.stories.authors.author import Author, register_author
from model.stories import CallStoryData, StoryType
from model.types import PhoneCall, EventType, EventData


@register_author(story_type=StoryType.CALL, event_type=EventType.CALL)
class CallAuthor(Author[CallStoryData, PhoneCall]):
    def translate(self, story_data: CallStoryData, event_context: dict[str, EventData]) -> PhoneCall:
        return PhoneCall(
            **self._get_base_generated_data_fields(story_data=story_data),
            participant=story_data.participant,
            direction=story_data.direction,
            call_type=story_data.call_type,
            duration=story_data.duration
        )
