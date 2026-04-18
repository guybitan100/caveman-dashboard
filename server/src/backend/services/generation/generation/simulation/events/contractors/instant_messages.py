from datetime import datetime
from typing import Iterator

from generation.simulation.events.blueprints import ChatBlueprint
from generation.simulation.events.contractors.chats import ChatContractor, CHAT_EVENT_TYPE_DEPENDENCIES
from generation.simulation.events.contractors.registry import register_contractor
from model.types import EventType, ChatMessage, InstantMessage, EntityID, GeneratedData, Location


@register_contractor(EventType.INSTANT_MESSAGE, dependencies=CHAT_EVENT_TYPE_DEPENDENCIES)
class InstantMessageContractor(ChatContractor):
    def construct(self, blueprints: Iterator[ChatBlueprint]) -> Iterator[InstantMessage]:
        chats = super().construct(blueprints=blueprints)
        messages = (message for chat in chats for message in chat.messages)
        yield from messages

    def _construct_message(self,
                           sender: EntityID,
                           text: str,
                           status: str,
                           forwarded: bool,
                           attachments: list[GeneratedData] | None,
                           has_crypto_artifact: bool,
                           time: datetime,
                           location: Location | None) -> InstantMessage:
        # Overrides ChatContractor method
        if has_crypto_artifact:
            text = self.crypto_generator.enrich_string(text)
        return InstantMessage(
                sender=sender,
                text=text,
                status=status,
                forwarded=forwarded,
                attachments=attachments,
                time=time,
                location_id=location.uid if location else None,
                coordinate=self._create_coordinate_from_location(location)
            )

    def _set_message_replies(self, messages: list[ChatMessage]) -> None:
        pass    # SMS does not have reply capability
