from generation.stories.authors.author import Author, register_author
from model.stories import AudioStoryData, StoryType
from model.types import Audio, EventType, EventData


@register_author(story_type=StoryType.AUDIO, event_type=EventType.AUDIO)
class AudioAuthor(Author[AudioStoryData, Audio]):
    def translate(self, story_data: AudioStoryData, event_context: dict[str, EventData]) -> Audio:
        return self._translate_file(story_data=story_data, data_class=Audio)
