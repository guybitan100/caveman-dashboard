from typing import Callable

from model.types import EventType
from generation.simulation.events.architects.architect import Architect


architect_registry: dict[EventType, type[Architect]] = {}  # Registry of architects by event type


def register_architect(
    event_type: EventType,
) -> Callable[[type[Architect]], type[Architect]]:
    """
    Decorator method that globally registers a Architect class to an EventType.

    Arguments:
        event_type: EventType to associate the Architect with.

    Examples:
        >>> @register_architect(event_type=EventType.CHAT)
            class ChatArchitect(Architect):
                def __init__(self, **kwargs):
                    super().__init__(**kwargs)
    """

    def _register(architect_class: type[Architect]) -> type[Architect]:
        if event_type in architect_registry:
            raise Exception(f"Cannot register multiple architects to the same event type ({event_type})")
        architect_registry[event_type] = architect_class
        return architect_class

    return _register
