from generation.stories.authors.author import Author, register_author
from model.stories import ContactStoryData, StoryType
from model.types import Contact, EventType, EventData


@register_author(story_type=StoryType.CONTACT, event_type=EventType.CONTACT)
class ContactAuthor(Author[ContactStoryData, Contact]):
    def translate(self, story_data: ContactStoryData, event_context: dict[str, EventData]) -> Contact:
        return Contact(
            **self._get_base_generated_data_fields(story_data=story_data),
            first_name=story_data.contact.first_name,
            last_name=story_data.contact.last_name,
            phones=[
                Contact.ContactEntry(value=phone, category='Other')
                for phone in story_data.contact.phones
            ],
            emails=[
                Contact.ContactEntry(value=email, category='Other')
                for email in story_data.contact.emails
            ]
        )
