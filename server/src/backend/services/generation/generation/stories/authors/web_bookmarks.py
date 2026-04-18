from generation.stories.authors.author import Author, register_author
from model.stories import WebBookmarkStoryData, StoryType
from model.types import WebBookmark, EventType, EventData


@register_author(story_type=StoryType.WEB_BOOKMARK, event_type=EventType.WEB_BOOKMARK)
class WebBookmarkAuthor(Author[WebBookmarkStoryData, WebBookmark]):
    def translate(self, story_data: WebBookmarkStoryData, event_context: dict[str, EventData]) -> WebBookmark:
        return WebBookmark(
            **self._get_base_generated_data_fields(story_data=story_data),
            url=story_data.url,
            title=story_data.title,
            uses=story_data.uses,
            folder=story_data.folder
        )
