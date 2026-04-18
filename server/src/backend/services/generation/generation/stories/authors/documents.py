from generation.stories.authors.author import Author, register_author
from model.stories import DocumentStoryData, StoryType
from model.types import Document, EventType, EventData


@register_author(story_type=StoryType.DOCUMENT, event_type=EventType.DOCUMENT)
class DocumentAuthor(Author[DocumentStoryData, Document]):
    def translate(self, story_data: DocumentStoryData, event_context: dict[str, EventData]) -> Document:
        return self._translate_file(story_data=story_data, data_class=Document)
