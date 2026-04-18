from itertools import repeat
from typing import Iterator

from faker import Faker

from generation.simulation.data.generators.crypto import CryptoGenerator
from model.tasks import CarvedStringTask
from model.types import EventType, CarvedString
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times

_faker = Faker()


@register_contractor(EventType.CARVED_STRING)
class CarvedStringContractor(EventContractor[CarvedStringTask, CarvedString]):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.crypto_generator = CryptoGenerator()

    def construct(self) -> Iterator[CarvedString]:
        word_lens = self._random_range_choices(self.quantity, self.task.min_words, self.task.max_words)
        bodies = (_faker.sentence(nb_words=num_words, variable_nb_words=False) for num_words in word_lens)
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)
        if self.task.add_crypto_artifacts:
            has_crypto_artifacts = self._random_boolean_choices(n=self.quantity, true_prob=self.task.crypto_prob)
        else:
            has_crypto_artifacts = repeat(False, times=self.quantity)

        carved_strings = (
            CarvedString(
                body=body if not has_crypto_artifact else self.crypto_generator.enrich_string(body),
                time=time,
                location_id=location_id
            )
            for body, time, location_id, has_crypto_artifact in zip(bodies, times, location_ids, has_crypto_artifacts)
        )

        yield from carved_strings
