
from generation.stories.authors.author import Author, register_author
from model.stories import ChatStoryData, StoryType, ChatMessageStoryData
from model.types import Chat, EventType, ChatMessage, EventData


@register_author(story_type=StoryType.CHAT, event_type=EventType.CHAT)
class ChatAuthor(Author[ChatStoryData, Chat]):
    def translate(self, story_data: ChatStoryData, event_context: dict[str, EventData]) -> Chat:
        messages = [
            self._translate_message(message_story=message_story, event_context=event_context, app_id=story_data.app_id)
            for message_story in story_data.chat.messages
        ]
        return Chat(
            **self._get_base_generated_data_fields(story_data=story_data),
            messages=messages,
            participants=story_data.chat.participants
        )

    def _translate_message(
            self,
            message_story: ChatMessageStoryData,
            event_context: dict[str, EventData],
            app_id: str | None = None
    ) -> ChatMessage:
        return ChatMessage(
            **self._get_base_generated_data_fields(story_data=message_story),
            chat_uid=message_story.chat_uid,
            sender=message_story.sender,
            text=message_story.text,
            status=message_story.status,
            reply_msg_uid=message_story.reply_msg_uid,
            forwarded=message_story.forwarded,
            app_uid=app_id,
            attachments=[
                event_context[att_story.story_id] for att_story in message_story.attachments
            ]
        )
