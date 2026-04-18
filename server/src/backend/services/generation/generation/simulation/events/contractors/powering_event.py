from enum import Enum
from typing import Iterator

from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times
from model.tasks import PoweringEventTask
from model.types import EventType, PoweringEvent

DESCRIPTION_PROB = 0.01


class PowerEventType(Enum):
    ON = 'On'
    OFF = 'Off'
    RESET = 'Reset'
    CONNECT = 'Connect'
    DISCONNECT = 'Disconnect'
    TIME_ZONE_CHANGE = 'TimeZoneChange'


@register_contractor(EventType.POWERING_EVENT)
class PoweringEventContractor(EventContractor[PoweringEventTask, PoweringEvent]):
    def construct(self) -> Iterator[PoweringEvent]:
        powering_event_type_mask = self._random_enum_choices(self.quantity, PowerEventType)
        times = random_times(n=self.quantity, job=self.job)
        description_mask = self._random_boolean_choices(self.quantity, true_prob=DESCRIPTION_PROB)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        powering_events = (
            PoweringEvent(
                event_name=pe_type.value,
                time=time,
                description=self.get_description(event_type=pe_type) if has_description else None,
                location_id=location_id
            )
            for pe_type, time, has_description, location_id
            in zip(powering_event_type_mask, times, description_mask, location_ids)
        )

        yield from powering_events

    @staticmethod
    def get_description(event_type: PowerEventType) -> str | None:
        if event_type == PowerEventType.TIME_ZONE_CHANGE:
            return 'Daylight saving time On'
        elif event_type == PowerEventType.OFF:
            return 'battery critically low'
        return None
