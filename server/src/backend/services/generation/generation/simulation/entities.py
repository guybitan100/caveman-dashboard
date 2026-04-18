import random
from collections import Counter

from model.tasks import GenerationTask, ChatTask, CalendarEntryTask, EmailTask
from model.types import EventType

SOCIAL_EVENT_TYPES = {
    EventType.CALL,
    EventType.CHAT,
    EventType.CONTACT,
    EventType.EMAIL,
    EventType.CALENDAR_ENTRY
}

_mean_std_coeffs = {
    EventType.CALL: (0.14260198, 0.04221766),
    EventType.CHAT: (1.80172926, 1.55424099),
    EventType.EMAIL: (2.56856311, 1.45455591),
    EventType.CALENDAR_ENTRY: (0.14260198, 0.04221766),     # Todo: Validate this
}


def get_entity_total(tasks: list[GenerationTask]) -> int:
    social_events_totals, min_params_entities = _get_events_totals(tasks=tasks)
    entity_totals = _get_entity_totals(event_totals=social_events_totals)
    total_entities = sum(entity_totals.values())
    total_entities = max(total_entities, min_params_entities)
    return total_entities


def _get_events_totals(tasks: list[GenerationTask]) -> tuple[Counter, int]:

    # Sum all task quantities for each event type
    event_totals = Counter()
    min_params_entities = 0     # Minimum total entities required by the tasks' params (e.g., max_recipients in Chat)
    for task in tasks:
        if task.event_type in SOCIAL_EVENT_TYPES:
            event_totals[task.event_type] += task.quantity
            min_params_entities = max(min_params_entities, _get_min_params_entities_by_event_type(task=task))
    return event_totals, min_params_entities


def _get_min_params_entities_by_event_type(task: GenerationTask) -> int:
    if isinstance(task, ChatTask):
        return task.max_num_other_participants
    elif isinstance(task, EmailTask):
        return task.max_recipients
    elif isinstance(task, CalendarEntryTask):
        return task.max_attendees
    return 0


def _get_entity_totals(event_totals: Counter) -> dict[EventType, int]:
    entity_totals = {}
    for event_type, event_total in event_totals.items():
        if event_type is EventType.CONTACT:
            entity_total = event_total  # Create an entity for every Contact event
        else:
            # Non-social event types have already been filtered out by here
            mean_coeff, std_coeff = _mean_std_coeffs[event_type]
            mean = mean_coeff * event_total
            std = std_coeff * event_total
            entity_total = round(random.gauss(mean, std))
            if entity_total <= 0:
                entity_total = 1
        entity_totals[event_type] = entity_total
    return entity_totals
