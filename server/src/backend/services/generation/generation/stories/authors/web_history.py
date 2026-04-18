from generation.stories.authors.author import Author, register_author
from model.stories import WebHistoryStoryData, StoryType
from model.types import WebHistory, EventType, EventData


@register_author(story_type=StoryType.WEB_HISTORY, event_type=EventType.WEB_HISTORY)
class WebHistoryAuthor(Author[WebHistoryStoryData, WebHistory]):
    def translate(self, story_data: WebHistoryStoryData, event_context: dict[str, EventData]) -> WebHistory:
        return WebHistory(
            **self._get_base_generated_data_fields(story_data=story_data),
            url=story_data.url,
            title=story_data.title,
            uses=story_data.uses
        )
