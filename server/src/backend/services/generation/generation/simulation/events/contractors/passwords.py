from itertools import repeat
from secrets import token_urlsafe
from typing import Iterator

from faker import Faker

from generation.simulation.data.generators.crypto import CryptoGenerator
from model.tasks import PasswordTask
from model.types import Password, EventType
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times


_faker = Faker()


@register_contractor(EventType.PASSWORD)
class PasswordContractor(EventContractor[PasswordTask, Password]):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.crypto_generator = CryptoGenerator()

    def construct(self) -> Iterator[Password]:
        datas = map(token_urlsafe, self._random_range_choices(self.quantity, 6, 25))
        accounts = self._repeat_func(self.quantity, _faker.domain_name)
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)
        if self.task.add_crypto_artifacts:
            has_crypto_artifacts = self._random_boolean_choices(n=self.quantity, true_prob=self.task.crypto_prob)
        else:
            has_crypto_artifacts = repeat(False, times=self.quantity)

        passwords = (
            Password(
                data=data if not has_crypto_artifact else self.crypto_generator.enrich_string(data),
                account=account,
                time=time,
                location_id=location_id
            )
            for data, account, time, location_id, has_crypto_artifact
            in zip(datas, accounts, times, location_ids, has_crypto_artifacts)
        )

        yield from passwords
