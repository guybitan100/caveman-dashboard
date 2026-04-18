from secrets import token_urlsafe
from typing import Iterator

from faker import Faker
from model.types import Cookie, EventType

from model.tasks import CookieTask

from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times

_faker = Faker()


@register_contractor(EventType.COOKIE)
class CookieContractor(EventContractor[CookieTask, Cookie]):
    def construct(self) -> Iterator[Cookie]:
        domains = self._repeat_func(self.quantity, _faker.domain_name)
        names = map(token_urlsafe, self._random_range_choices(self.quantity, self.task.min_name_len, self.task.max_name_len))
        values = map(token_urlsafe, self._random_range_choices(self.quantity, self.task.min_value_len, self.task.max_value_len))
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        cookies = (
            Cookie(
                domain=domain,
                name=name,
                value=value,
                time=time,
                location_id=location_id
            )
            for domain, name, value, time, location_id
            in zip(domains, names, values, times, location_ids)
        )

        yield from cookies
