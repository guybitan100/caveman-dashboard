from collections import Counter
from typing import Iterator

import numpy as np
from model.tasks import ChatTask
from model.types import EventType

from generation.simulation.events.architects.architect import Architect
from generation.simulation.events.architects.registry import register_architect
from generation.simulation.events.blueprints import ChatBlueprint, ImageBlueprint

# Blueprint template default parameter values

DEFAULT_IMAGE_ATTACHMENT_PROB = 0.0

# Total chat threads lognormal params
_num_chats_mean_std = (5.628179374765531, 1.9658015416633932)

# Num. participants per chat thread lognormal params
_num_participants_per_chat_mean_std = (-3.944948273504255, 6.798648375832828)

# Num. messages per chat thread lognormal params
_num_messages_per_chat_mean_std = (-7.748185565757008, 5.552943664725657)
_empty_chat_prob = 0.02693027272073112  # Probability that a chat has 0 messages


@register_architect(event_type=EventType.CHAT)
class ChatArchitect(Architect[ChatTask]):
    def create_blueprints(self, n: int, params: ChatTask) -> Iterator[ChatBlueprint]:
        # n = total chat messages, not chat threads
        total_text_messages = n - params.voice_messages_quantity
        total_voice_messages = params.voice_messages_quantity

        # Total chat threads
        if params.num_chats is None:  # User did not specify total number of chat threads
            total_chats = self._get_num_chats()
        else:
            total_chats = params.num_chats

        # Total messages per chat thread
        num_messages_vals = self._get_num_messages(num_messages=total_text_messages, num_chats=total_chats)

        # Re-adjust total number of chat threads in case empty threads were pruned unless user specified param
        if params.num_chats is None:
            num_messages_vals = self._adjust_empty_chats(num_messages_vals=num_messages_vals, num_chats=total_chats)
            total_chats = len(num_messages_vals)

        num_voice_messages_vals = self._get_num_messages(num_messages=total_voice_messages, num_chats=total_chats)
        num_voice_messages_vals = num_voice_messages_vals.tolist()
        num_messages_vals = num_messages_vals.tolist()

        # Total participants per chat thread
        num_participants_vals = self._get_num_other_participants(
            num_chats=total_chats,
            min_num_other_participants=params.min_num_other_participants,
            max_num_other_participants=params.max_num_other_participants,
        )

        # Participant message weights (np.array) -- add num_chats to get an additional weight for device owner
        participant_weights = np.random.random(size=sum(num_participants_vals) + total_chats)

        participant_weight_idx = 0
        for num_other_participants, num_messages, num_voice_messages in zip(
                num_participants_vals, num_messages_vals, num_voice_messages_vals
        ):
            other_participants = self.context.get_random_entities(num_other_participants, unique=True)
            participants = [self.context.owner_entity] + other_participants
            participant_probs = participant_weights[
                participant_weight_idx : participant_weight_idx + num_other_participants + 1
            ]
            participant_weight_idx += num_other_participants + 1  # Add 1 to account for device owner
            participant_probs = (participant_probs / participant_probs.sum()).tolist()

            # Image attachments
            attachment_idxs = np.random.binomial(1, DEFAULT_IMAGE_ATTACHMENT_PROB, num_messages).nonzero()[0].tolist()
            attachment_counter = Counter(attachment_idxs)
            msg_attachments = {
                idx: [ImageBlueprint([])] * num_attachments for idx, num_attachments in attachment_counter.most_common()
            }

            blueprint = ChatBlueprint(
                participants=participants,
                num_messages=num_messages,
                num_voice_messages=num_voice_messages,
                participant_probs=participant_probs,
                msg_attachments=msg_attachments,
            )
            yield blueprint

    @staticmethod
    def _get_num_chats() -> int:
        mean, std = _num_chats_mean_std
        num_chats = int(np.random.lognormal(mean, std))
        if not num_chats:  # Correct zero value to minimum 1 (because msgs must be distributed among chat(s))
            num_chats = 1
        return num_chats

    def _get_num_other_participants(
        self,
        num_chats: int,
        min_num_other_participants: int | None,
        max_num_other_participants: int | None,
    ) -> list[int]:
        mean, std = _num_participants_per_chat_mean_std
        num_participants_vals = np.random.lognormal(mean, std, size=num_chats)
        num_participants_vals = np.round(num_participants_vals).astype(int)  # Round to nearest integer and cast array

        # Correct unrealistic (non-positive) values (to default 1) or use specified "min" arg
        min_num_other_participants = min_num_other_participants or 1
        num_participants_vals[num_participants_vals < min_num_other_participants] = min_num_other_participants

        # Adjust values to "max" arg
        if max_num_other_participants is None:
            max_num_other_participants = len(self.context.entities)
        else:
            max_num_other_participants = min(max_num_other_participants, len(self.context.entities))
        num_participants_vals[num_participants_vals > max_num_other_participants] = max_num_other_participants

        return num_participants_vals.tolist()

    def _get_num_messages(self, num_messages: int, num_chats: int) -> np.ndarray:
        mean, std = _num_messages_per_chat_mean_std
        num_message_weights = np.random.lognormal(mean, std, size=num_chats)

        num_message_weights /= num_message_weights.sum()  # Normalize weights
        num_messages_vals = np.random.multinomial(n=num_messages, pvals=num_message_weights)
        return num_messages_vals

    def _adjust_empty_chats(self, num_messages_vals: np.ndarray, num_chats: int) -> np.ndarray:
        # Count chats that were empty by random and set chats empty or remove extras if needed
        target_num_empty_chats = np.random.binomial(
            True, p=_empty_chat_prob, size=num_chats
        ).sum()  # Target empty chats
        if target_num_empty_chats == num_chats:  # Avoid making all chats empty
            target_num_empty_chats = num_chats - 1

        empty_chat_idxs = np.flatnonzero(num_messages_vals == 0)
        num_empty_chats = len(empty_chat_idxs)  # Current empty chat count
        if target_num_empty_chats > num_empty_chats:  # Need to make more chats empty
            non_empty_chat_idxs = num_messages_vals.nonzero()[0]
            num_empty_chats_to_add = target_num_empty_chats - num_empty_chats
            empty_chat_idxs = np.random.choice(non_empty_chat_idxs, size=num_empty_chats_to_add, replace=False)
            num_messages_vals[empty_chat_idxs] = 0
        elif target_num_empty_chats < num_empty_chats:  # Too many empty chats, remove until target total is reached
            num_empty_chats_to_remove = num_empty_chats - target_num_empty_chats
            empty_for_removal_idxs = np.random.choice(empty_chat_idxs, size=num_empty_chats_to_remove, replace=False)
            num_messages_vals = np.delete(num_messages_vals, empty_for_removal_idxs)

        return num_messages_vals
