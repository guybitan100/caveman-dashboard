from generation.stories.authors.author import Author, register_author
from model.stories import EmailStoryData, StoryType
from model.types import Email, EventType, EventData


@register_author(story_type=StoryType.EMAIL, event_type=EventType.EMAIL)
class EmailAuthor(Author[EmailStoryData, Email]):
    def translate(self, story_data: EmailStoryData, event_context: dict[str, EventData]) -> Email:
        return Email(
            **self._get_base_generated_data_fields(story_data=story_data),
            subject=story_data.subject,
            body=story_data.body,
            from_entity=story_data.from_,
            to_entities=story_data.to,
            folder=story_data.folder,
            attachments=[event_context[att.story_id] for att in story_data.attachments]
        )
