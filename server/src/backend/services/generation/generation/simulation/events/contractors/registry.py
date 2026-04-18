from typing import Callable

from model.types import EventType, FILE_EVENT_TYPES
from generation.simulation.events.contractors.contractor import Contractor


contractor_registry: dict[EventType, type[Contractor]] = {}                     # Registry of contractors by event type


def register_contractor(
        event_type: EventType,
        *,
        dependencies: set[EventType] = None
) -> Callable[[type[Contractor]], type[Contractor]]:

    dependencies = dependencies or set()
    if event_type in dependencies:
        raise Exception(f'Simulation of an event type cannot be self-dependent ({event_type})')

    # All non-file event types are dependent on app events
    if event_type not in FILE_EVENT_TYPES and event_type is not EventType.APP:
        dependencies = {EventType.APP, *dependencies}

    # All event types except app are dependent on locations
    if event_type not in [EventType.LOCATION, EventType.APP]:
        dependencies.add(EventType.LOCATION)

    def _register(contractor_class: type[Contractor]) -> type[Contractor]:
        if event_type in contractor_registry:
            raise Exception(f'Cannot register multiple contractors to the same event type ({event_type})')
        contractor_class.event_type_dependencies = dependencies
        contractor_registry[event_type] = contractor_class
        return contractor_class
    return _register
