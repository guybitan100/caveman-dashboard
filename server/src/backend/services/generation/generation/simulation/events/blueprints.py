from dataclasses import dataclass

from model.types import Entity


class AttachmentBlueprint:
    pass


@dataclass
class ChatBlueprint:
    """
    Attributes:
        participants:
        num_messages:
        num_voice_messages:
        participant_probs:
        msg_attachments:    Mapping message index to attachments.
    """

    participants: list[Entity]
    num_messages: int
    num_voice_messages: int
    participant_probs: list[float]
    msg_attachments: dict[int, list[AttachmentBlueprint]]


@dataclass
class PhoneCallBlueprint:
    """
    Attributes:
        participant:
    """

    participant: Entity


@dataclass
class ImageBlueprint(AttachmentBlueprint):
    """
    Attributes:
        categories:
    """

    categories: list[str]


@dataclass
class EmailBlueprint:
    """
    Attributes:
        from_entity:
        to_entities:
    """

    from_entity: Entity
    to_entities: list[Entity]
