from datetime import datetime
from enum import Enum
from typing import Iterator

from faker import Faker

from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times
from model.tasks import CreditCardTask
from model.types import EventType, CreditCard


class CreditCardCompanies(Enum):
    UNKNOWN = 'Unknown'
    VISA = 'Visa'
    MASTERCARD = 'MasterCard'
    AMERICAN_EXPRESS = 'AmericanExpress'
    DINERS = 'Diners'
    DISCOVER = 'Discover'
    HIPER_CARD = 'HiperCard'
    UNION_PAY = 'UnionPay'
    MAESTRO = 'Maestro'
    SOLO = 'Solo'
    JCB = 'JCB'
    MIR = 'Mir'
    ELO = 'Elo'


_faker = Faker()


@register_contractor(EventType.CREDIT_CARD)
class CreditCardContractor(EventContractor[CreditCardTask, CreditCard]):
    def construct(self) -> Iterator[CreditCard]:
        companies = self._random_enum_choices(self.quantity, CreditCardCompanies)
        last_used_times = random_times(n=self.quantity, job=self.job)
        card_numbers = self._repeat_func(self.quantity, _faker.credit_card_number)
        expiration_dates = (datetime.strptime(_faker.credit_card_expire(), '%m/%y') for _ in range(self.quantity))
        owner_name = f'{self.context.owner_entity.first_name} {self.context.owner_entity.last_name}'
        location_ids = self.hub.get_task_location_ids(task=self.task)

        credit_cards = (
            CreditCard(
                company=company.value,
                owner_name=owner_name,
                number=number,
                expiration_date=expiration,
                last_used_date=last_used,
                location_id=location_id
            )
            for company, last_used, expiration, number, location_id
            in zip(companies, last_used_times, expiration_dates, card_numbers, location_ids)
        )

        yield from credit_cards
