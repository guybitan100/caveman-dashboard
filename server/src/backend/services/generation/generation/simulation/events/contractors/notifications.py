from typing import Iterator

from faker import Faker
from model.tasks import NotificationTask
from model.types import Notification, EventType

from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times

_faker = Faker()


@register_contractor(EventType.NOTIFICATION)
class NotificationContractor(EventContractor[NotificationTask, Notification]):
    def construct(self) -> Iterator[Notification]:
        word_lens = self._random_range_choices(self.quantity, self.task.min_words, self.task.max_words)
        bodies = (_faker.sentence(nb_words=num_words, variable_nb_words=False) for num_words in word_lens)
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        notifications = (
            Notification(
                body=body,
                time=time,
                location_id=location_id
            )
            for body, time, location_id
            in zip(bodies, times, location_ids)
        )

        yield from notifications
