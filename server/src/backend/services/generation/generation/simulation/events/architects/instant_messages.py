from typing import Iterator

from generation.simulation.events.architects.chats import ChatArchitect
from generation.simulation.events.blueprints import ChatBlueprint
from model.tasks import InstantMessageTask
from model.types import EventType

from generation.simulation.events.architects.registry import register_architect


@register_architect(event_type=EventType.INSTANT_MESSAGE)
class InstantMessageArchitect(ChatArchitect):
    def create_blueprints(self, n: int, params: InstantMessageTask) -> Iterator[ChatBlueprint]:
        return super().create_blueprints(n=n, params=params)
