from generation.stories.authors.author import Author, register_author
from model.stories import VideoStoryData, StoryType
from model.types import Video, EventType, EventData


@register_author(story_type=StoryType.VIDEO, event_type=EventType.VIDEO)
class VideoAuthor(Author[VideoStoryData, Video]):
    def translate(self, story_data: VideoStoryData, event_context: dict[str, EventData]) -> Video:
        return self._translate_file(story_data=story_data, data_class=Video)
