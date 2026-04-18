from dataclasses import dataclass

from model.types import Entity


class AttachmentBlueprint:
    pass


@dataclass
class ChatBlueprint:

    participants: list[Entity]
    num_messages: int
    num_voice_messages: int
    participant_probs: list[float]
    msg_attachments: dict[int, list[AttachmentBlueprint]]


@dataclass
class PhoneCallBlueprint:

    participant: Entity


@dataclass
class ImageBlueprint(AttachmentBlueprint):

    categories: list[str]


@dataclass
class EmailBlueprint:

    from_entity: Entity
    to_entities: list[Entity]
