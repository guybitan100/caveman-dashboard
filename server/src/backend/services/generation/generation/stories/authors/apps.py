from generation.stories.authors.author import Author, register_author
from model.stories import AppStoryData, StoryType
from model.types import InstalledApplication, EventType, EventData


@register_author(story_type=StoryType.APP, event_type=EventType.APP)
class AppAuthor(Author[AppStoryData, InstalledApplication]):
    def translate(self, story_data: AppStoryData, event_context: dict[str, EventData]) -> InstalledApplication:
        return InstalledApplication(
            **self._get_base_generated_data_fields(story_data=story_data),
            app_id=story_data.app.app_id,
            name=story_data.app.name
        )
