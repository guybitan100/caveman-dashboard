from enum import Enum
from typing import Iterator

from faker import Faker

from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times
from model.tasks import UserAccountTask
from model.types import EventType, UserAccount

_faker = Faker()

PASSWORD_PROB = 0.2


class UserNameType(Enum):
    OWNER_EMAIL = 'owner email'
    ENTITY_EMAIL = 'entity email'
    RANDOM = 'random'


@register_contractor(EventType.USER_ACCOUNT, dependencies={EventType.WEB_HISTORY})
class UserAccountContractor(EventContractor[UserAccountTask, UserAccount]):
    def construct(self) -> Iterator[UserAccount]:
        device_services = self._get_device_services(self.quantity)
        user_name_mask = self._random_enum_choices(self.quantity, UserNameType, weights=(0.5, 0.2, 0.2), none_weight=0.1)
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        password_mask = self._random_boolean_choices(self.quantity, true_prob=PASSWORD_PROB)

        user_accounts = (
            UserAccount(
                type=service,
                creation_date=time,
                user_name=self._get_user_name(name_type=name_type),
                password=_faker.password() if has_password else None,
                location_id=location_id
            )
            for service, time, has_password, name_type, location_id
            in zip(device_services, times, password_mask, user_name_mask, location_ids)
        )

        yield from user_accounts

    def _get_device_services(self, n: int) -> Iterator[str]:
        for app in self.hub.get_events({EventType.APP}):
            yield app.name
        for web_history in self.hub.get_events({EventType.WEB_HISTORY}):
            yield web_history.url
        yield from self._repeat_func(n, _faker.url)     # will repeat max n times, but zip may halt it early

    def _get_user_name(self, name_type: UserNameType) -> str | None:
        if name_type == UserNameType.OWNER_EMAIL:
            return self.context.owner_entity.email
        elif name_type == UserNameType.ENTITY_EMAIL:
            entity = self.context.get_random_entities(n=1)
            if entity:
                return entity[0].email
            else:
                return _faker.email()
        elif name_type == UserNameType.RANDOM:
            return _faker.user_name()
        else:
            return None
