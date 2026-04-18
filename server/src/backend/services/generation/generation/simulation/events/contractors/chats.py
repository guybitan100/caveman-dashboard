import itertools
from datetime import datetime
from itertools import repeat
from typing import Iterator

import numpy as np

from generation.simulation.data.generators.crypto import CryptoGenerator
from metafinder_core.queries import ChatQueryParams
from model.metafinder.queries import ArrayQuery, QueryOperator
from metafinder_core.models import ChatModel
from model.tasks import ChatTask
from model.types import EventType, Chat, ChatMessage, EntityID, GeneratedData, FILE_EVENT_TYPES, Location, Audio
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.events.blueprints import ChatBlueprint
from generation.simulation.utils import random_times


CHAT_EVENT_TYPE_DEPENDENCIES = {*FILE_EVENT_TYPES, EventType.CONTACT, EventType.LOCATION}

DEFAULT_REPLY_PROB = 0.03       # Probability of messages that will be replies
DEFAULT_FORWARD_PROB = 0.005    # Probability of messages that will be forwarded
DEFAULT_ATTACHMENT_PROB = 0.01  # Probability of messages to have attachment(s)

# Index delta of source "replied" message from reply messages
_reply_idx_mean_std = (1.5, 0.5)


@register_contractor(EventType.CHAT, dependencies=CHAT_EVENT_TYPE_DEPENDENCIES)
class ChatContractor(EventContractor[ChatTask, Chat]):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.crypto_generator = CryptoGenerator()

    def construct(self, blueprints: Iterator[ChatBlueprint]) -> Iterator[Chat]:
        total_text_messages = self.task.quantity

        all_chat_model_iter = ChatQueryParams(
            languages=self.task.languages or self.job.context.languages,
            categories=ArrayQuery(
                operator=QueryOperator.AND if self.task.is_categories_and_op else QueryOperator.OR,
                values=self.task.categories
            ),
        ).query(count=self.quantity)
        attachments_iter = self._get_attachments(
            attachments_params=self.task.attachments,
            attachments_prob=DEFAULT_ATTACHMENT_PROB,
            event_dependencies=CHAT_EVENT_TYPE_DEPENDENCIES,
            quantity=total_text_messages
        )
        voice_messages_iter = self.get_voice_messages()
        locations = self.hub.get_task_locations(task=self.task, shuffle=True)

        chats = (
            self._construct_chat(
                blueprint=blueprint,
                all_chat_model_iter=all_chat_model_iter,
                attachments_iter=attachments_iter,
                voice_messages_iter=voice_messages_iter,
                locations=locations
            )
            for blueprint in blueprints
        )

        yield from chats

    def _construct_chat(
            self,
            blueprint: ChatBlueprint,
            all_chat_model_iter: Iterator[ChatModel],
            attachments_iter: Iterator[tuple[GeneratedData]],
            voice_messages_iter: Iterator[Audio] | None,
            locations: Iterator[Location]
    ) -> Chat:
        if self.task.add_crypto_artifacts:
            has_crypto_artifacts = self._random_boolean_choices(n=blueprint.num_messages, true_prob=self.task.crypto_prob)
        else:
            has_crypto_artifacts = repeat(False, times=blueprint.num_messages)
        sender_ids = self._random_choices(blueprint.num_messages, tuple(range(len(blueprint.participants))),
                                          weights=blueprint.participant_probs)
        chat_models = itertools.islice(all_chat_model_iter, blueprint.num_messages)

        # Forwarded messages
        forwarded_msg_mask = self._random_boolean_choices(blueprint.num_messages, true_prob=DEFAULT_FORWARD_PROB)

        times = random_times(n=blueprint.num_messages, job=self.job)
        participants = [entity.uid for entity in blueprint.participants]
        messages = [
            self._construct_message(
                sender=participants[sender_id],
                text=chat_model.text,
                status="Read" if sender_id else "Sent",
                forwarded=is_forward,
                attachments=attachments,
                has_crypto_artifact=has_crypto_artifact,
                time=time,
                location=location
            )
            for sender_id, chat_model, attachments, is_forward, time, location, has_crypto_artifact
            in zip(sender_ids, chat_models, attachments_iter, forwarded_msg_mask, times, locations,
                   has_crypto_artifacts)
        ]
        
        # Voice messages
        if blueprint.num_voice_messages:
            audio_sender_ids = self._random_choices(blueprint.num_voice_messages,
                                                    tuple(range(len(blueprint.participants))),
                                                    weights=blueprint.participant_probs)
            audio_times = random_times(n=blueprint.num_voice_messages, job=self.job)
            audio_messages = [
                self._construct_voice_message(
                    sender=participants[sender_id],
                    status="Read" if sender_id else "Sent",
                    forwarded=False,
                    audio=audio,
                    time=time,
                    location=location
                )
                for sender_id, audio, time, location
                in zip(audio_sender_ids, voice_messages_iter, audio_times, locations)
            ]
            messages.extend(audio_messages)

        # Determine which messages are replies to others
        self._set_message_replies(messages=messages)

        chat = Chat(participants=participants, messages=messages)

        return chat

    def _construct_message(
            self,
            sender: EntityID,
            text: str,
            status: str,
            forwarded: bool,
            attachments: tuple[GeneratedData],
            has_crypto_artifact: bool,
            time: datetime,
            location: Location | None
    ) -> ChatMessage:
        return ChatMessage(
                sender=sender,
                text=text if not has_crypto_artifact else self.crypto_generator.enrich_string(text),
                status=status,
                forwarded=forwarded,
                attachments=attachments,
                time=time,
                location_id=location.uid if location else None,
                coordinate=self._create_coordinate_from_location(location)
            )
    
    def _construct_voice_message(
            self,
            sender: EntityID,
            status: str,
            forwarded: bool,
            audio: Audio,
            time: datetime,
            location: Location | None
    ) -> ChatMessage:
        return ChatMessage(
                sender=sender,
                text=None,
                status=status,
                forwarded=forwarded,
                attachments=[audio],
                time=time,
                location_id=location.uid if location else None,
                coordinate=self._create_coordinate_from_location(location)
            )

    def _set_message_replies(self, messages: list[ChatMessage]) -> None:
        if len(messages) > 1:
            reply_msg_idxs = np.random.binomial(n=1, p=DEFAULT_REPLY_PROB, size=len(messages)).nonzero()[0]
            if reply_msg_idxs.any() and reply_msg_idxs[0] == 0:  # The first message in a chat thread cannot be a reply
                reply_msg_idxs = reply_msg_idxs[1:]
            mean, std = _reply_idx_mean_std
            replied_delta_idxs = np.round(np.random.lognormal(mean, std, size=len(reply_msg_idxs))).astype(int)
            replied_delta_idxs[replied_delta_idxs == 0] = 1  # Messages cannot be replied to themselves
            replied_msg_idxs = reply_msg_idxs - replied_delta_idxs
            replied_msg_idxs[replied_msg_idxs < 0] = 0  # Correct negative replied idxs to first message boundary
            for reply_msg_idx, replied_msg_idx in zip(reply_msg_idxs.tolist(), replied_msg_idxs.tolist()):
                messages[reply_msg_idx].reply_msg_uid = messages[replied_msg_idx].uid

    def get_voice_messages(self) -> Iterator[Audio] | None:
        voice_msgs_task = self.task.voice_messages_task
        if voice_msgs_task is None:
            return None
        return self.hub.get_task_events(task_id=voice_msgs_task.task_id, event_type=voice_msgs_task.event_type)
