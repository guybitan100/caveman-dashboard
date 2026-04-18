from typing import Iterator

from model.tasks import CallTask

from model.types import EventType

from generation.simulation.events.architects.architect import Architect
from generation.simulation.events.architects.registry import register_architect
from generation.simulation.events.blueprints import PhoneCallBlueprint


@register_architect(event_type=EventType.CALL)
class PhoneCallArchitect(Architect[CallTask]):
    def create_blueprints(self, n: int, params: CallTask) -> Iterator[PhoneCallBlueprint]:
        participants = self.context.get_random_entities(n)
        for participant in participants:
            yield PhoneCallBlueprint(participant=participant)
