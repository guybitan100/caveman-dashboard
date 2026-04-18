import random
from typing import Iterator

import numpy as np

from model.tasks import CallTask
from model.types import EventType, PhoneCall
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.events.blueprints import PhoneCallBlueprint
from generation.simulation.utils import random_times


"""
class PhoneCallStatus(Enum):
    Unknown = 'Unknown'
    Missed = 'Missed'
    Rejected = 'Rejected'
    Established = 'Established'
    BusyLine = 'BusyLine'
    Canceled = 'Canceled'
    Voicemail = 'Voicemail'
    NotEstablishedUnknownReason = 'NotEstablishedUnknownReason'
    AnsweredOnExternalDevice = 'AnsweredOnExternalDevice'
}
"""


class CallDirection:
    """Direction of the call"""

    INCOMING = "Incoming"
    OUTGOING = "Outgoing"
    UNKNOWN = "Unknown"


class CallType:
    INCOMING = "Incoming"
    OUTGOING = "Outgoing"
    MISSED = "Missed"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"
    UNKNOWN = "Unknown"


_MAX_CALL_DURATION_SEC = 86400 - 1      # 24 hours - 1 second

# Call direction probabilities
_call_direction_probs = {
    CallDirection.INCOMING: 0.5039475663500688,
    CallDirection.OUTGOING: 0.49597904454087494,
    CallDirection.UNKNOWN: 0.001321003963011889,
}

# Call type probabilities by direction
_call_type_probs = {
    CallDirection.INCOMING: {
        CallType.INCOMING: 0.5278776978417267,
        CallType.MISSED: 0.25764388489208634,
        CallType.REJECTED: 0.00539568345323741,
        None: 0.20908273381294964,
    },
    CallDirection.OUTGOING: {
        CallType.OUTGOING: 0.8177109028120375,
        CallType.REJECTED: 0.002220029600394672,
        CallType.CANCELLED: 0.000986679822397632,
        None: 0.17908238776517021,
    },
    CallDirection.UNKNOWN: {CallType.UNKNOWN: 1.0},
}

# Call type to duration weights (None, 0, sample_from_prob_dist)
_call_duration_probs_None_0_1 = {
    CallType.INCOMING: (0.018030910131654265, 0.02160847166571265, 0.9603606182026331),
    CallType.OUTGOING: (0.050777598368318175, 0.1967366363559106, 0.7524857652757713),
    CallType.MISSED: (0.16858937749857225, 0.8314106225014277, 0),
    CallType.UNKNOWN: (0.1296928327645051, 0.870307167235495, 0),
    CallType.REJECTED: (0.2891566265060241, 0.7108433734939759, 0),
    CallType.CANCELLED: (0, 1, 0),
    None: (0.09196492059729794, 0.3631192225645888, 0.5449158568381133),
}

# Log normal probability distribution parameters (mu, sigma)
_call_duration_prob_dist_params = {
    CallType.INCOMING: (4.59064990938373, 1.5003724288432214),
    CallType.OUTGOING: (1.2914590804697423, 7.502523965389088),
    None: (4.292711544294177, 12.618380449778662),
}


@register_contractor(EventType.CALL)
class CallContractor(EventContractor[CallTask, PhoneCall]):
    def construct(self, blueprints: Iterator[PhoneCallBlueprint]) -> Iterator[PhoneCall]:
        directions, durations, call_types = zip(*self._get_direction_call_type_duration())
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        calls = (
            PhoneCall(
                participant=blueprint.participant.uid,
                direction=direction,
                duration=duration,
                call_type=call_type,
                time=time,
                location_id=location_id
            )
            for blueprint, direction, duration, call_type, time, location_id
            in zip(blueprints, directions, durations, call_types, times, location_ids)
        )

        yield from calls

    def _get_direction_call_type_duration(self) -> Iterator[tuple[str, str | None, str | None]]:
        directions = self._random_choices(self.quantity, tuple(_call_direction_probs.keys()),
                                          weights=tuple(_call_direction_probs.values()))
        for direction in directions:
            call_type = self._get_call_type(direction=direction)
            duration = self._get_duration(call_type=call_type, min_duration_sec=self.task.min_duration_sec,
                                          max_duration_sec=self.task.max_duration_sec)
            yield direction, duration, call_type

    @staticmethod
    def _get_call_type(direction: str) -> str | None:
        call_type_probs = _call_type_probs[direction]
        call_type = random.choices(tuple(call_type_probs.keys()), weights=call_type_probs.values())[0]
        return call_type

    @staticmethod
    def _get_duration(
        call_type: str | None,
        min_duration_sec: int | None,
        max_duration_sec: int | None,
    ) -> str | None:
        # Determine if we should choose None, 0, or sample from the log normal prob. dist.
        weights = _call_duration_probs_None_0_1[call_type]
        duration = random.choices((None, 0, 1), weights=weights)[0]

        # Sample from log normal probability distribution (indicated by duration=1 sampled)
        if duration:  # =1, not None or 0
            mean, sigma = _call_duration_prob_dist_params[call_type]
            duration = int(np.random.lognormal(mean=mean, sigma=sigma))
            duration = min(duration, _MAX_CALL_DURATION_SEC)  # Avoids later cast issues with Mongo or xsdata

        # Adjust durations to be within range if min or max were specified
        if min_duration_sec is not None or max_duration_sec is not None:
            min_duration_sec = min_duration_sec or 0
            max_duration_sec = max_duration_sec or _MAX_CALL_DURATION_SEC
            if duration is None or duration < min_duration_sec:
                duration = min_duration_sec
            elif duration > max_duration_sec:
                duration = max_duration_sec

        return duration
