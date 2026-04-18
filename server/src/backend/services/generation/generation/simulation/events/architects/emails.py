from random import randint, randrange
from typing import Iterator

from model.tasks import EmailTask
from model.types import EventType, Entity
from generation.simulation.events.architects.architect import Architect
from generation.simulation.events.architects.registry import register_architect
from generation.simulation.events.blueprints import EmailBlueprint


DEVICE_OWNER_PROB = 0.1


@register_architect(event_type=EventType.EMAIL)
class EmailArchitect(Architect[EmailTask]):
    def create_blueprints(self, n: int, params: EmailTask) -> Iterator[EmailBlueprint]:
        for _ in range(n):
            from_entity, to_entities = self._get_sender_recipients(params.min_recipients, params.max_recipients)
            yield EmailBlueprint(from_entity=from_entity, to_entities=to_entities)

    def _get_sender_recipients(self, min_recipients: int, max_recipients: int) -> tuple[Entity, list[Entity]]:
        sent_by_device_owner = randrange(int(100 * DEVICE_OWNER_PROB)) == 1

        num_to_entities = randint(0 if not sent_by_device_owner else min_recipients, max_recipients)
        to_entities = self.context.get_random_entities(num_to_entities, unique=True)

        if sent_by_device_owner:
            from_entity = self.context.owner_entity
        else:
            from_entity = self.context.get_random_entities(1)[0]
            to_entities.append(self.context.owner_entity)

        return from_entity, to_entities
