from generation.stories.authors.author import Author, register_author
from model.stories import CookieStoryData, StoryType
from model.types import Cookie, EventType, EventData


@register_author(story_type=StoryType.COOKIE, event_type=EventType.COOKIE)
class CookieAuthor(Author[CookieStoryData, Cookie]):
    def translate(self, story_data: CookieStoryData, event_context: dict[str, EventData]) -> Cookie:
        return Cookie(
            **self._get_base_generated_data_fields(story_data=story_data),
            domain=story_data.domain,
            name=story_data.name,
            value=story_data.value
        )
