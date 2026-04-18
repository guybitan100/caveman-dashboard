from generation.stories.authors.author import Author, register_author
from model.stories import ImageStoryData, StoryType
from model.types import Image, EventType, EventData


@register_author(story_type=StoryType.IMAGE, event_type=EventType.IMAGE)
class ImageAuthor(Author[ImageStoryData, Image]):
    def translate(self, story_data: ImageStoryData, event_context: dict[str, EventData]) -> Image:
        return self._translate_file(story_data=story_data, data_class=Image)
